import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CaseQueue } from './screens/CaseQueue';
import { CaseWorkspace } from './screens/CaseWorkspace';
import { ApplicationIntake } from './screens/ApplicationIntake';
import { BestoIngestionLab } from './screens/BestoIngestionLab';
import { ExceptionManager } from './screens/ExceptionManager';
import { AuditTelemetry } from './screens/AuditTelemetry';
import { fetchTelemetry, fetchExceptions } from './services/api';
import { Inbox, FilePlus, Database, AlertCircle, BarChart3 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentPersona, setCurrentPersona] = useState<string>('ANALYST');
  const [currentScreen, setCurrentScreen] = useState<'QUEUE' | 'WORKSPACE' | 'INTAKE' | 'BESTO_LAB' | 'EXCEPTIONS' | 'AUDIT'>('QUEUE');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [openExceptionsCount, setOpenExceptionsCount] = useState<number>(0);

  const checkHealthAndCounts = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setBackendOnline(true);
      }
      const ex = await fetchExceptions();
      setOpenExceptionsCount(ex.length);
    } catch (e) {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkHealthAndCounts();
    const interval = setInterval(checkHealthAndCounts, 10000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div>
      <Header
        currentPersona={currentPersona}
        onPersonaChange={setCurrentPersona}
        backendOnline={backendOnline}
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
          <FilePlus size={16} /> Direct OFL Intake (&gt;₦2m)
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
          <BarChart3 size={16} /> Audit Trail & Azure Spend
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
      </main>
    </div>
  );
};
