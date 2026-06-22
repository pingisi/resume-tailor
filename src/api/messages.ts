import type { ComposeMessageRequest, ComposeMessageResponse } from '../types';
import { record as recordQuota } from '../lib/quota';

const ENDPOINT =
  import.meta.env.VITE_COMPOSE_MESSAGE_URL || '/api/compose-message';

export async function composeMessage(
  req: ComposeMessageRequest
): Promise<ComposeMessageResponse> {
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
    throw new Error(`Compose message failed (${res.status}): ${msg}`);
  }
  recordQuota('message');
  return res.json();
}
