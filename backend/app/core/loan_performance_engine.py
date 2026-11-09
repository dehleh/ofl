"""
Opticom Finance Limited - Loan Portfolio Telemetry & Performance Engine
Monitors post-disbursement loan servicing performance:
- Tracks repayment timeliness (On-Time, In-Grace, Overdue)
- Enforces Opticom 7-day grace period policy
- Calculates and applies 5% default penalty for overdue servicing > 7 days
- Tracks serviced principal/interest vs outstanding exposure
"""
import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..database import utc_now
from ..models.entities import CreditCase, LoanPerformance, Disbursement, Offer
from .financial_engine import FinancialEngine

class LoanPerformanceEngine:
    GRACE_PERIOD_DAYS = 7
    PENALTY_RATE_PCT = 5.0  # 5% penalty after 7 days overdue

    @classmethod
    def initialize_loan_performance(
        cls,
        credit_case: CreditCase,
        db: Session
    ) -> LoanPerformance:
        """
        Initializes post-disbursement servicing telemetry record for a funded facility.
        """
        app = credit_case.application
        customer = app.customer
        latest_offer = db.query(Offer).filter(Offer.case_id == credit_case.id).order_by(Offer.issued_at.desc()).first()

        principal = float(app.amount)
        tenor = int(app.tenor)
        annual_rate = float(latest_offer.interest_rate_pct) / 100.0 if latest_offer else 0.28
        monthly_pmt = float(latest_offer.monthly_repayment) if latest_offer else FinancialEngine.calculate_monthly_installment(principal, annual_rate, tenor)

        # Generate month-by-month schedule
        schedule_items = []
        now_dt = utc_now()
        current_bal = principal
        monthly_rate = annual_rate / 12.0

        for month in range(1, tenor + 1):
            due_dt = now_dt + timedelta(days=30 * month)
            interest_part = round(current_bal * monthly_rate, 2)
            principal_part = round(monthly_pmt - interest_part, 2)
            if month == tenor:
                principal_part = round(current_bal, 2)
                total_pmt = round(principal_part + interest_part, 2)
                closing = 0.0
            else:
                total_pmt = monthly_pmt
                closing = round(max(0.0, current_bal - principal_part), 2)

            schedule_items.append({
                "installment_no": month,
                "due_date": due_dt.strftime("%Y-%m-%d"),
                "total_due": total_pmt,
                "principal_component": principal_part,
                "interest_component": interest_part,
                "status": "DUE_CURRENT" if month == 1 else "UPCOMING",
                "paid_amount": 0.0,
                "paid_date": None,
                "days_overdue": 0,
                "penalty_applied": 0.0,
                "closing_balance": closing
            })
            current_bal = closing

        first_due = now_dt + timedelta(days=30)
        total_repayable = round(monthly_pmt * tenor, 2)

        record = LoanPerformance(
            case_id=credit_case.id,
            facility_number=credit_case.case_number,
            borrower_name=customer.name,
            disbursed_principal=principal,
            interest_rate_apr=round(annual_rate * 100, 2),
            tenor_months=tenor,
            monthly_installment=monthly_pmt,
            total_installments_count=tenor,
            installments_serviced=0,
            installments_remaining=tenor,
            principal_serviced=0.0,
            interest_serviced=0.0,
            total_amount_serviced=0.0,
            outstanding_principal=principal,
            outstanding_total=total_repayable,
            next_due_date=first_due,
            days_overdue=0,
            grace_period_days=cls.GRACE_PERIOD_DAYS,
            penalty_rate_pct=cls.PENALTY_RATE_PCT,
            penalty_accrued=0.0,
            performance_status="PERFORMING_CURRENT",
            repayment_schedule=schedule_items,
            repayment_history=[],
            disbursed_at=now_dt
        )
        db.add(record)
        return record

    @classmethod
    def evaluate_performance(
        cls,
        loan_perf: LoanPerformance,
        reference_dt: Optional[datetime] = None
    ) -> LoanPerformance:
        """
        Evaluates repayment status, checks 7-day grace period, and computes 5% default penalty.
        """
        if loan_perf.outstanding_principal <= 0.0 or loan_perf.installments_remaining == 0:
            loan_perf.performance_status = "CLOSED_FULLY_SETTLED"
            loan_perf.days_overdue = 0
            loan_perf.penalty_accrued = 0.0
            return loan_perf

        now_dt = reference_dt or utc_now()
        due_dt = loan_perf.next_due_date

        if due_dt:
            # Ensure consistent timezone awareness for offset comparisons
            if getattr(now_dt, "tzinfo", None) is not None and getattr(due_dt, "tzinfo", None) is None:
                due_dt = due_dt.replace(tzinfo=timezone.utc)
            elif getattr(now_dt, "tzinfo", None) is None and getattr(due_dt, "tzinfo", None) is not None:
                now_dt = now_dt.replace(tzinfo=timezone.utc)

        if due_dt and now_dt > due_dt:
            # Overdue calculation
            diff_days = (now_dt - due_dt).days
            loan_perf.days_overdue = max(0, diff_days)

            if diff_days <= cls.GRACE_PERIOD_DAYS:
                # Inside 7-day grace period: Alert active, 0% penalty so far
                loan_perf.performance_status = "GRACE_PERIOD_ACTIVE"
                loan_perf.penalty_accrued = 0.0
            else:
                # Beyond 7 days grace: 5% Default Penalty applied on installment
                loan_perf.performance_status = "OVERDUE_PENALTY_APPLIED"
                penalty = round(loan_perf.monthly_installment * (cls.PENALTY_RATE_PCT / 100.0), 2)
                loan_perf.penalty_accrued = penalty
                if diff_days > 30:
                    loan_perf.performance_status = "CRITICAL_DELINQUENT"
        else:
            loan_perf.days_overdue = 0
            loan_perf.penalty_accrued = 0.0
            loan_perf.performance_status = "PERFORMING_CURRENT"

        loan_perf.updated_at = utc_now()
        return loan_perf

    @classmethod
    def record_repayment(
        cls,
        loan_perf: LoanPerformance,
        amount_paid: float,
        payment_date: Optional[datetime] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Records an official loan repayment, reconciles schedules, and advances installment pointers.
        """
        cls.evaluate_performance(loan_perf)
        paid_dt = payment_date or utc_now()
        schedule = list(loan_perf.repayment_schedule or [])

        # Find current active installment
        active_idx = -1
        for idx, item in enumerate(schedule):
            if item.get("status") in ["DUE_CURRENT", "OVERDUE", "UPCOMING"]:
                active_idx = idx
                break

        if active_idx == -1 and schedule:
            active_idx = len(schedule) - 1

        active_inst = schedule[active_idx] if schedule else {}
        total_due_this_period = active_inst.get("total_due", loan_perf.monthly_installment) + loan_perf.penalty_accrued

        principal_comp = active_inst.get("principal_component", round(loan_perf.monthly_installment * 0.75, 2))
        interest_comp = active_inst.get("interest_component", round(loan_perf.monthly_installment * 0.25, 2))
        penalty_paid = loan_perf.penalty_accrued

        # Update tracking numbers
        loan_perf.installments_serviced += 1
        loan_perf.installments_remaining = max(0, loan_perf.total_installments_count - loan_perf.installments_serviced)
        loan_perf.principal_serviced = round(loan_perf.principal_serviced + principal_comp, 2)
        loan_perf.interest_serviced = round(loan_perf.interest_serviced + interest_comp, 2)
        loan_perf.total_amount_serviced = round(loan_perf.total_amount_serviced + amount_paid, 2)
        loan_perf.outstanding_principal = round(max(0.0, loan_perf.outstanding_principal - principal_comp), 2)
        loan_perf.outstanding_total = round(max(0.0, loan_perf.outstanding_total - amount_paid), 2)
        loan_perf.last_payment_date = paid_dt

        # Update installment item
        status_label = "PAID_ON_TIME" if loan_perf.days_overdue == 0 else "PAID_LATE_WITH_PENALTY"
        active_inst["status"] = status_label
        active_inst["paid_amount"] = amount_paid
        active_inst["paid_date"] = paid_dt.strftime("%Y-%m-%d %H:%M")
        active_inst["days_overdue"] = loan_perf.days_overdue
        active_inst["penalty_applied"] = penalty_paid
        schedule[active_idx] = active_inst

        # Advance next due date if more installments remain
        if active_idx + 1 < len(schedule):
            next_inst = schedule[active_idx + 1]
            next_inst["status"] = "DUE_CURRENT"
            schedule[active_idx + 1] = next_inst
            loan_perf.next_due_date = paid_dt + timedelta(days=30)
            loan_perf.days_overdue = 0
            loan_perf.penalty_accrued = 0.0
            loan_perf.performance_status = "PERFORMING_CURRENT"
        else:
            loan_perf.performance_status = "CLOSED_FULLY_SETTLED"
            loan_perf.days_overdue = 0
            loan_perf.penalty_accrued = 0.0

        # Append to payment history log
        history_item = {
            "payment_id": f"PMT-{uuid.uuid4().hex[:8].upper()}",
            "amount": amount_paid,
            "principal_portion": principal_comp,
            "interest_portion": interest_comp,
            "penalty_portion": penalty_paid,
            "payment_date": paid_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "days_overdue": loan_perf.days_overdue,
            "status_applied": status_label
        }
        history = list(loan_perf.repayment_history or [])
        history.insert(0, history_item)
        loan_perf.repayment_history = history
        loan_perf.repayment_schedule = schedule
        loan_perf.updated_at = utc_now()

        if db:
            db.commit()
            db.refresh(loan_perf)

        return {
            "message": f"Repayment of ₦{amount_paid:,.2f} recorded successfully.",
            "performance_status": loan_perf.performance_status,
            "outstanding_principal": loan_perf.outstanding_principal,
            "outstanding_total": loan_perf.outstanding_total,
            "installments_serviced": loan_perf.installments_serviced,
            "installments_remaining": loan_perf.installments_remaining,
            "payment_receipt": history_item
        }

    @classmethod
    def simulate_status(
        cls,
        loan_perf: LoanPerformance,
        scenario: str,
        db: Optional[Session] = None
    ) -> LoanPerformance:
        """
        Demonstration helper: Instantly configures a facility to showcase:
        - CURRENT: 0 days overdue (Performing Current)
        - GRACE_PERIOD: 4 days overdue (within 7-day grace, 0% penalty)
        - OVERDUE_PENALTY: 10 days overdue (> 7 days grace, 5% default penalty applied!)
        - CRITICAL: 35 days overdue (Delinquent recovery)
        """
        now_dt = utc_now()
        if scenario == "CURRENT":
            loan_perf.next_due_date = now_dt + timedelta(days=15)
            loan_perf.days_overdue = 0
            loan_perf.penalty_accrued = 0.0
            loan_perf.performance_status = "PERFORMING_CURRENT"

        elif scenario == "GRACE_PERIOD":
            loan_perf.next_due_date = now_dt - timedelta(days=4)
            loan_perf.days_overdue = 4
            loan_perf.penalty_accrued = 0.0
            loan_perf.performance_status = "GRACE_PERIOD_ACTIVE"

        elif scenario == "OVERDUE_PENALTY":
            loan_perf.next_due_date = now_dt - timedelta(days=10)
            loan_perf.days_overdue = 10
            penalty = round(loan_perf.monthly_installment * 0.05, 2)
            loan_perf.penalty_accrued = penalty
            loan_perf.performance_status = "OVERDUE_PENALTY_APPLIED"

        elif scenario == "CRITICAL":
            loan_perf.next_due_date = now_dt - timedelta(days=35)
            loan_perf.days_overdue = 35
            penalty = round(loan_perf.monthly_installment * 0.05, 2)
            loan_perf.penalty_accrued = penalty
            loan_perf.performance_status = "CRITICAL_DELINQUENT"

        loan_perf.updated_at = now_dt
        if db:
            db.commit()
            db.refresh(loan_perf)

        return loan_perf
