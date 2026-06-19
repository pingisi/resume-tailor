import type { GenerateRequest, GenerateResponse } from '../types';
import { record as recordQuota } from '../lib/quota';

const ENDPOINT =
  import.meta.env.VITE_GENERATE_URL || '/api/generate';

const FETCH_JD_ENDPOINT =
  import.meta.env.VITE_FETCH_JD_URL || '/api/fetch-jd';

const COVER_DELIM = '<<<COVER_LETTER>>>';

export interface StreamProgress {
  resume: string;
  coverLetter: string;
  /** True once the delimiter has been observed and we're streaming the cover letter */
  inCoverLetter: boolean;
}

/**
 * Streams the generated resume + cover letter from the server.
 * Calls onProgress for each delta. Returns the final values when complete.
 */
export async function generateDocumentsStream(
  req: GenerateRequest,
  onProgress: (p: StreamProgress) => void,
  signal?: AbortSignal
): Promise<GenerateResponse> {
  const url = ENDPOINT.includes('?')
    ? ENDPOINT + '&stream=1'
    : ENDPOINT + '?stream=1';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Generation failed (${res.status}): ${text || res.statusText}`
    );
  }
  recordQuota('generate');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resume = '';
  let coverLetter = '';
  let inCover = false;
  // Hold back the tail of the buffer so we don't emit a partial delimiter as resume content.
  const HOLDBACK = COVER_DELIM.length;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    if (!inCover) {
      const idx = buffer.indexOf(COVER_DELIM);
      if (idx >= 0) {
        resume += buffer.substring(0, idx);
        buffer = buffer.substring(idx + COVER_DELIM.length);
        inCover = true;
        // Strip leading whitespace from buffer (delimiter usually surrounded by blank lines)
        buffer = buffer.replace(/^\s+/, '');
        coverLetter += buffer;
        buffer = '';
        onProgress({ resume: resume.trim(), coverLetter, inCoverLetter: true });
        continue;
      }
      if (buffer.length > HOLDBACK) {
        const safe = buffer.substring(0, buffer.length - HOLDBACK);
        resume += safe;
        buffer = buffer.substring(buffer.length - HOLDBACK);
      }
      onProgress({ resume: resume.trim(), coverLetter: '', inCoverLetter: false });
    } else {
      coverLetter += buffer;
      buffer = '';
      onProgress({
        resume,
        coverLetter: coverLetter.trim(),
        inCoverLetter: true,
      });
    }
  }
  // Flush any remaining buffered text
  if (!inCover) {
    resume += buffer;
  } else {
    coverLetter += buffer;
  }
  resume = resume.trim();
  coverLetter = coverLetter.trim();
  if (!resume || !coverLetter) {
    throw new Error('Model output was incomplete — please try again.');
  }
  onProgress({ resume, coverLetter, inCoverLetter: true });
  return { resume, coverLetter };
}

export interface FetchJdResult {
  title: string;
  text: string;
}

export async function fetchJobDescriptionFromUrl(
  url: string
): Promise<FetchJdResult> {
  const res = await fetch(FETCH_JD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
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
    throw new Error(`Fetch failed (${res.status}): ${msg}`);
  }
  return res.json();
}
