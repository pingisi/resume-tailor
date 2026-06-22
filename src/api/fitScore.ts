import type { FitScoreRequest, FitScoreResponse } from '../types';
import { record as recordQuota } from '../lib/quota';

const ENDPOINT = import.meta.env.VITE_FIT_SCORE_URL || '/api/score-fit';

export async function scoreFit(req: FitScoreRequest): Promise<FitScoreResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = res.statusText;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    throw new Error(`Fit score failed (${res.status}): ${msg}`);
  }
  recordQuota('fit');
  return res.json();
}
