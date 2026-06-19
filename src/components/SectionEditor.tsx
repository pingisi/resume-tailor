import { useEffect, useMemo, useState } from 'react';
import { joinSections, splitSections, type Section } from '../lib/sections';

interface Props {
  content: string;
  /** Called when the user clicks Save with the joined-back markdown */
  onSave: (next: string) => void | Promise<void>;
}

export function SectionEditor({ content, onSave }: Props) {
  const initial = useMemo(() => splitSections(content), [content]);
  const [sections, setSections] = useState<Section[]>(initial);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // reset internal state when content prop changes (e.g., regeneration)
  useEffect(() => {
    setSections(splitSections(content));
    setOpen({});
    setSavedAt(null);
  }, [content]);

  const dirty = useMemo(() => {
    return joinSections(sections).trim() !== content.trim();
  }, [sections, content]);

  function update(id: string, patch: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function move(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const out = [...prev];
      const [item] = out.splice(idx, 1);
      out.splice(target, 0, item);
      return out;
    });
  }

  function remove(id: string) {
    if (!confirm('Delete this section?')) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(joinSections(sections));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSections(splitSections(content));
    setSavedAt(null);
  }

  if (sections.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✏️</div>
        <p className="empty-state-title">Nothing to edit yet</p>
        <p className="empty-state-hint">Generate content first.</p>
      </div>
    );
  }

  return (
    <div className="section-editor">
      <ul className="section-list">
        {sections.map((s, i) => {
          const isOpen = open[s.id] ?? false;
          return (
            <li key={s.id} className="section-item">
              <div className="section-head">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))}
                >
                  <span className="section-chevron">{isOpen ? '▾' : '▸'}</span>
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => update(s.id, { title: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="section-title-input"
                    placeholder="Section title"
                  />
                </button>
                <div className="section-actions">
                  <button
                    type="button"
                    onClick={() => move(s.id, -1)}
                    disabled={i === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(s.id, 1)}
                    disabled={i === sections.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(s.id)}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
              {isOpen && (
                <textarea
                  value={s.body}
                  onChange={(e) => update(s.id, { body: e.target.value })}
                  rows={Math.min(20, Math.max(4, s.body.split('\n').length + 1))}
                  className="section-body"
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button className="primary" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save edits'}
        </button>
        <button onClick={reset} disabled={!dirty || saving}>
          Discard
        </button>
        {savedAt && !dirty && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        {dirty && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
