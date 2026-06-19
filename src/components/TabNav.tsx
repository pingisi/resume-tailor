export type TabKey = 'new' | 'applications' | 'resumes' | 'analytics';

interface Props {
  active: TabKey;
  onChange: (key: TabKey) => void;
  applicationCount: number;
  resumeCount: number;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'new', label: 'New application' },
  { key: 'applications', label: 'Applications' },
  { key: 'resumes', label: 'Resumes' },
  { key: 'analytics', label: 'Analytics' },
];

export function TabNav({ active, onChange, applicationCount, resumeCount }: Props) {
  return (
    <nav className="tabnav">
      {TABS.map((t) => {
        const count =
          t.key === 'applications'
            ? applicationCount
            : t.key === 'resumes'
            ? resumeCount
            : null;
        return (
          <button
            key={t.key}
            className={t.key === active ? 'tabnav-btn active' : 'tabnav-btn'}
            onClick={() => onChange(t.key)}
          >
            {t.label}
            {count !== null && <span className="tabnav-count">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
