interface Props {
  value: string;
  onChange: (v: string) => void;
  tone: string;
  onToneChange: (v: string) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  busy: boolean;
}

export function JobInput({
  value,
  onChange,
  tone,
  onToneChange,
  onGenerate,
  canGenerate,
  busy,
}: Props) {
  return (
    <div className="card">
      <h2>2. Job description</h2>
      <textarea
        rows={10}
        placeholder="Paste the job description here…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="row" style={{ marginTop: '0.75rem' }}>
        <label>
          Tone:&nbsp;
          <select value={tone} onChange={(e) => onToneChange(e.target.value)}>
            <option value="professional">Professional</option>
            <option value="enthusiastic">Enthusiastic</option>
            <option value="concise">Concise</option>
            <option value="formal">Formal</option>
          </select>
        </label>
        <button
          className="primary"
          onClick={onGenerate}
          disabled={!canGenerate || busy}
        >
          {busy ? 'Generating…' : 'Generate resume + cover letter'}
        </button>
      </div>
    </div>
  );
}
