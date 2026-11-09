"""
Opticom Finance Limited - Executive Management Walkthrough Guide PDF Generator
Creates an institutional-grade, 6-page executive PDF document with exact branding,
color palettes, workflows, loan performance telemetry, demo cases reference table,
and presenter talking points.
"""
import os
import base64
import subprocess
import shutil

def build_pdf():
    # 1. Read and base64-encode Opticom corporate logo
    logo_path = os.path.abspath(r"frontend\public\opticom_logo.jpg")
    with open(logo_path, "rb") as f:
        logo_base64 = base64.b64encode(f.read()).decode("utf-8")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Opticom Finance Limited - Executive Management Demonstration & Walkthrough Guide</title>
<style>
  @page {{
    size: A4;
    margin: 9mm 11mm 9mm 11mm;
    @bottom-right {{
      content: "Page " counter(page) " of " counter(pages);
      font-size: 7.5pt;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #64748b;
    }}
    @bottom-left {{
      content: "Opticom Finance Limited • Confidential • RC: 347832 • Help-Line: 0816 181 3538";
      font-size: 7.5pt;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #94a3b8;
    }}
  }}
  
  * {{
    box-sizing: border-box;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    line-height: 1.32;
    font-size: 8.3pt;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }}

  .page {{
    page-break-after: always;
    height: 279mm;
    max-height: 279mm;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}
  
  .page:last-child {{
    page-break-after: avoid;
  }}

  .page-content {{
    flex: 1;
  }}

  /* Brand Colors */
  :root {{
    --primary: #0096cc;
    --primary-dark: #006b99;
    --navy: #041326;
    --slate: #475569;
    --border: #cbd5e1;
    --bg-light: #f8fafc;
    --success: #059669;
    --warning: #d97706;
    --danger: #dc2626;
  }}

  /* Header Band */
  .doc-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #0096cc;
    padding-bottom: 7px;
    margin-bottom: 10px;
  }}

  .logo-box {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .logo-img {{
    height: 36px;
    border-radius: 4px;
  }}

  .company-title {{
    font-size: 13pt;
    font-weight: 800;
    color: #041326;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.1;
  }}

  .company-sub {{
    font-size: 7pt;
    font-weight: 700;
    color: #0096cc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }}

  .header-meta {{
    text-align: right;
    font-size: 7.3pt;
    color: #64748b;
    line-height: 1.28;
  }}

  .badge-confidential {{
    display: inline-block;
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 6.8pt;
    font-weight: 800;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }}

  /* Hero Title */
  .hero-box {{
    background: linear-gradient(135deg, #041326 0%, #0a2540 100%);
    color: #ffffff;
    padding: 10px 13px;
    border-radius: 6px;
    margin-bottom: 10px;
    border-left: 4px solid #0096cc;
  }}

  .hero-title {{
    font-size: 13pt;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
    color: #ffffff;
  }}

  .hero-desc {{
    font-size: 7.7pt;
    color: #94a3b8;
    margin-top: 3px;
    margin-bottom: 0;
  }}

  h2 {{
    font-size: 9.5pt;
    font-weight: 800;
    color: #041326;
    margin: 9px 0 5px 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }}

  h3 {{
    font-size: 8.5pt;
    font-weight: 700;
    color: #0096cc;
    margin: 7px 0 4px 0;
  }}

  p {{
    margin: 0 0 5px 0;
    color: #334155;
    font-size: 8pt;
    line-height: 1.32;
  }}

  /* Callout Card */
  .card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 8px 11px;
    margin-bottom: 8px;
  }}

  .card-highlight {{
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-left: 3px solid #0096cc;
  }}

  .card-success {{
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-left: 3px solid #059669;
  }}

  .card-warning {{
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-left: 3px solid #d97706;
  }}

  .card-danger {{
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-left: 3px solid #dc2626;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 7.4pt;
    margin-bottom: 7px;
  }}

  th {{
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 4.5px 6.5px;
    border: 1px solid #cbd5e1;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }}

  td {{
    padding: 4px 6.5px;
    border: 1px solid #cbd5e1;
    color: #334155;
    vertical-align: middle;
  }}

  tr:nth-child(even) td {{
    background: #f8fafc;
  }}

  /* Pills */
  .pill {{
    display: inline-block;
    padding: 1.5px 5.5px;
    border-radius: 4px;
    font-size: 6.6pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }}

  .pill-blue {{ background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }}
  .pill-green {{ background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }}
  .pill-purple {{ background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }}
  .pill-amber {{ background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }}
  .pill-red {{ background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }}
  .pill-cyan {{ background: #cffafe; color: #0e7490; border: 1px solid #a5f3fc; }}

  /* Grid Layouts */
  .grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 7px;
  }}

  .grid-3 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 7px;
    margin-bottom: 7px;
  }}

  .grid-4 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px;
    margin-bottom: 7px;
  }}

  .stat-card {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 6px 8px;
    text-align: center;
  }}

  .stat-val {{
    font-size: 13pt;
    font-weight: 800;
    color: #0096cc;
    line-height: 1.1;
  }}

  .stat-lbl {{
    font-size: 6.6pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 2px;
  }}

  /* Step box */
  .step-box {{
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 6px 9px;
    align-items: flex-start;
  }}

  .step-num {{
    background: #0096cc;
    color: #ffffff;
    font-size: 7.8pt;
    font-weight: 800;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}

  .step-content {{
    flex: 1;
  }}

  .step-title {{
    font-size: 8.3pt;
    font-weight: 700;
    color: #041326;
    margin-bottom: 2px;
  }}

  .step-text {{
    font-size: 7.5pt;
    color: #475569;
    margin: 0;
    line-height: 1.28;
  }}

  .talking-point {{
    background: #f1f5f9;
    border-left: 2px solid #0096cc;
    padding: 3px 6px;
    margin-top: 3px;
    font-size: 7.1pt;
    color: #0f172a;
    border-radius: 2px;
  }}

  /* Sign block */
  .sign-grid {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 8px;
  }}

  .sign-box {{
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 7px 9px;
    background: #f8fafc;
  }}

  .sign-line {{
    border-bottom: 1px dashed #94a3b8;
    height: 22px;
    margin-bottom: 4px;
  }}

  .sign-name {{
    font-size: 7.6pt;
    font-weight: 700;
    color: #0f172a;
  }}

  .sign-title {{
    font-size: 6.8pt;
    color: #64748b;
  }}

  .footer-note {{
    font-size: 6.8pt;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 5px;
    margin-top: 5px;
  }}
