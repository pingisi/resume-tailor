import type { GenerateRequest, GenerateResponse } from '../types';

const ENDPOINT =
  import.meta.env.VITE_GENERATE_URL ||
  '/api/generate'; // default: rewritten by firebase.json to the Cloud Function

export async function generateDocuments(
  req: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Generation failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}
