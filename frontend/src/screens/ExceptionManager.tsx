import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { fetchExceptions, resolveException } from '../services/api';

interface ExceptionManagerProps {
  onOpenCase: (caseId: string) => void;
}

export const ExceptionManager: React.FC<ExceptionManagerProps> = ({ onOpenCase }) => {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await fetchExceptions();
      setExceptions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException || !resolutionNotes.trim()) return;
    setActionLoading(true);
    try {
      await resolveException(selectedException.id, resolutionNotes, 'Exception Handler');
      setSelectedException(null);
      setResolutionNotes('');
      await loadExceptions();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Exception Management & SLA Aging</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Active queues for applicant document rework, KYC mismatches, and internal CAM revisions (PRD FR-11).
        </p>
      </div>

      <div className="glass-panel data-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading exception items...
          </div>
        ) : exceptions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No open exceptions. All workflows operating normally.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Reference</th>
                <th>Borrower</th>
                <th>Category</th>
                <th>Responsible Owner</th>
                <th>SLA / Created</th>
                <th>Reason</th>
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
                  </td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>
                    {ex.borrower_name}
                  </td>
                  <td>
                    <span className="status-pill pill-amber" style={{ fontSize: '0.7rem' }}>
                      {ex.category}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {ex.owner}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                      <Clock size={14} /> {ex.sla_hours}h SLA
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(ex.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                    {ex.reason}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedException(ex)}
                      >
                        Resolve
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
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

      {/* Resolve Modal */}
      {selectedException && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
              Resolve Exception — {selectedException.case_number}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Resolving this exception returns the case to: <strong>{selectedException.return_stage}</strong>
            </p>

            <form onSubmit={handleResolve}>
              <div className="form-group">
                <label className="form-label">Resolution Notes & Verified Evidence *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  required
                  placeholder="Describe corrective actions taken (e.g. valid utility bill verified, revised CAM submitted)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedException(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Resolving...' : 'Confirm & Resume Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
