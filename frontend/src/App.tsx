import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CaseQueue } from './screens/CaseQueue';
import { CaseWorkspace } from './screens/CaseWorkspace';
import { ApplicationIntake } from './screens/ApplicationIntake';
import { BestoIngestionLab } from './screens/BestoIngestionLab';
import { ExceptionManager } from './screens/ExceptionManager';
import { AuditTelemetry } from './screens/AuditTelemetry';
import { LoanPerformanceTelemetry } from './screens/LoanPerformanceTelemetry';
import { PublicCustomerPortal } from './screens/PublicCustomerPortal';
import { AdminConfigPortal } from './screens/AdminConfigPortal';
import { StaffLoginScreen } from './screens/StaffLoginScreen';
import { CreditCopilotDrawer } from './components/CreditCopilotDrawer';
import { fetchExceptions } from './services/api';
import { Inbox, FilePlus, Database, AlertCircle, BarChart3, Settings, Activity } from 'lucide-react';

export type ScreenId = 'QUEUE' | 'WORKSPACE' | 'INTAKE' | 'BESTO_LAB' | 'EXCEPTIONS' | 'AUDIT' | 'ADMIN' | 'TELEMETRY';

// Role-Based Access Control (RBAC) screen authorization matrix
// MD (Managing Director) and ADMIN (System Administrator) hold highest executive admin authority across all platform modules
export const ROLE_PERMITTED_SCREENS: Record<string, ScreenId[]> = {
  ADMIN: ['ADMIN', 'QUEUE', 'TELEMETRY', 'AUDIT', 'BESTO_LAB', 'EXCEPTIONS', 'INTAKE'],
  MD: ['ADMIN', 'QUEUE', 'TELEMETRY', 'AUDIT', 'BESTO_LAB', 'EXCEPTIONS', 'INTAKE'],
  IT_OWNER: ['ADMIN', 'AUDIT', 'TELEMETRY', 'BESTO_LAB', 'QUEUE', 'EXCEPTIONS'],
  ANALYST: ['QUEUE', 'TELEMETRY', 'EXCEPTIONS'],
  HRM: ['QUEUE', 'TELEMETRY', 'EXCEPTIONS', 'AUDIT'],
  HEAD_OF_BD: ['QUEUE', 'TELEMETRY', 'INTAKE', 'EXCEPTIONS'],
  BDO: ['INTAKE', 'QUEUE', 'TELEMETRY'],
  BCC: ['QUEUE', 'TELEMETRY', 'AUDIT'],
  OPERATIONS: ['QUEUE', 'TELEMETRY', 'EXCEPTIONS', 'AUDIT'],
  TREASURY: ['QUEUE', 'TELEMETRY', 'AUDIT'],
  AUDITOR: ['AUDIT', 'TELEMETRY', 'QUEUE']
};

export const ROLE_DEFAULT_SCREEN: Record<string, ScreenId> = {
  ADMIN: 'ADMIN',
  IT_OWNER: 'ADMIN',
  ANALYST: 'QUEUE',
  HRM: 'QUEUE',
  HEAD_OF_BD: 'QUEUE',
  BDO: 'INTAKE',
  MD: 'QUEUE',
  BCC: 'QUEUE',
  OPERATIONS: 'QUEUE',
  TREASURY: 'QUEUE',
  AUDITOR: 'AUDIT'
};

export const ROLE_QUEUE_LABELS: Record<string, string> = {
  ADMIN: 'System Work Queue',
  IT_OWNER: 'Technical Queue',
  ANALYST: 'Underwriting Queue',
  HRM: 'Risk Review Queue',
  HEAD_OF_BD: 'Commercial Sanction Queue',
  BDO: 'My Originations',
  MD: 'MD Sanctions Queue (≤₦20M)',
  BCC: 'BCC Board Sanctions (>₦20M)',
  OPERATIONS: 'Operations Work Queue',
  TREASURY: 'Disbursement & LOAN-DISC Queue',
  AUDITOR: 'Inspection Work Queue'
};

