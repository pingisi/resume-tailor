import { useEffect, useMemo, useState } from 'react';
import { listApplications } from '../lib/storage';
import type { Application, ApplicationStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface WeekBucket {
  label: string;
  start: number;
  count: number;
}

const STATUS_ORDER: ApplicationStatus[] = [
  'draft',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  draft: '#9ca3af',
  applied: '#3b82f6',
  interview: '#f59e0b',
  offer: '#10b981',
  rejected: '#ef4444',
  withdrawn: '#6b7280',
};

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  // ISO week starts Monday
  const diff = (day + 6) % 7;
  out.setDate(out.getDate() - diff);
  return out;
}

function buildWeekBuckets(apps: Application[], weeks: number): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const now = startOfWeek(new Date());
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startTs = start.getTime();
    const endTs = end.getTime();
    const label = start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const count = apps.filter(
      (a) => a.createdAt >= startTs && a.createdAt < endTs
    ).length;
    buckets.push({ label, start: startTs, count });
  }
  return buckets;
}

interface ResumeStats {
  resumeId: string;
  resumeName: string;
  total: number;
  applied: number;
  interview: number;
  offer: number;
}

function perResume(apps: Application[]): ResumeStats[] {
  const byId = new Map<string, ResumeStats>();
  for (const a of apps) {
    let s = byId.get(a.resumeId);
    if (!s) {
      s = {
        resumeId: a.resumeId,
        resumeName: a.resumeName,
        total: 0,
        applied: 0,
        interview: 0,
        offer: 0,
      };
      byId.set(a.resumeId, s);
    }
    s.total++;
    if (a.status === 'applied') s.applied++;
    if (a.status === 'interview' || a.status === 'offer') s.interview++;
    if (a.status === 'offer') s.offer++;
  }
  return [...byId.values()].sort((a, b) => b.total - a.total);
}

export function Analytics() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void listApplications().then((a) => {
      setApps(a);
      setLoaded(true);
    });
  }, []);

  const weeks = useMemo(() => buildWeekBuckets(apps, 12), [apps]);
  const statusCounts = useMemo(() => {
    const out: Record<ApplicationStatus, number> = {
      draft: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    };
    for (const a of apps) out[a.status]++;
    return out;
  }, [apps]);
  const resumeStats = useMemo(() => perResume(apps), [apps]);

  if (!loaded) {
    return (
      <div className="card">
        <h2>Analytics</h2>
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="card">
        <h2>Analytics</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p className="empty-state-title">No data yet</p>
          <p className="empty-state-hint">
            Create some applications to see trends here.
          </p>
        </div>
      </div>
    );
  }

  const totalStatusable =
    statusCounts.applied +
    statusCounts.interview +
    statusCounts.offer +
    statusCounts.rejected +
    statusCounts.withdrawn;
  const interviewRate =
    statusCounts.applied + statusCounts.interview + statusCounts.offer === 0
      ? 0
      : ((statusCounts.interview + statusCounts.offer) /
          (statusCounts.applied + statusCounts.interview + statusCounts.offer)) *
        100;
  const offerRate =
    statusCounts.interview + statusCounts.offer === 0
      ? 0
      : (statusCounts.offer / (statusCounts.interview + statusCounts.offer)) *
        100;

  return (
    <div className="card">
      <h2>Analytics</h2>

      <div className="kpi-row">
        <Kpi label="Total" value={apps.length.toString()} />
        <Kpi
          label="Active applied"
          value={(statusCounts.applied + statusCounts.interview).toString()}
        />
        <Kpi
          label="Interview rate"
          value={`${interviewRate.toFixed(0)}%`}
          hint="of submitted"
        />
        <Kpi
          label="Offer rate"
          value={`${offerRate.toFixed(0)}%`}
          hint="of interviewed"
        />
      </div>

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        Applications per week (last 12)
      </h3>
      <WeekChart buckets={weeks} />

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        Status funnel
      </h3>
      <Funnel counts={statusCounts} total={totalStatusable || apps.length} />

      {resumeStats.length > 1 && (
        <>
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            Conversion by resume
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Resume</th>
                <th>Applications</th>
                <th>→ Interview+</th>
                <th>→ Offer</th>
                <th>Interview rate</th>
              </tr>
            </thead>
            <tbody>
              {resumeStats.map((r) => {
                const rate =
                  r.total === 0 ? 0 : (r.interview / r.total) * 100;
                return (
                  <tr key={r.resumeId}>
                    <td>{r.resumeName}</td>
                    <td>{r.total}</td>
                    <td>{r.interview}</td>
                    <td>{r.offer}</td>
                    <td>{rate.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function WeekChart({ buckets }: { buckets: WeekBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const width = 100;
  const height = 40;
  const barW = width / buckets.length;
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height + 12}`}
        preserveAspectRatio="none"
        className="bar-chart"
        role="img"
        aria-label="Applications per week"
      >
        {buckets.map((b, i) => {
          const h = (b.count / max) * height;
          const x = i * barW + barW * 0.15;
          const y = height - h;
          const w = barW * 0.7;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="var(--accent)"
                rx="0.5"
              >
                <title>
                  Week of {b.label}: {b.count}
                </title>
              </rect>
              {b.count > 0 && (
                <text
                  x={x + w / 2}
                  y={y - 1}
                  fontSize="2.2"
                  fill="var(--text)"
                  textAnchor="middle"
                >
                  {b.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="chart-labels">
        {buckets.map((b, i) => (
          <span key={i}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

function Funnel({
  counts,
  total,
}: {
  counts: Record<ApplicationStatus, number>;
  total: number;
}) {
  return (
    <div className="funnel">
      {STATUS_ORDER.map((s) => {
        const v = counts[s];
        const pct = total === 0 ? 0 : (v / total) * 100;
        return (
          <div className="funnel-row" key={s}>
            <div className="funnel-label">
              <StatusBadge status={s} />
              <span style={{ marginLeft: '0.25rem' }}>{STATUS_LABEL[s]}</span>
            </div>
            <div className="funnel-track">
              <div
                className="funnel-fill"
                style={{
                  width: `${Math.max(pct, v > 0 ? 2 : 0)}%`,
                  background: STATUS_COLOR[s],
                }}
              />
            </div>
            <div className="funnel-value">{v}</div>
          </div>
        );
      })}
    </div>
  );
}
