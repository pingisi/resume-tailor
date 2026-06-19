import { useState, type CSSProperties } from 'react';
import { marked } from 'marked';
import { downloadMarkdown, downloadPdf, downloadDocx } from '../lib/exporters';
import {
  TEMPLATES,
  TEMPLATE_LIST,
  getStoredTemplate,
  setStoredTemplate,
  type TemplateId,
} from '../lib/templates';

interface Props {
  resume: string;
  coverLetter: string;
}

type Tab = 'resume' | 'cover';

export function OutputPanel({ resume, coverLetter }: Props) {
  const [tab, setTab] = useState<Tab>('resume');
  const [copied, setCopied] = useState(false);
  const [templateId, setTemplateId] = useState<TemplateId>(getStoredTemplate());
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  const template = TEMPLATES[templateId];
  const active = tab === 'resume' ? resume : coverLetter;
  const baseName = tab === 'resume' ? 'tailored-resume' : 'cover-letter';
  const html = marked.parse(active) as string;

  function chooseTemplate(id: TemplateId) {
    setTemplateId(id);
    setStoredTemplate(id);
  }

  async function copy() {
    await navigator.clipboard.writeText(active);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportPdf() {
    setExporting('pdf');
    try {
      downloadPdf(baseName, active, template);
    } finally {
      setExporting(null);
    }
  }

  async function exportDocx() {
    setExporting('docx');
    try {
      await downloadDocx(baseName, active, template);
    } finally {
      setExporting(null);
    }
  }

  const previewStyle: CSSProperties = {
    fontFamily: template.cssFont,
    // CSS variable consumed by .preview-* heading styles
    ['--accent' as never]: template.accent,
  };

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

      <div className="row template-row">
        <span className="template-label">Template:</span>
        <div className="template-pills">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              className={'template-pill' + (t.id === templateId ? ' active' : '')}
              onClick={() => chooseTemplate(t.id)}
              title={t.description}
              type="button"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div
        className={'preview preview-' + template.id}
        style={previewStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={copy}>{copied ? 'Copied!' : 'Copy text'}</button>
        <button onClick={() => downloadMarkdown(baseName, active)}>
          Download .md
        </button>
        <button onClick={exportPdf} disabled={exporting !== null}>
          {exporting === 'pdf' ? 'Building…' : 'Download .pdf'}
        </button>
        <button onClick={exportDocx} disabled={exporting !== null}>
          {exporting === 'docx' ? 'Building…' : 'Download .docx'}
        </button>
      </div>
    </div>
  );
}