export const App: React.FC = () => {
  // Determine initial platform mode strictly from route or host
  const checkIsStaffRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const host = window.location.hostname.toLowerCase();
    return (
      path.startsWith('/staff') ||
      path.startsWith('/internal') ||
      path.startsWith('/cockpit') ||
      hash.startsWith('#staff') ||
      hash.startsWith('#/staff') ||
      hash.startsWith('#internal') ||
      host.startsWith('staff.') ||
      host.startsWith('credit.')
    );
  };

  const [isStaffPlatform, setIsStaffPlatform] = useState<boolean>(checkIsStaffRoute);

  // Internal Staff Authentication State
  const [staffToken, setStaffToken] = useState<string | null>(() => {
    return localStorage.getItem('ofl_jwt_token');
  });
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('ofl_user_profile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentPersona, setCurrentPersona] = useState<string>(() => {
    return currentUser?.role || 'ANALYST';
  });

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('QUEUE');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [openExceptionsCount, setOpenExceptionsCount] = useState<number>(0);

  // Synchronize route changes (e.g. typing /staff or using browser navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      setIsStaffPlatform(checkIsStaffRoute());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const checkHealthAndCounts = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setBackendOnline(true);
      }
      if (isStaffPlatform && staffToken) {
        const ex = await fetchExceptions();
        setOpenExceptionsCount(ex.length);
      }
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkHealthAndCounts();
    const interval = setInterval(checkHealthAndCounts, 12000);
    return () => clearInterval(interval);
  }, [isStaffPlatform, staffToken]);

  const handleStaffLoginSuccess = (user: any) => {
    const token = localStorage.getItem('ofl_jwt_token');
    setStaffToken(token);
    setCurrentUser(user);
    if (user?.role) {
      setCurrentPersona(user.role);
      setCurrentScreen(ROLE_DEFAULT_SCREEN[user.role] || 'QUEUE');
    }
  };

  const handlePersonaChange = (newPersona: string) => {
    setCurrentPersona(newPersona);
    if (newPersona === 'MD' || newPersona === 'ADMIN') return;
    const permitted = ROLE_PERMITTED_SCREENS[newPersona] || ['QUEUE'];
    if (currentScreen !== 'WORKSPACE' && !permitted.includes(currentScreen)) {
      setCurrentScreen(ROLE_DEFAULT_SCREEN[newPersona] || 'QUEUE');
    }
  };

  const isScreenPermitted = (screen: ScreenId) => {
    // Managing Director and System Administrator have full unconstrained administrative access
    if (currentPersona === 'MD' || currentPersona === 'ADMIN') return true;
    const permitted = ROLE_PERMITTED_SCREENS[currentPersona] || ['QUEUE'];
    return permitted.includes(screen);
  };

  const handleStaffSignOut = () => {
    localStorage.removeItem('ofl_jwt_token');
    localStorage.removeItem('ofl_user_profile');
    setStaffToken(null);
    setCurrentUser(null);
    setCurrentPersona('ANALYST');
    setCurrentScreen('QUEUE');
  };

  const handleOpenCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentScreen('WORKSPACE');
  };

  const handleDirectSubmissionSuccess = (caseNumber: string) => {
    setSelectedCaseId(caseNumber);
    setCurrentScreen('WORKSPACE');
  };

  const handleBestoCaseCreated = (caseNumber: string) => {
    setSelectedCaseId(caseNumber);
    setCurrentScreen('WORKSPACE');
  };

  // ============================================================================
  // 1. PUBLIC CLIENT-FACING APPLICATION PLATFORM
  // Pure borrower loan gateway: No internal staff tools, no staff buttons or gates.
  // ============================================================================
  if (!isStaffPlatform) {
    return (
      <PublicCustomerPortal />
    );
  }

  // ============================================================================
  // 2. INTERNAL STAFF PLATFORM: ACCESS GATE / AUTHENTICATION BARRIER
  // If staff is unauthenticated, render the dedicated Staff Login Screen.
  // ============================================================================
  if (!staffToken) {
    return (
      <StaffLoginScreen onLoginSuccess={handleStaffLoginSuccess} />
    );
  }

  // ============================================================================
  // 3. INTERNAL STAFF PLATFORM: UNDERWRITING & RISK MANAGEMENT COCKPIT
  // Authenticated internal staff workspace with RBAC role enforcement.
  // ============================================================================
  return (
    <div>
      <Header
        currentPersona={currentPersona}
        onPersonaChange={handlePersonaChange}
        backendOnline={backendOnline}
        currentUser={currentUser}
        onSignOut={handleStaffSignOut}
        onExitToPublicClient={() => {
          window.open('/', '_blank');
        }}
      />

      <div className="nav-bar">
        {isScreenPermitted('QUEUE') && (
          <button
            className={`nav-item ${currentScreen === 'QUEUE' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('QUEUE')}
          >
            <Inbox size={16} /> {ROLE_QUEUE_LABELS[currentPersona] || 'Work Queue'}
          </button>
        )}

        {isScreenPermitted('INTAKE') && (
          <button
            className={`nav-item ${currentScreen === 'INTAKE' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('INTAKE')}
          >
            <FilePlus size={16} /> BDO Assisted Intake (&gt;₦2m)
          </button>
        )}

        {isScreenPermitted('BESTO_LAB') && (
          <button
            className={`nav-item ${currentScreen === 'BESTO_LAB' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('BESTO_LAB')}
          >
            <Database size={16} /> BESTO Simulator &amp; Quarantine
          </button>
        )}

        {isScreenPermitted('EXCEPTIONS') && (
          <button
            className={`nav-item ${currentScreen === 'EXCEPTIONS' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('EXCEPTIONS')}
          >
            <AlertCircle size={16} /> Exceptions &amp; Rework
            {openExceptionsCount > 0 && (
              <span className="nav-badge alert">{openExceptionsCount}</span>
            )}
          </button>
        )}

        {isScreenPermitted('TELEMETRY') && (
          <button
            className={`nav-item ${currentScreen === 'TELEMETRY' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('TELEMETRY')}
          >
            <Activity size={16} /> Loan Telemetry &amp; Servicing
          </button>
        )}

        {isScreenPermitted('AUDIT') && (
          <button
            className={`nav-item ${currentScreen === 'AUDIT' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('AUDIT')}
          >
            <BarChart3 size={16} /> Audit Trail &amp; GCP Telemetry
          </button>
        )}

        {isScreenPermitted('ADMIN') && (
          <button
            className={`nav-item ${currentScreen === 'ADMIN' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('ADMIN')}
          >
            <Settings size={16} /> Admin &amp; Settings
          </button>
        )}

        {/* RBAC Scope Indicator Badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '0.75rem' }}>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            padding: '3px 8px',
            borderRadius: '4px',
            background: 'rgba(0, 150, 204, 0.12)',
            color: '#0096cc',
            border: '1px solid rgba(0, 150, 204, 0.25)',
            textTransform: 'uppercase'
          }}>
            RBAC: {currentPersona.replace(/_/g, ' ')} SCOPE
          </span>
        </div>
      </div>

      <main className="main-content">
        {currentScreen === 'QUEUE' && (
          <CaseQueue
            currentPersona={currentPersona}
            onSelectCase={handleOpenCase}
            onNewApplication={() => setCurrentScreen('INTAKE')}
          />
        )}

        {currentScreen === 'WORKSPACE' && selectedCaseId && (
          <CaseWorkspace
            caseId={selectedCaseId}
            currentPersona={currentPersona}
            onBack={() => setCurrentScreen('QUEUE')}
          />
        )}

        {currentScreen === 'INTAKE' && (
          <ApplicationIntake
            onSuccess={handleDirectSubmissionSuccess}
            onGoToBesto={() => setCurrentScreen('BESTO_LAB')}
          />
        )}

        {currentScreen === 'BESTO_LAB' && (
          <BestoIngestionLab
            onCaseCreated={handleBestoCaseCreated}
          />
        )}

        {currentScreen === 'EXCEPTIONS' && (
          <ExceptionManager
            onOpenCase={handleOpenCase}
          />
        )}

        {currentScreen === 'AUDIT' && (
          <AuditTelemetry />
        )}

        {currentScreen === 'TELEMETRY' && (
          <LoanPerformanceTelemetry
            currentPersona={currentPersona}
            onSelectCase={handleOpenCase}
          />
        )}

        {currentScreen === 'ADMIN' && (
          <AdminConfigPortal />
        )}

        {/* Global Staff Conversational AI Copilot */}
        <CreditCopilotDrawer
          currentPersona={currentPersona}
          selectedCaseId={selectedCaseId}
        />
      </main>
    </div>
  );
};
