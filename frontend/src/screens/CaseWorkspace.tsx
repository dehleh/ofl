import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, FileText, CheckCircle, AlertTriangle, ShieldCheck,
  Send, RefreshCw, Cpu, UserCheck, CheckSquare, DollarSign, ExternalLink,
  ShieldAlert, Clock, PlusCircle, Zap, Receipt, Plus, Trash2, Percent,
  Printer, Download, Copy, FileCheck, Award, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  fetchCaseWorkspace, generateAICam, updateCam, submitApprovalDecision,
  generateOffer, takeOfferAction, updateCondition, confirmNavDisbursement,
  executeOneClickLoandiscDisbursement, syncLoanDisc, raiseException, triggerYouverifyKyc,
  pullCreditBureauReport,
  fetchCaseFees, updateCaseFees, calculateCaseFeesPreview,
  fetchSingleLoanPerformance, recordLoanRepayment, simulateLoanPerformanceStatus,
  fetchCaseOfferDocuments, fetchBccStatus
} from '../services/api';
import { OpticomCamDocument } from '../components/OpticomCamDocument';
import { BankStatementAnalyzerCard } from '../components/BankStatementAnalyzerCard';

interface CaseWorkspaceProps {
  caseId: string;
  currentPersona: string;
  onBack: () => void;
}

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({ caseId, currentPersona, onBack }) => {
  const getDefaultWorkspaceTab = (role: string) => {
    switch (role.toUpperCase()) {
      case 'TREASURY': return 'TREASURY';
      case 'MD':
      case 'BCC': return 'APPROVALS';
      default: return 'DOSSIER';
    }
  };

  const isWorkspaceTabPermitted = (tab: string) => {
    switch (currentPersona.toUpperCase()) {
      case 'ANALYST':
        return ['DOSSIER', 'FINANCIALS', 'CAM', 'APPROVALS', 'OFFER_CONDITIONS', 'EXCEPTIONS'].includes(tab);
      case 'HRM':
        return ['DOSSIER', 'FINANCIALS', 'CAM', 'APPROVALS', 'OFFER_CONDITIONS', 'EXCEPTIONS'].includes(tab);
      case 'HEAD_OF_BD':
        return ['DOSSIER', 'CAM', 'APPROVALS', 'OFFER_CONDITIONS', 'EXCEPTIONS'].includes(tab);
      case 'BDO':
        return ['DOSSIER', 'CAM', 'EXCEPTIONS'].includes(tab);
      case 'MD':
      case 'BCC':
        return ['CAM', 'APPROVALS', 'DOSSIER', 'OFFER_CONDITIONS', 'EXCEPTIONS'].includes(tab);
      case 'TREASURY':
        return ['TREASURY', 'OFFER_CONDITIONS', 'DOSSIER', 'EXCEPTIONS'].includes(tab);
      case 'AUDITOR':
        return ['DOSSIER', 'FINANCIALS', 'CAM', 'APPROVALS', 'OFFER_CONDITIONS', 'TREASURY', 'EXCEPTIONS'].includes(tab);
      default:
        return true;
    }
  };

  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DOSSIER' | 'FINANCIALS' | 'CAM' | 'APPROVALS' | 'OFFER_CONDITIONS' | 'TREASURY' | 'EXCEPTIONS' | 'TELEMETRY'>(() => getDefaultWorkspaceTab(currentPersona));

  // State for actions
  const [actionLoading, setActionLoading] = useState(false);
  const [messageBanner, setMessageBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approval Form State
  const [approvalDecision, setApprovalDecision] = useState<'APPROVE' | 'RECOMMEND_APPROVE' | 'RETURN_FOR_REWORK' | 'REJECT'>(() => {
    return currentPersona === 'ANALYST' ? 'RECOMMEND_APPROVE' : 'APPROVE';
  });
  const [approvalComments, setApprovalComments] = useState('');
  const [mandatedCondition, setMandatedCondition] = useState('');
  const [returnTargetRole, setReturnTargetRole] = useState<'HRM' | 'HEAD_OF_BD'>('HRM');
  const [loanPerformance, setLoanPerformance] = useState<any>(null);

  // Multi-tier review comments trail state
  const [quickCommentText, setQuickCommentText] = useState('');
  const [showCommentTrail, setShowCommentTrail] = useState(true);
  const storedUser = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('ofl_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Treasury Form State
  const [navReference, setNavReference] = useState('');
  const [navEvidence, setNavEvidence] = useState('');

  // Selected CAM version for editing/viewing
  const [selectedCamIndex, setSelectedCamIndex] = useState(0);

  // Flowchart Exception Modal State
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [raiseCategory, setRaiseCategory] = useState('INTERNAL_CORRECTION');
  const [raiseReason, setRaiseReason] = useState('');
  const [raiseComments, setRaiseComments] = useState('');
  const [raiseSla, setRaiseSla] = useState(24);

  // Youverify Verification & Credit Bureau State
  const [kycLoading, setKycLoading] = useState(false);
  const [bureauLoading, setBureauLoading] = useState(false);
  const [bureauConsent, setBureauConsent] = useState(true);
  const [guarantorBvnOverride, setGuarantorBvnOverride] = useState('');

  // Post-Approval Legal Documents State
  const [offerDocuments, setOfferDocuments] = useState<any[]>([]);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [loadingOfferDocs, setLoadingOfferDocs] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // BCC Quorum Status State
  const [bccStatus, setBccStatus] = useState<any>(null);

  // Case Fees & Upfront Deductions State
  const [caseFees, setCaseFees] = useState<any[]>([]);
  const [feeCalc, setFeeCalc] = useState<any>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [savingCaseFees, setSavingCaseFees] = useState(false);
  const [isAddCaseFeeOpen, setIsAddCaseFeeOpen] = useState(false);
  const [newCaseFee, setNewCaseFee] = useState({
    name: '',
    fee_type: 'PERCENTAGE',
    rate: 1.0,
    is_selected: true,
    description: ''
  });

  const loadCaseFees = async () => {
    setLoadingFees(true);
    try {
      const data = await fetchCaseFees(caseId);
      const fees = data.fee_schedule || [];
      setCaseFees(fees);
      setFeeCalc(data.calculation || null);
    } catch (e: any) {
      console.warn('Could not load case fees:', e);
    } finally {
      setLoadingFees(false);
    }
  };

  const handleFeeToggle = async (index: number) => {
    const updated = [...caseFees];
    const newSelected = !updated[index].is_selected;
    updated[index] = { ...updated[index], is_selected: newSelected, selected: newSelected };
    setCaseFees(updated);
    const p = workspace?.application?.amount || 0;
    try {
      const calc = await calculateCaseFeesPreview(caseId, updated, p);
      setFeeCalc(calc);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFeeRateChange = async (index: number, newRate: number) => {
    const updated = [...caseFees];
    updated[index] = { ...updated[index], rate: newRate };
    setCaseFees(updated);
    const p = workspace?.application?.amount || 0;
    try {
      const calc = await calculateCaseFeesPreview(caseId, updated, p);
      setFeeCalc(calc);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCaseFees = async () => {
    setSavingCaseFees(true);
    try {
      const res = await updateCaseFees(caseId, caseFees, currentPersona);
      setFeeCalc(res.calculation);
      setMessageBanner({ type: 'success', text: 'Applicable facility fee schedule saved to case.' });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message || 'Failed to save fee schedule' });
    } finally {
      setSavingCaseFees(false);
    }
  };

  const handleRunYouverifyCheck = async () => {
    if (!workspace) return;
    setKycLoading(true);
    try {
      const res = await triggerYouverifyKyc(workspace.case.id, `${currentPersona} Officer`);
      setMessageBanner({
        type: res.status === 'PASSED' ? 'success' : 'error',
        text: `Youverify verification completed: ${res.status}. Provider Ref: ${res.provider_ref}`
      });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({
        type: 'error',
        text: err?.detail || err?.message || 'Youverify identity verification failed.'
      });
    } finally {
      setKycLoading(false);
    }
  };

  const handlePullCreditBureau = async (forceRefresh: boolean = false) => {
    if (!workspace) return;
    if (!bureauConsent) {
      setMessageBanner({ type: 'error', text: 'NDPA Borrower Consent confirmation is required before querying CRC Credit Bureau.' });
      return;
    }
    setBureauLoading(true);
    try {
      const res = await pullCreditBureauReport(workspace.case.id, {
        bvn: workspace.customer?.bvn || undefined,
        guarantor_bvn: guarantorBvnOverride.trim() || undefined,
        consent_confirmed: bureauConsent,
        force_refresh: forceRefresh,
        actor: `${currentPersona} Officer`
      });
      if (res.status === 'FAILED' || res.status === 'PERMISSION_REQUIRED') {
        setMessageBanner({
          type: 'error',
          text: res.bureau_report?.action_required || res.error || 'Credit Bureau lookup failed.'
        });
      } else {
        const bScore = res.bureau_report?.score;
        setMessageBanner({
          type: res.status === 'FLAGGED' ? 'error' : 'success',
          text: `CRC Credit Bureau Report (${res.status}): Score ${bScore ?? 'NO-HIT'}/850 • Ref: ${res.provider_ref}${res.cached ? ' (Cached)' : ''}`
        });
      }
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({
        type: 'error',
        text: err?.detail || err?.message || 'Credit Bureau pull failed.'
      });
    } finally {
      setBureauLoading(false);
    }
  };

  const handleRaiseExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raiseReason.trim() || !workspace) return;
    setActionLoading(true);
    try {
      await raiseException({
        case_id: workspace.case.id,
        category: raiseCategory,
        originator_role: currentPersona,
        originator_name: `${currentPersona} Officer`,
        reason: raiseReason.trim(),
        comments: raiseComments.trim(),
        sla_hours: Number(raiseSla)
      });
      setMessageBanner({ type: 'success', text: `Exception recorded under category: ${raiseCategory.replace(/_/g, ' ')}` });
      setShowRaiseModal(false);
      setRaiseReason('');
      setRaiseComments('');
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message || 'Failed to record exception' });
    } finally {
      setActionLoading(false);
    }
  };

  const loadLoanPerformance = async (cid: string) => {
    try {
      const perf = await fetchSingleLoanPerformance(cid);
      setLoanPerformance(perf);
    } catch (e) {
      setLoanPerformance(null);
    }
  };

  const loadOfferDocuments = async () => {
    setLoadingOfferDocs(true);
    try {
      const res = await fetchCaseOfferDocuments(caseId);
      if (res && res.documents) {
        setOfferDocuments(res.documents);
      }
    } catch (e) {
      console.warn('Could not load offer documents:', e);
    } finally {
      setLoadingOfferDocs(false);
    }
  };

  const loadBccStatus = async () => {
    try {
      const res = await fetchBccStatus(caseId);
      if (res) {
        setBccStatus(res);
      }
    } catch (e) {
      console.warn('Could not load BCC status:', e);
    }
  };

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const data = await fetchCaseWorkspace(caseId);
      setWorkspace(data);
      if (data.cam_versions && data.cam_versions.length > 0) {
        setSelectedCamIndex(data.cam_versions.length - 1);
      }
      loadCaseFees();
      loadOfferDocuments();
      loadBccStatus();
      if (data.case && (data.case.state === 'Disbursed/Monitoring' || data.case.state === 'Ready for Disbursement' || (data.disbursements && data.disbursements.length > 0))) {
        loadLoanPerformance(data.case.id || caseId);
      }
    } catch (e: any) {
      setMessageBanner({ type: 'error', text: e.message || 'Failed to load case workspace' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [caseId]);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading comprehensive case workspace dossier...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Case not found.</p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Return to Queue
        </button>
      </div>
    );
  }

  const { case: caseData, customer, application, documents, kyc_checks, latest_credit_bureau, financial_assessment, cam_versions, exceptions, approvals, offers, conditions, disbursements } = workspace;
  const latestCam = cam_versions && cam_versions.length > 0 ? cam_versions[selectedCamIndex] : null;
  const activeOffer = offers && offers.length > 0 ? offers[0] : null;
  const ratios = financial_assessment ? financial_assessment.calculated_ratios : {};
  const flags = financial_assessment ? financial_assessment.policy_flags : [];

  // Actions
  const handleGenerateCam = async () => {
    setActionLoading(true);
    setMessageBanner(null);
    try {
      const res = await generateAICam(caseData.id, currentPersona);
      setMessageBanner({ type: 'success', text: res.message });
      await loadWorkspace();
      setActiveTab('CAM');
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.message || 'AI CAM generation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnalystSignOff = async () => {
    if (!latestCam) return;
    setActionLoading(true);
    try {
      const res = await updateCam(caseData.id, latestCam.id, {
        analyst_sign_off: true,
        actor: 'Credit Analyst'
      });
      setMessageBanner({ type: 'success', text: 'Analyst sign-off recorded. Case routed to HRM Review.' });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecisionSubmit = async () => {
    setActionLoading(true);
    setMessageBanner(null);
    try {
      const conditionsList = mandatedCondition.trim() ? [mandatedCondition.trim()] : [];
      const res = await submitApprovalDecision(caseData.id, {
        decision: approvalDecision,
        actor: storedUser?.name || `${currentPersona} Reviewer`,
        role: currentPersona,
        comments: approvalComments || `${approvalDecision} decision recorded by ${storedUser?.name || currentPersona}`,
        conditions_mandated: conditionsList,
        target_role: returnTargetRole
      });
      setMessageBanner({ type: 'success', text: res.message });
      setApprovalComments('');
      setMandatedCondition('');
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message || 'Approval submission failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostQuickComment = async () => {
    if (!quickCommentText.trim()) return;
    setActionLoading(true);
    setMessageBanner(null);
    try {
      const res = await submitApprovalDecision(caseData.id, {
        decision: 'COMMENT',
        actor: storedUser?.name || `${currentPersona} Reviewer`,
        role: currentPersona,
        comments: quickCommentText.trim()
      });
      setMessageBanner({ type: 'success', text: res.message || 'Deliberation review comment recorded successfully.' });
      setQuickCommentText('');
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message || 'Failed to record comment' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateOfferClick = async () => {
    setActionLoading(true);
    try {
      const res = await generateOffer(caseData.id, {
        actor: currentPersona,
        fee_schedule: caseFees
      });
      setMessageBanner({ type: 'success', text: res.message });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOfferActionClick = async (action: 'ACCEPT' | 'REJECT' | 'RENEGOTIATE') => {
    setActionLoading(true);
    try {
      const res = await takeOfferAction(caseData.id, action, 'Borrower digital acceptance signed on customer portal');
      setMessageBanner({ type: 'success', text: res.message });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConditionToggle = async (conditionId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'SATISFIED' ? 'PENDING' : 'SATISFIED';
    setActionLoading(true);
    try {
      const res = await updateCondition(caseData.id, conditionId, nextStatus, currentPersona);
      setMessageBanner({ type: 'success', text: res.message });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOneClickDisburse = async () => {
    setActionLoading(true);
    try {
      const res = await executeOneClickLoandiscDisbursement(caseData.id, `${currentPersona} Treasury Officer`);
      setMessageBanner({ type: 'success', text: res.message || 'Facility successfully disbursed and booked into LOAN-DISC!' });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message || 'Disbursement execution failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmTreasuryNav = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navReference) return;
    setActionLoading(true);
    try {
      const res = await confirmNavDisbursement(caseData.id, {
        nav_reference: navReference,
        amount: application.amount,
        confirmation_evidence: navEvidence || 'Bank transfer advice evidenced from NAV General Ledger.',
        actor: `${currentPersona} Treasury Officer`
      });
      setMessageBanner({ type: 'success', text: res.message });
      setNavReference('');
      setNavEvidence('');
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncLoanDiscClick = async () => {
    setActionLoading(true);
    try {
      const res = await syncLoanDisc(caseData.id);
      setMessageBanner({ type: 'success', text: res.message });
      await loadWorkspace();
    } catch (err: any) {
      setMessageBanner({ type: 'error', text: err.detail || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={onBack}>
              <ArrowLeft size={16} /> Back to Queue
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-teal-light)' }}>
                  {caseData.case_number}
                </span>
                <span className="status-pill pill-cyan">Rev {caseData.revision}</span>
                <span className={`status-pill ${application.intake_channel === 'BESTO' ? 'pill-purple' : 'pill-blue'}`}>
                  {application.intake_channel}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Borrower: <strong style={{ color: 'var(--text-highlight)' }}>{customer.name}</strong> &bull; Amount: <strong style={{ color: 'var(--text-highlight)' }}>₦{application.amount.toLocaleString()}</strong> ({application.tenor}M) &bull; Owner: {caseData.assigned_owner}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRaiseModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-gold)' }}
            >
              <ShieldAlert size={14} /> Record Exception
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Workflow State:</span>
            <span className="status-pill pill-green" style={{ fontSize: '0.9rem', padding: '0.4rem 0.9rem' }}>
              {caseData.state}
            </span>
          </div>
        </div>
      </div>

      {/* Active Exception Flag Banner */}
      {exceptions.filter((e: any) => e.status !== 'RESOLVED').length > 0 && (
        <div className="flag-banner flag-HIGH" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} />
            <span>
              <strong>Active Credit Exception:</strong> {exceptions.find((e: any) => e.status !== 'RESOLVED')?.category.replace(/_/g, ' ')} &bull; {exceptions.find((e: any) => e.status !== 'RESOLVED')?.reason} ({exceptions.find((e: any) => e.status !== 'RESOLVED')?.owner})
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('EXCEPTIONS')} style={{ fontSize: '0.75rem' }}>
            View Exception Details
          </button>
        </div>
      )}

      {/* Alert banner */}
      {messageBanner && (
        <div className={`flag-banner flag-${messageBanner.type === 'success' ? 'MEDIUM' : 'CRITICAL'}`} style={{ marginBottom: '1rem' }}>
          {messageBanner.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{messageBanner.text}</span>
        </div>
      )}

      {/* Multi-Tier Governance Review & Deliberation Comment Trail */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1.5px solid rgba(0, 150, 204, 0.25)',
        borderRadius: '10px',
        padding: '1.15rem 1.35rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCommentTrail ? '1rem' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(0, 150, 204, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0096cc'
            }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.98rem', color: 'var(--text-highlight)' }}>
                  Multi-Tier Governance Review &amp; Deliberation Trail
                </strong>
                <span className="status-pill pill-cyan" style={{ fontSize: '0.68rem', padding: '0.1rem 0.5rem' }}>
                  {approvals.length} Deliberations Logged
                </span>
                {exceptions.filter((e: any) => e.status !== 'RESOLVED').length > 0 && (
                  <span className="status-pill pill-amber" style={{ fontSize: '0.68rem', padding: '0.1rem 0.5rem' }}>
                    Active Exception Query
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Audited comments from Credit Analyst, Head of BD (MCC), HRM, MD, and BCC Board Trustees.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowCommentTrail(!showCommentTrail)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {showCommentTrail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showCommentTrail ? 'Hide Deliberations' : 'Show Deliberations'}
            </button>
          </div>
        </div>

        {showCommentTrail && (
          <div>
            {/* Historical Deliberations List */}
            {approvals.length === 0 ? (
              <div style={{
                padding: '0.85rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.02)',
                border: '1px dashed var(--border-subtle)',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                No review comments logged yet. Use the review box below to record observations, queries, or committee guidance.
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: '340px',
                overflowY: 'auto',
                marginBottom: '1rem',
                paddingRight: '0.35rem'
              }}>
                {approvals.map((a: any) => {
                  const isReturn = a.decision === 'RETURN_FOR_REWORK' || a.decision === 'RETURN_TO_BDO';
                  const isApprove = a.decision === 'APPROVE' || a.decision === 'RECOMMEND_APPROVE';
                  const borderCol = isReturn ? 'rgba(239, 68, 68, 0.45)' : isApprove ? 'rgba(16, 185, 129, 0.35)' : 'rgba(0, 150, 204, 0.3)';
                  const bgCol = isReturn ? 'rgba(239, 68, 68, 0.04)' : isApprove ? 'rgba(16, 185, 129, 0.03)' : 'rgba(0, 150, 204, 0.03)';

                  return (
                    <div key={a.id} style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      background: bgCol,
                      border: `1px solid ${borderCol}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-highlight)' }}>
                            {a.actor}
                          </strong>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: '#0096cc15',
                            color: '#0096cc',
                            fontWeight: 700
                          }}>
                            {a.authority_level}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(a.created_at).toLocaleDateString()}
                          </span>
                          <span className={`status-pill ${isApprove ? 'pill-green' : isReturn ? 'pill-red' : 'pill-cyan'}`} style={{ fontSize: '0.7rem' }}>
                            {a.decision.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.84rem',
                        color: isReturn ? '#b91c1c' : 'var(--text-secondary)',
                        lineHeight: 1.5,
                        background: isReturn ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        padding: isReturn ? '6px 10px' : '0',
                        borderRadius: isReturn ? '4px' : '0',
                        fontWeight: isReturn ? 600 : 400
                      }}>
                        {isReturn && <span style={{ marginRight: '4px' }}>⚠️ Query / Reservation:</span>}
                        {a.comments}
                      </div>

                      {a.conditions_mandated && a.conditions_mandated.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Mandated Condition: {a.conditions_mandated.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Deliberation Comment Box */}
            <div style={{
              background: 'rgba(0, 150, 204, 0.04)',
              border: '1px solid rgba(0, 150, 204, 0.2)',
              borderRadius: '8px',
              padding: '0.85rem 1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0096cc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MessageSquare size={13} />
                  Add Deliberation Review / Comment as {storedUser?.name || currentPersona}
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Notifies Analyst, Head of BD, HRM, MD, and BCC
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <textarea
                  className="form-textarea"
                  rows={2}
                  style={{ fontSize: '0.82rem', flex: '1 1 300px' }}
                  placeholder="Record committee review comments, queries, or observations for other approvers..."
                  value={quickCommentText}
                  onChange={(e) => setQuickCommentText(e.target.value)}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handlePostQuickComment}
                    disabled={actionLoading || !quickCommentText.trim()}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', padding: '0.5rem 0.85rem' }}
                  >
                    <Send size={13} /> Post Comment
                  </button>
                  {activeTab !== 'APPROVALS' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveTab('APPROVALS')}
                      style={{ whiteSpace: 'nowrap', fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                    >
                      Formal Sanctions &rarr;
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dossier Tabs */}
      <div className="nav-bar" style={{ padding: '0.5rem 0', background: 'transparent', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', overflowX: 'auto', display: 'flex', gap: '0.35rem' }}>
        {isWorkspaceTabPermitted('DOSSIER') && (
          <button className={`nav-item ${activeTab === 'DOSSIER' ? 'active' : ''}`} onClick={() => setActiveTab('DOSSIER')}>
            1. Dossier ({documents.length})
          </button>
        )}
        {isWorkspaceTabPermitted('FINANCIALS') && (
          <button className={`nav-item ${activeTab === 'FINANCIALS' ? 'active' : ''}`} onClick={() => setActiveTab('FINANCIALS')}>
            2. Financial Analysis {flags.length > 0 && <span className="nav-badge alert">{flags.length}</span>}
          </button>
        )}
        {isWorkspaceTabPermitted('CAM') && (
          <button className={`nav-item ${activeTab === 'CAM' ? 'active' : ''}`} onClick={() => setActiveTab('CAM')}>
            3. AI CAM ({cam_versions.length})
          </button>
        )}
        {isWorkspaceTabPermitted('APPROVALS') && (
          <button className={`nav-item ${activeTab === 'APPROVALS' ? 'active' : ''}`} onClick={() => setActiveTab('APPROVALS')}>
            4. Approvals ({approvals.length})
          </button>
        )}
        {isWorkspaceTabPermitted('OFFER_CONDITIONS') && (
          <button className={`nav-item ${activeTab === 'OFFER_CONDITIONS' ? 'active' : ''}`} onClick={() => setActiveTab('OFFER_CONDITIONS')}>
            5. Offer & Conditions ({conditions.length})
          </button>
        )}
        {isWorkspaceTabPermitted('TREASURY') && (
          <button className={`nav-item ${activeTab === 'TREASURY' ? 'active' : ''}`} onClick={() => setActiveTab('TREASURY')}>
            6. Treasury LOAN-DISC
          </button>
        )}
        {isWorkspaceTabPermitted('EXCEPTIONS') && (
          <button className={`nav-item ${activeTab === 'EXCEPTIONS' ? 'active' : ''}`} onClick={() => setActiveTab('EXCEPTIONS')}>
            7. Exceptions ({exceptions.length})
          </button>
        )}
        {(caseData.state === 'Disbursed/Monitoring' || loanPerformance) && (
          <button className={`nav-item ${activeTab === 'TELEMETRY' ? 'active' : ''}`} onClick={() => setActiveTab('TELEMETRY')}>
            8. Telemetry &amp; Servicing
            {loanPerformance && loanPerformance.penalty_accrued > 0 && (
              <span className="nav-badge alert" style={{ background: '#dc2626' }}>5% Pen</span>
            )}
            {loanPerformance && loanPerformance.performance_status === 'GRACE_PERIOD_ACTIVE' && (
              <span className="nav-badge alert" style={{ background: '#d97706' }}>Grace</span>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: DOSSIER & DOCUMENTS */}
      {activeTab === 'DOSSIER' && (
        <div className="split-view">
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--brand-teal-light)' }}>
              Borrower Profile & Identity Verification
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Customer Name:</span> <strong style={{ color: 'var(--text-highlight)' }}>{customer.name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Classification:</span> {customer.customer_type}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>BVN:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.bvn || 'Not Supplied'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>NIN:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.nin || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>RC / Reg Number:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.rc_number || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Phone:</span> {customer.phone || 'N/A'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Means of ID:</span> <span>{customer.verified_attributes?.means_of_id_type || application.raw_payload?.means_of_id_type || 'National ID'} ({customer.verified_attributes?.means_of_id_number || application.raw_payload?.means_of_id_number || 'Confirmed'})</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> <span>{customer.email || 'N/A'}</span></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Operating Business Address:</span> <strong style={{ color: 'var(--text-highlight)' }}>{customer.verified_attributes?.business_address || application.raw_payload?.business_address || 'Registered Office Address on File'}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Director Residential Address:</span> <span>{customer.verified_attributes?.residential_address || application.raw_payload?.residential_address || 'Director Residential Address on File'}</span></div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-highlight)', margin: 0 }}>
                    Youverify / Identity & CAC Verification
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Automated NIBSS BVN, CAC Company Search, & AML Watchlist
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleRunYouverifyCheck}
                  disabled={kycLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                >
                  <ShieldCheck size={14} className={kycLoading ? 'pulse' : ''} />
                  <span>{kycLoading ? 'Verifying with Youverify...' : 'Run Youverify Check'}</span>
                </button>
              </div>

              {kyc_checks.length === 0 ? (
                <div style={{
                  padding: '1.25rem',
                  background: 'var(--bg-dark)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--border-subtle)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    No KYC verification recorded yet for this facility.
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Click <strong>Run Youverify Check</strong> to initiate automated verification against NIBSS & CAC registries.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {kyc_checks.map((k: any) => (
                    <div key={k.id} style={{
                      padding: '0.85rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-highlight)' }}>
                            Provider: {k.provider}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--brand-cerulean)', fontFamily: 'var(--font-mono)' }}>
                            Ref: {k.provider_ref}
                          </div>
                        </div>
                        <span className={`status-pill ${k.status === 'PASSED' ? 'pill-green' : 'pill-red'}`}>
                          {k.status}
                        </span>
                      </div>

                      {k.result_summary && (
                        <div style={{
                          marginTop: '0.5rem',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {k.result_summary.cac_verified !== undefined && (
                              <span className={`badge ${k.result_summary.cac_verified ? 'badge-teal' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                CAC: {k.result_summary.cac_verified ? 'VERIFIED' : 'UNCONFIRMED'}
                              </span>
                            )}
                            {k.result_summary.bvn_verified !== undefined && (
                              <span className={`badge ${k.result_summary.bvn_verified ? 'badge-teal' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                BVN: {k.result_summary.bvn_verified ? 'VERIFIED' : 'UNCONFIRMED'}
                              </span>
                            )}
                            {k.result_summary.aml_pep_clean !== undefined && (
                              <span className={`badge ${k.result_summary.aml_pep_clean ? 'badge-neutral' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                AML: {k.result_summary.aml_pep_clean ? 'CLEAN' : 'FLAGGED'}
                              </span>
                            )}
                          </div>

                          {k.result_summary.cac_data?.company_name && (
                            <div style={{ color: 'var(--text-secondary)' }}>
                              <strong>CAC Registered Name:</strong> {k.result_summary.cac_data.company_name} ({k.result_summary.cac_data.status})
                            </div>
                          )}

                          {k.result_summary.reason && (
                            <div style={{ color: '#ef4444', fontWeight: 500 }}>
                              <strong>Notice:</strong> {k.result_summary.reason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Option B: CRC Credit Bureau Pull via Youverify v2 */}
            <div style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.6rem',
                marginBottom: '0.75rem'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-highlight)', margin: 0 }}>
                    CRC Credit Bureau Report &amp; Score (via Youverify)
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    FICO 300–850 Score, Active External Facilities, Overdue NPL Check &amp; Guarantor Surety Pull
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePullCreditBureau(false)}
                    disabled={bureauLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                  >
                    <Award size={14} />
                    <span>{bureauLoading ? 'Pulling CRC Report...' : (latest_credit_bureau ? 'View / Load Bureau' : 'Pull CRC Bureau Report')}</span>
                  </button>
                  {latest_credit_bureau && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handlePullCreditBureau(true)}
                      disabled={bureauLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                      title="Force live re-query from Youverify Credit Report API"
                    >
                      <RefreshCw size={12} /> Refresh
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={bureauConsent} onChange={(e) => setBureauConsent(e.target.checked)} />
                  NDPA Credit Enquiry Consent Confirmed
                </label>
                <input
                  type="text"
                  value={guarantorBvnOverride}
                  onChange={(e) => setGuarantorBvnOverride(e.target.value)}
                  placeholder="Optional Guarantor BVN (11 digits)"
                  className="form-input"
                  style={{ maxWidth: '230px', fontSize: '0.75rem', padding: '4px 8px' }}
                />
              </div>

              {!latest_credit_bureau ? (
                <div style={{
                  padding: '0.9rem',
                  background: 'var(--bg-dark)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--border-subtle)',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}>
                  No CRC Credit Bureau report pulled yet for BVN <strong>{customer?.bvn || 'N/A'}</strong>. Click <strong>Pull CRC Bureau Report</strong> to fetch external credit score &amp; active debt obligations.
                </div>
              ) : latest_credit_bureau.result_summary?.action_required || latest_credit_bureau.status === 'FAILED' ? (
                <div style={{
                  padding: '0.9rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '0.78rem',
                  color: '#dc2626'
                }}>
                  <strong>Notice ({latest_credit_bureau.provider_ref}):</strong> {latest_credit_bureau.result_summary?.error}
                  {latest_credit_bureau.result_summary?.action_required && (
                    <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                      {latest_credit_bureau.result_summary.action_required}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '0.9rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-highlight)' }}>
                        {latest_credit_bureau.result_summary?.bureau_provider || 'CRC Credit Bureau (via Youverify)'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Ref: {latest_credit_bureau.result_summary?.report_reference || latest_credit_bureau.provider_ref}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        background: (latest_credit_bureau.result_summary?.score || 0) >= 650 ? 'rgba(16,185,129,0.14)' : (latest_credit_bureau.result_summary?.score || 0) >= 600 ? 'rgba(245,158,11,0.14)' : 'rgba(220,38,38,0.14)',
                        color: (latest_credit_bureau.result_summary?.score || 0) >= 650 ? '#059669' : (latest_credit_bureau.result_summary?.score || 0) >= 600 ? '#d97706' : '#dc2626'
                      }}>
                        Score: {latest_credit_bureau.result_summary?.score ?? 'NO-HIT'} / 850 ({latest_credit_bureau.result_summary?.score_band})
                      </span>
                      <span className={`status-pill ${latest_credit_bureau.status === 'PASSED' ? 'pill-green' : latest_credit_bureau.status === 'WARNING' ? 'pill-amber' : 'pill-red'}`}>
                        {latest_credit_bureau.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', fontSize: '0.75rem', marginBottom: '0.65rem' }}>
                    <div><strong>Active Loans:</strong> {latest_credit_bureau.result_summary?.summary?.total_active_loans ?? 0}</div>
                    <div><strong>External Debt:</strong> ₦{(latest_credit_bureau.result_summary?.summary?.total_outstanding_balance ?? 0).toLocaleString()}</div>
                    <div style={{ color: (latest_credit_bureau.result_summary?.summary?.total_overdue_balance ?? 0) > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>
                      Overdue Arrears: ₦{(latest_credit_bureau.result_summary?.summary?.total_overdue_balance ?? 0).toLocaleString()}
                    </div>
                    <div><strong>Est. Bureau PMT:</strong> ₦{(latest_credit_bureau.result_summary?.summary?.estimated_monthly_bureau_debt ?? 0).toLocaleString()}/mo</div>
                  </div>

                  {latest_credit_bureau.result_summary?.guarantor_bureau?.checked && (
                    <div style={{ fontSize: '0.74rem', padding: '5px 8px', background: 'rgba(0,150,204,0.08)', borderRadius: '4px', marginBottom: '0.65rem' }}>
                      <strong>Guarantor Bureau ({latest_credit_bureau.result_summary.guarantor_bureau.name}):</strong> Score {latest_credit_bureau.result_summary.guarantor_bureau.score ?? 'NO-HIT'}/850 ({latest_credit_bureau.result_summary.guarantor_bureau.score_band}) • Overdue: ₦{(latest_credit_bureau.result_summary.guarantor_bureau.overdue_balance ?? 0).toLocaleString()}
                    </div>
                  )}

                  {(latest_credit_bureau.result_summary?.accounts || []).length > 0 && (
                    <div className="table-wrapper" tabIndex={0} role="region" aria-label="CRC Credit Bureau Tradelines">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '6px 8px' }}>Institution</th>
                            <th style={{ padding: '6px 8px' }}>Facility</th>
                            <th style={{ padding: '6px 8px' }}>Outstanding</th>
                            <th style={{ padding: '6px 8px' }}>Overdue</th>
                            <th style={{ padding: '6px 8px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {latest_credit_bureau.result_summary.accounts.map((acc: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{acc.institution}</td>
                              <td style={{ padding: '6px 8px' }}>{acc.facility_type}</td>
                              <td style={{ padding: '6px 8px' }}>₦{(acc.outstanding_balance ?? 0).toLocaleString()}</td>
                              <td style={{ padding: '6px 8px', color: (acc.overdue_balance ?? 0) > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>
                                ₦{(acc.overdue_balance ?? 0).toLocaleString()}
                              </td>
                              <td style={{ padding: '6px 8px' }}>{acc.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--brand-teal-light)' }}>
              Document Manifest & Malware Verifications (FR-02)
            </h3>

            {documents.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No documents attached.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {documents.map((d: any) => (
                  <div key={d.id} style={{
                    padding: '0.85rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileText size={20} color="var(--brand-teal)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-highlight)' }}>{d.original_filename}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          SHA-256: {d.checksum} &bull; {d.document_type}
                        </div>
                      </div>
                    </div>
                    <span className="status-pill pill-green" style={{ fontSize: '0.7rem' }}>
                      {d.scan_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL APPRAISAL */}
      {activeTab === 'FINANCIALS' && (
        <div>
          {/* Automated Bank Statement Ingestion & Analysis */}
          <BankStatementAnalyzerCard
            caseId={caseData.id}
            documents={documents}
            currentPersona={currentPersona}
            onRefresh={loadWorkspace}
          />

          {/* Metrics Grid */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Monthly Repayment (Amortized PMT)</div>
              <div className="metric-value">₦{ratios.monthly_installment?.toLocaleString() || '0'}</div>
              <div className="metric-footer">{application.tenor} Equal Monthly Installments</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Debt Service Ratio (DSR)</div>
              <div className="metric-value" style={{ color: ratios.dsr > 0.35 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {ratios.dsr_percentage || '0'}%
              </div>
              <div className="metric-footer">Policy Ceiling: {ratios.max_allowable_dsr * 100}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Net Disposable Income</div>
              <div className="metric-value" style={{ color: ratios.net_disposable_income <= 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                ₦{ratios.net_disposable_income?.toLocaleString() || '0'}
              </div>
              <div className="metric-footer">Post Living & Debt Obligations</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Collateral Coverage Ratio</div>
              <div className="metric-value">{ratios.collateral_coverage_percentage || '0'}%</div>
              <div className="metric-footer">Policy Min: 120% for &gt;₦5m</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">CRC Bureau Score (300–850)</div>
              <div className="metric-value" style={{
                color: ratios.bureau_score === undefined || ratios.bureau_score === null
                  ? 'var(--text-muted)'
                  : ratios.bureau_score >= 600 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {ratios.bureau_score !== undefined && ratios.bureau_score !== null
                  ? `${ratios.bureau_score}`
                  : (latest_credit_bureau?.result_summary?.score ?? 'Not Pulled')}
              </div>
              <div className="metric-footer">
                {ratios.bureau_score_band || latest_credit_bureau?.result_summary?.score_band || 'Run CRC Bureau Check in Overview'}
              </div>
            </div>
          </div>

          {/* Policy Flags */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-highlight)' }}>
              Deterministic Policy Exceptions & Rule Violations (PRD FR-05)
            </h3>

            {flags.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '0.85rem' }}>
                <CheckCircle size={18} />
                <span>Zero policy violations. All financial ratios conform to Opticom Underwriting Policy.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {flags.map((f: any, idx: number) => (
                  <div key={idx} className={`flag-banner flag-${f.severity}`}>
                    <AlertTriangle size={18} />
                    <div>
                      <strong>[{f.severity}] {f.code}:</strong> {f.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI CAM ASSISTANT & VERSIONING */}
      {activeTab === 'CAM' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Version selector bar & AI Generation button */}
          <div className="glass-panel no-print" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-highlight)' }}>CAM Revisions:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {cam_versions.map((cv: any, index: number) => (
                  <button
                    key={cv.id}
                    onClick={() => setSelectedCamIndex(index)}
                    className={`btn btn-sm ${selectedCamIndex === index ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                  >
                    v{cv.version} {cv.analyst_sign_off ? '✓ (Validated)' : '(Draft)'}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleGenerateCam}
              disabled={actionLoading}
            >
              <Cpu size={14} /> Draft New Revision (Vertex AI Gemini)
            </button>
          </div>

          {/* Render 12-Page Printable Official Opticom CAM Document */}
          {latestCam ? (
            <OpticomCamDocument
              cam={latestCam}
              onAnalystSignOff={handleAnalystSignOff}
              actionLoading={actionLoading}
            />
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No CAM versions found. Click "Draft New Revision" to synthesize the 12-page memorandum with Vertex AI Gemini.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APPROVALS & AUTHORITY MATRIX */}
      {activeTab === 'APPROVALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Governance Sequence Pipeline Banner */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="var(--brand-teal-light)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                  Opticom Credit Governance Sequence &amp; Delegation Matrix
                </h3>
              </div>
              <span className="status-pill pill-cyan" style={{ fontSize: '0.75rem' }}>
                Current Stage: {caseData.state}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Facility Quantum: <strong>₦{application.amount.toLocaleString()}</strong> &bull;
              {application.amount > 20000000 ? (
                <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: '0.35rem' }}>
                  Mandatory Board Credit Committee (BCC) Sanction (&gt; ₦20,000,000)
                </span>
              ) : (
                <span style={{ color: '#0096cc', fontWeight: 700, marginLeft: '0.35rem' }}>
                  Managing Director (MD) Final Mandate (&le; ₦20,000,000)
                </span>
              )}
            </p>

            {/* Visual Step-by-Step Sequence */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.5rem', textAlign: 'center' }}>
              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'Analyst Review' || caseData.state === 'BDO Rework' ? 'rgba(0, 150, 204, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'Analyst Review' || caseData.state === 'BDO Rework' ? '#0096cc' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 1</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-highlight)' }}>Credit Analyst</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CAM &amp; BDO Rework Loop</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'Head of BD Review' ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'Head of BD Review' ? '#eab308' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 2 (MCC)</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#eab308' }}>Head of BD</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>1st MCC Reviewer</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'HRM Review' ? 'rgba(0, 150, 204, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'HRM Review' ? '#0096cc' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 3</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-highlight)' }}>HRM</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Risk Concurrence</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'MD Decision' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'MD Decision' ? '#10b981' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 4</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
                  MD Sanction
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Auto Offer Generation</div>
              </div>

              {application.amount > 20000000 && (
                <div style={{
                  padding: '0.65rem 0.4rem',
                  borderRadius: '6px',
                  background: caseData.state === 'BCC/Authorisation' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-surface)',
                  border: `1px solid ${caseData.state === 'BCC/Authorisation' ? '#ef4444' : 'var(--border-subtle)'}`
                }}>
                  <div style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700 }}>FINAL TIER</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444' }}>BCC (Board)</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Final Sanction &gt; ₦20M</div>
                </div>
              )}
            </div>
          </div>

          {/* BCC 2-OF-3 QUORUM GOVERNANCE GATE */}
          {(application.amount > 20000000 || bccStatus?.is_bcc_tier || workspace?.bcc_quorum?.is_bcc_tier) && (
            <div className="glass-panel" style={{
              padding: '1.25rem',
              border: '1.5px solid #0096cc',
              background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.08) 0%, rgba(4, 19, 38, 0.4) 100%)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={20} color="#0096cc" />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-highlight)' }}>
                    Board Credit Committee (BCC) 2-of-3 Quorum Gate
                  </h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quorum Policy:</span>
                  <span className={`status-pill ${(bccStatus?.quorum_achieved ?? workspace?.bcc_quorum?.quorum_achieved) ? 'pill-green' : 'pill-amber'
                    }`} style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                    {(bccStatus?.quorum_achieved ?? workspace?.bcc_quorum?.quorum_achieved)
                      ? '✓ QUORUM ACHIEVED (2/3 APPROVED)'
                      : `QUORUM PENDING (${(bccStatus?.approved_count ?? workspace?.bcc_quorum?.approved_count ?? 0)}/2 REQUIRED)`}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                Statutory governance for commercial exposures exceeding ₦20,000,000. Approval mandates <strong>at least 2 out of 3 Board members</strong> before offer generation and document dispatch can execute.
              </p>

              {/* Quorum Progress Bar */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  <span>Board Sign-off Progress</span>
                  <span>
                    <strong>{(bccStatus?.approved_count ?? workspace?.bcc_quorum?.approved_count ?? 0)}</strong> of 2 required votes recorded (3 members total)
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '999px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (((bccStatus?.approved_count ?? workspace?.bcc_quorum?.approved_count ?? 0) / 2) * 100))}%`,
                    background: (bccStatus?.quorum_achieved ?? workspace?.bcc_quorum?.quorum_achieved)
                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(90deg, #0096cc 0%, #eab308 100%)',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>

              {/* 3 Board Member Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {(bccStatus?.members || workspace?.bcc_quorum?.members || [
                  { name: "Emeka Nnamdi", title: "BCC Chair", email: "emeka.nnamdi@opticomfinance.com", has_approved: false },
                  { name: "Alhaji Aliyu Dangote", title: "BCC Member - Risk Trustee", email: "aliyu.dangote@opticomfinance.com", has_approved: false },
                  { name: "Mrs. Zainab Ahmed", title: "BCC Member - Legal Trustee", email: "zainab.ahmed@opticomfinance.com", has_approved: false }
                ]).map((member: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: member.has_approved ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface)',
                    border: `1.5px solid ${member.has_approved ? '#10b981' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-highlight)' }}>{member.name}</strong>
                        {member.has_approved ? (
                          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <CheckCircle size={13} /> APPROVED
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Clock size={13} /> PENDING
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#0096cc', fontWeight: 600 }}>{member.title || member.role}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{member.email}</div>
                    </div>

                    {!member.has_approved && caseData.state === 'BCC/Authorisation' && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}
                        onClick={async () => {
                          setApprovalComments(`BCC vote registered by ${member.name}.`);
                          try {
                            setActionLoading(true);
                            const res = await submitApprovalDecision(caseId, {
                              decision: 'APPROVE',
                              actor: member.name,
                              role: 'BCC',
                              comments: `Official Board Credit Committee approval sanction recorded by ${member.name} (${member.title || member.role}).`
                            });
                            setMessageBanner({ type: 'success', text: res.message });
                            loadWorkspace();
                          } catch (e: any) {
                            setMessageBanner({ type: 'error', text: e.message || 'Approval recording failed' });
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                      >
                        Sign as {member.name.split(' ')[0]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="split-view">
            {/* Decision Form */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--brand-teal-light)' }}>
                Record Authority Decision (FR-08, FR-09, FR-10)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Active Persona: <strong>{currentPersona}</strong> &bull; Loan Amount: <strong>₦{application.amount.toLocaleString()}</strong>
              </p>

              {['TREASURY', 'AUDITOR'].includes(currentPersona.toUpperCase()) ? (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 150, 204, 0.08)',
                  border: '1px solid rgba(0, 150, 204, 0.25)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem'
                }}>
                  <strong style={{ color: 'var(--brand-teal-light)', display: 'block', marginBottom: '0.25rem' }}>
                    Read-Only Underwriting Audit
                  </strong>
                  Your role (<strong>{currentPersona}</strong>) has operational oversight. Credit sanction authority decisions are restricted to Credit Underwriting, Risk Management, and Board Committees.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Decision Action</label>
                    <select
                      className="form-select"
                      value={approvalDecision}
                      onChange={(e: any) => setApprovalDecision(e.target.value)}
                    >
                      {currentPersona === 'ANALYST' ? (
                        <>
                          <option value="RECOMMEND_APPROVE">Forward to MCC (Head of Business Development)</option>
                          <option value="RETURN_FOR_REWORK">Request Missing Details from BDO (BDO Rework)</option>
                          <option value="REJECT">Recommend Application Decline</option>
                        </>
                      ) : currentPersona === 'HEAD_OF_BD' ? (
                        <>
                          <option value="APPROVE">Approve &amp; Forward to Head of Risk Management (HRM)</option>
                          <option value="RETURN_FOR_REWORK">Circle Back to Credit Analyst with Missing Details</option>
                          <option value="REJECT">Commercial Decline</option>
                        </>
                      ) : currentPersona === 'HRM' ? (
                        <>
                          <option value="APPROVE">Approve &amp; Forward to Managing Director (MD)</option>
                          <option value="RETURN_FOR_REWORK">Raise Risk Exception to Analyst (Alerts Head of BD)</option>
                          <option value="REJECT">Decline Application on Risk Grounds</option>
                        </>
                      ) : currentPersona === 'MD' ? (
                        <>
                          <option value="APPROVE">Approve Facility &amp; Auto-Generate/Email Offer Letter</option>
                          <option value="RETURN_FOR_REWORK">Return Facility with Query (Prompts Analyst, HRM, &amp; BD)</option>
                          <option value="REJECT">Executive Decline</option>
                        </>
                      ) : currentPersona === 'BDO' ? (
                        <>
                          <option value="APPROVE">Update Customer Details &amp; Re-Submit to Credit Analyst</option>
                        </>
                      ) : currentPersona === 'BCC' ? (
                        <>
                          <option value="APPROVE">BCC Final Board Sanction (&gt; ₦20M)</option>
                          <option value="RETURN_FOR_REWORK">Return for Board Credit Rework</option>
                          <option value="REJECT">Board Credit Decline</option>
                        </>
                      ) : (
                        <>
                          <option value="APPROVE">Approve Facility / Advance to Next Sequential Authority</option>
                          <option value="RECOMMEND_APPROVE">Recommend Approval (Forward to Next Tier)</option>
                          <option value="RETURN_FOR_REWORK">Return for Internal Rework (Opens Exception)</option>
                          <option value="REJECT">Decline Application (Final Rejection)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {currentPersona === 'MD' && approvalDecision === 'RETURN_FOR_REWORK' && (
                    <div className="form-group" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: '1rem' }}>
                      <label className="form-label" style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.35rem' }}>
                        MD Return Destination (Choose Reviewer to Resolve Query)
                      </label>
                      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
                        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="returnTarget"
                            value="HRM"
                            checked={returnTargetRole === 'HRM'}
                            onChange={() => setReturnTargetRole('HRM')}
                          />
                          Head of Risk Management (HRM) - Default
                        </label>
                        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="returnTarget"
                            value="HEAD_OF_BD"
                            checked={returnTargetRole === 'HEAD_OF_BD'}
                            onChange={() => setReturnTargetRole('HEAD_OF_BD')}
                          />
                          Head of Business Development
                        </label>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                        * Note: When MD returns this case, Credit Analyst, Head of BD, and HRM will all receive immediate notification prompts automatically.
                      </div>
                    </div>
                  )}

                  {currentPersona === 'HRM' && approvalDecision === 'RETURN_FOR_REWORK' && (
                    <div style={{ fontSize: '0.75rem', color: '#d97706', marginBottom: '1rem', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                      ⚠ Risk Exception will be routed to Credit Analyst. Head of Business Development will receive an alert prompt automatically.
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Mandated Conditions Precedent (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Provide joint personal guarantee of company director"
                      value={mandatedCondition}
                      onChange={(e) => setMandatedCondition(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Deliberation Comments / Policy Rationale *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Record credit risk committee observations or return instructions..."
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                    />
                  </div>

                  <button
                    className={`btn ${approvalDecision === 'REJECT' ? 'btn-danger' : approvalDecision === 'RETURN_FOR_REWORK' ? 'btn-warning' : 'btn-primary'}`}
                    onClick={handleDecisionSubmit}
                    disabled={actionLoading}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    <Send size={16} /> Submit {approvalDecision} Decision
                  </button>
                </>
              )}
            </div>

            {/* Historical Decisions & Chain */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-highlight)' }}>
                Sequential Approval Audit Trail
              </h3>

              {approvals.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No approval decisions logged yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {approvals.map((a: any) => (
                    <div key={a.id} style={{
                      padding: '0.85rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${a.is_active ? 'var(--border-subtle)' : 'rgba(239, 68, 68, 0.4)'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-highlight)' }}>{a.actor} ({a.authority_level})</strong>
                        <span className={`status-pill ${a.decision === 'APPROVE' ? 'pill-green' : a.decision === 'REJECT' ? 'pill-red' : 'pill-amber'}`}>
                          {a.decision}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>{a.comments}</p>
                      {!a.is_active && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginTop: '0.3rem' }}>
                          Invalidated due to material change (FR-12)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OFFER & CONDITIONS PRECEDENT */}
      {activeTab === 'OFFER_CONDITIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div className="split-view">
            {/* Offer Summary Panel */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--brand-teal-light)' }}>
                Loan Offer Letter Management (FR-13)
              </h3>

              {activeOffer ? (
                <div>
                  <div style={{
                    padding: '1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved Principal Amount:</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-highlight)' }}>₦{activeOffer.approved_amount.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly Installment:</span>
                      <strong style={{ color: 'var(--brand-teal-light)' }}>₦{activeOffer.monthly_repayment.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Upfront Fee Deductions:</span>
                      <strong style={{ color: '#ef4444' }}>-₦{(activeOffer.total_fees || feeCalc?.total_fees || 0).toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Amount Disbursed to Obligor:</span>
                      <strong style={{ color: '#10b981', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                        ₦{(activeOffer.net_disbursement || feeCalc?.net_disbursement || (activeOffer.approved_amount - (feeCalc?.total_fees || 0))).toLocaleString()}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Offer Status:</span>
                      <span className="status-pill pill-cyan">{activeOffer.status}</span>
                    </div>
                  </div>

                  {activeOffer.status === 'ISSUED' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOfferActionClick('ACCEPT')}
                        disabled={actionLoading}
                        style={{ flex: 1 }}
                      >
                        Borrower Accepts Offer
                      </button>
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => handleOfferActionClick('RENEGOTIATE')}
                        disabled={actionLoading}
                        style={{ flex: 1 }}
                      >
                        Renegotiate (Triggers Invalidation)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Facility has been reviewed. Select applicable fees below and generate the official binding loan offer letter.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateOfferClick}
                    disabled={actionLoading}
                  >
                    Generate Binding Offer Letter
                  </button>
                </div>
              )}
            </div>

            {/* Conditions Precedent Checklist */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--brand-teal-light)' }}>
                Conditions Precedent Checklist (FR-14)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                All mandatory conditions must be verified before transitioning to "Ready for Disbursement".
              </p>

              {conditions.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No conditions precedent stipulated.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {conditions.map((c: any) => (
                    <div key={c.id} style={{
                      padding: '0.75rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="checkbox"
                          checked={c.status === 'SATISFIED'}
                          onChange={() => handleConditionToggle(c.id, c.status)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand-teal)' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-highlight)', fontWeight: 600 }}>{c.description}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Mandatory: {c.mandatory ? 'Yes' : 'No'} &bull; Verified By: {c.verified_by || 'Pending'}
                          </div>
                        </div>
                      </div>
                      <span className={`status-pill ${c.status === 'SATISFIED' ? 'pill-green' : 'pill-amber'}`} style={{ fontSize: '0.7rem' }}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* FACILITY FEES & BESPOKE DEDUCTIONS SELECTION TABLE */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={18} color="var(--brand-teal-light)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                    Opticom Applicable Facility Fees &amp; Upfront Deductions
                  </h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Select charges applicable to this facility. You may override rates, toggle optional fees (e.g. tracking, insurance), or incorporate bespoke transaction fees.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddCaseFeeOpen(!isAddCaseFeeOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} /> Add Case Bespoke Fee
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveCaseFees}
                  disabled={savingCaseFees}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {savingCaseFees ? 'Saving...' : 'Save Facility Fee Schedule'}
                </button>
              </div>
            </div>

            {/* Modal: Add Case Bespoke Fee */}
            {isAddCaseFeeOpen && (
              <div style={{
                background: 'rgba(0, 150, 204, 0.05)',
                border: '1px solid rgba(0, 150, 204, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#0096cc' }}>+ Add Bespoke Fee for Case {caseData.case_number}</strong>
                  <button onClick={() => setIsAddCaseFeeOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Fee Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Valuation / Search Fee"
                      value={newCaseFee.name}
                      onChange={(e) => setNewCaseFee({ ...newCaseFee, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Type</label>
                    <select
                      className="form-select"
                      value={newCaseFee.fee_type}
                      onChange={(e) => setNewCaseFee({ ...newCaseFee, fee_type: e.target.value as any })}
                    >
                      <option value="PERCENTAGE">Percentage of Principal (%)</option>
                      <option value="FLAT">Flat Fixed (₦)</option>
                      <option value="PERCENTAGE_OF_FEES">Percentage of Fees (VAT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Rate / Amount ({newCaseFee.fee_type === 'FLAT' ? '₦' : '%'})</label>
                    <input
                      type="number"
                      step={newCaseFee.fee_type === 'FLAT' ? '1000' : '0.1'}
                      className="form-input"
                      value={newCaseFee.rate}
                      onChange={(e) => setNewCaseFee({ ...newCaseFee, rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddCaseFeeOpen(false)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      if (!newCaseFee.name.trim()) return;
                      const customId = `bespoke_${Date.now()}`;
                      const updated = [...caseFees, { ...newCaseFee, id: customId, is_selected: true, selected: true }];
                      setCaseFees(updated);
                      setIsAddCaseFeeOpen(false);
                      setNewCaseFee({ name: '', fee_type: 'PERCENTAGE', rate: 1.0, is_selected: true, description: '' });
                      const calc = await calculateCaseFeesPreview(caseId, updated, application.amount);
                      setFeeCalc(calc);
                    }}
                  >
                    Incorporate Fee
                  </button>
                </div>
              </div>
            )}

            {/* Fees Checklist Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.65rem 0.85rem', width: '40px' }}>Apply</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Fee Title</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Basis</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Rate / Value</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Calculated Deduction</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Notes / Applicability</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {caseFees.map((fee, idx) => {
                    const isChecked = fee.is_selected !== false && fee.selected !== false;
                    const deduction = feeCalc?.itemized_fees?.find((i: any) => i.id === fee.id)?.calculated_amount ?? 0;
                    return (
                      <tr
                        key={fee.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isChecked ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
                          opacity: isChecked ? 1 : 0.65
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleFeeToggle(idx)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--brand-teal)' }}
                          />
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-highlight)' }}>
                          {fee.name}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            background: fee.fee_type === 'PERCENTAGE' ? 'rgba(0, 150, 204, 0.12)' : fee.fee_type === 'FLAT' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: fee.fee_type === 'PERCENTAGE' ? '#0096cc' : fee.fee_type === 'FLAT' ? '#eab308' : '#10b981'
                          }}>
                            {fee.fee_type === 'PERCENTAGE' ? '% of Principal' : fee.fee_type === 'FLAT' ? 'Flat Fixed (₦)' : '% of Fees (VAT)'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <input
                              type="number"
                              step={fee.fee_type === 'FLAT' ? '1000' : '0.005'}
                              className="form-input"
                              style={{ width: '90px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                              value={fee.rate}
                              onChange={(e) => handleFeeRateChange(idx, parseFloat(e.target.value) || 0)}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {fee.fee_type === 'FLAT' ? '₦' : '%'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isChecked ? '#ef4444' : 'var(--text-muted)' }}>
                          {isChecked ? `-₦${deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₦0.00'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          {fee.description || (fee.name.includes('Tracking') ? 'GPS unit for pledged vehicles' : fee.name.includes('Insurance') ? 'Collateral protection' : 'Facility charge')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          {fee.id?.startsWith('bespoke_') ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = caseFees.filter((_, i) => i !== idx);
                                setCaseFees(updated);
                                const calc = await calculateCaseFeesPreview(caseId, updated, application.amount);
                                setFeeCalc(calc);
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Standard</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Fee & Net Disbursement Calculation Summary Card */}
            <div style={{
              marginTop: '1.25rem',
              padding: '1rem',
              background: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gross Facility Principal</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>
                  ₦{application.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>Total Upfront Deductions ({feeCalc?.effective_fee_percentage ?? 0}%)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
                  -₦{(feeCalc?.total_fees ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ borderLeft: '2px solid #10b981', paddingLeft: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Net Disbursed to Obligor Account</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                  ₦{(feeCalc?.net_disbursement ?? application.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

          </div>

          {/* POST-APPROVAL LEGAL DOCUMENT PACKAGE VIEWER */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCheck size={20} color="var(--brand-teal-light)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                    Opticom Post-Approval Legal Document Suite
                  </h3>
                  <span className="status-pill pill-cyan" style={{ fontSize: '0.7rem' }}>
                    {offerDocuments.length} Documents Generated
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Official legal instrument package automatically rendered from Opticom executive contract templates. Dynamically bound with obligor, guarantor, 7-day grace period, and 5% monthly default covenants.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!offerDocuments[selectedDocIndex]) return;
                    const doc = offerDocuments[selectedDocIndex];
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>${doc.title} - ${caseData.case_number}</title>
                            <style>
                              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #041326; background: #fff; line-height: 1.5; }
                              @page { size: A4; margin: 20mm; }
                              @media print { body { padding: 0; } }
                              .legal-doc { max-width: 800px; margin: 0 auto; }
                            </style>
                          </head>
                          <body>
                            ${doc.html}
                            <script>window.onload = function() { window.print(); };</script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={14} /> Print / Export PDF
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!offerDocuments[selectedDocIndex]) return;
                    const doc = offerDocuments[selectedDocIndex];
                    const blob = new Blob([doc.html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = doc.filename || `${doc.doc_type}_${caseData.case_number}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Download size={14} /> Download File
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (!offerDocuments[selectedDocIndex]) return;
                    navigator.clipboard.writeText(offerDocuments[selectedDocIndex].html);
                    setCopiedDoc(true);
                    setTimeout(() => setCopiedDoc(false), 2000);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Copy size={14} /> {copiedDoc ? 'Copied HTML!' : 'Copy Code'}
                </button>
              </div>
            </div>

            {loadingOfferDocs ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
                <div>Compiling and rendering post-approval legal documents...</div>
              </div>
            ) : offerDocuments.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem',
                background: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)'
              }}>
                <FileText size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <div>Legal documents suite will be compiled upon executive credit approval.</div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={loadOfferDocuments}
                  style={{ marginTop: '0.75rem' }}
                >
                  Preview Current Documents Now
                </button>
              </div>
            ) : (
              <div>
                {/* Document Selector Ribbon */}
                <div style={{
                  display: 'flex',
                  gap: '0.4rem',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '1rem'
                }}>
                  {offerDocuments.map((doc: any, idx: number) => {
                    const isSelected = idx === selectedDocIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDocIndex(idx)}
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: '6px',
                          border: isSelected ? '1.5px solid #0096cc' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(0, 150, 204, 0.15)' : 'var(--bg-surface)',
                          color: isSelected ? '#0096cc' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <span>{doc.title}</span>
                        {doc.is_mandatory && (
                          <span style={{ fontSize: '0.62rem', background: 'rgba(0, 150, 204, 0.2)', padding: '1px 5px', borderRadius: '4px' }}>
                            Req
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Document Info Bar */}
                {offerDocuments[selectedDocIndex] && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.85rem',
                    background: 'var(--bg-surface)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem',
                    fontSize: '0.75rem'
                  }}>
                    <div>
                      <strong style={{ color: 'var(--text-highlight)' }}>{offerDocuments[selectedDocIndex].title}</strong> &bull;{' '}
                      <span style={{ color: 'var(--text-muted)' }}>{offerDocuments[selectedDocIndex].subtitle}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {offerDocuments[selectedDocIndex].filename}
                      </span>
                    </div>
                  </div>
                )}

                {/* Rendered Legal Document Container */}
                {offerDocuments[selectedDocIndex] && (
                  <div style={{
                    background: '#ffffff',
                    color: '#041326',
                    borderRadius: '8px',
                    padding: '2.5rem',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                    maxHeight: '650px',
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif"
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: offerDocuments[selectedDocIndex].html }} />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 6: TREASURY & LOAN-DISC */}
      {activeTab === 'TREASURY' && (
        <div style={{ width: '100%' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-cerulean)', fontFamily: 'var(--font-display)' }}>
                  LOAN-DISC Core Banking &amp; Facility Booking
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Opticom's primary Loan Management System (LMS). Books approved commercial facilities, generates amortization schedules, and tracks loan servicing.
                </p>
              </div>
              <span className="status-pill pill-cyan" style={{ fontSize: '0.72rem' }}>
                SOLE CORE LMS
              </span>
            </div>

            {/* Approved Facility Summary Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              padding: '1.25rem',
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #e2e8f0',
              marginBottom: '1.75rem'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Facility Quantum</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                  ₦{application.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Tenor &amp; Rate</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0096cc', marginTop: '0.2rem' }}>
                  {application.tenor} Mos @ {activeOffer?.interest_rate_pct || 28}% APR
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Borrower Entity</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginTop: '0.2rem' }}>
                  {customer.name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Lifecycle State</div>
                <div style={{ marginTop: '0.2rem' }}>
                  <span className={`status-pill pill-${caseData.state.toLowerCase().includes('disburs') ? 'emerald' : 'cyan'}`} style={{ fontSize: '0.72rem' }}>
                    {caseData.state}
                  </span>
                </div>
              </div>
            </div>

            {disbursements.length > 0 && (disbursements[0].status === 'RECONCILED' || caseData.state === 'Disbursed / Monitoring') ? (
              <div style={{
                padding: '1.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(5, 150, 105, 0.05)',
                border: '1px solid rgba(5, 150, 105, 0.25)',
                textAlign: 'center'
              }}>
                <CheckCircle size={36} color="#059669" style={{ margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#065f46', marginBottom: '0.35rem' }}>
                  Facility Successfully Booked &amp; Active in LOAN-DISC
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#047857', maxWidth: '500px', margin: '0 auto 1.25rem auto' }}>
                  Amortization schedule created, disbursement advice dispatched to borrower, and active portfolio monitoring initiated.
                </p>
                <div style={{ display: 'inline-flex', gap: '1.5rem', background: '#ffffff', padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>LOAN-DISC Facility ID</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      {disbursements[0].nav_reference || 'LD-ACTIVE-SERVICING'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Servicing Status</span>
                    <strong style={{ fontSize: '0.9rem', color: '#059669' }}>ACTIVE_SERVICING</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* 1-Click Automated Execution Card */}
                <div style={{
                  padding: '1.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
                  border: '1px solid rgba(0, 150, 204, 0.25)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(0, 150, 204, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap size={18} color="#0096cc" />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                        Automated 1-Click LOAN-DISC Disbursement
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Zero manual paperwork: Clicking records disbursement and LOAN-DISC automatically picks it up.
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: '0.75rem',
                    background: '#ffffff',
                    padding: '1rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.82rem',
                    marginTop: '1.25rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Verified Borrower</span>
                      <strong style={{ color: '#0f172a' }}>{customer.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Net Disbursable</span>
                      <strong style={{ color: '#0096cc', fontFamily: 'var(--font-mono)' }}>₦{application.amount.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Auto Voucher Ref</span>
                      <strong style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>LD-DISB-{caseData.case_number}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Target Core LMS</span>
                      <strong style={{ color: '#059669' }}>LOAN-DISC Servicing</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleOneClickDisburse}
                    disabled={actionLoading || (caseData.state !== 'Ready for Disbursement' && caseData.state !== 'Offer Accepted')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1.02rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(0, 150, 204, 0.35)'
                    }}
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw size={18} className="spin" /> Recording Disbursement &amp; Syncing to LOAN-DISC...
                      </>
                    ) : (
                      <>
                        <Zap size={18} /> Record Disbursement &amp; Sync to LOAN-DISC (1-Click)
                      </>
                    )}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.74rem', color: '#64748b' }}>
                    ⚡ Automates voucher recording, schedule generation, borrower SMS dispatch, and LOAN-DISC portfolio ingestion.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: EXCEPTIONS & REWORK HISTORY */}
      {activeTab === 'EXCEPTIONS' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-teal-light)' }}>
                Case Exception Log & Rework Audit Trail
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Flowchart lifecycle tracking: Category &rarr; Designated Owner &rarr; Rework / Applicant Upload &rarr; Material Change Approval Check.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowRaiseModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <PlusCircle size={15} /> Record Exception
            </button>
          </div>

          {exceptions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No exceptions have been recorded for this credit case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {exceptions.map((ex: any) => (
                <div
                  key={ex.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="status-pill pill-amber" style={{ fontSize: '0.72rem' }}>
                        {ex.category.replace(/_/g, ' ')}
                      </span>
                      <span className={`status-pill ${ex.status === 'RESOLVED' ? 'pill-green' : 'pill-cyan'}`} style={{ fontSize: '0.72rem' }}>
                        {ex.status}
                      </span>
                      {ex.is_material_change && (
                        <span className="status-pill pill-red" style={{ fontSize: '0.72rem' }}>
                          Material Credit Change
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--accent-gold)' }}>
                      <Clock size={13} /> SLA: {ex.sla_hours}h &bull; Created: {new Date(ex.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '0.35rem' }}>
                    {ex.reason}
                  </div>
                  {ex.comments && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {ex.comments}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem', marginTop: '0.5rem' }}>
                    <div>Originator: <strong style={{ color: 'var(--text-highlight)' }}>{ex.originator_role}</strong></div>
                    <div>Assigned Owner: <strong style={{ color: 'var(--brand-teal-light)' }}>{ex.owner}</strong></div>
                    <div>Origin Stage: <strong style={{ color: 'var(--text-highlight)' }}>{ex.origin_stage}</strong></div>
                    <div>Return Stage: <strong style={{ color: 'var(--text-highlight)' }}>{ex.return_stage}</strong></div>
                  </div>

                  {ex.resolution_notes && (
                    <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: 'rgba(0, 150, 204, 0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--brand-cerulean)' }}>
                      <strong>Resolution ({ex.resolved_by}):</strong> {ex.resolution_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: LOAN PERFORMANCE & SERVICING TELEMETRY */}
      {activeTab === 'TELEMETRY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Policy Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: '1px solid rgba(0, 150, 204, 0.25)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-highlight)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={16} color="#0096cc" /> Opticom Post-Disbursement Servicing &amp; Telemetry
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Policy: <strong>7-Day Grace Period</strong> post installment due date. If unserviced on Day 8+, an automated <strong>5% Default Penalty</strong> is levied.
              </div>
            </div>

            {/* Quick Demo Scenario Controls */}
            {loanPerformance && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulate Status:</span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  onClick={async () => {
                    await simulateLoanPerformanceStatus(caseData.id, 'CURRENT');
                    await loadLoanPerformance(caseData.id);
                  }}
                >
                  Current (0d)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#d97706', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                  onClick={async () => {
                    await simulateLoanPerformanceStatus(caseData.id, 'GRACE_PERIOD');
                    await loadLoanPerformance(caseData.id);
                  }}
                >
                  Grace (4d)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={async () => {
                    await simulateLoanPerformanceStatus(caseData.id, 'OVERDUE_PENALTY');
                    await loadLoanPerformance(caseData.id);
                  }}
                >
                  5% Penalty (10d)
                </button>
              </div>
            )}
          </div>

          {!loanPerformance ? (
            <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <div>No active loan performance telemetry initialized yet.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Telemetry automatically activates when this facility completes Treasury disbursement and LOAN-DISC booking.
              </div>
            </div>
          ) : (
            <>
              {/* Financial Performance KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disbursed Principal</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-highlight)' }}>
                    ₦{loanPerformance.disbursed_principal?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {loanPerformance.tenor_months}M Tenor @ {loanPerformance.interest_rate_apr}% APR
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Installment</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0096cc' }}>
                    ₦{loanPerformance.monthly_installment?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Serviced: {loanPerformance.installments_serviced} / {loanPerformance.total_installments_count}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Serviced (Paid)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                    ₦{loanPerformance.total_amount_serviced?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Principal: ₦{loanPerformance.principal_serviced?.toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Debt Balance</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>
                    ₦{loanPerformance.outstanding_total?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Outstanding Principal: ₦{loanPerformance.outstanding_principal?.toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Penalty Accrual (5%)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: loanPerformance.penalty_accrued > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                    ₦{loanPerformance.penalty_accrued?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Overdue: {loanPerformance.days_overdue} days (Grace: {loanPerformance.grace_period_days}d)
                  </div>
                </div>
              </div>

              {/* Amortization Schedule Table */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--text-highlight)' }}>
                  Amortization &amp; Servicing Schedule
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>Inst. #</th>
                        <th style={{ padding: '8px 12px' }}>Due Date</th>
                        <th style={{ padding: '8px 12px' }}>Principal Due</th>
                        <th style={{ padding: '8px 12px' }}>Interest Due</th>
                        <th style={{ padding: '8px 12px' }}>Total Installment</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Serviced At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(loanPerformance.repayment_schedule || []).map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: item.status === 'SERVICED' ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>Period {item.installment_no}</td>
                          <td style={{ padding: '8px 12px' }}>{item.due_date}</td>
                          <td style={{ padding: '8px 12px' }}>₦{Number(item.principal_due).toLocaleString()}</td>
                          <td style={{ padding: '8px 12px' }}>₦{Number(item.interest_due).toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-highlight)' }}>₦{Number(item.total_installment).toLocaleString()}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {item.status === 'SERVICED' ? (
                              <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Serviced</span>
                            ) : item.status === 'OVERDUE' ? (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠ Overdue</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                            {item.serviced_at ? new Date(item.serviced_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* RECORD EXCEPTION MODAL */}
      {showRaiseModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '0.5rem' }}>
              Record Credit Exception — {caseData.case_number}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Flowchart: <strong>Case ID + Reason + Originator Owner + Comments + SLA + Version</strong>
            </p>

            <form onSubmit={handleRaiseExceptionSubmit}>
              <div className="form-group">
                <label className="form-label">Flowchart Exception Category *</label>
                <select
                  className="form-select"
                  value={raiseCategory}
                  onChange={(e) => setRaiseCategory(e.target.value)}
                >
                  <option value="TECHNICAL_FAILURE">1. Technical Failure (IT / Integration)</option>
                  <option value="INTERNAL_CORRECTION">2. Internal Correction (Credit Analyst)</option>
                  <option value="REJECTION_RECOMMENDATION">3. Rejection Recommendation (Decision-Maker)</option>
                  <option value="RISK_RECONSIDERATION">4. Risk Reconsideration (HRM)</option>
                  <option value="WITHDRAWAL_EXPIRY">5. Withdrawal / Expiry (Credit Ops)</option>
                  <option value="APPLICANT_CORRECTION">6. Applicant Correction (BDO / Applicant)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Originator Persona</label>
                  <input
                    type="text"
                    className="form-input"
                    disabled
                    value={`${currentPersona} Officer`}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SLA Hours *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={raiseSla}
                    onChange={(e) => setRaiseSla(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Reason *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Utility bill discrepancy, financial turnover mismatch, risk concern..."
                  value={raiseReason}
                  onChange={(e) => setRaiseReason(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Comments & Context</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Provide supporting notes or directives for the designated owner..."
                  value={raiseComments}
                  onChange={(e) => setRaiseComments(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRaiseModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Recording...' : 'Record & Route Exception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
