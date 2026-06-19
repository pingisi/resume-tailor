import { useRef, useState } from 'react';
import { exportBackup, importBackup, type ImportStats } from '../lib/backup';

interface Props {
  onImported: () => void | Promise<void>;
}

export function BackupPanel({ onImported }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await exportBackup();
      setStatus('Backup downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(mode: 'merge' | 'replace') {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setError('Choose a backup file first.');
      return;
    }
    if (mode === 'replace') {
      const ok = confirm(
        'Replace will DELETE all current resumes and applications, then load the backup. Continue?'
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result: ImportStats = await importBackup(f, mode);
      setStatus(
        `Imported ${result.resumes} resume(s) and ${result.applications} application(s) (${result.mode}).`
      );
      if (fileRef.current) fileRef.current.value = '';
      await onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Backup &amp; restore</h3>
      <p className="muted">
        All data lives in this browser. Export a JSON backup occasionally so
        you don't lose history if you clear site data or switch browsers.
      </p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button onClick={handleExport} disabled={busy}>
          Export backup (.json)
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <input ref={fileRef} type="file" accept="application/json,.json" />
        <div className="row" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => handleImport('merge')} disabled={busy}>
            Import (merge)
          </button>
          <button
            className="danger"
            onClick={() => handleImport('replace')}
            disabled={busy}
          >
            Import (replace all)
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
          Merge keeps existing entries and overwrites matching ids. Replace
          clears everything first.
        </p>
      </div>

      {status && <p className="backup-status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
