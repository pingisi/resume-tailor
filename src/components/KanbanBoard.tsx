import { useMemo, useState } from 'react';
import type { Application, ApplicationStatus } from '../types';
import { APPLICATION_STATUSES } from '../lib/storage';

interface Props {
  applications: Application[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void | Promise<void>;
}

const COLUMNS: { key: ApplicationStatus; label: string; emoji: string }[] = [
  { key: 'draft', label: 'Draft', emoji: '📝' },
  { key: 'applied', label: 'Applied', emoji: '📨' },
  { key: 'interview', label: 'Interview', emoji: '🎯' },
  { key: 'offer', label: 'Offer', emoji: '🎉' },
  { key: 'rejected', label: 'Rejected', emoji: '✖' },
  { key: 'withdrawn', label: 'Withdrawn', emoji: '↩' },
];

const DAY_MS = 1000 * 60 * 60 * 24;

function daysAgo(ts: number | undefined): string {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / DAY_MS);
  if (d <= 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

export function KanbanBoard({ applications, onOpen, onStatusChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ApplicationStatus | null>(null);

  const buckets = useMemo(() => {
    const m: Record<ApplicationStatus, Application[]> = {
      draft: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
      withdrawn: [],
    };
    for (const a of applications) {
      // Defensive: if status is not one of the known statuses, fall back to 'draft'
      const k = APPLICATION_STATUSES.includes(a.status) ? a.status : 'draft';
      m[k].push(a);
    }
    for (const k of APPLICATION_STATUSES) {
      m[k].sort((x, y) => y.updatedAt - x.updatedAt);
    }
    return m;
  }, [applications]);

  function handleDrop(target: ApplicationStatus) {
    setDragOver(null);
    if (!dragId) return;
    const app = applications.find((a) => a.id === dragId);
    setDragId(null);
    if (!app || app.status === target) return;
    void onStatusChange(app.id, target);
  }

  return (
    <div className="kanban">
      {COLUMNS.map((col) => {
        const items = buckets[col.key];
        const isOver = dragOver === col.key;
        return (
          <div
            key={col.key}
            className={'kanban-col' + (isOver ? ' over' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOver !== col.key) setDragOver(col.key);
            }}
            onDragLeave={() => {
              if (dragOver === col.key) setDragOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.key);
            }}
          >
            <div className="kanban-col-head">
              <span>
                {col.emoji} {col.label}
              </span>
              <span className="kanban-count">{items.length}</span>
            </div>
            <div className="kanban-list">
              {items.length === 0 ? (
                <div className="kanban-empty">Drop here</div>
              ) : (
                items.map((a) => (
                  <div
                    key={a.id}
                    className={'kanban-card' + (dragId === a.id ? ' dragging' : '')}
                    draggable
                    onDragStart={(e) => {
                      setDragId(a.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', a.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                    onClick={() => onOpen(a.id)}
                    title="Click to open · drag to change status"
                  >
                    <div className="kanban-card-title">{a.name || '(unnamed)'}</div>
                    {(a.company || a.role) && (
                      <div className="kanban-card-sub">
                        {a.role}
                        {a.role && a.company ? ' · ' : ''}
                        {a.company}
                      </div>
                    )}
                    <div className="kanban-card-foot">
                      <span className="muted">
                        {col.key === 'applied' && a.appliedAt
                          ? `applied ${daysAgo(a.appliedAt)}`
                          : `updated ${daysAgo(a.updatedAt)}`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
