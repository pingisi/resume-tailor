import { useEffect, useMemo, useRef, useState } from 'react';
import type { Application } from '../types';

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  /** Bigger = appears first when no query is typed. */
  weight?: number;
  /** Lowercase haystack used for matching when present, otherwise label is used. */
  search?: string;
  group: 'Navigation' | 'Application' | 'Settings' | 'Help';
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  applications: Application[];
  onNew: () => void;
  onApplications: () => void;
  onResumes: () => void;
  onProfile: () => void;
  onAnalytics: () => void;
  onOpenApplication: (id: string) => void;
  onToggleTheme: () => void;
  onHelp: () => void;
}

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 1;
  if (h.includes(n)) return 100 - h.indexOf(n);
  // subsequence match
  let i = 0;
  let score = 0;
  for (const ch of h) {
    if (ch === n[i]) {
      score += 1;
      i++;
      if (i === n.length) return score;
    }
  }
  return 0;
}

export function CommandPalette({
  open,
  onClose,
  applications,
  onNew,
  onApplications,
  onResumes,
  onProfile,
  onAnalytics,
  onOpenApplication,
  onToggleTheme,
  onHelp,
}: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<CommandAction[]>(() => {
    const base: CommandAction[] = [
      { id: 'nav-new', label: 'New application', hint: 'n', group: 'Navigation', weight: 90, run: onNew },
      { id: 'nav-apps', label: 'Applications', hint: 'a', group: 'Navigation', weight: 89, run: onApplications },
      { id: 'nav-resumes', label: 'Resumes', hint: 'r', group: 'Navigation', weight: 88, run: onResumes },
      { id: 'nav-profile', label: 'Profile', hint: 'p', group: 'Navigation', weight: 87, run: onProfile },
      { id: 'nav-analytics', label: 'Analytics', hint: 's', group: 'Navigation', weight: 86, run: onAnalytics },
      { id: 'set-theme', label: 'Toggle theme (light / dark / system)', group: 'Settings', weight: 50, run: onToggleTheme },
      { id: 'help-shortcuts', label: 'Show keyboard shortcuts', hint: '?', group: 'Help', weight: 40, run: onHelp },
    ];
    for (const a of applications) {
      const parts = [a.name, a.company, a.role].filter(Boolean).join(' · ');
      base.push({
        id: `app-${a.id}`,
        label: `Open: ${a.name || '(unnamed)'}`,
        hint: [a.role, a.company].filter(Boolean).join(' @ ') || a.status,
        group: 'Application',
        weight: 30,
        search: parts.toLowerCase(),
        run: () => onOpenApplication(a.id),
      });
    }
    return base;
  }, [
    applications,
    onNew,
    onApplications,
    onResumes,
    onProfile,
    onAnalytics,
    onToggleTheme,
    onHelp,
    onOpenApplication,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return [...actions].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 30);
    }
    const scored = actions
      .map((a) => ({
        a,
        s: Math.max(fuzzyScore(a.search ?? a.label.toLowerCase(), query), fuzzyScore(a.label, query)),
      }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 30);
    return scored.map((x) => x.a);
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = filtered[active];
        if (sel) {
          onClose();
          sel.run();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  // Group while preserving the filtered order: rebuild groups in the order their first item appears.
  const groups: { name: string; entries: { action: CommandAction; idx: number }[] }[] = [];
  filtered.forEach((a, idx) => {
    let g = groups.find((x) => x.name === a.group);
    if (!g) {
      g = { name: a.group, entries: [] };
      groups.push(g);
    }
    g.entries.push({ action: a, idx });
  });

  return (
    <div className="cmdk-backdrop" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a command, or search applications…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="cmdk-input"
          aria-label="Command palette"
        />
        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="cmdk-empty">No matches.</div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="cmdk-group">
                <div className="cmdk-group-name">{g.name}</div>
                {g.entries.map(({ action, idx }) => (
                  <div
                    key={action.id}
                    data-idx={idx}
                    className={'cmdk-item' + (idx === active ? ' active' : '')}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => {
                      onClose();
                      action.run();
                    }}
                  >
                    <span className="cmdk-label">{action.label}</span>
                    {action.hint && <span className="cmdk-hint">{action.hint}</span>}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
