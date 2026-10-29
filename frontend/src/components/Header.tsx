import React from 'react';
import { UserCheck, Activity, ArrowLeft, Radio } from 'lucide-react';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px',
            background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.15), rgba(0, 150, 204, 0.05))',
            borderRadius: '10px',
            border: '1px solid rgba(0, 150, 204, 0.25)',
            boxShadow: '0 2px 8px rgba(0, 150, 204, 0.12)'
          }}>
            <img
              src="/opticom_logo.jpg"
              alt="Opticom Finance"
              style={{
                height: '38px',
                borderRadius: '8px',
                background: '#ffffff',
                padding: '2px 6px',
                display: 'block'
              }}
            />
          </div>
          <div>
            <div className="brand-logo-text">
              <span>Opticom Finance</span>
              <span className="status-pill pill-cyan" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                ENTERPRISE COCKPIT
              </span>
            </div>
            <div className="brand-tagline">
              AUTONOMOUS RISK MANAGEMENT &bull; UNDERWRITING ENGINE &bull; RC: 347832
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {onExitToPublicClient && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onExitToPublicClient}
            style={{ 
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: 'var(--border-medium)'
            }}
          >
            <ArrowLeft size={14} /> Switch to Customer Portal
          </button>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.75rem',
          borderRadius: 'var(--radius-full)',
          background: backendOnline ? 'rgba(5, 150, 105, 0.08)' : 'rgba(220, 38, 38, 0.08)',
          border: `1px solid ${backendOnline ? 'rgba(5, 150, 105, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`,
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: backendOnline ? '#047857' : '#b91c1c'
        }}>
          <Radio size={13} style={{ animation: backendOnline ? 'pulseGlow 2s infinite' : 'none' }} />
          <span>{backendOnline ? 'LIVE API ONLINE' : 'DISCONNECTED'}</span>
        </div>

        <div className="persona-switcher">
          <UserCheck size={16} color="var(--brand-cyan)" />
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
