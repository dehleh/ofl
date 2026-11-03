import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CaseQueue } from './screens/CaseQueue';
import { CaseWorkspace } from './screens/CaseWorkspace';
import { ApplicationIntake } from './screens/ApplicationIntake';
import { BestoIngestionLab } from './screens/BestoIngestionLab';
import { ExceptionManager } from './screens/ExceptionManager';
import { AuditTelemetry } from './screens/AuditTelemetry';
import { PublicCustomerPortal } from './screens/PublicCustomerPortal';
import { AdminConfigPortal } from './screens/AdminConfigPortal';
import { StaffLoginScreen } from './screens/StaffLoginScreen';
import { fetchExceptions } from './services/api';
import { Inbox, FilePlus, Database, AlertCircle, BarChart3, Settings } from 'lucide-react';

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

  const [currentScreen, setCurrentScreen] = useState<'QUEUE' | 'WORKSPACE' | 'INTAKE' | 'BESTO_LAB' | 'EXCEPTIONS' | 'AUDIT' | 'ADMIN'>('QUEUE');
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
    }
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
        onPersonaChange={setCurrentPersona}
        backendOnline={backendOnline}
        currentUser={currentUser}
        onSignOut={handleStaffSignOut}
        onExitToPublicClient={() => {
          window.open('/', '_blank');
        }}
      />

      <div className="nav-bar">
        <button
          className={`nav-item ${currentScreen === 'QUEUE' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('QUEUE')}
        >
          <Inbox size={16} /> Work Queue
        </button>

        <button
          className={`nav-item ${currentScreen === 'INTAKE' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('INTAKE')}
        >
          <FilePlus size={16} /> BDO Assisted Intake (&gt;₦2m)
        </button>

        <button
          className={`nav-item ${currentScreen === 'BESTO_LAB' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('BESTO_LAB')}
        >
          <Database size={16} /> BESTO Simulator & Quarantine
        </button>

        <button
          className={`nav-item ${currentScreen === 'EXCEPTIONS' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('EXCEPTIONS')}
        >
          <AlertCircle size={16} /> Exceptions & Rework
          {openExceptionsCount > 0 && (
            <span className="nav-badge alert">{openExceptionsCount}</span>
          )}
        </button>

        <button
          className={`nav-item ${currentScreen === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('AUDIT')}
        >
          <BarChart3 size={16} /> Audit Trail & GCP Telemetry
        </button>

        <button
          className={`nav-item ${currentScreen === 'ADMIN' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('ADMIN')}
        >
          <Settings size={16} /> Admin & Settings
        </button>
      </div>

      <main className="main-content">
        {currentScreen === 'QUEUE' && (
          <CaseQueue
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

        {currentScreen === 'ADMIN' && (
          <AdminConfigPortal />
        )}
      </main>
    </div>
  );
};
