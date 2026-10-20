import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, DollarSign, Database, FileText } from 'lucide-react';
import { fetchTelemetry, fetchAuditEvents } from '../services/api';

export const AuditTelemetry: React.FC = () => {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tData, aData] = await Promise.all([
        fetchTelemetry(),
        fetchAuditEvents()
      ]);
      setTelemetry(tData);
      setAuditEvents(aData.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading operational metrics and audit trail...
      </div>
    );
  }

  const { overview, aiCost } = telemetry || {};

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Platform Telemetry & Audit Integrity</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Azure cloud consumption, model token tracking, and tamper-evident audit records (PRD FR-18, FR-29).
        </p>
      </div>

      {/* Operational Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Applications Ingested</div>
          <div className="metric-value">{overview?.total_cases || 0}</div>
          <div className="metric-footer">
            BESTO: {overview?.channel_breakdown?.BESTO || 0} &bull; OFL Direct: {overview?.channel_breakdown?.OFL_DIRECT || 0}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Pipeline Requested Value</div>
          <div className="metric-value">₦{(overview?.total_pipeline_value_ngn || 0).toLocaleString()}</div>
          <div className="metric-footer">Active Underwriting Pipeline</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Confirmed Disbursed Value</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>
            ₦{(overview?.total_disbursed_value_ngn || 0).toLocaleString()}
          </div>
          <div className="metric-footer">Reconciled in NAV & LOAN-DISC</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Open Active Exceptions</div>
          <div className="metric-value" style={{ color: overview?.open_exceptions_count > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {overview?.open_exceptions_count || 0}
          </div>
          <div className="metric-footer">Requires Risk or Ops Review</div>
        </div>
      </div>

      {/* Azure AI Token & Cost Telemetry */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Cpu size={20} color="var(--brand-teal)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            Azure OpenAI Consumption & Cost Telemetry (FR-29)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model Deployment:</span>
            <div style={{ fontWeight: 700, color: 'var(--brand-teal-light)' }}>{aiCost?.model_deployment}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CAM Memorandums Generated:</span>
            <div style={{ fontWeight: 700, color: '#fff' }}>{aiCost?.total_cams_generated}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Tokens Consumed:</span>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
              {aiCost?.total_tokens_consumed?.toLocaleString()}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Spend (USD / NGN):</span>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
              ${aiCost?.total_cost_usd} (~₦{aiCost?.total_cost_ngn})
            </div>
          </div>
        </div>

        {/* Budget Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Monthly Opticom Approved AI Budget ($150.00 / month)</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>{aiCost?.budget_consumption_percentage}% consumed</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-surface)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(aiCost?.budget_consumption_percentage || 1, 1)}%`, height: '100%', background: 'linear-gradient(90deg, var(--brand-teal), #3b82f6)' }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {aiCost?.governance_rule}
          </div>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ShieldCheck size={20} color="var(--brand-teal)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            Tamper-Evident Audit Trail Log ({auditEvents.length} events)
          </h3>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor / Role</th>
                <th>Event Type</th>
                <th>Entity Reference</th>
                <th>Correlation ID</th>
                <th>Audit Reason</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.82rem' }}>{ev.actor}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{ev.role}</div>
                  </td>
                  <td>
                    <span className="status-pill pill-cyan" style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                      {ev.event}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-teal-light)' }}>
                      {ev.entity_id}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ev.entity}</div>
                  </td>
                  <td style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {ev.correlation_id?.slice(0, 12)}...
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {ev.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
