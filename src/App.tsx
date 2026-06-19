import { useCallback, useEffect, useState } from 'react';
import { ApplicationDetail } from './components/ApplicationDetail';
import { ApplicationForm } from './components/ApplicationForm';
import { ApplicationList } from './components/ApplicationList';
import { BackupPanel } from './components/BackupPanel';
import { QuotaBar } from './components/QuotaBar';
import { ResumeManager } from './components/ResumeManager';
import { TabNav, type TabKey } from './components/TabNav';
import { ThemeToggle } from './components/ThemeToggle';
import { useShortcuts } from './hooks/useShortcuts';
import {
  getApplication,
  listApplications,
  listResumes,
} from './lib/storage';
import type { Application, StoredResume } from './types';
import './App.css';

export default function App() {
  const [tab, setTab] = useState<TabKey>('new');
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshResumes = useCallback(async () => {
    setResumes(await listResumes());
  }, []);

  const refreshApplications = useCallback(async () => {
    setApplications(await listApplications());
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([refreshResumes(), refreshApplications()]);
      setLoaded(true);
    })();
  }, [refreshResumes, refreshApplications]);

  useEffect(() => {
    if (!selectedAppId) {
      setSelectedApp(null);
      return;
    }
    void getApplication(selectedAppId).then((a) => setSelectedApp(a ?? null));
  }, [selectedAppId, applications]);

  // Land on Resumes tab if user has no resumes yet
  useEffect(() => {
    if (loaded && resumes.length === 0 && tab === 'new') {
      setTab('resumes');
    }
  }, [loaded, resumes.length, tab]);

  const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0];

  useShortcuts({
    Escape: () => {
      if (selectedAppId) setSelectedAppId(null);
    },
    n: () => {
      setSelectedAppId(null);
      setTab('new');
    },
    a: () => {
      setSelectedAppId(null);
      setTab('applications');
    },
    r: () => {
      setSelectedAppId(null);
      setTab('resumes');
    },
    '?': () => {
      alert(
        'Keyboard shortcuts:\n' +
          '  n — new application\n' +
          '  a — applications list\n' +
          '  r — resumes\n' +
          '  Esc — back to list\n' +
          '  ? — this help'
      );
    },
  });

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Resume Tailor</h1>
          <p className="muted">
            Tailor your resume + cover letter per job, and track every application.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <TabNav
        active={tab}
        onChange={(k) => {
          setSelectedAppId(null);
          setTab(k);
        }}
        applicationCount={applications.length}
        resumeCount={resumes.length}
      />

      {tab === 'new' && (
        <ApplicationForm
          resumes={resumes}
          defaultResumeId={defaultResume?.id}
          onSaved={async (app) => {
            await refreshApplications();
            setSelectedAppId(app.id);
            setTab('applications');
          }}
        />
      )}

      {tab === 'applications' && !selectedApp && (
        <ApplicationList
          applications={applications}
          onOpen={(id) => setSelectedAppId(id)}
        />
      )}

      {tab === 'applications' && selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          onBack={() => setSelectedAppId(null)}
          onChange={async (updated) => {
            await refreshApplications();
            if (updated === null) setSelectedAppId(null);
            else setSelectedApp(updated);
          }}
        />
      )}

      {tab === 'resumes' && (
        <>
          <ResumeManager resumes={resumes} onChange={refreshResumes} />
          <BackupPanel
            onImported={async () => {
              await Promise.all([refreshResumes(), refreshApplications()]);
            }}
          />
        </>
      )}

      <QuotaBar />

      <footer className="muted">
        Everything stays in your browser (IndexedDB). The resume + job
        description are sent to the AI only when you click Generate.
      </footer>
    </div>
  );
}
