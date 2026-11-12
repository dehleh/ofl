import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  ShieldAlert, 
  TrendingUp, 
  RefreshCw, 
  CreditCard, 
  FileText, 
  ArrowUpRight, 
  ChevronRight, 
  Zap,
  Filter,
  Search,
  ExternalLink,
  Percent,
  CheckCheck,
  Download,
  Printer,
  Eye,
  X
} from 'lucide-react';
import { 
  fetchLoanPortfolioPerformance, 
  fetchSingleLoanPerformance, 
  recordLoanRepayment, 
  simulateLoanPerformanceStatus,
  fetchTelemetryReportData,
  getTelemetryExportUrl
} from '../services/api';

interface LoanPerformanceTelemetryProps {
  currentPersona: string;
  onSelectCase?: (caseId: string) => void;
}

export const LoanPerformanceTelemetry: React.FC<LoanPerformanceTelemetryProps> = ({
  currentPersona,
  onSelectCase
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Payment recording modal state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('DIRECT_DEBIT');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);

  // Periodic Telemetry Reports (Monthly, Quarterly, Biannual, Annual) State
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'biannual' | 'annual'>('quarterly');
  const [showReportPreviewModal, setShowReportPreviewModal] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  const handleDownloadCsv = (period: string = selectedPeriod) => {
    const url = getTelemetryExportUrl(period, 'csv');
    window.open(url, '_blank');
  };

  const handlePrintPdf = (period: string = selectedPeriod) => {
    const url = getTelemetryExportUrl(period, 'html');
    window.open(url, '_blank');
  };

  const handleOpenReportPreview = async (period: string = selectedPeriod) => {
    setLoadingReport(true);
    setShowReportPreviewModal(true);
    try {
      const data = await fetchTelemetryReportData(period);
      setReportData(data);
    } catch (e) {
      console.error('Failed to load report data', e);
    } finally {
      setLoadingReport(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLoanPortfolioPerformance();
      setPortfolioData(data);
      if (selectedLoan) {
        // Refresh selected loan if opened
        const updatedDossier = await fetchSingleLoanPerformance(selectedLoan.case_id);
        setSelectedLoan(updatedDossier);
      }
    } catch (err) {
      console.error('Failed to load loan performance telemetry', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDossier = async (caseId: string) => {
    setLoadingDossier(true);
    try {
      const dossier = await fetchSingleLoanPerformance(caseId);
      setSelectedLoan(dossier);
    } catch (err) {
      console.error('Failed to load loan dossier', err);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !paymentAmount) return;
    
    setIsSubmittingPayment(true);
    setPaymentFeedback(null);
    try {
      const res = await recordLoanRepayment(
        selectedLoan.case_id, 
        parseFloat(paymentAmount), 
        paymentMethod, 
        paymentReference || `OPT-REC-${Date.now().toString().slice(-6)}`,
        paymentNote
      );
      setPaymentFeedback(`Repayment of ₦${parseFloat(paymentAmount).toLocaleString()} recorded successfully!`);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNote('');
      // Reload updated portfolio & dossier
      await loadData();
      const updatedDossier = await fetchSingleLoanPerformance(selectedLoan.case_id);
      setSelectedLoan(updatedDossier);
    } catch (err: any) {
      setPaymentFeedback(err.detail || err.message || 'Payment recording failed.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSimulateStatus = async (caseId: string, scenario: 'CURRENT' | 'GRACE_PERIOD' | 'OVERDUE_PENALTY' | 'CRITICAL') => {
    try {
      await simulateLoanPerformanceStatus(caseId, scenario);
      await loadData();
      if (selectedLoan && selectedLoan.case_id === caseId) {
        const updatedDossier = await fetchSingleLoanPerformance(caseId);
        setSelectedLoan(updatedDossier);
      }
    } catch (err) {
      console.error('Simulation failed', err);
    }
  };

  const formatNaira = (amount: number | null | undefined) => {
    if (amount === undefined || amount === null) return '₦0.00';
    return `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const metrics = portfolioData?.portfolio_metrics || {};
  const accounts: any[] = portfolioData?.accounts || [];

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = 
      acc.borrower_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.facility_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.case_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    return acc.performance_status === statusFilter;
  });

  const getStatusBadge = (status: string, daysOverdue: number, penalty: number) => {
    switch (status) {
      case 'PERFORMING_CURRENT':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            <CheckCircle2 size={13} /> Current &amp; Performing
          </span>
        );
      case 'GRACE_PERIOD_ACTIVE':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            <Clock size={13} /> 7-Day Grace Period ({daysOverdue}d overdue)
          </span>
        );
      case 'OVERDUE_PENALTY_APPLIED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#dc2626',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            <AlertTriangle size={13} /> 5% Penalty Levied (+{formatNaira(penalty)})
          </span>
        );
      case 'CRITICAL_DELINQUENT':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(127, 29, 29, 0.2)',
            color: '#991b1b',
            border: '1px solid rgba(127, 29, 29, 0.4)',
            fontSize: '0.75rem',
            fontWeight: 800
          }}>
            <ShieldAlert size={13} /> Critical Default ({daysOverdue}d overdue)
          </span>
        );
      case 'CLOSED_FULLY_SETTLED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#2563eb',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            <CheckCheck size={13} /> Fully Settled &amp; Closed
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      {/* Platform Title & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(0, 150, 204, 0.12)',
              color: '#0096cc',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}>
              <Activity size={12} /> POST-DISBURSEMENT TELEMETRY
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Real-Time Loan Servicing &amp; Default Recovery</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-highlight)', margin: 0 }}>
            Opticom Loan Performance &amp; Portfolio Telemetry
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Continuous post-disbursement surveillance, amortized collection tracking, 7-day grace monitoring, and automated 5% default penalty enforcement.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            onClick={() => handleOpenReportPreview(selectedPeriod)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
          >
            <FileText size={14} color="#0096cc" /> Executive Reports
          </button>
          <button 
            onClick={loadData}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Opticom 7-Day Grace & 5% Default Penalty Policy Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 150, 204, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)',
        border: '1px solid rgba(0, 150, 204, 0.25)',
        borderRadius: '10px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '300px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(0, 150, 204, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0096cc',
            flexShrink: 0
          }}>
            <Percent size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-highlight)' }}>
              Opticom 7-Day Grace &amp; 5% Default Penalty Protocol
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Borrowers enjoy a <strong>7-calendar-day grace period</strong> post due date without penalty. On day 8+, a deterministic <strong>5% penalty</strong> is automatically levied on the overdue installment until serviced.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', paddingLeft: '0.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Penalty Rate</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>5.0%</div>
          </div>
          <div style={{ width: '1px', height: '28px', background: 'var(--border-color)' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grace Window</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>7 Days</div>
          </div>
        </div>
      </div>

      {/* Executive Telemetry Periodic Reporting & Downloads Hub */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1.5px solid rgba(0, 150, 204, 0.25)',
        borderRadius: '10px',
        padding: '1.15rem 1.35rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(0, 150, 204, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0096cc'
            }}>
              <Download size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-highlight)' }}>
                Download Telemetry Reports &amp; Periodic Audits
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Official compliance dossiers covering funded facilities, servicing performance, DPD aging, 5% penalties, and collection yields.
              </div>
            </div>
          </div>

          {/* Period Selector Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
            <button
              className={`btn-filter ${selectedPeriod === 'monthly' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
              onClick={() => setSelectedPeriod('monthly')}
            >
              📅 Monthly (30d)
            </button>
            <button
              className={`btn-filter ${selectedPeriod === 'quarterly' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
              onClick={() => setSelectedPeriod('quarterly')}
            >
              📊 Quarterly (90d)
            </button>
            <button
              className={`btn-filter ${selectedPeriod === 'biannual' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
              onClick={() => setSelectedPeriod('biannual')}
            >
              📈 Biannual (6Mo)
            </button>
            <button
              className={`btn-filter ${selectedPeriod === 'annual' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
              onClick={() => setSelectedPeriod('annual')}
            >
              🏛️ Annual (1Yr)
            </button>
          </div>
        </div>

        {/* Selected Period Details and Download Actions Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.85rem 1rem',
          background: 'rgba(0, 150, 204, 0.04)',
          borderRadius: '8px',
          border: '1px solid rgba(0, 150, 204, 0.18)'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-highlight)' }}>
              {selectedPeriod === 'monthly' ? 'Monthly Servicing & Repayment Audit (30 Days)' :
               selectedPeriod === 'quarterly' ? 'Quarterly Portfolio Health & Delinquency Synthesis (90 Days / Q-Audit)' :
               selectedPeriod === 'biannual' ? 'Biannual Comprehensive Risk & Recovery Audit (Half-Year / 180 Days)' :
               'Annual Fiscal Year Underwriting & Default Telemetry (365 Days)'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Includes itemized borrower rosters, DPD aging, 5% penalties, and statutory sign-offs for MD, HRM, and Head of BD.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenReportPreview(selectedPeriod)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <Eye size={14} color="#0096cc" /> Preview Report
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleDownloadCsv(selectedPeriod)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '6px 12px', borderColor: '#059669', color: '#059669' }}
            >
              <Download size={14} /> Download CSV (Excel)
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handlePrintPdf(selectedPeriod)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <Printer size={14} /> Print / Save PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Executive KPI Cards */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} color="#0096cc" /> Total Disbursed Capital
          </div>
          <div className="metric-value" style={{ color: '#0096cc' }}>
            {formatNaira(metrics.total_disbursed_principal)}
          </div>
          <div className="metric-footer">
            Across {metrics.total_active_loans || 0} active serviced credit facilities
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} color="#10b981" /> Total Serviced (Collected)
          </div>
          <div className="metric-value" style={{ color: '#10b981' }}>
            {formatNaira(metrics.total_amount_serviced)}
          </div>
          <div className="metric-footer">
            Principal: {formatNaira(metrics.total_principal_serviced)} • Int: {formatNaira(metrics.total_interest_serviced)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="#f59e0b" /> Outstanding Debt Balance
          </div>
          <div className="metric-value" style={{ color: '#f59e0b' }}>
            {formatNaira(metrics.total_outstanding_balance)}
          </div>
          <div className="metric-footer">
            Remaining Principal: {formatNaira(metrics.total_outstanding_principal)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} color="#dc2626" /> Default Penalties Accrued
          </div>
          <div className="metric-value" style={{ color: '#dc2626' }}>
            {formatNaira(metrics.total_penalties_accrued)}
          </div>
          <div className="metric-footer">
            Levied on unserviced facilities past 7-day grace
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        background: 'var(--panel-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.75rem 1rem'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search borrower name, facility number, or case..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              width: '100%'
            }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={12} /> Filter:
          </span>
          {[
            { id: 'ALL', label: 'All Facilities' },
            { id: 'PERFORMING_CURRENT', label: 'Current' },
            { id: 'GRACE_PERIOD_ACTIVE', label: 'In Grace (≤7d)' },
            { id: 'OVERDUE_PENALTY_APPLIED', label: '5% Overdue Penalty' },
            { id: 'CRITICAL_DELINQUENT', label: 'Critical' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                fontSize: '0.75rem',
                fontWeight: statusFilter === f.id ? 700 : 500,
                padding: '4px 10px',
                borderRadius: '6px',
                border: statusFilter === f.id ? '1px solid #0096cc' : '1px solid var(--border-color)',
                background: statusFilter === f.id ? 'rgba(0, 150, 204, 0.15)' : 'transparent',
                color: statusFilter === f.id ? '#0096cc' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Portfolio Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Facility &amp; Obligor</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Principal &amp; Rate</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Monthly Installment</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Serviced vs Remaining</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Servicing Status</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Penalty</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No loan accounts match the current filter or search criteria.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((acc: any) => {
                const servicedPct = acc.disbursed_principal > 0 
                  ? Math.min(100, Math.round((acc.principal_serviced / acc.disbursed_principal) * 100))
                  : 0;

                return (
                  <tr 
                    key={acc.id}
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.15s ease'
                    }}
                    className="table-row-hover"
                  >
                    {/* Facility & Obligor */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-highlight)' }}>
                        {acc.borrower_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{acc.facility_number}</span>
                        <span>•</span>
                        <span>{acc.tenor_months}M Tenor</span>
                      </div>
                    </td>

                    {/* Principal & Rate */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatNaira(acc.disbursed_principal)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {acc.interest_rate_apr}% APR ({((acc.interest_rate_apr || 28) / 12).toFixed(2)}%/mo)
                      </div>
                    </td>

                    {/* Monthly Installment */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatNaira(acc.monthly_installment)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {acc.installments_serviced}/{acc.total_installments_count} paid
                      </div>
                    </td>

                    {/* Serviced vs Remaining with Progress Bar */}
                    <td style={{ padding: '0.85rem 1rem', minWidth: '180px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>{formatNaira(acc.total_amount_serviced)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Rem: {formatNaira(acc.outstanding_total)}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${servicedPct}%`, height: '100%', background: '#10b981', borderRadius: '3px' }} />
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getStatusBadge(acc.performance_status, acc.days_overdue, acc.penalty_accrued)}
                    </td>

                    {/* Penalty */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {acc.penalty_accrued > 0 ? (
                        <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
                          {formatNaira(acc.penalty_accrued)}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>5% default fee</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>₦0.00</span>
                      )}
                    </td>

                    {/* Actions & Simulation */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenDossier(acc.case_id)}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="View Full Schedule & Record Payments"
                        >
                          <FileText size={13} /> Dossier
                        </button>

                        {/* Interactive Scenario Simulation Dropdown / Quick Pills for Management Demo */}
                        <div style={{ display: 'inline-flex', gap: '3px', borderLeft: '1px solid var(--border-color)', paddingLeft: '6px' }}>
                          <button
                            onClick={() => handleSimulateStatus(acc.case_id, 'CURRENT')}
                            style={{
                              fontSize: '0.68rem',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              cursor: 'pointer'
                            }}
                            title="Simulate Current (0 days overdue)"
                          >
                            Curr
                          </button>
                          <button
                            onClick={() => handleSimulateStatus(acc.case_id, 'GRACE_PERIOD')}
                            style={{
                              fontSize: '0.68rem',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#d97706',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              cursor: 'pointer'
                            }}
                            title="Simulate 4 days overdue (Within 7-day Grace Period, no penalty)"
                          >
                            Grace
                          </button>
                          <button
                            onClick={() => handleSimulateStatus(acc.case_id, 'OVERDUE_PENALTY')}
                            style={{
                              fontSize: '0.68rem',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#dc2626',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                            title="Simulate 10 days overdue (> 7 days grace, triggers 5% penalty)"
                          >
                            5% Pen
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Loan Dossier Modal / Drawer */}
      {selectedLoan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-highlight)' }}>
                    Loan Dossier: {selectedLoan.borrower_name}
                  </h3>
                  {getStatusBadge(selectedLoan.performance_status, selectedLoan.days_overdue, selectedLoan.penalty_accrued)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Facility: <strong>{selectedLoan.facility_number}</strong> • Case Ref: {selectedLoan.case_id}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  <CreditCard size={14} /> Record Repayment
                </button>
                {onSelectCase && (
                  <button
                    onClick={() => onSelectCase(selectedLoan.case_id)}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    <ExternalLink size={14} /> Full Case
                  </button>
                )}
                <button
                  onClick={() => setSelectedLoan(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.4rem',
                    cursor: 'pointer',
                    padding: '0 8px'
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* Feedback Alert if any */}
              {paymentFeedback && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{paymentFeedback}</span>
                  <button onClick={() => setPaymentFeedback(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}>&times;</button>
                </div>
              )}

              {/* Financial Dossier Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disbursed Principal</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-highlight)' }}>{formatNaira(selectedLoan.disbursed_principal)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tenor: {selectedLoan.tenor_months} months @ {selectedLoan.interest_rate_apr}% APR</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Installment</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0096cc' }}>{formatNaira(selectedLoan.monthly_installment)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Next Due: {selectedLoan.next_due_date ? new Date(selectedLoan.next_due_date).toLocaleDateString() : 'None'}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Serviced So Far</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>{formatNaira(selectedLoan.total_amount_serviced)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Principal: {formatNaira(selectedLoan.principal_serviced)} • Int: {formatNaira(selectedLoan.interest_serviced)}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Debt</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>{formatNaira(selectedLoan.outstanding_total)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Outstanding Principal: {formatNaira(selectedLoan.outstanding_principal)}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Penalty Accrual (5%)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: selectedLoan.penalty_accrued > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                    {formatNaira(selectedLoan.penalty_accrued)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Overdue: {selectedLoan.days_overdue} days (Grace: {selectedLoan.grace_period_days}d)</div>
                </div>
              </div>

              {/* Amortization Schedule Table */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-highlight)' }}>
                    Loan Amortization &amp; Servicing Schedule ({selectedLoan.repayment_schedule?.length || 0} Periods)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Serviced: {selectedLoan.installments_serviced} / {selectedLoan.total_installments_count}
                  </span>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>Inst. #</th>
                        <th style={{ padding: '8px 12px' }}>Due Date</th>
                        <th style={{ padding: '8px 12px' }}>Principal Due</th>
                        <th style={{ padding: '8px 12px' }}>Interest Due</th>
                        <th style={{ padding: '8px 12px' }}>Total Installment</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Serviced At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedLoan.repayment_schedule || []).map((item: any, idx: number) => (
                        <tr 
                          key={idx} 
                          style={{ 
                            borderBottom: '1px solid var(--border-color)',
                            background: item.status === 'SERVICED' ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>Period {item.installment_no}</td>
                          <td style={{ padding: '8px 12px' }}>{item.due_date}</td>
                          <td style={{ padding: '8px 12px' }}>{formatNaira(item.principal_due)}</td>
                          <td style={{ padding: '8px 12px' }}>{formatNaira(item.interest_due)}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-highlight)' }}>{formatNaira(item.total_installment)}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {item.status === 'SERVICED' ? (
                              <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} /> Serviced
                              </span>
                            ) : item.status === 'OVERDUE' ? (
                              <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} /> Overdue
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                            {item.serviced_at ? new Date(item.serviced_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repayment History Ledger */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--text-highlight)' }}>
                  Audit Trail &amp; Repayment History Ledger
                </h4>
                {(!selectedLoan.repayment_history || selectedLoan.repayment_history.length === 0) ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    No payment transactions recorded yet. Use the "Record Repayment" button above to credit an installment.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '8px 12px' }}>Payment Date</th>
                          <th style={{ padding: '8px 12px' }}>Reference</th>
                          <th style={{ padding: '8px 12px' }}>Amount Paid</th>
                          <th style={{ padding: '8px 12px' }}>Principal Credit</th>
                          <th style={{ padding: '8px 12px' }}>Interest Credit</th>
                          <th style={{ padding: '8px 12px' }}>Channel</th>
                          <th style={{ padding: '8px 12px' }}>Rem. Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLoan.repayment_history.map((rep: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 12px' }}>{new Date(rep.payment_date).toLocaleString()}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{rep.reference}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#10b981' }}>{formatNaira(rep.amount)}</td>
                            <td style={{ padding: '8px 12px' }}>{formatNaira(rep.principal_credited)}</td>
                            <td style={{ padding: '8px 12px' }}>{formatNaira(rep.interest_credited)}</td>
                            <td style={{ padding: '8px 12px' }}>{rep.payment_method}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{formatNaira(rep.outstanding_balance_after)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      {showPaymentModal && selectedLoan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-highlight)' }}>
                  Record Loan Repayment
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedLoan.borrower_name} ({selectedLoan.facility_number})
                </div>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Repayment Amount (₦) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={`e.g. ${selectedLoan.monthly_installment}`}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-highlight)',
                      fontSize: '0.95rem',
                      fontWeight: 700
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedLoan.monthly_installment?.toString() || '0')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(0,150,204,0.12)',
                      color: '#0096cc',
                      border: '1px solid rgba(0,150,204,0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    Use Monthly Installment ({formatNaira(selectedLoan.monthly_installment)})
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Settlement Method / Channel
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--panel-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="DIRECT_DEBIT">NIBSS Direct Debit Mandate</option>
                  <option value="NIP_TRANSFER">NIP Instant Bank Transfer</option>
                  <option value="XLOANDISK_COLLECTION">xloandisk Core Settlement</option>
                  <option value="CHEQUE_CLEARING">Commercial Cheque Clearance</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Transaction Reference / Narration
                </label>
                <input
                  type="text"
                  placeholder="e.g. NIBSS-REF-2026-991823"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Internal Treasury Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Reconciliation notes, bank statement matching..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || !paymentAmount}
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isSubmittingPayment ? 'Posting...' : 'Post Repayment to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telemetry Report Preview Modal */}
      {showReportPreviewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1.5rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '1050px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-card)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#0096cc" />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-highlight)' }}>
                    {reportData ? reportData.period_title : 'Telemetry Executive Report Dossier'}
                  </h3>
                  <span className="status-pill pill-cyan" style={{ fontSize: '0.7rem' }}>
                    {selectedPeriod.toUpperCase()} AUDIT
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {reportData ? `Reporting Window: ${reportData.reporting_window_start} to ${reportData.reporting_window_end} (${reportData.reporting_window_days} Days) • Generated: ${reportData.generated_at}` : 'Loading report metadata...'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadCsv(selectedPeriod)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                >
                  <Download size={13} /> CSV
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handlePrintPdf(selectedPeriod)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                >
                  <Printer size={13} /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowReportPreviewModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {loadingReport ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
                  <div>Compiling telemetry and reconciling performance indicators...</div>
                </div>
              ) : reportData ? (
                <div>
                  {/* KPI Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disbursed Capital</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0096cc', marginTop: '2px' }}>
                        ₦{reportData.portfolio_metrics.total_disbursed_principal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {reportData.portfolio_metrics.total_active_facilities} Active Facilities
                      </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Repayments Serviced</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                        ₦{reportData.portfolio_metrics.total_amount_serviced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '2px' }}>
                        Recovery Efficiency: {reportData.portfolio_metrics.collection_efficiency_rate}%
                      </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding Balance</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                        ₦{reportData.portfolio_metrics.total_outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Principal Exposure: ₦{reportData.portfolio_metrics.total_outstanding_exposure.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>5% Default Penalties</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                        ₦{reportData.portfolio_metrics.total_penalties_accrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px' }}>
                        Levied on overdue &gt; 7 days
                      </div>
                    </div>
                  </div>

                  {/* Risk Stratification Row */}
                  <div style={{
                    background: 'rgba(0, 150, 204, 0.05)',
                    border: '1px solid rgba(0, 150, 204, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <strong>Delinquency Distribution:</strong> {reportData.status_distribution.PERFORMING_CURRENT} Current &bull; {reportData.status_distribution.GRACE_PERIOD_ACTIVE} Grace (1-7d) &bull; <span style={{ color: '#dc2626', fontWeight: 700 }}>{reportData.status_distribution.OVERDUE_PENALTY_APPLIED} Overdue (5% Pen)</span> &bull; {reportData.status_distribution.CRITICAL_DELINQUENT} Critical Default
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      PAR 30: ₦{reportData.portfolio_metrics.portfolio_at_risk_par30.toLocaleString(undefined, { minimumFractionDigits: 2 })} &bull; NPL Ratio: {reportData.portfolio_metrics.npl_ratio_pct}%
                    </div>
                  </div>

                  {/* Accounts Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px' }}>Facility Ref</th>
                          <th style={{ padding: '8px 10px' }}>Borrower</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Disbursed</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Serviced</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Outstanding</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Due Date</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Overdue</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>5% Penalty</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.accounts.map((acc: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, fontFamily: 'monospace' }}>{acc.facility_number}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{acc.borrower_name}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>₦{acc.disbursed_principal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>₦{acc.total_amount_serviced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>₦{acc.outstanding_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{acc.next_due_date}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: acc.days_overdue > 7 ? '#dc2626' : acc.days_overdue > 0 ? '#d97706' : '#10b981' }}>
                              {acc.days_overdue}d
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: acc.penalty_accrued > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 700 }}>
                              {acc.penalty_accrued > 0 ? `₦${acc.penalty_accrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '₦0.00'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {getStatusBadge(acc.performance_status, acc.days_overdue, acc.penalty_accrued)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Executive Reconciliation & Sign-off Footer */}
                  <div style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px dashed var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1.5rem',
                    textAlign: 'center',
                    fontSize: '0.78rem'
                  }}>
                    <div>
                      <div style={{ borderBottom: '1px solid var(--text-muted)', width: '140px', margin: '20px auto 4px auto' }} />
                      <strong>Dapo Adeleke</strong><br/>
                      <span style={{ color: 'var(--text-muted)' }}>Head of Business Development</span><br/>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Commercial Audit</span>
                    </div>
                    <div>
                      <div style={{ borderBottom: '1px solid var(--text-muted)', width: '140px', margin: '20px auto 4px auto' }} />
                      <strong>Chidinma Okafor</strong><br/>
                      <span style={{ color: 'var(--text-muted)' }}>Head of Risk Management</span><br/>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Risk Concurrence</span>
                    </div>
                    <div>
                      <div style={{ borderBottom: '1px solid var(--text-muted)', width: '140px', margin: '20px auto 4px auto' }} />
                      <strong>Folashade Tinubu</strong><br/>
                      <span style={{ color: 'var(--text-muted)' }}>Managing Director</span><br/>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Executive Approval</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

