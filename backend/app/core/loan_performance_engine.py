"""
Opticom Finance Limited - Loan Portfolio Telemetry & Performance Engine
Monitors post-disbursement loan servicing performance:
- Tracks repayment timeliness (On-Time, In-Grace, Overdue)
- Enforces Opticom 7-day grace period policy
- Calculates and applies 5% default penalty for overdue servicing > 7 days
- Tracks serviced principal/interest vs outstanding exposure
"""
import csv
import html
import io
import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..database import utc_now
from ..models.entities import CreditCase, LoanPerformance, Disbursement, Offer, CaseState, AuditEvent
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
        Idempotent: returns existing LoanPerformance row if already initialized for the case.
        """
        existing = db.query(LoanPerformance).filter(LoanPerformance.case_id == credit_case.id).first()
        if existing:
            return existing

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
                # Beyond 7 days grace: 5% Default Penalty applied on installment unless waived
                schedule = list(loan_perf.repayment_schedule or [])
                active_inst = next(
                    (s for s in schedule if s.get("status") in ["DUE_CURRENT", "OVERDUE", "UPCOMING"]),
                    None
                )
                is_waived = bool(active_inst and active_inst.get("penalty_waived"))
                loan_perf.performance_status = "OVERDUE_PENALTY_APPLIED"
                penalty = 0.0 if is_waived else round(loan_perf.monthly_installment * (cls.PENALTY_RATE_PCT / 100.0), 2)
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
        db: Optional[Session] = None,
        payment_method: str = "DIRECT_DEBIT",
        reference: Optional[str] = None,
        note: Optional[str] = None,
        recorded_by: str = "Treasury / Credit Operations"
    ) -> Dict[str, Any]:
        """
        Records an official loan repayment, reconciles schedules, advances installment pointers,
        and logs payment reference/channel/audit metadata for the borrower statement ledger.
        """
        cls.evaluate_performance(loan_perf)
        paid_dt = payment_date or utc_now()
        schedule = list(loan_perf.repayment_schedule or [])
        days_overdue_at_payment = int(loan_perf.days_overdue or 0)

        # Find current active installment
        active_idx = -1
        for idx, item in enumerate(schedule):
            if item.get("status") in ["DUE_CURRENT", "OVERDUE", "UPCOMING"]:
                active_idx = idx
                break

        if active_idx == -1 and schedule:
            active_idx = len(schedule) - 1

        active_inst = dict(schedule[active_idx]) if active_idx >= 0 and schedule else {}

        penalty_paid = min(float(loan_perf.penalty_accrued or 0.0), float(amount_paid))
        sched_interest = float(active_inst.get("interest_component", active_inst.get("interest_due", round(loan_perf.monthly_installment * 0.25, 2))))
        sched_principal = float(active_inst.get("principal_component", active_inst.get("principal_due", round(loan_perf.monthly_installment * 0.75, 2))))

        remaining_after_penalty = max(0.0, float(amount_paid) - penalty_paid)
        interest_comp = round(min(sched_interest, remaining_after_penalty), 2)
        principal_comp = round(max(0.0, remaining_after_penalty - interest_comp), 2)
        if active_inst and principal_comp == 0.0 and remaining_after_penalty >= (sched_interest + sched_principal):
            principal_comp = sched_principal

        # Update tracking numbers
        loan_perf.installments_serviced += 1
        loan_perf.installments_remaining = max(0, loan_perf.total_installments_count - loan_perf.installments_serviced)
        loan_perf.principal_serviced = round(loan_perf.principal_serviced + principal_comp, 2)
        loan_perf.interest_serviced = round(loan_perf.interest_serviced + interest_comp, 2)
        loan_perf.total_amount_serviced = round(loan_perf.total_amount_serviced + amount_paid, 2)
        loan_perf.outstanding_principal = round(max(0.0, loan_perf.outstanding_principal - principal_comp), 2)
        loan_perf.outstanding_total = round(max(0.0, loan_perf.outstanding_total - max(0.0, amount_paid - penalty_paid)), 2)
        loan_perf.last_payment_date = paid_dt

        # Update installment item
        status_label = "PAID_ON_TIME" if days_overdue_at_payment == 0 else (
            "PAID_IN_GRACE" if days_overdue_at_payment <= cls.GRACE_PERIOD_DAYS else "PAID_LATE_WITH_PENALTY"
        )
        if active_idx >= 0 and schedule:
            active_inst["status"] = status_label
            active_inst["paid_amount"] = amount_paid
            active_inst["paid_date"] = paid_dt.strftime("%Y-%m-%d %H:%M")
            active_inst["days_overdue"] = days_overdue_at_payment
            active_inst["penalty_applied"] = penalty_paid
            schedule[active_idx] = active_inst

        # Advance next due date if more installments remain
        if active_idx >= 0 and active_idx + 1 < len(schedule) and loan_perf.outstanding_principal > 0:
            next_inst = dict(schedule[active_idx + 1])
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

        payment_id = f"PMT-{uuid.uuid4().hex[:8].upper()}"
        ref_code = (reference or "").strip() or payment_id

        # Append to payment history log with both canonical and normalized display metadata
        history_item = {
            "payment_id": payment_id,
            "reference": ref_code,
            "payment_method": payment_method or "DIRECT_DEBIT",
            "note": (note or "").strip() or f"Installment #{active_inst.get('installment_no', loan_perf.installments_serviced)} settlement",
            "recorded_by": recorded_by,
            "amount": amount_paid,
            "principal_portion": principal_comp,
            "interest_portion": interest_comp,
            "penalty_portion": penalty_paid,
            "outstanding_balance_after": loan_perf.outstanding_total,
            "payment_date": paid_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "days_overdue": days_overdue_at_payment,
            "status_applied": status_label
        }
        history = list(loan_perf.repayment_history or [])
        history.insert(0, history_item)
        loan_perf.repayment_history = history
        loan_perf.repayment_schedule = schedule
        loan_perf.updated_at = utc_now()

        if db:
            db.add(AuditEvent(
                actor=recorded_by,
                role="TREASURY",
                event="REPAYMENT_RECORDED",
                entity="LOAN_PERFORMANCE",
                entity_id=loan_perf.case_id,
                correlation_id=ref_code,
                reason=history_item["note"],
                details={
                    "payment_id": payment_id,
                    "reference": ref_code,
                    "payment_method": history_item["payment_method"],
                    "amount": amount_paid,
                    "principal_portion": principal_comp,
                    "interest_portion": interest_comp,
                    "penalty_portion": penalty_paid,
                    "outstanding_balance_after": loan_perf.outstanding_total,
                }
            ))
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

    @classmethod
    def ensure_disbursed_cases_initialized(cls, db: Session) -> int:
        """
        Ensures every CreditCase in Disbursed/Monitoring (or with an active confirmed
        Disbursement) has a LoanPerformance record so real facilities never silently vanish.
        """
        existing_case_ids = {row[0] for row in db.query(LoanPerformance.case_id).all()}
        disbursed_cases = (
            db.query(CreditCase)
            .filter(CreditCase.state == CaseState.DISBURSED_MONITORING.value)
            .all()
        )
        created = 0
        for case in disbursed_cases:
            if case.id not in existing_case_ids:
                cls.initialize_loan_performance(case, db)
                existing_case_ids.add(case.id)
                created += 1
        if created:
            db.commit()
        return created

    @classmethod
    def waive_penalty(
        cls,
        loan_perf: LoanPerformance,
        reason: str,
        actor: str = "Head of Risk Management",
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Waives accrued 5% overdue penalty on the active cycle with full audit logging.
        """
        waived_amount = float(loan_perf.penalty_accrued or 0.0)
        schedule = list(loan_perf.repayment_schedule or [])
        for idx, item in enumerate(schedule):
            if item.get("status") in ["DUE_CURRENT", "OVERDUE", "UPCOMING"]:
                updated = dict(item)
                updated["penalty_waived"] = True
                updated["penalty_waived_amount"] = waived_amount
                updated["penalty_waived_by"] = actor
                updated["penalty_waived_reason"] = reason
                schedule[idx] = updated
                break

        loan_perf.repayment_schedule = schedule
        loan_perf.penalty_accrued = 0.0
        loan_perf.updated_at = utc_now()

        if db:
            db.add(AuditEvent(
                actor=actor,
                role="HRM",
                event="PENALTY_WAIVED",
                entity="LOAN_PERFORMANCE",
                entity_id=loan_perf.case_id,
                correlation_id=loan_perf.facility_number,
                reason=reason,
                details={"waived_amount": waived_amount, "days_overdue": loan_perf.days_overdue}
            ))
            db.commit()
            db.refresh(loan_perf)

        return {
            "message": f"Default penalty of ₦{waived_amount:,.2f} waived successfully.",
            "waived_amount": waived_amount,
            "penalty_accrued": loan_perf.penalty_accrued,
            "performance_status": loan_perf.performance_status,
        }

    @classmethod
    def add_monitoring_note(
        cls,
        loan_perf: LoanPerformance,
        note_type: str,
        note: str,
        actor: str = "Credit Monitoring Officer",
        role: str = "ANALYST",
        promise_to_pay_date: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Records a post-disbursement surveillance log (call log, field inspection, promise-to-pay, escalation).
        """
        entry_id = f"MON-{uuid.uuid4().hex[:8].upper()}"
        details = {
            "note_type": note_type or "CALL_LOG",
            "promise_to_pay_date": promise_to_pay_date,
            "facility_number": loan_perf.facility_number,
            "days_overdue_at_log": loan_perf.days_overdue,
        }
        if db:
            evt = AuditEvent(
                actor=actor,
                role=role,
                event="MONITORING_NOTE",
                entity="LOAN_PERFORMANCE",
                entity_id=loan_perf.case_id,
                correlation_id=entry_id,
                reason=note,
                details=details,
            )
            db.add(evt)
            db.commit()
            db.refresh(evt)
            ts = evt.timestamp.strftime("%Y-%m-%d %H:%M") if evt.timestamp else utc_now().strftime("%Y-%m-%d %H:%M")
        else:
            ts = utc_now().strftime("%Y-%m-%d %H:%M")

        return {
            "id": entry_id,
            "note_type": details["note_type"],
            "note": note,
            "actor": actor,
            "role": role,
            "promise_to_pay_date": promise_to_pay_date,
            "timestamp": ts,
            "days_overdue_at_log": details["days_overdue_at_log"],
        }

    @classmethod
    def _compute_individual_score(cls, loan_perf: LoanPerformance, normalized_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes a transparent 0-100 Post-Disbursement Servicing Health Score from
        repayment punctuality, overdue severity, and completion ratio.
        """
        serviced_count = len(normalized_history)
        on_time_count = sum(1 for h in normalized_history if int(h.get("days_overdue") or 0) == 0)
        on_time_rate = round((on_time_count / serviced_count) * 100, 1) if serviced_count > 0 else (
            100.0 if loan_perf.days_overdue == 0 else 0.0
        )

        score = 100
        if loan_perf.days_overdue > 30:
            score -= 55
        elif loan_perf.days_overdue > cls.GRACE_PERIOD_DAYS:
            score -= 35
        elif loan_perf.days_overdue > 0:
            score -= 15

        late_payments = max(0, serviced_count - on_time_count)
        score -= min(25, late_payments * 8)

        total_repayable = round(float(loan_perf.monthly_installment or 0.0) * max(1, int(loan_perf.total_installments_count or 1)), 2)
        principal = max(float(loan_perf.disbursed_principal or 0.0), 1.0)
        principal_completion_pct = round(min(100.0, (float(loan_perf.principal_serviced or 0.0) / principal) * 100), 1)
        contract_serviced_pct = round(min(100.0, (float(loan_perf.total_amount_serviced or 0.0) / max(total_repayable, 1.0)) * 100), 1)

        if loan_perf.performance_status == "CLOSED_FULLY_SETTLED":
            score = 100
        score = max(0, min(100, int(round(score))))

        if score >= 85:
            grade, grade_label = "A", "Prime Servicing"
        elif score >= 70:
            grade, grade_label = "B", "Satisfactory / Watch"
        elif score >= 50:
            grade, grade_label = "C", "Substandard (Arrears)"
        else:
            grade, grade_label = "D", "Delinquent / Recovery"

        return {
            "performance_score": score,
            "health_grade": grade,
            "health_label": grade_label,
            "on_time_rate_pct": on_time_rate,
            "principal_completion_pct": principal_completion_pct,
            "contract_serviced_pct": contract_serviced_pct,
            "total_scheduled_contract": total_repayable,
        }

    @classmethod
    def build_individual_loan_dossier(cls, loan_perf: LoanPerformance, db: Session) -> Dict[str, Any]:
        """
        Builds a full individual facility performance & Statement of Account dossier:
        - Normalized amortization schedule & repayment history (covering legacy/new field names)
        - Individual loan health score, yields, completion ratios, next-due countdown
        - Borrower, Guarantor, Collateral, and Disbursement metadata from linked CreditCase
        - Chronological Debit/Credit Loan Statement of Account ledger with running balance
        - Post-disbursement monitoring notes & audit log (waivers, reminders, call logs)
        """
        cls.evaluate_performance(loan_perf)
        case = db.query(CreditCase).filter(CreditCase.id == loan_perf.case_id).first()
        app = case.application if case else None
        cust = app.customer if app else None
        raw = (app.raw_payload or {}) if app else {}
        disb = db.query(Disbursement).filter(Disbursement.case_id == loan_perf.case_id).order_by(Disbursement.created_at.desc()).first()

        # Normalize amortization schedule rows so both engine & UI keys are populated
        raw_schedule = list(loan_perf.repayment_schedule or [])
        normalized_schedule: List[Dict[str, Any]] = []
        for idx, item in enumerate(raw_schedule):
            p_due = float(item.get("principal_component", item.get("principal_due", 0.0)) or 0.0)
            i_due = float(item.get("interest_component", item.get("interest_due", 0.0)) or 0.0)
            total_inst = float(item.get("total_due", item.get("total_installment", round(p_due + i_due, 2))) or 0.0)
            serviced_at = item.get("paid_date") or item.get("serviced_at")
            raw_status = item.get("status", "UPCOMING")
            normalized_schedule.append({
                "installment_no": item.get("installment_no", idx + 1),
                "due_date": item.get("due_date", ""),
                "principal_component": p_due,
                "interest_component": i_due,
                "total_due": total_inst,
                "closing_balance": float(item.get("closing_balance", 0.0) or 0.0),
                "status": raw_status,
                "paid_amount": float(item.get("paid_amount", 0.0) or 0.0),
                "paid_date": serviced_at,
                "days_overdue": int(item.get("days_overdue", 0) or 0),
                "penalty_applied": float(item.get("penalty_applied", 0.0) or 0.0),
                "penalty_waived": bool(item.get("penalty_waived", False)),
            })

        # Normalize repayment history rows
        raw_history = list(loan_perf.repayment_history or [])
        normalized_history: List[Dict[str, Any]] = []
        for item in raw_history:
            p_comp = float(item.get("principal_portion", item.get("principal_credited", 0.0)) or 0.0)
            i_comp = float(item.get("interest_portion", item.get("interest_credited", 0.0)) or 0.0)
            pen_comp = float(item.get("penalty_portion", item.get("penalty_applied", 0.0)) or 0.0)
            normalized_history.append({
                "payment_id": item.get("payment_id", item.get("reference", "")),
                "reference": item.get("reference", item.get("payment_id", "")),
                "payment_method": item.get("payment_method", "DIRECT_DEBIT"),
                "note": item.get("note", item.get("status_applied", "Installment repayment")),
                "recorded_by": item.get("recorded_by", "Treasury / Credit Operations"),
                "amount": float(item.get("amount", 0.0) or 0.0),
                "principal_portion": p_comp,
                "interest_portion": i_comp,
                "penalty_portion": pen_comp,
                "outstanding_balance_after": item.get("outstanding_balance_after"),
                "payment_date": item.get("payment_date", ""),
                "days_overdue": int(item.get("days_overdue", 0) or 0),
                "status_applied": item.get("status_applied", "PAID_ON_TIME"),
            })

        metrics = cls._compute_individual_score(loan_perf, normalized_history)
        total_sched_interest = round(sum(row["interest_component"] for row in normalized_schedule), 2)
        interest_earned_pct = round(min(100.0, (float(loan_perf.interest_serviced or 0.0) / max(total_sched_interest, 1.0)) * 100), 1)

        # Build chronological Loan Statement of Account Ledger
        disb_dt_str = loan_perf.disbursed_at.strftime("%Y-%m-%d %H:%M") if loan_perf.disbursed_at else utc_now().strftime("%Y-%m-%d")
        contract_debit = round(float(loan_perf.disbursed_principal or 0.0) + total_sched_interest, 2)
        if contract_debit <= 0:
            contract_debit = float(metrics["total_scheduled_contract"])

        running_balance = float(loan_perf.disbursed_principal or 0.0)
        statement_entries: List[Dict[str, Any]] = [
            {
                "entry_date": disb_dt_str,
                "reference": (disb.nav_reference if disb and disb.nav_reference else loan_perf.facility_number),
                "entry_type": "DISBURSEMENT",
                "description": f"Principal Facility Disbursed ({raw.get('facility_classification') or 'Working Capital'})",
                "debit": round(float(loan_perf.disbursed_principal or 0.0), 2),
                "credit": 0.0,
                "principal_component": round(float(loan_perf.disbursed_principal or 0.0), 2),
                "interest_component": 0.0,
                "penalty_component": 0.0,
                "running_balance": round(running_balance, 2),
            },
            {
                "entry_date": disb_dt_str,
                "reference": f"INT-{loan_perf.facility_number}",
                "entry_type": "CONTRACT_INTEREST",
                "description": f"Scheduled Facility Interest ({loan_perf.tenor_months}m @ {loan_perf.interest_rate_apr:.1f}% APR)",
                "debit": total_sched_interest,
                "credit": 0.0,
                "principal_component": 0.0,
                "interest_component": total_sched_interest,
                "penalty_component": 0.0,
                "running_balance": round(running_balance + total_sched_interest, 2),
            }
        ]
        running_balance = round(running_balance + total_sched_interest, 2)

        # Replay repayments chronologically (oldest -> newest)
        chronological_payments = sorted(normalized_history, key=lambda x: str(x.get("payment_date", "")))
        for pmt in chronological_payments:
            pen = float(pmt.get("penalty_portion", 0.0) or 0.0)
            if pen > 0:
                running_balance = round(running_balance + pen, 2)
                statement_entries.append({
                    "entry_date": pmt.get("payment_date", ""),
                    "reference": f"PEN-{pmt.get('reference')}",
                    "entry_type": "PENALTY_CHARGE",
                    "description": f"5% Overdue Default Penalty ({pmt.get('days_overdue', 0)}d past due)",
                    "debit": pen,
                    "credit": 0.0,
                    "principal_component": 0.0,
                    "interest_component": 0.0,
                    "penalty_component": pen,
                    "running_balance": running_balance,
                })
            amt = float(pmt.get("amount", 0.0) or 0.0)
            running_balance = round(max(0.0, running_balance - amt), 2)
            statement_entries.append({
                "entry_date": pmt.get("payment_date", ""),
                "reference": pmt.get("reference") or pmt.get("payment_id"),
                "entry_type": "REPAYMENT",
                "description": f"Repayment via {pmt.get('payment_method', 'DIRECT_DEBIT')} — {pmt.get('note', '')}".strip(" —"),
                "debit": 0.0,
                "credit": amt,
                "principal_component": float(pmt.get("principal_portion", 0.0) or 0.0),
                "interest_component": float(pmt.get("interest_portion", 0.0) or 0.0),
                "penalty_component": pen,
                "running_balance": running_balance,
            })

        # Add currently uncollected accrued penalty line if active
        if float(loan_perf.penalty_accrued or 0.0) > 0:
            active_pen = float(loan_perf.penalty_accrued)
            running_balance = round(running_balance + active_pen, 2)
            statement_entries.append({
                "entry_date": utc_now().strftime("%Y-%m-%d %H:%M"),
                "reference": f"ACCR-PEN-{loan_perf.facility_number}",
                "entry_type": "PENALTY_ACCRUED",
                "description": f"Accrued Unpaid 5% Overdue Penalty ({loan_perf.days_overdue}d overdue > 7d grace)",
                "debit": active_pen,
                "credit": 0.0,
                "principal_component": 0.0,
                "interest_component": 0.0,
                "penalty_component": active_pen,
                "running_balance": running_balance,
            })

        # Pull post-disbursement audit & monitoring events
        audit_events = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.entity == "LOAN_PERFORMANCE",
                AuditEvent.entity_id == loan_perf.case_id,
            )
            .order_by(AuditEvent.timestamp.desc())
            .limit(40)
            .all()
        )
        monitoring_logs = [
            {
                "id": evt.correlation_id or evt.id,
                "event": evt.event,
                "note_type": (evt.details or {}).get("note_type", evt.event),
                "note": evt.reason or "",
                "actor": evt.actor,
                "role": evt.role,
                "promise_to_pay_date": (evt.details or {}).get("promise_to_pay_date"),
                "timestamp": evt.timestamp.strftime("%Y-%m-%d %H:%M") if evt.timestamp else "",
                "details": evt.details or {},
            }
            for evt in audit_events
        ]

        guarantor = {
            "name": raw.get("guarantor_name") or (cust.verified_attributes or {}).get("guarantor_name") or "Not Specified",
            "phone": raw.get("guarantor_phone") or (cust.verified_attributes or {}).get("guarantor_phone") or "N/A",
            "email": raw.get("guarantor_email") or (cust.verified_attributes or {}).get("guarantor_email") or "N/A",
            "relationship": raw.get("guarantor_relationship") or "Third-Party Guarantor",
        }
        collateral = {
            "type": raw.get("collateral_type") or "Commercial Security",
            "description": raw.get("collateral_description") or (app.purpose if app else "Commercial Facility Collateral"),
            "omv": float(raw.get("collateral_value") or 0.0),
        }

        next_due_str = loan_perf.next_due_date.strftime("%Y-%m-%d") if loan_perf.next_due_date else "Settled"
        days_to_next_due = None
        if loan_perf.next_due_date and loan_perf.performance_status != "CLOSED_FULLY_SETTLED":
            due_naive = loan_perf.next_due_date.replace(tzinfo=None)
            days_to_next_due = (due_naive - utc_now().replace(tzinfo=None)).days

        return {
            "id": loan_perf.id,
            "case_id": loan_perf.case_id,
            "case_number": case.case_number if case else loan_perf.facility_number,
            "facility_number": loan_perf.facility_number,
            "borrower_name": loan_perf.borrower_name,
            "borrower_email": cust.email if cust else None,
            "borrower_phone": cust.phone if cust else None,
            "facility_classification": raw.get("facility_classification") or "Working Capital",
            "applicant_type": app.applicant_type if app else (cust.customer_type if cust else "CORPORATE"),
            "disbursement_reference": disb.nav_reference if disb else None,
            "disbursed_principal": loan_perf.disbursed_principal,
            "interest_rate_apr": loan_perf.interest_rate_apr,
            "tenor_months": loan_perf.tenor_months,
            "monthly_installment": loan_perf.monthly_installment,
            "total_installments_count": loan_perf.total_installments_count,
            "installments_serviced": loan_perf.installments_serviced,
            "installments_remaining": loan_perf.installments_remaining,
            "principal_serviced": loan_perf.principal_serviced,
            "interest_serviced": loan_perf.interest_serviced,
            "total_scheduled_interest": total_sched_interest,
            "interest_earned_pct": interest_earned_pct,
            "total_amount_serviced": loan_perf.total_amount_serviced,
            "outstanding_principal": loan_perf.outstanding_principal,
            "outstanding_total": loan_perf.outstanding_total,
            "next_due_date": next_due_str,
            "days_to_next_due": days_to_next_due,
            "days_overdue": loan_perf.days_overdue,
            "grace_period_days": loan_perf.grace_period_days,
            "penalty_rate_pct": loan_perf.penalty_rate_pct,
            "penalty_accrued": loan_perf.penalty_accrued,
            "performance_status": loan_perf.performance_status,
            "disbursed_at": disb_dt_str,
            "last_payment_date": loan_perf.last_payment_date.strftime("%Y-%m-%d %H:%M") if loan_perf.last_payment_date else None,
            "guarantor": guarantor,
            "collateral": collateral,
            **metrics,
            "repayment_schedule": normalized_schedule,
            "repayment_history": normalized_history,
            "statement_entries": statement_entries,
            "statement_totals": {
                "total_debits": round(sum(e["debit"] for e in statement_entries), 2),
                "total_credits": round(sum(e["credit"] for e in statement_entries), 2),
                "closing_balance": round(statement_entries[-1]["running_balance"], 2) if statement_entries else 0.0,
            },
            "monitoring_logs": monitoring_logs,
        }

    @classmethod
    def generate_loan_statement_csv(cls, dossier: Dict[str, Any]) -> str:
        """
        Generates an official downloadable CSV Statement of Account for an individual facility.
        """
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["OPTICOM FINANCE LIMITED - INDIVIDUAL LOAN STATEMENT OF ACCOUNT"])
        writer.writerow(["Facility Number", dossier["facility_number"], "Case Number", dossier.get("case_number")])
        writer.writerow(["Borrower", dossier["borrower_name"], "Classification", dossier.get("facility_classification")])
        writer.writerow(["Disbursed Principal (NGN)", f"{dossier['disbursed_principal']:,.2f}", "Interest APR (%)", f"{dossier['interest_rate_apr']:.2f}%"])
        writer.writerow(["Tenor (Months)", dossier["tenor_months"], "Monthly Installment (NGN)", f"{dossier['monthly_installment']:,.2f}"])
        writer.writerow(["Serviced Total (NGN)", f"{dossier['total_amount_serviced']:,.2f}", "Outstanding Total (NGN)", f"{dossier['outstanding_total']:,.2f}"])
        writer.writerow(["Performance Score", f"{dossier['performance_score']}/100 ({dossier['health_grade']})", "Status", dossier["performance_status"]])
        writer.writerow([])
        writer.writerow(["Date", "Reference", "Entry Type", "Description", "Debit (NGN)", "Credit (NGN)", "Principal", "Interest", "Penalty", "Running Balance (NGN)"])
        for row in dossier.get("statement_entries", []):
            writer.writerow([
                row["entry_date"],
                row["reference"],
                row["entry_type"],
                row["description"],
                f"{row['debit']:.2f}",
                f"{row['credit']:.2f}",
                f"{row['principal_component']:.2f}",
                f"{row['interest_component']:.2f}",
                f"{row['penalty_component']:.2f}",
                f"{row['running_balance']:.2f}",
            ])
        totals = dossier.get("statement_totals", {})
        writer.writerow([])
        writer.writerow(["TOTALS", "", "", "", f"{totals.get('total_debits', 0):.2f}", f"{totals.get('total_credits', 0):.2f}", "", "", "", f"{totals.get('closing_balance', 0):.2f}"])
        return buf.getvalue()

    @classmethod
    def generate_loan_statement_html(cls, dossier: Dict[str, Any]) -> str:
        """
        Generates a branded printable HTML/PDF-ready Statement of Account for an individual facility.
        """
        esc = lambda v: html.escape(str(v if v is not None else ""))
        rows_html = ""
        for entry in dossier.get("statement_entries", []):
            debit_str = f"₦{entry['debit']:,.2f}" if entry["debit"] > 0 else "—"
            credit_str = f"₦{entry['credit']:,.2f}" if entry["credit"] > 0 else "—"
            rows_html += (
                "<tr>"
                f"<td>{esc(entry['entry_date'])}</td>"
                f"<td style='font-family:monospace;font-weight:600'>{esc(entry['reference'])}</td>"
                f"<td>{esc(entry['entry_type'])}</td>"
                f"<td>{esc(entry['description'])}</td>"
                f"<td style='text-align:right;color:#b45309'>{debit_str}</td>"
                f"<td style='text-align:right;color:#059669;font-weight:600'>{credit_str}</td>"
                f"<td style='text-align:right;font-weight:700'>₦{entry['running_balance']:,.2f}</td>"
                "</tr>"
            )
        totals = dossier.get("statement_totals", {})
        guarantor = dossier.get("guarantor", {})
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Loan Statement - {esc(dossier['facility_number'])}</title>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 28px; }}
    .hdr {{ display: flex; justify-content: space-between; border-bottom: 2px solid #0096cc; padding-bottom: 12px; margin-bottom: 18px; }}
    .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }}
    .card {{ background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; }}
    .lbl {{ font-size: 11px; color: #64748b; text-transform: uppercase; }}
    .val {{ font-size: 15px; font-weight: 700; margin-top: 3px; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }}
    th {{ background: #0f172a; color: #fff; padding: 8px; text-align: left; }}
    td {{ padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }}
    @media print {{ .no-print {{ display: none; }} }}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <div style="font-size:18px;font-weight:800;color:#0096cc;">OPTICOM FINANCE LIMITED</div>
      <div style="font-size:13px;font-weight:700;">INDIVIDUAL LOAN PERFORMANCE &amp; STATEMENT OF ACCOUNT</div>
      <div style="font-size:11px;color:#64748b;">10th Floor, UAC House, 1-5 Odunlami Street, Lagos Island</div>
    </div>
    <div style="text-align:right;font-size:12px;">
      <div><strong>Facility:</strong> {esc(dossier['facility_number'])}</div>
      <div><strong>Borrower:</strong> {esc(dossier['borrower_name'])}</div>
      <div><strong>Guarantor:</strong> {esc(guarantor.get('name'))} ({esc(guarantor.get('phone'))})</div>
      <div><strong>Score:</strong> {esc(dossier['performance_score'])}/100 (Grade {esc(dossier['health_grade'])})</div>
    </div>
  </div>
  <div class="grid">
    <div class="card"><div class="lbl">Disbursed Principal</div><div class="val">₦{dossier['disbursed_principal']:,.2f}</div></div>
    <div class="card"><div class="lbl">Total Serviced</div><div class="val" style="color:#059669">₦{dossier['total_amount_serviced']:,.2f}</div></div>
    <div class="card"><div class="lbl">Outstanding Balance</div><div class="val" style="color:#d97706">₦{dossier['outstanding_total']:,.2f}</div></div>
    <div class="card"><div class="lbl">Accrued 5% Penalty</div><div class="val" style="color:#dc2626">₦{dossier['penalty_accrued']:,.2f}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Reference</th><th>Type</th><th>Narration</th>
        <th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>{rows_html}</tbody>
    <tfoot>
      <tr style="background:#f1f5f9;font-weight:800;">
        <td colspan="4">STATEMENT CLOSING SUMMARY</td>
        <td style="text-align:right">₦{totals.get('total_debits', 0):,.2f}</td>
        <td style="text-align:right;color:#059669">₦{totals.get('total_credits', 0):,.2f}</td>
        <td style="text-align:right">₦{totals.get('closing_balance', 0):,.2f}</td>
      </tr>
    </tfoot>
  </table>
  <div class="no-print" style="margin-top:16px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#0096cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
  </div>
</body>
</html>"""
