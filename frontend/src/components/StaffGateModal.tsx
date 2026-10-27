import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, X, UserCheck, AlertCircle } from 'lucide-react';

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

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Accept Opticom staff default demo key '1988' or 'opticom' or standard bypass for UAT
    if (pin.trim() === '1988' || pin.toLowerCase().trim() === 'opticom' || pin.trim() === 'admin') {
      onAuthenticate(selectedRole);
      setPin('');
    } else {
      setError('Invalid Staff Access PIN. (Demo key: 1988)');
    }
  };

  const handleQuickDemoEnter = (role: string) => {
    onAuthenticate(role);
    setPin('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '480px', position: 'relative' }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '1.25rem', 
            right: '1.25rem', 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer' 
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(0, 196, 159, 0.12)',
            color: 'var(--brand-teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <Lock size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.35rem' }}>
            Internal Staff & Risk Gate
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Restricted access for Opticom Credit Underwriting, Risk Management, BCC, and Executive Committee officers.
          </p>
        </div>

        {error && (
          <div className="flag-banner flag-CRITICAL" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Staff Role / Authorization Level</label>
            <select 
              className="form-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="ANALYST">Credit Analyst (Dossier & CAM Synthesis)</option>
              <option value="HRM">Head of Risk Management (Mandate Review)</option>
              <option value="BCC">Board Credit Committee (High-Value Sanctions)</option>
              <option value="MD">Managing Director (Final Executive Approval)</option>
              <option value="TREASURY">Treasury & Loan Operations (NAV / LOAN-DISC)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Internal Access PIN</label>
              <span style={{ fontSize: '0.72rem', color: 'var(--brand-teal-light)' }}>Demo Key: 1988</span>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="Enter 4-digit staff key..."
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
            <ShieldCheck size={16} /> Authenticate to Internal System
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>
            Instant Evaluation Access
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => handleQuickDemoEnter('ANALYST')}
              style={{ fontSize: '0.75rem' }}
            >
              Enter as Analyst
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => handleQuickDemoEnter('HRM')}
              style={{ fontSize: '0.75rem' }}
            >
              Enter as HRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
