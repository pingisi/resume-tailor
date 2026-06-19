import { useEffect, useState } from 'react';
import {
  connect,
  disconnect,
  inferStatus,
  isConfigured,
  isConnected,
  searchMessages,
  type MatchResult,
} from '../lib/gmail';
import { updateApplication } from '../lib/storage';
import type { Application } from '../types';

interface Props {
  application: Application;
  onChange: (a: Application) => void;
}

export function GmailSync({ application, onChange }: Props) {
  const [connected, setConnected] = useState(isConnected());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    function onChange() {
      setConnected(isConnected());
    }
    window.addEventListener('gmail-change', onChange);
    return () => window.removeEventListener('gmail-change', onChange);
  }, []);

  if (!isConfigured()) {
    return (
      <details className="card">
        <summary>Gmail sync (optional)</summary>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env</code> and
          rebuild to enable Gmail-based status detection.
        </p>
      </details>
    );
  }

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      await connect();
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError(null);
    try {
      await disconnect();
      setConnected(false);
      setMatches(null);
      setInfo(null);
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await searchMessages(application.company, application.role);
      setMatches(r);
      const inf = inferStatus(r);
      if (inf.status && inf.status !== application.status) {
        const patch: Partial<Application> = { status: inf.status };
        if (inf.appliedAt && !application.appliedAt) {
          patch.appliedAt = inf.appliedAt;
        }
        const updated = await updateApplication(application.id, patch);
        if (updated) {
          onChange(updated);
          setInfo(`Status set to "${inf.status}" — ${inf.reason}`);
        }
      } else if (inf.status === application.status) {
        setInfo(`Already "${inf.status}". ${inf.reason}`);
      } else {
        setInfo(inf.reason);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card">
      <summary>Gmail sync</summary>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        Scan your mailbox for sent applications + interview emails matching
        this company and role. Read-only; nothing leaves your browser.
      </p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        {!connected && (
          <button onClick={handleConnect} disabled={busy}>
            Connect Gmail
          </button>
        )}
        {connected && (
          <>
            <button className="primary" onClick={scan} disabled={busy}>
              {busy ? 'Scanning…' : 'Scan mailbox'}
            </button>
            <button onClick={handleDisconnect} disabled={busy}>
              Disconnect
            </button>
          </>
        )}
      </div>

      {info && <p className="muted" style={{ marginTop: '0.5rem' }}>{info}</p>}
      {error && <p className="error">{error}</p>}

      {matches && matches.length > 0 && (
        <table className="data-table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Subject</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.messageId}>
                <td className="muted">
                  {new Date(m.date).toLocaleDateString()}
                </td>
                <td title={m.snippet}>{m.subject || '(no subject)'}</td>
                <td className="muted">
                  {m.isSent ? 'sent' : m.isInbox ? 'inbox' : 'other'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
