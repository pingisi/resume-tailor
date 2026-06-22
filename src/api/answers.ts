import type { AnswerRequest, AnswerResponse } from '../types';
import { record as recordQuota } from '../lib/quota';

const ENDPOINT =
  import.meta.env.VITE_ANSWERS_URL || '/api/answer-questions';

export async function answerQuestions(req: AnswerRequest): Promise<AnswerResponse> {
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
    throw new Error(`Answer generation failed (${res.status}): ${msg}`);
  }
  recordQuota('answers');
  return res.json();
}
