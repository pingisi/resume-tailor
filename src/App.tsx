import { useCallback, useEffect, useState } from 'react';
import { Analytics } from './components/Analytics';
import { ApplicationDetail } from './components/ApplicationDetail';
import { ApplicationForm } from './components/ApplicationForm';
import { ApplicationList } from './components/ApplicationList';
import { BackupPanel } from './components/BackupPanel';
import { ProfileManager } from './components/ProfileManager';
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
import type { Application, ApplicationFormPrefill, StoredResume } from './types';
import './App.css';

export default function App() {
  const [tab, setTab] = useState<TabKey>('new');
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formPrefill, setFormPrefill] = useState<ApplicationFormPrefill | null>(
    null
  );

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

  // Bookmarklet hand-off: a URL like "#jd=<encoded JSON {text,url,title,company,role}>"
  // pre-fills the New form, then clears the hash so a refresh doesn't repeat it.
  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash;
    const m = /^#jd=(.+)$/.exec(hash);
    if (!m) return;
    try {
      const raw = decodeURIComponent(m[1]);
      const payload = JSON.parse(raw) as {
        text?: string;
        url?: string;
        title?: string;
        company?: string;
        role?: string;
      };
      const text = (payload.text || '').slice(0, 15000);
      if (text.length < 30) return;
      setFormPrefill({
        jobDescription: text,
        jdUrl: payload.url,
        company: payload.company,
        role: payload.role,
      });
      setTab('new');
      setSelectedAppId(null);
    } catch {
      /* ignore malformed bookmarklet payload */
    } finally {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [loaded]);

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
    s: () => {
      setSelectedAppId(null);
      setTab('analytics');
    },
    p: () => {
      setSelectedAppId(null);
      setTab('profile');
    },
    '?': () => {
      alert(
        'Keyboard shortcuts:\n' +
          '  n — new application\n' +
          '  a — applications list\n' +
          '  r — resumes\n' +
          '  p — profile\n' +
          '  s — analytics\n' +
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
          prefill={formPrefill}
          onPrefillConsumed={() => setFormPrefill(null)}
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
          onClone={(app) => {
            setFormPrefill({
              resumeId: app.resumeId,
              tone: app.tone,
              recipientName: app.recipient?.name,
              recipientTitle: app.recipient?.title,
            });
            setSelectedAppId(null);
            setTab('new');
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

      {tab === 'analytics' && <Analytics />}

      {tab === 'profile' && <ProfileManager />}

      <QuotaBar />

      <footer className="muted">
        Everything stays in your browser (IndexedDB). The resume + job
        description are sent to the AI only when you click Generate.
      </footer>
    </div>
  );
}
