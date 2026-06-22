import { useEffect, useState } from 'react';
import { answerQuestions } from '../api/answers';
import { getProfile, updateApplication } from '../lib/storage';
import type { Application, Profile, ProfileQA } from '../types';

const SEED_QUESTIONS = [
  'Why are you interested in this role?',
  'Why this company?',
  'Tell us about yourself.',
  'What are your salary expectations?',
  'Are you authorized to work in the country where this role is based?',
  'What is your notice period?',
  'Why are you leaving your current role?',
  'How many years of experience do you have?',
  'What is your preferred work arrangement (remote / hybrid / on-site)?',
  'What are your biggest strengths?',
];

interface Props {
  application: Application;
  onChange: (app: Application) => void;
}

export function QuickAnswers({ application, onChange }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [questionsText, setQuestionsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    void getProfile().then((p) => {
      setProfile(p ?? null);
      setProfileLoaded(true);
    });
  }, []);

  const answers = application.quickAnswers ?? [];

  function seed() {
    const existing = questionsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const seen = new Set(existing.map((q) => q.toLowerCase()));
    const merged = [...existing];
    for (const q of SEED_QUESTIONS) {
      if (!seen.has(q.toLowerCase())) merged.push(q);
    }
    setQuestionsText(merged.join('\n'));
  }

  async function generate() {
    setError(null);
    const questions = questionsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (questions.length === 0) {
      setError('Add at least one question (one per line).');
      return;
    }
    if (!profile) {
      setError('Fill in your Profile tab first so the model has facts to use.');
      return;
    }
    setLoading(true);
    try {
      const resp = await answerQuestions({
        profile,
        company: application.company,
        role: application.role,
        jobDescription: application.jobDescription,
        tailoredResume: application.generatedResume,
        questions,
      });
      const cleaned: ProfileQA[] = (resp.answers || [])
        .filter((a) => a && a.answer)
        .map((a) => ({ question: a.question, answer: a.answer }));
      const updated = await updateApplication(application.id, {
        quickAnswers: cleaned,
      });
      if (updated) onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500);
    } catch {
      /* ignore */
    }
  }

  async function clearAll() {
    if (!confirm('Clear generated answers?')) return;
    const updated = await updateApplication(application.id, {
      quickAnswers: [],
    });
    if (updated) onChange(updated);
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Quick answers</h3>
        {answers.length > 0 && (
          <button onClick={clearAll}>Clear</button>
        )}
      </div>
      <p className="muted" style={{ marginTop: '0.25rem' }}>
        Paste screening questions from the application form, one per line.
        The model tailors answers using your Profile + this role's JD.
      </p>

      {profileLoaded && !profile && (
        <p className="muted" style={{ color: 'var(--warn, #c70)' }}>
          Tip: fill in the Profile tab first for better answers.
        </p>
      )}

      <textarea
        rows={6}
        placeholder={'Why are you interested in this role?\nWhat is your notice period?\n…'}
        value={questionsText}
        onChange={(e) => setQuestionsText(e.target.value)}
        style={{ marginTop: '0.5rem' }}
      />

      <div className="row" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="primary"
          onClick={generate}
          disabled={loading || !profileLoaded}
        >
          {loading ? 'Generating…' : 'Generate answers'}
        </button>
        <button onClick={seed} disabled={loading}>
          + Seed common questions
        </button>
        {error && (
          <span className="muted" style={{ color: 'var(--err, #c33)' }}>
            {error}
          </span>
        )}
      </div>

      {answers.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          {answers.map((qa, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.75rem',
                marginTop: '0.5rem',
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.9rem' }}>{qa.question}</strong>
                <button onClick={() => copy(qa.answer, i)}>
                  {copiedIdx === i ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                {qa.answer}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
