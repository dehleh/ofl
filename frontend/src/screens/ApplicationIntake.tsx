import React, { useState, useMemo, useEffect } from 'react';
import { Send, AlertTriangle, CheckCircle, Calculator, FileText, ArrowRight } from 'lucide-react';
import { submitDirectApplication, fetchPricingPolicy, PricingPolicy } from '../services/api';

interface ApplicationIntakeProps {
  onSuccess: (caseNumber: string) => void;
  onGoToBesto: () => void;
}

export const ApplicationIntake: React.FC<ApplicationIntakeProps> = ({ onSuccess, onGoToBesto }) => {
  const [formData, setFormData] = useState({
    applicant_name: '',
    applicant_type: 'INDIVIDUAL',
    email: '',
    phone: '',
    bvn: '',
    nin: '',
    rc_number: '',
    amount: 5000000,
    tenor_months: 18,
    purpose: '',
    monthly_income: 1800000,
    existing_monthly_debt: 120000,
    estimated_monthly_expenses: 600000,
    collateral_value: 8000000
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  // Dynamic Pricing Policy from Admin Settings
  const [pricingPolicy, setPricingPolicy] = useState<PricingPolicy>({
    cbn_mpr: 23.0,
    commercial_margin: 5.0,
    effective_apr: 28.0,
    upfront_fee_pct: 4.5
  });

  useEffect(() => {
    fetchPricingPolicy()
      .then((res) => {
        if (res && res.effective_apr) {
          setPricingPolicy(res);
        }
      })
      .catch(() => {});
  }, []);

  // Live deterministic calculations in form
  const calculations = useMemo(() => {
    const P = Number(formData.amount) || 0;
    const n = Number(formData.tenor_months) || 12;
    const apr = Number(pricingPolicy.effective_apr) || 28.0;
    const r = (apr / 100) / 12; // Dynamic APR from Admin
    let pmt = 0;
    if (P > 0 && n > 0) {
      const factor = Math.pow(1 + r, n);
      pmt = P * (r * factor) / (factor - 1);
    }
    const totalObligations = (Number(formData.existing_monthly_debt) || 0) + pmt;
    const income = Number(formData.monthly_income) || 0;
    const dsr = income > 0 ? (totalObligations / income) * 100 : 100;
    const ndi = income - ((Number(formData.existing_monthly_debt) || 0) + (Number(formData.estimated_monthly_expenses) || 0) + pmt);
    const collateralRatio = P > 0 ? ((Number(formData.collateral_value) || 0) / P) * 100 : 0;

    return {
      pmt: Math.round(pmt),
      totalRepayment: Math.round(pmt * n),
      dsr: Math.round(dsr * 10) / 10,
      ndi: Math.round(ndi),
      collateralRatio: Math.round(collateralRatio)
    };
  }, [formData, pricingPolicy]);

  const isBelowBoundary = formData.amount <= 2000000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await submitDirectApplication(formData);
      setSuccessInfo(res);
      onSuccess(res.case_number);
    } catch (err: any) {
      if (err.detail && err.detail.message) {
        setErrorMsg(err.detail.message);
      } else {
        setErrorMsg(err.message || 'Application submission failed. Please verify fields.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-highlight)' }}>Direct OFL Loan Origination Portal</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Originates high-value credit facilities above ₦2,000,000 for verified Individuals, SMEs, and Corporate clients (PRD FR-01).
        </p>
      </div>

      {isBelowBoundary && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fbbf24'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={22} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Canonical Boundary Notice (PRD Section 17.1)</div>
              <div style={{ fontSize: '0.82rem', color: '#fde68a' }}>
                Loans between ₦300,000 and ₦2,000,000 inclusive belong to the BESTO channel. OFL Direct portal accepts facilities &gt; ₦2,000,000.
              </div>
            </div>
          </div>
          <button className="btn btn-warning btn-sm" onClick={onGoToBesto}>
            Go to BESTO Simulator <ArrowRight size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flag-banner flag-CRITICAL">
          <AlertTriangle size={20} />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="split-view">
          {/* Left Column: Applicant & Business Info */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--brand-teal-light)' }}>
              1. Applicant & Business Profile
            </h3>

            <div className="form-group">
              <label className="form-label">Applicant Legal Name / Registered Entity *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.applicant_name}
                onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                placeholder="e.g. Apex Industrial Solutions Ltd or Dr. Adeyemi Adeleke"
              />
            </div>

            <div className="split-view" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Client Classification</label>
                <select
                  className="form-select"
                  value={formData.applicant_type}
                  onChange={(e) => setFormData({ ...formData, applicant_type: e.target.value })}
                >
                  <option value="INDIVIDUAL">Individual / Salaried</option>
                  <option value="SME">SME / Business Enterprise</option>
                  <option value="CORPORATE">Corporate / PLC</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+234 801 234 5678"
                />
              </div>
            </div>

            <div className="split-view" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Official Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@entity.ng"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bank Verification Number (BVN) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  maxLength={11}
                  value={formData.bvn}
                  onChange={(e) => setFormData({ ...formData, bvn: e.target.value })}
                  placeholder="22XXXXXXXXX"
                />
              </div>
            </div>

            <div className="split-view" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">CAC RC Number (If Corporate/SME)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.rc_number}
                  onChange={(e) => setFormData({ ...formData, rc_number: e.target.value })}
                  placeholder="RC-123456"
                />
              </div>

              <div className="form-group">
                <label className="form-label">National ID Number (NIN)</label>
                <input
                  type="text"
                  className="form-input"
                  maxLength={11}
                  value={formData.nin}
                  onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                  placeholder="11XXXXXXXXX"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Specific Facility Purpose *</label>
              <textarea
                className="form-textarea"
                required
                rows={3}
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Describe working capital procurement, inventory acquisition, or project expenditure..."
              />
            </div>
          </div>

          {/* Right Column: Loan Parameters & Financial Inputs */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--brand-teal-light)' }}>
              2. Facility Structure & Deterministic Appraisal
            </h3>

            <div className="split-view" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Requested Loan Amount (₦) *</label>
                <input
                  type="number"
                  className="form-input"
                  min="2000001"
                  step="50000"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />
                <div className="form-help">Must exceed ₦2,000,000 for OFL Direct</div>
              </div>

              <div className="form-group">
                <label className="form-label">Tenor (Months) *</label>
                <select
                  className="form-select"
                  value={formData.tenor_months}
                  onChange={(e) => setFormData({ ...formData, tenor_months: parseInt(e.target.value) || 12 })}
                >
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={18}>18 Months</option>
                  <option value={24}>24 Months (2 Years)</option>
                  <option value={36}>36 Months (3 Years)</option>
                </select>
              </div>
            </div>

            <div className="split-view" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Verified Monthly Income / Turnover (₦) *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={formData.monthly_income}
                  onChange={(e) => setFormData({ ...formData, monthly_income: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Existing Monthly Debt Service (₦)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.existing_monthly_debt}
                  onChange={(e) => setFormData({ ...formData, existing_monthly_debt: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="split-view" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Monthly Living/Operating Costs (₦)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.estimated_monthly_expenses}
                  onChange={(e) => setFormData({ ...formData, estimated_monthly_expenses: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pledged Collateral OMV (₦)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.collateral_value}
                  onChange={(e) => setFormData({ ...formData, collateral_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Live Financial Engine Preview */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginTop: '1rem',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-teal)' }}>
                <Calculator size={16} />
                <span>REAL-TIME DETERMINISTIC ENGINE METRICS</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Estimated Installment:</span>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-highlight)' }}>
                    ₦{calculations.pmt.toLocaleString()} / mo
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Debt Service Ratio (DSR):</span>
                  <div style={{
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: calculations.dsr > 35 ? 'var(--color-danger)' : 'var(--color-success)'
                  }}>
                    {calculations.dsr}% {calculations.dsr > 35 ? '(Policy Flag)' : '(Compliant)'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Net Disposable Income:</span>
                  <div style={{
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: calculations.ndi <= 0 ? 'var(--color-danger)' : 'var(--color-success)'
                  }}>
                    ₦{calculations.ndi.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Collateral Coverage:</span>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-highlight)' }}>
                    {calculations.collateralRatio}%
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || isBelowBoundary}
                style={{ width: '100%', padding: '0.85rem' }}
              >
                {loading ? 'Submitting Application...' : (
                  <>
                    <Send size={18} />
                    <span>Submit to OFL Credit Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
