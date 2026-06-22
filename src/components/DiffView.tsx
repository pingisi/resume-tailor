import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { diffLines, diffWords, type Change } from 'diff';

interface Props {
  original: string;
  tailored: string;
  /** When provided, enables per-hunk accept/revert UI in "lines" mode. */
  onSave?: (merged: string) => void | Promise<void>;
}

type Mode = 'lines' | 'words';

/** A line-mode hunk consisting of contiguous removed and/or added chunks. */
interface Hunk {
  id: number;
  partIdxs: number[];
  removedText: string;
  addedText: string;
  decision: 'accept' | 'revert';
}

function buildHunks(parts: Change[]): Hunk[] {
  const out: Hunk[] = [];
  let i = 0;
  let id = 0;
  while (i < parts.length) {
    const p = parts[i];
    if (!p.added && !p.removed) {
      i++;
      continue;
    }
    const partIdxs: number[] = [];
    let removedText = '';
    let addedText = '';
    while (i < parts.length && (parts[i].added || parts[i].removed)) {
      partIdxs.push(i);
      if (parts[i].removed) removedText += parts[i].value;
      else addedText += parts[i].value;
      i++;
    }
    out.push({ id: id++, partIdxs, removedText, addedText, decision: 'accept' });
  }
  return out;
}

function merge(parts: Change[], hunks: Hunk[]): string {
  const hunkByPartIdx = new Map<number, Hunk>();
  for (const h of hunks) for (const idx of h.partIdxs) hunkByPartIdx.set(idx, h);
  const handled = new Set<number>();
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const h = hunkByPartIdx.get(i);
    if (!h) {
      out += p.value;
      continue;
    }
    if (handled.has(h.id)) continue;
    handled.add(h.id);
    out += h.decision === 'accept' ? h.addedText : h.removedText;
  }
  return out;
}

export function DiffView({ original, tailored, onSave }: Props) {
  const [mode, setMode] = useState<Mode>('lines');

  const parts = useMemo(() => {
    if (mode === 'lines') {
      return diffLines(original || '', tailored || '', { ignoreWhitespace: false });
    }
    return diffWords(original || '', tailored || '');
  }, [mode, original, tailored]);

  const [hunks, setHunks] = useState<Hunk[]>(() =>
    mode === 'lines' && onSave ? buildHunks(parts) : []
  );

  useEffect(() => {
    if (mode === 'lines' && onSave) setHunks(buildHunks(parts));
    else setHunks([]);
  }, [parts, mode, onSave]);

  const interactive = mode === 'lines' && !!onSave && hunks.length > 0;

  const partsToHunk = useMemo(() => {
    const m = new Map<number, Hunk>();
    if (!interactive) return m;
    for (const h of hunks) for (const idx of h.partIdxs) m.set(idx, h);
    return m;
  }, [hunks, interactive]);

  const changedCount = useMemo(
    () => hunks.filter((h) => h.decision === 'revert').length,
    [hunks]
  );

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

  const [saving, setSaving] = useState(false);

  function setDecision(id: number, decision: 'accept' | 'revert') {
    setHunks((prev) => prev.map((h) => (h.id === id ? { ...h, decision } : h)));
  }

  function acceptAll() {
    setHunks((prev) => prev.map((h) => ({ ...h, decision: 'accept' })));
  }

  function revertAll() {
    setHunks((prev) => prev.map((h) => ({ ...h, decision: 'revert' })));
  }

  async function save() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(merge(parts, hunks));
    } finally {
      setSaving(false);
    }
  }

  function renderChunk(p: Change, key: number): ReactNode {
    const cls = p.added ? 'diff-add' : p.removed ? 'diff-rem' : 'diff-eq';
    if (mode === 'words') {
      return (
        <span key={key} className={cls}>
          {p.value}
        </span>
      );
    }
    const lines = p.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return (
      <span key={key} className={cls}>
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
  }

  function renderHunkBlock(h: Hunk): ReactNode {
    const reverted = h.decision === 'revert';
    const chunks = h.partIdxs.map((i) => parts[i]);
    return (
      <div
        key={`h-${h.id}`}
        className={'diff-hunk' + (reverted ? ' reverted' : '')}
      >
        <div className="diff-hunk-bar">
          <span className="diff-hunk-label">
            {reverted ? 'Will revert to original' : 'Will keep tailored'}
          </span>
          <div className="diff-hunk-actions">
            <button
              type="button"
              className={'mini' + (h.decision === 'accept' ? ' on' : '')}
              onClick={() => setDecision(h.id, 'accept')}
              title="Keep the tailored version of this change"
            >
              ✓ Keep
            </button>
            <button
              type="button"
              className={'mini' + (h.decision === 'revert' ? ' on danger' : '')}
              onClick={() => setDecision(h.id, 'revert')}
              title="Revert this change back to the original"
            >
              ✗ Revert
            </button>
          </div>
        </div>
        <pre className="diff-hunk-body">
          {chunks.map((p, idx) => renderChunk(p, idx))}
        </pre>
      </div>
    );
  }

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

      {interactive && (
        <div className="diff-toolbar">
          <span className="muted">
            Reverted {changedCount} of {hunks.length} change{hunks.length === 1 ? '' : 's'}
          </span>
          <div className="row">
            <button type="button" onClick={acceptAll} disabled={changedCount === 0}>
              Keep all
            </button>
            <button
              type="button"
              onClick={revertAll}
              disabled={changedCount === hunks.length}
            >
              Revert all
            </button>
            <button
              type="button"
              className="primary"
              onClick={save}
              disabled={saving || changedCount === 0}
              title={
                changedCount === 0
                  ? 'No reverts to apply'
                  : 'Save the merged resume back to this application'
              }
            >
              {saving ? 'Saving…' : 'Save merged'}
            </button>
          </div>
        </div>
      )}

      {interactive ? (
        <div className="diff-hunks">
          {(() => {
            const blocks: ReactNode[] = [];
            const seenHunks = new Set<number>();
            for (let i = 0; i < parts.length; i++) {
              const h = partsToHunk.get(i);
              if (h) {
                if (!seenHunks.has(h.id)) {
                  seenHunks.add(h.id);
                  blocks.push(renderHunkBlock(h));
                }
              } else {
                blocks.push(
                  <pre key={`ctx-${i}`} className="diff-body diff-context">
                    {renderChunk(parts[i], i)}
                  </pre>
                );
              }
            }
            return blocks;
          })()}
        </div>
      ) : (
        <pre className="diff-body">
          {parts.map((p, i) => renderChunk(p, i))}
        </pre>
      )}
    </div>
  );
}
