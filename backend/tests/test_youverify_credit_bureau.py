"""
Test Suite: Option B — CRC Credit Bureau via Youverify v2 API (/v2/api/identity/credit-report/ng/individual)
Validates:
- NDPA borrower consent enforcement
- Credit bureau lookup, caching (no duplicate billing), and force refresh
- FinancialEngine policy flags: LOW_BUREAU_SCORE, ACTIVE_NPL_OR_ARREARS, UNDISCLOSED_BUREAU_DEBT
- Guarantor BVN bureau auto-pull & CAM integration (VertexAICamService)
- Live Youverify HTTP JSON normalization & 403 permission-required graceful handling
"""
import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models import (
    Customer, Application, CreditCase, CaseState,
    KYCCheck, FinancialAssessment, AuditEvent
)
from app.integrations.youverify_adapter import YouverifyAdapter
from app.integrations.vertex_ai_service import VertexAICamService

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_case(db: Session, bvn: str, existing_debt: float = 50_000.0, guarantor_bvn: str = "22446688001"):
    uid = uuid.uuid4().hex[:8]
    cust = Customer(
        name=f"Bureau Test Obligor {uid}",
        email=f"bureau_{uid}@opticomtest.ng",
        phone="08030001122",
        bvn=bvn,
        customer_type="CORPORATE"
    )
    db.add(cust)
    db.commit()

    app_rec = Application(
        customer_id=cust.id,
        amount=8_000_000.0,
        tenor=12,
        currency="NGN",
        purpose="Working Capital Expansion",
        applicant_type="SME",
        raw_payload={
            "guarantor_name": "Abubakar Suleiman",
            "guarantor_bvn": guarantor_bvn,
            "guarantor_phone": "+2348039998877"
        }
    )
    db.add(app_rec)
    db.commit()

    case = CreditCase(
        case_number=f"OFL-BUR-{uid.upper()}",
        application_id=app_rec.id,
        state=CaseState.ANALYST_REVIEW.value,
        revision=1
    )
    db.add(case)
    db.commit()

    fa = FinancialAssessment(
        case_id=case.id,
        formula_version="v2.0-opticom-cam-deterministic",
        input_snapshot={
            "requested_amount": 8_000_000.0,
            "tenor_months": 12,
            "applicant_type": "SME",
            "verified_monthly_income": 3_500_000.0,
            "existing_monthly_debt": existing_debt,
            "estimated_monthly_expenses": 600_000.0,
            "collateral_value": 12_000_000.0
        },
        calculated_ratios={"dsr": 0.25, "dscr": 3.5},
        policy_flags=[],
        performed_by="Initial Test Assessment"
    )
    db.add(fa)
    db.commit()
    db.refresh(case)
    return case, cust, app_rec


def _cleanup_case(db: Session, case_id: str, app_id: str, cust_id: str):
    try:
        db.query(AuditEvent).filter(AuditEvent.correlation_id.like("OFL-BUR-%")).delete(synchronize_session=False)
        db.query(FinancialAssessment).filter(FinancialAssessment.case_id == case_id).delete()
        db.query(KYCCheck).filter(KYCCheck.case_id == case_id).delete()
        db.query(CreditCase).filter(CreditCase.id == case_id).delete()
        db.query(Application).filter(Application.id == app_id).delete()
        db.query(Customer).filter(Customer.id == cust_id).delete()
        db.commit()
    except Exception:
        db.rollback()


