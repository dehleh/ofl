import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, ShieldAlert, CheckCircle, AlertTriangle, Database, ArrowRight } from 'lucide-react';
import { submitBestoPayload, fetchQuarantinedBesto } from '../services/api';

interface BestoIngestionLabProps {
  onCaseCreated: (caseNumber: string) => void;
}

export const BestoIngestionLab: React.FC<BestoIngestionLabProps> = ({ onCaseCreated }) => {
  const [activePreset, setActivePreset] = useState<'STANDARD' | 'DUPLICATE' | 'BOUNDARY' | 'OVER_LIMIT' | 'INCOMPLETE_KYC'>('STANDARD');
  const [rawPayload, setRawPayload] = useState<any>({});
  const [responseLog, setResponseLog] = useState<any>(null);
  const [quarantinedList, setQuarantinedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Presets matching PRD Section 17.4 Acceptance Criteria
  const presets = {
    STANDARD: {
      source_system: "BESTO",
      source_application_id: `BST-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_reference: "BST-CUST-7741",
      requested_amount_ngn: 1500000.0,
      applicant_details: {
        name: "Folashade Balogun",
        email: "folashade.balogun@example.ng",
        phone: "+234 803 777 8899",
        bvn: "22114477889",
        nin: "11998844221",
        business_name: "Balogun Fabric Stores",
        verified_attributes: { bvn_match: true, liveness: "PASSED" }
      },
      kyc_evidence: {
        provider_ref: "YV-BST-9948",
        status: "PASSED",
        provenance: "BESTO_YOUVERIFY_INTEGRATION",
        completed_at: new Date().toISOString()
      },
      document_manifest: [
        { type: "BANK_STATEMENT", name: "Balogun_Turnover_6M.pdf", summary: "Bank turnover ₦620k/mo" }
      ],
      submitted_at: new Date().toISOString(),
      schema_version: "1.0",
      correlation_id: `corr-${Date.now()}`
    },
    DUPLICATE: {
      source_system: "BESTO",
      source_application_id: "BST-REPLAY-TARGET-001",
      customer_reference: "BST-CUST-9900",
      requested_amount_ngn: 1200000.0,
      applicant_details: {
        name: "Ibrahim Danjuma",
        email: "ibrahim.d@example.ng",
        phone: "+234 802 333 4455",
        bvn: "22887766554"
      },
      kyc_evidence: { status: "PASSED" },
      submitted_at: new Date().toISOString(),
      schema_version: "1.0"
    },
    BOUNDARY: {
      source_system: "BESTO",
      source_application_id: `BST-BOUND-${Date.now().toString().slice(-4)}`,
      requested_amount_ngn: 2000000.0, // Exactly ₦2,000,000 (Section 17.1 boundary)
      applicant_details: {
        name: "Emeka Okafor (Exact ₦2m Boundary)",
        email: "emeka.okafor@example.ng",
        bvn: "22446688001"
      },
      kyc_evidence: { status: "PASSED" }
    },
    OVER_LIMIT: {
      source_system: "BESTO",
      source_application_id: `BST-ERR-${Date.now().toString().slice(-4)}`,
      requested_amount_ngn: 2500000.0, // ₦2.5m (Exceeds BESTO ₦2m boundary -> Quarantine)
      applicant_details: {
        name: "Tunde Bakare (Exceeds Limit)",
        email: "tunde.bakare@example.ng"
      }
    },
    INCOMPLETE_KYC: {
      source_system: "BESTO",
      source_application_id: `BST-NOKYC-${Date.now().toString().slice(-4)}`,
      requested_amount_ngn: 850000.0,
      applicant_details: {
        name: "Halima Abubakar",
        email: "halima.a@example.ng",
        phone: "+234 805 111 2233"
      },
      // KYC Evidence intentionally omitted to test Section 17.4 owned exception path!
      submitted_at: new Date().toISOString()
    }
  };

  useEffect(() => {
    setRawPayload(presets[activePreset]);
  }, [activePreset]);

  const loadQuarantine = async () => {
    try {
      const data = await fetchQuarantinedBesto();
      setQuarantinedList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadQuarantine();
  }, []);

  const handleFireIngestion = async () => {
    setLoading(true);
    setResponseLog(null);
    try {
      const res = await submitBestoPayload(rawPayload);
      setResponseLog({ success: true, data: res });
      loadQuarantine();
      if (res.case_number) {
        onCaseCreated(res.case_number);
      }
    } catch (err: any) {
      setResponseLog({ success: false, data: err });
      loadQuarantine();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>BESTO Ingestion Simulator & Quarantine Lab</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Simulates inbound webhooks/batches from BESTO (₦300k–₦2m). Tests idempotency, deduplication, and quarantine controls (PRD Section 17).
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadQuarantine}>
          <RefreshCw size={14} /> Refresh Quarantine
        </button>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${activePreset === 'STANDARD' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePreset('STANDARD')}
        >
          Preset 1: Standard ₦1.5m Intake (Creates Case)
        </button>
        <button
          className={`btn btn-sm ${activePreset === 'DUPLICATE' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePreset('DUPLICATE')}
        >
          Preset 2: Duplicate Replay (Idempotent 0-Duplicate)
        </button>
        <button
          className={`btn btn-sm ${activePreset === 'BOUNDARY' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePreset('BOUNDARY')}
        >
          Preset 3: Exact ₦2m Boundary (Accepted)
        </button>
        <button
          className={`btn btn-sm ${activePreset === 'OVER_LIMIT' ? 'btn-danger' : 'btn-secondary'}`}
          onClick={() => setActivePreset('OVER_LIMIT')}
        >
          Preset 4: ₦2.5m Over Boundary (Quarantined)
        </button>
        <button
          className={`btn btn-sm ${activePreset === 'INCOMPLETE_KYC' ? 'btn-warning' : 'btn-secondary'}`}
          onClick={() => setActivePreset('INCOMPLETE_KYC')}
        >
          Preset 5: Incomplete KYC (Enters Owned Exception)
        </button>
      </div>

      <div className="split-view">
        {/* Left: JSON Payload Editor */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-teal-light)' }}>
              <Database size={16} />
              <span>Inbound JSON Payload (Section 17.3 Contract)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HTTP POST /api/v1/intake/besto</span>
          </div>

          <textarea
            className="form-textarea"
            rows={15}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', width: '100%', resize: 'vertical' }}
            value={JSON.stringify(rawPayload, null, 2)}
            onChange={(e) => {
              try {
                setRawPayload(JSON.parse(e.target.value));
              } catch (_) {}
            }}
          />

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              disabled={loading}
              onClick={handleFireIngestion}
              style={{ flex: 1 }}
            >
              <Play size={16} />
              <span>{loading ? 'Transmitting to OFL...' : 'Send BESTO Inbound Webhook'}</span>
            </button>
          </div>
        </div>

        {/* Right: Response Inspector & Quarantine Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Response Box */}
          <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '220px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
              API Transmission Status & Audit Response
            </h3>

            {responseLog ? (
              <div>
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  background: responseLog.success ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  border: `1px solid ${responseLog.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: responseLog.success ? '#34d399' : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}>
                  {responseLog.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                  <span>{responseLog.data.message || responseLog.data.detail?.message || 'Transaction executed'}</span>
                </div>

                <pre style={{
                  background: '#091322',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  overflowX: 'auto',
                  maxHeight: '180px'
                }}>
                  {JSON.stringify(responseLog.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                Select a preset or edit JSON payload, then click "Send BESTO Inbound Webhook" to test ingestion rules.
              </div>
            )}
          </div>

          {/* Quarantined Payloads Queue */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ShieldAlert size={18} color="var(--color-danger)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                Quarantined Payloads Queue ({quarantinedList.length})
              </h3>
            </div>

            {quarantinedList.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No quarantined items. All payloads valid.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                {quarantinedList.map((item) => (
                  <div key={item.id} style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ fontWeight: 600, color: '#fca5a5' }}>{item.error_details}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                      Key: {item.idempotency_key} &bull; {new Date(item.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
