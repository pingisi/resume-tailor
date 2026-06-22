/**
 * Per-day quota tracker for Gemini API calls. Free tier is ~10/min and
 * 250/day. We track UTC days. Pure client-side — best-effort signal, not
 * a hard limit.
 */

const STORAGE_KEY = 'resume-tailor:quota';
const SOFT_LIMIT = 250;
const WARN_THRESHOLD = 0.8;

export type QuotaKind = 'generate' | 'interview' | 'answers';

interface QuotaState {
  date: string; // YYYY-MM-DD UTC
  generate: number;
  interview: number;
  answers: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): QuotaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), generate: 0, interview: 0, answers: 0 };
    const parsed = JSON.parse(raw) as Partial<QuotaState> & { date?: string };
    if (parsed.date !== today()) {
      return { date: today(), generate: 0, interview: 0, answers: 0 };
    }
    return {
      date: parsed.date,
      generate: parsed.generate ?? 0,
      interview: parsed.interview ?? 0,
      answers: parsed.answers ?? 0,
    };
  } catch {
    return { date: today(), generate: 0, interview: 0, answers: 0 };
  }
}

function save(state: QuotaState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('quota-change'));
}

export function record(kind: QuotaKind): void {
  const s = load();
  s[kind] = (s[kind] || 0) + 1;
  save(s);
}

export interface QuotaSnapshot {
  date: string;
  generate: number;
  interview: number;
  answers: number;
  total: number;
  limit: number;
  pct: number;
  warn: boolean;
  exceeded: boolean;
}

export function snapshot(): QuotaSnapshot {
  const s = load();
  const total = s.generate + s.interview + s.answers;
  return {
    date: s.date,
    generate: s.generate,
    interview: s.interview,
    answers: s.answers,
    total,
    limit: SOFT_LIMIT,
    pct: Math.min(1, total / SOFT_LIMIT),
    warn: total / SOFT_LIMIT >= WARN_THRESHOLD,
    exceeded: total >= SOFT_LIMIT,
  };
}

/** React hook helper — subscribe to quota changes. */
export function subscribeQuota(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('quota-change', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('quota-change', handler);
    window.removeEventListener('storage', handler);
  };
}
