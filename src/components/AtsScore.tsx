import { useMemo } from 'react';
import { ats } from '../lib/keywords';

interface Props {
  jobDescription: string;
  resume: string;
}

export function AtsScore({ jobDescription, resume }: Props) {
  const result = useMemo(
    () => ats(jobDescription, resume),
    [jobDescription, resume]
  );

  if (result.total === 0) return null;

  const tone =
    result.score >= 75
      ? 'good'
      : result.score >= 50
      ? 'ok'
      : 'low';

  return (
    <div className={`ats ats-${tone}`}>
      <div className="ats-head">
        <div className="ats-score">
          <span className="ats-num">{result.score}</span>
          <span className="ats-suffix">/100</span>
        </div>
        <div className="ats-text">
          <strong>ATS keyword match</strong>
          <span className="muted">
            {' '}
            — {result.matched.length} of {result.total} keywords found
          </span>
        </div>
      </div>
      {result.missing.length > 0 && (
        <details className="ats-details">
          <summary>Missing keywords ({result.missing.length})</summary>
          <div className="chip-row">
            {result.missing.map((k) => (
              <span key={k} className="chip chip-missing">
                {k}
              </span>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Consider weaving these in if they truthfully apply to your background.
          </p>
        </details>
      )}
      {result.matched.length > 0 && (
        <details className="ats-details">
          <summary>Matched keywords ({result.matched.length})</summary>
          <div className="chip-row">
            {result.matched.map((k) => (
              <span key={k} className="chip chip-matched">
                {k}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
