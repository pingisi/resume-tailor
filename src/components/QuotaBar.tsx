import { useEffect, useState } from 'react';
import { snapshot, subscribeQuota, type QuotaSnapshot } from '../lib/quota';

export function QuotaBar() {
  const [s, setS] = useState<QuotaSnapshot>(snapshot);

  useEffect(() => {
    const unsub = subscribeQuota(() => setS(snapshot()));
    return unsub;
  }, []);

  if (s.total === 0) return null;

  const tone = s.exceeded ? 'over' : s.warn ? 'warn' : 'ok';

  return (
    <div className={`quota quota-${tone}`}>
      <div className="quota-text">
        AI calls today: <strong>{s.total}</strong> / {s.limit}
        <span className="muted">
          {' '}
          ({s.generate} generate · {s.interview} interview)
        </span>
      </div>
      <div className="quota-bar">
        <div
          className="quota-fill"
          style={{ width: `${Math.round(s.pct * 100)}%` }}
        />
      </div>
      {s.warn && (
        <div className="quota-hint">
          {s.exceeded
            ? 'Free tier (250/day) likely exhausted — calls may start failing.'
            : 'Approaching free tier (250/day) — slow down to be safe.'}
        </div>
      )}
    </div>
  );
}
