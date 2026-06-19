import { useState } from 'react';
import { marked } from 'marked';
import { downloadMarkdown, downloadPdf, downloadDocx } from '../lib/exporters';

interface Props {
  resume: string;
  coverLetter: string;
}

type Tab = 'resume' | 'cover';

export function OutputPanel({ resume, coverLetter }: Props) {
  const [tab, setTab] = useState<Tab>('resume');
  const [copied, setCopied] = useState(false);

  const active = tab === 'resume' ? resume : coverLetter;
  const baseName = tab === 'resume' ? 'tailored-resume' : 'cover-letter';
  const html = marked.parse(active) as string;

  async function copy() {
    await navigator.clipboard.writeText(active);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card">
      <h2>3. Output</h2>
      <div className="tabs">
        <button
          className={tab === 'resume' ? 'tab active' : 'tab'}
          onClick={() => setTab('resume')}
        >
          Resume
        </button>
        <button
          className={tab === 'cover' ? 'tab active' : 'tab'}
          onClick={() => setTab('cover')}
        >
          Cover letter
        </button>
      </div>

      <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={copy}>{copied ? 'Copied!' : 'Copy text'}</button>
        <button onClick={() => downloadMarkdown(baseName, active)}>
          Download .md
        </button>
        <button onClick={() => downloadPdf(baseName, active)}>
          Download .pdf
        </button>
        <button onClick={() => downloadDocx(baseName, active)}>
          Download .docx
        </button>
      </div>
    </div>
  );
}
