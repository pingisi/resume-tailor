/**
 * Gmail integration via Google Identity Services (GSI) implicit token client.
 *
 * Setup:
 *   1. Create an OAuth 2.0 Client ID (type: Web application) in the GCP
 *      console. Add the deployed origin (e.g. https://your-app.web.app) and
 *      http://localhost:5173 to "Authorized JavaScript origins".
 *   2. Add the client id as VITE_GOOGLE_CLIENT_ID in .env (or .env.local).
 *   3. Set the OAuth consent screen to External + Testing, add yourself as a
 *      test user, and request scope https://www.googleapis.com/auth/gmail.readonly
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY = 'resume-tailor:gmail-token';

interface StoredToken {
  access_token: string;
  expires_at: number;
}

interface GsiTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface GsiTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: GsiTokenResponse) => void;
          }) => GsiTokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

let gsiLoaded: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (gsiLoaded) return gsiLoaded;
  gsiLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gsiLoaded;
}

function getClientId(): string | null {
  const v = (import.meta as ImportMeta & { env: Record<string, string> }).env
    .VITE_GOOGLE_CLIENT_ID;
  return v && v.trim().length > 0 ? v.trim() : null;
}

export function isConfigured(): boolean {
  return getClientId() !== null;
}

function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (t.expires_at <= Date.now() + 5000) return null;
    return t;
  } catch {
    return null;
  }
}

function saveToken(t: StoredToken) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

export function isConnected(): boolean {
  return loadToken() !== null;
}

export async function connect(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID is not set. Add it to .env and rebuild.'
    );
  }
  await loadGsi();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Authorization failed'));
          return;
        }
        saveToken({
          access_token: resp.access_token,
          expires_at: Date.now() + resp.expires_in * 1000,
        });
        window.dispatchEvent(new CustomEvent('gmail-change'));
        resolve();
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function disconnect(): Promise<void> {
  const t = loadToken();
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent('gmail-change'));
  if (!t) return;
  await loadGsi().catch(() => undefined);
  if (window.google?.accounts.oauth2) {
    await new Promise<void>((res) => {
      window.google!.accounts.oauth2.revoke(t.access_token, res);
    });
  }
}

function authHeader(): Record<string, string> {
  const t = loadToken();
  if (!t) throw new Error('Gmail is not connected.');
  return { Authorization: `Bearer ${t.access_token}` };
}

interface GmailMessageMeta {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageFull extends GmailMessageMeta {
  payload?: {
    headers?: GmailHeader[];
  };
}

export interface MatchResult {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: number;
  snippet: string;
  isSent: boolean;
  isInbox: boolean;
}

function buildQuery(company: string, role: string): string {
  const parts: string[] = [];
  const company_s = company.trim();
  const role_s = role.trim();
  if (company_s) {
    // mails about this company in sent or inbox in the last 120 days
    parts.push(`"${company_s.replace(/"/g, '')}"`);
  }
  if (role_s) {
    parts.push(`"${role_s.replace(/"/g, '')}"`);
  }
  parts.push('newer_than:120d');
  return parts.join(' ');
}

export async function searchMessages(
  company: string,
  role: string,
  maxResults = 10
): Promise<MatchResult[]> {
  if (!company.trim() && !role.trim()) return [];
  const q = buildQuery(company, role);
  const url = new URL(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages'
  );
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', String(maxResults));

  const listRes = await fetch(url.toString(), { headers: authHeader() });
  if (listRes.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('gmail-change'));
    throw new Error('Gmail session expired — reconnect.');
  }
  if (!listRes.ok) {
    throw new Error(`Gmail list failed: ${listRes.status}`);
  }
  const listData = (await listRes.json()) as {
    messages?: { id: string; threadId: string }[];
  };
  if (!listData.messages?.length) return [];

  const details = await Promise.all(
    listData.messages.map(async (m) => {
      const u = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`
      );
      u.searchParams.set('format', 'metadata');
      u.searchParams.append('metadataHeaders', 'Subject');
      u.searchParams.append('metadataHeaders', 'From');
      u.searchParams.append('metadataHeaders', 'To');
      u.searchParams.append('metadataHeaders', 'Date');
      const r = await fetch(u.toString(), { headers: authHeader() });
      if (!r.ok) return null;
      return (await r.json()) as GmailMessageFull;
    })
  );

  return details
    .filter((m): m is GmailMessageFull => m !== null)
    .map((m) => {
      const h = (name: string) =>
        m.payload?.headers?.find(
          (x) => x.name.toLowerCase() === name.toLowerCase()
        )?.value ?? '';
      return {
        messageId: m.id,
        threadId: m.threadId,
        subject: h('Subject'),
        from: h('From'),
        to: h('To'),
        date: Number(m.internalDate) || 0,
        snippet: m.snippet ?? '',
        isSent: m.labelIds?.includes('SENT') ?? false,
        isInbox: m.labelIds?.includes('INBOX') ?? false,
      };
    })
    .sort((a, b) => a.date - b.date);
}

export interface InferredStatus {
  status: 'applied' | 'interview' | null;
  appliedAt?: number;
  reason: string;
}

const INTERVIEW_RE = /\b(interview|onsite|on-site|on site|schedule|invite|next steps|technical screen|hiring manager)\b/i;

export function inferStatus(matches: MatchResult[]): InferredStatus {
  if (matches.length === 0) return { status: null, reason: 'No matches.' };

  let appliedAt: number | undefined;
  for (const m of matches) {
    if (m.isSent) {
      appliedAt = appliedAt ? Math.min(appliedAt, m.date) : m.date;
    }
  }

  const interviewSignal = matches.find((m) => INTERVIEW_RE.test(m.subject));
  if (interviewSignal) {
    return {
      status: 'interview',
      appliedAt,
      reason: `Interview keyword in "${interviewSignal.subject}"`,
    };
  }
  if (appliedAt) {
    return {
      status: 'applied',
      appliedAt,
      reason: 'Found a sent email matching the application.',
    };
  }
  return {
    status: null,
    reason: 'Found inbox mail but no sent application.',
  };
}
