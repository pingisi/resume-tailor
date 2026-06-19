import { useEffect, useMemo, useState } from 'react';
import type { Application, StoredResume } from '../types';
import { generateDocuments } from '../api/generate';
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
  const [tone, setTone] = useState('professional');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeOut, setResumeOut] = useState('');
  const [coverOut, setCoverOut] = useState('');

  useEffect(() => {
    if (!resumeId && defaultResumeId) setResumeId(defaultResumeId);
  }, [defaultResumeId, resumeId]);

  // Auto-suggest application name from company + role
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
    jobDescription.trim().length > 30;

  const canSave = !!resumeOut && !!coverOut && !!name.trim();

  async function handleGenerate() {
    if (!selectedResume) return;
    setBusy(true);
    setError(null);
    setResumeOut('');
    setCoverOut('');
    try {
      const out = await generateDocuments({
        resumeText: selectedResume.text,
        jobDescription,
        tone,
        company: company || undefined,
        role: role || undefined,
        recipient:
          recipientName || recipientTitle
            ? { name: recipientName || undefined, title: recipientTitle || undefined }
            : undefined,
      });
      setResumeOut(out.resume);
      setCoverOut(out.coverLetter);
    } catch (e: any) {
      setError(e?.message || 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(status: 'draft' | 'applied') {
    if (!selectedResume || !canSave) return;
    setSaving(true);
    try {
      const now = Date.now();
      const app: Application = {
        id: makeApplicationId(),
        name: name.trim(),
        company: company.trim(),
        role: role.trim(),
        resumeId: selectedResume.id,
        resumeName: selectedResume.name,
        jobDescription: jobDescription.trim(),
        recipient:
          recipientName || recipientTitle
            ? { name: recipientName || undefined, title: recipientTitle || undefined }
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
      // Reset for next application
      setCompany('');
      setRole('');
      setName('');
      setNameTouched(false);
      setRecipientName('');
      setRecipientTitle('');
      setJobDescription('');
      setResumeOut('');
      setCoverOut('');
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

        <label style={{ display: 'block', marginTop: '1rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem' }}>
            Job description
          </span>
          <textarea
            rows={10}
            placeholder="Paste the job description here…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </label>

        <div className="row" style={{ marginTop: '0.75rem' }}>
          <label>
            Tone:&nbsp;
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="enthusiastic">Enthusiastic</option>
              <option value="concise">Concise</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          <button
            className="primary"
            onClick={handleGenerate}
            disabled={!canGenerate || busy}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      {(resumeOut || coverOut) && (
        <>
          <OutputPanel resume={resumeOut} coverLetter={coverOut} />
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
        </>
      )}
    </>
  );
}
