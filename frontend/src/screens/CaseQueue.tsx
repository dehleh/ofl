import React, { useState, useEffect } from 'react';
import { Search, Filter, ArrowRight, AlertCircle, FileSpreadsheet, Eye, Plus } from 'lucide-react';
import { fetchCases } from '../services/api';

interface CaseQueueProps {
  onSelectCase: (caseId: string) => void;
  onNewApplication: () => void;
}

export const CaseQueue: React.FC<CaseQueueProps> = ({ onSelectCase, onNewApplication }) => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCases({
        stage: stageFilter,
        channel: channelFilter,
        search: searchQuery
      });
      setCases(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [stageFilter, channelFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getStageBadgeClass = (state: string) => {
    switch (state) {
      case 'Analyst Review': return 'pill-blue';
      case 'HRM Review': return 'pill-purple';
      case 'BCC/Authorisation':
      case 'MD Decision': return 'pill-cyan';
      case 'Ready for Disbursement': return 'pill-green';
      case 'Disbursed/Monitoring': return 'pill-green';
      case 'Rejected': return 'pill-red';
      case 'KYC Pending': return 'pill-amber';
      default: return 'pill-blue';
    }
  };

  return (
    <div>
      {/* Top Banner & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Unified Credit Work Queue</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Central origination and credit review pipeline across BESTO and OFL Direct channels (PRD FR-04, FR-18).
          </p>
        </div>

        <button className="btn btn-primary" onClick={onNewApplication}>
          <Plus size={16} /> New OFL Direct Application
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '260px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search by Case #, Borrower Name, or BVN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Filter size={16} /> Stage:
          </div>
          <select
            className="form-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Stages</option>
            <option value="KYC Pending">KYC Pending</option>
            <option value="Analyst Review">Analyst Review</option>
            <option value="HRM Review">HRM Review</option>
            <option value="BCC/Authorisation">BCC / Authorisation</option>
            <option value="MD Decision">MD Decision</option>
            <option value="Offer Pending">Offer Pending</option>
            <option value="Conditions Pending">Conditions Pending</option>
            <option value="Ready for Disbursement">Ready for Disbursement</option>
            <option value="Disbursed/Monitoring">Disbursed / Monitoring</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            className="form-select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Channels</option>
            <option value="BESTO">BESTO (₦300k–₦2m)</option>
            <option value="OFL_DIRECT">OFL Direct (&gt;₦2m)</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="glass-panel data-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading credit pipeline cases...
          </div>
        ) : cases.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No credit cases match the active filter criteria.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Reference</th>
                <th>Borrower / Channel</th>
                <th>Requested Amount</th>
                <th>Workflow Stage</th>
                <th>CAM Status</th>
                <th>KYC</th>
                <th>Exceptions</th>
                <th>Owner</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-teal-light)' }}>
                      {c.case_number}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Rev {c.revision} &bull; {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{c.applicant_name}</div>
                    <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                      <span className={`status-pill ${c.channel === 'BESTO' ? 'pill-purple' : 'pill-cyan'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        {c.channel}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{c.applicant_type}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      ₦{c.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {c.tenor_months} Months
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${getStageBadgeClass(c.state)}`}>
                      {c.state}
                    </span>
                  </td>
                  <td>
                    {c.cam_version > 0 ? (
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: c.cam_validated ? 'var(--color-success)' : 'var(--accent-gold)' }}>
                          v{c.cam_version} {c.cam_validated ? 'Validated' : 'Draft'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Draft</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${c.kyc_status === 'PASSED' ? 'pill-green' : 'pill-amber'}`} style={{ fontSize: '0.7rem' }}>
                      {c.kyc_status}
                    </span>
                  </td>
                  <td>
                    {c.open_exceptions_count > 0 ? (
                      <span className="status-pill pill-red" style={{ fontSize: '0.7rem' }}>
                        {c.open_exceptions_count} Open
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {c.assigned_owner}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSelectCase(c.id)}
                    >
                      <Eye size={14} /> Open Dossier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
