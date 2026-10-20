import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, FileText, CheckCircle, AlertTriangle, ShieldCheck,
  Send, RefreshCw, Cpu, UserCheck, CheckSquare, DollarSign, ExternalLink
} from 'lucide-react';
import {
  fetchCaseWorkspace, generateAICam, updateCam, submitApprovalDecision,
  generateOffer, takeOfferAction, updateCondition, confirmNavDisbursement,
  syncLoanDisc
} from '../services/api';

interface CaseWorkspaceProps {
  caseId: string;
  currentPersona: string;
  onBack: () => void;
}

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({ caseId, currentPersona, onBack }) => {
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DOSSIER' | 'FINANCIALS' | 'CAM' | 'APPROVALS' | 'OFFER_CONDITIONS' | 'TREASURY'>('DOSSIER');
  
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

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const data = await fetchCaseWorkspace(caseId);
      setWorkspace(data);
      if (data.cam_versions && data.cam_versions.length > 0) {
        setSelectedCamIndex(data.cam_versions.length - 1);
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
      const res = await generateOffer(caseData.id, { actor: currentPersona });
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
                Borrower: <strong style={{ color: '#fff' }}>{customer.name}</strong> &bull; Amount: <strong style={{ color: '#fff' }}>₦{application.amount.toLocaleString()}</strong> ({application.tenor}M) &bull; Owner: {caseData.assigned_owner}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Workflow State:</span>
            <span className="status-pill pill-green" style={{ fontSize: '0.9rem', padding: '0.4rem 0.9rem' }}>
              {caseData.state}
            </span>
          </div>
        </div>
      </div>

      {/* Alert banner */}
      {messageBanner && (
        <div className={`flag-banner flag-${messageBanner.type === 'success' ? 'MEDIUM' : 'CRITICAL'}`} style={{ marginBottom: '1rem' }}>
          {messageBanner.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{messageBanner.text}</span>
        </div>
      )}

      {/* Dossier Tabs */}
      <div className="nav-bar" style={{ padding: '0.5rem 0', background: 'transparent', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
        <button className={`nav-item ${activeTab === 'DOSSIER' ? 'active' : ''}`} onClick={() => setActiveTab('DOSSIER')}>
          1. Dossier & Documents ({documents.length})
        </button>
        <button className={`nav-item ${activeTab === 'FINANCIALS' ? 'active' : ''}`} onClick={() => setActiveTab('FINANCIALS')}>
          2. Financial Analysis & Rules {flags.length > 0 && <span className="nav-badge alert">{flags.length}</span>}
        </button>
        <button className={`nav-item ${activeTab === 'CAM' ? 'active' : ''}`} onClick={() => setActiveTab('CAM')}>
          3. AI CAM Assistant ({cam_versions.length})
        </button>
        <button className={`nav-item ${activeTab === 'APPROVALS' ? 'active' : ''}`} onClick={() => setActiveTab('APPROVALS')}>
          4. Approvals & Authority ({approvals.length})
        </button>
        <button className={`nav-item ${activeTab === 'OFFER_CONDITIONS' ? 'active' : ''}`} onClick={() => setActiveTab('OFFER_CONDITIONS')}>
          5. Offer & Conditions Precedent ({conditions.length})
        </button>
        <button className={`nav-item ${activeTab === 'TREASURY' ? 'active' : ''}`} onClick={() => setActiveTab('TREASURY')}>
          6. Treasury NAV & LOAN-DISC
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
              <div><span style={{ color: 'var(--text-muted)' }}>Customer Name:</span> <strong style={{ color: '#fff' }}>{customer.name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Classification:</span> {customer.customer_type}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>BVN:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.bvn || 'Not Supplied'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>NIN:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.nin || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>RC / Reg Number:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.rc_number || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Phone:</span> {customer.phone || 'N/A'}</div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>Youverify / Identity Verification Records</h4>
              </div>

              {kyc_checks.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No KYC checks recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {kyc_checks.map((k: any) => (
                    <div key={k.id} style={{
                      padding: '0.75rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>Provider: {k.provider}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Ref: {k.provider_ref}</div>
                      </div>
                      <span className={`status-pill ${k.status === 'PASSED' ? 'pill-green' : 'pill-red'}`}>
                        {k.status}
                      </span>
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
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{d.original_filename}</div>
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
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
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
        <div className="split-view" style={{ gridTemplateColumns: '280px 1fr' }}>
          {/* Version sidebar */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>CAM Versions</h4>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateCam}
                disabled={actionLoading}
              >
                <Cpu size={14} /> New Draft
              </button>
            </div>

            {cam_versions.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No CAM drafts generated yet. Click "New Draft".</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cam_versions.map((cv: any, index: number) => (
                  <div
                    key={cv.id}
                    onClick={() => setSelectedCamIndex(index)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: selectedCamIndex === index ? 'var(--brand-teal-dim)' : 'var(--bg-surface)',
                      border: `1px solid ${selectedCamIndex === index ? 'var(--brand-teal)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Version {cv.version}</strong>
                      <span className={`status-pill ${cv.analyst_sign_off ? 'pill-green' : 'pill-amber'}`} style={{ fontSize: '0.65rem' }}>
                        {cv.analyst_sign_off ? 'Validated' : 'Draft'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {new Date(cv.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CAM Document Viewer */}
          {latestCam ? (
            <div className="cam-document">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                    Credit Appraisal Memorandum (CAM) — v{latestCam.version}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Generated with Azure OpenAI ({latestCam.token_telemetry?.model || 'gpt-4o-mini'}) &bull; Tokens: {latestCam.token_telemetry?.total_tokens || 'N/A'}
                  </div>
                </div>

                {!latestCam.analyst_sign_off && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAnalystSignOff}
                    disabled={actionLoading}
                  >
                    <CheckSquare size={16} /> Analyst Sign-Off (Submit to HRM)
                  </button>
                )}
              </div>

              <div className="cam-section-title">1. Executive Summary</div>
              <p>{latestCam.executive_summary}</p>

              <div className="cam-section-title">2. Borrower Profile & KYC Summary</div>
              <p>{latestCam.borrower_profile}</p>

              <div className="cam-section-title">3. Facility Structure & Deterministic Amortization</div>
              <p>{latestCam.facility_structure}</p>

              <div className="cam-section-title">4. Financial Capacity & Debt Service Analysis</div>
              <p>{latestCam.financial_analysis}</p>

              <div className="cam-section-title">5. Key Risk Factors & Mitigants</div>
              <p style={{ whiteSpace: 'pre-line' }}>{latestCam.risk_and_mitigants}</p>

              <div className="cam-section-title">6. Credit Policy Exceptions</div>
              <p style={{ whiteSpace: 'pre-line' }}>{latestCam.policy_exceptions}</p>

              <div className="cam-section-title">7. Underwriting Recommendation</div>
              <p style={{ fontWeight: 700, color: latestCam.recommendation?.includes('ADVERSE') ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {latestCam.recommendation}
              </p>

              <div className="cam-section-title">8. Cited Source Evidence (PRD FR-06)</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {latestCam.evidence_citations?.map((cit: any, i: number) => (
                  <span key={i} className="citation-pill">
                    <ExternalLink size={12} /> {cit.citation}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No CAM version selected. Click "New Draft" to invoke Azure AI CAM assistant.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APPROVALS & AUTHORITY MATRIX */}
      {activeTab === 'APPROVALS' && (
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
                <option value="APPROVE">Approve Facility (Mandate Permitted)</option>
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
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#fff' }}>
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
                      <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{a.actor} ({a.authority_level})</strong>
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
      )}

      {/* TAB 5: OFFER & CONDITIONS PRECEDENT */}
      {activeTab === 'OFFER_CONDITIONS' && (
        <div className="split-view">
          {/* Offer Panel */}
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved Facility Amount:</span>
                    <strong style={{ fontSize: '1.1rem', color: '#fff' }}>₦{activeOffer.approved_amount.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly Installment:</span>
                    <strong style={{ color: 'var(--brand-teal-light)' }}>₦{activeOffer.monthly_repayment.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status:</span>
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
                  Facility is approved. Generate the official binding loan offer letter.
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
                        <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{c.description}</div>
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
      )}

      {/* TAB 6: TREASURY & LOAN-DISC */}
      {activeTab === 'TREASURY' && (
        <div className="split-view">
          {/* NAV Confirmation Form */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--brand-teal-light)' }}>
              Treasury NAV Disbursement Handoff (FR-15)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Human Treasury officer confirms facility booking and records confirmed Microsoft Dynamics NAV reference.
            </p>

            <form onSubmit={handleConfirmTreasuryNav}>
              <div className="form-group">
                <label className="form-label">Microsoft Dynamics NAV Reference *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. NAV-2026-DISB-9941"
                  value={navReference}
                  onChange={(e) => setNavReference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmation Evidence / Reference Advice *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  required
                  placeholder="Confirmed transfer advice via CBN RTGS / NIP core banking entry..."
                  value={navEvidence}
                  onChange={(e) => setNavEvidence(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading || caseData.state !== 'Ready for Disbursement'}
                style={{ width: '100%' }}
              >
                <DollarSign size={16} /> Confirm NAV Disbursement
              </button>
            </form>
          </div>

          {/* LOAN-DISC Push */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--brand-teal-light)' }}>
              LOAN-DISC Post-Disbursement Sync (FR-16)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Synchronizes confirmed loan facility to LOAN-DISC for ongoing repayment servicing and portfolio monitoring.
            </p>

            {disbursements.length > 0 && disbursements[0].status === 'CONFIRMED' ? (
              <div>
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>NAV Ref: {disbursements[0].nav_reference}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {disbursements[0].status}</div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSyncLoanDiscClick}
                  disabled={actionLoading}
                  style={{ width: '100%' }}
                >
                  <Send size={16} /> Push to LOAN-DISC (Idempotent Delivery)
                </button>
              </div>
            ) : disbursements.length > 0 && disbursements[0].status === 'RECONCILED' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '0.9rem' }}>
                <CheckCircle size={20} />
                <span>Facility successfully synchronized with LOAN-DISC. Servicing active.</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Waiting for confirmed NAV disbursement before enabling LOAN-DISC synchronization.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
