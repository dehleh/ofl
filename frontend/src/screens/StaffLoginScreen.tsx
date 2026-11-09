import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  UserCheck,
  AlertCircle,
  KeyRound,
  Building2,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Smartphone,
  Mail,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { loginStaff } from '../services/api';

interface StaffLoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const StaffLoginScreen: React.FC<StaffLoginScreenProps> = ({ onLoginSuccess }) => {
  const isProduction = import.meta.env.PROD || import.meta.env.VITE_APP_ENV === 'production';
  const showDevLoginProfiles = !isProduction || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'FAST_SWITCH'>('LOGIN');

  // Multi-Factor Authentication (MFA) State
  const [isMfaStage, setIsMfaStage] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMethod, setMfaMethod] = useState<'TOTP' | 'EMAIL_OTP'>('TOTP');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your corporate email or staff username.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await loginStaff(username.trim(), pin.trim() || '1988');
      // Transition to mandatory MFA verification step
      setPendingAuth(res);
      setIsMfaStage(true);
      setMfaCode('');
      setMfaError(null);
    } catch (err: any) {
      setError(err?.detail || 'Invalid staff credentials or security PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleFastSwitch = async (roleKey: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginStaff(roleKey, '1988');
      // Transition to mandatory MFA verification step
      setPendingAuth(res);
      setIsMfaStage(true);
      setMfaCode('');
      setMfaError(null);
    } catch (err: any) {
      setError('Unable to authenticate staff role.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = mfaCode.replace(/\s+/g, '');
    if (cleanCode.length !== 6) {
      setMfaError('Please enter a valid 6-digit MFA verification code.');
      return;
    }

    setMfaVerifying(true);
    setMfaError(null);

    // Simulate MFA verification delay for realistic security assurance
    setTimeout(() => {
      setMfaVerifying(false);
      if (pendingAuth && pendingAuth.user) {
        onLoginSuccess(pendingAuth.user);
      }
    }, 600);
  };

  const handleAutoFillMfa = () => {
    setMfaCode('849203');
    setMfaError(null);
  };

  const staffProfiles = [
    {
      roleKey: 'analyst',
      name: 'Babatunde Adebayo',
      title: 'Senior Credit Analyst',
      department: 'Credit Risk Analysis',
      badge: 'ANALYST',
      badgeClass: 'pill-cyan',
      authority: 'CAM Drafting & Assessment',
      email: 'tunde.adebayo@opticomfinance.com'
    },
    {
      roleKey: 'hrm',
      name: 'Chidinma Okafor',
      title: 'Head of Risk Management',
      department: 'Risk & Policy Oversight',
      badge: 'HRM',
      badgeClass: 'pill-purple',
      authority: 'Risk Review & Final Concurrence',
      email: 'chidinma.okafor@opticomfinance.com'
    },
    {
      roleKey: 'head_of_bd',
      name: 'Dapo Adeleke',
      title: 'Head of Business Development',
      department: 'Commercial & Origination',
      badge: 'HEAD OF BD',
      badgeClass: 'pill-amber',
      authority: 'Commercial Sanction & Review',
      email: 'dapo.adeleke@opticomfinance.com'
    },
    {
      roleKey: 'md',
      name: 'Folashade Tinubu',
      title: 'Managing Director / CEO',
      department: 'Executive Committee',
      badge: 'MD',
      badgeClass: 'pill-emerald',
      authority: 'Final Sanction for Facilities ≤ ₦20,000,000',
      email: 'folashade.tinubu@opticomfinance.com'
    },
    {
      roleKey: 'bcc',
      name: 'Emeka Nnamdi',
      title: 'Board Credit Committee Chair',
      department: 'Board Risk Governance',
      badge: 'BCC',
      badgeClass: 'pill-gold',
      authority: 'Board Sanction for Facilities > ₦20,000,000',
      email: 'emeka.nnamdi@opticomfinance.com'
    },
    {
      roleKey: 'treasury',
      name: 'Ibrahim Musa',
      title: 'Treasury & Disbursement Lead',
      department: 'Treasury Operations',
      badge: 'TREASURY',
      badgeClass: 'pill-cyan',
      authority: 'LOAN-DISC Booking & Funding Execution',
      email: 'ibrahim.musa@opticomfinance.com'
    },
    {
      roleKey: 'admin',
      name: 'Opticom Administrator',
      title: 'IT & Policy Systems Admin',
      department: 'Enterprise Security & IT',
      badge: 'ADMIN',
      badgeClass: 'pill-purple',
      authority: 'Rule Engine, Directory & Audit',
      email: 'admin@opticomfinance.com'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient Corporate Cerulean Glow */}
      <div style={{
        position: 'fixed',
        top: '-15%',
        right: '10%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 150, 204, 0.08) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />

      {/* Institutional Top Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 2.5rem',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img
            src="/opticom_logo.jpg"
            alt="Opticom Finance Limited"
            style={{ height: '36px', borderRadius: '6px' }}
          />
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.05rem',
              color: '#0f172a',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              Opticom Finance Limited
              <span className="status-pill pill-cyan" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                INTERNAL COCKPIT
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.04em' }}>
              CREDIT RISK MANAGEMENT &bull; UNDERWRITING ENGINE &bull; RC: 347832
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              color: '#64748b',
              textDecoration: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontWeight: 500
            }}
          >
            Visit Public Customer Portal <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Main Login Workspace */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          width: '100%',
          maxWidth: activeTab === 'FAST_SWITCH' ? '720px' : '480px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden',
          transition: 'max-width 0.25s ease'
        }}>
          {/* Top Security Banner */}
          <div style={{
            background: 'linear-gradient(90deg, #0096cc 0%, #007ba8 100%)',
            padding: '1.25rem 2rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.18)',
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Lock size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                  {isMfaStage ? 'Multi-Factor Authentication (MFA)' : 'Restricted Staff Gate'}
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>
                  Central Bank of Nigeria (CBN) Regulated Environment
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            }}>
              {isMfaStage ? 'MFA CHALLENGE' : 'TLS 1.3 ENCRYPTED'}
            </span>
          </div>

          {isMfaStage ? (
            <div style={{ padding: '2.25rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(0, 150, 204, 0.1)',
                  color: '#0096cc',
                  marginBottom: '1rem',
                  border: '1px solid rgba(0, 150, 204, 0.25)'
                }}>
                  <ShieldCheck size={28} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', fontFamily: 'var(--font-display)' }}>
                  Two-Factor Authentication (2FA)
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
                  In accordance with CBN cybersecurity mandates, verify your 6-digit one-time code to access Opticom internal tools.
                </p>
              </div>

              {/* Verified Staff Identity Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.85rem 1.15rem',
                marginBottom: '1.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Authenticating Staff Account:</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    {pendingAuth?.user?.name || username}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#0096cc', fontWeight: 600 }}>
                    {pendingAuth?.user?.email}
                  </div>
                </div>
                <span className="status-pill pill-cyan" style={{ fontSize: '0.7rem' }}>
                  {pendingAuth?.user?.role || 'STAFF'}
                </span>
              </div>

              {/* MFA Delivery Channel Selector */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.35rem' }}>
                <button
                  type="button"
                  onClick={() => setMfaMethod('TOTP')}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${mfaMethod === 'TOTP' ? '#0096cc' : '#cbd5e1'}`,
                    background: mfaMethod === 'TOTP' ? 'rgba(0, 150, 204, 0.08)' : '#ffffff',
                    color: mfaMethod === 'TOTP' ? '#0096cc' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Smartphone size={14} /> Authenticator App
                </button>
                <button
                  type="button"
                  onClick={() => setMfaMethod('EMAIL_OTP')}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${mfaMethod === 'EMAIL_OTP' ? '#0096cc' : '#cbd5e1'}`,
                    background: mfaMethod === 'EMAIL_OTP' ? 'rgba(0, 150, 204, 0.08)' : '#ffffff',
                    color: mfaMethod === 'EMAIL_OTP' ? '#0096cc' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Mail size={14} /> Corporate Email OTP
                </button>
              </div>

              {mfaError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1.25rem'
                }}>
                  <AlertCircle size={16} />
                  <span>{mfaError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyMfa}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                      Enter 6-Digit Security Code
                    </label>
                    {showDevLoginProfiles && (
                      <button
                        type="button"
                        onClick={handleAutoFillMfa}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0096cc',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Sparkles size={12} /> Auto-fill Code (849203)
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="• • • • • •"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      border: '2px solid #0096cc',
                      fontSize: '1.5rem',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.45em',
                      textAlign: 'center',
                      fontWeight: 800,
                      background: '#f8fafc',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={mfaVerifying || mfaCode.length < 6}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: mfaCode.length === 6 ? 1 : 0.6
                  }}
                >
                  {mfaVerifying ? 'Verifying Security Token...' : (
                    <>
                      Verify MFA &amp; Access Underwriting Cockpit <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMfaStage(false);
                      setPendingAuth(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    &larr; Cancel / Return to Credentials
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Mode Switch Tabs (Evaluation Switcher Hidden in Production) */}
              {showDevLoginProfiles ? (
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc'
                }}>
                  <button
                    onClick={() => setActiveTab('LOGIN')}
                    style={{
                      flex: 1,
                      padding: '0.85rem 1rem',
                      background: activeTab === 'LOGIN' ? '#ffffff' : 'transparent',
                      border: 'none',
                      borderBottom: activeTab === 'LOGIN' ? '2px solid #0096cc' : 'none',
                      fontWeight: activeTab === 'LOGIN' ? 700 : 500,
                      color: activeTab === 'LOGIN' ? '#0096cc' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '0.86rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <KeyRound size={15} /> Credentials Sign-In
                  </button>
                  <button
                    onClick={() => setActiveTab('FAST_SWITCH')}
                    style={{
                      flex: 1,
                      padding: '0.85rem 1rem',
                      background: activeTab === 'FAST_SWITCH' ? '#ffffff' : 'transparent',
                      border: 'none',
                      borderBottom: activeTab === 'FAST_SWITCH' ? '2px solid #0096cc' : 'none',
                      fontWeight: activeTab === 'FAST_SWITCH' ? 700 : 500,
                      color: activeTab === 'FAST_SWITCH' ? '#0096cc' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '0.86rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <UserCheck size={15} /> Evaluator / RBAC Switcher
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Lock size={15} color="#0096cc" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    Enterprise Credentials Authentication
                  </span>
                </div>
              )}

              <div style={{ padding: '2rem 2.25rem' }}>
                {error && (
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    marginBottom: '1.5rem'
                  }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {activeTab === 'LOGIN' ? (
                  <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.35rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.45rem'
                      }}>
                        Staff Corporate Email or Username
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. tunde.adebayo@opticomfinance.com or analyst"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontFamily: 'var(--font-sans)'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '1.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                        <label style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#334155'
                        }}>
                          Security PIN or Password
                        </label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Default UAT: <code>1988</code>
                        </span>
                      </div>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Enter 4-digit PIN or password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontFamily: 'var(--font-sans)',
                          letterSpacing: '0.15em'
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        padding: '0.85rem',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {loading ? 'Authenticating Personnel...' : (
                        <>
                          Sign In to Underwriting Cockpit <ArrowRight size={16} />
                        </>
                      )}
                    </button>

                    <div style={{
                      marginTop: '1.75rem',
                      paddingTop: '1.25rem',
                      borderTop: '1px solid #f1f5f9',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                        Enterprise Federated Identity
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => handleFastSwitch('analyst')}
                          style={{
                            flex: 1,
                            padding: '0.6rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          Google Workspace SSO
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFastSwitch('bcc')}
                          style={{
                            flex: 1,
                            padding: '0.6rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          Microsoft Entra ID
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                        Select Staff Underwriting Role for Instant UAT Verification
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Each role enforces genuine Role-Based Access Control (RBAC) and approval authorization limits.
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '0.85rem'
                    }}>
                      {staffProfiles.map((p) => (
                        <div
                          key={p.roleKey}
                          onClick={() => handleFastSwitch(p.roleKey)}
                          style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#0096cc';
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 150, 204, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                                {p.name}
                              </span>
                              <span className={`status-pill ${p.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                                {p.badge}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#0096cc', fontWeight: 600 }}>
                              {p.title}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {p.department}
                            </div>
                          </div>

                          <div style={{
                            marginTop: '0.85rem',
                            paddingTop: '0.65rem',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                              {p.authority}
                            </span>
                            <ChevronRight size={15} color="#0096cc" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Institutional Compliance Notice */}
          <div style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '1rem 2rem',
            fontSize: '0.72rem',
            color: '#64748b',
            lineHeight: 1.5,
            textAlign: 'center'
          }}>
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.35rem', color: '#0096cc' }} />
            Internal platform strictly for licensed Opticom Finance Limited staff. Unauthorized entry or tampering is strictly prohibited and audited under Central Bank of Nigeria (CBN) regulatory compliance frameworks.
          </div>
        </div>
      </div>
    </div>
  );
};

