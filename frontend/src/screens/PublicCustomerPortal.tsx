import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Calculator, 
  FileText, 
  UploadCloud, 
  Search, 
  Lock, 
  ShieldCheck, 
  DollarSign, 
  Clock, 
  Briefcase,
  HelpCircle,
  PhoneCall,
  CheckCheck
} from 'lucide-react';
import { submitDirectApplication, trackApplication, respondToApplicantException } from '../services/api';

interface PublicCustomerPortalProps {
  onOpenStaffGate: () => void;
  onGoToBesto: () => void;
}

export const PublicCustomerPortal: React.FC<PublicCustomerPortalProps> = ({
  onOpenStaffGate,
  onGoToBesto
}) => {
  const [activeTab, setActiveTab] = useState<'APPLY' | 'CALCULATOR' | 'TRACK'>('APPLY');
  const [step, setStep] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState({
    applicant_name: '',
    applicant_type: 'SME',
    email: '',
    phone: '',
    bvn: '',
    nin: '',
    rc_number: '',
    business_address: '',
    amount: 15000000,
    tenor_months: 12,
    purpose: '',
    facility_type: 'Working Capital',
    monthly_income: 8500000,
    existing_monthly_debt: 350000,
    estimated_monthly_expenses: 2500000,
    collateral_value: 25000000
  });

  // Attached files
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; type: string; size: string }>>([]);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tracking State
  const [trackRef, setTrackRef] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Boundary logic
  const isBelowBoundary = formData.amount <= 2000000;

  // Live Loan Calculations
  const calculations = useMemo(() => {
    const P = Number(formData.amount) || 0;
    const n = Number(formData.tenor_months) || 12;
    const r = 0.28 / 12; // 28% APR standard
    let pmt = 0;
    if (P > 0 && n > 0) {
      const factor = Math.pow(1 + r, n);
      pmt = P * (r * factor) / (factor - 1);
    }
    const totalRepayment = pmt * n;
    const totalInterest = totalRepayment - P;
    const estimatedUpfrontFees = P * 0.045; // ~4.5% upfront fees benchmark

    return {
      monthlyInstallment: Math.round(pmt),
      totalRepayment: Math.round(totalRepayment),
      totalInterest: Math.round(totalInterest),
      upfrontFees: Math.round(estimatedUpfrontFees)
    };
  }, [formData.amount, formData.tenor_months]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFiles(prev => [
      ...prev.filter(f => f.type !== fileType),
      {
        name: file.name,
        type: fileType,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      }
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBelowBoundary) {
      setErrorMsg('Applications at or below ₦2,000,000 must be submitted through our BESTO retail credit platform.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        ...formData,
        documents: uploadedFiles.map(f => ({
          name: f.name,
          type: f.type,
          summary: `Uploaded during public application: ${f.type}`
        }))
      };

      const res = await submitDirectApplication(payload);
      setSubmissionSuccess(res);
      setStep(4); // Confirmation step
    } catch (err: any) {
      if (err.detail && err.detail.message) {
        setErrorMsg(err.detail.message);
      } else {
        setErrorMsg(err.message || 'Application submission failed. Please verify your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackRef.trim()) return;

    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);

    try {
      const res = await trackApplication(trackRef);
      setTrackResult(res);
    } catch (err: any) {
      setTrackError(err.detail || 'Application reference not found. Please check your reference code.');
    } finally {
      setTrackLoading(false);
    }
  };

  const [applicantResponseNotes, setApplicantResponseNotes] = useState('');
  const [applicantResponseFiles, setApplicantResponseFiles] = useState<Array<{ name: string; type: string }>>([]);
  const [respondingToException, setRespondingToException] = useState(false);
  const [exceptionResponseMsg, setExceptionResponseMsg] = useState<string | null>(null);

  const handleRespondToException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackResult || !applicantResponseNotes.trim()) return;

    setRespondingToException(true);
    setExceptionResponseMsg(null);
    try {
      await respondToApplicantException(trackResult.case_number, {
        exception_id: trackResult.applicant_action?.exception_id,
        notes: applicantResponseNotes,
        documents: applicantResponseFiles.map(f => ({
          name: f.name,
          type: f.type,
          summary: 'Uploaded via customer portal response'
        }))
      });
      setExceptionResponseMsg('Information and documents submitted successfully. Your Underwriter has been notified.');
      setApplicantResponseNotes('');
      setApplicantResponseFiles([]);
      // Reload tracking status
      const updated = await trackApplication(trackResult.case_number);
      setTrackResult(updated);
    } catch (err: any) {
      setExceptionResponseMsg(err.detail || 'Failed to submit response. Please try again.');
    } finally {
      setRespondingToException(false);
    }
  };

  const populateSampleSmeData = () => {
    setFormData({
      applicant_name: 'LEO-AKINBONI BABATUNDE GLOBAL ENTERPRISES',
      applicant_type: 'SME',
      email: 'leobabatunde9@gmail.com',
      phone: '08024799952',
      bvn: '2233307057',
      nin: '65858750946',
      rc_number: '7049792',
      business_address: 'NNPC Filling Station, Ide-orogbo, Ibeju Lekki, Lagos',
      amount: 50000000,
      tenor_months: 6,
      purpose: 'Purchase Order Execution for P.A. Lawrence Nigeria Limited',
      facility_type: 'Working Capital',
      monthly_income: 142222475,
      existing_monthly_debt: 1000000,
      estimated_monthly_expenses: 8593600,
      collateral_value: 108500000
    });
    setUploadedFiles([
      { name: 'UBA_Haulage_Account_Statement_6M.pdf', type: 'BANK_STATEMENT', size: '2.45 MB' },
      { name: 'PA_Lawrence_Contract_Award_5000Trips.pdf', type: 'CONTRACT_PO', size: '1.18 MB' },
      { name: 'CAC_Certificate_Registration_BN7049792.pdf', type: 'CAC_REGISTRATION', size: '0.85 MB' }
    ]);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Top Customer Brand Navbar */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.1rem 2.5rem',
        background: 'rgba(12, 24, 44, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img 
            src="/opticom_logo.jpg" 
            alt="Opticom Finance Limited" 
            style={{ height: '42px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              OPTICOM FINANCE LIMITED
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--brand-teal-light)', fontWeight: 600, letterSpacing: '0.05em' }}>
              COMMERCIAL CREDIT & ENTERPRISE LOAN PORTAL (&gt; ₦2,000,000)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className={`btn btn-sm ${activeTab === 'APPLY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('APPLY')}
          >
            Apply for Loan
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'CALCULATOR' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('CALCULATOR')}
          >
            <Calculator size={14} /> Calculator
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'TRACK' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('TRACK')}
          >
            <Search size={14} /> Track Status
          </button>

          {/* Dedicated Staff Gate Trigger */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onOpenStaffGate}
            style={{ borderColor: 'var(--brand-teal)', color: 'var(--brand-teal-light)' }}
            title="Internal Access for Underwriters & Risk Committee"
          >
            <Lock size={14} /> Staff Gate 🔒
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {/* Hero Banner */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="status-pill pill-cyan" style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem', marginBottom: '1rem', display: 'inline-flex' }}>
            CBN Licensed Finance House &bull; RC: 347832
          </span>
          <h1 style={{ fontSize: '2.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
            Empowering Enterprises & Contractors With Structured Credit
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '720px', margin: '0 auto' }}>
            Fast working capital, contract finance, and asset leasing for requests from <strong>₦2,000,000 up to ₦200,000,000</strong>. Automated identity verification, deterministic underwriting, and 48-hour term sheet turnaround.
          </p>
        </div>

        {/* TAB 1: APPLY FOR LOAN */}
        {activeTab === 'APPLY' && (
          <div>
            {/* Quick Demo Pre-fill Bar */}
            <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Demonstration Case: <strong>Leo-Akinboni Babatunde Global Enterprises (₦50M Haulage Facility)</strong>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={populateSampleSmeData}>
                Prefill Sample Commercial Application
              </button>
            </div>

            {/* Canonical Boundary Notice if <= ₦2,000,000 */}
            {isBelowBoundary && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fbbf24'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <AlertTriangle size={28} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Notice: Loans Under ₦2,000,000</div>
                    <div style={{ fontSize: '0.85rem', color: '#fde68a', marginTop: '0.2rem' }}>
                      Retail facilities between ₦300,000 and ₦2,000,000 are processed through our <strong>BESTO Retail Credit Platform</strong>. The OFL Direct platform services commercial requests above ₦2,000,000.
                    </div>
                  </div>
                </div>
                <button className="btn btn-warning btn-sm" onClick={onGoToBesto}>
                  Go to BESTO Channel <ArrowRight size={14} />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1.5rem' }}>
                <AlertTriangle size={20} />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Stepper Navigation */}
            {step < 4 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: step === 1 ? 'var(--brand-teal-light)' : '#fff', fontWeight: 700 }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: step === 1 ? 'var(--brand-teal)' : 'rgba(255,255,255,0.1)', color: step === 1 ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>1</span>
                  Facility Requirements
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: step === 2 ? 'var(--brand-teal-light)' : '#fff', fontWeight: 700 }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: step === 2 ? 'var(--brand-teal)' : 'rgba(255,255,255,0.1)', color: step === 2 ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>2</span>
                  Business & Identity
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: step === 3 ? 'var(--brand-teal-light)' : '#fff', fontWeight: 700 }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: step === 3 ? 'var(--brand-teal)' : 'rgba(255,255,255,0.1)', color: step === 3 ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>3</span>
                  Bank Statement & Turnover
                </div>
              </div>
            )}

            {/* STEP 1: FACILITY REQUIREMENTS */}
            {step === 1 && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '1.25rem' }}>
                  1. Facility Details & Financing Requirement
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Requested Loan Amount (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      min="2000001"
                      placeholder="e.g. 50,000,000"
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Minimum: ₦2,000,001 &bull; Formatted: ₦{Number(formData.amount).toLocaleString()}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Proposed Tenor (Months)</label>
                    <select
                      className="form-select"
                      value={formData.tenor_months}
                      onChange={(e) => setFormData({ ...formData, tenor_months: Number(e.target.value) })}
                    >
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months (Standard PO / Contract)</option>
                      <option value={12}>12 Months (1 Year)</option>
                      <option value={18}>18 Months</option>
                      <option value={24}>24 Months (2 Years)</option>
                      <option value={36}>36 Months (Asset Lease)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Facility Classification</label>
                    <select
                      className="form-select"
                      value={formData.facility_type}
                      onChange={(e) => setFormData({ ...formData, facility_type: e.target.value })}
                    >
                      <option value="Working Capital">Working Capital Support</option>
                      <option value="Purchase Order Execution">Purchase Order / Contract Financing</option>
                      <option value="Asset Finance">Fleet & Heavy Machinery Acquisition</option>
                      <option value="Invoice Discounting">Invoice Discounting</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Borrower Type</label>
                    <select
                      className="form-select"
                      value={formData.applicant_type}
                      onChange={(e) => setFormData({ ...formData, applicant_type: e.target.value })}
                    >
                      <option value="SME">Sole Proprietorship / Enterprise (BN)</option>
                      <option value="CORPORATE">Limited Liability Company (RC)</option>
                      <option value="INDIVIDUAL">Professional / High-Net-Worth Individual</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Specific Purpose of Facility</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="e.g. Mobilization and execution of haulage transport contract awarded by P.A. Lawrence Nigeria Limited covering 5,000 trips"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  />
                </div>

                {/* Live Repayment Callout Card */}
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.75rem',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Estimated Monthly Installment</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)' }}>
                      ₦{calculations.monthlyInstallment.toLocaleString()} / mo
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Estimated Total Repayment</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                      ₦{calculations.totalRepayment.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Upfront Fees (Approx 4.5%)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                      ₦{calculations.upfrontFees.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={() => setStep(2)}
                    disabled={isBelowBoundary || !formData.amount}
                  >
                    Next: Business & Identity <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BUSINESS & IDENTITY CREDENTIALS */}
            {step === 2 && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '1.25rem' }}>
                  2. Business Profile & Promoter Identity (Youverify Verification)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Legal Name / Registered Business Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Leo-Akinboni Babatunde Global Enterprises"
                      value={formData.applicant_name}
                      onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">RC / Business Registration (BN) Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. BN 7049792"
                      value={formData.rc_number}
                      onChange={(e) => setFormData({ ...formData, rc_number: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bank Verification Number (BVN - 11 Digits)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2233307057"
                      maxLength={11}
                      value={formData.bvn}
                      onChange={(e) => setFormData({ ...formData, bvn: e.target.value })}
                      required
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--brand-teal-light)', marginTop: '0.2rem' }}>
                      ✓ Verified against NIBSS / Youverify API upon submission
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">National Identity Number (NIN)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 65858750946"
                      maxLength={11}
                      value={formData.nin}
                      onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Official Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. leobabatunde9@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Direct Telephone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="e.g. 08024799952"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                  <label className="form-label">Registered Business Operating Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. NNPC Filling Station Opposite Eleganzer company, Ide-orogbo, Ibeju Lekki, Lagos"
                    value={formData.business_address}
                    onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={() => setStep(3)}
                    disabled={!formData.applicant_name || !formData.email || !formData.bvn}
                  >
                    Next: Bank Statement & Inflows <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: FINANCIAL PROFILE & BANK STATEMENT UPLOAD */}
            {step === 3 && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '1.25rem' }}>
                  3. Cashflow Profile & Bank Statement Document Upload
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Average Monthly Business Inflow / Sales (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.monthly_income}
                      onChange={(e) => setFormData({ ...formData, monthly_income: Number(e.target.value) })}
                      placeholder="e.g. 142,222,475"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Existing Monthly Bank Loans / Overdrafts (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.existing_monthly_debt}
                      onChange={(e) => setFormData({ ...formData, existing_monthly_debt: Number(e.target.value) })}
                      placeholder="e.g. 1,000,000"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estimated Monthly Operating Costs (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.estimated_monthly_expenses}
                      onChange={(e) => setFormData({ ...formData, estimated_monthly_expenses: Number(e.target.value) })}
                      placeholder="e.g. 8,500,000"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estimated Value of Pledged Assets / Collateral (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.collateral_value}
                      onChange={(e) => setFormData({ ...formData, collateral_value: Number(e.target.value) })}
                      placeholder="e.g. 108,500,000"
                    />
                  </div>
                </div>

                {/* Document Dropzone */}
                <div style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <UploadCloud size={32} color="var(--brand-teal)" style={{ marginBottom: '0.5rem' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Attach Supporting Credit Documents</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Upload 6-month Bank Statement (PDF/CSV), Contract Award / Purchase Order, and CAC Registration documents.
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      + Bank Statement (PDF)
                      <input 
                        type="file" 
                        accept=".pdf,.csv,.xlsx" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleFileUpload(e, 'BANK_STATEMENT')} 
                      />
                    </label>

                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      + Contract / PO Document
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.png" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleFileUpload(e, 'CONTRACT_PO')} 
                      />
                    </label>

                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      + CAC Registration Document
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.png" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleFileUpload(e, 'CAC_REGISTRATION')} 
                      />
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {uploadedFiles.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.65rem 0.85rem',
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color="var(--brand-teal)" />
                            <span style={{ fontWeight: 600, color: '#fff' }}>{f.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({f.type} &bull; {f.size})</span>
                          </div>
                          <span className="status-pill pill-green" style={{ fontSize: '0.7rem' }}>Attached ✓</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                    ← Back
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? 'Submitting to Underwriting...' : 'Submit Commercial Application'} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUBMISSION SUCCESS & TRACKING RECEIPT */}
            {step === 4 && submissionSuccess && (
              <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem auto'
                }}>
                  <CheckCheck size={36} />
                </div>

                <span className="status-pill pill-green" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', marginBottom: '1rem', display: 'inline-flex' }}>
                  Application Successfully Logged
                </span>

                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                  Your Credit Application Has Been Queued
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
                  Thank you for applying to Opticom Finance Limited. Your application has been ingested into our underwriting pipeline and an assigned Credit Analyst is currently appraising your dossier.
                </p>

                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem 2rem',
                  display: 'inline-block',
                  marginBottom: '2rem'
                }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Official Application Reference Code
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                    {submissionSuccess.case_number}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    Save this reference code to track your underwriting progress online.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setTrackRef(submissionSuccess.case_number);
                      setActiveTab('TRACK');
                    }}
                  >
                    <Search size={15} /> Track Application Online
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setStep(1);
                      setSubmissionSuccess(null);
                    }}
                  >
                    Submit Another Facility
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTIVE LOAN CALCULATOR */}
        {activeTab === 'CALCULATOR' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
              Commercial Loan & Amortization Calculator
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.75rem' }}>
              Calculate estimated monthly repayments, upfront facility fees, and total debt service for facilities above ₦2,000,000.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Facility Amount</label>
                    <strong style={{ color: 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)' }}>₦{formData.amount.toLocaleString()}</strong>
                  </div>
                  <input
                    type="range"
                    min={2000000}
                    max={100000000}
                    step={1000000}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--brand-teal)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>₦2,000,000 (Min)</span>
                    <span>₦50,000,000</span>
                    <span>₦100,000,000 (Max)</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Tenor</label>
                    <strong style={{ color: '#fff' }}>{formData.tenor_months} Months</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                    {[3, 6, 12, 18, 24].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData({ ...formData, tenor_months: t })}
                        className={`btn btn-sm ${formData.tenor_months === t ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.78rem' }}
                      >
                        {t}M
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculator Output Display */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Estimated Monthly PMT</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0 1rem 0' }}>
                  ₦{calculations.monthlyInstallment.toLocaleString()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Principal Borrowed:</span>
                    <strong style={{ color: '#fff' }}>₦{formData.amount.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Interest Payable:</span>
                    <strong style={{ color: '#fff' }}>₦{calculations.totalInterest.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Upfront Processing & Legal (4.5%):</span>
                    <strong style={{ color: 'var(--accent-gold)' }}>₦{calculations.upfrontFees.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Facility Repayment:</span>
                    <strong style={{ color: 'var(--brand-teal-light)' }}>₦{calculations.totalRepayment.toLocaleString()}</strong>
                  </div>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: '1.5rem', width: '100%' }}
                  onClick={() => setActiveTab('APPLY')}
                >
                  Proceed to Apply for ₦{formData.amount.toLocaleString()} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRACK EXISTING APPLICATION STATUS */}
        {activeTab === 'TRACK' && (
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '750px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
              Track Application Status
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Enter your official OFL application reference code to view live appraisal milestones and offer issuance status.
            </p>

            <form onSubmit={handleTrackSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. OFL-2026-00003"
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={trackLoading} style={{ whiteSpace: 'nowrap' }}>
                <Search size={15} /> {trackLoading ? 'Searching...' : 'Track'}
              </button>
            </form>

            {trackError && (
              <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={18} />
                <span>{trackError}</span>
              </div>
            )}

            {trackResult && (
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)' }}>
                      {trackResult.case_number}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#fff', marginTop: '0.2rem' }}>
                      {trackResult.applicant_name}
                    </div>
                  </div>
                  <span className="status-pill pill-cyan" style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
                    {trackResult.status_label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Facility Amount:</span> <strong style={{ color: '#fff' }}>₦{trackResult.amount?.toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Tenor:</span> <strong style={{ color: '#fff' }}>{trackResult.tenor} Months</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Purpose:</span> {trackResult.purpose}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Submitted:</span> {new Date(trackResult.submitted_at).toLocaleDateString()}</div>
                </div>

                <div style={{
                  padding: '0.85rem 1rem',
                  background: 'rgba(0, 196, 159, 0.08)',
                  border: '1px solid rgba(0, 196, 159, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  color: 'var(--brand-teal-light)'
                }}>
                  {trackResult.message}
                </div>

                {/* Flowchart Branch 6: Applicant Correction Action Box */}
                {trackResult.applicant_action && (
                  <div style={{
                    marginTop: '1.25rem',
                    padding: '1.25rem',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <AlertTriangle size={18} /> Action Required by Applicant
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#fff', marginBottom: '0.75rem' }}>
                      <strong>Underwriter Request:</strong> {trackResult.applicant_action.instructions}
                    </div>

                    {trackResult.applicant_action.requested_documents?.length > 0 && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Documents to attach: </span>
                        <strong style={{ color: 'var(--brand-teal-light)' }}>
                          {trackResult.applicant_action.requested_documents.join(', ')}
                        </strong>
                      </div>
                    )}

                    {exceptionResponseMsg && (
                      <div className="flag-banner flag-SUCCESS" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
                        <CheckCheck size={16} /> <span>{exceptionResponseMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleRespondToException}>
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Your Clarification / Explanation *</label>
                        <textarea
                          className="form-textarea"
                          rows={3}
                          required
                          placeholder="e.g. Attached certified true copy with official director stamp as requested..."
                          value={applicantResponseNotes}
                          onChange={(e) => setApplicantResponseNotes(e.target.value)}
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', fontSize: '0.78rem' }}>
                          <UploadCloud size={14} /> Attach Replacement Document
                          <input
                            type="file"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setApplicantResponseFiles(prev => [...prev, { name: file.name, type: 'ADDITIONAL_EVIDENCE' }]);
                              }
                            }}
                          />
                        </label>
                        {applicantResponseFiles.map((f, i) => (
                          <span key={i} className="status-pill pill-blue" style={{ fontSize: '0.72rem' }}>
                            {f.name}
                          </span>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={respondingToException}
                      >
                        {respondingToException ? 'Submitting...' : 'Submit Clarification & Resume Underwriting'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem 1.5rem',
        borderTop: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontSize: '0.78rem'
      }}>
        <div>Opticom Finance Limited &bull; RC: 347832 &bull; Licensed by the Central Bank of Nigeria (CBN)</div>
        <div style={{ marginTop: '0.5rem' }}>
          Registered Office: No.2, Rev Yinka Akinsanya Street, Gbetu Ibeju Lekki, Lagos, Nigeria.
        </div>
      </footer>
    </div>
  );
};
