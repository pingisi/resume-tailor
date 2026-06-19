import { useMemo, useState } from 'react';
import { diffLines, diffWords } from 'diff';

interface Props {
  original: string;
  tailored: string;
}

type Mode = 'lines' | 'words';

export function DiffView({ original, tailored }: Props) {
  const [mode, setMode] = useState<Mode>('lines');

  const parts = useMemo(() => {
    if (mode === 'lines') {
      return diffLines(original || '', tailored || '', { ignoreWhitespace: false });
    }
    return diffWords(original || '', tailored || '');
  }, [mode, original, tailored]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const p of parts) {
      const len =
        mode === 'lines'
          ? (p.value.match(/\n/g)?.length ?? 0) + (p.value.endsWith('\n') ? 0 : 1)
          : (p.value.match(/\S+/g)?.length ?? 0);
      if (p.added) added += len;
      else if (p.removed) removed += len;
    }
    return { added, removed };
  }, [parts, mode]);

  return (
    <div className="diff">
      <div className="diff-head">
        <div>
          <strong>Diff vs. original resume</strong>{' '}
          <span className="muted">
            (+{stats.added} {mode === 'lines' ? 'lines' : 'words'} / -{stats.removed})
          </span>
        </div>
        <div className="diff-mode">
          <button
            type="button"
            className={'tab' + (mode === 'lines' ? ' active' : '')}
            onClick={() => setMode('lines')}
          >
            Lines
          </button>
          <button
            type="button"
            className={'tab' + (mode === 'words' ? ' active' : '')}
            onClick={() => setMode('words')}
          >
            Words
          </button>
        </div>
      </div>
      <pre className="diff-body">
        {parts.map((p, i) => {
          const cls = p.added ? 'diff-add' : p.removed ? 'diff-rem' : 'diff-eq';
          if (mode === 'words') {
            return (
              <span key={i} className={cls}>
                {p.value}
              </span>
            );
          }
          // lines: prefix with +/- per line
          const lines = p.value.split('\n');
          // diffLines returns each chunk usually ending with newline; drop trailing empty
          if (lines[lines.length - 1] === '') lines.pop();
          return (
            <span key={i} className={cls}>
              {lines.map((ln, j) => (
                <span key={j} className="diff-line">
                  <span className="diff-marker">
                    {p.added ? '+' : p.removed ? '-' : ' '}
                  </span>
                  <span>{ln}</span>
                  {'\n'}
                </span>
              ))}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
