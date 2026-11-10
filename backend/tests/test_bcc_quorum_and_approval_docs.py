from fastapi.testclient import TestClient
from app.main import app
from app.models import CaseState
from app.services.approval_document_service import ApprovalDocumentService, naira_to_words

client = TestClient(app)

def test_naira_to_words_and_formatting():
    assert "one hundred and twenty million naira" in naira_to_words(120_000_000.0).lower()
    assert "five million naira" in naira_to_words(5_000_000.0).lower()
    assert "twenty five thousand naira" in naira_to_words(25_000.0).lower()

def test_approval_document_service_suite():
    # Mock credit case with vehicle and landed property
    class MockCustomer:
        id = "cust-123"
        name = "DEMASI ENTERPRISES LIMITED"
        email = "md@demasi.ng"
        phone = "+2348033334444"
        rc_number = "RC-998877"
        bvn = "22233344455"
        external_references = {
            "director_name": "Chief Dike Henry Okechukwu",
            "residential_address": "Plot 12, Admiralty Way, Lekki Phase 1, Lagos",
            "business_address": "Suite 4B, Commercial Avenue, Ikeja, Lagos",
            "guarantor_name": "Mr. Warekromo Ebi Kingsley",
            "guarantor_address": "15 Adeola Odeku Street, Victoria Island, Lagos",
            "guarantor_phone": "08023456789",
            "guarantor_occupation": "Managing Director / Real Estate Developer",
            "guarantor_bvn": "22334455667"
        }

    class MockApplication:
        id = "app-123"
        customer = MockCustomer()
        amount = 35_000_000.0
        tenor = 12
        purpose = "Commercial truck acquisition and warehouse expansion backed by landed title deed"

    class MockCase:
        id = "case-test-999"
        case_number = "OFL-2026-TEST"
        state = "OFFER_PENDING"
        revision = 1
        application = MockApplication()

    docs = ApprovalDocumentService.generate_case_documents(MockCase())
    doc_types = [d["doc_type"] for d in docs]

    # Verify standard legal documents
    assert "OFFER_LETTER" in doc_types
    assert "BILL_OF_SALE_CLIENT" in doc_types
    assert "BILL_OF_SALE_GUARANTOR" in doc_types
    assert "GUARANTEE_CLIENT" in doc_types
    assert "GUARANTEE_GUARANTOR" in doc_types
    
    # Collateral conditional documents
    assert "TRANSFER_OF_OWNERSHIP" in doc_types  # from 'truck'
    assert "TRIPARTITE_AGREEMENT" in doc_types   # from 'landed' / 'warehouse'
    assert "LOAN_AGREEMENT" in doc_types

    # Verify 7-day grace period and 5% default penalty in offer letter
    offer_doc = next(d for d in docs if d["doc_type"] == "OFFER_LETTER")
    html_lower = offer_doc["html"].lower()
    assert "5% flat per month" in html_lower
    assert "7-day" in html_lower or "seven (7) calendar days" in html_lower
    assert "demasi enterprises limited" in html_lower

    # Verify personal guarantee client
    guarantee_doc = next(d for d in docs if d["doc_type"] == "GUARANTEE_CLIENT")
    assert "chief dike henry okechukwu" in guarantee_doc["html"].lower()


