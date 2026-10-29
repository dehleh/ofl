import React, { useState, useEffect } from 'react';
import { 
  fetchAdminConfig, 
  updateAdminConfig, 
  sendTestEmail, 
  fetchStaffUsers, 
  createStaffUser, 
  updateStaffUser, 
  deactivateStaffUser 
} from '../services/api';
import { 
  Users, 
  Key, 
  Mail, 
  ShieldCheck, 
  Sliders, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  UserCheck, 
  UserX, 
  Lock, 
  ExternalLink,
  Server,
  Zap,
  Globe
} from 'lucide-react';

export const AdminConfigPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'SSO' | 'MFA' | 'EMAIL' | 'POLICY'>('USERS');
  const [loading, setLoading] = useState<boolean>(true);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // User modal state
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    name: '',
    role: 'ANALYST',
    department: 'Credit Underwriting',
    pin: '1988'
  });
  const [creatingUser, setCreatingUser] = useState<boolean>(false);

  // Email test state
  const [testRecipient, setTestRecipient] = useState<string>('admin@opticom.ng');
  const [testingEmail, setTestingEmail] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Form states for configuration sections
  const [ssoForm, setSsoForm] = useState<any>({});
  const [mfaForm, setMfaForm] = useState<any>({});
  const [emailForm, setEmailForm] = useState<any>({});
  const [smsForm, setSmsForm] = useState<any>({});
  const [policyForm, setPolicyForm] = useState<any>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [configData, userData] = await Promise.all([
        fetchAdminConfig(),
        fetchStaffUsers()
      ]);
      setConfigs(configData);
      setUsers(userData);

      if (configData.SSO_CONFIG?.value) setSsoForm({ ...configData.SSO_CONFIG.value });
      if (configData.MFA_CONFIG?.value) setMfaForm({ ...configData.MFA_CONFIG.value });
      if (configData.EMAIL_CLIENT?.value) setEmailForm({ ...configData.EMAIL_CLIENT.value });
      if (configData.SMS_GATEWAY?.value) setSmsForm({ ...configData.SMS_GATEWAY.value });
      if (configData.CREDIT_THRESHOLDS?.value) setPolicyForm({ ...configData.CREDIT_THRESHOLDS.value });
    } catch (err: any) {
      showToast(err.detail || 'Failed to load administrative configurations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (key: string, formValue: any) => {
    setSavingKey(key);
    try {
      const res = await updateAdminConfig(key, formValue);
      showToast(`Configuration for ${key} saved successfully.`);
      // Reload configurations to reflect state
      const refreshed = await fetchAdminConfig();
      setConfigs(refreshed);
    } catch (err: any) {
      showToast(err.detail || `Failed to update ${key}.`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.name) {
      showToast('Please fill all required user fields.', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      await createStaffUser(newUser);
      showToast(`Staff account for ${newUser.name} created successfully.`);
      setIsAddUserOpen(false);
      setNewUser({
        username: '',
        email: '',
        name: '',
        role: 'ANALYST',
        department: 'Credit Underwriting',
        pin: '1988'
      });
      const updatedUsers = await fetchStaffUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      showToast(err.detail || 'Failed to create user account.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await updateStaffUser(userId, { is_active: !currentActive });
      showToast(`User account status updated.`);
      const updatedUsers = await fetchStaffUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      showToast(err.detail || 'Failed to update user status.', 'error');
    }
  };

  const handleTestEmail = async () => {
    if (!testRecipient) {
      showToast('Please provide a recipient email.', 'error');
      return;
    }
    setTestingEmail(true);
    setTestResult(null);
    try {
      const result = await sendTestEmail(testRecipient, emailForm);
      setTestResult(result);
      if (result.success) {
        showToast('Diagnostic email verification passed!');
      } else {
        showToast(result.message || 'Diagnostic verification encountered an error.', 'error');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.detail || 'Email test request failed.',
        diagnostics: { error: String(err) }
      });
      showToast('Email connection diagnostic failed.', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: toastMessage.type === 'success' ? '#064e3b' : '#7f1d1d',
          color: '#ffffff',
          padding: '0.85rem 1.4rem',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          border: `1px solid ${toastMessage.type === 'success' ? 'var(--brand-teal)' : '#ef4444'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.88rem',
          fontWeight: 600,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} color="var(--brand-teal)" /> : <AlertTriangle size={18} color="#ef4444" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.08) 0%, rgba(0, 150, 204, 0.02) 100%)', border: '1px solid rgba(0, 150, 204, 0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-teal" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sliders size={12} /> ENTERPRISE ADMINISTRATION
              </span>
              <span className="badge" style={{ background: 'rgba(0, 150, 204, 0.1)', color: 'var(--brand-cerulean)', border: '1px solid rgba(0, 150, 204, 0.2)' }}>
                RC: 347832
              </span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-highlight)', margin: 0 }}>
              Opticom Platform Administration & Internal Configuration
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem', maxWidth: '780px' }}>
              Configure corporate identity federation (SSID/SSO), multi-factor authentication policies, custom outbound email & notification gateways, staff underwriting authority levels, and credit system parameters.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} className={loading ? 'pulse' : ''} />
              <span>Refresh Config</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem', overflowX: 'auto' }}>
          <button
            className={`tab-btn ${activeTab === 'USERS' ? 'active' : ''}`}
            onClick={() => setActiveTab('USERS')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.84rem' }}
          >
            <Users size={16} /> Staff & User Management ({users.length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'EMAIL' ? 'active' : ''}`}
            onClick={() => setActiveTab('EMAIL')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.84rem' }}
          >
            <Mail size={16} /> Custom Corporate Email & SMTP
          </button>

          <button
            className={`tab-btn ${activeTab === 'SSO' ? 'active' : ''}`}
            onClick={() => setActiveTab('SSO')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.84rem' }}
          >
            <Key size={16} /> SSO / SSID Federation
          </button>

          <button
            className={`tab-btn ${activeTab === 'MFA' ? 'active' : ''}`}
            onClick={() => setActiveTab('MFA')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.84rem' }}
          >
            <ShieldCheck size={16} /> MFA & Access Control
          </button>

          <button
            className={`tab-btn ${activeTab === 'POLICY' ? 'active' : ''}`}
            onClick={() => setActiveTab('POLICY')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.84rem' }}
          >
            <Sliders size={16} /> Credit Limits & Webhooks
          </button>
        </div>
      </div>

      {/* TAB 1: USERS & STAFF ACCESS MANAGEMENT */}
      {activeTab === 'USERS' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                Opticom Staff Directory & Role-Based Access Control (RBAC)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Manage internal underwriters, risk officers, BCC members, and executive committee credentials.
              </p>
            </div>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddUserOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={15} /> Add Staff Account
            </button>
          </div>

          {/* Add User Modal */}
          {isAddUserOpen && (
            <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(0, 196, 159, 0.04)', border: '1px solid var(--brand-teal)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--brand-teal-light)' }}>
                  Create New Internal Staff Account
                </h3>
                <button 
                  onClick={() => setIsAddUserOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Dapo Adeleke"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Corporate Email Address *</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="e.g. dapo.adeleke@opticom.ng"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Username / Staff Identifier *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. dadeleke"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assigned Role *</label>
                    <select 
                      className="form-select"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="ANALYST">Credit Analyst (Recommend & Review)</option>
                      <option value="HRM">Head of Risk Management (Mandate Review &le; ₦5m)</option>
                      <option value="BCC">BCC Chair / Authoriser (Limit &le; ₦15m)</option>
                      <option value="MD">Managing Director (Final Sanctions &gt; ₦15m)</option>
                      <option value="TREASURY">Treasury & Loan Ops (NAV / LOAN-DISC)</option>
                      <option value="IT_OWNER">IT Integration Owner / DevOps</option>
                      <option value="ADMIN">System Administrator (Full Settings)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Credit Underwriting"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Access PIN (Default: 1988)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="1988"
                      value={newUser.pin}
                      onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsAddUserOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm"
                    disabled={creatingUser}
                  >
                    {creatingUser ? 'Creating Account...' : 'Provision Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Username / Email</th>
                  <th>Role & Authority</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-highlight)' }}>{u.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {u.id}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: 'var(--brand-teal-light)' }}>{u.username}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        u.role === 'MD' ? 'badge-primary' :
                        u.role === 'BCC' ? 'badge-warning' :
                        u.role === 'HRM' ? 'badge-teal' :
                        u.role === 'ADMIN' ? 'badge-danger' : 'badge-neutral'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {u.department || 'Credit Operations'}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle2 size={11} /> ACTIVE
                        </span>
                      ) : (
                        <span className="badge badge-danger">DEACTIVATED</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => handleToggleUserActive(u.id, u.is_active)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM OUTBOUND EMAIL & SMTP CLIENT */}
      {activeTab === 'EMAIL' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem' }}>
          {/* Email Server Configuration Form */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(0, 196, 159, 0.12)',
                color: 'var(--brand-teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Server size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                  Custom Corporate Email Client (SMTP / API)
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Configure Opticom's private corporate mail server or transactional gateway.
                </p>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Integration Mode</label>
              <select 
                className="form-select"
                value={emailForm.mode || 'CUSTOM_SMTP'}
                onChange={(e) => setEmailForm({ ...emailForm, mode: e.target.value })}
              >
                <option value="CUSTOM_SMTP">Corporate SMTP Server (Microsoft 365, Exchange, Private Postfix)</option>
                <option value="DEFAULT_SENDGRID">Google Cloud / SendGrid Managed Gateway</option>
                <option value="CUSTOM_API">Custom HTTP Mail API (Amazon SES, Postmark, Mailgun)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Mail Client / Provider Name</label>
              <input 
                type="text"
                className="form-input"
                placeholder="e.g. Opticom Exchange Mail Server"
                value={emailForm.provider_name || ''}
                onChange={(e) => setEmailForm({ ...emailForm, provider_name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">SMTP Server Host</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. mail.opticom.ng or smtp.office365.com"
                  value={emailForm.smtp_host || ''}
                  onChange={(e) => setEmailForm({ ...emailForm, smtp_host: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Port</label>
                <input 
                  type="number"
                  className="form-input"
                  placeholder="587"
                  value={emailForm.smtp_port || 587}
                  onChange={(e) => setEmailForm({ ...emailForm, smtp_port: parseInt(e.target.value) || 587 })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Transport Encryption Security</label>
              <select 
                className="form-select"
                value={emailForm.security || 'STARTTLS'}
                onChange={(e) => setEmailForm({ ...emailForm, security: e.target.value })}
              >
                <option value="STARTTLS">STARTTLS (Port 587 Recommended)</option>
                <option value="SSL_TLS">SSL / TLS (Port 465)</option>
                <option value="NONE">Unencrypted Plain (Internal Intranet Port 25)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Username / Account ID</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. credit.notifications@opticom.ng"
                  value={emailForm.username || ''}
                  onChange={(e) => setEmailForm({ ...emailForm, username: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password / App Secret</label>
                <input 
                  type="password"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={emailForm.password || ''}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Sender Display Name</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Opticom Finance Credit Operations"
                  value={emailForm.from_name || ''}
                  onChange={(e) => setEmailForm({ ...emailForm, from_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sender Email Address</label>
                <input 
                  type="email"
                  className="form-input"
                  placeholder="credit.notifications@opticom.ng"
                  value={emailForm.from_email || ''}
                  onChange={(e) => setEmailForm({ ...emailForm, from_email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary"
                onClick={() => handleSaveConfig('EMAIL_CLIENT', emailForm)}
                disabled={savingKey === 'EMAIL_CLIENT'}
              >
                {savingKey === 'EMAIL_CLIENT' ? 'Saving Credentials...' : 'Save Email Server Configuration'}
              </button>
            </div>
          </div>

          {/* Real-time Diagnostic Test Email Card */}
          <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(0, 150, 204, 0.12)',
                color: 'var(--brand-cerulean)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                  Live Diagnostic Email Verification
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Test handshake, TLS negotiation, authentication, and end-to-end delivery.
                </p>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Destination Test Recipient</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="email"
                  className="form-input"
                  placeholder="e.g. compliance@opticom.ng"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
                <button 
                  className="btn btn-primary"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                >
                  <Send size={15} />
                  <span>{testingEmail ? 'Testing...' : 'Send Test'}</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Result Card */}
            {testResult && (
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                background: testResult.success ? 'rgba(0, 196, 159, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${testResult.success ? 'var(--brand-teal)' : '#ef4444'}`,
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {testResult.success ? <CheckCircle2 size={18} color="var(--brand-teal)" /> : <AlertTriangle size={18} color="#ef4444" />}
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: testResult.success ? 'var(--brand-teal-light)' : '#f87171' }}>
                    {testResult.success ? 'Diagnostic Passed (200 OK)' : 'Connection / Delivery Error'}
                  </span>
                  {testResult.latency_ms && (
                    <span className="badge badge-neutral" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                      ⚡ {testResult.latency_ms} ms
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {testResult.message}
                </p>

                {testResult.diagnostics && (
                  <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                    <div><strong>Server:</strong> {testResult.diagnostics.host}:{testResult.diagnostics.port}</div>
                    <div><strong>Transport:</strong> {testResult.diagnostics.security}</div>
                    <div><strong>Provider:</strong> {testResult.provider}</div>
                    <div><strong>Recipient:</strong> {testResult.diagnostics.recipient}</div>
                  </div>
                )}
              </div>
            )}

            {/* SMS Gateway Mini Card */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '0.75rem' }}>
                Transactional SMS Gateway (Termii Nigeria / Twilio)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">SMS Provider</label>
                  <select 
                    className="form-select"
                    value={smsForm.provider || 'TERMII_NIGERIA'}
                    onChange={(e) => setSmsForm({ ...smsForm, provider: e.target.value })}
                  >
                    <option value="TERMII_NIGERIA">Termii Nigeria (Local NGN Routes)</option>
                    <option value="TWILIO">Twilio Global Messaging</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sender ID</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="OPTICOM"
                    value={smsForm.sender_id || 'OPTICOM'}
                    onChange={(e) => setSmsForm({ ...smsForm, sender_id: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSaveConfig('SMS_GATEWAY', smsForm)}
                  disabled={savingKey === 'SMS_GATEWAY'}
                >
                  {savingKey === 'SMS_GATEWAY' ? 'Saving SMS Config...' : 'Save SMS Gateway'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SSO & IDENTITY FEDERATION */}
      {activeTab === 'SSO' && (
        <div className="card" style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.12)',
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Globe size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                Enterprise Single Sign-On (SSID / Tenant Federation)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Federate corporate employee authentication with Google Workspace, Microsoft Entra ID, or Okta.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SSO Identity Provider</label>
              <select 
                className="form-select"
                value={ssoForm.provider || 'google-workspace'}
                onChange={(e) => setSsoForm({ ...ssoForm, provider: e.target.value })}
              >
                <option value="google-workspace">Google Workspace / Cloud Identity (Recommended)</option>
                <option value="azure-ad">Microsoft Entra ID (Azure Active Directory)</option>
                <option value="okta">Okta Workforce Identity</option>
                <option value="custom-saml">Custom SAML 2.0 / OIDC</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tenant ID / SSID Domain</label>
              <input 
                type="text"
                className="form-input"
                placeholder="e.g. opticom.ng"
                value={ssoForm.tenant_id || ''}
                onChange={(e) => setSsoForm({ ...ssoForm, tenant_id: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">OAuth2 / OIDC Client ID</label>
            <input 
              type="text"
              className="form-input"
              placeholder="e.g. opticom-google-sso-client-id-2026.apps.googleusercontent.com"
              value={ssoForm.client_id || ''}
              onChange={(e) => setSsoForm({ ...ssoForm, client_id: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">OAuth2 / OIDC Client Secret</label>
            <input 
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={ssoForm.client_secret || ''}
              onChange={(e) => setSsoForm({ ...ssoForm, client_secret: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Authorized Redirect URI</label>
            <input 
              type="text"
              className="form-input"
              value={ssoForm.redirect_uri || 'https://credit.opticom.ng/api/v1/auth/sso-callback'}
              onChange={(e) => setSsoForm({ ...ssoForm, redirect_uri: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Default Role for New Users</label>
              <select 
                className="form-select"
                value={ssoForm.default_role || 'ANALYST'}
                onChange={(e) => setSsoForm({ ...ssoForm, default_role: e.target.value })}
              >
                <option value="ANALYST">Credit Analyst</option>
                <option value="HRM">Head of Risk Management</option>
                <option value="BCC">BCC Member</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem', gap: '0.5rem' }}>
              <input 
                type="checkbox"
                id="autoProvision"
                checked={ssoForm.auto_provision_users ?? true}
                onChange={(e) => setSsoForm({ ...ssoForm, auto_provision_users: e.target.checked })}
              />
              <label htmlFor="autoProvision" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Auto-provision corporate accounts on first SSO login
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary"
              onClick={() => handleSaveConfig('SSO_CONFIG', ssoForm)}
              disabled={savingKey === 'SSO_CONFIG'}
            >
              {savingKey === 'SSO_CONFIG' ? 'Saving SSO Settings...' : 'Save SSO / SSID Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: MFA & ACCESS CONTROL */}
      {activeTab === 'MFA' && (
        <div className="card" style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                Multi-Factor Authentication (MFA) & Session Policy
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Enforce step-up security verification for high-risk credit decisions and sanction authorities.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">MFA Enforcement Policy</label>
            <select 
              className="form-select"
              value={mfaForm.enforcement || 'HIGH_RISK_ONLY'}
              onChange={(e) => setMfaForm({ ...mfaForm, enforcement: e.target.value })}
            >
              <option value="HIGH_RISK_ONLY">HIGH-RISK ONLY (Enforced for BCC, MD Approvals & Treasury Disbursements)</option>
              <option value="ALL_STAFF">ALL STAFF (Mandatory 2FA on every login)</option>
              <option value="NONE">OPTIONAL / ADVISORY (Staff can enable voluntarily)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Session Lifetime (Minutes)</label>
              <input 
                type="number"
                className="form-input"
                placeholder="720"
                value={mfaForm.session_timeout_minutes || 720}
                onChange={(e) => setMfaForm({ ...mfaForm, session_timeout_minutes: parseInt(e.target.value) || 720 })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Default: 720 mins (12-hour shift token)</span>
            </div>

            <div className="form-group">
              <label className="form-label">Max Failed Attempts Before Lockout</label>
              <input 
                type="number"
                className="form-input"
                placeholder="5"
                value={mfaForm.max_failed_attempts || 5}
                onChange={(e) => setMfaForm({ ...mfaForm, max_failed_attempts: parseInt(e.target.value) || 5 })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary"
              onClick={() => handleSaveConfig('MFA_CONFIG', mfaForm)}
              disabled={savingKey === 'MFA_CONFIG'}
            >
              {savingKey === 'MFA_CONFIG' ? 'Saving Policy...' : 'Save MFA & Security Policy'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: POLICY THRESHOLDS & WEBHOOKS */}
      {activeTab === 'POLICY' && (
        <div className="card" style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sliders size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                Credit Origination Thresholds & Approval Limits
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Deterministic limits enforced outside the AI narrative generator (PRD Sections 7 & 17).
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">BESTO Boundary Upper Limit (₦)</label>
              <input 
                type="number"
                className="form-input"
                value={policyForm.besto_max || 2000000}
                onChange={(e) => setPolicyForm({ ...policyForm, besto_max: parseFloat(e.target.value) || 2000000 })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Applications &le; ₦2M originate in BESTO</span>
            </div>

            <div className="form-group">
              <label className="form-label">OFL Direct Lower Threshold (₦)</label>
              <input 
                type="number"
                className="form-input"
                value={policyForm.direct_min || 2000000.01}
                onChange={(e) => setPolicyForm({ ...policyForm, direct_min: parseFloat(e.target.value) || 2000000.01 })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Applications &gt; ₦2M originate via Direct Portal</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Analyst Limit (₦)</label>
              <input 
                type="number"
                className="form-input"
                value={policyForm.analyst_limit || 2000000}
                onChange={(e) => setPolicyForm({ ...policyForm, analyst_limit: parseFloat(e.target.value) || 2000000 })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recommend only</span>
            </div>

            <div className="form-group">
              <label className="form-label">HRM Mandate Limit (₦)</label>
              <input 
                type="number"
                className="form-input"
                value={policyForm.hrm_limit || 5000000}
                onChange={(e) => setPolicyForm({ ...policyForm, hrm_limit: parseFloat(e.target.value) || 5000000 })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Final approval up to ₦5M</span>
            </div>

            <div className="form-group">
              <label className="form-label">BCC Approval Limit (₦)</label>
              <input 
                type="number"
                className="form-input"
                value={policyForm.bcc_limit || 15000000}
                onChange={(e) => setPolicyForm({ ...policyForm, bcc_limit: parseFloat(e.target.value) || 15000000 })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BCC limit up to ₦15M</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary"
              onClick={() => handleSaveConfig('CREDIT_THRESHOLDS', policyForm)}
              disabled={savingKey === 'CREDIT_THRESHOLDS'}
            >
              {savingKey === 'CREDIT_THRESHOLDS' ? 'Saving Limits...' : 'Save Credit Policy Parameters'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
