"""
Opticom Finance Limited - Executive Management Walkthrough Guide PDF Generator
Creates an institutional-grade, 5-page executive PDF document with exact branding,
color palettes, workflows, demo cases reference table, and presenter talking points.
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
    margin: 10mm 12mm 10mm 12mm;
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
    line-height: 1.35;
    font-size: 8.5pt;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }}

  .page {{
    page-break-after: always;
    height: 275mm;
    max-height: 275mm;
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
    padding-bottom: 8px;
    margin-bottom: 11px;
  }}

  .logo-box {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .logo-img {{
    height: 38px;
    border-radius: 4px;
  }}

  .company-title {{
    font-size: 13.5pt;
    font-weight: 800;
    color: #041326;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.1;
  }}

  .company-sub {{
    font-size: 7.2pt;
    font-weight: 700;
    color: #0096cc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }}

  .header-meta {{
    text-align: right;
    font-size: 7.5pt;
    color: #64748b;
    line-height: 1.3;
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
    margin-bottom: 3px;
  }}

  /* Hero Title */
  .hero-box {{
    background: linear-gradient(135deg, #041326 0%, #0a2540 100%);
    color: #ffffff;
    padding: 11px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
    border-left: 4px solid #0096cc;
  }}

  .hero-title {{
    font-size: 13.5pt;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
    color: #ffffff;
  }}

  .hero-desc {{
    font-size: 7.8pt;
    color: #94a3b8;
    margin-top: 3px;
    margin-bottom: 0;
  }}

  h2 {{
    font-size: 9.8pt;
    font-weight: 800;
    color: #041326;
    margin: 10px 0 6px 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }}

  h3 {{
    font-size: 8.8pt;
    font-weight: 700;
    color: #0096cc;
    margin: 8px 0 4px 0;
  }}

  p {{
    margin: 0 0 6px 0;
    color: #334155;
    font-size: 8.2pt;
    line-height: 1.35;
  }}

  /* Callout Card */
  .card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 9px 12px;
    margin-bottom: 9px;
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

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 7.6pt;
    margin-bottom: 8px;
  }}

  th {{
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 5px 7px;
    border: 1px solid #cbd5e1;
    font-size: 7.2pt;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }}

  td {{
    padding: 4.5px 7px;
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
    padding: 1.5px 6px;
    border-radius: 4px;
    font-size: 6.8pt;
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
    gap: 9px;
    margin-bottom: 8px;
  }}

  .grid-3 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
  }}

  .grid-4 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 7px;
    margin-bottom: 8px;
  }}

  .stat-card {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 7px 9px;
    text-align: center;
  }}

  .stat-val {{
    font-size: 13.5pt;
    font-weight: 800;
    color: #0096cc;
    line-height: 1.1;
  }}

  .stat-lbl {{
    font-size: 6.8pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 2px;
  }}

  /* Step box */
  .step-box {{
    display: flex;
    gap: 9px;
    margin-bottom: 7px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 7px 10px;
    align-items: flex-start;
  }}

  .step-num {{
    background: #0096cc;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 800;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}

  .step-content {{
    flex: 1;
  }}

  .step-title {{
    font-size: 8.5pt;
    font-weight: 700;
    color: #041326;
    margin-bottom: 2px;
  }}

  .step-text {{
    font-size: 7.7pt;
    color: #475569;
    margin: 0;
    line-height: 1.3;
  }}

  .talking-point {{
    background: #f1f5f9;
    border-left: 2px solid #0096cc;
    padding: 3px 6px;
    margin-top: 3px;
    font-size: 7.2pt;
    color: #0f172a;
    border-radius: 2px;
  }}

  /* Sign block */
  .sign-grid {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 10px;
  }}

  .sign-box {{
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 8px 10px;
    background: #f8fafc;
  }}

  .sign-line {{
    border-bottom: 1px dashed #94a3b8;
    height: 24px;
    margin-bottom: 5px;
  }}

  .sign-name {{
    font-size: 7.8pt;
    font-weight: 700;
    color: #0f172a;
  }}

  .sign-title {{
    font-size: 7pt;
    color: #64748b;
  }}

  .footer-note {{
    font-size: 7pt;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
    margin-top: 6px;
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
        <div class="hero-title">Commercial Credit Automation Platform — Executive Walkthrough Guide</div>
        <div class="hero-desc">
          Official comprehensive demonstration roadmap for the Managing Director, Head of Credit &amp; Risk (HRM), Head of Business Development, Board Credit Committee (BCC), and Treasury.
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
          <div class="stat-val">&gt; ₦20.0M</div>
          <div class="stat-lbl">BCC Board Sanction Mandate</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">1-Click</div>
          <div class="stat-lbl">LOAN-DISC / Xloandisk Booking</div>
        </div>
      </div>

      <h2>1. Executive Summary &amp; Management Context</h2>
      <p>
        Opticom Finance Limited (RC: 347832) has implemented an end-to-end autonomous underwriting and credit lifecycle engine. This platform automates the transformation of commercial loan origination from manual, fragmented spreadsheets and paper memos into a deterministic, secure, and auditable digital pipeline running strictly within Opticom's enterprise boundaries.
      </p>

      <div class="card card-highlight">
        <div style="font-weight: 700; color: #006b99; margin-bottom: 3px; font-size: 8.2pt;">
          Key Executive Value Propositions:
        </div>
        <ul style="margin: 0; padding-left: 16px; font-size: 7.8pt; color: #334155; line-height: 1.35;">
          <li><strong>Zero Hallucination Guarantee:</strong> All financial metrics (DSCR, DTI, PMT, Amortization, Fees, Stress Tests) are calculated strictly by a deterministic Python engine outside the AI layer.</li>
          <li><strong>Official 12-Page Opticom CAM:</strong> Google Cloud Vertex AI Gemini automates narrative synthesis into the official corporate Credit Appraisal Memorandum format, citing verified bank statements and CAC incorporation documents.</li>
          <li><strong>Canonical Governance &amp; Multi-Tier Segregation:</strong> Strict Role-Based Access Control (RBAC) ensuring Credit Analyst recommends, HRM synthesizes, Head of BD commercial reviews, and final sanction routes deterministically to MD (&le; ₦20M) or BCC (&gt; ₦20M).</li>
          <li><strong>Integrated Master Fee Schedule &amp; Bespoke Inclusions:</strong> Full transparency of statutory fees (Stamp Duty 0.125%, FIRS VAT 7.5% on service fees) and customizable bespoke fees with live net disbursement simulation.</li>
          <li><strong>Core LMS Synchronization:</strong> Native 1-click booking into Opticom's core LMS (LOAN-DISC / Xloandisk) with NAV settlement ledger voucher generation and replay prevention.</li>
        </ul>
      </div>

      <h2>2. Enterprise System Architecture &amp; Intake Gateways</h2>
      <div class="grid-2">
        <div class="card">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px; font-size: 8.2pt;">
            Gate 1: BESTO Retail Partner Ingestion (&le; ₦2,000,000)
          </div>
          <p style="font-size: 7.6pt; margin-bottom: 3px;">
            High-volume consumer &amp; micro-commercial facilities up to ₦2.0M ingested via secure HMAC-SHA256 authenticated REST webhooks. Includes reuse of BESTO KYC and automated quarantine for suspicious payloads.
          </p>
          <span class="pill pill-blue">RETAIL GATEWAY</span> <span class="pill pill-green">HMAC-SHA256 SECURED</span>
        </div>

        <div class="card">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px; font-size: 8.2pt;">
            Gate 2: OFL Direct Commercial Portal (&gt; ₦2,000,000)
          </div>
          <p style="font-size: 7.6pt; margin-bottom: 3px;">
            Institutional front-door for SME and corporate clients from ₦2,000,000.01 up to ₦50M+ single obligor limit. Features bank statement OCR upload, CAC documentation, and live 28% APR commercial repayment sizer.
          </p>
          <span class="pill pill-cyan">COMMERCIAL GATEWAY</span> <span class="pill pill-purple">STRUCTURED ENTERPRISE</span>
        </div>
      </div>

      <div class="card card-success" style="margin-top: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>Corporate Identity &amp; Contact:</strong> Opticom Finance Limited &bull; RC: 347832<br />
            <span style="font-size: 7.4pt; color: #047857;">
              10th Floor, UAC House, 1-5 Odunlami St, Lagos Island, Lagos &bull; Help-Line: <strong>0816 181 3538</strong> &bull; Email: <strong>info@opticomfinance.com</strong>
            </span>
          </div>
          <span class="pill pill-green">LIVE PRODUCTION READY</span>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 2: CANONICAL OPTICOM APPROVAL WORKFLOW & GOVERNANCE LIMITS       -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Canonical Credit Origination &amp; Approval Authority Flow</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Doc Ref:</strong> OFL-SOP-CR-01<br />
          <strong>RC:</strong> 347832 &bull; <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>3. The Opticom Approval Lifecycle (PRD Sections 6, 7 &amp; 17)</h2>
      <p>
        The platform enforces Opticom's approved multi-tier governance matrix. Every credit case follows this strict sequential chain with role-segregated queues:
      </p>

      <div class="step-box">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">Application Intake &amp; Identity Verification (Youverify Gateway)</div>
          <div class="step-text">Borrower or BDO submits facility request with 6-month bank statements, CAC certificate, and board resolution. Youverify automated API verifies BVN, NIN, RC status, and conducts PEP/Sanctions screening.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">Credit Analyst Underwriting &amp; Financial Spreading</div>
          <div class="step-text">Analyst evaluates verified bank turnover, spreads financials, executes deterministic ratio calculations (DSCR &ge; 1.30x, DSR &le; 40%), validates collateral coverage (&ge; 1.20x), and submits recommendation to HRM.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">Head of Risk Management (HRM) — CAM Synthesis</div>
          <div class="step-text">HRM triggers Vertex AI Gemini to generate the 12-page official Credit Appraisal Memorandum (CAM). HRM reviews risk covenants, stress testing matrices, and routes the case to Head of Business Development.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">4</div>
        <div class="step-content">
          <div class="step-title">Head of Business Development — Commercial Review &amp; Sanction</div>
          <div class="step-text">Head of BD evaluates the commercial rationale, client relationship history, repayment dynamics, and interest margin. Upon commercial recommendation/approval, the case returns to HRM for final risk concurrence.</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">5</div>
        <div class="step-content">
          <div class="step-title">HRM Concurrence &amp; Escalation to Final Executive Authority</div>
          <div class="step-text">HRM reviews BD's commercial recommendations. Upon risk concurrence, the engine checks the facility amount against Opticom's deterministic sanction thresholds:</div>
        </div>
      </div>

      <div class="grid-2" style="margin-top: 4px;">
        <div class="card card-highlight">
          <div style="font-weight: 800; color: #006b99; font-size: 8.5pt;">
            Path A: Facilities &le; ₦20,000,000 (MD Sanction)
          </div>
          <p style="font-size: 7.5pt; margin-top: 2px;">
            Case routes to <strong>Managing Director (MD)</strong>. MD grants final executive approval, automatically advancing case to <code>Offer Pending</code> and notifying Finance and Loan Operations.
          </p>
        </div>

        <div class="card card-warning">
          <div style="font-weight: 800; color: #b45309; font-size: 8.5pt;">
            Path B: Facilities &gt; ₦20,000,000 (BCC Sanction)
          </div>
          <p style="font-size: 7.5pt; margin-top: 2px;">
            MD reviews and endorses facility, escalating it to the <strong>Board Credit Committee (BCC)</strong>. BCC Chairman and Committee members grant final board sanction, triggering offer generation.
          </p>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">6</div>
        <div class="step-content">
          <div class="step-title">Offer Letter Generation &amp; Conditions Precedent Clearance</div>
          <div class="step-text">System generates formal facility Offer Letter with itemized Master Fee Schedule. Credit Operations verifies satisfaction of Conditions Precedent (e.g. registered mortgage, comprehensive insurance, promissory notes).</div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">7</div>
        <div class="step-content">
          <div class="step-title">Treasury 1-Click LOAN-DISC / Xloandisk Booking &amp; NAV Settlement</div>
          <div class="step-text">Treasury Lead executes 1-click disbursement: books loan into core LMS (LOAN-DISC / Xloandisk), generates NAV accounting voucher (e.g. <code>NAV-DISB-XXXX</code>), and logs SHA-256 audit entry.</div>
        </div>
      </div>

      <h2>4. Opticom Delegated Authority Matrix (Deterministic Limits)</h2>
      <table>
        <thead>
          <tr>
            <th>Persona Role</th>
            <th>Designated Authority</th>
            <th>Approval Limit (₦)</th>
            <th>Governance Responsibilities</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Credit Analyst</strong></td>
            <td>Recommend &amp; Review</td>
            <td>Up to ₦2,000,000 (Recommend Only)</td>
            <td>Bank statement spreading, DSCR/DTI ratios, collateral analysis</td>
          </tr>
          <tr>
            <td><strong>Head of Risk (HRM)</strong></td>
            <td>Risk Review &amp; Synthesis</td>
            <td>Up to ₦5,000,000 (Initial Risk Sign-off)</td>
            <td>12-page CAM synthesis, covenant structure, routing to BD &amp; MD</td>
          </tr>
          <tr>
            <td><strong>Head of Business Dev</strong></td>
            <td>Commercial Sanction</td>
            <td>Commercial Review &amp; Endorsement</td>
            <td>Market validation, client relationship, commercial pricing</td>
          </tr>
          <tr>
            <td><strong>Managing Director (MD)</strong></td>
            <td>Highest Executive &amp; Admin Authority</td>
            <td><strong>Up to ₦20,000,000 (Final Sanction)</strong></td>
            <td>Final facility sanction &le; ₦20M; full admin oversight across platform</td>
          </tr>
          <tr>
            <td><strong>Board Credit Committee (BCC)</strong></td>
            <td>Board Credit Committee</td>
            <td><strong>Over ₦20,000,000 (Board Sanction)</strong></td>
            <td>Final board sanction for enterprise facilities exceeding ₦20M</td>
          </tr>
          <tr>
            <td><strong>Treasury Operations</strong></td>
            <td>LOAN-DISC &amp; Settlement</td>
            <td>Execution &amp; Core LMS Booking</td>
            <td>Conditions precedent check, NAV voucher, LOAN-DISC sync</td>
          </tr>
        </tbody>
      </table>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 3: PRICING POLICY, MASTER FEE SCHEDULE & BESPOKE FEES            -->
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

      <h2>5. Central Bank of Nigeria (CBN) Benchmark &amp; Commercial Pricing</h2>
      <p>
        The platform centralizes all pricing formulas in <strong>Tab 6: Fee Schedule &amp; Bespoke</strong> under System Configuration. In full compliance with CBN regulatory benchmarks, commercial interest rates are derived deterministically:
      </p>

      <div class="card card-highlight">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 7.2pt; font-weight: 700; color: #006b99; text-transform: uppercase;">Active Commercial Lending Formula</span>
            <div style="font-size: 11pt; font-weight: 800; color: #041326; margin-top: 2px;">
              CBN MPR (23.00%) + Commercial Risk Spread (5.00%) = 28.00% APR
            </div>
            <div style="font-size: 7.6pt; color: #475569; margin-top: 2px;">
              Monthly Equivalent Rate: <strong>2.33% / month</strong> on reducing-balance amortization.
            </div>
          </div>
          <div style="text-align: right;">
            <span class="pill pill-green">CBN MONITORED</span><br />
            <span style="font-size: 7pt; color: #64748b;">Centralized in Fee Hub</span>
          </div>
        </div>
      </div>

      <h2>6. Opticom Master Fee Schedule &amp; Bespoke Inclusions</h2>
      <p>
        Opticom standardizes 7 baseline fees while providing complete agility to select, adjust, or add bespoke transaction fees at any point in the origination lifecycle:
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

      <h2>7. Worked Facility Deduction Simulator (Sample ₦10,000,000 Facility)</h2>
      <div class="grid-4">
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 7pt; color: #64748b; font-weight: 700;">SAMPLE PRINCIPAL</div>
          <div style="font-size: 11pt; font-weight: 800; color: #041326;">₦10,000,000.00</div>
          <div style="font-size: 6.8pt; color: #64748b;">12-Month Tenor @ 28% APR</div>
        </div>
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 7pt; color: #64748b; font-weight: 700;">MGT + PROCESSING (4%)</div>
          <div style="font-size: 11pt; font-weight: 800; color: #0096cc;">₦400,000.00</div>
          <div style="font-size: 6.8pt; color: #64748b;">Mgt ₦200k + Proc ₦200k</div>
        </div>
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 7pt; color: #64748b; font-weight: 700;">VAT ON FEES (7.5%)</div>
          <div style="font-size: 11pt; font-weight: 800; color: #0096cc;">₦30,000.00</div>
          <div style="font-size: 6.8pt; color: #64748b;">7.5% of ₦400,000 fees</div>
        </div>
        <div class="card" style="margin-bottom: 0;">
          <div style="font-size: 7pt; color: #64748b; font-weight: 700;">STAMP DUTY (0.125%)</div>
          <div style="font-size: 11pt; font-weight: 800; color: #0096cc;">₦12,500.00</div>
          <div style="font-size: 6.8pt; color: #64748b;">Statutory FIRS rate</div>
        </div>
      </div>

      <div class="card card-success" style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 7.2pt; font-weight: 700; color: #065f46; text-transform: uppercase;">Net Upfront Disbursed Capital to Borrower</div>
            <div style="font-size: 12pt; font-weight: 800; color: #047857;">
              ₦9,557,500.00 <span style="font-size: 8pt; font-weight: 600; color: #065f46;">(Total Upfront Statutory Deductions: ₦442,500.00 &bull; 4.425%)</span>
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
  <!-- PAGE 4: 6-ACT LIVE DEMONSTRATION SCRIPT (PRESENTER ROADMAP)           -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="page-content">
      
      <!-- Top Header -->
      <div class="doc-header">
        <div class="logo-box">
          <img src="data:image/jpeg;base64,{logo_base64}" class="logo-img" alt="Opticom Logo" />
          <div>
            <div class="company-title">OPTICOM FINANCE LIMITED</div>
            <div class="company-sub">Executive Live Demonstration Script (6-Act Roadmap)</div>
          </div>
        </div>
        <div class="header-meta">
          <strong>Demo Duration:</strong> 15-20 Mins<br />
          <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>8. Step-by-Step Live Demonstration Script</h2>
      <p>
        Use this script to guide the management team through the live platform. Follow the 6 acts in sequence:
      </p>

      <div class="step-box">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">ACT 1: Public Borrower Front-Door &amp; Commercial Repayment Sizer</div>
          <div class="step-text">
            <strong>URL:</strong> <code>http://localhost:5173/</code> &bull; <strong>Goal:</strong> Show high-trust institutional elegance.
          </div>
          <div class="talking-point">
            <strong>Talking Points:</strong> Drag the loan calculator between ₦5M, ₦15M, and ₦50M. Show transparent 28% APR interest calculation (23% CBN MPR + 5% spread) and upfront fee breakdown. Click <em>"Apply for Commercial Loan"</em> to show the multi-document upload and corporate manifest.
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">ACT 2: Admin Cockpit &amp; MD Executive Privilege</div>
          <div class="step-text">
            <strong>URL:</strong> <code>http://localhost:5173/staff</code> &bull; <strong>Persona:</strong> <code>Managing Director (MD)</code> &bull; <strong>Screen:</strong> <code>Admin &amp; Settings</code>
          </div>
          <div class="talking-point">
            <strong>Talking Points:</strong> Demonstrate that MD holds supreme administrative authority. Show Tab 5 (Credit Limits: ₦2M Analyst, ₦5M HRM, ₦20M MD, &gt;₦20M BCC; and Webhooks) and Tab 6 (Master Fee Schedule &amp; CBN 23% MPR / 28% APR pricing formula with 1-click update).
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">ACT 3: Underwriting &amp; AI Credit Appraisal Memorandum (CAM)</div>
          <div class="step-text">
            <strong>Persona Switch:</strong> <code>Head of Risk Management (HRM)</code> &bull; <strong>Case:</strong> <code>OFL-2026-00006 (Sunrise Foods, ₦6.0M)</code>
          </div>
          <div class="talking-point">
            <strong>Talking Points:</strong> Open Case 6 from Risk Review Queue. Show verified bank statement analysis (GTBank ₦18.2M/mo, DSCR 1.74x). Click <em>"Generate AI CAM"</em> to watch Google Vertex AI synthesize the official 12-page Opticom Credit Appraisal Memorandum with SWOT, covenants, and amortization.
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">4</div>
        <div class="step-content">
          <div class="step-title">ACT 4: Commercial Review &amp; Multi-Tier Approvals (Head of BD, MD, BCC)</div>
          <div class="step-text">
            <strong>Cases:</strong> <code>OFL-2026-00005 (Apex Marine, ₦12M)</code> &bull; <code>OFL-2026-00004 (Medilink, ₦15M)</code> &bull; <code>OFL-2026-00003 (Leo-Akinboni, ₦45M)</code>
          </div>
          <div class="talking-point">
            <strong>Talking Points:</strong><br />
            &bull; Switch to <code>Head of BD</code>: Show Case 5 in commercial review queue, add commercial endorsement.<br />
            &bull; Switch to <code>MD</code>: Open Case 4 (₦15M Medilink Diagnostics &le; ₦20M). Click <em>"Approve Facility"</em>. Show automated Offer Letter issuance and instant dispatch notification to Finance.<br />
            &bull; Switch to <code>BCC</code>: Open Case 3 (₦45M Haulage &gt; ₦20M). Show board credit deliberation and final BCC sanction!
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">5</div>
        <div class="step-content">
          <div class="step-title">ACT 5: Exception Governance &amp; Youverify KYC Resolution</div>
          <div class="step-text">
            <strong>Screen:</strong> <code>Exceptions &amp; Rework</code> &bull; <strong>Case:</strong> <code>OFL-2026-00008 (Crestview Eng, ₦7.2M)</code>
          </div>
          <div class="talking-point">
            <strong>Talking Points:</strong> Show the Exception Manager with live 24-hour SLA countdown. Point out the Youverify Director NIN mismatch and DTI policy threshold flag. Show resolution notes and audit convergence.
          </div>
        </div>
      </div>

      <div class="step-box">
        <div class="step-num">6</div>
        <div class="step-content">
          <div class="step-title">ACT 6: Conditions Clearance &amp; 1-Click LOAN-DISC / Xloandisk Booking</div>
          <div class="step-text">
            <strong>Persona Switch:</strong> <code>Treasury &amp; Loan Operations</code> &bull; <strong>Case:</strong> <code>OFL-2026-00002 (Greenline Agro, ₦8.5M)</code>
          </div>
          <div class="talking-point">
            <strong>Talking Points:</strong> Open Case 2 in Disbursement Queue. Show all 3 Conditions Precedent satisfied. Show fee deduction schedule (₦7,826,375 net disbursement). Click <em>"Execute 1-Click LOAN-DISC Booking"</em>. Instant confirmation with LOAN-DISC facility ID and NAV ledger reference <code>NAV-DISB-XXXX</code>.
          </div>
        </div>
      </div>

    </div>
    <div class="footer-note">
      Opticom Finance Limited &bull; Executive Management Walkthrough Guide &bull; Confidential
    </div>
  </div>


  <!-- ===================================================================== -->
  <!-- PAGE 5: LIVE DEMO REFERENCE SHEET & EXECUTIVE SIGN-OFF                -->
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
          <strong>Pipeline:</strong> 9 Pre-Populated Cases<br />
          <strong>Helpline:</strong> 0816 181 3538
        </div>
      </div>

      <h2>9. Pre-Populated Live Demo Cases Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Case Ref</th>
            <th>Borrower / Obligor Entity</th>
            <th>Sector</th>
            <th>Amount (₦)</th>
            <th>Current Stage</th>
            <th>Active Persona Queue</th>
            <th>Key Demo Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OFL-2026-00001</strong></td>
            <td>Adebayo Adeleke (Retail)</td>
            <td>Retail Trade</td>
            <td>₦1,850,000</td>
            <td><span class="pill pill-blue">Analyst Review</span></td>
            <td>Credit Analyst</td>
            <td>BESTO partner webhook ingestion demo</td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00002</strong></td>
            <td>Greenline Agro-Allied Limited</td>
            <td>Agro-Processing</td>
            <td>₦8,500,000</td>
            <td><span class="pill pill-green">Ready for Disb</span></td>
            <td>Treasury Lead</td>
            <td><strong>1-Click LOAN-DISC Booking &amp; NAV Voucher</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00003</strong></td>
            <td>LEO-AKINBONI GLOBAL ENTERPRISES</td>
            <td>Haulage Logistics</td>
            <td>₦45,000,000</td>
            <td><span class="pill pill-cyan">BCC/Authorisation</span></td>
            <td>BCC Chair</td>
            <td><strong>Board Credit Sanction (&gt; ₦20M Mandate)</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00004</strong></td>
            <td>Medilink Diagnostic Services Ltd</td>
            <td>Healthcare</td>
            <td>₦15,000,000</td>
            <td><span class="pill pill-cyan">MD Decision</span></td>
            <td>Managing Director</td>
            <td><strong>MD Final Sanction (&le; ₦20M Mandate)</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00005</strong></td>
            <td>Apex Marine &amp; Offshore Ltd</td>
            <td>Maritime Energy</td>
            <td>₦12,000,000</td>
            <td><span class="pill pill-purple">Head of BD Review</span></td>
            <td>Head of BD</td>
            <td>Commercial review &amp; pricing endorsement</td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00006</strong></td>
            <td>Sunrise Confectioneries Ltd</td>
            <td>Food Mfg</td>
            <td>₦6,000,000</td>
            <td><span class="pill pill-purple">HRM Review</span></td>
            <td>Head of Risk (HRM)</td>
            <td><strong>Vertex AI 12-Page CAM Generation</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00007</strong></td>
            <td>Nexus Broadband &amp; Telecom Ltd</td>
            <td>Telecom Fiber</td>
            <td>₦28,000,000</td>
            <td><span class="pill pill-green">Disbursed/Monitor</span></td>
            <td>Treasury / Portfolio</td>
            <td>Active repayment schedule &amp; monitoring</td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00008</strong></td>
            <td>Crestview Engineering Ltd</td>
            <td>Civil Works</td>
            <td>₦7,200,000</td>
            <td><span class="pill pill-amber">Analyst Review</span></td>
            <td>Credit Analyst</td>
            <td><strong>Exceptions Manager &amp; 24h SLA Rework</strong></td>
          </tr>
          <tr>
            <td><strong>OFL-2026-00009</strong></td>
            <td>Golden Prime Distribution Ltd</td>
            <td>FMCG Wholesale</td>
            <td>₦18,000,000</td>
            <td><span class="pill pill-blue">Offer Pending</span></td>
            <td>Credit Operations</td>
            <td>Offer Letter &amp; Bespoke Fee Schedule</td>
          </tr>
        </tbody>
      </table>

      <h2>10. Staff Persona Quick-Switch Cheat Sheet</h2>
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
            <td><strong>System Administrator</strong></td>
            <td>Admin Console</td>
            <td><code>admin@opticomfinance.com</code></td>
            <td>SSO, SMTP, MFA, Credit Limits, Webhooks &amp; Fee Hub</td>
          </tr>
          <tr>
            <td><strong>Head of Risk (HRM)</strong></td>
            <td>Chidinma Okafor</td>
            <td><code>chidinma.okafor@opticomfinance.com</code></td>
            <td>Risk Review Queue, AI CAM Synthesis &amp; Risk Concurrence</td>
          </tr>
          <tr>
            <td><strong>Head of Business Dev</strong></td>
            <td>Dapo Adeleke</td>
            <td><code>dapo.adeleke@opticomfinance.com</code></td>
            <td>Commercial Sanction Queue, Commercial Rationale &amp; Margins</td>
          </tr>
          <tr>
            <td><strong>Board Credit Committee (BCC)</strong></td>
            <td>Emeka Nnamdi (BCC Chair)</td>
            <td><code>emeka.nnamdi@opticomfinance.com</code></td>
            <td>Board Sanctions Queue for High-Value Facilities (&gt; ₦20M)</td>
          </tr>
          <tr>
            <td><strong>Credit Analyst</strong></td>
            <td>Babatunde Adebayo</td>
            <td><code>tunde.adebayo@opticomfinance.com</code></td>
            <td>Underwriting Queue, Bank Statement OCR &amp; Financial Spreading</td>
          </tr>
          <tr>
            <td><strong>Treasury &amp; Loan Operations</strong></td>
            <td>Ibrahim Musa</td>
            <td><code>ibrahim.musa@opticomfinance.com</code></td>
            <td>Disbursement Queue, 1-Click LOAN-DISC Booking &amp; NAV Vouchers</td>
          </tr>
        </tbody>
      </table>

      <h2>11. Executive Acceptance &amp; Sign-off Block</h2>
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
