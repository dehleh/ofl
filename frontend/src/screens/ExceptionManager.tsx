import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  RefreshCw, 
  UserCheck, 
  FileEdit, 
  XCircle, 
  Send, 
  AlertTriangle,
  CheckCheck,
  PlusCircle,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { 
  fetchExceptions, 
  resolveException, 
  raiseException, 
  takeExceptionAction 
} from '../services/api';

interface ExceptionManagerProps {
  onOpenCase: (caseId: string) => void;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Exceptions' },
  { id: 'TECHNICAL_FAILURE', label: '1. Technical Failure' },
  { id: 'INTERNAL_CORRECTION', label: '2. Internal Correction' },
  { id: 'REJECTION_RECOMMENDATION', label: '3. Rejection Recommendation' },
  { id: 'RISK_RECONSIDERATION', label: '4. Risk Reconsideration' },
  { id: 'WITHDRAWAL_EXPIRY', label: '5. Withdrawal / Expiry' },
  { id: 'APPLICANT_CORRECTION', label: '6. Applicant Correction' },
];

export const ExceptionManager: React.FC<ExceptionManagerProps> = ({ onOpenCase }) => {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  
  // Selected exception for action modal
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Action Form States
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isMaterialChange, setIsMaterialChange] = useState(false);
  const [rejectionDecision, setRejectionDecision] = useState<'REJECT' | 'FURTHER_ASSESSMENT'>('REJECT');
  const [applicantRequestNotes, setApplicantRequestNotes] = useState('');
  const [requestedDocs, setRequestedDocs] = useState('');
  const [validationDecision, setValidationDecision] = useState<'YES' | 'NO'>('YES');
  const [withdrawalDecision, setWithdrawalDecision] = useState<'CLOSE' | 'RENEW'>('CLOSE');

  // Raise Exception Modal State
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [raiseForm, setRaiseForm] = useState({
    case_id: '',
    category: 'INTERNAL_CORRECTION',
    originator_role: 'ANALYST',
    originator_name: 'Credit Analyst',
    reason: '',
    comments: '',
    sla_hours: 24
  });

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await fetchExceptions({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        category: activeTab === 'ALL' ? undefined : activeTab
      });
      setExceptions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, [activeTab, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = exceptions.length;
    const breached = exceptions.filter(e => e.is_breached).length;
    const applicantReq = exceptions.filter(e => e.applicant_action_required).length;
    const technical = exceptions.filter(e => e.category === 'TECHNICAL_FAILURE').length;
    return { total, breached, applicantReq, technical };
  }, [exceptions]);

  // Open action modal and reset inputs
  const handleOpenAction = (ex: any) => {
    setSelectedException(ex);
    setResolutionNotes('');
    setIsMaterialChange(false);
    setActionError(null);
    setApplicantRequestNotes((ex.action_payload?.applicant_request?.message) || '');
    setRequestedDocs((ex.action_payload?.applicant_request?.requested_documents || []).join(', '));
  };

  // Branch 1: Technical Failure
  const handleTechnicalAction = async (decision: 'RETRY' | 'RESTORE') => {
    if (!selectedException) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await takeExceptionAction(selectedException.id, {
        action_type: 'RETRY_TECHNICAL',
        actor: 'IT / Integration Owner',
        decision,
        notes: resolutionNotes || (decision === 'RESTORE' ? 'Restored original workflow state following reconciliation' : 'Executed API retry')
      });
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Branch 2: Internal Correction & Material Change Convergence
  const handleInternalCorrectionResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException || !resolutionNotes.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await resolveException(selectedException.id, {
        resolution_notes: resolutionNotes,
        resolved_by: 'Credit Analyst',
        is_material_change: isMaterialChange,
        resolution_category: 'REVISED_CAM'
      });
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Resolution failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Branch 3: Rejection Recommendation
  const handleRejectionDecision = async () => {
    if (!selectedException || !resolutionNotes.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await takeExceptionAction(selectedException.id, {
        action_type: 'REJECTION_DECISION',
        actor: 'Authorised Decision-Maker',
        decision: rejectionDecision,
        notes: resolutionNotes
      });
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Decision failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Branch 4: Risk Reconsideration / HRM Coordinate
  const handleHrmCoordinate = async () => {
    if (!selectedException || !resolutionNotes.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await takeExceptionAction(selectedException.id, {
        action_type: 'HRM_COORDINATE',
        actor: 'Head of Risk Management',
        notes: resolutionNotes
      });
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Coordination failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Branch 5: Withdrawal / Expiry
  const handleWithdrawalDecision = async () => {
    if (!selectedException) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await takeExceptionAction(selectedException.id, {
        action_type: 'WITHDRAWAL_DECISION',
        actor: 'Credit Operations Officer',
        decision: withdrawalDecision,
        notes: resolutionNotes || `Processed under withdrawal/expiry rules: ${withdrawalDecision}`
      });
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Branch 6: Applicant Correction - Send Request
  const handleSendApplicantRequest = async () => {
    if (!selectedException || !applicantRequestNotes.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const docList = requestedDocs.split(',').map(d => d.trim()).filter(Boolean);
      await takeExceptionAction(selectedException.id, {
        action_type: 'SEND_APPLICANT_REQUEST',
        actor: 'Credit Analyst / BDO',
        notes: applicantRequestNotes,
        details: { documents: docList }
      });
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Request failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Branch 6: Applicant Correction - Validate Changes & Convergence
  const handleAnalystValidateChanges = async () => {
    if (!selectedException || !resolutionNotes.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (validationDecision === 'NO') {
        // Loops back to applicant request
        await takeExceptionAction(selectedException.id, {
          action_type: 'ANALYST_VALIDATE',
          actor: 'Credit Analyst',
          decision: 'NO',
          notes: resolutionNotes
        });
      } else {
        // Validated! Now resolve and check material credit change
        await takeExceptionAction(selectedException.id, {
          action_type: 'ANALYST_VALIDATE',
          actor: 'Credit Analyst',
          decision: 'YES',
          notes: resolutionNotes
        });
        await resolveException(selectedException.id, {
          resolution_notes: resolutionNotes,
          resolved_by: 'Credit Analyst',
          is_material_change: isMaterialChange,
          resolution_category: 'APPLICANT_CORRECTED'
        });
      }
      setSelectedException(null);
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Validation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Raise Exception Submit
  const handleRaiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raiseForm.case_id.trim() || !raiseForm.reason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await raiseException({
        case_id: raiseForm.case_id.trim(),
        category: raiseForm.category,
        originator_role: raiseForm.originator_role,
        originator_name: raiseForm.originator_name,
        reason: raiseForm.reason,
        comments: raiseForm.comments,
        sla_hours: Number(raiseForm.sla_hours)
      });
      setShowRaiseModal(false);
      setRaiseForm({
        case_id: '',
        category: 'INTERNAL_CORRECTION',
        originator_role: 'ANALYST',
        originator_name: 'Credit Analyst',
        reason: '',
        comments: '',
        sla_hours: 24
      });
      await loadExceptions();
    } catch (err: any) {
      setActionError(err.detail || err.message || 'Failed to raise exception');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Top Header & Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-highlight)' }}>Credit Exception Handling Architecture</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Multi-branch exception routing, automated SLA aging, applicant clarification loops, and material change approval invalidation (PRD Section 6.1 & Flowchart).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowRaiseModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={16} /> Record Exception
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={loadExceptions}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Total Open Queue</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>{stats.total}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>SLA Breaches</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: stats.breached > 0 ? 'var(--status-critical)' : 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)' }}>
            {stats.breached}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Applicant Action Pending</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
            {stats.applicantReq}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>IT Technical Failures</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
            {stats.technical}
          </div>
        </div>
      </div>

      {/* Flowchart 6 Category Tabs */}
      <div className="nav-bar" style={{ padding: '0.5rem 0', background: 'transparent', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', overflowX: 'auto', display: 'flex', gap: '0.5rem' }}>
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status Filter Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status Filter:</span>
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ALL'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(s)}
            style={{ fontSize: '0.75rem' }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main Exceptions Table */}
      <div className="glass-panel data-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading exception items...
          </div>
        ) : exceptions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No exceptions found in this category / filter. All cases operating smoothly.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Reference</th>
                <th>Category & Originator</th>
                <th>Assigned Owner</th>
                <th>SLA Aging</th>
                <th>Reason & Comments</th>
                <th>Status / Materiality</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => (
                <tr key={ex.id}>
                  <td>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-teal-light)' }}>
                      {ex.case_number}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-highlight)', marginTop: '0.15rem' }}>
                      {ex.borrower_name}
                    </div>
                  </td>
                  <td>
                    <span className="status-pill pill-amber" style={{ fontSize: '0.68rem', display: 'inline-block' }}>
                      {ex.category.replace(/_/g, ' ')}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Raised by: <strong style={{ color: 'var(--text-secondary)' }}>{ex.originator_role}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-highlight)' }}>
                      {ex.owner}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Stage: {ex.origin_stage}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: ex.is_breached ? 'var(--status-critical)' : 'var(--accent-gold)' }}>
                      <Clock size={14} /> 
                      {ex.sla_hours_left !== null ? (
                        ex.is_breached ? `${Math.abs(ex.sla_hours_left)}h Overdue` : `${ex.sla_hours_left}h remaining`
                      ) : (
                        `${ex.sla_hours}h SLA`
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Created: {new Date(ex.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-highlight)' }}>{ex.reason}</div>
                    {ex.comments && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{ex.comments}</div>}
                    {ex.applicant_action_required && (
                      <span className="status-pill pill-purple" style={{ fontSize: '0.65rem', marginTop: '0.3rem', display: 'inline-block' }}>
                        Waiting for Applicant
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${ex.status === 'RESOLVED' ? 'pill-green' : ex.status === 'IN_PROGRESS' ? 'pill-blue' : 'pill-amber'}`} style={{ fontSize: '0.7rem' }}>
                      {ex.status}
                    </span>
                    {ex.is_material_change && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--status-critical)', marginTop: '0.25rem', fontWeight: 700 }}>
                        Material Change: Rev Bumped
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {ex.status !== 'RESOLVED' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleOpenAction(ex)}
                        >
                          Process Flow
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => onOpenCase(ex.case_id)}
                      >
                        View Case
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DEDICATED FLOWCHART ACTION MODAL */}
      {selectedException && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <span className="status-pill pill-cyan" style={{ fontSize: '0.7rem' }}>
                  {selectedException.category.replace(/_/g, ' ')}
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '0.25rem' }}>
                  Exception Action: {selectedException.case_number}
                </h3>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedException(null)}
              >
                Close
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div><strong>Borrower:</strong> {selectedException.borrower_name} &bull; <strong>Assigned Owner:</strong> {selectedException.owner}</div>
              <div style={{ marginTop: '0.25rem' }}><strong>Reason:</strong> {selectedException.reason}</div>
              {selectedException.comments && <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}><strong>Comments:</strong> {selectedException.comments}</div>}
            </div>

            {actionError && (
              <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
                <AlertTriangle size={16} /> <span>{actionError}</span>
              </div>
            )}

            {/* BRANCH 1: TECHNICAL FAILURE */}
            {selectedException.category === 'TECHNICAL_FAILURE' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <strong>Flowchart Branch 1:</strong> IT Owner reconciles integration errors and restores the original workflow state.
                </p>
                <div className="form-group">
                  <label className="form-label">IT / Integration Reconciliation Notes *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Describe API replay, webhook resend, or database patch applied..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={actionLoading}
                    onClick={() => handleTechnicalAction('RETRY')}
                  >
                    Retry Integration Call
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actionLoading}
                    onClick={() => handleTechnicalAction('RESTORE')}
                  >
                    {actionLoading ? 'Processing...' : 'Reconcile & Restore State'}
                  </button>
                </div>
              </div>
            )}

            {/* BRANCH 2: INTERNAL CORRECTION */}
            {selectedException.category === 'INTERNAL_CORRECTION' && (
              <form onSubmit={handleInternalCorrectionResolve}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <strong>Flowchart Branch 2:</strong> Credit Analyst corrects CAM calculations, analysis, or ratios.
                </p>
                <div className="form-group">
                  <label className="form-label">Corrective CAM Actions & Calculation Changes *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    required
                    placeholder="Detail revised EBITDA, updated bank turnover multiple, or corrected DSR..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>

                {/* Material Credit Change Convergence Check */}
                <div style={{
                  background: 'rgba(0, 196, 159, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  marginTop: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      id="materialCheck"
                      checked={isMaterialChange}
                      onChange={(e) => setIsMaterialChange(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }}
                    />
                    <label htmlFor="materialCheck" style={{ fontWeight: 700, color: 'var(--text-highlight)', fontSize: '0.88rem', cursor: 'pointer' }}>
                      Material Credit Change?
                    </label>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginLeft: '1.9rem' }}>
                    {isMaterialChange 
                      ? 'YES: Under flowchart rules, affected prior approvals will be INVALIDATED, revision bumped, and the approval chain restarted.'
                      : 'NO: The case will return directly to the required reviewer with original comments preserved.'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Submit Revised CAM & Resolve'}
                  </button>
                </div>
              </form>
            )}

            {/* BRANCH 3: REJECTION RECOMMENDATION */}
            {selectedException.category === 'REJECTION_RECOMMENDATION' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <strong>Flowchart Branch 3:</strong> Routed to Authorised Decision-Maker (MD / BCC).
                </p>
                <div className="form-group">
                  <label className="form-label">Decision-Maker Ruling *</label>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="rejectionDec"
                        value="REJECT"
                        checked={rejectionDecision === 'REJECT'}
                        onChange={() => setRejectionDecision('REJECT')}
                      />
                      <span style={{ color: 'var(--status-critical)', fontWeight: 700 }}>Final Rejection (Decline & Close)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="rejectionDec"
                        value="FURTHER_ASSESSMENT"
                        checked={rejectionDecision === 'FURTHER_ASSESSMENT'}
                        onChange={() => setRejectionDecision('FURTHER_ASSESSMENT')}
                      />
                      <span style={{ color: 'var(--brand-teal-light)', fontWeight: 700 }}>Further Assessment (Route to HRM)</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Authority Ruling Comments / Assessment Instructions *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    required
                    placeholder={rejectionDecision === 'REJECT' ? 'Record official rejection reason and authority citation...' : 'Instructions for HRM reassessment coordination...'}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${rejectionDecision === 'REJECT' ? 'btn-danger' : 'btn-primary'}`}
                    disabled={actionLoading}
                    onClick={handleRejectionDecision}
                  >
                    {actionLoading ? 'Processing...' : rejectionDecision === 'REJECT' ? 'Record Final Rejection & Close' : 'Route to HRM for Reassessment'}
                  </button>
                </div>
              </div>
            )}

            {/* BRANCH 4: RISK RECONSIDERATION */}
            {selectedException.category === 'RISK_RECONSIDERATION' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <strong>Flowchart Branch 4:</strong> Route to HRM &rarr; HRM Coordinates Reassessment &rarr; Analyst Revises.
                </p>
                <div className="form-group">
                  <label className="form-label">HRM Reassessment Instructions for Credit Analyst *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Specify mitigation structures (e.g. personal guarantee, tripartite debt agreement, revised tenor)..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={handleHrmCoordinate}>
                    {actionLoading ? 'Routing...' : 'Coordinate with Analyst (Return to Review)'}
                  </button>
                </div>
              </div>
            )}

            {/* BRANCH 5: WITHDRAWAL / EXPIRY */}
            {selectedException.category === 'WITHDRAWAL_EXPIRY' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <strong>Flowchart Branch 5:</strong> Validate withdrawal/expiry rules and either close or renew as authorised.
                </p>
                <div className="form-group">
                  <label className="form-label">Action *</label>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="withDec"
                        value="CLOSE"
                        checked={withdrawalDecision === 'CLOSE'}
                        onChange={() => setWithdrawalDecision('CLOSE')}
                      />
                      <span style={{ color: 'var(--status-critical)', fontWeight: 700 }}>Validate Rules & Close Case (Withdrawn)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="withDec"
                        value="RENEW"
                        checked={withdrawalDecision === 'RENEW'}
                        onChange={() => setWithdrawalDecision('RENEW')}
                      />
                      <span style={{ color: 'var(--brand-teal-light)', fontWeight: 700 }}>Authorize Renewal</span>
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Operations Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Reference customer letter or expiration verification..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={handleWithdrawalDecision}>
                    {actionLoading ? 'Processing...' : 'Confirm Action'}
                  </button>
                </div>
              </div>
            )}

            {/* BRANCH 6: APPLICANT CORRECTION */}
            {selectedException.category === 'APPLICANT_CORRECTION' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <strong>Flowchart Branch 6:</strong> Assign to Analyst/BDO &rarr; Send Specific Request &rarr; Applicant Uploads/Corrects &rarr; Analyst Validates.
                </p>

                {/* Sub-step 1: View Applicant Response if submitted */}
                {selectedException.applicant_response?.notes && (
                  <div style={{
                    background: 'rgba(0, 196, 159, 0.08)',
                    border: '1px solid rgba(0, 196, 159, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ color: 'var(--brand-teal-light)', fontWeight: 700, marginBottom: '0.25rem' }}>
                      <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }} /> 
                      Applicant Submitted Corrections:
                    </div>
                    <div>"{selectedException.applicant_response.notes}"</div>
                    {selectedException.applicant_response.documents?.length > 0 && (
                      <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                        Attached documents: <strong>{selectedException.applicant_response.documents.join(', ')}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-step 2: If applicant response exists, show Analyst Validation */}
                {selectedException.applicant_response?.notes ? (
                  <div>
                    <div className="form-group">
                      <label className="form-label">Analyst Validation: Resolved? *</label>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="valDec"
                            value="YES"
                            checked={validationDecision === 'YES'}
                            onChange={() => setValidationDecision('YES')}
                          />
                          <span style={{ color: 'var(--brand-teal-light)', fontWeight: 700 }}>YES — Documents Legible & Valid</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="valDec"
                            value="NO"
                            checked={validationDecision === 'NO'}
                            onChange={() => setValidationDecision('NO')}
                          />
                          <span style={{ color: 'var(--status-critical)', fontWeight: 700 }}>NO — Insufficient (Resend Request)</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Validation Comments *</label>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        required
                        placeholder="Verified documents match CAC records / utility address..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                      />
                    </div>

                    {validationDecision === 'YES' && (
                      <div style={{
                        background: 'rgba(0, 196, 159, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.85rem 1rem',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="matCheck2"
                            checked={isMaterialChange}
                            onChange={(e) => setIsMaterialChange(e.target.checked)}
                          />
                          <label htmlFor="matCheck2" style={{ fontWeight: 700, color: 'var(--text-highlight)', fontSize: '0.85rem', cursor: 'pointer' }}>
                            Material Credit Change?
                          </label>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={handleAnalystValidateChanges}>
                        {actionLoading ? 'Saving...' : validationDecision === 'YES' ? 'Validate & Complete Convergence' : 'Resend Request to Applicant'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Sub-step 3: Send request to applicant */}
                    <div className="form-group">
                      <label className="form-label">Specific Request for Applicant *</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        required
                        placeholder="e.g. Please upload certified copy of CAC Form 1.1 or last 6 months UBA Haulage bank statement..."
                        value={applicantRequestNotes}
                        onChange={(e) => setApplicantRequestNotes(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Requested Documents (comma separated)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. CAC_Form_1_1.pdf, Utility_Bill_May.pdf"
                        value={requestedDocs}
                        onChange={(e) => setRequestedDocs(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={handleSendApplicantRequest}>
                        <Send size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        {actionLoading ? 'Sending...' : 'Send Request to Applicant'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RAISE EXCEPTION MODAL */}
      {showRaiseModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '0.5rem' }}>
              Record Credit Exception
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Record Exception: <strong>Case ID + Reason + Originator Owner + Comments + SLA + Version</strong>
            </p>

            {actionError && (
              <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
                <AlertTriangle size={16} /> <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleRaiseSubmit}>
              <div className="form-group">
                <label className="form-label">Case ID / Reference Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. OFL-2026-00001"
                  value={raiseForm.case_id}
                  onChange={(e) => setRaiseForm({ ...raiseForm, case_id: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Flowchart Exception Category *</label>
                <select
                  className="form-select"
                  value={raiseForm.category}
                  onChange={(e) => setRaiseForm({ ...raiseForm, category: e.target.value })}
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
                  <label className="form-label">Originator Role *</label>
                  <select
                    className="form-select"
                    value={raiseForm.originator_role}
                    onChange={(e) => setRaiseForm({ ...raiseForm, originator_role: e.target.value })}
                  >
                    <option value="APPLICANT">Applicant</option>
                    <option value="ANALYST">Analyst</option>
                    <option value="HRM">HRM</option>
                    <option value="BCC">BCC</option>
                    <option value="MD">MD</option>
                    <option value="SYSTEM">System</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">SLA Hours *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={raiseForm.sla_hours}
                    onChange={(e) => setRaiseForm({ ...raiseForm, sla_hours: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Reason *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Utility bill discrepancy, Cashflow volatility breach..."
                  value={raiseForm.reason}
                  onChange={(e) => setRaiseForm({ ...raiseForm, reason: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Comments & Context</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Provide supporting context or instructions..."
                  value={raiseForm.comments}
                  onChange={(e) => setRaiseForm({ ...raiseForm, comments: e.target.value })}
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
