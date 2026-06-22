import { useEffect, useRef, useState } from 'react';
import type { Application, ApplicationStatus } from '../types';
import {
  APPLICATION_STATUSES,
  deleteApplication,
  getResume,
  updateApplication,
} from '../lib/storage';
import { OutputPanel } from './OutputPanel';
import { StatusBadge } from './StatusBadge';
import { InterviewPrep } from './InterviewPrep';
import { QuickAnswers } from './QuickAnswers';
import { Messages } from './Messages';

interface Props {
  application: Application;
  onBack: () => void;
  onChange: (app: Application | null) => void;
  onClone?: (app: Application) => void;
}

export function ApplicationDetail({
  application,
  onBack,
  onChange,
  onClone,
}: Props) {
  const [notes, setNotes] = useState(application.notes ?? '');
  const [applyUrl, setApplyUrl] = useState(application.applyUrl ?? '');
  const [originalResume, setOriginalResume] = useState<string | undefined>();
  const notesTimer = useRef<number | null>(null);
  const applyUrlTimer = useRef<number | null>(null);

  useEffect(() => {
    setNotes(application.notes ?? '');
  }, [application.id, application.notes]);

  useEffect(() => {
    setApplyUrl(application.applyUrl ?? '');
  }, [application.id, application.applyUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getResume(application.resumeId);
      if (!cancelled) setOriginalResume(r?.text);
    })();
    return () => {
      cancelled = true;
    };
  }, [application.resumeId]);

  useEffect(() => {
    if (notes === (application.notes ?? '')) return;
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      const updated = await updateApplication(application.id, { notes });
      if (updated) onChange(updated);
    }, 500);
    return () => {
      if (notesTimer.current) window.clearTimeout(notesTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  useEffect(() => {
    if (applyUrl === (application.applyUrl ?? '')) return;
    if (applyUrlTimer.current) window.clearTimeout(applyUrlTimer.current);
    applyUrlTimer.current = window.setTimeout(async () => {
      const updated = await updateApplication(application.id, {
        applyUrl: applyUrl.trim() || undefined,
      });
      if (updated) onChange(updated);
    }, 500);
    return () => {
      if (applyUrlTimer.current) window.clearTimeout(applyUrlTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyUrl]);

  async function handleStatusChange(status: ApplicationStatus) {
    const updated = await updateApplication(application.id, { status });
    if (updated) onChange(updated);
  }

  async function handleDelete() {
    const ok = confirm(`Delete application "${application.name}"?`);
    if (!ok) return;
    await deleteApplication(application.id);
    onChange(null);
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <button onClick={onBack}>← Back</button>
          </div>
          <div className="row">
            {onClone && (
              <button onClick={() => onClone(application)} title="Start a new application with the same resume, tone, and recipient">
                Clone
              </button>
            )}
            <button className="danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        <h2 style={{ marginTop: '1rem' }}>
          {application.name} <StatusBadge status={application.status} />
        </h2>

        <div className="meta-grid">
          {application.company && (
            <div>
              <span className="meta-label">Company</span>
              <span>{application.company}</span>
            </div>
          )}
          {application.role && (
            <div>
              <span className="meta-label">Role</span>
              <span>{application.role}</span>
            </div>
          )}
          <div>
            <span className="meta-label">Resume used</span>
            <span>{application.resumeName}</span>
          </div>
          <div>
            <span className="meta-label">Created</span>
            <span>{formatDateTime(application.createdAt)}</span>
          </div>
          {application.appliedAt && (
            <div>
              <span className="meta-label">Applied on</span>
              <span>{formatDateTime(application.appliedAt)}</span>
            </div>
          )}
          {application.recipient?.name && (
            <div>
              <span className="meta-label">Hiring manager</span>
              <span>
                {application.recipient.name}
                {application.recipient.title
                  ? ` (${application.recipient.title})`
                  : ''}
              </span>
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: '1rem' }}>
          <label>
            Status:&nbsp;
            <select
              value={application.status}
              onChange={(e) =>
                handleStatusChange(e.target.value as ApplicationStatus)
              }
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: 'block', marginTop: '1rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem' }}>
            Apply URL
          </span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input
              type="url"
              placeholder="https://… link to the job posting / application page"
              value={applyUrl}
              onChange={(e) => setApplyUrl(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
            />
            <button
              type="button"
              disabled={!applyUrl.trim()}
              onClick={() => {
                const u = applyUrl.trim();
                if (!u) return;
                const safe = /^https?:\/\//i.test(u) ? u : `https://${u}`;
                window.open(safe, '_blank', 'noopener,noreferrer');
              }}
            >
              Open
            </button>
          </div>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Auto-saves
          </span>
        </label>

        <label style={{ display: 'block', marginTop: '1rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem' }}>
            Notes
          </span>
          <textarea
            rows={3}
            placeholder="Interview times, contacts, follow-ups…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Auto-saves
          </span>
        </label>
      </div>

      <OutputPanel
        resume={application.generatedResume}
        coverLetter={application.generatedCoverLetter}
        originalResume={originalResume}
        jobDescription={application.jobDescription}
        company={application.company}
        role={application.role}
        onEdit={async (kind, next) => {
          const patch =
            kind === 'resume'
              ? { generatedResume: next }
              : { generatedCoverLetter: next };
          const updated = await updateApplication(application.id, patch);
          if (updated) onChange(updated);
        }}
      />

      <InterviewPrep
        application={application}
        originalResume={originalResume}
        highlight={application.status === 'interview'}
        onChange={onChange}
      />

      <QuickAnswers application={application} onChange={onChange} />

      <Messages application={application} onChange={onChange} />

      <details className="card">
        <summary>Original job description</summary>
        <pre className="resume-text" style={{ marginTop: '1rem' }}>
          {application.jobDescription}
        </pre>
      </details>
    </>
  );
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
