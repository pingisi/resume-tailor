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
import { AtsScore } from './AtsScore';
import { DiffView } from './DiffView';

interface Props {
  resume: string;
  coverLetter: string;
  /** Original resume text for diff comparison. If absent, diff is hidden. */
  originalResume?: string;
  /** Job description for ATS scoring. If absent, ATS is hidden. */
  jobDescription?: string;
  /** When true, the panel renders even with partial / empty content (used while streaming) */
  streaming?: boolean;
}

type Tab = 'resume' | 'cover';
type Aux = 'preview' | 'ats' | 'diff';

export function OutputPanel({
  resume,
  coverLetter,
  originalResume,
  jobDescription,
  streaming,
}: Props) {
  const [tab, setTab] = useState<Tab>('resume');
  const [aux, setAux] = useState<Aux>('preview');
  const [copied, setCopied] = useState(false);
  const [templateId, setTemplateId] = useState<TemplateId>(getStoredTemplate());
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  const template = TEMPLATES[templateId];
  const active = tab === 'resume' ? resume : coverLetter;
  const baseName = tab === 'resume' ? 'tailored-resume' : 'cover-letter';
  const html = marked.parse(active || '') as string;

  const showAts = tab === 'resume' && !!jobDescription && !!resume;
  const showDiff = tab === 'resume' && !!originalResume && !!resume;

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
    void downloadPdf(baseName, active, template).finally(() => {
      setExporting(null);
    });
  }

  function exportDocx() {
    setExporting('docx');
    void downloadDocx(baseName, active, template).finally(() => {
      setExporting(null);
    });
  }

  const previewStyle: CSSProperties = {
    fontFamily: template.cssFont,
    ['--accent' as never]: template.accent,
  };

  // Reset aux to preview when switching to cover letter (no ATS/diff there)
  const effectiveAux: Aux =
    tab === 'cover' && aux !== 'preview' ? 'preview' : aux;

  return (
    <div className="card">
      <h2>
        3. Output
        {streaming && <span className="streaming-pill">streaming…</span>}
      </h2>
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

      {tab === 'resume' && (showAts || showDiff) && (
        <div className="aux-tabs">
          <button
            type="button"
            className={'aux-tab' + (effectiveAux === 'preview' ? ' active' : '')}
            onClick={() => setAux('preview')}
          >
            Preview
          </button>
          {showAts && (
            <button
              type="button"
              className={'aux-tab' + (effectiveAux === 'ats' ? ' active' : '')}
              onClick={() => setAux('ats')}
            >
              ATS score
            </button>
          )}
          {showDiff && (
            <button
              type="button"
              className={'aux-tab' + (effectiveAux === 'diff' ? ' active' : '')}
              onClick={() => setAux('diff')}
            >
              Diff
            </button>
          )}
        </div>
      )}

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

      {effectiveAux === 'preview' && (
        <div
          className={'preview preview-' + template.id}
          style={previewStyle}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {effectiveAux === 'ats' && jobDescription && (
        <AtsScore jobDescription={jobDescription} resume={resume} />
      )}
      {effectiveAux === 'diff' && originalResume && (
        <DiffView original={originalResume} tailored={resume} />
      )}

      <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={copy} disabled={!active}>
          {copied ? 'Copied!' : 'Copy text'}
        </button>
        <button onClick={() => downloadMarkdown(baseName, active)} disabled={!active}>
          Download .md
        </button>
        <button onClick={exportPdf} disabled={!active || exporting !== null}>
          {exporting === 'pdf' ? 'Building…' : 'Download .pdf'}
        </button>
        <button onClick={exportDocx} disabled={!active || exporting !== null}>
          {exporting === 'docx' ? 'Building…' : 'Download .docx'}
        </button>
      </div>
    </div>
  );
}
