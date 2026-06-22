import { useEffect, useState } from 'react';
import { getProfile, saveProfile } from '../lib/storage';
import type { Profile, ProfileQA } from '../types';

const FIELDS: { key: keyof Profile; label: string; placeholder?: string; type?: 'text' | 'textarea' }[] = [
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'linkedin', label: 'LinkedIn URL' },
  { key: 'github', label: 'GitHub URL' },
  { key: 'portfolio', label: 'Portfolio URL' },
  { key: 'location', label: 'Location', placeholder: 'City, Country' },
  {
    key: 'workAuthorization',
    label: 'Work authorization',
    placeholder: 'e.g. Canadian PR, US Citizen, H1B',
  },
  {
    key: 'willingToRelocate',
    label: 'Willing to relocate?',
    placeholder: 'Yes / No / Specific cities',
  },
  {
    key: 'preferredArrangement',
    label: 'Preferred arrangement',
    placeholder: 'Remote / Hybrid / On-site',
  },
  { key: 'noticePeriod', label: 'Notice period', placeholder: 'e.g. 2 weeks' },
  {
    key: 'yearsOfExperience',
    label: 'Years of experience',
    placeholder: 'e.g. 8',
  },
  {
    key: 'salaryExpectation',
    label: 'Salary expectation',
    placeholder: 'e.g. CAD 150-180k base',
  },
];

const LONG_FIELDS: { key: keyof Profile; label: string; placeholder?: string }[] = [
  {
    key: 'about',
    label: 'About / elevator pitch',
    placeholder:
      'A few sentences describing who you are, what you build, what you care about. The model uses this as the seed for "Tell me about yourself" answers.',
  },
  {
    key: 'reasonForLeaving',
    label: 'Reason for looking',
    placeholder:
      'Why are you exploring new roles? Used to answer "Why are you leaving?"',
  },
];

const empty: Profile = { updatedAt: 0 };

export function ProfileManager() {
  const [profile, setProfile] = useState<Profile>(empty);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    void getProfile().then((p) => {
      if (p) setProfile(p);
      setLoaded(true);
    });
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSavedAt(null);
  }

  function updateQA(idx: number, patch: Partial<ProfileQA>) {
    setProfile((p) => {
      const list = [...(p.customAnswers ?? [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...p, customAnswers: list };
    });
    setSavedAt(null);
  }

  function addQA() {
    setProfile((p) => ({
      ...p,
      customAnswers: [
        ...(p.customAnswers ?? []),
        { question: '', answer: '' },
      ],
    }));
    setSavedAt(null);
  }

  function removeQA(idx: number) {
    setProfile((p) => {
      const list = [...(p.customAnswers ?? [])];
      list.splice(idx, 1);
      return { ...p, customAnswers: list };
    });
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    try {
      await saveProfile(profile);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="card">
        <h2>Profile</h2>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Profile</h2>
      <p className="muted">
        Stored locally and reused for every application's "Quick answers"
        panel. Skip any field you don't want the model to use.
      </p>

      <div className="form-grid" style={{ marginTop: '0.5rem' }}>
        {FIELDS.map((f) => (
          <label key={f.key as string}>
            <span>{f.label}</span>
            <input
              type="text"
              value={(profile[f.key] as string | undefined) ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => update(f.key, e.target.value as Profile[typeof f.key])}
            />
          </label>
        ))}
      </div>

      {LONG_FIELDS.map((f) => (
        <label
          key={f.key as string}
          style={{ display: 'block', marginTop: '0.75rem' }}
        >
          <span style={{ display: 'block', marginBottom: '0.25rem' }}>
            {f.label}
          </span>
          <textarea
            rows={4}
            placeholder={f.placeholder}
            value={(profile[f.key] as string | undefined) ?? ''}
            onChange={(e) => update(f.key, e.target.value as Profile[typeof f.key])}
          />
        </label>
      ))}

      <div style={{ marginTop: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Custom Q&amp;A</strong>
          <button type="button" onClick={addQA}>
            + Add
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
          Pre-write answers for questions that come up repeatedly (e.g. "Why
          are you interested in &lt;industry&gt;?", "Describe a hard bug").
          The model will use these verbatim when a similar question is asked.
        </p>
        {(profile.customAnswers ?? []).map((qa, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              marginTop: '0.5rem',
            }}
          >
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <input
                type="text"
                value={qa.question}
                placeholder="Question"
                onChange={(e) => updateQA(i, { question: e.target.value })}
              />
              <button
                type="button"
                className="danger"
                onClick={() => removeQA(i)}
                title="Remove"
              >
                ×
              </button>
            </div>
            <textarea
              rows={3}
              value={qa.answer}
              placeholder="Your answer"
              style={{ marginTop: '0.4rem' }}
              onChange={(e) => updateQA(i, { answer: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {savedAt && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
