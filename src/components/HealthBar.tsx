import { useMemo } from 'react';
import type { Application } from '../types';
import { ats } from '../lib/keywords';

interface Props {
  application: Application;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function nextAction(app: Application): { label: string; tone: 'idle' | 'soon' | 'due' } {
  const now = Date.now();
  if (app.status === 'draft') return { label: 'Finish & apply', tone: 'soon' };
  if (app.status === 'applied' && app.appliedAt) {
    const days = Math.floor((now - app.appliedAt) / DAY_MS);
    if (days >= 7) return { label: `Follow up (${days}d)`, tone: 'due' };
    return { label: `Wait (${days}d / 7d)`, tone: 'idle' };
  }
  if (app.status === 'interview') {
    if (!app.interviewPrep) return { label: 'Generate prep', tone: 'due' };
    return { label: 'Interview ready', tone: 'idle' };
  }
  if (app.status === 'offer') return { label: 'Decide / negotiate', tone: 'soon' };
  if (app.status === 'rejected') return { label: 'Archive / learn', tone: 'idle' };
  if (app.status === 'withdrawn') return { label: 'Closed', tone: 'idle' };
  return { label: '—', tone: 'idle' };
}

export function HealthBar({ application }: Props) {
  const atsRes = useMemo(() => {
    if (!application.generatedResume || !application.jobDescription) return null;
    const r = ats(application.jobDescription, application.generatedResume);
    if (r.total === 0) return null;
    return r;
  }, [application.generatedResume, application.jobDescription]);

  const daysSinceApplied = useMemo(() => {
    if (!application.appliedAt) return null;
    return Math.floor((Date.now() - application.appliedAt) / DAY_MS);
  }, [application.appliedAt]);

  const next = nextAction(application);

  const atsTone = !atsRes ? null : atsRes.score >= 75 ? 'good' : atsRes.score >= 50 ? 'ok' : 'low';

  return (
    <div className="health-bar" aria-label="Application health">
      <div className="health-cell">
        <span className="health-label">ATS</span>
        {atsRes ? (
          <span className={`health-value tone-${atsTone}`}>
            {atsRes.score}<span className="health-suffix">/100</span>
          </span>
        ) : (
          <span className="health-value muted">—</span>
        )}
      </div>
      <div className="health-cell">
        <span className="health-label">Keywords</span>
        {atsRes ? (
          <span className="health-value">
            {atsRes.matched.length}<span className="health-suffix">/{atsRes.total}</span>
          </span>
        ) : (
          <span className="health-value muted">—</span>
        )}
      </div>
      <div className="health-cell">
        <span className="health-label">Applied</span>
        {daysSinceApplied === null ? (
          <span className="health-value muted">not yet</span>
        ) : (
          <span className="health-value">
            {daysSinceApplied === 0 ? 'today' : `${daysSinceApplied}d ago`}
          </span>
        )}
      </div>
      <div className="health-cell">
        <span className="health-label">Status</span>
        <span className={`health-value status-${application.status}`}>
          {application.status}
        </span>
      </div>
      <div className="health-cell">
        <span className="health-label">Next</span>
        <span className={`health-value next-${next.tone}`}>{next.label}</span>
      </div>
    </div>
  );
}
