"""
Deterministic Financial Calculation Engine (PRD FR-05, FR-28)
Executes strictly in deterministic Python code outside the LLM.
Calculates loan repayments, debt-service ratios, disposable income, and policy flags.
"""
from typing import Dict, Any, List, Optional
import math

class FinancialEngine:
    FORMULA_VERSION = "v1.1-2026-deterministic"
    
    # Standard Opticom Underwriting Policy Limits
    MAX_DSR_INDIVIDUAL = 0.35      # 35% max Debt Service Ratio for individuals
    MAX_DSR_SME = 0.40             # 40% max DSR for SME/Corporate cashflows
    MIN_COLLATERAL_COVERAGE = 1.20 # 120% coverage for secured facilities
    MAX_UNSECURED_TENOR_MONTHS = 24
    MAX_SECURED_TENOR_MONTHS = 48
    DEFAULT_ANNUAL_INTEREST_RATE = 0.28  # 28% APR standard benchmark

    @classmethod
    def calculate_monthly_installment(
        cls, 
        principal: float, 
        annual_rate: float, 
        tenor_months: int
    ) -> float:
        """
        Standard equal monthly installment (amortized PMT) formula.
        """
        if principal <= 0 or tenor_months <= 0:
            return 0.0
        
        monthly_rate = annual_rate / 12.0
        if monthly_rate == 0:
            return principal / tenor_months
            
        factor = math.pow(1.0 + monthly_rate, tenor_months)
        pmt = principal * (monthly_rate * factor) / (factor - 1.0)
        return round(pmt, 2)

    @classmethod
    def evaluate(cls, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates a complete financial profile and returns deterministic ratios,
        repayment schedule metrics, and policy flags.
        """
        amount = float(inputs.get("requested_amount", 0.0))
        tenor_months = int(inputs.get("tenor_months", 12))
        annual_rate = float(inputs.get("annual_interest_rate", cls.DEFAULT_ANNUAL_INTEREST_RATE))
        applicant_type = str(inputs.get("applicant_type", "INDIVIDUAL")).upper()
        
        # Incomes & Obligations
        monthly_income = float(inputs.get("verified_monthly_income", 0.0))
        existing_monthly_debt = float(inputs.get("existing_monthly_debt", 0.0))
        estimated_monthly_expenses = float(inputs.get("estimated_monthly_expenses", 0.0))
        collateral_value = float(inputs.get("collateral_value", 0.0))
        
        # Bank statement cashflow validation
        average_monthly_turnover = float(inputs.get("average_monthly_turnover", monthly_income))
        
        # Calculate Repayment
        monthly_installment = cls.calculate_monthly_installment(amount, annual_rate, tenor_months)
        total_repayment = round(monthly_installment * tenor_months, 2)
        total_interest = round(total_repayment - amount, 2)
        
        # Ratios
        total_obligations = existing_monthly_debt + monthly_installment
        dsr = round(total_obligations / monthly_income, 4) if monthly_income > 0 else 1.0
        
        net_disposable_income = round(
            monthly_income - (existing_monthly_debt + estimated_monthly_expenses + monthly_installment), 
            2
        )
        
        collateral_coverage = round(collateral_value / amount, 4) if amount > 0 else 0.0
        
        max_allowable_dsr = cls.MAX_DSR_SME if applicant_type in ["SME", "CORPORATE"] else cls.MAX_DSR_INDIVIDUAL
        
        # Maximum borrowing capacity based on allowable DSR
        available_monthly_capacity = max(0.0, (monthly_income * max_allowable_dsr) - existing_monthly_debt)
        if annual_rate > 0 and tenor_months > 0:
            monthly_rate = annual_rate / 12.0
            factor = math.pow(1.0 + monthly_rate, tenor_months)
            max_capacity_principal = round(available_monthly_capacity * (factor - 1.0) / (monthly_rate * factor), 2)
        else:
            max_capacity_principal = round(available_monthly_capacity * tenor_months, 2)
            
        # Policy Flags and Warnings
        policy_flags: List[Dict[str, Any]] = []
        
        if dsr > max_allowable_dsr:
            policy_flags.append({
                "code": "DSR_BREACH",
                "severity": "HIGH",
                "message": f"Debt Service Ratio of {round(dsr * 100, 1)}% exceeds policy ceiling of {int(max_allowable_dsr * 100)}%."
            })
            
        if net_disposable_income <= 0:
            policy_flags.append({
                "code": "NEGATIVE_NDI",
                "severity": "CRITICAL",
                "message": f"Net Disposable Income is negative (₦{net_disposable_income:,.2f}). Borrower cannot service debt safely."
            })
        elif net_disposable_income < (monthly_income * 0.15):
            policy_flags.append({
                "code": "THIN_NDI_BUFFER",
                "severity": "MEDIUM",
                "message": f"Net Disposable Income buffer is tight ({round(net_disposable_income / monthly_income * 100, 1)}% of income)."
            })
            
        if amount > 5_000_000 and collateral_coverage < cls.MIN_COLLATERAL_COVERAGE:
            policy_flags.append({
                "code": "INSUFFICIENT_COLLATERAL",
                "severity": "HIGH",
                "message": f"Loans above ₦5m require >= 120% collateral coverage. Current: {round(collateral_coverage * 100, 1)}%."
            })
            
        if applicant_type == "INDIVIDUAL" and tenor_months > cls.MAX_UNSECURED_TENOR_MONTHS and collateral_coverage < 1.0:
            policy_flags.append({
                "code": "TENOR_LIMIT_EXCEEDED",
                "severity": "MEDIUM",
                "message": f"Unsecured individual loans capped at {cls.MAX_UNSECURED_TENOR_MONTHS} months (requested: {tenor_months})."
            })
            
        if average_monthly_turnover < (monthly_income * 0.70):
            policy_flags.append({
                "code": "INCOME_TURNOVER_MISMATCH",
                "severity": "HIGH",
                "message": f"Bank statement turnover (₦{average_monthly_turnover:,.2f}) is materially below declared monthly income (₦{monthly_income:,.2f})."
            })
            
        # Overall deterministic eligibility recommendation
        eligible = len([f for f in policy_flags if f["severity"] in ["HIGH", "CRITICAL"]]) == 0
        
        return {
            "formula_version": cls.FORMULA_VERSION,
            "calculated_ratios": {
                "monthly_installment": monthly_installment,
                "total_repayment": total_repayment,
                "total_interest": total_interest,
                "dsr": dsr,
                "dsr_percentage": round(dsr * 100, 2),
                "max_allowable_dsr": max_allowable_dsr,
                "net_disposable_income": net_disposable_income,
                "collateral_coverage": collateral_coverage,
                "collateral_coverage_percentage": round(collateral_coverage * 100, 2),
                "max_capacity_principal": max_capacity_principal,
                "annual_interest_rate": annual_rate,
                "tenor_months": tenor_months
            },
            "policy_flags": policy_flags,
            "deterministic_verdict": "COMPLIANT" if eligible else "POLICY_EXCEPTION",
            "has_critical_flags": any(f["severity"] == "CRITICAL" for f in policy_flags)
        }
