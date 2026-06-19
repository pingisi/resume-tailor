import { useState } from 'react';
import {
  deleteResume,
  renameResume,
  saveNewResume,
  setDefaultResume,
} from '../lib/storage';
import type { StoredResume } from '../types';
import { ResumeFilePicker } from './ResumeFilePicker';

interface Props {
  resumes: StoredResume[];
  onChange: () => void | Promise<void>;
}

export function ResumeManager({ resumes, onChange }: Props) {
  const [pendingName, setPendingName] = useState('');
  const [pendingParsed, setPendingParsed] =
    useState<{ text: string; fileName: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);

  async function handleParsed(text: string, fileName: string) {
    setPendingParsed({ text, fileName });
    if (!pendingName) setPendingName(suggestName(fileName));
  }

  async function handleSaveNew() {
    if (!pendingParsed) return;
    await saveNewResume(
      pendingName || suggestName(pendingParsed.fileName),
      pendingParsed.fileName,
      pendingParsed.text
    );
    setPendingParsed(null);
    setPendingName('');
    await onChange();
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    await renameResume(id, editingName.trim());
    setEditingId(null);
    setEditingName('');
    await onChange();
  }

  async function handleDelete(r: StoredResume) {
    const ok = confirm(`Delete resume "${r.name}"? This cannot be undone.`);
    if (!ok) return;
    await deleteResume(r.id);
    await onChange();
  }

  async function handleSetDefault(id: string) {
    await setDefaultResume(id);
    await onChange();
  }

  const viewing = viewingId ? resumes.find((r) => r.id === viewingId) : null;

  return (
    <div className="card">
      <h2>Resumes</h2>
      <p className="muted">
        Manage your base resumes. The <strong>default</strong> is pre-selected
        when starting a new application.
      </p>

      <div className="upload-row">
        <ResumeFilePicker label="Upload new resume" onParsed={handleParsed} />
        {pendingParsed && (
          <div className="upload-pending">
            <input
              type="text"
              placeholder="Name this resume (e.g. Engineering)"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
            />
            <button className="primary" onClick={handleSaveNew}>
              Save
            </button>
            <button
              onClick={() => {
                setPendingParsed(null);
                setPendingName('');
              }}
            >
              Cancel
            </button>
            <span className="muted">
              File: <strong>{pendingParsed.fileName}</strong>
            </span>
          </div>
        )}
      </div>

      {resumes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p className="empty-state-title">No resumes yet</p>
          <p className="empty-state-hint">
            Upload a PDF, DOCX, or TXT above to get started.
          </p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>File</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resumes.map((r) => (
              <tr key={r.id}>
                <td>
                  {editingId === r.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRename(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(r.id);
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingName('');
                        }
                      }}
                    />
                  ) : (
                    <>
                      <strong
                        className="clickable"
                        onClick={() => {
                          setEditingId(r.id);
                          setEditingName(r.name);
                        }}
                        title="Click to rename"
                      >
                        {r.name}
                      </strong>
                      {r.isDefault && (
                        <span className="badge-default">Default</span>
                      )}
                    </>
                  )}
                </td>
                <td className="muted">{r.fileName}</td>
                <td className="muted">{formatDate(r.updatedAt)}</td>
                <td className="row-actions">
                  <button onClick={() => setViewingId(r.id)}>View</button>
                  {!r.isDefault && (
                    <button onClick={() => handleSetDefault(r.id)}>
                      Set default
                    </button>
                  )}
                  <button className="danger" onClick={() => handleDelete(r)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewingId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{viewing.name}</h3>
              <button onClick={() => setViewingId(null)}>Close</button>
            </div>
            <pre className="resume-text">{viewing.text}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function suggestName(fileName: string): string {
  return fileName.replace(/\.(pdf|docx|txt)$/i, '').replace(/[-_]/g, ' ').trim();
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
