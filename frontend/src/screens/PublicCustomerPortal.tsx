import React, { useState, useMemo, useEffect } from 'react';
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
  CheckCheck,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  ChevronRight,
  ExternalLink,
  Copy,
  Trash2,
  User,
  Home,
  Camera,
  RefreshCw,
  FileSpreadsheet,
  CreditCard,
  Image as ImageIcon
} from 'lucide-react';
import { submitDirectApplication, trackApplication, respondToApplicantException, fetchPricingPolicy, resolveBVNIdentity, resolveRCNumber, PricingPolicy } from '../services/api';
import { FACILITY_CLASSIFICATIONS, getGuarantorRequirement, isRcNumberRequired } from '../utils/creditClassifications';

interface PublicCustomerPortalProps {
  onOpenStaffGate?: () => void;
  onGoToBesto?: () => void;
}

export const PublicCustomerPortal: React.FC<PublicCustomerPortalProps> = ({
  onOpenStaffGate,
  onGoToBesto
}) => {
  const [activeTab, setActiveTab] = useState<'APPLY' | 'CALCULATOR' | 'TRACK'>('APPLY');
  const [step, setStep] = useState<number>(1);
  const [copiedCode, setCopiedCode] = useState(false);

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
    residential_address: '',
    means_of_id_type: 'NATIONAL_ID',
    means_of_id_number: '',
    id_expiry_date: '',
    amount: 15000000,
    tenor_months: 12,
    purpose: '',
    facility_type: 'Working Capital',
    monthly_income: 8500000,
    existing_monthly_debt: 350000,
    estimated_monthly_expenses: 2500000,
    collateral_value: 25000000,
    collateral_description: '',
    guarantor_name: '',
    guarantor_email: '',
    guarantor_phone: '',
    guarantor_address: '',
    guarantor_occupation: '',
    guarantor_bvn: ''
  });

  // BVN Resolution State
  const [bvnResolving, setBvnResolving] = useState<boolean>(false);
  const [bvnResolutionFeedback, setBvnResolutionFeedback] = useState<{
    success: boolean;
    message: string;
    full_name?: string;
  } | null>(null);

  // CAC RC / BN Verification State
  const [rcResolving, setRcResolving] = useState<boolean>(false);
  const [rcResolutionFeedback, setRcResolutionFeedback] = useState<{
    success: boolean;
    message: string;
    company_name?: string;
    cac_status?: string;
  } | null>(null);

  const handleRcLookup = async (rcToResolve: string) => {
    const cleaned = (rcToResolve || '').trim();
    if (!cleaned || cleaned.length < 5) {
      setRcResolutionFeedback({ success: false, message: 'Enter at least 5 characters (e.g. BN 7049792 or RC 347832) to verify CAC registration.' });
      return;
    }
    setRcResolving(true);
    setRcResolutionFeedback(null);
    try {
      const res = await resolveRCNumber(cleaned);
      if (res.success) {
        setFormData(prev => ({
          ...prev,
          rc_number: res.rc_number || prev.rc_number,
          applicant_name: prev.applicant_name || res.company_name || prev.applicant_name,
          business_address: prev.business_address || res.business_address || prev.business_address
        }));
        setRcResolutionFeedback({
          success: true,
          message: res.message || `CAC Verified: ${res.company_name}`,
          company_name: res.company_name,
          cac_status: res.cac_status
        });
      }
    } catch (err: any) {
      setRcResolutionFeedback({
        success: false,
        message: err.detail || err.message || 'Unable to verify CAC registration number.'
      });
    } finally {
      setRcResolving(false);
    }
  };

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

  // Dynamic Interest Rate Policy (CBN MPR + Commercial Spread)
  const [pricingPolicy, setPricingPolicy] = useState<PricingPolicy>({
    cbn_mpr: 23.0,
    commercial_margin: 5.0,
    effective_apr: 28.0,
    upfront_fee_pct: 4.5
  });

  useEffect(() => {
    fetchPricingPolicy()
      .then((res) => {
        if (res && res.effective_apr) {
          setPricingPolicy(res);
        }
      })
      .catch(() => { });
  }, []);

  // Boundary logic
  const isBelowBoundary = formData.amount <= 2000000;

  // Live Loan Calculations
  const calculations = useMemo(() => {
    const P = Number(formData.amount) || 0;
    const n = Number(formData.tenor_months) || 12;
    const apr = Number(pricingPolicy.effective_apr) || 28.0;
    const r = (apr / 100) / 12; // Dynamic APR from Admin configuration
    let pmt = 0;
    if (P > 0 && n > 0) {
      const factor = Math.pow(1 + r, n);
      pmt = P * (r * factor) / (factor - 1);
    }
    const totalRepayment = pmt * n;
    const totalInterest = totalRepayment - P;
    const feeRate = (Number(pricingPolicy.upfront_fee_pct) || 4.5) / 100;
    const estimatedUpfrontFees = P * feeRate;

    return {
      monthlyInstallment: Math.round(pmt),
      totalRepayment: Math.round(totalRepayment),
      totalInterest: Math.round(totalInterest),
      upfrontFees: Math.round(estimatedUpfrontFees)
    };
  }, [formData.amount, formData.tenor_months, pricingPolicy]);

  const handleBvnLookup = async (bvnToResolve: string) => {
    const cleaned = bvnToResolve.trim();
    if (cleaned.length !== 11 || !/^\d+$/.test(cleaned)) {
      setBvnResolutionFeedback({
        success: false,
        message: 'BVN must be exactly 11 numeric digits.'
      });
      return;
    }

    setBvnResolving(true);
    setBvnResolutionFeedback(null);

    try {
      const res = await resolveBVNIdentity(cleaned);
      if (res && res.success) {
        setFormData(prev => ({
          ...prev,
          bvn: cleaned,
          applicant_name: res.applicant_name || res.full_name || prev.applicant_name,
          phone: res.phone || prev.phone,
          email: res.email || prev.email,
          nin: res.nin || prev.nin,
          rc_number: res.rc_number || prev.rc_number,
          business_address: res.business_address || prev.business_address,
          residential_address: res.residential_address || prev.residential_address,
          means_of_id_type: res.means_of_id_type || prev.means_of_id_type,
          means_of_id_number: res.means_of_id_number || prev.means_of_id_number,
        }));
        setBvnResolutionFeedback({
          success: true,
          message: res.message || `BVN Verified: ${res.full_name || res.applicant_name}`,
          full_name: res.full_name || res.applicant_name
        });
      }
    } catch (err: any) {
      setBvnResolutionFeedback({
        success: false,
        message: err.message || err.detail || 'BVN verification query could not be completed.'
      });
    } finally {
      setBvnResolving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFiles(prev => [
      ...prev.filter(f => fileType === 'OTHER_SUPPORTING' ? f.name !== file.name : f.type !== fileType),
      {
        name: file.name,
        type: fileType,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      }
    ]);
    e.target.value = '';
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
      if (err.detail && typeof err.detail === 'object' && err.detail.message) {
        setErrorMsg(err.detail.message);
      } else if (typeof err.detail === 'string') {
        setErrorMsg(err.detail);
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
      const msg = typeof err.detail === 'string' ? err.detail : (err.message || 'Application reference not found. Please check your reference code.');
      setTrackError(msg);
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
      const msg = typeof err.detail === 'string' ? err.detail : (err.message || 'Failed to submit response. Please try again.');
      setExceptionResponseMsg(msg);
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
      rc_number: 'BN 7049792',
      business_address: 'NNPC Filling Station, Ide-orogbo, Ibeju Lekki, Lagos State',
      residential_address: 'Plot 14, Admiralty Way, Lekki Phase 1, Lagos State',
      means_of_id_type: 'NATIONAL_ID',
      means_of_id_number: 'NIN-65858750946',
      id_expiry_date: '2030-12-31',
      amount: 50000000,
      tenor_months: 6,
      purpose: 'Purchase Order Execution for P.A. Lawrence Nigeria Limited covering 5,000 trips haulage',
      facility_type: 'Purchase Order Execution',
      monthly_income: 142222475,
      existing_monthly_debt: 1000000,
      estimated_monthly_expenses: 8593600,
      collateral_value: 108500000,
      collateral_description: '10 Units of 30-Ton Sino Haulage Trucks (Comprehensive Insured) & Registered Legal Mortgage on Commercial Yard at Ibeju Lekki',
      guarantor_name: 'Chief Olusegun Adewale Martins',
      guarantor_email: 'segmartins@guarantorcorp.ng',
      guarantor_phone: '08039876543',
      guarantor_address: '24 Glover Road, Old Ikoyi, Lagos State',
      guarantor_occupation: 'Managing Partner, Horizon Logistics Limited',
      guarantor_bvn: '22112233445'
    });
    setBvnResolutionFeedback({
      success: true,
      message: 'NIBSS BVN successfully verified for Babatunde Leo-Akinboni. Identity & address details auto-populated.',
      full_name: 'Babatunde Leo-Akinboni'
    });
    setUploadedFiles([
      { name: 'UBA_Haulage_Account_Statement_6M.pdf', type: 'BANK_STATEMENT', size: '2.45 MB' },
      { name: 'National_Identity_Card_NIMC_Babatunde.pdf', type: 'MEANS_OF_ID', size: '1.12 MB' },
      { name: 'EKEDC_Electricity_Utility_Bill_Aug2026.pdf', type: 'UTILITY_BILL', size: '0.68 MB' },
      { name: 'Passport_Photograph_White_Background.jpg', type: 'PASSPORT_PHOTO', size: '0.45 MB' },
      { name: 'Director_Work_ID_Badge.pdf', type: 'WORK_ID', size: '0.52 MB' },
      { name: 'CAC_Certificate_Registration_BN7049792.pdf', type: 'CAC_REGISTRATION', size: '0.85 MB' },
      { name: 'Collateral_Title_Deed_Vehicle_Customs_Papers.pdf', type: 'COLLATERAL_DOCUMENT', size: '3.20 MB' },
      { name: 'PA_Lawrence_Contract_Award_5000Trips.pdf', type: 'CONTRACT_PO', size: '1.18 MB' },
      { name: 'Tax_Clearance_Certificate_2025.pdf', type: 'OTHER_SUPPORTING', size: '0.95 MB' }
    ]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Ambient Lighting Orbs */}
      <div style={{
        position: 'fixed',
        top: '-10%',
        left: '20%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 150, 204, 0.05) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed',
        bottom: '10%',
        right: '10%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 150, 204, 0.04) 0%, transparent 70%)',
        filter: 'blur(70px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Top Customer Brand Navbar */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2.5rem',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px',
            background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.15), rgba(0, 150, 204, 0.05))',
            borderRadius: '10px',
            border: '1px solid rgba(0, 150, 204, 0.25)',
            boxShadow: '0 2px 8px rgba(0, 150, 204, 0.12)'
          }}>
            <img
              src="/opticom_logo.jpg"
              alt="Opticom Finance Limited"
              style={{ height: '40px', borderRadius: '8px', background: '#fff', padding: '2px 6px', display: 'block' }}
            />
          </div>
          <div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              color: 'var(--brand-cerulean)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              OPTICOM FINANCE LIMITED
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em' }}>
              COMMERCIAL CREDIT & STRUCTURED FINANCE &bull; &gt; ₦2,000,000
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            className={`btn btn-sm ${activeTab === 'APPLY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('APPLY')}
          >
            <Zap size={14} /> Apply for Loan
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'CALCULATOR' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('CALCULATOR')}
          >
            <Calculator size={14} /> Live Calculator
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'TRACK' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('TRACK')}
          >
            <Search size={14} /> Track Status
          </button>

          <a
            href="tel:+2348161813538"
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.8rem',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <PhoneCall size={14} color="var(--brand-cerulean)" /> Helpline: 0816 181 3538
          </a>
        </div>
      </nav>

      {/* ================================================================= */}
      {/* FULL-WIDTH STRETCHED HERO BANNER (2 MEN COMMERCIAL TRANSACTION)  */}
      {/* ================================================================= */}
      <section style={{
        position: 'relative',
        width: '100%',
        minHeight: '480px',
        overflow: 'hidden',
        background: '#041326',
        borderBottom: '1px solid rgba(0, 150, 204, 0.25)'
      }}>
        {/* Colorful High-Resolution Transaction Image (Stretched Edge-to-Edge) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/hero_transaction.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 28%',
          filter: 'saturate(1.22) contrast(1.08) brightness(0.96)',
          transform: 'scale(1.01)',
          zIndex: 0
        }} />

        {/* Dynamic Dual-Tone Cerulean & Deep Space Gradient Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, rgba(4, 19, 38, 0.94) 0%, rgba(4, 19, 38, 0.82) 42%, rgba(0, 150, 204, 0.42) 75%, rgba(4, 19, 38, 0.18) 100%)',
          zIndex: 1
        }} />

        {/* Ambient Warm Golden & Cerulean Glow Accents */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '5%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 1
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-15%',
          left: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 150, 204, 0.25) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        {/* Hero Content Grid Aligned With Page */}
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '4rem 2rem 3rem 2rem',
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'center',
          gap: '2.5rem'
        }}>
          {/* Left Hero Pitch */}
          <div style={{ maxWidth: '640px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 1rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(0, 150, 204, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              backdropFilter: 'blur(8px)',
              marginBottom: '1.25rem'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#e0f2fe', letterSpacing: '0.08em' }}>
                CBN LICENSED FINANCE HOUSE &bull; RC: 347832 &bull; COMMERCIAL CREDIT
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.2rem, 4.2vw, 3.4rem)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              lineHeight: 1.14,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              marginBottom: '1.15rem',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.35)'
            }}>
              Commercial Credit &amp; Structured Debt Financing
            </h1>

            <p style={{
              color: '#cbd5e1',
              fontSize: '1.08rem',
              lineHeight: 1.6,
              marginBottom: '2rem',
              maxWidth: '560px',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
            }}>
              Empowering Nigerian enterprise with tailored commercial facilities from{' '}
              <strong style={{ color: '#38bdf8', fontWeight: 700 }}>₦2,000,000 to ₦200,000,000</strong>.
              Fast working capital, contract finance, rapid financial assessment, and 48-hour term sheet execution.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setActiveTab('APPLY')}
                style={{
                  fontSize: '0.96rem',
                  padding: '0.85rem 1.75rem',
                  boxShadow: '0 4px 18px rgba(0, 150, 204, 0.45)'
                }}
              >
                <Zap size={16} /> Apply for Facility
              </button>
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => setActiveTab('CALCULATOR')}
                style={{
                  fontSize: '0.96rem',
                  padding: '0.85rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <Calculator size={16} /> Live Sizer &amp; Calculator
              </button>
            </div>
          </div>

          {/* Right Floating Deal Card with Vibrant Lighting */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              background: 'rgba(6, 20, 38, 0.72)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              backdropFilter: 'blur(16px)',
              borderRadius: '16px',
              padding: '1.75rem 2rem',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 25px rgba(0, 150, 204, 0.25)',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Live Commercial Transaction
                </span>
                <span className="status-pill pill-emerald" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                  ACTIVE DEAL
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                ₦50,000,000
              </div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '1.25rem' }}>
                Commercial Haulage &amp; Supply Fleet Facility
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '1rem',
                fontSize: '0.78rem'
              }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>Approval SLA:</span>
                  <strong style={{ color: '#ffffff' }}>48 Hours</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>Pricing APR:</span>
                  <strong style={{ color: '#38bdf8' }}>{pricingPolicy.effective_apr}% Per Annum</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>Settlement:</span>
                  <strong style={{ color: '#10b981' }}>Automated Core Banking</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>KYC Clearance:</span>
                  <strong style={{ color: '#38bdf8' }}>NIBSS BVN ✓</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Stretched Metrics Band */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          background: 'rgba(3, 15, 30, 0.88)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          padding: '1.35rem 2rem'
        }}>
          <div style={{
            maxWidth: '1240px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.07em' }}>
                Disbursed Volume
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                ₦4.8 Billion+
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Corporate &amp; Commercial Facilities
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.07em' }}>
                Decision Turnaround
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                &le; 48 Hours
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Credit Committee Approval SLA
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.07em' }}>
                Underwriting Precision
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                99.4%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Structured Credit Appraisal
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.07em' }}>
                Facility Capability
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                ₦2M – ₦200M
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Working Capital &amp; Asset Finance
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '2.5rem 1.5rem', position: 'relative', zIndex: 1 }}>

        {/* ================================================================= */}
        {/* TAB 1: APPLY FOR LOAN */}
        {/* ================================================================= */}
        {activeTab === 'APPLY' && (
          <div>

            {/* Canonical Boundary Notice if <= ₦2,000,000 */}
            {isBelowBoundary && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-lg)',
                padding: '1.35rem 1.6rem',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#92400e',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <AlertTriangle size={32} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-display)' }}>
                      Channel Routing Notice: Facilities &le; ₦2,000,000
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#b45309', marginTop: '0.25rem' }}>
                      Retail requests between ₦300,000 and ₦2,000,000 are ingested via the <strong>BESTO Retail Credit Platform</strong>. The OFL Direct gateway services commercial tickets above ₦2,000,000.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  onClick={() => setFormData(prev => ({ ...prev, amount: 2500000 }))}
                >
                  Adjust to ₦2,500,000 Commercial Tier <ArrowRight size={14} />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1.75rem' }}>
                <AlertTriangle size={20} />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Stepper Navigation */}
            {step < 4 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '2.25rem',
                position: 'relative',
                padding: '0 1rem'
              }}>
                {/* Connecting Line */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '10%',
                  right: '10%',
                  height: '2px',
                  background: '#e2e8f0',
                  zIndex: 0
                }}>
                  <div style={{
                    width: step === 1 ? '0%' : step === 2 ? '50%' : '100%',
                    height: '100%',
                    background: '#0096cc',
                    boxShadow: '0 0 8px rgba(0, 150, 204, 0.3)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  position: 'relative',
                  zIndex: 1,
                  cursor: 'pointer'
                }} onClick={() => setStep(1)}>
                  <span style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: step === 1 ? '#0096cc' : step > 1 ? 'rgba(0, 150, 204, 0.12)' : '#f8fafc',
                    color: step === 1 ? '#ffffff' : step > 1 ? '#0096cc' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: `2px solid ${step >= 1 ? '#0096cc' : '#cbd5e1'}`,
                    boxShadow: step === 1 ? '0 0 10px rgba(0, 150, 204, 0.25)' : 'none'
                  }}>
                    {step > 1 ? '✓' : '1'}
                  </span>
                  <span style={{
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: step === 1 ? 700 : 500,
                    color: step === 1 ? '#0096cc' : '#64748b'
                  }}>
                    Facility Architecture
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  position: 'relative',
                  zIndex: 1,
                  cursor: 'pointer'
                }} onClick={() => step > 2 ? setStep(2) : null}>
                  <span style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: step === 2 ? '#0096cc' : step > 2 ? 'rgba(0, 150, 204, 0.12)' : '#f8fafc',
                    color: step === 2 ? '#ffffff' : step > 2 ? '#0096cc' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: `2px solid ${step >= 2 ? '#0096cc' : '#cbd5e1'}`,
                    boxShadow: step === 2 ? '0 0 10px rgba(0, 150, 204, 0.25)' : 'none'
                  }}>
                    {step > 2 ? '✓' : '2'}
                  </span>
                  <span style={{
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: step === 2 ? 700 : 500,
                    color: step === 2 ? '#0096cc' : '#64748b'
                  }}>
                    Corporate &amp; Identity
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <span style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: step === 3 ? '#0096cc' : '#f8fafc',
                    color: step === 3 ? '#ffffff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: `2px solid ${step === 3 ? '#0096cc' : '#cbd5e1'}`,
                    boxShadow: step === 3 ? '0 0 10px rgba(0, 150, 204, 0.25)' : 'none'
                  }}>
                    3
                  </span>
                  <span style={{
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: step === 3 ? 700 : 500,
                    color: step === 3 ? '#0096cc' : '#64748b'
                  }}>
                    Cashflow &amp; Documents
                  </span>
                </div>
              </div>
            )}

            {/* STEP 1: FACILITY REQUIREMENTS */}
            {step === 1 && (
              <div className="glass-panel cyber-top-edge" style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-highlight)' }}>
                      1. Facility Parameters &amp; Capital Requirement
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Specify the facility quantum, tenor structure, and commercial purpose. All fields marked (<span style={{ color: '#ef4444' }}>*</span>) are compulsory.
                    </p>
                  </div>
                  <span className="status-pill pill-cyan">Step 1 of 3</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      <DollarSign size={14} color="var(--brand-cyan)" /> Requested Facility Amount (₦) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      min="2000001"
                      placeholder="e.g. 50,000,000"
                      required
                      style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Min: ₦2,000,001 (Commercial Direct Portal)</span>
                      <span style={{ color: 'var(--brand-cyan)', fontWeight: 600 }}>₦{Number(formData.amount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Clock size={14} color="var(--brand-cyan)" /> Proposed Tenor (Months) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.tenor_months}
                      onChange={(e) => setFormData({ ...formData, tenor_months: Number(e.target.value) })}
                      style={{ fontSize: '0.95rem' }}
                      required
                    >
                      <option value={3}>3 Months (Short Term Bridge)</option>
                      <option value={6}>6 Months (Standard Purchase Order / Contract Execution)</option>
                      <option value={12}>12 Months (Annual Working Capital Facility)</option>
                      <option value={18}>18 Months (Extended Medium Term)</option>
                      <option value={24}>24 Months (Capital Equipment / Fleet)</option>
                      <option value={36}>36 Months (Specialized Project Finance)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Layers size={14} color="var(--brand-cyan)" /> Facility Classification <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.facility_type}
                      onChange={(e) => {
                        const nextFacility = e.target.value;
                        const isConsumerOrSalary =
                          nextFacility === 'Salary Loan / Payroll Advance' ||
                          nextFacility === 'Personal / Consumer Term Loan';
                        setFormData(prev => ({
                          ...prev,
                          facility_type: nextFacility,
                          applicant_type: isConsumerOrSalary ? 'INDIVIDUAL' : prev.applicant_type
                        }));
                      }}
                      required
                    >
                      {FACILITY_CLASSIFICATIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Building2 size={14} color="var(--brand-cyan)" /> Borrower Entity Structure <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.applicant_type}
                      onChange={(e) => setFormData({ ...formData, applicant_type: e.target.value })}
                      required
                    >
                      <option value="SME">Sole Proprietorship / Registered Enterprise (BN)</option>
                      <option value="CORPORATE">Limited Liability Company (RC)</option>
                      <option value="INDIVIDUAL">Salaried Employee / Individual / HNWI</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                  <label className="form-label">Specific Purpose of Facility <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="e.g. Mobilization and haulage logistics for contract awarded by P.A. Lawrence Nigeria Limited covering 5,000 trips"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    required
                  />
                </div>

                {/* Live Repayment Callout Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #f0f9ff 100%)',
                  padding: '1.5rem 1.75rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid #bae6fd',
                  boxShadow: '0 2px 8px rgba(0, 150, 204, 0.06)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em' }}>
                      Estimated Monthly Installment
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0096cc', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                      ₦{calculations.monthlyInstallment.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Principal + Interest ({pricingPolicy.effective_apr}% APR)
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em' }}>
                      Total Repayment Over Tenor
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                      ₦{calculations.totalRepayment.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Total interest: ₦{calculations.totalInterest.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em' }}>
                      Upfront Fees (Approx {pricingPolicy.upfront_fee_pct}%)
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                      ₦{calculations.upfrontFees.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Management, Facility &amp; Legal
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={() => setStep(2)}
                    disabled={isBelowBoundary || !formData.amount || !formData.purpose.trim()}
                  >
                    Proceed to Business &amp; Identity <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BUSINESS & IDENTITY CREDENTIALS */}
            {step === 2 && (
              <div className="glass-panel cyber-top-edge" style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-highlight)' }}>
                      2. Business Entity &amp; Promoter Identity
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Corporate registry verification and automated NIBSS BVN identity screening. All address and identity fields are compulsory (<span style={{ color: '#ef4444' }}>*</span>).
                    </p>
                  </div>
                  <span className="status-pill pill-cyan">Step 2 of 3</span>
                </div>

                {/* Automated NIBSS BVN Auto-Fill Banner & Input */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.08) 0%, rgba(248, 250, 252, 0.95) 100%)',
                  border: '1px solid rgba(0, 150, 204, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  marginBottom: '1.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: 'var(--brand-cerulean)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={18} /> Bank Verification Number (BVN - 11 Digits) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Automated NIBSS / Youverify Resolution</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter 11-digit BVN (e.g. 2233307057)"
                      maxLength={11}
                      value={formData.bvn}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                        setFormData(prev => ({ ...prev, bvn: val }));
                        if (val.length === 11) {
                          handleBvnLookup(val);
                        } else {
                          setBvnResolutionFeedback(null);
                        }
                      }}
                      required
                      style={{
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.1em',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        flex: 1
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleBvnLookup(formData.bvn)}
                      disabled={bvnResolving || formData.bvn.length !== 11}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '0.65rem 1.25rem' }}
                    >
                      <RefreshCw size={15} className={bvnResolving ? 'spin' : ''} />
                      {bvnResolving ? 'Resolving NIBSS...' : 'Auto-Fill Details'}
                    </button>
                  </div>

                  {bvnResolutionFeedback && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: bvnResolutionFeedback.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: bvnResolutionFeedback.success ? '#059669' : '#dc2626',
                      border: `1px solid ${bvnResolutionFeedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {bvnResolutionFeedback.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      <span style={{ fontWeight: 600 }}>{bvnResolutionFeedback.message}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Legal Name / Registered Business Name <span style={{ color: '#ef4444' }}>*</span></label>
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
                    <label className="form-label">
                      {isRcNumberRequired(formData.applicant_type, formData.facility_type) ? (
                        <>RC / Business Registration (BN) Number <span style={{ color: '#ef4444' }}>*</span></>
                      ) : (
                        <>Employer CAC RC / BN Number <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(Optional for Salaried / Individual)</span></>
                      )}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. BN 7049792 or RC 347832"
                        value={formData.rc_number}
                        onChange={(e) => {
                          setFormData({ ...formData, rc_number: e.target.value });
                          if (rcResolutionFeedback) setRcResolutionFeedback(null);
                        }}
                        required={isRcNumberRequired(formData.applicant_type, formData.facility_type)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleRcLookup(formData.rc_number)}
                        disabled={rcResolving || !formData.rc_number.trim()}
                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.9rem' }}
                      >
                        <RefreshCw size={13} className={rcResolving ? 'spin' : ''} />
                        {rcResolving ? 'Verifying...' : 'Verify CAC'}
                      </button>
                    </div>
                    {rcResolutionFeedback && (
                      <div style={{
                        marginTop: '0.4rem',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: rcResolutionFeedback.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: rcResolutionFeedback.success ? '#059669' : '#dc2626',
                        border: `1px solid ${rcResolutionFeedback.success ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                      }}>
                        {rcResolutionFeedback.success ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        <span>{rcResolutionFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">National Identity Number (NIN - 11 Digits) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 65858750946"
                      maxLength={11}
                      value={formData.nin}
                      onChange={(e) => setFormData({ ...formData, nin: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Means of Identification <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className="form-select"
                      value={formData.means_of_id_type}
                      onChange={(e) => setFormData({ ...formData, means_of_id_type: e.target.value })}
                      required
                    >
                      <option value="NATIONAL_ID">National ID Card (NIMC) - Valid</option>
                      <option value="NIN_SLIP">Digital NIN Slip (NIMC) - Valid</option>
                      <option value="VOTERS_CARD">Permanent Voter's Card (INEC PVC) - Valid</option>
                      <option value="PASSPORT">International Passport (Immigration) - Valid</option>
                      <option value="DRIVERS_LICENSE">Driver's License (FRSC) - Valid</option>
                    </select>
                    <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '0.2rem', fontWeight: 600 }}>
                      ✓ Must be valid and unexpired government-issued identification.
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Identification Document / Card Number <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. NIN-65858750946, FRSC-LA782910, A10849273"
                      value={formData.means_of_id_number}
                      onChange={(e) => setFormData({ ...formData, means_of_id_number: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Official Corporate Email Address <span style={{ color: '#ef4444' }}>*</span></label>
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
                    <label className="form-label">Direct Telephone Number <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="e.g. 08024799952"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">ID Validity &amp; Verification Status <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      value="Verified Active &amp; Valid Means of ID"
                      disabled
                      style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#059669', fontWeight: 600 }}
                    />
                  </div>
                </div>

                {/* Mandatory Address Fields Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      <Building2 size={13} color="var(--brand-cerulean)" />{' '}
                      {formData.applicant_type === 'INDIVIDUAL'
                        ? 'Employer / Primary Place of Work Address'
                        : 'Registered Operating Business Address'}{' '}
                      <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={
                        formData.applicant_type === 'INDIVIDUAL'
                          ? 'e.g. 14 Marina Street, Lagos Island, Lagos State'
                          : 'e.g. NNPC Filling Station, Ide-orogbo, Ibeju Lekki, Lagos State'
                      }
                      value={formData.business_address}
                      onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                      required
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {formData.applicant_type === 'INDIVIDUAL'
                        ? 'Physical office or workplace address of the loan applicant.'
                        : 'Physical commercial premises where the borrowing business operates.'}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Home size={13} color="var(--brand-cerulean)" />{' '}
                      {formData.applicant_type === 'INDIVIDUAL'
                        ? 'Applicant Residential Home Address'
                        : 'Loan Applicant / Principal Promoter (MD) Residential Address'}{' '}
                      <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Plot 14, Admiralty Way, Lekki Phase 1, Lagos State"
                      value={formData.residential_address}
                      onChange={(e) => setFormData({ ...formData, residential_address: e.target.value })}
                      required
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {formData.applicant_type === 'INDIVIDUAL'
                        ? 'Home domicile of the individual applicant (distinct from Guarantor below).'
                        : 'Home domicile of the Business Owner / Managing Director taking the loan (NOT the third-party Guarantor).'}
                    </div>
                  </div>
                </div>

                {/* Mandatory Classification-Aware Guarantor & Contact Details */}
                {(() => {
                  const gSpec = getGuarantorRequirement(formData.facility_type, formData.applicant_type);
                  return (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
                      border: '1px solid rgba(14, 165, 233, 0.25)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      marginBottom: '2rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-highlight)' }}>
                            <ShieldCheck size={18} color="var(--brand-cerulean)" />
                            <span>{gSpec.title}</span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                            {gSpec.subtitle}
                          </p>
                        </div>
                        <span className="status-pill pill-cyan" style={{ whiteSpace: 'nowrap' }}>
                          Compulsory Surety
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="form-group">
                          <label className="form-label">Guarantor Full Legal Name <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Chief Olusegun Adewale Martins"
                            value={formData.guarantor_name}
                            onChange={(e) => setFormData({ ...formData, guarantor_name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Guarantor Direct Telephone Number <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="tel"
                            className="form-input"
                            placeholder="e.g. 08039876543"
                            value={formData.guarantor_phone}
                            onChange={(e) => setFormData({ ...formData, guarantor_phone: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Guarantor Official Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="email"
                            className="form-input"
                            placeholder="e.g. segmartins@guarantorcorp.ng"
                            value={formData.guarantor_email}
                            onChange={(e) => setFormData({ ...formData, guarantor_email: e.target.value })}
                            required
                          />
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', marginTop: '0.2rem', fontWeight: 600 }}>
                            Letter of Guarantee (Guarantor Deed) is emailed here upon final approval.
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">{gSpec.occupationLabel.replace(' *', '')} <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={gSpec.occupationPlaceholder}
                            value={formData.guarantor_occupation}
                            onChange={(e) => setFormData({ ...formData, guarantor_occupation: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">{gSpec.addressLabel.replace(' *', '')} <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. 24 Glover Road, Old Ikoyi, Lagos State"
                            value={formData.guarantor_address}
                            onChange={(e) => setFormData({ ...formData, guarantor_address: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Guarantor BVN <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(Optional / Recommended)</span></label>
                          <input
                            type="text"
                            className="form-input"
                            maxLength={11}
                            placeholder="11-digit Guarantor BVN"
                            value={formData.guarantor_bvn}
                            onChange={(e) => setFormData({ ...formData, guarantor_bvn: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                    ← Back to Facility Architecture
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={() => setStep(3)}
                    disabled={
                      !formData.applicant_name ||
                      !formData.email ||
                      !formData.bvn ||
                      !formData.phone ||
                      !formData.nin ||
                      !formData.means_of_id_number ||
                      !formData.business_address ||
                      !formData.residential_address ||
                      (isRcNumberRequired(formData.applicant_type, formData.facility_type) && !formData.rc_number.trim()) ||
                      !formData.guarantor_name.trim() ||
                      !formData.guarantor_phone.trim() ||
                      !formData.guarantor_email.trim() ||
                      !formData.guarantor_occupation.trim() ||
                      !formData.guarantor_address.trim()
                    }
                  >
                    Proceed to Cashflow &amp; Documents <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: FINANCIAL PROFILE & COMPREHENSIVE DOCUMENT MANIFEST */}
            {step === 3 && (
              <div className="glass-panel cyber-top-edge" style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-highlight)' }}>
                      3. Cashflow Profile &amp; Document Manifest
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Provide turnover estimates and attach supporting credit appraisal documents. All fields marked (<span style={{ color: '#ef4444' }}>*</span>) are compulsory.
                    </p>
                  </div>
                  <span className="status-pill pill-cyan">Step 3 of 3</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Average Monthly Inflow / Turnover (₦) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.monthly_income}
                      onChange={(e) => setFormData({ ...formData, monthly_income: Number(e.target.value) })}
                      placeholder="e.g. 142,222,475"
                      required
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Existing Monthly Debt Service / Loans (₦) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.existing_monthly_debt}
                      onChange={(e) => setFormData({ ...formData, existing_monthly_debt: Number(e.target.value) })}
                      placeholder="e.g. 1,000,000"
                      required
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estimated Monthly Operating Expenses (₦) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.estimated_monthly_expenses}
                      onChange={(e) => setFormData({ ...formData, estimated_monthly_expenses: Number(e.target.value) })}
                      placeholder="e.g. 8,500,000"
                      required
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estimated Value of Collateral / Pledged Assets (₦) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.collateral_value}
                      onChange={(e) => setFormData({ ...formData, collateral_value: Number(e.target.value) })}
                      placeholder="e.g. 108,500,000"
                      required
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                  <label className="form-label">Pledged Collateral Description &amp; Backing Asset Particulars <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="e.g. 10 Units of 30-Ton Haulage Trucks (Comprehensive Insured, Opticom as First Loss Payee) & Registered Legal Mortgage on Commercial Yard at Ibeju Lekki"
                    value={formData.collateral_description}
                    onChange={(e) => setFormData({ ...formData, collateral_description: e.target.value })}
                    required
                  />
                </div>

                {/* Mandatory Documentation Standards Box */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.05) 0%, rgba(248, 250, 252, 0.9) 100%)',
                  border: '1px solid rgba(0, 150, 204, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem 1.35rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
                    <ShieldCheck size={18} color="var(--brand-cerulean)" />
                    <strong style={{ color: 'var(--text-highlight)', fontSize: '0.88rem' }}>Mandatory Document Standards &amp; List of Essentials:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '22px', lineHeight: 1.5, fontSize: '0.78rem' }}>
                    <li><strong>Valid Means of Identification:</strong> Must be a valid, unexpired National ID card, Digital NIN slip, Permanent Voter's Card (PVC), International Passport, or Driver's License.</li>
                    <li><strong>Utility Bill:</strong> A valid utility bill (PHCN/EKEDC electricity, water, or waste) dated <em>within the last 3 to 6 months (not older than 6 months)</em>.</li>
                    <li><strong>Work ID &amp; Passport Photo:</strong> Valid employee/enterprise identity card and a clear, recent white-background passport photograph.</li>
                    <li><strong>Bank Statements &amp; CAC:</strong> 6-month continuous bank statement (PDF/CSV) and official CAC Incorporation proofs (Certificate, Status Report, MemArt).</li>
                    <li><strong>Collateral Backing Documents:</strong> Clear documentation proving asset title, ownership, vehicle registration, and valuation for pledged collateral.</li>
                  </ul>
                </div>

                {/* High-Tech Document Dropzone & Category Uploaders */}
                <div style={{
                  border: '2px dashed rgba(0, 150, 204, 0.4)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem 1.75rem',
                  background: 'rgba(0, 150, 204, 0.02)',
                  marginBottom: '2rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(0, 150, 204, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem auto',
                    boxShadow: '0 2px 10px rgba(0, 150, 204, 0.15)'
                  }}>
                    <UploadCloud size={28} color="var(--brand-cerulean)" />
                  </div>

                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-highlight)', fontFamily: 'var(--font-display)', margin: '0 0 0.25rem 0' }}>
                    Attach Required Credit Documentation
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 1.5rem auto' }}>
                    Click the buttons below to upload each essential document. Formats accepted: PDF, CSV, Excel, JPEG, PNG (Max 15MB/file).
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', textAlign: 'left' }}>
                    {/* 1. Bank Statement */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontWeight: 700, color: 'var(--brand-cerulean)', fontSize: '0.82rem' }}>+ 6-Month Bank Statement *</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PDF / CSV / Excel turnover files</div>
                      <input type="file" accept=".pdf,.csv,.xlsx" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'BANK_STATEMENT')} />
                    </label>

                    {/* 2. Means of ID */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontWeight: 700, color: 'var(--brand-cerulean)', fontSize: '0.82rem' }}>+ Valid Means of ID *</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>National ID, NIN, Voter's, Passport, Driver's</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'MEANS_OF_ID')} />
                    </label>

                    {/* 3. Utility Bill */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontWeight: 700, color: 'var(--brand-cerulean)', fontSize: '0.82rem' }}>+ Utility Bill (≤ 6 Months) *</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PHCN / EKEDC / Water Bill (3-6 mo)</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'UTILITY_BILL')} />
                    </label>

                    {/* 4. Passport Photo */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontWeight: 700, color: 'var(--brand-cerulean)', fontSize: '0.82rem' }}>+ Passport Photograph *</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recent white-background portrait</div>
                      <input type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'PASSPORT_PHOTO')} />
                    </label>

                    {/* 5. Work ID */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>+ Valid Work ID</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Staff identification or employer badge</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'WORK_ID')} />
                    </label>

                    {/* 6. CAC Registration */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>+ CAC Registration Proof</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Certificate of Inc., Status Report, MemArt</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'CAC_REGISTRATION')} />
                    </label>

                    {/* 7. Collateral Documents */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #fecaca' }}>
                      <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.82rem' }}>+ Collateral Documents *</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Title Deed, C of O, Valuation, Car Reg</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'COLLATERAL_DOCUMENT')} />
                    </label>

                    {/* 8. Contract / PO Award */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>+ Contract / PO Award</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Award letter or verified purchase order</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'CONTRACT_PO')} />
                    </label>

                    {/* 9. Upload Other Supporting Documents */}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'rgba(0, 150, 204, 0.08)', border: '1px solid rgba(0, 150, 204, 0.45)' }}>
                      <div style={{ fontWeight: 700, color: '#0096cc', fontSize: '0.82rem' }}>+ Upload Other Supporting Documents</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tax clearance, board resolution, invoices</div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'OTHER_SUPPORTING')} />
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {uploadedFiles.map((f, i) => {
                        const typeLabel =
                          f.type === 'BANK_STATEMENT' ? '6-Month Bank Statement' :
                            f.type === 'MEANS_OF_ID' ? 'Valid Means of ID (Passport/National ID/Voter/Driver)' :
                              f.type === 'UTILITY_BILL' ? 'Utility Bill (Dated ≤ 6 Months)' :
                                f.type === 'PASSPORT_PHOTO' ? 'Passport Photograph' :
                                  f.type === 'WORK_ID' ? 'Valid Work Identification' :
                                    f.type === 'CAC_REGISTRATION' ? 'CAC Registration Proof' :
                                      f.type === 'COLLATERAL_DOCUMENT' ? 'Collateral Backing Evidence' :
                                        f.type === 'CONTRACT_PO' ? 'Contract / PO Award' :
                                          'Other Supporting Evidence';
                        return (
                          <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem 1.15rem',
                            background: '#ffffff',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.85rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <FileText size={18} color="var(--brand-cerulean)" />
                              <div style={{ textAlign: 'left' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-highlight)' }}>{f.name}</span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--brand-cerulean)', fontWeight: 600 }}>{typeLabel} &bull; {f.size}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <span className="status-pill pill-emerald" style={{ fontSize: '0.72rem' }}>Attached ✓</span>
                              <button
                                type="button"
                                onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                                title="Remove file"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                    ← Back to Entity Profile
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleSubmit}
                    disabled={loading || uploadedFiles.length === 0}
                  >
                    {loading ? (
                      <>
                        <Cpu size={18} className="pulse" /> Ingesting to Underwriting Engine...
                      </>
                    ) : (
                      <>
                        Transmit Application for Appraisal <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUBMISSION SUCCESS & TRACKING RECEIPT */}
            {step === 4 && submissionSuccess && (
              <div className="glass-panel cyber-top-edge" style={{ padding: '3.5rem 2.5rem', textAlign: 'center' }}>
                <div style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)'
                }}>
                  <CheckCheck size={42} />
                </div>

                <span className="status-pill pill-green" style={{ fontSize: '0.85rem', padding: '0.4rem 1.2rem', marginBottom: '1.25rem', display: 'inline-flex' }}>
                  APPLICATION SUCCESSFULLY QUEUED &bull; ENGINE ACCEPTED
                </span>

                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-highlight)', marginBottom: '0.75rem', fontFamily: 'var(--font-display)' }}>
                  Credit Dossier Ingested Into Underwriting Pipeline
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
                  Thank you for submitting to Opticom Finance Limited. Your application has been logged into the automated risk appraisal queue and an assigned Underwriter is appraising your dossier.
                </p>

                {/* Reference Code Card */}
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid rgba(0, 150, 204, 0.45)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '1.75rem 2.5rem',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginBottom: '2.5rem',
                  boxShadow: 'var(--shadow-md)'
                }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    Official OFL Application Reference Code
                  </div>
                  <div style={{
                    fontSize: '2.4rem',
                    fontWeight: 900,
                    color: 'var(--brand-cerulean)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    margin: '0.5rem 0'
                  }}>
                    {submissionSuccess.case_number}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(submissionSuccess.case_number)}
                      style={{ fontSize: '0.78rem' }}
                    >
                      <Copy size={13} /> {copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem' }}>
                  <button
                    className="btn btn-secondary btn-lg"
                    onClick={() => {
                      setTrackRef(submissionSuccess.case_number);
                      setActiveTab('TRACK');
                    }}
                  >
                    <Search size={18} /> Track Application Live
                  </button>
                  <button
                    className="btn btn-primary btn-lg"
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

        {/* ================================================================= */}
        {/* TAB 2: INTERACTIVE LOAN CALCULATOR */}
        {/* ================================================================= */}
        {activeTab === 'CALCULATOR' && (
          <div className="glass-panel cyber-top-edge" style={{ padding: '2.75rem' }}>
            <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 2.5rem auto' }}>
              <span className="status-pill pill-cyan" style={{ marginBottom: '0.75rem' }}>
                COMMERCIAL REPAYMENT SIZER
              </span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-highlight)', fontFamily: 'var(--font-display)' }}>
                Commercial Facility Amortization &amp; Fee Simulator
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
                Simulate monthly debt service installments, upfront facility appraisal fees, and total repayment costs across ticket sizes from ₦2,000,000 to ₦100,000,000.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2.5rem', marginBottom: '2.5rem' }}>
              {/* Controls */}
              <div>
                <div className="form-group" style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Facility Amount</label>
                    <span style={{
                      fontSize: '1.45rem',
                      fontWeight: 800,
                      color: 'var(--brand-cerulean)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      ₦{formData.amount.toLocaleString()}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={2000000}
                    max={100000000}
                    step={1000000}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />

                  {/* Preset Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {[5000000, 15000000, 50000000, 100000000].map(val => (
                      <button
                        key={val}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.3rem 0.65rem',
                          borderColor: formData.amount === val ? 'var(--brand-cerulean)' : 'var(--border-subtle)',
                          color: formData.amount === val ? 'var(--brand-cerulean)' : 'var(--text-secondary)',
                          background: formData.amount === val ? 'rgba(0, 150, 204, 0.08)' : 'var(--bg-surface)'
                        }}
                        onClick={() => setFormData({ ...formData, amount: val })}
                      >
                        ₦{(val / 1000000).toFixed(0)}M
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Facility Tenor</label>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>
                      {formData.tenor_months} Months
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.65rem' }}>
                    {[3, 6, 12, 18, 24].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData({ ...formData, tenor_months: t })}
                        className={`btn ${formData.tenor_months === t ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.6rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        {t} Mos
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculator Output Display */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-xl)',
                padding: '2rem',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
                  Estimated Monthly Debt Service
                </div>
                <div style={{
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  color: 'var(--brand-cerulean)',
                  fontFamily: 'var(--font-mono)',
                  margin: '0.35rem 0 1.25rem 0',
                  letterSpacing: '-0.02em'
                }}>
                  ₦{calculations.monthlyInstallment.toLocaleString()}
                  <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}> / month</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Principal Borrowed:</span>
                    <strong style={{ color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>₦{formData.amount.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Interest ({pricingPolicy.effective_apr}% APR):</span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Structured as CBN MPR ({pricingPolicy.cbn_mpr}%) + {pricingPolicy.commercial_margin}% Commercial Margin
                      </div>
                    </div>
                    <strong style={{ color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>₦{calculations.totalInterest.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Upfront Processing &amp; Legal ({pricingPolicy.upfront_fee_pct}%):</span>
                    <strong style={{ color: 'var(--accent-gold-light)', fontFamily: 'var(--font-mono)' }}>₦{calculations.upfrontFees.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Debt Repayment:</span>
                    <strong style={{ color: 'var(--brand-cerulean)', fontFamily: 'var(--font-mono)' }}>₦{calculations.totalRepayment.toLocaleString()}</strong>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: '2rem', width: '100%' }}
                  onClick={() => setActiveTab('APPLY')}
                >
                  Apply For ₦{formData.amount.toLocaleString()} Facility <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: TRACK EXISTING APPLICATION STATUS */}
        {/* ================================================================= */}
        {activeTab === 'TRACK' && (
          <div className="glass-panel cyber-top-edge" style={{ padding: '2.75rem', maxWidth: '820px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <span className="status-pill pill-cyan" style={{ marginBottom: '0.75rem' }}>
                UNDERWRITING RADAR &bull; LIVE TRACKING
              </span>
              <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-highlight)', fontFamily: 'var(--font-display)' }}>
                Track Appraisal Progress
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                Enter your official OFL application reference code to view live appraisal milestones and committee decisions.
              </p>
            </div>

            <form onSubmit={handleTrackSubmit} style={{ display: 'flex', gap: '0.85rem', marginBottom: '2rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. OFL-2026-00003"
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 700 }}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={trackLoading} style={{ whiteSpace: 'nowrap', padding: '0 1.8rem' }}>
                <Search size={16} /> {trackLoading ? 'Querying...' : 'Track Dossier'}
              </button>
            </form>

            {trackError && (
              <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1.5rem' }}>
                <AlertTriangle size={20} />
                <span>{trackError}</span>
              </div>
            )}

            {trackResult && (
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-medium)',
                padding: '2rem',
                boxShadow: 'var(--shadow-md)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--brand-cerulean)', fontFamily: 'var(--font-mono)' }}>
                      {trackResult.case_number}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-highlight)', marginTop: '0.2rem' }}>
                      {trackResult.applicant_name}
                    </div>
                  </div>
                  <span className="status-pill pill-cyan" style={{ fontSize: '0.85rem', padding: '0.45rem 1.1rem' }}>
                    {trackResult.status_label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Facility Amount:</span> <strong style={{ color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>₦{trackResult.amount?.toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Tenor:</span> <strong style={{ color: 'var(--text-highlight)' }}>{trackResult.tenor} Months</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Purpose:</span> <span style={{ color: 'var(--text-highlight)' }}>{trackResult.purpose}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Submitted:</span> <span style={{ color: 'var(--text-highlight)' }}>{new Date(trackResult.submitted_at).toLocaleDateString()}</span></div>
                </div>

                <div style={{
                  padding: '1rem 1.25rem',
                  background: 'rgba(0, 150, 204, 0.08)',
                  border: '1px solid rgba(0, 150, 204, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem',
                  color: 'var(--brand-cerulean)',
                  lineHeight: 1.5
                }}>
                  {trackResult.message}
                </div>

                {/* Applicant Clarification / Exception Action Box */}
                {trackResult.applicant_action && (
                  <div style={{
                    marginTop: '1.75rem',
                    padding: '1.5rem',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 'var(--radius-lg)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#92400e', fontWeight: 800, fontSize: '0.98rem', marginBottom: '0.65rem' }}>
                      <AlertTriangle size={20} /> Action Required: Underwriting Clarification
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-highlight)', marginBottom: '1rem', lineHeight: 1.5 }}>
                      <strong>Underwriter Request:</strong> {trackResult.applicant_action.instructions}
                    </div>

                    {trackResult.applicant_action.requested_documents?.length > 0 && (
                      <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Required Attachment: </span>
                        <strong style={{ color: 'var(--brand-cerulean)' }}>
                          {trackResult.applicant_action.requested_documents.join(', ')}
                        </strong>
                      </div>
                    )}

                    {exceptionResponseMsg && (
                      <div className="flag-banner flag-SUCCESS" style={{ marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                        <CheckCheck size={18} /> <span>{exceptionResponseMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleRespondToException}>
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem' }}>Clarification Explanation / Narrative *</label>
                        <textarea
                          className="form-textarea"
                          rows={3}
                          required
                          placeholder="e.g. Attached certified true copy with official director stamp as requested..."
                          value={applicantResponseNotes}
                          onChange={(e) => setApplicantResponseNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                          <UploadCloud size={15} /> Attach Replacement Evidence
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
                          <span key={i} className="status-pill pill-blue" style={{ fontSize: '0.75rem' }}>
                            {f.name}
                          </span>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={respondingToException}
                      >
                        {respondingToException ? 'Submitting Clarification...' : 'Submit Clarification & Resume Underwriting'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern Customer Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
        borderTop: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
        position: 'relative',
        zIndex: 1,
        background: '#ffffff'
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          Opticom Finance Limited &bull; RC: 347832 &bull; Licensed by the Central Bank of Nigeria (CBN)
        </div>
        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          Head Office: 10th Floor, UAC House, 1-5 Odunlami St, Lagos Island, Lagos 101001, Nigeria &bull; Helpline: 0816 181 3538 (+234 816 181 3538) &bull; Email: info@opticomfinance.com | customercare@opticomfinance.com
        </div>
        <div style={{
          marginTop: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          flexWrap: 'wrap',
          fontSize: '0.76rem',
          color: 'var(--text-secondary)'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} color="#10b981" /> 256-Bit SSL Enterprise Security
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={14} color="var(--brand-cerulean)" /> NDPR Data Privacy Compliant
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Building2 size={14} color="#f59e0b" /> CBN Regulated Finance House
          </span>
        </div>
      </footer>
    </div>
  );
};
