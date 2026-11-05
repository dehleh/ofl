import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, FileText, CheckCircle, AlertTriangle, ShieldCheck,
  Send, RefreshCw, Cpu, UserCheck, CheckSquare, DollarSign, ExternalLink,
  ShieldAlert, Clock, PlusCircle, Zap, Receipt, Plus, Trash2, Percent
} from 'lucide-react';
import {
  fetchCaseWorkspace, generateAICam, updateCam, submitApprovalDecision,
  generateOffer, takeOfferAction, updateCondition, confirmNavDisbursement,
  executeOneClickLoandiscDisbursement, syncLoanDisc, raiseException, triggerYouverifyKyc,
  fetchCaseFees, updateCaseFees, calculateCaseFeesPreview
} from '../services/api';
import { OpticomCamDocument } from '../components/OpticomCamDocument';
import { BankStatementAnalyzerCard } from '../components/BankStatementAnalyzerCard';

interface CaseWorkspaceProps {
  caseId: string;
  currentPersona: string;
  onBack: () => void;
}

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({ caseId, currentPersona, onBack }) => {
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DOSSIER' | 'FINANCIALS' | 'CAM' | 'APPROVALS' | 'OFFER_CONDITIONS' | 'TREASURY' | 'EXCEPTIONS'>('DOSSIER');

  // State for actions
  const [actionLoading, setActionLoading] = useState(false);
  const [messageBanner, setMessageBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approval Form State
  const [approvalDecision, setApprovalDecision] = useState<'APPROVE' | 'RECOMMEND_APPROVE' | 'RETURN_FOR_REWORK' | 'REJECT'>('APPROVE');
  const [approvalComments, setApprovalComments] = useState('');
  const [mandatedCondition, setMandatedCondition] = useState('');

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

  // Youverify Verification State
  const [kycLoading, setKycLoading] = useState(false);

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

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const data = await fetchCaseWorkspace(caseId);
      setWorkspace(data);
      if (data.cam_versions && data.cam_versions.length > 0) {
        setSelectedCamIndex(data.cam_versions.length - 1);
      }
      loadCaseFees();
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

  const { case: caseData, customer, application, documents, kyc_checks, financial_assessment, cam_versions, exceptions, approvals, offers, conditions, disbursements } = workspace;
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
        actor: `${currentPersona} Officer`,
        role: currentPersona,
        comments: approvalComments || `${approvalDecision} decision recorded by ${currentPersona}`,
        conditions_mandated: conditionsList
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
    <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
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

      {/* Dossier Tabs */}
      <div className="nav-bar" style={{ padding: '0.5rem 0', background: 'transparent', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', overflowX: 'auto', display: 'flex', gap: '0.35rem' }}>
        <button className={`nav-item ${activeTab === 'DOSSIER' ? 'active' : ''}`} onClick={() => setActiveTab('DOSSIER')}>
          1. Dossier ({documents.length})
        </button>
        <button className={`nav-item ${activeTab === 'FINANCIALS' ? 'active' : ''}`} onClick={() => setActiveTab('FINANCIALS')}>
          2. Financial Analysis {flags.length > 0 && <span className="nav-badge alert">{flags.length}</span>}
        </button>
        <button className={`nav-item ${activeTab === 'CAM' ? 'active' : ''}`} onClick={() => setActiveTab('CAM')}>
          3. AI CAM ({cam_versions.length})
        </button>
        <button className={`nav-item ${activeTab === 'APPROVALS' ? 'active' : ''}`} onClick={() => setActiveTab('APPROVALS')}>
          4. Approvals ({approvals.length})
        </button>
        <button className={`nav-item ${activeTab === 'OFFER_CONDITIONS' ? 'active' : ''}`} onClick={() => setActiveTab('OFFER_CONDITIONS')}>
          5. Offer & Conditions ({conditions.length})
        </button>
        <button className={`nav-item ${activeTab === 'TREASURY' ? 'active' : ''}`} onClick={() => setActiveTab('TREASURY')}>
          6. Treasury LOAN-DISC
        </button>
        <button className={`nav-item ${activeTab === 'EXCEPTIONS' ? 'active' : ''}`} onClick={() => setActiveTab('EXCEPTIONS')}>
          7. Exceptions ({exceptions.length})
        </button>
      </div>

      {/* TAB 1: DOSSIER & DOCUMENTS */}
      {activeTab === 'DOSSIER' && (
        <div className="split-view">
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--brand-teal-light)' }}>
              Borrower Profile & Identity Verification
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Customer Name:</span> <strong style={{ color: 'var(--text-highlight)' }}>{customer.name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Classification:</span> {customer.customer_type}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>BVN:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.bvn || 'Not Supplied'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>NIN:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.nin || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>RC / Reg Number:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.rc_number || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Phone:</span> {customer.phone || 'N/A'}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: application.amount > 20000000 ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'Analyst Review' ? 'rgba(0, 150, 204, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'Analyst Review' ? '#0096cc' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 1</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-highlight)' }}>Analyst</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CAM Recommendation</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'HRM Review' ? 'rgba(0, 150, 204, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'HRM Review' ? '#0096cc' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 2</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-highlight)' }}>HRM</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Initial Risk Review</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'Head of BD Review' ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'Head of BD Review' ? '#eab308' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 3</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#eab308' }}>Head of BD</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Commercial Sanction</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 4</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-highlight)' }}>HRM</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Final Concurrence</div>
              </div>

              <div style={{
                padding: '0.65rem 0.4rem',
                borderRadius: '6px',
                background: caseData.state === 'MD Decision' ? 'rgba(0, 150, 204, 0.2)' : 'var(--bg-surface)',
                border: `1px solid ${caseData.state === 'MD Decision' ? '#0096cc' : 'var(--border-subtle)'}`
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STEP 5</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: application.amount > 20000000 ? 'var(--text-highlight)' : '#10b981' }}>
                  MD {application.amount <= 20000000 ? '(Final Sanction)' : '(Review)'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Executive Endorsement</div>
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

          <div className="split-view">
            {/* Decision Form */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--brand-teal-light)' }}>
                Record Authority Decision (FR-08, FR-09, FR-10)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Active Persona: <strong>{currentPersona}</strong> &bull; Loan Amount: <strong>₦{application.amount.toLocaleString()}</strong>
              </p>

              <div className="form-group">
                <label className="form-label">Decision Action</label>
                <select
                  className="form-select"
                  value={approvalDecision}
                  onChange={(e: any) => setApprovalDecision(e.target.value)}
                >
                  <option value="APPROVE">Approve Facility / Advance to Next Sequential Authority</option>
                  <option value="RECOMMEND_APPROVE">Recommend Approval (Forward to Next Tier)</option>
                  <option value="RETURN_FOR_REWORK">Return for Internal Rework (Opens Exception)</option>
                  <option value="REJECT">Decline Application (Final Rejection)</option>
                </select>
              </div>

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

        </div>
      )}

      {/* TAB 6: TREASURY & LOAN-DISC */}
      {activeTab === 'TREASURY' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
