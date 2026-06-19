import { useEffect, useState } from 'react';
import { ResumeUpload } from './components/ResumeUpload';
import { JobInput } from './components/JobInput';
import { OutputPanel } from './components/OutputPanel';
import { loadResume } from './lib/storage';
import { generateDocuments } from './api/generate';
import './App.css';

export default function App() {
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState<string>();
  const [job, setJob] = useState('');
  const [tone, setTone] = useState('professional');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeOut, setResumeOut] = useState('');
  const [coverOut, setCoverOut] = useState('');

  useEffect(() => {
    void loadResume().then((r) => {
      if (r) {
        setResumeText(r.text);
        setResumeFileName(r.fileName);
      }
    });
  }, []);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setResumeOut('');
    setCoverOut('');
    try {
      const out = await generateDocuments({
        resumeText,
        jobDescription: job,
        tone,
      });
      setResumeOut(out.resume);
      setCoverOut(out.coverLetter);
    } catch (e: any) {
      setError(e?.message || 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  const canGenerate = resumeText.trim().length > 50 && job.trim().length > 30;

  return (
    <div className="app">
      <header>
        <h1>Resume Tailor</h1>
        <p className="muted">
          Tailor your existing resume and write a matching cover letter from a
          job description.
        </p>
      </header>

      <ResumeUpload
        currentFileName={resumeFileName}
        onLoaded={(text, name) => {
          setResumeText(text);
          setResumeFileName(name);
        }}
      />

      <JobInput
        value={job}
        onChange={setJob}
        tone={tone}
        onToneChange={setTone}
        onGenerate={handleGenerate}
        canGenerate={canGenerate}
        busy={busy}
      />

      {error && <div className="card error">{error}</div>}

      {(resumeOut || coverOut) && (
        <OutputPanel resume={resumeOut} coverLetter={coverOut} />
      )}

      <footer className="muted">
        Your resume is stored locally in your browser (IndexedDB). The job
        description and resume text are sent only to the AI provider via a
        Firebase Cloud Function.
      </footer>
    </div>
  );
}