def test_consent_required_for_credit_bureau_pull(db_session: Session):
    case, cust, app_rec = _create_case(db_session, bvn="99911122233")
    try:
        res = client.post(
            f"/api/v1/cases/{case.id}/credit-bureau/pull",
            json={"consent_confirmed": False, "actor": "Credit Analyst"}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "CONSENT_REQUIRED"
        assert body["eligible"] is False
    finally:
        _cleanup_case(db_session, case.id, app_rec.id, cust.id)


def test_subprime_npl_and_undisclosed_debt_flags_and_caching(db_session: Session):
    # BVN starting with 999 triggers Sandbox Subprime (score 510, ₦1.85M overdue @ 120 DPD)
    case, cust, app_rec = _create_case(db_session, bvn="99912345678", existing_debt=20_000.0, guarantor_bvn="22889900112")
    try:
        res = client.post(
            f"/api/v1/cases/{case.id}/credit-bureau/pull",
            json={"consent_confirmed": True, "actor": "Credit Analyst"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "FLAGGED"
        assert data["bureau_report"]["score"] == 510
        assert data["bureau_report"]["score_band"] == "SUBPRIME"
        assert data["bureau_report"]["guarantor_bureau"]["checked"] is True
        assert data["bureau_report"]["guarantor_bureau"]["score"] == 728

        flag_codes = {f["code"] for f in data["financial_assessment"]["policy_flags"]}
        assert "LOW_BUREAU_SCORE" in flag_codes
        assert "ACTIVE_NPL_OR_ARREARS" in flag_codes
        assert "UNDISCLOSED_BUREAU_DEBT" in flag_codes
        assert data["financial_assessment"]["deterministic_verdict"] == "POLICY_EXCEPTION"

        # Second call without force_refresh returns cached pull without inserting a second KYCCheck
        res_cached = client.post(
            f"/api/v1/cases/{case.id}/credit-bureau/pull",
            json={"consent_confirmed": True, "force_refresh": False}
        )
        assert res_cached.status_code == 200
        assert res_cached.json()["cached"] is True
        count_checks = db_session.query(KYCCheck).filter(
            KYCCheck.case_id == case.id,
            KYCCheck.provider == "YOUVERIFY_CRC_BUREAU"
        ).count()
        assert count_checks == 1

        # Verify CAM embeds live bureau scorecard & tradelines automatically
        db_session.refresh(case)
        latest_fa = (
            db_session.query(FinancialAssessment)
            .filter(FinancialAssessment.case_id == case.id)
            .order_by(FinancialAssessment.created_at.desc())
            .first()
        )
        cam_payload = VertexAICamService.build_opticom_cam_template_data(case, latest_fa, actor="Analyst")
        assert cam_payload["credit_checks"]["bureau_score"] == 510
        assert "510/850" in cam_payload["credit_checks"]["promoter_search"]
        assert cam_payload["credit_checks"]["external_report"][0]["institution"] == "Access Bank Plc"
    finally:
        _cleanup_case(db_session, case.id, app_rec.id, cust.id)


def test_live_youverify_http_normalization_and_403_handling(db_session: Session):
    case, cust, app_rec = _create_case(db_session, bvn="22778899110", existing_debt=100_000.0, guarantor_bvn="")
    try:
        # 1. Mock live Youverify HTTP 200 OK CRC Bureau response
        mock_ok_res = MagicMock()
        mock_ok_res.status_code = 200
        mock_ok_res.content = b"{}"
        mock_ok_res.json.return_value = {
            "success": True,
            "data": {
                "searchId": "yv-live-crc-001",
                "creditBureau": {
                    "provider": "crc",
                    "reportReference": "CRC-LIVE-774411",
                    "scoreDetails": {"score": 742, "scoreBand": "Prime", "grading": "Low Risk"},
                    "summary": {
                        "totalActiveAccounts": 1,
                        "totalClosedAccounts": 2,
                        "totalOutstandingBalance": 1_200_000.0,
                        "totalOverdueBalance": 0.0,
                        "worstPaymentStatus": "00"
                    },
                    "accounts": [
                        {
                            "institution": "GTBank Plc",
                            "accountType": "Term Facility",
                            "originalAmount": 3_000_000.0,
                            "currentBalance": 1_200_000.0,
                            "installmentAmount": 110_000.0,
                            "status": "Performing"
                        }
                    ],
                    "enquiries": []
                }
            }
        }

        with patch("app.integrations.youverify_adapter.settings.MOCK_YOUVERIFY_SANDBOX", False), \
             patch("app.integrations.youverify_adapter.settings.YOUVERIFY_API_KEY", "live_test_key"), \
             patch("app.integrations.youverify_adapter.httpx.Client") as mock_client_cls:
            mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_ok_res
            res = client.post(
                f"/api/v1/cases/{case.id}/credit-bureau/pull",
                json={"consent_confirmed": True, "force_refresh": True}
            )
            assert res.status_code == 200
            body = res.json()
            assert body["status"] == "PASSED"
            assert body["bureau_report"]["mode"] == "LIVE_YOUVERIFY_BUREAU"
            assert body["bureau_report"]["bureau_provider"] == "CRC Credit Bureau (via Youverify)"
            assert body["bureau_report"]["score"] == 742

        # 2. Mock live Youverify HTTP 403 (merchant account hasn't enabled Credit Report yet)
        mock_403_res = MagicMock()
        mock_403_res.status_code = 403
        mock_403_res.content = b"{}"
        mock_403_res.json.return_value = {"success": False, "message": "Forbidden: Credit Bureau module inactive"}

        with patch("app.integrations.youverify_adapter.settings.MOCK_YOUVERIFY_SANDBOX", False), \
             patch("app.integrations.youverify_adapter.settings.YOUVERIFY_API_KEY", "live_test_key"), \
             patch("app.integrations.youverify_adapter.httpx.Client") as mock_client_cls:
            mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_403_res
            res_403 = client.post(
                f"/api/v1/cases/{case.id}/credit-bureau/pull",
                json={"consent_confirmed": True, "force_refresh": True}
            )
            assert res_403.status_code == 200
            body_403 = res_403.json()
            assert body_403["status"] == "PERMISSION_REQUIRED"
            assert "Youverify Dashboard" in body_403["bureau_report"]["action_required"]
    finally:
        _cleanup_case(db_session, case.id, app_rec.id, cust.id)

