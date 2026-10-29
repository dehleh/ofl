import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, ArrowRight, AlertCircle, FileSpreadsheet, Eye, Plus, ShieldCheck, TrendingUp, Layers, Cpu, Sparkles } from 'lucide-react';
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

  // Pipeline aggregate statistics
  const stats = useMemo(() => {
    const totalVolume = cases.reduce((acc, c) => acc + (c.amount || 0), 0);
    const pendingCommittee = cases.filter(c => ['HRM Review', 'BCC/Authorisation', 'MD Decision'].includes(c.state)).length;
    const exceptionsCount = cases.reduce((acc, c) => acc + (c.open_exceptions_count || 0), 0);
    return {
      totalCases: cases.length,
      totalVolume,
      pendingCommittee,
      exceptionsCount
    };
  }, [cases]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-highlight)', fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
              Unified Underwriting Work Queue
            </h2>
            <span className="status-pill pill-cyan">LIVE PIPELINE</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
            Centralized commercial origination pipeline across BESTO retail and OFL Direct enterprise channels.
          </p>
        </div>

        <button className="btn btn-primary btn-lg" onClick={onNewApplication}>
          <Plus size={18} /> New OFL Direct Application
        </button>
      </div>

      {/* Cybernetic HUD Metric Strip */}
      <div className="metrics-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="metric-card">
          <div className="metric-label">Active Queue Cases</div>
          <div className="metric-value" style={{ color: 'var(--text-highlight)' }}>{stats.totalCases}</div>
          <div className="metric-footer">
            <Layers size={14} color="var(--brand-cyan)" />
            <span>Across all credit tiers</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Pipeline Facility Exposure</div>
          <div className="metric-value" style={{ color: 'var(--brand-cyan)' }}>
            ₦{stats.totalVolume > 0 ? (stats.totalVolume / 1000000).toFixed(1) + 'M' : '0'}
          </div>
          <div className="metric-footer">
            <TrendingUp size={14} color="var(--brand-cyan)" />
            <span>Total nominal loan demand</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Risk Committee Review</div>
          <div className="metric-value" style={{ color: 'var(--accent-purple-light)' }}>
            {stats.pendingCommittee}
          </div>
          <div className="metric-footer">
            <Cpu size={14} color="var(--accent-purple-light)" />
            <span>HRM / BCC / MD Authority</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Policy Exceptions / Rework</div>
          <div className="metric-value" style={{ color: stats.exceptionsCount > 0 ? '#f87171' : '#34d399' }}>
            {stats.exceptionsCount}
          </div>
          <div className="metric-footer">
            <AlertCircle size={14} color={stats.exceptionsCount > 0 ? '#f87171' : '#34d399'} />
            <span>Active mitigation blockers</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.15rem 1.4rem', marginBottom: '1.75rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '280px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--brand-cyan)' }} />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', paddingLeft: '2.75rem' }}
            placeholder="Search by Case #, Borrower Name, or BVN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Filter size={16} color="var(--brand-cyan)" /> Stage:
          </div>
          <select
            className="form-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ padding: '0.65rem 1rem', fontSize: '0.88rem' }}
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
            style={{ padding: '0.65rem 1rem', fontSize: '0.88rem' }}
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
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--brand-cyan)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Scanning Underwriting Pipeline...
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>Synchronizing cases from SQLite &amp; Cloud Run</div>
          </div>
        ) : cases.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-highlight)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              No Active Cases Found
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
              No credit dossiers match the active stage and channel filter criteria.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Reference</th>
                <th>Borrower / Channel</th>
                <th>Requested Facility</th>
                <th>Workflow Stage</th>
                <th>CAM Status</th>
                <th>KYC Screening</th>
                <th>Exceptions</th>
                <th>Assigned Owner</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-cyan)', fontSize: '0.95rem' }}>
                      {c.case_number}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Rev {c.revision} &bull; {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-highlight)', fontSize: '0.92rem' }}>{c.applicant_name}</div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.25rem' }}>
                      <span className={`status-pill ${c.channel === 'BESTO' ? 'pill-purple' : 'pill-cyan'}`} style={{ fontSize: '0.68rem', padding: '0.12rem 0.5rem' }}>
                        {c.channel}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.applicant_type}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-highlight)', fontSize: '1.05rem' }}>
                      ₦{c.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {c.tenor_months} Months Tenor
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
                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: c.cam_validated ? 'var(--color-success-light)' : 'var(--accent-gold-light)'
                        }}>
                          v{c.cam_version} {c.cam_validated ? 'Validated ✓' : 'Draft'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending Draft</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${c.kyc_status === 'PASSED' ? 'pill-green' : 'pill-amber'}`} style={{ fontSize: '0.74rem' }}>
                      {c.kyc_status}
                    </span>
                  </td>
                  <td>
                    {c.open_exceptions_count > 0 ? (
                      <span className="status-pill pill-red" style={{ fontSize: '0.74rem' }}>
                        {c.open_exceptions_count} Open Flag
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {c.assigned_owner}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm btn-glow-cyan"
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
