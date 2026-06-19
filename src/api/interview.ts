import type { InterviewQuestion } from '../types';

const ENDPOINT =
  import.meta.env.VITE_INTERVIEW_URL || '/api/prepare-interview';

export interface PrepareInterviewRequest {
  resumeText: string;
  jobDescription: string;
  company?: string;
  role?: string;
}

export interface PrepareInterviewResponse {
  questions: InterviewQuestion[];
}

export async function prepareInterview(
  req: PrepareInterviewRequest
): Promise<PrepareInterviewResponse> {
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
    throw new Error(`Interview prep failed (${res.status}): ${msg}`);
  }
  return res.json();
}
