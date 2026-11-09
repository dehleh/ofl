import React, { useState } from 'react';
import {
  UserCheck,
  Radio,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Bell,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  X,
  Zap,
  Clock
} from 'lucide-react';

interface HeaderProps {
  currentPersona: string;
  onPersonaChange: (persona: string) => void;
  backendOnline: boolean;
  currentUser?: any;
  onSignOut?: () => void;
  onExitToPublicClient?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPersona,
  onPersonaChange,
  backendOnline,
  currentUser,
  onSignOut,
  onExitToPublicClient
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    time: string;
    type: 'WARNING' | 'URGENT' | 'SUCCESS' | 'INFO';
    category: string;
    unread: boolean;
    caseNumber?: string;
  }>>([
    {
      id: 'NOTIF-001',
      title: 'HRM Risk Exception Alert',
      message: 'HRM raised exception on OFL-2026-0881 and routed to Credit Analyst. Head of BD alerted.',
      time: 'Just now',
      type: 'WARNING',
      category: 'RISK EXCEPTION',
      unread: true,
      caseNumber: 'OFL-2026-0881'
    },
    {
      id: 'NOTIF-002',
      title: 'MD Return Notification',
      message: 'Managing Director returned OFL-2026-0882 for clarification. Analyst, HRM, & BD prompted.',
      time: '6 mins ago',
      type: 'URGENT',
      category: 'EXECUTIVE RETURN',
      unread: true,
      caseNumber: 'OFL-2026-0882'
    },
    {
      id: 'NOTIF-003',
      title: '5% Default Penalty Levied',
      message: '7-Day Grace Period expired on ACC-OFL-2026-003. 5% overdue penalty applied (₦28,819.44).',
      time: '18 mins ago',
      type: 'WARNING',
      category: 'LOAN TELEMETRY',
      unread: true,
      caseNumber: 'OFL-2026-0883'
    },
    {
      id: 'NOTIF-004',
      title: 'Offer Letter Auto-Generated & Dispatched',
      message: 'MD approved facility OFL-2026-0880 (₦15,000,000). Offer letter dispatched to applicant.',
      time: '42 mins ago',
      type: 'SUCCESS',
      category: 'OFFER DISPATCHED',
      unread: true,
      caseNumber: 'OFL-2026-0880'
    },
    {
      id: 'NOTIF-005',
      title: 'MCC Review Assigned to Head of BD',
      message: 'Credit Analyst completed CAM for Dangote Flour Mills; assigned to Head of BD (MCC).',
      time: '1 hour ago',
      type: 'INFO',
      category: 'MCC ASSIGNMENT',
      unread: false,
      caseNumber: 'OFL-2026-0884'
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };
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
                INTERNAL COCKPIT
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
              borderColor: 'var(--border-medium)',
              fontWeight: 500
            }}
            title="Open customer loan portal in a new tab"
          >
            <ExternalLink size={13} /> View Public Portal
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
          <UserCheck size={16} color="var(--brand-cerulean)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Persona:</span>
          <select
            className="persona-select"
            value={currentPersona}
            onChange={(e) => onPersonaChange(e.target.value)}
          >
            <option value="MD">Managing Director (MD &bull; Highest Executive &amp; Admin Authority)</option>
            <option value="ADMIN">System Administrator (Full Enterprise Admin &amp; Config)</option>
            <option value="ANALYST">Credit Analyst (Recommend &amp; Review)</option>
            <option value="HRM">Head of Risk Management (Risk Review &amp; Concurrence)</option>
            <option value="HEAD_OF_BD">Head of Business Development (Commercial Sanction)</option>
            <option value="BCC">Board Credit Committee (Board Sanction &gt; ₦20m)</option>
            <option value="OPERATIONS">Credit Operations (Offer &amp; Conditions)</option>
            <option value="TREASURY">Treasury &amp; Loan Operations (LOAN-DISC)</option>
            <option value="BDO">Business Dev Officer (BDO Assisted)</option>
            <option value="AUDITOR">Compliance Auditor (Read-Only Audit)</option>
          </select>
        </div>

        {/* In-App Notifications Bell & Tray */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              position: 'relative',
              background: showNotifications ? '#f1f5f9' : '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.45rem 0.55rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: unreadCount > 0 ? '#0096cc' : '#64748b',
              transition: 'all 0.15s ease'
            }}
            title="System Alerts & Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                borderRadius: '9999px',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Floating Dropdown Notification Tray */}
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              width: '380px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.18)',
              zIndex: 9999,
              overflow: 'hidden'
            }}>
              {/* Tray Header */}
              <div style={{
                padding: '0.85rem 1.15rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Bell size={15} color="#0096cc" />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                    Notifications &amp; Alerts
                  </span>
                  {unreadCount > 0 && (
                    <span className="status-pill pill-cyan" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0096cc',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: '0.85rem 1.15rem',
                        borderBottom: '1px solid #f1f5f9',
                        background: n.unread ? 'rgba(0, 150, 204, 0.04)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = n.unread ? 'rgba(0, 150, 204, 0.04)' : '#ffffff'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: n.type === 'URGENT' ? '#fef2f2' : n.type === 'WARNING' ? '#fffbeb' : n.type === 'SUCCESS' ? '#f0fdf4' : '#eff6ff',
                            color: n.type === 'URGENT' ? '#b91c1c' : n.type === 'WARNING' ? '#b45309' : n.type === 'SUCCESS' ? '#15803d' : '#1d4ed8',
                            border: `1px solid ${n.type === 'URGENT' ? '#fecaca' : n.type === 'WARNING' ? '#fde68a' : n.type === 'SUCCESS' ? '#bbf7d0' : '#bfdbfe'}`
                          }}>
                            {n.category}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                            {n.title}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {n.time}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
                        {n.message}
                      </p>
                      {n.caseNumber && (
                        <div style={{ fontSize: '0.7rem', color: '#0096cc', fontWeight: 600, marginTop: '0.35rem' }}>
                          Case Ref: {n.caseNumber}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Tray Footer */}
              <div style={{
                padding: '0.6rem 1rem',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                textAlign: 'center',
                fontSize: '0.72rem',
                color: '#64748b'
              }}>
                Dispatched via Opticom Enterprise Notification Daemon
              </div>
            </div>
          )}
        </div>

        {currentUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            paddingLeft: '0.75rem',
            borderLeft: '1px solid #cbd5e1'
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                {currentUser.name || 'Staff User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {currentUser.email || `${currentPersona.toLowerCase()}@opticomfinance.com`}
              </div>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.78rem',
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  background: '#fff'
                }}
                title="Sign Out of Internal Cockpit"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
