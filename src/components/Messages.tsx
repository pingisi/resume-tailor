import { useEffect, useState } from 'react';
import { composeMessage } from '../api/messages';
import { getProfile, updateApplication } from '../lib/storage';
import type {
  AppMessage,
  Application,
  MessageKind,
  Profile,
} from '../types';

interface Props {
  application: Application;
  onChange: (app: Application) => void;
}

const KIND_LABEL: Record<MessageKind, string> = {
  'follow-up': 'Follow-up email',
  'thank-you': 'Thank-you note',
  'recruiter-dm': 'Recruiter DM',
};

const KIND_HINT: Record<MessageKind, string> = {
  'follow-up':
    'Polite nudge after applying. Best when status is Applied and a few days have passed.',
  'thank-you':
    'Send after an interview. Reiterates interest and references the conversation.',
  'recruiter-dm':
    'Short LinkedIn message. Useful right after applying when you find the recruiter.',
};

function daysBetween(from: number, to: number): number {
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

export function Messages({ application, onChange }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busyKind, setBusyKind] = useState<MessageKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    void getProfile().then((p) => setProfile(p ?? null));
  }, []);

  const messages = application.messages ?? [];

  async function generate(kind: MessageKind) {
    setBusyKind(kind);
    setError(null);
    try {
      const days =
        application.appliedAt != null
          ? daysBetween(application.appliedAt, Date.now())
          : undefined;
      const resp = await composeMessage({
        kind,
        profile: profile ?? undefined,
        company: application.company,
        role: application.role,
        jobDescription: application.jobDescription,
        tailoredResume: application.generatedResume,
        recipient: application.recipient,
        appliedAt: application.appliedAt,
        daysSinceApplied: days,
      });
      const newMsg: AppMessage = {
        kind,
        subject: resp.subject || undefined,
        body: resp.body,
        generatedAt: Date.now(),
      };
      // Replace any existing message of the same kind
      const next = [
        newMsg,
        ...messages.filter((m) => m.kind !== kind),
      ];
      const updated = await updateApplication(application.id, {
        messages: next,
      });
      if (updated) onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  }

  async function remove(kind: MessageKind) {
    if (!confirm(`Delete the ${KIND_LABEL[kind]}?`)) return;
    const next = messages.filter((m) => m.kind !== kind);
    const updated = await updateApplication(application.id, { messages: next });
    if (updated) onChange(updated);
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(
        () => setCopiedKey((v) => (v === key ? null : v)),
        1500
      );
    } catch {
      /* ignore */
    }
  }

  function findMessage(kind: MessageKind): AppMessage | undefined {
    return messages.find((m) => m.kind === kind);
  }

  const kinds: MessageKind[] = ['follow-up', 'thank-you', 'recruiter-dm'];

  return (
    <div className="card">
      <h3 style={{ margin: 0 }}>Outreach messages</h3>
      <p className="muted" style={{ marginTop: '0.25rem' }}>
        One-click drafts you can paste into email or LinkedIn. Each uses your
        Profile + this role's context. Regenerating replaces the existing
        draft for that kind.
      </p>

      <div className="row" style={{ flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {kinds.map((k) => {
          const existing = findMessage(k);
          return (
            <button
              key={k}
              onClick={() => generate(k)}
              disabled={busyKind !== null}
              title={KIND_HINT[k]}
            >
              {busyKind === k
                ? 'Generating…'
                : existing
                  ? `Regenerate ${KIND_LABEL[k].toLowerCase()}`
                  : `Generate ${KIND_LABEL[k].toLowerCase()}`}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="muted" style={{ color: 'var(--err, #c33)', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}

      {messages.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          {kinds
            .map((k) => findMessage(k))
            .filter((m): m is AppMessage => !!m)
            .map((m) => {
              const fullText = m.subject
                ? `Subject: ${m.subject}\n\n${m.body}`
                : m.body;
              const bodyKey = `${m.kind}-body`;
              const subjectKey = `${m.kind}-subject`;
              const fullKey = `${m.kind}-full`;
              return (
                <div
                  key={m.kind}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.75rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{KIND_LABEL[m.kind]}</strong>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(m.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  {m.subject && (
                    <div className="row" style={{ marginTop: '0.5rem' }}>
                      <span className="meta-label">Subject:</span>
                      <span style={{ flex: 1 }}>{m.subject}</span>
                      <button onClick={() => copy(m.subject!, subjectKey)}>
                        {copiedKey === subjectKey ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                  <pre
                    className="resume-text"
                    style={{
                      whiteSpace: 'pre-wrap',
                      marginTop: '0.5rem',
                    }}
                  >
                    {m.body}
                  </pre>
                  <div className="row" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => copy(m.body, bodyKey)}>
                      {copiedKey === bodyKey ? 'Copied!' : 'Copy body'}
                    </button>
                    {m.subject && (
                      <button onClick={() => copy(fullText, fullKey)}>
                        {copiedKey === fullKey ? 'Copied!' : 'Copy subject + body'}
                      </button>
                    )}
                    <button className="danger" onClick={() => remove(m.kind)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
