import { useMemo, useState } from 'react';
import type { Application, ApplicationStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  applications: Application[];
  onOpen: (id: string) => void;
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

export function ApplicationList({ applications, onOpen }: Props) {
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return applications;
    return applications.filter((a) => a.status === filter);
  }, [applications, filter]);

  return (
    <div className="card">
      <h2>Applications</h2>

      {applications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p className="empty-state-title">No applications yet</p>
          <p className="empty-state-hint">
            Generate your first tailored resume from the <strong>New application</strong> tab.
          </p>
        </div>
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
        </>
      )}
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
