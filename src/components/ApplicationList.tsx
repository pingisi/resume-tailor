import { useMemo, useState } from 'react';
import type { Application, ApplicationStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { KanbanBoard } from './KanbanBoard';

interface Props {
  applications: Application[];
  onOpen: (id: string) => void;
  onStatusChange?: (id: string, status: ApplicationStatus) => void | Promise<void>;
}

type View = 'table' | 'board';
const VIEW_KEY = 'resume-tailor:app-list-view';

function loadView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'board' ? 'board' : 'table';
  } catch {
    return 'table';
  }
}

function matchesQuery(a: Application, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = [a.name, a.company, a.role, a.notes, a.resumeName, a.status]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

const FILTERS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
];

const FOLLOWUP_DAYS = 7;
const STALE_DRAFT_DAYS = 10;
const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(ts: number, now: number): number {
  return Math.floor((now - ts) / DAY_MS);
}

interface ActionItem {
  app: Application;
  hint: string;
}

interface ActionGroup {
  key: string;
  title: string;
  emoji: string;
  description: string;
  items: ActionItem[];
}

export function ApplicationList({ applications, onOpen, onStatusChange }: Props) {
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [view, setView] = useState<View>(loadView);
  const [query, setQuery] = useState('');

  const tokens = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const searched = useMemo(
    () => applications.filter((a) => matchesQuery(a, tokens)),
    [applications, tokens]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return searched;
    return searched.filter((a) => a.status === filter);
  }, [searched, filter]);

  function chooseView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore quota errors */
    }
  }

  const actionGroups = useMemo<ActionGroup[]>(() => {
    const now = Date.now();
    const followUps: ActionItem[] = [];
    const staleDrafts: ActionItem[] = [];
    const prepNeeded: ActionItem[] = [];

    for (const a of applications) {
      if (a.status === 'applied' && a.appliedAt) {
        const d = daysSince(a.appliedAt, now);
        if (d >= FOLLOWUP_DAYS) {
          followUps.push({
            app: a,
            hint: `${d} day${d === 1 ? '' : 's'} since applied`,
          });
        }
      }
      if (a.status === 'draft') {
        const d = daysSince(a.updatedAt, now);
        if (d >= STALE_DRAFT_DAYS) {
          staleDrafts.push({
            app: a,
            hint: `untouched for ${d} day${d === 1 ? '' : 's'}`,
          });
        }
      }
      if (a.status === 'interview' && !a.interviewPrep) {
        prepNeeded.push({ app: a, hint: 'no prep generated yet' });
      }
    }

    followUps.sort(
      (x, y) => (y.app.appliedAt ?? 0) * -1 - (x.app.appliedAt ?? 0) * -1
    );
    // Oldest first for follow-ups
    followUps.sort((x, y) => (x.app.appliedAt ?? 0) - (y.app.appliedAt ?? 0));
    staleDrafts.sort((x, y) => x.app.updatedAt - y.app.updatedAt);

    const groups: ActionGroup[] = [];
    if (followUps.length > 0) {
      groups.push({
        key: 'followup',
        title: 'Needs follow-up',
        emoji: '✉️',
        description: `Applications in "Applied" status for ${FOLLOWUP_DAYS}+ days. Open one and generate a follow-up email.`,
        items: followUps,
      });
    }
    if (prepNeeded.length > 0) {
      groups.push({
        key: 'prep',
        title: 'Interview prep due',
        emoji: '🎯',
        description: 'Marked as Interview but no prep generated yet.',
        items: prepNeeded,
      });
    }
    if (staleDrafts.length > 0) {
      groups.push({
        key: 'drafts',
        title: 'Stale drafts',
        emoji: '📝',
        description: `Draft applications you haven't touched in ${STALE_DRAFT_DAYS}+ days. Finish or delete.`,
        items: staleDrafts,
      });
    }
    return groups;
  }, [applications]);

  return (
    <>
      {actionGroups.length > 0 && (
        <div className="card">
          <h2 style={{ margin: 0 }}>Up next</h2>
          <p className="muted" style={{ marginTop: '0.25rem' }}>
            Applications that probably need your attention.
          </p>
          {actionGroups.map((g) => (
            <div key={g.key} style={{ marginTop: '0.75rem' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>
                  {g.emoji} {g.title}
                </strong>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {g.items.length}
                </span>
              </div>
              <p
                className="muted"
                style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
              >
                {g.description}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0.25rem 0 0',
                }}
              >
                {g.items.map((item) => (
                  <li
                    key={item.app.id}
                    style={{
                      borderTop: '1px solid var(--border)',
                      padding: '0.5rem 0',
                    }}
                  >
                    <div
                      className="row"
                      style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <strong>{item.app.name || '(unnamed)'}</strong>
                        {item.app.company && (
                          <div className="muted" style={{ fontSize: '0.8rem' }}>
                            {item.app.role ? `${item.app.role} · ` : ''}
                            {item.app.company}
                          </div>
                        )}
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {item.hint}
                        </div>
                      </div>
                      <button onClick={() => onOpen(item.app.id)}>Open</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Applications</h2>
          {applications.length > 0 && (
            <div className="view-toggle" role="group" aria-label="View">
              <button
                type="button"
                className={view === 'table' ? 'active' : ''}
                onClick={() => chooseView('table')}
                title="Table view"
              >
                ☰ Table
              </button>
              <button
                type="button"
                className={view === 'board' ? 'active' : ''}
                onClick={() => chooseView('board')}
                title="Kanban board"
                disabled={!onStatusChange}
              >
                ▦ Board
              </button>
            </div>
          )}
        </div>

        {applications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-title">No applications yet</p>
            <p className="empty-state-hint">
              Generate your first tailored resume from the{' '}
              <strong>New application</strong> tab.
            </p>
          </div>
        ) : (
          <>
            <input
              type="search"
              className="search-input"
              placeholder="Search by name, company, role, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search applications"
            />

            {view === 'board' && onStatusChange ? (
              <KanbanBoard
                applications={searched}
                onOpen={onOpen}
                onStatusChange={onStatusChange}
              />
            ) : (
            <>
            <div className="filter-row">
              {FILTERS.map((f) => {
                const count =
                  f.key === 'all'
                    ? applications.length
                    : applications.filter((a) => a.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    className={f.key === filter ? 'filter active' : 'filter'}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label} <span className="filter-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Status</th>
                  <th>Resume used</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="clickable-row"
                    onClick={() => onOpen(a.id)}
                  >
                    <td>
                      <strong>{a.name || '(unnamed)'}</strong>
                      {a.company && (
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {a.role ? `${a.role} · ` : ''}
                          {a.company}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="muted">{a.resumeName}</td>
                    <td className="muted">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && tokens.length > 0 && (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                No applications match “{query}”.
              </p>
            )}
            </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
