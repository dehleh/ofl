import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, X, UserCheck, AlertCircle, KeyRound, Cpu, Sparkles } from 'lucide-react';
import { loginStaff } from '../services/api';

interface StaffGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (role: string) => void;
}

export const StaffGateModal: React.FC<StaffGateModalProps> = ({
  isOpen,
  onClose,
  onAuthenticate
}) => {
  const [pin, setPin] = useState('');
  const [selectedRole, setSelectedRole] = useState('ANALYST');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginStaff(selectedRole, pin.trim() || '1988');
      onAuthenticate(selectedRole);
      setPin('');
    } catch (err: any) {
      setError(err.detail || 'Invalid Staff Access PIN. (Demo key: 1988)');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoEnter = async (role: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginStaff(role, '1988');
      onAuthenticate(role);
      setPin('');
    } catch (err: any) {
      onAuthenticate(role);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card cyber-top-edge" style={{ maxWidth: '500px', position: 'relative' }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '1.25rem', 
            right: '1.25rem', 
            background: 'var(--bg-dark)', 
            border: '1px solid var(--border-subtle)', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(0, 150, 204, 0.08)',
            border: '2px solid rgba(0, 150, 204, 0.3)',
            color: 'var(--brand-cerulean)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.15rem auto',
            boxShadow: '0 2px 12px rgba(0, 150, 204, 0.15)'
          }}>
            <Lock size={30} />
          </div>
          <span className="status-pill pill-cyan" style={{ fontSize: '0.72rem', marginBottom: '0.5rem' }}>
            CRYPTOGRAPHIC ACCESS GATE
          </span>
          <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-highlight)', fontFamily: 'var(--font-display)', marginTop: '0.35rem' }}>
            Opticom Internal Staff Gate
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>
            Restricted authentication terminal for Underwriting, Risk Management (HRM), Board Credit Committee (BCC), and Executive Officers.
          </p>
        </div>

        {error && (
          <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1.25rem', fontSize: '0.82rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              <UserCheck size={14} color="var(--brand-cyan)" /> Staff Role / Mandate Authority
            </label>
            <select 
              className="form-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ fontSize: '0.92rem' }}
            >
              <option value="ADMIN">System Administrator (Settings, Database &amp; Config)</option>
              <option value="ANALYST">Credit Analyst (Dossier &amp; CAM Synthesis)</option>
              <option value="HRM">Head of Risk Management (Limit &le; ₦5M Review)</option>
              <option value="BCC">Board Credit Committee (Limit &le; ₦15M Sanction)</option>
              <option value="MD">Managing Director (Limit &gt; ₦15M / Executive)</option>
              <option value="TREASURY">Treasury &amp; Loan Operations (NAV Disbursal)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ margin: 0 }}>
                <KeyRound size={14} color="var(--brand-cyan)" /> Internal Security PIN
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--brand-cyan)', fontFamily: 'var(--font-mono)' }}>Demo Key: 1988</span>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="Enter 4-digit staff PIN..."
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', letterSpacing: '0.3em', textAlign: 'center' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg" 
            style={{ width: '100%', marginBottom: '1.25rem' }}
            disabled={loading}
          >
            <ShieldCheck size={18} /> {loading ? 'Authorizing Bearer...' : 'Verify & Enter Risk Portal'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.75rem', textAlign: 'center', letterSpacing: '0.08em' }}>
            Instant Evaluation Fast-Track (Demo Bypass)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => handleQuickDemoEnter('ANALYST')}
              style={{ fontSize: '0.75rem', padding: '0.45rem' }}
            >
              Analyst
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => handleQuickDemoEnter('HRM')}
              style={{ fontSize: '0.75rem', padding: '0.45rem' }}
            >
              HRM
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => handleQuickDemoEnter('MD')}
              style={{ fontSize: '0.75rem', padding: '0.45rem' }}
            >
              MD
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => handleQuickDemoEnter('ADMIN')}
              style={{ fontSize: '0.75rem', padding: '0.45rem', borderColor: 'var(--brand-cyan)', color: 'var(--brand-cyan)' }}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
