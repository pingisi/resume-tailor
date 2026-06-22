import { useCallback, useEffect, useState } from 'react';
import { Analytics } from './components/Analytics';
import { ApplicationDetail } from './components/ApplicationDetail';
import { ApplicationForm } from './components/ApplicationForm';
import { ApplicationList } from './components/ApplicationList';
import { BackupPanel } from './components/BackupPanel';
import { CommandPalette } from './components/CommandPalette';
import { ProfileManager } from './components/ProfileManager';
import { QuotaBar } from './components/QuotaBar';
import { ResumeManager } from './components/ResumeManager';
import { TabNav, type TabKey } from './components/TabNav';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastHost, toast } from './components/Toast';
import { useShortcuts } from './hooks/useShortcuts';
import {
  getApplication,
  listApplications,
  listResumes,
  updateApplication,
} from './lib/storage';
import {
  applyTheme,
  getEffectiveTheme,
  getStoredTheme,
  setStoredTheme,
  type Theme,
} from './lib/theme';
import type {
  Application,
  ApplicationFormPrefill,
  ApplicationStatus,
  StoredResume,
} from './types';
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
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      toast.show('Keyboard shortcuts', {
        detail:
          'n new · a apps · r resumes · p profile · s analytics · Esc back · Ctrl/⌘+K palette',
        ttl: 6000,
      });
    },
  });

  // Ctrl/Cmd+K opens the command palette regardless of focus context.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function cycleTheme() {
    const order: (Theme | 'system')[] = ['light', 'dark', 'system'];
    const current = (getStoredTheme() as Theme | null) ?? 'system';
    const next = order[(order.indexOf(current) + 1) % order.length];
    if (next === 'system') {
      localStorage.removeItem('resume-tailor:theme');
      applyTheme(getEffectiveTheme());
    } else {
      setStoredTheme(next);
    }
    window.dispatchEvent(new CustomEvent('theme-change'));
    toast.show(`Theme: ${next}`);
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    const updated = await updateApplication(id, { status });
    if (updated) {
      await refreshApplications();
      if (selectedAppId === id) setSelectedApp(updated);
      toast.success(`Moved to “${status}”`);
    }
  }

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
          onStatusChange={handleStatusChange}
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

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        applications={applications}
        onNew={() => {
          setSelectedAppId(null);
          setTab('new');
        }}
        onApplications={() => {
          setSelectedAppId(null);
          setTab('applications');
        }}
        onResumes={() => {
          setSelectedAppId(null);
          setTab('resumes');
        }}
        onProfile={() => {
          setSelectedAppId(null);
          setTab('profile');
        }}
        onAnalytics={() => {
          setSelectedAppId(null);
          setTab('analytics');
        }}
        onOpenApplication={(id) => {
          setSelectedAppId(id);
          setTab('applications');
        }}
        onToggleTheme={cycleTheme}
        onHelp={() => {
          toast.show('Keyboard shortcuts', {
            detail:
              'n new · a apps · r resumes · p profile · s analytics · Esc back · Ctrl/⌘+K palette',
            ttl: 6000,
          });
        }}
      />
      <ToastHost />
    </div>
  );
}
