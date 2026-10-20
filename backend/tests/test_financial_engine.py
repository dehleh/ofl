"""
Unit Tests for Deterministic Financial Calculation Engine (PRD FR-05, FR-28)
"""
import pytest
from app.core.financial_engine import FinancialEngine

def test_pmt_calculation():
    # ₦1,000,000 at 24% annual interest for 12 months (2% monthly)
    # PMT = 1,000,000 * (0.02 * (1.02)^12) / ((1.02)^12 - 1) = ₦94,559.60
    installment = FinancialEngine.calculate_monthly_installment(1_000_000, 0.24, 12)
    assert 94500 < installment < 94600

def test_financial_evaluation_healthy():
    inputs = {
        "requested_amount": 2_000_000,
        "tenor_months": 12,
        "annual_interest_rate": 0.24,
        "applicant_type": "INDIVIDUAL",
        "verified_monthly_income": 800_000,
        "existing_monthly_debt": 50_000,
        "estimated_monthly_expenses": 250_000,
        "collateral_value": 0
    }
    result = FinancialEngine.evaluate(inputs)
    assert result["deterministic_verdict"] == "COMPLIANT"
    assert result["calculated_ratios"]["dsr"] < 0.35
    assert result["calculated_ratios"]["net_disposable_income"] > 300_000
    assert len(result["policy_flags"]) == 0

def test_dsr_breach_detection():
    inputs = {
        "requested_amount": 10_000_000,
        "tenor_months": 12,
        "annual_interest_rate": 0.28,
        "applicant_type": "INDIVIDUAL",
        "verified_monthly_income": 600_000,
        "existing_monthly_debt": 200_000,
        "estimated_monthly_expenses": 300_000,
        "collateral_value": 0
    }
    result = FinancialEngine.evaluate(inputs)
    assert result["deterministic_verdict"] == "POLICY_EXCEPTION"
    flag_codes = [f["code"] for f in result["policy_flags"]]
    assert "DSR_BREACH" in flag_codes
    assert "NEGATIVE_NDI" in flag_codes
