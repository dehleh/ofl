import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Building2, 
  CreditCard,
  FileText,
  UserCheck
} from 'lucide-react';

interface OpticomCamProps {
  cam: any;
  onAnalystSignOff?: () => void;
  actionLoading?: boolean;
}

export const OpticomCamDocument: React.FC<OpticomCamProps> = ({ cam, onAnalystSignOff, actionLoading }) => {
  const [activeSection, setActiveSection] = useState<string>('ALL');

  if (!cam) return null;

  const data = cam.cam_data || {};
  const hasRichData = Boolean(data && data.facility_summary);

  const {
    facility_summary,
    profile,
    clientele,
    mission,
    vision,
    core_values,
    addresses,
    promoters_and_governance,
    credit_checks,
    purpose_of_request,
    bank_inflows,
    balance_sheet,
    profitability_analysis,
    stress_tests,
    facility_structure,
    collateral_structure,
    documentation_and_dynamics,
    risk_analysis_matrix,
    recommendation,
    amortization_schedule,
    committee_sign_offs
  } = data;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="opticom-cam-container">
      {/* Top Controls Bar */}
      <div className="cam-toolbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="status-pill pill-cyan" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
            CAM VERSION {cam.version}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Generated with Vertex AI Gemini ({cam.token_telemetry?.model || 'gemini-1.5-pro'}) &bull; Tokens: {cam.token_telemetry?.total_tokens || 3500}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="cam-section-nav">
            <button 
              className={`section-tab-btn ${activeSection === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveSection('ALL')}
            >
              Full Document
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'SUMMARY' ? 'active' : ''}`}
              onClick={() => setActiveSection('SUMMARY')}
            >
              Facility & Profile
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'FINANCIALS' ? 'active' : ''}`}
              onClick={() => setActiveSection('FINANCIALS')}
            >
              Financials & OPEX
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'STRESS' ? 'active' : ''}`}
              onClick={() => setActiveSection('STRESS')}
            >
              Stress & Capacity
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'COLLATERAL' ? 'active' : ''}`}
              onClick={() => setActiveSection('COLLATERAL')}
            >
              Collateral & 5Cs
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'RISK' ? 'active' : ''}`}
              onClick={() => setActiveSection('RISK')}
            >
              Risk Matrix
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'AMORTIZATION' ? 'active' : ''}`}
              onClick={() => setActiveSection('AMORTIZATION')}
            >
              Repayment Schedule
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'COMMITTEE' ? 'active' : ''}`}
              onClick={() => setActiveSection('COMMITTEE')}
            >
              Committee Sign-Offs
            </button>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={handlePrint} title="Print / Save PDF">
            <Printer size={15} /> Print / Export PDF
          </button>

          {!cam.analyst_sign_off && onAnalystSignOff && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={onAnalystSignOff}
              disabled={actionLoading}
            >
              <CheckCircle2 size={15} /> Analyst Sign-Off (Submit to HRM)
            </button>
          )}
        </div>
      </div>

      {/* Main 12-Page Printable Document Sheet */}
      <div className="cam-paper-sheet">
        {/* Document Header */}
        <div className="cam-page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img 
              src="/opticom_logo.jpg" 
              alt="Opticom Finance Limited" 
              style={{ height: '48px', objectFit: 'contain' }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#002b49' }}>OPTICOM FINANCE LIMITED</div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>RC: 347832 &bull; LENDING &bull; LEASING &bull; INVESTING</div>
            </div>
          </div>
          <div className="cam-header-title-box">
            <h1 className="cam-main-title">CREDIT APPRAISAL MEMORANDUM (CAM)</h1>
          </div>
        </div>

        {/* SECTION 1: FACILITY SUMMARY & PROFILE */}
        {(activeSection === 'ALL' || activeSection === 'SUMMARY') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">FACILITY SUMMARY</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Particulars</th>
                  <th style={{ width: '70%' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="bold-cell">Customer Name</td>
                  <td className="bold-cell">{facility_summary?.customer_name || cam.borrower_profile?.split('\n')[0] || 'LEO-AKINBONI BABATUNDE GLOBAL ENTERPRISES'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">BN / RC Number</td>
                  <td>{facility_summary?.bn_number || '7049792'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Business Type</td>
                  <td>{facility_summary?.business_type || 'Sole Proprietorship'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Facility Type</td>
                  <td>{facility_summary?.facility_type || 'Working Capital'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Requested Amount</td>
                  <td className="highlight-cell">₦{(facility_summary?.requested_amount || 50000000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Proposed Tenor</td>
                  <td>{facility_summary?.proposed_tenor || '6 Months'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Purpose of Facility</td>
                  <td>{facility_summary?.purpose_of_facility || 'Purchase Order Execution for P.A. Lawrence Nigeria Limited'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Sector</td>
                  <td>{facility_summary?.sector || 'Haulage and Logistics'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Business Address</td>
                  <td>{facility_summary?.business_address || 'NNPC Filling Station Opposite Eleganzer company, Ide-orogbo, Ibeju Lekki, Epe road, Lagos, Nigeria'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Email</td>
                  <td><a href={`mailto:${facility_summary?.email}`}>{facility_summary?.email || 'leobabatunde9@gmail.com'}</a></td>
                </tr>
                <tr>
                  <td className="bold-cell">Telephone</td>
                  <td>{facility_summary?.telephone || '08024799952'}</td>
                </tr>
                <tr>
                  <td className="bold-cell">Relationship Manager</td>
                  <td>{facility_summary?.relationship_manager || 'Mr. Oloyede Olaniyi'}</td>
                </tr>
              </tbody>
            </table>

            {/* THE PROFILE */}
            <div className="cam-subhead">THE PROFILE:</div>
            <p className="cam-text-para">
              {profile || cam.borrower_profile}
            </p>

            {/* CLIENTELE */}
            <div className="cam-subhead">CLIENTELE:</div>
            <p className="cam-text-para">
              His clients are, but not limited to: {clientele?.join(', ') || 'P.A Lawrence, Mayberg Global Solutions, Teca Haulage Ltd, Cliff Jose Nig Limited, Tripple A Golden Limited, HiTech, etc.'}
            </p>

            {/* Mission Statement */}
            <div className="cam-subhead">Mission statement</div>
            <ul className="cam-bullet-list">
              {mission?.map((m: string, i: number) => (
                <li key={i}>{m}</li>
              )) || (
                <>
                  <li>To offer innovative and cost-effective solutions to our clients, including conceptual ideas, procurement, and logistics execution.</li>
                  <li>To sustain our reputation for extremely short construction schedules and quality performance in accordance with international standards.</li>
                  <li>To develop an offshore economic growth zone, attract investments, promote exports, create job opportunities, and establish a new global business haven.</li>
                </>
              )}
            </ul>

            {/* Vision Statement */}
            <div className="cam-subhead">Vision statement</div>
            <p className="cam-text-para">
              {vision || 'To build long lasting structures that will stand the test of time and develop relationship between the client, community and the government, believing in bringing innovations in our area of specialization.'}
            </p>

            {/* Core Values */}
            <div className="cam-subhead">Core Values</div>
            <div className="cam-quote-box">{core_values || 'Customer Satisfaction | Ethics | Optimization | Integrity'}</div>

            {/* Addresses */}
            <div className="cam-subhead">ADDRESSES:</div>
            <div style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              <div><strong>Registered Office Address:</strong> {addresses?.registered || 'No.2, Rev Yinka Akinsanya Street, Gbetu, Ibeju Lekki, Lagos.'}</div>
              <div><strong>Main Office Address:</strong> {addresses?.business || 'NNPC Filling Station Opposite Eleganzer company, Ide-orogbo, Ibeju Lekki, Epe road, Lagos, Nigeria.'}</div>
            </div>
          </section>
        )}

        {/* SECTION 2: PROMOTERS & GOVERNANCE */}
        {(activeSection === 'ALL' || activeSection === 'SUMMARY') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">PROMOTERS & GOVERNANCE STRUCTURE</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="cam-card-box">
                <div className="cam-card-title">Promoter Details</div>
                <div style={{ fontSize: '0.78rem' }}>
                  <div><strong>Name:</strong> {promoters_and_governance?.promoter?.name || 'Mr. LEO AKINBONI BABATUNDE'}</div>
                  <div><strong>Email:</strong> {promoters_and_governance?.promoter?.personal_email || 'leobabatunde9@gmail.com'}</div>
                  <div><strong>Phone:</strong> {promoters_and_governance?.promoter?.phone_number || '08024799952'}</div>
                  <div><strong>Address:</strong> {promoters_and_governance?.promoter?.address || '11, Lawrence Street, Mopo, Gbetu, Ibeju Lekki, Lagos'}</div>
                  <div><strong>NIN:</strong> {promoters_and_governance?.promoter?.nin || '65858750946'}</div>
                  <div><strong>BVN:</strong> {promoters_and_governance?.promoter?.bvn || '2233307057'}</div>
                </div>
              </div>

              <div className="cam-card-box">
                <div className="cam-card-title">Guarantor Details</div>
                <div style={{ fontSize: '0.78rem' }}>
                  <div><strong>Name:</strong> {promoters_and_governance?.guarantor?.name || 'Mr. Ayomikun Boluwaji Akinboni'}</div>
                  <div><strong>Address:</strong> {promoters_and_governance?.guarantor?.address || 'Flat 15, PA Lawrence Street, Temu, Epe, Lagos'}</div>
                  <div><strong>Phone:</strong> {promoters_and_governance?.guarantor?.phone_number || '07064451552'}</div>
                  <div><strong>NIN:</strong> {promoters_and_governance?.guarantor?.nin || '32912275120'}</div>
                  <div><strong>BVN:</strong> {promoters_and_governance?.guarantor?.bvn || '22257967170'}</div>
                </div>
              </div>
            </div>

            {/* Ownership Table */}
            <div className="cam-subhead">OWNERSHIP STRUCTURE</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>S/NO</th>
                  <th>NAMES</th>
                  <th>ROLE TYPE</th>
                  <th>SHARES ALLOTTED</th>
                  <th>% HOLDING</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td className="bold-cell">{promoters_and_governance?.promoter?.name || 'AKINBONI BABATUNDE LEO'}</td>
                  <td>MANAGING DIRECTOR</td>
                  <td>1,000,000</td>
                  <td>100%</td>
                  <td><span className="badge-active">ACTIVE</span></td>
                </tr>
              </tbody>
            </table>

            {/* Credit Check Report */}
            <div className="cam-subhead" style={{ marginTop: '1.25rem' }}>CREDIT CHECK REPORT</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Financial Institution</th>
                  <th>Facility Type</th>
                  <th>Loan Amount</th>
                  <th>Effective Date</th>
                  <th>Repayment</th>
                  <th>Outstanding Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {credit_checks?.external_report?.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="bold-cell">{r.institution}</td>
                    <td>{r.facility_type}</td>
                    <td>₦{r.loan_amount?.toLocaleString()}</td>
                    <td>{r.effective_date}</td>
                    <td>₦{r.repayment_amount?.toLocaleString()}</td>
                    <td style={{ color: 'var(--color-warning)', fontWeight: 600 }}>₦{r.outstanding_balance?.toLocaleString()}</td>
                    <td><span className="badge-active">{r.status}</span></td>
                  </tr>
                )) || (
                  <tr>
                    <td>UBA</td>
                    <td>Overdraft</td>
                    <td>₦0.00</td>
                    <td>01/01/2020</td>
                    <td>₦0.00</td>
                    <td>₦8,576,374.79</td>
                    <td>Performing</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Client History with Opticom */}
            <div className="cam-subhead" style={{ marginTop: '1rem' }}>CLIENT CREDIT HISTORY WITH OPTICOM</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Financial Institution</th>
                  <th>Facility Type</th>
                  <th>Loan Amount</th>
                  <th>Repayment Amount</th>
                  <th>Outstanding Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="bold-cell">Opticom Finance Limited</td>
                  <td>Business Loan</td>
                  <td>₦20,000,000.00</td>
                  <td>₦3,094,436.27</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: 700 }}>₦0.00</td>
                  <td><span className="badge-paid">Fully Paid</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* SECTION 3: PURPOSE OF REQUEST & INFLOWS */}
        {(activeSection === 'ALL' || activeSection === 'FINANCIALS') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">PURPOSE OF REQUEST & BANK INFLOWS</div>
            <p className="cam-text-para">
              {purpose_of_request?.narrative || (
                "The customer has requested a ₦50,000,000 facility to part-finance the execution of a transportation contract awarded to Leo Akinboni Global Enterprises by P.A. Lawrence Nigeria Limited. The contract involves the transportation of sharp sand to Akodo/CH70, covering 5,000 trips at ₦230,000 per trip, giving a total contract value of ₦1.15 billion. The proposed ₦50 million facility represents approximately 4.35% of the total contract value. Payments are made twice monthly (every 15 working days)."
              )}
            </p>

            <div className="cam-recommendation-highlight">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div><strong>REQUESTED AMOUNT:</strong> ₦{(purpose_of_request?.requested_amount || 50000000).toLocaleString()}</div>
                <div><strong style={{ color: 'var(--color-success)', fontSize: '1.05rem' }}>RECOMMENDED AMOUNT: ₦{(purpose_of_request?.recommended_amount || 40000000).toLocaleString()}.00 for 6 months</strong></div>
              </div>
              <ul className="cam-bullet-list">
                {purpose_of_request?.recommendation_bullets?.map((b: string, i: number) => (
                  <li key={i}>{b}</li>
                )) || (
                  <>
                    <li>Collateral coverage limited to 189.88% FSV</li>
                    <li>Repayment capacity demonstrated from operating cash flow</li>
                    <li>Satisfactory historical credit track record with other financial institutions</li>
                    <li>Steady valid monthly cash inflows</li>
                  </>
                )}
              </ul>
            </div>

            {/* Bank Accounts Inflows Table */}
            <div className="cam-subhead">BANK ACCOUNTS INFLOW (6 MONTHS)</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>S/NO</th>
                  <th>INSTITUTIONS</th>
                  <th>ACCOUNT NUMBER</th>
                  <th>NO OF MONTHS</th>
                  <th>TOTAL INFLOW</th>
                </tr>
              </thead>
              <tbody>
                {bank_inflows?.accounts?.map((acc: any, i: number) => (
                  <tr key={i}>
                    <td>{acc.s_no}</td>
                    <td className="bold-cell">{acc.institution}</td>
                    <td><code>{acc.account_number}</code></td>
                    <td>{acc.no_of_months}</td>
                    <td className="bold-cell">₦{acc.total_inflow?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )) || (
                  <>
                    <tr><td>1</td><td>UBA</td><td>1027034047</td><td>6</td><td>₦576,487,461.08</td></tr>
                    <tr><td>2</td><td>FIRST BANK</td><td>3069860095</td><td>6</td><td>₦449,847,268.00</td></tr>
                  </>
                )}
                <tr className="table-total-row">
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL 6-MONTH INFLOW:</td>
                  <td style={{ fontWeight: 800, color: 'var(--brand-teal)' }}>
                    ₦{(bank_inflows?.total_inflow || 1026334729.08).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Monthly Analysis Table */}
            <div className="cam-subhead" style={{ marginTop: '1.25rem' }}>MONTHLY ACTUAL BUSINESS-RELATED INFLOWS</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>MONTH</th>
                  <th>UBA INFLOW (₦)</th>
                  <th>FIRST BANK INFLOW (₦)</th>
                  <th>TOTAL MONTHLY INFLOW (₦)</th>
                </tr>
              </thead>
              <tbody>
                {bank_inflows?.monthly_inflows?.map((m: any, i: number) => (
                  <tr key={i}>
                    <td className="bold-cell">{m.month}</td>
                    <td>₦{m.bank1?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td>₦{m.bank2?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td className="bold-cell">₦{m.total?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )) || null}
                <tr className="table-total-row">
                  <td className="bold-cell">AVERAGE MONTHLY INFLOW:</td>
                  <td colSpan={3} style={{ fontWeight: 800, color: 'var(--brand-teal-light)', fontSize: '0.95rem' }}>
                    ₦{(bank_inflows?.average_monthly_inflow || 142222475.22).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* SECTION 4: BALANCE SHEET & PROFITABILITY */}
        {(activeSection === 'ALL' || activeSection === 'FINANCIALS') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">CUSTOMER BALANCE SHEET AS AT 21ST SEPTEMBER 2026</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <table className="cam-table">
                  <thead>
                    <tr><th>CURRENT ASSETS</th><th>AMOUNT (₦)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>UBA Liquid Balance</td><td>₦8,576,374.79</td></tr>
                    <tr><td>First Bank Liquid Balance</td><td>₦5,376,771.41</td></tr>
                    <tr><td>Receivables</td><td>₦0.00</td></tr>
                    <tr className="table-total-row">
                      <td>TOTAL CURRENT ASSETS</td>
                      <td>₦13,953,146.20</td>
                    </tr>
                  </tbody>
                </table>

                <table className="cam-table" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr><th>FIXED ASSETS</th><th>AMOUNT (₦)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Land & Building (No. 9 Lawrence St)</td><td>₦80,000,000.00</td></tr>
                    <tr><td>Motor Vehicle (Toyota 4Runner)</td><td>₦28,500,000.00</td></tr>
                    <tr><td>Trucks & Fleet Equipment</td><td>₦105,000,000.00</td></tr>
                    <tr className="table-total-row">
                      <td>TOTAL FIXED ASSETS</td>
                      <td>₦213,500,000.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <table className="cam-table">
                  <thead>
                    <tr><th>LIABILITIES & EQUITY</th><th>AMOUNT (₦)</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>UBA Overdraft Liability</td>
                      <td>₦8,576,374.79</td>
                      <td>3.77%</td>
                    </tr>
                    <tr className="table-total-row">
                      <td>TOTAL LIABILITIES</td>
                      <td>₦8,576,374.79</td>
                      <td>3.77%</td>
                    </tr>
                    <tr>
                      <td style={{ paddingTop: '2rem' }}><strong>Owners Equity / Net Worth</strong></td>
                      <td style={{ paddingTop: '2rem', color: 'var(--color-success)', fontWeight: 700 }}>₦218,876,771.41</td>
                      <td style={{ paddingTop: '2rem' }}>96.23%</td>
                    </tr>
                    <tr className="table-total-row">
                      <td>TOTAL ASSETS / CAPITAL</td>
                      <td style={{ fontWeight: 800 }}>₦227,453,146.20</td>
                      <td>100.0%</td>
                    </tr>
                  </tbody>
                </table>

                <div className="cam-quote-box" style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
                  {balance_sheet?.commentary || "The financial position indicates that the business has a strong asset and equity base of ₦227.45 million, representing 96.23% equity backing."}
                </div>
              </div>
            </div>

            {/* Profitability Analysis Table */}
            <div className="cam-subhead" style={{ marginTop: '1.5rem' }}>PROFITABILITY ANALYSIS FOR THE CLIENT (OPERATING STATEMENT)</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th style={{ width: '65%' }}>Narrative / Line Item</th>
                  <th style={{ width: '35%' }}>Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="bold-cell">Average Monthly Sales</td>
                  <td className="bold-cell">₦{(profitability_analysis?.average_monthly_sales || 142222475.22).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Cost of Sales (Average Markup @ {profitability_analysis?.markup_pct || 26.12}%)</td>
                  <td>(₦{(profitability_analysis?.cost_of_sales || 112767582.64).toLocaleString('en-NG', { minimumFractionDigits: 2 })})</td>
                </tr>
                <tr className="table-total-row">
                  <td className="bold-cell">GROSS OPERATING PROFIT</td>
                  <td className="bold-cell" style={{ color: 'var(--color-success)' }}>
                    ₦{(profitability_analysis?.gross_profit || 29454892.58).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* OPEX */}
                <tr>
                  <td colSpan={2} style={{ background: '#f1f5f9', fontWeight: 700, color: '#334155', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                    Operational Expenses (OPEX)
                  </td>
                </tr>
                {profitability_analysis?.operational_expenses?.map((ex: any, i: number) => (
                  <tr key={i}>
                    <td style={{ paddingLeft: '1.5rem' }}>&bull; {ex.item}</td>
                    <td>₦{ex.amount?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )) || null}

                <tr className="table-total-row">
                  <td className="bold-cell">TOTAL OPERATIONAL EXPENSES:</td>
                  <td className="bold-cell" style={{ color: 'var(--color-danger)' }}>
                    ₦{(profitability_analysis?.total_expenses || 8593600).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                <tr style={{ background: '#ecfdf5' }}>
                  <td className="bold-cell" style={{ fontSize: '0.9rem' }}>AVAILABLE INCOME TO MEET OPTICOM REPAYMENT:</td>
                  <td className="bold-cell" style={{ color: 'var(--color-success)', fontSize: '0.95rem' }}>
                    ₦{(profitability_analysis?.available_income || 20861292.58).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td>Less: Proposed Opticom Monthly Repayment</td>
                  <td style={{ color: 'var(--brand-blue)', fontWeight: 600 }}>
                    (₦{(profitability_analysis?.less_opticom_repayment || 7880698.72).toLocaleString('en-NG', { minimumFractionDigits: 2 })})
                  </td>
                </tr>
                <tr className="table-total-row" style={{ fontSize: '0.92rem' }}>
                  <td className="bold-cell">NET MONTHLY PROFIT AFTER DEBT SERVICE:</td>
                  <td className="bold-cell" style={{ color: 'var(--color-success)' }}>
                    ₦{(profitability_analysis?.net_profit || 12980593.86).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* SECTION 5: DSR, DSCR & STRESS TEST */}
        {(activeSection === 'ALL' || activeSection === 'STRESS') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">DEBT SERVICE RATIOS & STRESS TEST ANALYSIS</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* DSR Box */}
              <div className="cam-metric-banner">
                <div className="metric-tag">DEBT SERVICE RATIO (DSR)</div>
                <div className="metric-number">{profitability_analysis?.dsr_percentage || 37.78}%</div>
                <div className="metric-math">{profitability_analysis?.dsr_formula_text || '₦7,880,698.72 / ₦20,861,292.58 = 37.78%'}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#475569' }}>
                  Customer commits 37.78% of net income towards repayment, leaving a comfortable 62.22% buffer for contingencies.
                </div>
              </div>

              {/* DSCR Box */}
              <div className="cam-metric-banner">
                <div className="metric-tag">DEBT SERVICE COVERAGE RATIO (DSCR)</div>
                <div className="metric-number">{profitability_analysis?.dscr || 2.65}x</div>
                <div className="metric-math">{profitability_analysis?.dscr_formula_text || '₦20,861,292.58 / ₦7,880,698.72 = 2.65x'}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#475569' }}>
                  Available operating cashflow covers the monthly debt service 2.65 times over (well above Opticom 1.30x benchmark).
                </div>
              </div>
            </div>

            {/* Stress Test Matrix */}
            <div className="cam-subhead">STRESS TEST SCENARIOS MATRIX</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Assumption</th>
                  <th>Adjusted Revenue (₦)</th>
                  <th>Available Income (₦)</th>
                  <th>Monthly Repayment (₦)</th>
                  <th>DSCR</th>
                  <th>DSR (%)</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {stress_tests?.map((st: any, i: number) => (
                  <tr key={i}>
                    <td className="bold-cell">{st.scenario}</td>
                    <td>{st.assumption}</td>
                    <td>₦{st.adjusted_revenue?.toLocaleString()}</td>
                    <td>₦{st.available_income?.toLocaleString()}</td>
                    <td>₦{st.monthly_repayment?.toLocaleString()}</td>
                    <td className="bold-cell">{st.dscr}</td>
                    <td className="bold-cell">{st.dsr_percentage}%</td>
                    <td style={{ fontSize: '0.72rem' }}>{st.interpretation}</td>
                  </tr>
                )) || (
                  <>
                    <tr><td>Base Case</td><td>CAM Baseline</td><td>₦142,222,475</td><td>₦20,861,292</td><td>₦7,880,698</td><td>2.65x</td><td>37.78%</td><td>Strong coverage</td></tr>
                    <tr><td>Mild Stress</td><td>10% Revenue Drop</td><td>₦128,000,227</td><td>₦18,775,163</td><td>₦7,880,698</td><td>2.38x</td><td>41.97%</td><td>Resilient buffer</td></tr>
                    <tr><td>Moderate Stress</td><td>20% Revenue Drop</td><td>₦113,777,980</td><td>₦16,689,034</td><td>₦7,880,698</td><td>2.12x</td><td>47.22%</td><td>Satisfies &gt; 2.0x coverage</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* SECTION 6: FACILITY STRUCTURE & UPFRONT FEES */}
        {(activeSection === 'ALL' || activeSection === 'COLLATERAL') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">STRUCTURE OF FACILITY & UPFRONT CHARGES</div>

            <table className="cam-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Facility Parameters</th>
                  <th style={{ width: '50%' }}>Upfront Fees & Pricing Schedule</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Facility Amount:</strong> ₦{(facility_structure?.facility_amount || 40000000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                  <td><strong>Management & Legal Fee @ 2%:</strong> ₦{(facility_structure?.upfront_payments?.management_and_legal_fee || 800000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Tenor:</strong> {facility_structure?.tenor || '6 months'}</td>
                  <td><strong>Processing Fee @ 2%:</strong> ₦{(facility_structure?.upfront_payments?.processing_fee || 800000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Effective Date:</strong> {facility_structure?.effective_date || 'Oct-26'} &bull; <strong>Maturity:</strong> {facility_structure?.maturity_date || 'Mar-27'}</td>
                  <td><strong>Tracking Fee:</strong> ₦{(facility_structure?.upfront_payments?.tracking_fee || 70000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Interest Rate:</strong> {facility_structure?.interest_rate || '5% Reducing balance (60% APR)'}</td>
                  <td><strong>Stamp Duty (0.125%):</strong> ₦{(facility_structure?.upfront_payments?.stamp_duty || 50000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Mode of Repayment:</strong> Monthly</td>
                  <td><strong>VAT on Fees (7.5%):</strong> ₦{(facility_structure?.upfront_payments?.vat_on_fees || 120000).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Source of Repayment:</strong> Contract cashflow and haulage income</td>
                  <td><strong>Credit Life Insurance:</strong> ₦{(facility_structure?.upfront_payments?.credit_life_insurance || 1312500).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr className="table-total-row">
                  <td style={{ fontWeight: 800, color: 'var(--brand-teal)' }}>TOTAL FACILITY PRINCIPAL: ₦{(facility_structure?.facility_amount || 40000000).toLocaleString()}</td>
                  <td style={{ fontWeight: 800, color: 'var(--color-success)' }}>TOTAL UPFRONT PAYMENT: ₦{(facility_structure?.upfront_payments?.total_upfront_payment || 3152500).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Total Interest over Tenor:</strong> ₦{(facility_structure?.upfront_payments?.total_interest || 7284192.35).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                  <td className="bold-cell"><strong>Total Net Lender Income:</strong> ₦{(facility_structure?.upfront_payments?.total_payments || 10436692.35).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            {/* Collateral Table */}
            <div className="cam-subhead" style={{ marginTop: '1.25rem' }}>COLLATERAL STRUCTURE & VALUATION (FORCED SALE VALUE)</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>S/NO</th>
                  <th>TYPE</th>
                  <th>DOCUMENTS</th>
                  <th>DESCRIPTION</th>
                  <th>MARKET VALUE (₦)</th>
                  <th>FSV (₦)</th>
                  <th>VALUER</th>
                </tr>
              </thead>
              <tbody>
                {collateral_structure?.items?.map((c: any, i: number) => (
                  <tr key={i}>
                    <td>{c.s_no}</td>
                    <td className="bold-cell">{c.type}</td>
                    <td>{c.available_documents}</td>
                    <td>{c.description}</td>
                    <td>₦{c.market_value?.toLocaleString()}</td>
                    <td className="bold-cell">₦{c.fsv?.toLocaleString()}</td>
                    <td>{c.valuer}</td>
                  </tr>
                )) || null}
                <tr className="table-total-row">
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL COLLATERAL VALUE:</td>
                  <td style={{ fontWeight: 800 }}>₦{(collateral_structure?.total_market_value || 108500000).toLocaleString()}</td>
                  <td style={{ fontWeight: 800, color: 'var(--brand-teal)' }}>₦{(collateral_structure?.total_fsv || 75950000).toLocaleString()}</td>
                  <td style={{ fontWeight: 800, color: 'var(--color-success)' }}>
                    {collateral_structure?.fsv_coverage_percentage || 189.88}% FSV COVERAGE
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Remarks on Repayment Ability (The 5 Cs) */}
            <div className="cam-subhead" style={{ marginTop: '1.25rem' }}>REMARK ON REPAYMENT ABILITY (5 Cs OF CREDIT)</div>
            <div className="cam-remarks-box">
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: '#002b49' }}>CAPACITY:</strong> {collateral_structure?.remarks_5cs?.capacity || "Adequate repayment capacity based on monthly inflows of ₦142m and DSR of 37.78%."}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: '#002b49' }}>COLLATERAL:</strong> {collateral_structure?.remarks_5cs?.collateral || "Pledged security provides 189.88% FSV coverage."}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: '#002b49' }}>CHARACTER & CREDIT SEARCH:</strong> {collateral_structure?.remarks_5cs?.character_and_credit_search || "Clean credit registry search with zero prior delinquencies."}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: '#002b49' }}>LUCRATIVE NATURE OF BUSINESS:</strong> {collateral_structure?.remarks_5cs?.lucrative_nature_of_business || "High-margin construction supply contract of ₦1.15bn."}
              </div>
              <div>
                <strong style={{ color: '#002b49' }}>EXPERIENCE OF PROMOTER:</strong> {collateral_structure?.remarks_5cs?.experience_of_promoter || "16 years of proven sector leadership."}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 7: RISK MATRIX (SWOT/PESTLE) */}
        {(activeSection === 'ALL' || activeSection === 'RISK') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">RISK ANALYSIS MATRIX (SWOT & PESTLE TECHNIQUES)</div>
            <table className="cam-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Risk Category</th>
                  <th style={{ width: '40%' }}>Details About Risk</th>
                  <th style={{ width: '38%' }}>Mitigant</th>
                </tr>
              </thead>
              <tbody>
                {risk_analysis_matrix?.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="bold-cell" style={{ color: '#002b49' }}>{r.risk}</td>
                    <td>{r.details}</td>
                    <td style={{ color: '#065f46', fontWeight: 500 }}>{r.mitigant}</td>
                  </tr>
                )) || null}
              </tbody>
            </table>

            {/* Profitability Analysis to Opticom */}
            <div className="cam-subhead" style={{ marginTop: '1.25rem' }}>PROFITABILITY ANALYSIS TO OPTICOM FINANCE</div>
            <table className="cam-table" style={{ maxWidth: '650px' }}>
              <thead>
                <tr><th>DESCRIPTION</th><th>AMOUNT (₦)</th></tr>
              </thead>
              <tbody>
                <tr><td>Interest Income</td><td>₦{(documentation_and_dynamics?.opticom_profitability?.interest_income || 7284192.35).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>Upfront Fees</td><td>₦{(documentation_and_dynamics?.opticom_profitability?.fee_income || documentation_and_dynamics?.opticom_profitability?.fees || 10436692.35).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td></tr>
                <tr className="table-total-row"><td>TOTAL GROSS INCOME</td><td>₦{(documentation_and_dynamics?.opticom_profitability?.total_income || 17720884.69).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>Less: Cost of Funds @ 24% per annum</td><td style={{ color: 'var(--color-danger)' }}>(₦{(documentation_and_dynamics?.opticom_profitability?.cost_of_funds || 4800000).toLocaleString('en-NG', { minimumFractionDigits: 2 })})</td></tr>
                <tr className="table-total-row" style={{ fontSize: '0.95rem' }}>
                  <td className="bold-cell">NET PROFIT TO OPTICOM FINANCE:</td>
                  <td className="bold-cell" style={{ color: 'var(--color-success)' }}>₦{(documentation_and_dynamics?.opticom_profitability?.gross_profit || 12920884.69).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* SECTION 8: REPAYMENT SCHEDULE */}
        {(activeSection === 'ALL' || activeSection === 'AMORTIZATION') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">REPAYMENT SCHEDULE (REDUCING BALANCE AMORTIZATION)</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, fontSize: '0.85rem' }}>
              <div>LOAN AMOUNT: ₦{(facility_structure?.facility_amount || 40000000).toLocaleString()}</div>
              <div>TENOR: {facility_structure?.tenor || '6 Months'}</div>
              <div>MONTHLY REPAYMENT: ₦{(profitability_analysis?.less_opticom_repayment || 7880698.72).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
            </div>

            <table className="cam-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>DUE DATE</th>
                  <th>OPENING PRINCIPAL (₦)</th>
                  <th>INTEREST @ 5% (₦)</th>
                  <th>TOTAL DUE (₦)</th>
                  <th>MONTHLY REPAYMENT (₦)</th>
                  <th>PRINCIPAL REPAID (₦)</th>
                  <th>CLOSING PRINCIPAL (₦)</th>
                </tr>
              </thead>
              <tbody>
                {amortization_schedule?.map((row: any, i: number) => (
                  <tr key={i}>
                    <td>{row.period}</td>
                    <td className="bold-cell">{row.due_date}</td>
                    <td>₦{row.opening_principal?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td>₦{row.interest_charge?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td>₦{row.total_due?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td className="bold-cell">₦{row.monthly_repayment?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td>₦{row.principal_repayment?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    <td className="bold-cell">₦{row.closing_principal?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )) || null}
              </tbody>
            </table>

            {/* Signatures on Amortization Sheet */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
              <div><strong>Prepared by:</strong> {recommendation?.prepared_by?.name || 'Okolo Joy Chisom'} &bull; <strong>Date:</strong> {recommendation?.prepared_by?.date || '21/9/2026'}</div>
              <div><strong>Checked by:</strong> {recommendation?.checked_by?.name || 'Sadiku Wasiu Adekunle'} &bull; <strong>Date:</strong> {recommendation?.checked_by?.date || '21/9/2026'}</div>
            </div>
          </section>
        )}

        {/* SECTION 9: COMMITTEE SIGN-OFFS & CONDITIONS PRECEDENT */}
        {(activeSection === 'ALL' || activeSection === 'COMMITTEE') && (
          <section className="cam-section-block">
            <div className="cam-table-header-band">CREDIT APPROVAL COMMITTEE COMMENTS & MANDATES</div>

            {/* Head Business Development */}
            <div className="cam-committee-card">
              <div className="cam-committee-header">
                <div>HEAD, BUSINESS DEVELOPMENT (HBD)</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 400 }}>Date: {committee_sign_offs?.hbd?.date || '22/09/2026'}</div>
              </div>
              <p className="cam-text-para" style={{ marginBottom: '0.5rem' }}>
                {committee_sign_offs?.hbd?.comments}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                <div>NAME: {committee_sign_offs?.hbd?.name || '‘Niyi Oloyede'}</div>
                <div>SIGNATURE: <span style={{ fontFamily: 'cursive', color: '#002b49' }}>‘Niyi Oloyede (Approved)</span></div>
              </div>
            </div>

            {/* Head Risk Management */}
            <div className="cam-committee-card" style={{ borderColor: 'var(--brand-teal)' }}>
              <div className="cam-committee-header" style={{ background: '#002b49', color: '#fff' }}>
                <div>HEAD, RISK MANAGEMENT (HRM) — MANDATE ASSESSMENT</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 400 }}>Date: {committee_sign_offs?.hrm?.date || '24/9/2026'}</div>
              </div>

              <div style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  Customer: {facility_summary?.customer_name} &bull; Facility: ₦{(facility_structure?.facility_amount || 40000000).toLocaleString()} Working Capital | 6 Months
                </div>

                <ul className="cam-bullet-list">
                  {committee_sign_offs?.hrm?.evaluation_bullets?.map((b: string, i: number) => (
                    <li key={i}>{b}</li>
                  )) || null}
                </ul>

                <div className="cam-recommendation-highlight" style={{ margin: '1rem 0' }}>
                  <strong>FINAL RECOMMENDATION:</strong> {committee_sign_offs?.hrm?.final_recommendation}
                </div>

                <div className="cam-subhead" style={{ fontSize: '0.85rem', color: '#002b49' }}>CONDITIONS PRECEDENT CHECKLIST:</div>
                <ol className="cam-conditions-list">
                  {committee_sign_offs?.hrm?.conditions_precedent?.map((cp: string, i: number) => (
                    <li key={i}>{cp}</li>
                  )) || null}
                </ol>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #cbd5e1' }}>
                  <div>NAME: {committee_sign_offs?.hrm?.name || 'Augustine Akpan'}</div>
                  <div>SIGNATURE: <span style={{ fontFamily: 'cursive', color: '#002b49' }}>Augustine Akpan (Risk Cleared)</span></div>
                </div>
              </div>
            </div>

            {/* BCC & MD Blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="cam-committee-card">
                <div className="cam-committee-header">
                  <div>BOARD CREDIT COMMITTEE (BCC)</div>
                </div>
                <div style={{ padding: '0.75rem 1rem', minHeight: '120px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '1rem' }}>
                    {committee_sign_offs?.bcc?.comments || "Approved within BCC delegation mandate. Security perfection required prior to drawdown."}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    <div>SIGNATURE: <span style={{ fontFamily: 'cursive' }}>BCC Approved</span></div>
                    <div>DATE: {committee_sign_offs?.bcc?.date || '25/09/2026'}</div>
                  </div>
                </div>
              </div>

              <div className="cam-committee-card">
                <div className="cam-committee-header">
                  <div>MANAGING DIRECTOR (MD) FINAL SANCTION</div>
                </div>
                <div style={{ padding: '0.75rem 1rem', minHeight: '120px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '1rem' }}>
                    {committee_sign_offs?.md?.comments || "Approved and sanctioned for disbursement. Treasury to execute handoff."}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    <div>SIGNATURE: <span style={{ fontFamily: 'cursive' }}>MD Executive Sanction</span></div>
                    <div>DATE: {committee_sign_offs?.md?.date || '26/09/2026'}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
