import { useState, useRef, type CSSProperties } from 'react';
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
import { scoreFit } from '../api/fitScore';
import type { FitScoreResponse } from '../types';

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
  /** When provided, the Fit check tab shows an "Auto-improve to 10/10" button
   *  that regenerates the resume with feedback from the previous fit score. The
   *  callback must regenerate, update the resume prop, and resolve with the new
   *  resume + cover letter so the loop can re-score. */
  onAutoImprove?: (
    feedback: FitScoreResponse
  ) => Promise<{ resume: string; coverLetter: string }>;
}

type Tab = 'resume' | 'cover';
type Aux = 'preview' | 'ats' | 'fit' | 'diff' | 'edit';

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
  onAutoImprove,
}: Props) {
  const [tab, setTab] = useState<Tab>('resume');
  const [aux, setAux] = useState<Aux>('preview');
  const [copied, setCopied] = useState(false);
  const [templateId, setTemplateId] = useState<TemplateId>(getStoredTemplate());
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [fitResult, setFitResult] = useState<FitScoreResponse | null>(null);
  const [fitChecking, setFitChecking] = useState(false);
  const [fitError, setFitError] = useState<string | null>(null);
  const [autoImproving, setAutoImproving] = useState(false);
  const [autoImproveStatus, setAutoImproveStatus] = useState<string | null>(null);
  const [autoImproveHistory, setAutoImproveHistory] = useState<number[]>([]);
  const autoImproveCancelRef = useRef(false);

  const template = TEMPLATES[templateId];
  const active = tab === 'resume' ? resume : coverLetter;
  const baseName =
    (tab === 'resume' ? 'Resume' : 'Cover-Letter') + buildSuffix(role, company);
  const html = marked.parse(active || '') as string;

  const showAts = tab === 'resume' && !!jobDescription && !!resume;
  const showFit = tab === 'resume' && !!jobDescription && !!resume && !streaming;
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
    tab === 'cover' && (aux === 'ats' || aux === 'fit' || aux === 'diff') ? 'preview' : aux;

  const showEdit = !!onEdit && !streaming && !!active;

  async function runFitCheck() {
    if (!resume || !jobDescription) return;
    setFitChecking(true);
    setFitError(null);
    setFitResult(null);
    setAutoImproveStatus(null);
    setAutoImproveHistory([]);
    try {
      const r = await scoreFit({
        resumeText: resume,
        jobDescription,
        company: company || undefined,
        role: role || undefined,
      });
      setFitResult(r);
    } catch (e) {
      setFitError(e instanceof Error ? e.message : 'Fit check failed.');
    } finally {
      setFitChecking(false);
    }
  }

  const MAX_AUTO_IMPROVE_ITERATIONS = 5;

  async function runAutoImprove() {
    if (!fitResult || !onAutoImprove || !jobDescription) return;
    if (fitResult.score >= 10) return;
    autoImproveCancelRef.current = false;
    setAutoImproving(true);
    setFitError(null);
    setAutoImproveHistory([fitResult.score]);

    let current = fitResult;
    try {
      for (let i = 1; i <= MAX_AUTO_IMPROVE_ITERATIONS; i++) {
        if (autoImproveCancelRef.current) {
          setAutoImproveStatus(`Cancelled at iteration ${i}.`);
          break;
        }
        setAutoImproveStatus(`Iteration ${i}/${MAX_AUTO_IMPROVE_ITERATIONS}: regenerating with feedback…`);
        const next = await onAutoImprove(current);
        if (autoImproveCancelRef.current) {
          setAutoImproveStatus(`Cancelled at iteration ${i}.`);
          break;
        }
        setAutoImproveStatus(`Iteration ${i}/${MAX_AUTO_IMPROVE_ITERATIONS}: scoring new resume…`);
        const newFit = await scoreFit({
          resumeText: next.resume,
          jobDescription,
          company: company || undefined,
          role: role || undefined,
        });
        setFitResult(newFit);
        setAutoImproveHistory((h) => [...h, newFit.score]);

        if (newFit.score >= 10) {
          setAutoImproveStatus(`Reached 10/10 in ${i} iteration(s). Done.`);
          break;
        }
        if (newFit.score <= current.score) {
          setAutoImproveStatus(
            `Score plateaued at ${newFit.score}/10 after iteration ${i}. Stopping (no improvement).`
          );
          break;
        }
        if (i === MAX_AUTO_IMPROVE_ITERATIONS) {
          setAutoImproveStatus(
            `Hit max ${MAX_AUTO_IMPROVE_ITERATIONS} iterations at ${newFit.score}/10. Stopping.`
          );
          break;
        }
        current = newFit;
      }
    } catch (e) {
      setFitError(e instanceof Error ? e.message : 'Auto-improve failed.');
    } finally {
      setAutoImproving(false);
    }
  }

  function cancelAutoImprove() {
    autoImproveCancelRef.current = true;
  }

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

      {tab === 'resume' && (showAts || showFit || showDiff || showEdit) && (
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
          {showFit && (
            <button
              type="button"
              className={'aux-tab' + (effectiveAux === 'fit' ? ' active' : '')}
              onClick={() => setAux('fit')}
            >
              Fit check
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
      {effectiveAux === 'fit' && jobDescription && resume && (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>AI Fit check on tailored resume</strong>
              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                Asks Gemini to grade the generated resume against the JD (1-10) and surface remaining gaps.
              </p>
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => void runFitCheck()}
              disabled={fitChecking}
            >
              {fitChecking ? 'Checking…' : fitResult ? 'Re-check' : 'Run fit check'}
            </button>
          </div>
          {fitError && (
            <p className="error" style={{ marginTop: '0.5rem' }}>{fitError}</p>
          )}
          {fitResult && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background:
                  fitResult.score >= 7
                    ? 'rgba(34, 139, 34, 0.08)'
                    : fitResult.score >= 4
                      ? 'rgba(204, 153, 0, 0.08)'
                      : 'rgba(204, 0, 0, 0.08)',
              }}
            >
              <strong>
                Fit score: {fitResult.score}/10
                {fitResult.score >= 7
                  ? ' — strong fit'
                  : fitResult.score >= 4
                    ? ' — borderline'
                    : ' — weak'}
              </strong>
              {fitResult.verdict && (
                <p style={{ margin: '0.25rem 0 0.5rem' }}>{fitResult.verdict}</p>
              )}
              {fitResult.reasonsToApply.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Strengths</strong>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                    {fitResult.reasonsToApply.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {fitResult.gapsToAddress.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Remaining gaps</strong>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                    {fitResult.gapsToAddress.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Auto-improve loop controls */}
              {onAutoImprove && fitResult.score < 10 && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {!autoImproving ? (
                    <button
                      className="primary"
                      type="button"
                      onClick={() => void runAutoImprove()}
                      disabled={fitChecking}
                      title={`Iteratively regenerates the resume with feedback up to ${MAX_AUTO_IMPROVE_ITERATIONS} times until the fit score hits 10/10.`}
                    >
                      Auto-improve to 10/10 (up to {MAX_AUTO_IMPROVE_ITERATIONS} iterations)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={cancelAutoImprove}
                    >
                      Cancel auto-improve
                    </button>
                  )}
                  <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    Each iteration burns 1 generate call + 1 fit-score call from your daily quota.
                  </p>
                </div>
              )}
              {autoImproveStatus && (
                <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {autoImproveStatus}
                </p>
              )}
              {autoImproveHistory.length > 1 && (
                <p className="muted" style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                  Score history: {autoImproveHistory.join(' → ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {effectiveAux === 'diff' && originalResume && (
        <DiffView
          original={originalResume}
          tailored={resume}
          onSave={
            onEdit
              ? (merged) => {
                  void onEdit('resume', merged);
                }
              : undefined
          }
        />
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
