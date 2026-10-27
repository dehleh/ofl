"""
Deterministic Financial Calculation Engine (PRD FR-05, FR-28)
Executes strictly in deterministic Python code outside the LLM.
Calculates Opticom loan repayments, reducing-balance amortization schedules,
debt-service ratios (DSR & DSCR), upfront fee schedules, stress test matrices,
and lender profitability analysis.
"""
from typing import Dict, Any, List, Optional
import math
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

class FinancialEngine:
    FORMULA_VERSION = "v2.0-opticom-cam-deterministic"
    
    # Standard Opticom Underwriting Policy Limits
    MAX_DSR_INDIVIDUAL = 0.35      # 35% max Debt Service Ratio for individuals
    MAX_DSR_SME = 0.40             # 40% max DSR for SME/Corporate cashflows
    MIN_DSCR = 1.30                # 1.30x min Debt Service Coverage Ratio
    MIN_COLLATERAL_COVERAGE = 1.20 # 120% coverage for secured facilities (180%+ for commercial transport)
    MAX_UNSECURED_TENOR_MONTHS = 24
    MAX_SECURED_TENOR_MONTHS = 48
    DEFAULT_ANNUAL_INTEREST_RATE = 0.28  # 28% APR standard benchmark (or 5% monthly reducing balance = 60% APR)
    OPTICOM_COST_OF_FUNDS_RATE = 0.24   # 24% per annum internal cost of funds benchmark

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
            return round(principal / tenor_months, 2)
            
        factor = math.pow(1.0 + monthly_rate, tenor_months)
        pmt = principal * (monthly_rate * factor) / (factor - 1.0)
        return round(pmt, 2)

    @classmethod
    def generate_amortization_schedule(
        cls,
        principal: float,
        annual_rate: float,
        tenor_months: int,
        start_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates month-by-month reducing balance amortization schedule table
        matching the Opticom CAM format (Page 8).
        """
        if principal <= 0 or tenor_months <= 0:
            return []

        if start_date is None:
            start_date = date.today()

        monthly_rate = annual_rate / 12.0
        pmt = cls.calculate_monthly_installment(principal, annual_rate, tenor_months)
        
        schedule = []
        current_balance = principal
        curr_dt = start_date

        for m in range(1, tenor_months + 1):
            curr_dt = curr_dt + relativedelta(months=1)
            month_label = curr_dt.strftime("%B-%y")
            
            interest_charge = round(current_balance * monthly_rate, 2)
            
            if m == tenor_months:
                # Final month clears remaining balance exactly
                principal_repaid = round(current_balance, 2)
                repayment = round(principal_repaid + interest_charge, 2)
                closing_balance = 0.0
            else:
                principal_repaid = round(pmt - interest_charge, 2)
                closing_balance = round(max(0.0, current_balance - principal_repaid), 2)
                repayment = pmt

            total_due = round(current_balance + interest_charge, 2)

            schedule.append({
                "period": m,
                "due_date": month_label,
                "opening_principal": round(current_balance, 2),
                "interest_charge": interest_charge,
                "interest_rate_pct": round(monthly_rate * 100, 2),
                "total_due": total_due,
                "monthly_repayment": repayment,
                "principal_repayment": principal_repaid,
                "closing_principal": closing_balance
            })
            current_balance = closing_balance

        return schedule

    @classmethod
    def calculate_upfront_fees(
        cls, 
        amount: float, 
        tenor_months: int
    ) -> Dict[str, Any]:
        """
        Computes upfront fees matching Opticom CAM Page 6 structure.
        """
        management_legal_fee = round(amount * 0.02, 2)       # 2%
        processing_fee = round(amount * 0.02, 2)             # 2%
        tracking_fee = 70_000.0 if amount >= 10_000_000 else 35_000.0
        stamp_duty = round(amount * 0.00125, 2)              # 0.125%
        vat_on_fees = round((management_legal_fee + processing_fee) * 0.075, 2) # 7.5% VAT
        
        # Credit Life Insurance benchmark: ~3.28% for 6 months (or ~0.547% per month)
        monthly_insurance_rate = 0.0328125 / 6.0
        credit_life_insurance = round(amount * (monthly_insurance_rate * tenor_months), 2)
        
        total_upfront = round(
            management_legal_fee + processing_fee + tracking_fee + stamp_duty + vat_on_fees + credit_life_insurance,
            2
        )

        return {
            "management_and_legal_fee": management_legal_fee,
            "processing_fee": processing_fee,
            "tracking_fee": tracking_fee,
            "stamp_duty": stamp_duty,
            "vat_on_fees": vat_on_fees,
            "credit_life_insurance": credit_life_insurance,
            "total_upfront_payment": total_upfront
        }

    @classmethod
    def calculate_opticom_profitability(
        cls,
        amount: float,
        total_interest: float,
        upfront_fees: float,
        tenor_months: int,
        cost_of_funds_rate: float = OPTICOM_COST_OF_FUNDS_RATE
    ) -> Dict[str, Any]:
        """
        Calculates net yield and profitability to Opticom Finance (Page 7).
        """
        total_income = round(total_interest + upfront_fees, 2)
        cost_of_funds = round(amount * cost_of_funds_rate * (tenor_months / 12.0), 2)
        gross_profit = round(total_income - cost_of_funds, 2)
        return {
            "interest_income": total_interest,
            "fee_income": upfront_fees,
            "total_income": total_income,
            "cost_of_funds_rate_pct": round(cost_of_funds_rate * 100, 1),
            "cost_of_funds": cost_of_funds,
            "gross_profit": gross_profit,
            "net_spread_pct": round((gross_profit / amount) * 100, 2) if amount > 0 else 0.0
        }

    @classmethod
    def evaluate_stress_test(
        cls,
        average_monthly_sales: float,
        available_income: float,
        monthly_repayment: float
    ) -> List[Dict[str, Any]]:
        """
        Calculates Base, -10% Mild, and -20% Moderate stress test scenarios (Page 5).
        """
        scenarios = [
            ("Base Case", "As presented in the CAM", 1.0, 1.0),
            ("Mild Stress", "10% decline in revenue and available income", 0.90, 0.90),
            ("Moderate Stress", "20% decline in revenue and available income", 0.80, 0.80)
        ]

        results = []
        for name, assumption, rev_factor, inc_factor in scenarios:
            adj_rev = round(average_monthly_sales * rev_factor, 2)
            adj_inc = round(available_income * inc_factor, 2)
            dscr = round(adj_inc / monthly_repayment, 2) if monthly_repayment > 0 else 0.0
            dsr_pct = round((monthly_repayment / adj_inc) * 100, 2) if adj_inc > 0 else 100.0

            if name == "Base Case":
                interp = (
                    f"The customer demonstrates adequate repayment capacity under the base case, "
                    f"with available income covering the monthly repayment approximately {dscr:.2f} times "
                    f"and {round(100 - dsr_pct, 2):.2f}% of available income remaining after debt service."
                )
            elif name == "Mild Stress":
                interp = (
                    f"With a 10% decline in revenue and available income, the customer remains capable "
                    f"of meeting the monthly repayment obligation (DSCR {dscr:.2f}x, DSR {dsr_pct:.2f}%), "
                    f"although the repayment cushion reduces moderately."
                )
            else:
                interp = (
                    f"Under a 20% decline, the customer continues to generate sufficient income to meet the "
                    f"repayment obligation with a DSCR of {dscr:.2f}x; however, the higher DSR ({dsr_pct:.2f}%) "
                    f"indicates increased sensitivity to revenue disruption."
                )

            results.append({
                "scenario": name,
                "assumption": assumption,
                "adjusted_revenue": adj_rev,
                "available_income": adj_inc,
                "monthly_repayment": monthly_repayment,
                "dscr": dscr,
                "dsr_percentage": dsr_pct,
                "interpretation": interp
            })

        return results

    @classmethod
    def evaluate(cls, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates a complete financial profile and returns deterministic ratios,
        repayment schedule metrics, Opticom fees, stress tests, and policy flags.
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
        collateral_fsv = float(inputs.get("collateral_fsv", collateral_value * 0.70))
        
        # Bank statement cashflow validation
        average_monthly_turnover = float(inputs.get("average_monthly_turnover", monthly_income))
        
        # Calculate Repayment & Amortization
        monthly_installment = cls.calculate_monthly_installment(amount, annual_rate, tenor_months)
        schedule = cls.generate_amortization_schedule(amount, annual_rate, tenor_months)
        total_interest = sum(p["interest_charge"] for p in schedule) if schedule else round((monthly_installment * tenor_months) - amount, 2)
        total_repayment = round(amount + total_interest, 2)

        # Upfront Fees & Opticom Profitability
        upfront_fees = cls.calculate_upfront_fees(amount, tenor_months)
        opticom_profitability = cls.calculate_opticom_profitability(
            amount, 
            total_interest, 
            upfront_fees["total_upfront_payment"], 
            tenor_months
        )
        
        # Available income left to meet loan payment
        # Operating income after business expenses and non-Opticom debts
        available_income = max(0.0, monthly_income - existing_monthly_debt - estimated_monthly_expenses)
        net_profit_after_opticom = round(available_income - monthly_installment, 2)

        # Ratios (DSR & DSCR)
        if applicant_type in ["SME", "CORPORATE"]:
            dsr = round(monthly_installment / available_income, 4) if available_income > 0 else 1.0
        else:
            total_obligations = existing_monthly_debt + monthly_installment
            dsr = round(total_obligations / monthly_income, 4) if monthly_income > 0 else 1.0

        dscr = round(available_income / monthly_installment, 2) if monthly_installment > 0 else 0.0
        
        collateral_coverage = round(collateral_value / amount, 4) if amount > 0 else 0.0
        collateral_fsv_coverage = round(collateral_fsv / amount, 4) if amount > 0 else 0.0
        
        max_allowable_dsr = cls.MAX_DSR_SME if applicant_type in ["SME", "CORPORATE"] else cls.MAX_DSR_INDIVIDUAL
        
        # Maximum borrowing capacity based on allowable DSR
        available_monthly_capacity = max(0.0, (monthly_income * max_allowable_dsr) - existing_monthly_debt)
        if annual_rate > 0 and tenor_months > 0:
            monthly_rate = annual_rate / 12.0
            factor = math.pow(1.0 + monthly_rate, tenor_months)
            max_capacity_principal = round(available_monthly_capacity * (factor - 1.0) / (monthly_rate * factor), 2)
        else:
            max_capacity_principal = round(available_monthly_capacity * tenor_months, 2)
            
        # Stress test matrix
        stress_tests = cls.evaluate_stress_test(
            average_monthly_sales=average_monthly_turnover,
            available_income=available_income if available_income > 0 else monthly_income * 0.20,
            monthly_repayment=monthly_installment
        )

        # Policy Flags and Warnings
        policy_flags: List[Dict[str, Any]] = []
        
        if dsr > max_allowable_dsr:
            policy_flags.append({
                "code": "DSR_BREACH",
                "severity": "HIGH",
                "message": f"Debt Service Ratio of {round(dsr * 100, 1)}% exceeds policy ceiling of {int(max_allowable_dsr * 100)}%."
            })

        if applicant_type in ["SME", "CORPORATE"] and dscr < cls.MIN_DSCR:
            policy_flags.append({
                "code": "LOW_DSCR",
                "severity": "HIGH",
                "message": f"Debt Service Coverage Ratio ({dscr:.2f}x) is below Opticom minimum benchmark of {cls.MIN_DSCR:.2f}x."
            })
            
        if net_profit_after_opticom <= 0:
            policy_flags.append({
                "code": "NEGATIVE_NDI",
                "severity": "CRITICAL",
                "message": f"Net Profit after debt service is negative (₦{net_profit_after_opticom:,.2f}). Borrower cannot service facility safely."
            })
        elif net_profit_after_opticom < (monthly_income * 0.15):
            policy_flags.append({
                "code": "THIN_NDI_BUFFER",
                "severity": "MEDIUM",
                "message": f"Net profit buffer is tight ({round(net_profit_after_opticom / monthly_income * 100, 1)}% of income)."
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
                "available_income": available_income,
                "net_profit_after_debt_service": net_profit_after_opticom,
                "net_disposable_income": net_profit_after_opticom,
                "dsr": dsr,
                "dsr_percentage": round(dsr * 100, 2),
                "dscr": dscr,
                "max_allowable_dsr": max_allowable_dsr,
                "collateral_coverage": collateral_coverage,
                "collateral_coverage_percentage": round(collateral_coverage * 100, 2),
                "collateral_fsv": collateral_fsv,
                "collateral_fsv_coverage_percentage": round(collateral_fsv_coverage * 100, 2),
                "max_capacity_principal": max_capacity_principal,
                "annual_interest_rate": annual_rate,
                "tenor_months": tenor_months,
                "upfront_fees": upfront_fees,
                "opticom_profitability": opticom_profitability,
                "stress_tests": stress_tests,
                "amortization_schedule": schedule
            },
            "policy_flags": policy_flags,
            "deterministic_verdict": "COMPLIANT" if eligible else "POLICY_EXCEPTION",
            "has_critical_flags": any(f["severity"] == "CRITICAL" for f in policy_flags)
        }
