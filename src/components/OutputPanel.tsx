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
import { SectionEditor } from './SectionEditor';

interface Props {
  resume: string;
  coverLetter: string;
  /** Original resume text for diff comparison. If absent, diff is hidden. */
  originalResume?: string;
  /** Job description for ATS scoring. If absent, ATS is hidden. */
  jobDescription?: string;
  /** When true, the panel renders even with partial / empty content (used while streaming) */
  streaming?: boolean;
  /** When provided, an Edit tab lets the user modify resume/cover sections in place */
  onEdit?: (kind: 'resume' | 'cover', next: string) => void | Promise<void>;
  /** Optional metadata used to build descriptive download filenames */
  company?: string;
  role?: string;
}

type Tab = 'resume' | 'cover';
type Aux = 'preview' | 'ats' | 'diff' | 'edit';

function slug(s: string | undefined): string {
  if (!s) return '';
  return s
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSuffix(role?: string, company?: string): string {
  const r = slug(role);
  const c = slug(company);
  if (r && c) return `_${r}_${c}`;
  if (r) return `_${r}`;
  if (c) return `_${c}`;
  return '';
}

export function OutputPanel({
  resume,
  coverLetter,
  originalResume,
  jobDescription,
  streaming,
  onEdit,
  company,
  role,
}: Props) {
  const [tab, setTab] = useState<Tab>('resume');
  const [aux, setAux] = useState<Aux>('preview');
  const [copied, setCopied] = useState(false);
  const [templateId, setTemplateId] = useState<TemplateId>(getStoredTemplate());
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  const template = TEMPLATES[templateId];
  const active = tab === 'resume' ? resume : coverLetter;
  const baseName =
    (tab === 'resume' ? 'Resume' : 'Cover-Letter') + buildSuffix(role, company);
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
    tab === 'cover' && (aux === 'ats' || aux === 'diff') ? 'preview' : aux;

  const showEdit = !!onEdit && !streaming && !!active;

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

      {tab === 'resume' && (showAts || showDiff || showEdit) && (
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
          {showEdit && (
            <button
              type="button"
              className={'aux-tab' + (effectiveAux === 'edit' ? ' active' : '')}
              onClick={() => setAux('edit')}
            >
              Edit
            </button>
          )}
        </div>
      )}

      {tab === 'cover' && showEdit && (
        <div className="aux-tabs">
          <button
            type="button"
            className={'aux-tab' + (effectiveAux === 'preview' ? ' active' : '')}
            onClick={() => setAux('preview')}
          >
            Preview
          </button>
          <button
            type="button"
            className={'aux-tab' + (effectiveAux === 'edit' ? ' active' : '')}
            onClick={() => setAux('edit')}
          >
            Edit
          </button>
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
      {effectiveAux === 'edit' && onEdit && (
        <SectionEditor
          content={active}
          onSave={(next) => onEdit(tab, next)}
        />
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