def test_bcc_quorum_workflow_and_api():
    # 1. Create a large commercial application (> ₦20m)
    app_payload = {
        "applicant_name": "ZENITH MEGA CONTRACTORS LTD",
        "applicant_type": "CORPORATE",
        "email": "operations@zenithmega.ng",
        "phone": "+2348099887766",
        "rc_number": "RC-445566",
        "bvn": "22334411223",
        "nin": "12345678901",
        "business_address": "Plot 18, Commercial Way, Ikeja, Lagos",
        "residential_address": "12, Cooper Road, Ikoyi, Lagos",
        "collateral_description": "Fleet of Mack Haulage Trucks and Lekki Warehouse C of O Title",
        "amount": 45_000_000.0,  # ₦45M -> BCC tier
        "tenor_months": 24,
        "purpose": "Fleet purchase of Mack Heavy Haulage Trucks and warehouse depot facility",
        "monthly_income": 9_500_000.0
    }
    create_res = client.post("/api/v1/intake/direct", json=app_payload)
    assert create_res.status_code == 201, create_res.text
    case_data = create_res.json()
    case_id = case_data["case_id"]

    # Transition from KYC_PENDING to ANALYST_REVIEW
    k_trans = client.post(f"/api/v1/cases/{case_id}/transition", json={
        "to_state": CaseState.ANALYST_REVIEW.value,
        "actor": "System KYC Engine",
        "role": "ANALYST",
        "reason": "KYC identity checks cleared successfully."
    })
    assert k_trans.status_code == 200

    # 2. Progress through MCC flow to MD
    # Analyst review -> Head of BD
    res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Babatunde Adebayo",
        "role": "ANALYST",
        "decision": "RECOMMEND_APPROVE",
        "comments": "Audited financials and debt service capacity vetted."
    })
    assert res.status_code == 200
    assert res.json()["case_state"] == CaseState.HEAD_OF_BD_REVIEW.value

    # Head of BD -> HRM
    res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Dapo Adeleke",
        "role": "HEAD_OF_BD",
        "decision": "APPROVE",
        "comments": "MCC commercial sponsorship endorsed."
    })
    assert res.status_code == 200
    assert res.json()["case_state"] == CaseState.HRM_REVIEW.value

    # HRM -> MD
    res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Chidinma Okafor",
        "role": "HRM",
        "decision": "APPROVE",
        "comments": "Risk covenants acceptable."
    })
    assert res.status_code == 200
    assert res.json()["case_state"] == CaseState.MD_DECISION.value

    # MD endorses: Since ₦45M > ₦20M, routes to BCC_REVIEW
    res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Folashade Tinubu",
        "role": "MD",
        "decision": "APPROVE",
        "comments": "Executive recommendation for Board sanction."
    })
    assert res.status_code == 200
    assert res.json()["case_state"] == CaseState.BCC_REVIEW.value

    # 3. Check BCC status before any board votes
    status_res = client.get(f"/api/v1/cases/{case_id}/bcc-status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_bcc_tier"] is True
    assert status_data["required_quorum"] == 2
    assert status_data["approved_count"] == 0
    assert status_data["quorum_achieved"] is False

    # 4. BCC Member 1 votes (Emeka Nnamdi)
    res_vote1 = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Emeka Nnamdi",
        "role": "BCC",
        "decision": "APPROVE",
        "comments": "BCC Chair approval recorded."
    })
    assert res_vote1.status_code == 200
    # Quorum not yet reached: case MUST remain in BCC_REVIEW
    assert res_vote1.json()["case_state"] == CaseState.BCC_REVIEW.value
    assert "1 of 2" in res_vote1.json()["message"]

    # Verify status endpoint reflects 1 vote
    status_res = client.get(f"/api/v1/cases/{case_id}/bcc-status")
    assert status_res.json()["approved_count"] == 1
    assert status_res.json()["quorum_achieved"] is False

    # 5. BCC Member 2 votes (Alhaji Aliyu Dangote) -> Quorum reached!
    res_vote2 = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Alhaji Aliyu Dangote",
        "role": "BCC",
        "decision": "APPROVE",
        "comments": "Risk trustee board approval granted."
    })
    assert res_vote2.status_code == 200
    # Quorum achieved (2 of 3): case MUST advance to OFFER_PENDING
    assert res_vote2.json()["case_state"] == CaseState.OFFER_PENDING.value
    assert "quorum achieved" in res_vote2.json()["message"].lower()

    # 6. Fetch post-approval legal document package via API
    docs_res = client.get(f"/api/v1/cases/{case_id}/offer-documents")
    assert docs_res.status_code == 200
    docs_data = docs_res.json()
    assert docs_data["documents_count"] >= 5
    returned_types = [d["doc_type"] for d in docs_data["documents"]]
    assert "OFFER_LETTER" in returned_types
    assert "BILL_OF_SALE_CLIENT" in returned_types
    assert "GUARANTEE_CLIENT" in returned_types
    assert "GUARANTEE_GUARANTOR" in returned_types

    # 7. Test single document raw HTML endpoint
    doc_html_res = client.get(f"/api/v1/cases/{case_id}/offer-documents/OFFER_LETTER?raw_html=true")
    assert doc_html_res.status_code == 200
    assert "ZENITH MEGA CONTRACTORS LTD" in doc_html_res.text
    assert "OPTICOM FINANCE LIMITED" in doc_html_res.text

    # 8. Verify multi-recipient email dispatch (Applicant + Guarantor) & In-App notifications
    telemetry_data = client.get("/api/v1/telemetry/notifications").json()
    delivery_logs = telemetry_data.get("delivery_logs", [])
    recipients = [log.get("recipient") for log in delivery_logs if isinstance(log, dict)]
    assert "operations@zenithmega.ng" in recipients

    # Verify In-App notifications API
    in_app_res = client.get("/api/v1/notifications")
    assert in_app_res.status_code == 200
    in_app_items = in_app_res.json()
    assert len(in_app_items) > 0
    first_notif_id = in_app_items[0]["id"]

    # Mark single notification as read
    read_res = client.post(f"/api/v1/notifications/{first_notif_id}/read")
    assert read_res.status_code == 200
    assert read_res.json()["success"] is True

    # Mark all as read
    all_read_res = client.post("/api/v1/notifications/mark-all-read")
    assert all_read_res.status_code == 200
    assert all_read_res.json()["success"] is True


def test_bcc_approval_blocked_without_prior_md_approval():
    """
    Hard Invariant: Facilities > ₦20m require Managing Director (MD) endorsement
    before Board Credit Committee (BCC) members can vote or achieve quorum.
    """
    create_res = client.post("/api/v1/intake/direct", json={
        "applicant_name": "APEX COMMERCE CORP",
        "applicant_type": "CORPORATE",
        "email": "corp@apexcommerce.ng",
        "phone": "+2348011223344",
        "rc_number": "RC-778899",
        "bvn": "22114455667",
        "amount": 28_000_000.0,  # > ₦20M
        "tenor_months": 18,
        "purpose": "Inventory expansion and machinery funding",
        "monthly_income": 4_500_000.0
    })
    assert create_res.status_code == 201
    case_id = create_res.json()["case_id"]

    # Put in BCC_REVIEW manually or attempt BCC approval without MD approval
    client.post(f"/api/v1/cases/{case_id}/transition", json={
        "to_state": CaseState.BCC_REVIEW.value,
        "actor": "Admin Override",
        "role": "ADMIN",
        "reason": "Routing to test BCC guard without MD endorsement."
    })

    # BCC member attempts approval without prior MD approval
    bcc_res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Emeka Nnamdi",
        "role": "BCC",
        "decision": "APPROVE",
        "comments": "BCC Chair premature approval test."
    })
    assert bcc_res.status_code == 400
    assert "Managing Director (MD) endorsement is mandatory" in bcc_res.json()["detail"]
