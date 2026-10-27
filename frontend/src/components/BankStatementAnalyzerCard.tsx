import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Building2, 
  RefreshCw,
  Zap,
  CheckCheck
} from 'lucide-react';
import { uploadBankStatement, analyzeDemoBankStatement, applyStatementToFinancials } from '../services/api';

interface BankStatementAnalyzerProps {
  caseId: string;
  documents: any[];
  currentPersona: string;
  onRefresh: () => void;
}

export const BankStatementAnalyzerCard: React.FC<BankStatementAnalyzerProps> = ({
  caseId,
  documents,
  currentPersona,
  onRefresh
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedStatementDoc, setSelectedStatementDoc] = useState<any>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Find existing bank statement documents with analysis
  const statementDocs = documents.filter(d => 
    d.document_type === 'BANK_STATEMENT' || 
    (d.analysis_results && d.analysis_results.total_inflow)
  );

  const activeDoc = selectedStatementDoc || (statementDocs.length > 0 ? statementDocs[0] : null);
  const analysis = activeDoc?.analysis_results;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setActionSuccess(null);
    setErrorMessage(null);

    try {
      const res = await uploadBankStatement(caseId, file, currentPersona);
      setActionSuccess(`Successfully ingested and analyzed ${file.name}!`);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.detail || err.message || 'Failed to analyze bank statement');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRunDemo = async (preset: string) => {
    setUploading(true);
    setActionSuccess(null);
    setErrorMessage(null);

    try {
      const res = await analyzeDemoBankStatement(caseId, preset, currentPersona);
      setActionSuccess(`Demo ${preset === 'UBA_HAULAGE' ? 'UBA Haulage' : 'FirstBank'} statement ingested & analyzed!`);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.detail || err.message || 'Failed to run demo analysis');
    } finally {
      setUploading(false);
    }
  };

  const handleApplyToFinancials = async (docId: string) => {
    setUploading(true);
    setActionSuccess(null);
    setErrorMessage(null);

    try {
      const res = await applyStatementToFinancials(caseId, docId, currentPersona);
      setActionSuccess('Bank turnover metrics applied! Financial assessment & CAM tables updated.');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.detail || err.message || 'Failed to apply metrics to case financials');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            background: 'var(--brand-teal-dim)',
            color: 'var(--brand-teal-light)',
            padding: '0.5rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              Bank Statement Intelligent Ingestion & Cashflow Inference
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Drop customer statement of account (PDF/CSV) for automated turnover, volatility, and credit capacity analysis
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="btn btn-primary btn-sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <UploadCloud size={14} /> {uploading ? 'Processing...' : 'Upload Statement'}
            <input 
              type="file" 
              accept=".pdf,.csv,.xlsx,.xls,.txt" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleRunDemo('UBA_HAULAGE')}
            disabled={uploading}
            title="Simulate UBA 6-Month Haulage Account Statement"
          >
            <Zap size={14} /> Demo UBA Ingestion
          </button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {actionSuccess && (
        <div className="flag-banner flag-MEDIUM" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#6ee7b7', marginBottom: '1rem' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Drag & Drop Area if no statements or wanting new upload */}
      {statementDocs.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '2.5rem',
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <FileSpreadsheet size={36} color="var(--brand-teal)" style={{ marginBottom: '0.75rem' }} />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: '0.35rem' }}>
            No Bank Statement Ingested Yet
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
            Drag and drop customer bank statements (PDF, CSV, Excel) here or choose an automated simulation to extract turnover, verify inflows, and compute repayment capacity.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <label className="btn btn-primary btn-sm">
              <UploadCloud size={14} /> Choose Statement File
              <input 
                type="file" 
                accept=".pdf,.csv,.xlsx,.xls,.txt" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            <button className="btn btn-secondary btn-sm" onClick={() => handleRunDemo('UBA_HAULAGE')} disabled={uploading}>
              <Zap size={14} /> Load UBA Statement (₦576M Inflow)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleRunDemo('FIRST_BANK')} disabled={uploading}>
              <Zap size={14} /> Load First Bank Statement (₦449M Inflow)
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Statement Switcher Tabs if multiple statements exist */}
          {statementDocs.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              {statementDocs.map((doc, idx) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedStatementDoc(doc)}
                  className={`btn btn-sm ${activeDoc?.id === doc.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                >
                  <Building2 size={13} /> {doc.analysis_results?.bank_name || doc.original_filename}
                </button>
              ))}
            </div>
          )}

          {/* Key Statement Metrics Grid */}
          {analysis && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.85rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Inflow (6M)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-teal-light)', fontFamily: 'var(--font-mono)' }}>
                    ₦{(analysis.total_inflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {analysis.bank_name} &bull; {analysis.account_number}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Monthly Turnover</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    ₦{(analysis.average_monthly_inflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
                    <ArrowUpRight size={13} /> {analysis.coverage_multiple}x Loan Repayment Multiple
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Net Monthly Cashflow</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: analysis.net_cashflow >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                    {analysis.net_cashflow >= 0 ? '+' : ''}₦{(analysis.net_cashflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Total Outflows: ₦{(analysis.total_outflow || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Inflow Volatility</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: analysis.volatility_score_pct > 50 ? 'var(--color-warning)' : 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                    {analysis.volatility_score_pct || 0}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Grade: <strong style={{ color: 'var(--brand-teal-light)' }}>{analysis.underwriting_inferences?.credit_grade || 'PRIME'}</strong>
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown Table */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    Monthly Credit & Debit Inflow Trend
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    File: <code style={{ color: 'var(--brand-teal-light)' }}>{activeDoc.original_filename}</code> [SHA-256: {activeDoc.checksum.slice(0, 8)}...]
                  </span>
                </div>

                <div className="data-table-container">
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Credit Inflows (₦)</th>
                        <th style={{ textAlign: 'right' }}>Debit Outflows (₦)</th>
                        <th style={{ textAlign: 'right' }}>Net Cashflow (₦)</th>
                        <th style={{ textAlign: 'right' }}>Closing Balance (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.monthly_inflows?.map((m: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{m.month}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--brand-teal-light)', fontWeight: 700 }}>
                            ₦{m.inflow.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            ₦{m.outflow.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: m.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {m.net >= 0 ? '+' : ''}₦{m.net.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            ₦{m.closing_balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Risk Signals & Credit Inferences */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                    Behavioral Inflow Signals & Risk Checks
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {analysis.risk_signals?.map((s: any, idx: number) => (
                      <div 
                        key={idx} 
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          background: s.severity === 'SUCCESS' ? 'rgba(16, 185, 129, 0.08)' : s.severity === 'WARNING' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                          border: `1px solid ${s.severity === 'SUCCESS' ? 'rgba(16, 185, 129, 0.25)' : s.severity === 'WARNING' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: s.severity === 'SUCCESS' ? 'var(--color-success)' : s.severity === 'WARNING' ? 'var(--color-warning)' : 'var(--color-info)', marginBottom: '0.15rem' }}>
                          {s.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {s.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                    Underwriting Capacity Inferences
                  </h4>
                  <div style={{
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)'
                  }}>
                    <p style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#fff' }}>Repayment Capacity:</strong> {analysis.underwriting_inferences?.capacity_summary}
                    </p>
                    <p style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#fff' }}>Debt Cushion:</strong> {analysis.underwriting_inferences?.repayment_cushion}
                    </p>
                    <p style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#fff' }}>Concentration Assessment:</strong> {analysis.underwriting_inferences?.concentration_inference}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong style={{ color: '#fff' }}>Operating Margin:</strong> {analysis.underwriting_inferences?.operational_profitability_inference}
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply to CAM and Financial Assessment Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleApplyToFinancials(activeDoc.id)}
                  disabled={uploading}
                >
                  <CheckCheck size={16} /> Apply Metrics to Case Financials & CAM
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
