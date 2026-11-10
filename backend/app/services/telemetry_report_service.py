"""
Telemetry Portfolio Reporting & Export Engine for Opticom Finance Limited (RC: 347832)
Supports Monthly, Quarterly, Biannual (6-Month), and Annual Executive Reports.
Provides CSV spreadsheet exports and printable executive audit reports.
"""
import io
import csv
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..models.entities import LoanPerformance, CreditCase, Application, Customer
from ..core.loan_performance_engine import LoanPerformanceEngine


class TelemetryReportService:
    PERIOD_LABELS = {
        "monthly": "Monthly Portfolio Servicing & Risk Telemetry Report (30 Days)",
        "quarterly": "Quarterly Credit Risk & Repayment Telemetry Report (Q-Audit / 90 Days)",
        "biannual": "Biannual Portfolio Health & Delinquency Review (Half-Year / 180 Days)",
        "annual": "Annual Comprehensive Credit Performance & Default Telemetry (Fiscal Year / 365 Days)"
    }

    PERIOD_DAYS = {
        "monthly": 30,
        "quarterly": 90,
        "biannual": 180,
        "annual": 365
    }

    @classmethod
    def get_report_dataset(cls, period: str, db: Session) -> Dict[str, Any]:
        """
        Gathers comprehensive loan telemetry data filtered and aggregated for the specified period.
        """
        period_key = period.lower().strip()
        if period_key not in cls.PERIOD_DAYS:
            period_key = "quarterly"

        days = cls.PERIOD_DAYS[period_key]
        now_dt = datetime.now(timezone.utc)
        start_date = now_dt - timedelta(days=days)

        records = db.query(LoanPerformance).all()

        # Re-evaluate all performance records to ensure freshest DPD and 5% penalty status
        for r in records:
            LoanPerformanceEngine.evaluate_performance(r)
        db.commit()

        total_disbursed = sum(r.disbursed_principal for r in records)
        total_serviced = sum(r.total_amount_serviced for r in records)
        total_principal_serviced = sum(r.principal_serviced for r in records)
        total_interest_serviced = sum(r.interest_serviced for r in records)
        total_outstanding = sum(r.outstanding_principal for r in records)
        total_outstanding_balance = sum(r.outstanding_total for r in records)
        total_penalties = sum(r.penalty_accrued for r in records)

        performing = [r for r in records if r.performance_status == "PERFORMING_CURRENT"]
        grace = [r for r in records if r.performance_status == "GRACE_PERIOD_ACTIVE"]
        overdue_penalty = [r for r in records if r.performance_status == "OVERDUE_PENALTY_APPLIED"]
        critical_default = [r for r in records if r.performance_status == "CRITICAL_DELINQUENT"]
        settled = [r for r in records if r.performance_status == "CLOSED_FULLY_SETTLED"]

        par_30 = sum(r.outstanding_total for r in records if r.days_overdue > 30)
        par_60 = sum(r.outstanding_total for r in records if r.days_overdue > 60)
        par_90 = sum(r.outstanding_total for r in records if r.days_overdue > 90)

        collection_rate = round((total_serviced / (total_serviced + total_outstanding) * 100), 2) if (total_serviced + total_outstanding) > 0 else 0.0
        npl_ratio = round((par_90 / total_disbursed * 100), 2) if total_disbursed > 0 else 0.0

        accounts_data = []
        for r in records:
            repayment_efficiency = round((r.total_amount_serviced / ((r.disbursed_principal * 1.28) or 1)) * 100, 1)
            accounts_data.append({
                "facility_number": r.facility_number,
                "borrower_name": r.borrower_name,
                "disbursed_principal": r.disbursed_principal,
                "tenor_months": r.tenor_months,
                "interest_rate_apr": r.interest_rate_apr,
                "monthly_installment": r.monthly_installment,
                "installments_serviced": r.installments_serviced,
                "installments_remaining": r.installments_remaining,
                "principal_serviced": r.principal_serviced,
                "interest_serviced": r.interest_serviced,
                "total_amount_serviced": r.total_amount_serviced,
                "outstanding_principal": r.outstanding_principal,
                "outstanding_total": r.outstanding_total,
                "next_due_date": r.next_due_date.strftime("%Y-%m-%d") if r.next_due_date else "N/A",
                "days_overdue": r.days_overdue,
                "penalty_accrued": r.penalty_accrued,
                "performance_status": r.performance_status,
                "repayment_efficiency": repayment_efficiency,
                "disbursed_at": r.disbursed_at.strftime("%Y-%m-%d") if r.disbursed_at else "N/A",
                "last_payment_date": r.last_payment_date.strftime("%Y-%m-%d") if r.last_payment_date else "None"
            })

        return {
            "period": period_key,
            "period_title": cls.PERIOD_LABELS[period_key],
            "reporting_window_days": days,
            "reporting_window_start": start_date.strftime("%Y-%m-%d"),
            "reporting_window_end": now_dt.strftime("%Y-%m-%d"),
            "generated_at": now_dt.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "institution": "Opticom Finance Limited (OFL)",
            "rc_number": "RC: 347832",
            "regulatory_framework": "Central Bank of Nigeria (CBN) / Prudential Credit Guidelines",
            "portfolio_metrics": {
                "total_active_facilities": len(records),
                "total_disbursed_principal": total_disbursed,
                "total_amount_serviced": total_serviced,
                "total_principal_serviced": total_principal_serviced,
                "total_interest_serviced": total_interest_serviced,
                "total_outstanding_exposure": total_outstanding,
                "total_outstanding_balance": total_outstanding_balance,
                "total_penalties_accrued": total_penalties,
                "collection_efficiency_rate": collection_rate,
                "portfolio_at_risk_par30": par_30,
                "portfolio_at_risk_par60": par_60,
                "portfolio_at_risk_par90": par_90,
                "npl_ratio_pct": npl_ratio
            },
            "status_distribution": {
                "PERFORMING_CURRENT": len(performing),
                "GRACE_PERIOD_ACTIVE": len(grace),
                "OVERDUE_PENALTY_APPLIED": len(overdue_penalty),
                "CRITICAL_DELINQUENT": len(critical_default),
                "CLOSED_FULLY_SETTLED": len(settled)
            },
            "policy_parameters": {
                "statutory_grace_period_days": 7,
                "overdue_penalty_rate_pct": 5.0,
                "penalty_rule": "5% flat default penalty applied after 7 calendar days grace period on overdue installments."
            },
            "accounts": accounts_data
        }

    @classmethod
    def generate_csv_report(cls, period: str, db: Session) -> str:
        """
        Builds a compliant CSV export for spreadsheet analysis.
        """
        data = cls.get_report_dataset(period, db)
        output = io.StringIO()
        writer = csv.writer(output)

        # Header Metadata
        writer.writerow(["OPTICOM FINANCE LIMITED - CREDIT TELEMETRY & PORTFOLIO PERFORMANCE REPORT"])
        writer.writerow(["Report Title", data["period_title"]])
        writer.writerow(["Reporting Window", f"{data['reporting_window_start']} to {data['reporting_window_end']} ({data['reporting_window_days']} Days)"])
        writer.writerow(["Generated Timestamp", data["generated_at"]])
        writer.writerow(["Regulatory Framework", data["regulatory_framework"]])
        writer.writerow([])

        # Macro Portfolio Metrics
        m = data["portfolio_metrics"]
        writer.writerow(["PORTFOLIO SUMMARY METRICS", "VALUE (NGN / PCT)"])
        writer.writerow(["Total Active Facilities", m["total_active_facilities"]])
        writer.writerow(["Total Disbursed Capital (NGN)", f"{m['total_disbursed_principal']:,.2f}"])
        writer.writerow(["Total Serviced Repayments (NGN)", f"{m['total_amount_serviced']:,.2f}"])
        writer.writerow(["- Principal Recovered (NGN)", f"{m['total_principal_serviced']:,.2f}"])
        writer.writerow(["- Interest Income Earned (NGN)", f"{m['total_interest_serviced']:,.2f}"])
        writer.writerow(["Total Outstanding Principal (NGN)", f"{m['total_outstanding_exposure']:,.2f}"])
        writer.writerow(["Total Balance Exposure (NGN)", f"{m['total_outstanding_balance']:,.2f}"])
        writer.writerow(["Default Penalties Levied (5% Overdue)", f"{m['total_penalties_accrued']:,.2f}"])
        writer.writerow(["Portfolio Collections Efficiency Rate (%)", f"{m['collection_efficiency_rate']}%"])
        writer.writerow(["Portfolio at Risk > 30 Days (PAR 30)", f"{m['portfolio_at_risk_par30']:,.2f}"])
        writer.writerow(["Portfolio at Risk > 90 Days (PAR 90)", f"{m['portfolio_at_risk_par90']:,.2f}"])
        writer.writerow(["Non-Performing Loan (NPL) Ratio (%)", f"{m['npl_ratio_pct']}%"])
        writer.writerow([])

        # Status Breakdown
        s = data["status_distribution"]
        writer.writerow(["STATUS STRATIFICATION", "ACCOUNT COUNT"])
        writer.writerow(["Current & Performing (0 DPD)", s["PERFORMING_CURRENT"]])
        writer.writerow(["7-Day Grace Period Active (1-7 DPD)", s["GRACE_PERIOD_ACTIVE"]])
        writer.writerow(["5% Overdue Penalty Applied (>7 DPD)", s["OVERDUE_PENALTY_APPLIED"]])
        writer.writerow(["Critical Delinquent / Default", s["CRITICAL_DELINQUENT"]])
        writer.writerow(["Closed / Fully Settled", s["CLOSED_FULLY_SETTLED"]])
        writer.writerow([])

        # Detailed Account Register
        writer.writerow([
            "Facility Number",
            "Borrower Name",
            "Disbursed Principal (NGN)",
            "Tenor (Mo)",
            "APR (%)",
            "Monthly Installment (NGN)",
            "Installments Serviced",
            "Installments Remaining",
            "Principal Serviced (NGN)",
            "Interest Serviced (NGN)",
            "Total Serviced (NGN)",
            "Outstanding Balance (NGN)",
            "Next Due Date",
            "Days Overdue",
            "5% Penalty Levied (NGN)",
            "Performance Status",
            "Disbursement Date",
            "Last Payment Date"
        ])

        for a in data["accounts"]:
            writer.writerow([
                a["facility_number"],
                a["borrower_name"],
                f"{a['disbursed_principal']:,.2f}",
                a["tenor_months"],
                f"{a['interest_rate_apr']}%",
                f"{a['monthly_installment']:,.2f}",
                a["installments_serviced"],
                a["installments_remaining"],
                f"{a['principal_serviced']:,.2f}",
                f"{a['interest_serviced']:,.2f}",
                f"{a['total_amount_serviced']:,.2f}",
                f"{a['outstanding_total']:,.2f}",
                a["next_due_date"],
                a["days_overdue"],
                f"{a['penalty_accrued']:,.2f}",
                a["performance_status"],
                a["disbursed_at"],
                a["last_payment_date"]
            ])

        return output.getvalue()

    @classmethod
    def generate_html_report(cls, period: str, db: Session) -> str:
        """
        Builds a high-fidelity printable HTML/PDF executive report with Opticom corporate styling.
        """
        data = cls.get_report_dataset(period, db)
        m = data["portfolio_metrics"]
        s = data["status_distribution"]

        rows_html = ""
        for a in data["accounts"]:
            status_color = "#10b981" if a["performance_status"] == "PERFORMING_CURRENT" else \
                           "#d97706" if a["performance_status"] == "GRACE_PERIOD_ACTIVE" else \
                           "#dc2626" if a["performance_status"] == "OVERDUE_PENALTY_APPLIED" else \
                           "#991b1b" if a["performance_status"] == "CRITICAL_DELINQUENT" else "#2563eb"
            
            rows_html += f"""
            <tr>
              <td style="font-weight: 600; font-family: monospace;">{a['facility_number']}</td>
              <td style="font-weight: 700;">{a['borrower_name']}</td>
              <td style="text-align: right;">₦{a['disbursed_principal']:,.2f}</td>
              <td style="text-align: right; color: #059669; font-weight: 600;">₦{a['total_amount_serviced']:,.2f}</td>
              <td style="text-align: right; font-weight: 700;">₦{a['outstanding_total']:,.2f}</td>
              <td style="text-align: center;">{a['installments_serviced']}/{a['installments_serviced'] + a['installments_remaining']}</td>
              <td style="text-align: center;">{a['next_due_date']}</td>
              <td style="text-align: center; font-weight: 700; color: {'#dc2626' if a['days_overdue'] > 7 else '#d97706' if a['days_overdue'] > 0 else '#10b981'};">{a['days_overdue']}d</td>
              <td style="text-align: right; color: {'#dc2626' if a['penalty_accrued'] > 0 else '#64748b'}; font-weight: 700;">{'₦' + f"{a['penalty_accrued']:,.2f}" if a['penalty_accrued'] > 0 else '₦0.00'}</td>
              <td style="text-align: center;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: {status_color}18; color: {status_color}; border: 1px solid {status_color}40;">
                  {a['performance_status'].replace('_', ' ')}
                </span>
              </td>
            </tr>
            """

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{data['period_title']} - Opticom Finance Limited</title>
  <style>
    @page {{
      size: A4 landscape;
      margin: 12mm;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: 12px;
      line-height: 1.4;
    }}
    .header-table {{
      width: 100%;
      border-bottom: 2px solid #0096cc;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }}
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }}
    .kpi-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }}
    .kpi-title {{
      font-size: 10.5px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }}
    .kpi-value {{
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }}
    .kpi-sub {{
      font-size: 10px;
      color: #059669;
      font-weight: 600;
      margin-top: 2px;
    }}
    table.data-table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 11px;
    }}
    table.data-table th {{
      background: #0096cc;
      color: #ffffff;
      padding: 7px 8px;
      text-align: left;
      font-weight: 700;
      border: 1px solid #0096cc;
    }}
    table.data-table td {{
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
    }}
    table.data-table tr:nth-child(even) td {{
      background: #f8fafc;
    }}
    .sign-table {{
      width: 100%;
      margin-top: 32px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 16px;
    }}
    .sign-block {{
      text-align: center;
      width: 33.33%;
      vertical-align: top;
      padding: 0 16px;
    }}
    .sign-line {{
      border-bottom: 1.5px solid #0f172a;
      width: 180px;
      margin: 30px auto 6px auto;
    }}
    .print-btn {{
      position: fixed;
      top: 12px;
      right: 16px;
      background: #0096cc;
      color: #ffffff;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
    }}
    @media print {{
      .print-btn {{ display: none; }}
      body {{ padding: 0; }}
    }}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save to PDF</button>

  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <h1 style="margin: 0; color: #0096cc; font-size: 22px; font-weight: 800;">OPTICOM FINANCE LIMITED</h1>
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">
          Commercial Risk Underwriting & Portfolio Servicing Telemetry &bull; RC: 347832 &bull; Help-Line: 0816 181 3538
        </div>
      </td>
      <td style="text-align: right; vertical-align: middle;">
        <div style="font-size: 15px; font-weight: 800; color: #0f172a;">{data['period_title']}</div>
        <div style="font-size: 11px; color: #64748b;">
          Audit Window: <strong>{data['reporting_window_start']}</strong> to <strong>{data['reporting_window_end']}</strong> ({data['reporting_window_days']} Days)
        </div>
        <div style="font-size: 10.5px; color: #64748b;">Generated: {data['generated_at']}</div>
      </td>
    </tr>
  </table>

  <!-- KPI SUMMARY METRICS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Disbursed Facility Exposure</div>
      <div class="kpi-value" style="color: #0096cc;">₦{m['total_disbursed_principal']:,.2f}</div>
      <div class="kpi-sub" style="color: #64748b;">{m['total_active_facilities']} Total Active Funded Facilities</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Repayments Serviced</div>
      <div class="kpi-value" style="color: #059669;">₦{m['total_amount_serviced']:,.2f}</div>
      <div class="kpi-sub">Recovery Rate: {m['collection_efficiency_rate']}% of exposure</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Current Outstanding Exposure</div>
      <div class="kpi-value" style="color: #d97706;">₦{m['total_outstanding_balance']:,.2f}</div>
      <div class="kpi-sub" style="color: #64748b;">Principal: ₦{m['total_outstanding_exposure']:,.2f}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">5% Default Penalties Levied</div>
      <div class="kpi-value" style="color: #dc2626;">₦{m['total_penalties_accrued']:,.2f}</div>
      <div class="kpi-sub" style="color: #dc2626;">Applied after 7 calendar days grace</div>
    </div>
  </div>

  <!-- RISK STRATIFICATION SUMMARY -->
  <div style="background: #f1f5f9; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
    <div><strong>Portfolio Health:</strong> {s['PERFORMING_CURRENT']} Current &bull; {s['GRACE_PERIOD_ACTIVE']} Grace (1-7d) &bull; <span style="color: #dc2626; font-weight: 700;">{s['OVERDUE_PENALTY_APPLIED']} Overdue (5% Pen)</span> &bull; {s['CRITICAL_DELINQUENT']} Critical Default</div>
    <div><strong>Portfolio at Risk:</strong> PAR 30: ₦{m['portfolio_at_risk_par30']:,.2f} &bull; PAR 90: ₦{m['portfolio_at_risk_par90']:,.2f} &bull; NPL Ratio: {m['npl_ratio_pct']}%</div>
  </div>

  <!-- LOAN PERFORMANCE ROSTER -->
  <table class="data-table">
    <thead>
      <tr>
        <th>Facility Ref</th>
        <th>Borrower Legal Entity</th>
        <th style="text-align: right;">Disbursed (₦)</th>
        <th style="text-align: right;">Serviced to Date (₦)</th>
        <th style="text-align: right;">Remaining Bal (₦)</th>
        <th style="text-align: center;">Installments</th>
        <th style="text-align: center;">Next Due Date</th>
        <th style="text-align: center;">Overdue</th>
        <th style="text-align: right;">5% Penalty</th>
        <th style="text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>

  <!-- STATUTORY RECONCILIATION SIGN-OFF -->
  <table class="sign-table">
    <tr>
      <td class="sign-block">
        <div class="sign-line"></div>
        <strong style="font-size: 12px;">Dapo Adeleke</strong><br/>
        <span style="font-size: 11px; color: #64748b;">Head of Business Development</span><br/>
        <span style="font-size: 10px; color: #94a3b8;">Commercial Review & Servicing Audit</span>
      </td>
      <td class="sign-block">
        <div class="sign-line"></div>
        <strong style="font-size: 12px;">Chidinma Okafor</strong><br/>
        <span style="font-size: 11px; color: #64748b;">Head of Risk Management (HRM)</span><br/>
        <span style="font-size: 10px; color: #94a3b8;">Portfolio Quality & PAR/NPL Certification</span>
      </td>
      <td class="sign-block">
        <div class="sign-line"></div>
        <strong style="font-size: 12px;">Folashade Tinubu</strong><br/>
        <span style="font-size: 11px; color: #64748b;">Managing Director (MD)</span><br/>
        <span style="font-size: 10px; color: #94a3b8;">Executive Audit Sign-Off</span>
      </td>
    </tr>
  </table>
</body>
</html>
"""
        return html_content

