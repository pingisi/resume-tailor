import { useEffect, useMemo, useRef, useState } from 'react';
import type { Application, StoredResume } from '../types';
import {
  generateDocumentsStream,
  fetchJobDescriptionFromUrl,
} from '../api/generate';
import { extractKeywords } from '../lib/keywords';
import { makeApplicationId, saveApplication } from '../lib/storage';
import { OutputPanel } from './OutputPanel';

interface Props {
  resumes: StoredResume[];
  defaultResumeId?: string;
  onSaved: (app: Application) => void;
}

export function ApplicationForm({ resumes, defaultResumeId, onSaved }: Props) {
  const [resumeId, setResumeId] = useState<string>(defaultResumeId || '');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [fetchingJd, setFetchingJd] = useState(false);
  const [tone, setTone] = useState('professional');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeOut, setResumeOut] = useState('');
  const [coverOut, setCoverOut] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!resumeId && defaultResumeId) setResumeId(defaultResumeId);
  }, [defaultResumeId, resumeId]);

  useEffect(() => {
    if (nameTouched) return;
    if (company && role) setName(`${role} @ ${company}`);
    else if (role) setName(role);
    else if (company) setName(company);
    else setName('');
  }, [company, role, nameTouched]);

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === resumeId),
    [resumes, resumeId]
  );

  const canGenerate =
    !!selectedResume &&
    selectedResume.text.trim().length > 50 &&
    jobDescription.trim().length > 30 &&
    !busy;

  const canSave = !!resumeOut && !!coverOut;

  function effectiveName(): string {
    const n = name.trim();
    if (n) return n;
    const r = role.trim();
    const c = company.trim();
    if (r && c) return `${r} @ ${c}`;
    if (r) return r;
    if (c) return c;
    return `Application ${new Date().toLocaleDateString()}`;
  }

  async function handleFetchJd() {
    if (!jdUrl.trim()) return;
    setFetchingJd(true);
    setError(null);
    try {
      const result = await fetchJobDescriptionFromUrl(jdUrl.trim());
      setJobDescription(result.text);
      // Try to backfill role/company from page title if both empty.
      if (!role && !company && result.title) {
        const t = result.title.trim();
        const parts = t.split(/\s+(?:at|@|–|-|\|)\s+/i);
        if (parts.length >= 2) {
          if (!role) setRole(parts[0].trim());
          if (!company) setCompany(parts[1].replace(/\s*[-–|].*$/, '').trim());
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch URL.';
      setError(msg);
    } finally {
      setFetchingJd(false);
    }
  }

  async function handleGenerate() {
    if (!selectedResume) return;
    setBusy(true);
    setStreaming(true);
    setError(null);
    setResumeOut('');
    setCoverOut('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await generateDocumentsStream(
        {
          resumeText: selectedResume.text,
          jobDescription,
          tone,
          company: company || undefined,
          role: role || undefined,
          recipient:
            recipientName || recipientTitle
              ? {
                  name: recipientName || undefined,
                  title: recipientTitle || undefined,
                }
              : undefined,
          keywords: extractKeywords(jobDescription, 30),
        },
        (p) => {
          setResumeOut(p.resume);
          setCoverOut(p.coverLetter);
        },
        ctrl.signal
      );
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        const msg = e instanceof Error ? e.message : 'Generation failed.';
        setError(msg);
      }
    } finally {
      setBusy(false);
      setStreaming(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function handleSave(status: 'draft' | 'applied') {
    if (!selectedResume || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const app: Application = {
        id: makeApplicationId(),
        name: effectiveName(),
        company: company.trim(),
        role: role.trim(),
        resumeId: selectedResume.id,
        resumeName: selectedResume.name,
        jobDescription: jobDescription.trim(),
        recipient:
          recipientName || recipientTitle
            ? {
                name: recipientName || undefined,
                title: recipientTitle || undefined,
              }
            : undefined,
        tone,
        generatedResume: resumeOut,
        generatedCoverLetter: coverOut,
        status,
        createdAt: now,
        updatedAt: now,
        appliedAt: status === 'applied' ? now : undefined,
      };
      await saveApplication(app);
      onSaved(app);
      setCompany('');
      setRole('');
      setName('');
      setNameTouched(false);
      setRecipientName('');
      setRecipientTitle('');
      setJobDescription('');
      setJdUrl('');
      setResumeOut('');
      setCoverOut('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (resumes.length === 0) {
    return (
      <div className="card">
        <h2>New application</h2>
        <p>
          Add a base resume first — go to the <strong>Resumes</strong> tab and
          upload one.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>New application</h2>

        <div className="form-grid">
          <label>
            <span>Base resume</span>
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Company</span>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google"
            />
          </label>

          <label>
            <span>Role</span>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
            />
          </label>

          <label>
            <span>Application name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder="Auto-fills from role + company"
            />
          </label>

          <label>
            <span>Hiring manager (optional)</span>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
          </label>

          <label>
            <span>Their title (optional)</span>
            <input
              type="text"
              value={recipientTitle}
              onChange={(e) => setRecipientTitle(e.target.value)}
              placeholder="e.g. Engineering Manager"
            />
          </label>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>
            Job description
          </span>
          <div className="row" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              placeholder="Paste a job posting URL to auto-fill below…"
              style={{ flex: 1, minWidth: 240 }}
              disabled={fetchingJd}
            />
            <button
              type="button"
              onClick={handleFetchJd}
              disabled={!jdUrl.trim() || fetchingJd}
            >
              {fetchingJd ? 'Fetching…' : 'Fetch from URL'}
            </button>
          </div>
          <textarea
            rows={10}
            placeholder="…or paste the job description here."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>

        <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <label>
            Tone:&nbsp;
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="enthusiastic">Enthusiastic</option>
              <option value="concise">Concise</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          {!busy ? (
            <button
              className="primary"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              Generate
            </button>
          ) : (
            <>
              <span className="muted">Streaming response…</span>
              <button onClick={handleCancel}>Cancel</button>
            </>
          )}
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      {(resumeOut || coverOut || streaming) && (
        <>
          <OutputPanel
            resume={resumeOut}
            coverLetter={coverOut}
            originalResume={selectedResume?.text}
            jobDescription={jobDescription}
            streaming={streaming}
            company={company}
            role={role}
          />
          {!streaming && resumeOut && coverOut && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Save this application</h3>
              <p className="muted">
                Saves to your local history so you can track responses later.
              </p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleSave('draft')}
                  disabled={!canSave || saving}
                >
                  Save as draft
                </button>
                <button
                  className="primary"
                  onClick={() => handleSave('applied')}
                  disabled={!canSave || saving}
                >
                  Mark as applied & save
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