</style>
</head>
<body>

  <!-- ===================================================================== -->
  <!-- PAGE 1: EXECUTIVE OVERVIEW & PLATFORM STRATEGIC ARCHITECTURE          -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Commercial Credit &amp; Structured Underwriting Engine &bull; RC: 347832</div>
          </div>
        </div>
        <div class="header-meta">
          <span class="badge-confidential">EXECUTIVE MANAGEMENT DEMO</span><br />
          <strong>Date:</strong> November 9, 2026<br />
          <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <!-- Hero Box -->
      <div class="hero-box">
        <div class="hero-title">Commercial Credit Automation &amp; Servicing Platform — Executive Guide</div>
        <div class="hero-desc">
          Official comprehensive demonstration roadmap for the Managing Director, Head of Risk Management (HRM), Head of Business Development, Management Credit Committee (MCC), Board Credit Committee (BCC), and Treasury.
        </div>
      </div>

      <!-- Key Performance Metrics Grid -->
      <div class="grid-4">
        <div class="stat-card">
          <div class="stat-val">28.00%</div>
          <div class="stat-lbl">Effective APR (23% MPR + 5%)</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">&le; ₦20.0M</div>
          <div class="stat-lbl">MD Final Approval Mandate</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">7 Days</div>
          <div class="stat-lbl">Statutory Grace Window</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">5.0%</div>
          <div class="stat-lbl">Automated Default Penalty</div>
        </div>
      </div>

      <h2>1. Executive Summary &amp; Management Context</h2>
      <p>
        Opticom Finance Limited (RC: 347832) has operationalized an end-to-end autonomous underwriting, credit approval, and post-disbursement telemetry servicing platform. This platform automates the entire lifecycle of commercial credit from multi-channel intake through sequential governance to real-time repayment surveillance and penalty enforcement.
      </p>

      <div class="card card-highlight">
        <div style="font-weight: 700; color: #006b99; margin-bottom: 3px; font-size: 8.2pt;">
          Key Platform Innovations:
        </div>
        <ul style="margin: 0; padding-left: 16px; font-size: 7.7pt; color: #334155; line-height: 1.32;">
          <li><strong>Zero Hallucination Deterministic Engine:</strong> Financial ratios (DSCR, DTI, PMT, Amortization, Bespoke Fees, Net Disbursement) are strictly computed in Python outside LLMs.</li>
          <li><strong>New Sequential Multi-Tier Approval Chain:</strong> Intake (Public or BDO Assisted) &rarr; Credit Analyst &rarr; MCC First Reviewer (Head of Business Development) &rarr; Head of Risk Management (HRM) &rarr; Managing Director (MD) with automated offer dispatch.</li>
          <li><strong>Closed-Loop Exception &amp; Rework Routing:</strong> Analyst returns incomplete files to BDO Rework; HRM queries return to Analyst with instant prompt alerts to Head of BD; MD returns to HRM or BD with multi-stakeholder alerts across all three offices.</li>
          <li><strong>Post-Disbursement Telemetry Platform:</strong> Continuous portfolio performance surveillance tracking amortized collections, overdue installments, statutory 7-day grace period, and deterministic 5% default penalty enforcement.</li>
          <li><strong>Core LMS &amp; LOAN-DISC Synchronization:</strong> Direct 1-click booking into Opticom's core LMS (LOAN-DISC / Xloandisk) with NAV accounting vouchers (<code>NAV-DISB-XXXX</code>).</li>
        </ul>
      </div>

      <h2>2. Multi-Channel Origination Gateways</h2>
      <div class="grid-2">
        <div class="card">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px; font-size: 8.1pt;">
            Gate 1: Client-Facing Direct Portal (&gt; ₦2,000,000)
          </div>
          <p style="font-size: 7.5pt; margin-bottom: 3px;">
            Self-service digital front-door for SME and corporate clients. Allows multi-document upload (bank statements, CAC proofs, contract PO awards, collateral briefs) and real-time loan repayment sizing.
          </p>
          <span class="pill pill-cyan">CLIENT PORTAL</span> <span class="pill pill-green">DIRECT INTAKE</span>
        </div>

        <div class="card">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px; font-size: 8.1pt;">
            Gate 2: BDO Assisted Origination &amp; In-Field Intake
          </div>
          <p style="font-size: 7.5pt; margin-bottom: 3px;">
            Empowers Business Development Officers (BDOs) to originate loans on behalf of corporate prospects visited in the field, capture bespoke financial variables, and monitor file progress.
          </p>
          <span class="pill pill-blue">BDO ASSISTED</span> <span class="pill pill-purple">FIELD SOURCING</span>
        </div>
      </div>

      <div class="card card-success" style="margin-top: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>Corporate Identity &amp; Help-Line:</strong> Opticom Finance Limited &bull; RC: 347832<br />
            <span style="font-size: 7.3pt; color: #047857;">
              10th Floor, UAC House, 1-5 Odunlami St, Lagos Island, Lagos &bull; Help-Line: <strong>0816 181 3538</strong> &bull; Email: <strong>info@opticomfinance.com</strong>
            </span>
          </div>
          <span class="pill pill-green">LIVE SYSTEM ONLINE</span>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 2: NEW LOAN APPLICATION & SEQUENTIAL APPROVAL WORKFLOW          -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">End-to-End Governance Approval &amp; Exception Routing Flow</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Standard Ref:</strong> OFL-SOP-CR-02<br />
          <strong>RC:</strong> 347832 &bull; <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>3. The Opticom Sequential Approval Chain &amp; Exception Architecture</h2>
      <p>
        The platform enforces Opticom's approved multi-tier governance matrix. Every credit case follows this strict sequential chain with role-segregated queues and bi-directional exception rework routing:
      </p>

      <div class="step-box">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">Intake: Client Direct Portal OR BDO Assisted Intake</div>
          <div class="step-text">Prospective obligor applies via public portal or BDO submits request from field visit with bank statements, CAC certificate, board resolution, and collateral profile. Facility enters <code>Submitted / Analyst Review</code>.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">Credit Analyst Underwriting &amp; Exception Check</div>
          <div class="step-text">
            Analyst reviews financial statements, spreads turnover, and verifies documentation completeness.<br />
            &bull; <strong>Exception / Incomplete Details:</strong> Analyst returns application to <code>BDO Rework</code>. BDO receives notification and opens case in assisted portal to supply missing items.<br />
            &bull; <strong>Satisfied:</strong> Analyst leaves underwriting comments and forwards application to the <strong>Management Credit Committee (MCC)</strong>.
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">MCC First Reviewer: Head of Business Development</div>
          <div class="step-text">
            The Head of Business Development is the first reviewer in MCC to receive the file from the Analyst.<br />
            &bull; <strong>Deficiency / Query:</strong> Head of BD circles back to Credit Analyst with queries regarding missing applicant details.<br />
            &bull; <strong>Satisfied:</strong> Head of BD records commercial comments and approves facility onward to the <strong>Head of Risk Management (HRM)</strong>.
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">4</div>
        <div class="step-content">
          <div class="step-title">Head of Risk Management (HRM) — Risk Sanction &amp; Alerting</div>
          <div class="step-text">
            HRM conducts comprehensive risk evaluation and covenants check (Vertex AI 12-page CAM synthesis).<br />
            &bull; <strong>Risk Exception / Query:</strong> File routes back to <strong>Credit Analyst</strong>. Simultaneously, the <strong>Head of Business Development automatically receives an alert prompt</strong> notifying them of the exception.<br />
            &bull; <strong>Satisfied:</strong> HRM logs risk sign-off and approves facility to the <strong>Managing Director (MD)</strong>.
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">5</div>
        <div class="step-content">
          <div class="step-title">Managing Director (MD) — Executive Sanction &amp; Auto Offer Dispatch</div>
          <div class="step-text">
            MD holds highest executive authority (&le; ₦20,000,000).<br />
            &bull; <strong>Reservation / Query:</strong> MD returns file to either <strong>HRM</strong> (default) or <strong>Head of BD</strong>. Instant alert prompts are dispatched to <strong>Credit Analyst, HRM, and Head of BD</strong>.<br />
            &bull; <strong>Executive Approval:</strong> MD grants final approval &rarr; <strong>Formal facility Offer Letter is automatically generated</strong> and instantly emailed to applicant with copy to Finance.
          </div>
        </div>
      </div>

      <h2>4. Opticom Delegated Authority Matrix (Deterministic Limits)</h2>
      <table>
        <thead>
          <tr>
            <th>Persona Role</th>
            <th>Designated Authority</th>
            <th>Approval Limit (₦)</th>
            <th>Exception Routing &amp; Governance Rules</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Business Dev Officer (BDO)</strong></td>
            <td>Assisted Intake &amp; Rework</td>
            <td>Origination Only</td>
            <td>Gathers documents, resolves analyst rework queries, resubmits to Analyst.</td>
          </tr>
          <tr>
            <td><strong>Credit Analyst</strong></td>
            <td>Underwriting &amp; Spreading</td>
            <td>Recommend Only</td>
            <td>Spreads cashflow, flags missing documents back to BDO, forwards to MCC.</td>
          </tr>
          <tr>
            <td><strong>Head of Business Dev</strong></td>
            <td>1st Reviewer in MCC</td>
            <td>Commercial Endorsement</td>
            <td>Evaluates relationship &amp; pricing; circles back to Analyst or approves to HRM.</td>
          </tr>
          <tr>
            <td><strong>Head of Risk (HRM)</strong></td>
            <td>Risk Review &amp; Synthesis</td>
            <td>Up to ₦5,000,000 (Initial Sign-off)</td>
            <td>Synthesizes CAM; returns to Analyst (alerts Head of BD); routes to MD.</td>
          </tr>
          <tr>
            <td><strong>Managing Director (MD)</strong></td>
            <td>Highest Executive Authority</td>
            <td><strong>Up to ₦20,000,000 (Final Sanction)</strong></td>
            <td>Sanctions facility &le; ₦20M (triggers auto offer letter); returns alert all 3 stakeholders.</td>
          </tr>
          <tr>
            <td><strong>Board Credit Committee (BCC)</strong></td>
            <td>Board Sanction Mandate</td>
            <td><strong>Over ₦20,000,000 (Board Sanction)</strong></td>
            <td>Grants board credit sanction for high-value exposures exceeding ₦20,000,000.</td>
          </tr>
          <tr>
            <td><strong>Treasury Operations</strong></td>
            <td>Disbursement &amp; Booking</td>
            <td>Execution &amp; Settlement</td>
            <td>Verifies conditions precedent, books into LOAN-DISC, issues NAV voucher.</td>
          </tr>
        </tbody>
      </table>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 3: POST-DISBURSEMENT TELEMETRY & 5% DEFAULT PENALTY PLATFORM    -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Post-Disbursement Telemetry, Servicing &amp; Default Recovery</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Module:</strong> Live Telemetry Engine<br />
          <strong>RC:</strong> 347832 &bull; <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>5. Continuous Loan Servicing &amp; Default Recovery Platform</h2>
      <p>
        Following capital disbursement, the loan transitions automatically into Opticom's active telemetry platform. The engine performs continuous daily surveillance on repayment behavior, amortized collection status, and overdue obligations:
      </p>

      <div class="grid-3">
        <div class="card card-highlight">
          <div style="font-weight: 700; color: #006b99; font-size: 8pt; margin-bottom: 2px;">
            Real-Time Servicing Surveillance
          </div>
          <p style="font-size: 7.4pt; margin: 0;">
            Monitors monthly installment due dates, payments received, serviced principal vs interest, and remaining credit exposure across all active facilities.
          </p>
        </div>

        <div class="card card-warning">
          <div style="font-weight: 700; color: #b45309; font-size: 8pt; margin-bottom: 2px;">
            Statutory 7-Day Grace Window
          </div>
          <p style="font-size: 7.4pt; margin: 0;">
            If an installment is missed on its due date, the borrower is granted a 7-calendar-day grace period during which status shows <code>Grace Period Active</code> and <strong>zero penalty</strong> is charged.
          </p>
        </div>

        <div class="card card-danger">
          <div style="font-weight: 700; color: #991b1b; font-size: 8pt; margin-bottom: 2px;">
            Deterministic 5% Default Penalty
          </div>
          <p style="font-size: 7.4pt; margin: 0;">
            On Day 8 past due date (grace expired), a deterministic <strong>5% penalty</strong> is automatically levied on the unserviced monthly installment until paid.
          </p>
        </div>
      </div>

      <h2>6. Mathematical Formulation of the 5% Default Penalty Policy</h2>
      <div class="card card-highlight">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 7pt; font-weight: 700; color: #006b99; text-transform: uppercase;">Deterministic Default Penalty Policy Formula</span>
            <div style="font-size: 10pt; font-weight: 800; color: #041326; margin-top: 2px;">
              Penalty Accrued = Monthly Installment &times; 5.0% &nbsp;&nbsp;(Applied Deterministically on Day 8+)
            </div>
            <div style="font-size: 7.4pt; color: #475569; margin-top: 2px;">
              <strong>Grace Condition:</strong> If Overdue Days &le; 7 &rarr; Penalty = ₦0.00 &bull; If Overdue Days &gt; 7 &rarr; Penalty = 5% of monthly repayment.
            </div>
          </div>
          <span class="pill pill-red">STRICT ENFORCEMENT</span>
        </div>
      </div>

      <h2>7. Post-Disbursement Servicing Status Lifecycle</h2>
      <table>
        <thead>
          <tr>
            <th>Telemetry Status</th>
            <th>Overdue Days</th>
            <th>Penalty Rate</th>
            <th>Borrower Condition &amp; Engine Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="pill pill-green">PERFORMING_CURRENT</span></td>
            <td>0 Days</td>
            <td>0.0% (₦0.00)</td>
            <td>All installments serviced on or before due date. Healthy amortized debt reduction.</td>
          </tr>
          <tr>
            <td><span class="pill pill-amber">GRACE_PERIOD_ACTIVE</span></td>
            <td>1 – 7 Days</td>
            <td>0.0% (₦0.00)</td>
            <td>Due date missed; statutory 7-day grace period active. Automated SMS/Email courtesy alert.</td>
          </tr>
          <tr>
            <td><span class="pill pill-red">OVERDUE_PENALTY_APPLIED</span></td>
            <td>8 – 30 Days</td>
            <td><strong>5.0% Accrued</strong></td>
            <td>Grace window expired. 5% penalty levied on overdue installment; formal demand letter queued.</td>
          </tr>
          <tr>
            <td><span class="pill pill-red">CRITICAL_DELINQUENT</span></td>
            <td>&gt; 30 Days</td>
            <td>5.0% + Recovery</td>
            <td>Severe default; automated referral to Special Asset Management and collateral realization.</td>
          </tr>
          <tr>
            <td><span class="pill pill-blue">CLOSED_FULLY_SETTLED</span></td>
            <td>All Serviced</td>
            <td>Nil</td>
            <td>100% principal and interest fully repaid; collateral discharge certificate issued.</td>
          </tr>
        </tbody>
      </table>

      <h2>8. Portfolio Telemetry Simulation &amp; Live Repayment Ledger</h2>
      <div class="grid-2">
        <div class="card">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px; font-size: 8pt;">
            1-Click Scenario Simulation Controls
          </div>
          <p style="font-size: 7.4pt; margin-bottom: 3px;">
            The platform provides executive testing buttons on each account: <code>Current</code>, <code>Grace Period (4d)</code>, <code>5% Overdue Penalty (10d)</code>, and <code>Critical</code> to dynamically verify policy compliance in real time.
          </p>
          <span class="pill pill-blue">LIVE SCENARIO TESTER</span>
        </div>

        <div class="card">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px; font-size: 8pt;">
            Automated Amortization &amp; Repayment Ledger
          </div>
          <p style="font-size: 7.4pt; margin-bottom: 3px;">
            Records repayments via Direct Debit, Bank Transfer, or Cheque with instant mathematical splitting into principal reduction and interest income with ledger audit trail.
          </p>
          <span class="pill pill-green">INSTANT SPLIT ACCOUNTING</span>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 4: COMMERCIAL PRICING & MASTER FEE SCHEDULE CATALOG             -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Commercial Pricing Policy &amp; Master Fee Catalog</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Policy Ref:</strong> CBN-MPR-2026-Q4<br />
          <strong>RC:</strong> 347832 &bull; <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>9. CBN Benchmark Rate &amp; Commercial Pricing Centralization</h2>
      <p>
        In accordance with executive directive, all pricing formulas are centralized under <strong>Tab 6: Fee Schedule, Pricing (MPR/APR) &amp; Bespoke</strong> under System Configuration. This guarantees transparent, regulatory-compliant pricing:
      </p>

      <div class="card card-highlight">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 7pt; font-weight: 700; color: #006b99; text-transform: uppercase;">Active Commercial Pricing Formula</span>
            <div style="font-size: 10.5pt; font-weight: 800; color: #041326; margin-top: 2px;">
              CBN MPR (23.00%) + Commercial Risk Spread (5.00%) = 28.00% APR
            </div>
            <div style="font-size: 7.4pt; color: #475569; margin-top: 2px;">
              Monthly Equivalent Rate: <strong>2.33% / month</strong> on reducing-balance amortization schedule.
            </div>
          </div>
          <div style="text-align: right;">
            <span class="pill pill-green">CBN COMPLIANT</span><br />
            <span style="font-size: 6.8pt; color: #64748b;">Sync in Admin Hub</span>
          </div>
        </div>
      </div>

      <h2>10. Opticom Master Fee Catalog &amp; Bespoke Inclusions</h2>
      <p>
        Opticom maintains 7 standardized facility charges while allowing custom bespoke fees for specialized legal searches, perfection, or collateral management:
      </p>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Fee Designation</th>
            <th>Calculation Basis</th>
            <th>Standard Rate / Quantum</th>
            <th>Statutory / Legal Basis &amp; Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><strong>Mgt / Legal fees</strong></td>
            <td>% of Principal</td>
            <td><strong>2.00%</strong></td>
            <td>Facility management, legal documentation, and searches</td>
          </tr>
          <tr>
            <td>2</td>
            <td><strong>Processing fee</strong></td>
            <td>% of Principal</td>
            <td><strong>2.00%</strong></td>
            <td>Credit appraisal, financial spreading, and risk structuring</td>
          </tr>
          <tr>
            <td>3</td>
            <td><strong>Tracking fee</strong></td>
            <td>Flat Quantum</td>
            <td><strong>₦150,000.00</strong></td>
            <td>Asset &amp; vehicle GPS telematics hardware and live monitoring</td>
          </tr>
          <tr>
            <td>4</td>
            <td><strong>Stamp Duty</strong></td>
            <td>% of Principal</td>
            <td><strong>0.125%</strong></td>
            <td>Statutory FIRS stamp duty on loan agreement &amp; mortgage deed</td>
          </tr>
          <tr>
            <td>5</td>
            <td><strong>VAT on Fees</strong></td>
            <td>% of Service Fees</td>
            <td><strong>7.50%</strong></td>
            <td>FIRS VAT computed strictly on Mgt + Processing fees (not principal)</td>
          </tr>
          <tr>
            <td>6</td>
            <td><strong>Credit Life Insurance</strong></td>
            <td>% of Principal</td>
            <td><strong>1.00%</strong></td>
            <td>Obligor life assurance policy covering facility tenure</td>
          </tr>
          <tr>
            <td>7</td>
            <td><strong>Comprehensive Insurance</strong></td>
            <td>% of Asset Value</td>
            <td><strong>3.50%</strong></td>
            <td>Comprehensive asset cover; Opticom noted as First Loss Payee</td>
          </tr>
          <tr>
            <td>8+</td>
            <td><strong>Bespoke / Advisory Fees</strong></td>
            <td>Flat or %</td>
            <td><em>Customizable</em></td>
            <td>Allows adding transaction advisory, perfection, or inspection charges</td>
          </tr>
        </tbody>
      </table>

      <h2>11. Worked Facility Deduction Simulator (Sample ₦10,000,000 Facility)</h2>
      <div class="grid-4">
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 6.8pt; color: #64748b; font-weight: 700;">SAMPLE PRINCIPAL</div>
          <div style="font-size: 10.5pt; font-weight: 800; color: #041326;">₦10,000,000.00</div>
          <div style="font-size: 6.6pt; color: #64748b;">12-Month Tenor @ 28% APR</div>
        </div>
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 6.8pt; color: #64748b; font-weight: 700;">MGT + PROCESSING (4%)</div>
          <div style="font-size: 10.5pt; font-weight: 800; color: #0096cc;">₦400,000.00</div>
          <div style="font-size: 6.6pt; color: #64748b;">Mgt ₦200k + Proc ₦200k</div>
        </div>
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 6.8pt; color: #64748b; font-weight: 700;">VAT ON FEES (7.5%)</div>
          <div style="font-size: 10.5pt; font-weight: 800; color: #0096cc;">₦30,000.00</div>
          <div style="font-size: 6.6pt; color: #64748b;">7.5% of ₦400,000 fees</div>
        </div>
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 6.8pt; color: #64748b; font-weight: 700;">STAMP DUTY (0.125%)</div>
          <div style="font-size: 10.5pt; font-weight: 800; color: #0096cc;">₦12,500.00</div>
          <div style="font-size: 6.6pt; color: #64748b;">Statutory FIRS rate</div>
        </div>
      </div>

      <div class="card card-success" style="margin-top: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 7pt; font-weight: 700; color: #065f46; text-transform: uppercase;">Net Upfront Disbursed Capital to Borrower</div>
            <div style="font-size: 11pt; font-weight: 800; color: #047857;">
              ₦9,557,500.00 <span style="font-size: 7.6pt; font-weight: 600; color: #065f46;">(Total Upfront Statutory Deductions: ₦442,500.00 &bull; 4.425%)</span>
            </div>
          </div>
          <span class="pill pill-green">AUTOMATED BREAKDOWN</span>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 5: 7-ACT EXECUTIVE LIVE DEMONSTRATION SCRIPT                    -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Executive Live Demonstration Script (7-Act Roadmap)</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Demo Duration:</strong> 20 Mins<br />
          <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>12. Step-by-Step Live Demonstration Script</h2>
      <p>
        Guide the Opticom Executive Committee through the live platform following these 7 structured acts:
      </p>

      <div class="step-box">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">ACT 1: Intake Options — Public Portal &amp; BDO Assisted Origination</div>
          <div class="step-text">Show borrower self-service calculator at <code>http://localhost:5173/</code> with 28% APR. Then switch to <code>Business Dev Officer (BDO)</code> in internal cockpit to show in-field assisted loan capture.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">ACT 2: Analyst Underwriting &amp; BDO Rework Exception Routing</div>
          <div class="step-text">Switch to <code>Credit Analyst</code>. Open <code>OFL-2026-00008 (Crestview Eng, ₦7.2M)</code> in BDO Rework. Show how missing documents return the file back to BDO Segun Adeleke, and how satisfied files forward to MCC.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">ACT 3: MCC First Reviewer — Head of Business Development</div>
          <div class="step-text">Switch to <code>Head of Business Development</code>. Open <code>OFL-2026-00005 (Apex Marine, ₦12M)</code>. Show commercial rationale, pricing evaluation, and approval onward to Head of Risk Management (HRM).</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">4</div>
        <div class="step-content">
          <div class="step-title">ACT 4: Head of Risk (HRM) Review &amp; Exception Prompt to Head of BD</div>
          <div class="step-text">Switch to <code>Head of Risk Management (HRM)</code>. Open <code>OFL-2026-00006 (Sunrise Foods, ₦6M)</code>. Synthesize Vertex AI 12-page CAM. Demonstrate that if HRM raises a risk query, file returns to Analyst and Head of BD receives an instant prompt alert.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">5</div>
        <div class="step-content">
          <div class="step-title">ACT 5: MD Sanction, Stakeholder Alerting &amp; Auto Offer Letter</div>
          <div class="step-text">Switch to <code>Managing Director (MD)</code>. Open <code>OFL-2026-00004 (Medilink Diagnostics, ₦15M)</code>. Show MD return selector (HRM vs Head of BD) that alerts Analyst, HRM, and BD. Click <em>"Approve Facility"</em>: Offer Letter is auto-generated and emailed!</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">6</div>
        <div class="step-content">
          <div class="step-title">ACT 6: Treasury 1-Click LOAN-DISC / Xloandisk Booking</div>
          <div class="step-text">Switch to <code>Treasury &amp; Loan Operations</code>. Open <code>OFL-2026-00002 (Greenline Agro, ₦8.5M)</code> in Ready for Disbursement queue. Show verified conditions precedent. Click <em>"Execute 1-Click LOAN-DISC Booking"</em>: issues <code>NAV-DISB-XXXX</code> voucher.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">7</div>
        <div class="step-content">
          <div class="step-title">ACT 7: Loan Performance Telemetry &amp; 5% Default Penalty Enforcement</div>
          <div class="step-text">Navigate to <code>Loan Performance Telemetry</code> tab. Review portfolio KPIs: ₦74.5M disbursed, ₦8.5M serviced. Open <code>OFL-2026-00010 (Bluefin Marine, ₦16M)</code>: 4 days overdue, 7-day grace active, <strong>₦0.00 penalty</strong>. Open <code>OFL-2026-00011 (Zenith Petrochem, ₦12.5M)</code>: 10 days overdue, grace expired, <strong>5% penalty (₦60,316.24) automatically levied</strong>. Demonstrate 1-click status simulation!</div>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 6: 11 LIVE DEMO CASES REFERENCE MATRIX & SIGN-OFF               -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Live Demo Cases Reference Matrix &amp; Executive Acceptance</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Pipeline:</strong> 11 Pre-Populated Cases<br />
          <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>13. Pre-Populated Live Demo Cases Matrix (11 Active Accounts)</h2>
      <table>
        <thead>
          <tr>
            <th>Case Ref</th>
            <th>Borrower / Obligor Entity</th>
            <th>Amount (₦)</th>
            <th>Workflow Stage</th>
            <th>Active Persona Queue</th>
            <th>Key Governance / Telemetry Feature Demonstrated</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OFL-2026-00001</strong></td>
            <td>Adebayo Adeleke (Retail)</td>
            <td>₦1,850,000</td>
            <td><span class="pill pill-blue">Analyst Review</span></td>
            <td>Credit Analyst</td>
            <td>BESTO partner webhook ingestion (&le; ₦2.0M)</td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00002</strong></td>
            <td>Greenline Agro-Allied Limited</td>
            <td>₦8,500,000</td>
            <td><span class="pill pill-green">Ready for Disb</span></td>
            <td>Treasury Lead</td>
            <td><strong>1-Click LOAN-DISC Booking &amp; NAV Voucher</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00003</strong></td>
            <td>LEO-AKINBONI GLOBAL ENTERPRISES</td>
            <td>₦45,000,000</td>
            <td><span class="pill pill-cyan">BCC Sanction</span></td>
            <td>BCC Chair</td>
            <td><strong>Board Credit Sanction (&gt; ₦20M Mandate)</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00004</strong></td>
            <td>Medilink Diagnostic Services Ltd</td>
            <td>₦15,000,000</td>
            <td><span class="pill pill-cyan">MD Decision</span></td>
            <td>Managing Director</td>
            <td><strong>MD Final Sanction (&le; ₦20M) &amp; Auto Offer Letter</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00005</strong></td>
            <td>Apex Marine &amp; Offshore Ltd</td>
            <td>₦12,000,000</td>
            <td><span class="pill pill-purple">Head of BD Review</span></td>
            <td>Head of BD</td>
            <td><strong>MCC 1st Reviewer commercial evaluation</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00006</strong></td>
            <td>Sunrise Confectioneries Ltd</td>
            <td>₦6,000,000</td>
            <td><span class="pill pill-purple">HRM Review</span></td>
            <td>Head of Risk (HRM)</td>
            <td><strong>Vertex AI 12-Page CAM &amp; Exception Prompt to BD</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00007</strong></td>
            <td>Nexus Broadband &amp; Telecom Ltd</td>
            <td>₦28,000,000</td>
            <td><span class="pill pill-green">Disbursed / Monitor</span></td>
            <td>Treasury / Portfolio</td>
            <td><strong>Current &amp; Performing (0 days overdue, ₦0 penalty)</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00008</strong></td>
            <td>Crestview Engineering Ltd</td>
            <td>₦7,200,000</td>
            <td><span class="pill pill-amber">BDO Rework</span></td>
            <td>BDO (Segun Adeleke)</td>
            <td><strong>Analyst return to BDO for incomplete documents</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00009</strong></td>
            <td>Golden Prime Distribution Ltd</td>
            <td>₦18,000,000</td>
            <td><span class="pill pill-blue">Offer Pending</span></td>
            <td>Credit Operations</td>
            <td>Auto-generated formal Offer Letter &amp; email dispatch</td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00010</strong></td>
            <td>Bluefin Marine Coldchain Ltd</td>
            <td>₦16,000,000</td>
            <td><span class="pill pill-amber">Disbursed / Monitor</span></td>
            <td>Portfolio Telemetry</td>
            <td><strong>Grace Period Active: 4 days overdue, ₦0 penalty</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00011</strong></td>
            <td>Zenith Petrochemical Logistics</td>
            <td>₦12,500,000</td>
            <td><span class="pill pill-red">Disbursed / Monitor</span></td>
            <td>Portfolio Telemetry</td>
            <td><strong>Overdue Penalty: 10 days, 5% penalty (₦60,316.24)</strong></td>
          </tr>
        </tbody>
      </table>

      <h2>14. Staff Persona Quick-Switch Reference</h2>
      <table>
        <thead>
          <tr>
            <th>Persona Selector</th>
            <th>Staff Name</th>
            <th>Official Corporate Email</th>
            <th>Primary Queue / Responsibilities</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Managing Director (MD)</strong></td>
            <td>Folashade Tinubu</td>
            <td><code>folashade.tinubu@opticomfinance.com</code></td>
            <td>Highest Executive Sanction (&le; ₦20M) &amp; Platform Admin</td>
          </tr>
          <tr>
            <td><strong>Head of Business Dev</strong></td>
            <td>Dapo Adeleke</td>
            <td><code>dapo.adeleke@opticomfinance.com</code></td>
            <td>MCC 1st Reviewer, Commercial Rationale &amp; Pricing Endorsement</td>
          </tr>
          <tr>
            <td><strong>Head of Risk (HRM)</strong></td>
            <td>Chidinma Okafor</td>
            <td><code>chidinma.okafor@opticomfinance.com</code></td>
            <td>Risk Review Queue, AI CAM Synthesis &amp; Risk Concurrence</td>
          </tr>
          <tr>
            <td><strong>Credit Analyst</strong></td>
            <td>Babatunde Adebayo</td>
            <td><code>tunde.adebayo@opticomfinance.com</code></td>
            <td>Underwriting Queue, Spreading, BDO Query Resolution</td>
          </tr>
          <tr>
            <td><strong>Business Dev Officer (BDO)</strong></td>
            <td>Segun Adeleke</td>
            <td><code>segun.adeleke@opticomfinance.com</code></td>
            <td>Assisted Intake &amp; BDO Rework Queue</td>
          </tr>
          <tr>
            <td><strong>Treasury Operations</strong></td>
            <td>Ibrahim Musa</td>
            <td><code>ibrahim.musa@opticomfinance.com</code></td>
            <td>Disbursement, LOAN-DISC Booking &amp; Telemetry Surveillance</td>
          </tr>
        </tbody>
      </table>

      <h2>15. Executive Acceptance &amp; Sign-off Block</h2>
      <div class="sign-grid">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-name">Head of Credit &amp; Risk (HRM)</div>
          <div class="sign-title">Opticom Finance Limited</div>
        </div>
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-name">Head of Business Development</div>
          <div class="sign-title">Opticom Finance Limited</div>
        </div>
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-name">Managing Director / CEO</div>
          <div class="sign-title">Opticom Finance Limited</div>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; 10th Floor, UAC House, 1-5 Odunlami St, Lagos Island &bull; Help-Line: 0816 181 3538 &bull; info@opticomfinance.com
    </div>
  </div>

</body>
</html>
"""

    html_path = os.path.abspath("executive_walkthrough_guide.html")
    pdf_path = os.path.abspath("OPTICOM_EXECUTIVE_DEMO_WALKTHROUGH.pdf")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Generated HTML report at: {html_path} ({os.path.getsize(html_path)} bytes)")

    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]

    print("Executing Chrome headless PDF conversion...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(f"Chrome returncode: {res.returncode}")
    if res.stderr:
        print(f"Chrome stderr: {res.stderr}")

    if os.path.exists(pdf_path):
        size_kb = os.path.getsize(pdf_path) / 1024
        print(f"SUCCESS: Created PDF at {pdf_path} ({size_kb:.2f} KB)")
        
        # Copy to artifact directory
        artifact_pdf = r"C:\Users\HomePC\.gemini\antigravity\brain\8b0793b6-06aa-4510-8666-be6e79bd4e73\OPTICOM_EXECUTIVE_DEMO_WALKTHROUGH.pdf"
        shutil.copy2(pdf_path, artifact_pdf)
        print(f"Copied to artifact directory: {artifact_pdf}")
        return True
    else:
        print("FAILED: PDF not created.")
        return False

if __name__ == "__main__":
    build_pdf()
