import { useMemo, useState } from 'react';
import type {
  Application,
  InterviewCategory,
  InterviewPrep,
  InterviewQuestion,
} from '../types';
import { prepareInterview } from '../api/interview';
import { updateApplication } from '../lib/storage';

interface Props {
  application: Application;
  originalResume?: string;
  highlight: boolean;
  onChange: (app: Application) => void;
}

const CATEGORY_ORDER: InterviewCategory[] = [
  'technical',
  'behavioral',
  'role-specific',
  'culture',
];

const CATEGORY_LABEL: Record<InterviewCategory, string> = {
  technical: 'Technical',
  behavioral: 'Behavioral',
  'role-specific': 'Role-specific',
  culture: 'Culture',
};

export function InterviewPrep({
  application,
  originalResume,
  highlight,
  onChange,
}: Props) {
  const prep = application.interviewPrep;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<InterviewCategory | 'all'>('all');

  const grouped = useMemo(() => {
    if (!prep) return null;
    const byCat = new Map<InterviewCategory, InterviewQuestion[]>();
    for (const q of prep.questions) {
      const list = byCat.get(q.category) || [];
      list.push(q);
      byCat.set(q.category, list);
    }
    return byCat;
  }, [prep]);

  async function handleGenerate() {
    if (!originalResume) {
      setError('Original resume not found — cannot generate.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await prepareInterview({
        resumeText: originalResume,
        jobDescription: application.jobDescription,
        company: application.company || undefined,
        role: application.role || undefined,
      });
      const next: InterviewPrep = {
        generatedAt: Date.now(),
        questions: result.questions,
      };
      const updated = await updateApplication(application.id, {
        interviewPrep: next,
      });
      if (updated) onChange(updated);
      setExpanded(new Set([0]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function toggle(idx: number) {
    const next = new Set(expanded);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpanded(next);
  }

  const filteredList: { q: InterviewQuestion; idx: number }[] = useMemo(() => {
    if (!prep) return [];
    return prep.questions
      .map((q, idx) => ({ q, idx }))
      .filter((x) => filter === 'all' || x.q.category === filter);
  }, [prep, filter]);

  return (
    <div className={'card' + (highlight ? ' card-highlight' : '')}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>
          Interview prep
          {highlight && <span className="badge-default">Status: interview</span>}
        </h3>
        {prep && (
          <button onClick={handleGenerate} disabled={busy}>
            {busy ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {!prep && (
        <>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Generate 10–12 likely interview questions tailored to this job
            description, each with talking points pulled from your resume.
          </p>
          <div className="row">
            <button
              className="primary"
              onClick={handleGenerate}
              disabled={busy || !originalResume}
              title={
                !originalResume
                  ? 'The base resume used for this application has been deleted.'
                  : undefined
              }
            >
              {busy ? 'Preparing…' : 'Prepare for interview'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {!originalResume && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              The base resume used for this application is no longer available.
            </p>
          )}
        </>
      )}

      {prep && grouped && (
        <>
          <div className="filter-row" style={{ marginTop: '0.75rem' }}>
            <button
              className={'filter' + (filter === 'all' ? ' active' : '')}
              onClick={() => setFilter('all')}
            >
              All <span className="filter-count">{prep.questions.length}</span>
            </button>
            {CATEGORY_ORDER.map((cat) => {
              const count = grouped.get(cat)?.length ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  className={'filter' + (filter === cat ? ' active' : '')}
                  onClick={() => setFilter(cat)}
                >
                  {CATEGORY_LABEL[cat]}{' '}
                  <span className="filter-count">{count}</span>
                </button>
              );
            })}
          </div>

          <ol className="qlist">
            {filteredList.map(({ q, idx }) => {
              const isOpen = expanded.has(idx);
              return (
                <li key={idx} className={'qcard cat-' + q.category}>
                  <button
                    type="button"
                    className="qhead"
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                  >
                    <span className={'cat-pill cat-pill-' + q.category}>
                      {CATEGORY_LABEL[q.category]}
                    </span>
                    <span className="qtext">{q.question}</span>
                    <span className="qchevron">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="qbody">
                      <p className="qwhy">
                        <em>Why they ask:</em> {q.why}
                      </p>
                      <p className="qtalk-label">Your talking points:</p>
                      <ul className="qtalk">
                        {q.talkingPoints.map((tp, i) => (
                          <li key={i}>{tp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <p className="muted" style={{ fontSize: '0.75rem' }}>
            Generated {new Date(prep.generatedAt).toLocaleString()}
          </p>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  );
}
