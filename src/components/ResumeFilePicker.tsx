import { useRef, useState } from 'react';
import { parseResumeFile } from '../lib/parseResume';

interface Props {
  label?: string;
  onParsed: (text: string, fileName: string) => void | Promise<void>;
}

export function ResumeFilePicker({ label = 'Upload resume', onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await parseResumeFile(file);
      if (!text.trim()) throw new Error('No text extracted from the file.');
      await onParsed(text, file.name);
    } catch (e: any) {
      setError(e?.message || 'Failed to parse file.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
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
        {busy ? 'Parsing…' : label}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}
