import { useRef, useState } from 'react';
import { parseResumeFile } from '../lib/parseResume';
import { saveResume } from '../lib/storage';

interface Props {
  currentFileName?: string;
  onLoaded: (text: string, fileName: string) => void;
}

export function ResumeUpload({ currentFileName, onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await parseResumeFile(file);
      if (!text.trim()) throw new Error('No text extracted from the file.');
      await saveResume(file.name, text);
      onLoaded(text, file.name);
    } catch (e: any) {
      setError(e?.message || 'Failed to parse file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>1. Your resume</h2>
      <p className="muted">
        Upload PDF, DOCX, or TXT. It stays in your browser (IndexedDB) — never
        uploaded to a server.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        className="primary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? 'Parsing…' : currentFileName ? 'Replace resume' : 'Upload resume'}
      </button>
      {currentFileName && (
        <span className="muted" style={{ marginLeft: '0.75rem' }}>
          Loaded: <strong>{currentFileName}</strong>
        </span>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
