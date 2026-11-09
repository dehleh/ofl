"""
Test Suite: BVN Auto-Resolution & Mandatory Document Essentials
Validates:
- BVN resolution endpoint (/api/v1/intake/resolve-bvn)
- Auto-population of legal name, business address, residential address, NIN, and means of ID
- Direct application submission with new document types (MEANS_OF_ID, UTILITY_BILL, PASSPORT_PHOTO, WORK_ID, COLLATERAL_DOCUMENT)
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_resolve_bvn_endpoint_success():
    res = client.post("/api/v1/intake/resolve-bvn", json={"bvn": "2233307057"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["bvn"] == "2233307057"
    assert "applicant_name" in data
    assert "business_address" in data
    assert "residential_address" in data
    assert "means_of_id_type" in data
    assert "means_of_id_number" in data
    assert data["id_validity_status"] == "VALID_ACTIVE"

def test_resolve_bvn_invalid_length():
    res = client.post("/api/v1/intake/resolve-bvn", json={"bvn": "123"})
    assert res.status_code == 422

def test_submit_direct_application_with_document_manifest():
    payload = {
        "applicant_name": "Test Dynamic Logistics Ltd",
        "applicant_type": "SME",
        "email": "test.logistics@opticomfinance.com",
        "phone": "08031112233",
        "bvn": "22114477889",
        "nin": "65112233445",
        "rc_number": "RC-998877",
        "business_address": "Plot 12, Commercial Block, Ikeja, Lagos",
        "residential_address": "8, Oladipo Bateye St, GRA Ikeja, Lagos",
        "means_of_id_type": "NATIONAL_ID",
        "means_of_id_number": "NIN-65112233445",
        "collateral_description": "2 Units of 20-ton Trucks & Title Deed to Commercial Property",
        "amount": 10000000.0,
        "tenor_months": 12,
        "purpose": "Procurement of inventory and logistics equipment",
        "facility_type": "Working Capital",
        "monthly_income": 8500000.0,
        "existing_monthly_debt": 350000.0,
        "estimated_monthly_expenses": 2500000.0,
        "collateral_value": 20000000.0,
        "documents": [
            {"name": "Bank_Statement_6M.pdf", "type": "BANK_STATEMENT", "summary": "6-Month statement"},
            {"name": "National_ID_Card.pdf", "type": "MEANS_OF_ID", "summary": "Valid NIMC Card"},
            {"name": "EKEDC_Utility_Bill.pdf", "type": "UTILITY_BILL", "summary": "Dated within last 3 months"},
            {"name": "Passport_Photo.jpg", "type": "PASSPORT_PHOTO", "summary": "Recent white background photo"},
            {"name": "Work_Staff_ID.pdf", "type": "WORK_ID", "summary": "Valid staff badge"},
            {"name": "CAC_Cert_MemArt.pdf", "type": "CAC_REGISTRATION", "summary": "CAC incorporation docs"},
            {"name": "Property_Title_Deed.pdf", "type": "COLLATERAL_DOCUMENT", "summary": "Collateral proof of ownership"}
        ]
    }
    res = client.post("/api/v1/intake/direct", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "case_number" in data
    assert "case_id" in data

