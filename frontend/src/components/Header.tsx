import React from 'react';
import { ShieldCheck, UserCheck, Activity } from 'lucide-react';

interface HeaderProps {
  currentPersona: string;
  onPersonaChange: (persona: string) => void;
  backendOnline: boolean;
  onExitToPublicClient?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPersona, onPersonaChange, backendOnline, onExitToPublicClient }) => {
  return (
    <header className="app-header">
      <div className="brand-badge">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <img
            src="/opticom_logo.jpg"
            alt="Opticom Finance"
            style={{
              height: '38px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: '#ffffff',
              padding: '2px 4px'
            }}
          />
          <div>
            <div className="brand-logo-text">Opticom Finance</div>
            <div className="brand-tagline">INTERNAL RISK MANAGEMENT & UNDERWRITING GATE &bull; RC: 347832</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {onExitToPublicClient && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onExitToPublicClient}
            style={{ fontSize: '0.78rem' }}
          >
            ← Public Customer App
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: backendOnline ? 'var(--color-success)' : 'var(--color-danger)' }}>
          <Activity size={14} className={backendOnline ? 'pulse' : ''} />
          <span>{backendOnline ? 'GCP API Connected' : 'API Connecting...'}</span>
        </div>

        <div className="persona-switcher">
          <UserCheck size={16} color="var(--brand-teal-light)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Persona:</span>
          <select 
            className="persona-select"
            value={currentPersona}
            onChange={(e) => onPersonaChange(e.target.value)}
          >
            <option value="ADMIN">System Administrator (Settings & Config)</option>
            <option value="ANALYST">Credit Analyst (Recommend & Review)</option>
            <option value="HRM">Head of Risk Management (HRM Limit &le; ₦5m)</option>
            <option value="BCC">BCC / Authoriser (Limit &le; ₦15m)</option>
            <option value="MD">Managing Director (MD &gt; ₦15m / Final)</option>
            <option value="OPERATIONS">Credit Operations (Offer & Conditions)</option>
            <option value="TREASURY">Treasury Officer (NAV Handoff)</option>
            <option value="BDO">Business Dev Officer (BDO Assisted)</option>
            <option value="AUDITOR">Compliance Auditor (Read-Only Audit)</option>
          </select>
        </div>
      </div>
    </header>
  );
};
