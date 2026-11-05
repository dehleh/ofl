import React, { useState, useEffect } from 'react';
import { 
  fetchAdminConfig, 
  updateAdminConfig, 
  sendTestEmail, 
  fetchStaffUsers, 
  createStaffUser, 
  updateStaffUser, 
  deactivateStaffUser,
  fetchFeeCatalog,
  updateFeeCatalog
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
  Globe,
  Receipt,
  Trash2,
  DollarSign,
  Percent,
  Edit3
} from 'lucide-react';

export const AdminConfigPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'SSO' | 'MFA' | 'EMAIL' | 'POLICY' | 'FEES'>('USERS');
  const [loading, setLoading] = useState<boolean>(true);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [feeCatalog, setFeeCatalog] = useState<any[]>([]);
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

  // Fee catalog modal & edit states
  const [isAddFeeOpen, setIsAddFeeOpen] = useState<boolean>(false);
  const [newFee, setNewFee] = useState({
    name: '',
    fee_type: 'PERCENTAGE',
    rate: 1.0,
    is_mandatory_default: true,
    description: ''
  });
  const [savingFees, setSavingFees] = useState<boolean>(false);

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
      const [configData, userData, feeData] = await Promise.all([
        fetchAdminConfig(),
        fetchStaffUsers(),
        fetchFeeCatalog().catch(() => [])
      ]);
      setConfigs(configData);
      setUsers(userData);
      setFeeCatalog(Array.isArray(feeData) ? feeData : []);

      if (configData.SSO_CONFIG?.value) setSsoForm({ ...configData.SSO_CONFIG.value });
      if (configData.MFA_CONFIG?.value) setMfaForm({ ...configData.MFA_CONFIG.value });
      if (configData.EMAIL_CLIENT?.value) setEmailForm({ ...configData.EMAIL_CLIENT.value });
      if (configData.SMS_GATEWAY?.value) setSmsForm({ ...configData.SMS_GATEWAY.value });
      if (configData.CREDIT_THRESHOLDS?.value) {
        setPolicyForm({
          besto_max: 2000000,
          direct_min: 2000000.01,
          analyst_limit: 2000000,
          hrm_limit: 5000000,
          md_limit: 20000000,
          bcc_limit: 20000000,
          cbn_mpr: 23.0,
          commercial_margin: 5.0,
          effective_apr: 28.0,
          upfront_fee_pct: 4.5,
          ...configData.CREDIT_THRESHOLDS.value
        });
      }
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

          <button
            className={`tab-btn ${activeTab === 'FEES' ? 'active' : ''}`}
            onClick={() => setActiveTab('FEES')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.84rem' }}
          >
            <Receipt size={16} /> Fee Schedule & Bespoke Fees ({feeCatalog.length})
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
                      <option value="HRM">Head of Risk Management (Risk Review & Endorsement)</option>
                      <option value="HEAD_OF_BD">Head of Business Development (Commercial Sanction)</option>
                      <option value="MD">Managing Director (Final Sanction &le; ₦20m)</option>
                      <option value="BCC">BCC Chair / Authoriser (Board Sanction &gt; ₦20m)</option>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '880px' }}>
          
          {/* SECTION 1: CBN BENCHMARK & COMMERCIAL APR PRICING */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(0, 150, 204, 0.12)',
                color: '#0096cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                  Central Bank of Nigeria (CBN) Benchmark & Commercial Pricing Policy
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Manage the regulatory Monetary Policy Rate (MPR), commercial risk spread, and effective APR driving borrower calculators and facility term sheets.
                </p>
              </div>
            </div>

            {/* Live Pricing Formula Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.08) 0%, rgba(4, 19, 38, 0.04) 100%)',
              border: '1px solid rgba(0, 150, 204, 0.25)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{
                  background: '#0096cc',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.04em'
                }}>
                  ACTIVE PRICING FORMULA
                </span>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-highlight)' }}>
                  CBN MPR (<strong>{policyForm.cbn_mpr ?? 23.0}%</strong>) + Risk Spread (<strong>{policyForm.commercial_margin ?? 5.0}%</strong>) =
                  <strong style={{ color: '#0096cc', marginLeft: '0.4rem', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                    {policyForm.effective_apr ?? 28.0}% APR
                  </strong>
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                onClick={() => {
                  const mpr = policyForm.cbn_mpr ?? 23.0;
                  const margin = policyForm.commercial_margin ?? 5.0;
                  const autoApr = Math.round((mpr + margin) * 100) / 100;
                  setPolicyForm({ ...policyForm, effective_apr: autoApr });
                  showToast(`Calculated APR: ${mpr}% + ${margin}% = ${autoApr}% APR`);
                }}
              >
                Sync APR = MPR + Spread
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>CBN MPR Benchmark (%)</span>
                </label>
                <input 
                  type="number"
                  step="0.25"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  value={policyForm.cbn_mpr ?? 23.0}
                  onChange={(e) => {
                    const mpr = parseFloat(e.target.value) || 0;
                    const margin = policyForm.commercial_margin ?? 5.0;
                    setPolicyForm({
                      ...policyForm,
                      cbn_mpr: mpr,
                      effective_apr: Math.round((mpr + margin) * 100) / 100
                    });
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  CBN Monetary Policy Rate
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Commercial Risk Margin (%)
                </label>
                <input 
                  type="number"
                  step="0.25"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  value={policyForm.commercial_margin ?? 5.0}
                  onChange={(e) => {
                    const margin = parseFloat(e.target.value) || 0;
                    const mpr = policyForm.cbn_mpr ?? 23.0;
                    setPolicyForm({
                      ...policyForm,
                      commercial_margin: margin,
                      effective_apr: Math.round((mpr + margin) * 100) / 100
                    });
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Opticom commercial risk spread
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#0096cc', fontWeight: 700 }}>
                  Effective Lending Rate (APR %)
                </label>
                <input 
                  type="number"
                  step="0.25"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, borderColor: '#0096cc', color: '#0096cc' }}
                  value={policyForm.effective_apr ?? 28.0}
                  onChange={(e) => setPolicyForm({ ...policyForm, effective_apr: parseFloat(e.target.value) || 0 })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Applied across loan calculators
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Upfront Fee Rate (%)
                </label>
                <input 
                  type="number"
                  step="0.1"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  value={policyForm.upfront_fee_pct ?? 4.5}
                  onChange={(e) => setPolicyForm({ ...policyForm, upfront_fee_pct: parseFloat(e.target.value) || 0 })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Appraisal, facility &amp; legal fees
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: CREDIT ORIGINATION THRESHOLDS & APPROVAL LIMITS */}
          <div className="card">
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
                  Credit Origination Thresholds &amp; Approval Limits
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Deterministic limits enforced outside the AI narrative generator (PRD Sections 7 &amp; 17).
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Analyst Limit (₦)</label>
                <input 
                  type="number"
                  className="form-input"
                  value={policyForm.analyst_limit || 2000000}
                  onChange={(e) => setPolicyForm({ ...policyForm, analyst_limit: parseFloat(e.target.value) || 2000000 })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recommend &amp; review only</span>
              </div>

              <div className="form-group">
                <label className="form-label">HRM Mandate Limit (₦)</label>
                <input 
                  type="number"
                  className="form-input"
                  value={policyForm.hrm_limit || 5000000}
                  onChange={(e) => setPolicyForm({ ...policyForm, hrm_limit: parseFloat(e.target.value) || 5000000 })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Initial risk review &amp; route to Head of BD</span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#0096cc', fontWeight: 700 }}>MD Mandate Limit (₦)</label>
                <input 
                  type="number"
                  className="form-input"
                  style={{ borderColor: '#0096cc', fontWeight: 700 }}
                  value={policyForm.md_limit || 20000000}
                  onChange={(e) => setPolicyForm({ ...policyForm, md_limit: parseFloat(e.target.value) || 20000000 })}
                />
                <span style={{ fontSize: '0.72rem', color: '#0096cc' }}>Final sanction for facilities &le; ₦20M</span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#ef4444', fontWeight: 700 }}>BCC Sanction Threshold (₦)</label>
                <input 
                  type="number"
                  className="form-input"
                  style={{ borderColor: '#ef4444', fontWeight: 700 }}
                  value={policyForm.bcc_limit || 20000000}
                  onChange={(e) => setPolicyForm({ ...policyForm, bcc_limit: parseFloat(e.target.value) || 20000000 })}
                />
                <span style={{ fontSize: '0.72rem', color: '#ef4444' }}>Board Credit Committee required &gt; ₦20M</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button 
                className="btn btn-primary"
                onClick={() => handleSaveConfig('CREDIT_THRESHOLDS', policyForm)}
                disabled={savingKey === 'CREDIT_THRESHOLDS'}
              >
                {savingKey === 'CREDIT_THRESHOLDS' ? 'Saving Policy...' : 'Save Credit Policy & Pricing Parameters'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* TAB 6: MASTER & BESPOKE FACILITY FEES */}
      {activeTab === 'FEES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1050px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                  <Receipt size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                    Opticom Master Fee Schedule &amp; Bespoke Fee Catalog
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                    Configure basic Opticom standard charges and define bespoke fees that can be selected or customized in credit case workflows.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsAddFeeOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={15} /> Add Bespoke Fee
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    setSavingFees(true);
                    try {
                      const res = await updateFeeCatalog(feeCatalog);
                      setFeeCatalog(res.fees || feeCatalog);
                      showToast('Master fee catalog successfully saved to configuration.');
                    } catch (err: any) {
                      showToast(err.detail || 'Failed to save fee catalog.', 'error');
                    } finally {
                      setSavingFees(false);
                    }
                  }}
                  disabled={savingFees}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {savingFees ? 'Saving...' : 'Save Fee Catalog'}
                </button>
              </div>
            </div>

            {/* Statutory VAT Notice Banner */}
            <div style={{
              background: 'rgba(0, 150, 204, 0.06)',
              border: '1px solid rgba(0, 150, 204, 0.25)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ background: '#0096cc', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                  STATUTORY FIRS RULE
                </span>
                <span style={{ color: 'var(--text-highlight)' }}>
                  VAT (<strong>7.5%</strong>) is legally computed on facility service fees (Management &amp; Processing charges) rather than the debt principal.
                </span>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                RC: 347832
              </span>
            </div>

            {/* Modal: Add Bespoke Fee */}
            {isAddFeeOpen && (
              <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: '#10b981' }}>
                    + Define New Bespoke Facility Fee
                  </h3>
                  <button 
                    onClick={() => setIsAddFeeOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Fee Title / Name *</label>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="e.g. Collateral Valuation Fee"
                      value={newFee.name}
                      onChange={(e) => setNewFee({ ...newFee, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Calculation Basis *</label>
                    <select
                      className="form-select"
                      value={newFee.fee_type}
                      onChange={(e) => setNewFee({ ...newFee, fee_type: e.target.value })}
                    >
                      <option value="PERCENTAGE">Percentage of Principal (%)</option>
                      <option value="FLAT">Flat Fixed Amount (₦)</option>
                      <option value="PERCENTAGE_OF_FEES">Percentage of Service Fees (%)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Default Rate / Quantum ({newFee.fee_type === 'FLAT' ? '₦' : '%'}) *
                    </label>
                    <input 
                      type="number"
                      step={newFee.fee_type === 'FLAT' ? '1000' : '0.005'}
                      className="form-input"
                      value={newFee.rate}
                      onChange={(e) => setNewFee({ ...newFee, rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description / Legal Basis</label>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="e.g. Independent valuation of pledged real estate or movable assets"
                      value={newFee.description}
                      onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input 
                      type="checkbox"
                      checked={newFee.is_mandatory_default}
                      onChange={(e) => setNewFee({ ...newFee, is_mandatory_default: e.target.checked })}
                    />
                    <span>Selected / Mandatory by default on new credit cases</span>
                  </label>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsAddFeeOpen(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (!newFee.name.trim()) {
                          showToast('Please enter a valid fee name.', 'error');
                          return;
                        }
                        const id = `fee_bespoke_${Date.now()}`;
                        const updated = [...feeCatalog, { ...newFee, id }];
                        setFeeCatalog(updated);
                        setIsAddFeeOpen(false);
                        setNewFee({
                          name: '',
                          fee_type: 'PERCENTAGE',
                          rate: 1.0,
                          is_mandatory_default: true,
                          description: ''
                        });
                        showToast(`Bespoke fee "${newFee.name}" added to catalog. Click "Save Fee Catalog" to persist.`);
                      }}
                    >
                      Add to Catalog
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Master Fee Catalog Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Fee Title</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Calculation Basis</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Rate / Quantum</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Default State</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feeCatalog.map((item, idx) => (
                    <tr 
                      key={item.id || idx}
                      style={{ borderBottom: '1px solid var(--border-subtle)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)' }}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-highlight)' }}>
                        <input 
                          type="text"
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '180px' }}
                          value={item.name}
                          onChange={(e) => {
                            const updated = [...feeCatalog];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setFeeCatalog(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          background: item.fee_type === 'PERCENTAGE' 
                            ? 'rgba(0, 150, 204, 0.12)' 
                            : item.fee_type === 'FLAT' 
                              ? 'rgba(234, 179, 8, 0.12)' 
                              : 'rgba(16, 185, 129, 0.12)',
                          color: item.fee_type === 'PERCENTAGE' 
                            ? '#0096cc' 
                            : item.fee_type === 'FLAT' 
                              ? '#eab308' 
                              : '#10b981'
                        }}>
                          {item.fee_type === 'PERCENTAGE' ? '% of Principal' : item.fee_type === 'FLAT' ? 'Flat Fixed (₦)' : '% of Fees (VAT)'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <input 
                            type="number"
                            step={item.fee_type === 'FLAT' ? '1000' : '0.005'}
                            className="form-input"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '100px', fontFamily: 'var(--font-mono)' }}
                            value={item.rate}
                            onChange={(e) => {
                              const updated = [...feeCatalog];
                              updated[idx] = { ...updated[idx], rate: parseFloat(e.target.value) || 0 };
                              setFeeCatalog(updated);
                            }}
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {item.fee_type === 'FLAT' ? '₦' : '%'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={!!item.is_mandatory_default}
                            onChange={(e) => {
                              const updated = [...feeCatalog];
                              updated[idx] = { ...updated[idx], is_mandatory_default: e.target.checked };
                              setFeeCatalog(updated);
                            }}
                          />
                          <span style={{ fontSize: '0.76rem', color: item.is_mandatory_default ? 'var(--text-highlight)' : 'var(--text-muted)' }}>
                            {item.is_mandatory_default ? 'Default Active' : 'Optional / Manual'}
                          </span>
                        </label>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                        <input 
                          type="text"
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem', width: '100%' }}
                          value={item.description || ''}
                          onChange={(e) => {
                            const updated = [...feeCatalog];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            setFeeCatalog(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {item.id?.startsWith('fee_bespoke_') ? (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = feeCatalog.filter((_, i) => i !== idx);
                              setFeeCatalog(updated);
                              showToast(`Removed bespoke fee "${item.name}".`);
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Delete Bespoke Fee"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Core Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live Interactive Fee Calculator on Sample Principal */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: 'var(--text-highlight)' }}>
                Live Model Verification: Sample Facility Deduction Simulator (₦10,000,000)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Sample Principal</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-highlight)', fontFamily: 'var(--font-mono)' }}>
                    ₦10,000,000.00
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Management + Processing (4%)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0096cc', fontFamily: 'var(--font-mono)' }}>
                    ₦400,000.00
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Mgt ₦200k + Proc ₦200k</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>VAT on Fees (7.5%)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#eab308', fontFamily: 'var(--font-mono)' }}>
                    ₦30,000.00
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>7.5% of ₦400k service fees</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Stamp Duty (0.125%)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#8b5cf6', fontFamily: 'var(--font-mono)' }}>
                    ₦12,500.00
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Statutory agreement stamp</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid #10b981' }}>
                  <div style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>Base Upfront Total &amp; Net Disbursed</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                    ₦9,557,500.00
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Total Deductions: ₦442,500.00 (4.425%)</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
