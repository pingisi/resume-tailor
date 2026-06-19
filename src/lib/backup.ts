import { saveAs } from 'file-saver';
import type { Application, StoredResume } from '../types';
import {
  bulkPutApplications,
  bulkPutResumes,
  clearApplications,
  clearResumes,
  listApplications,
  listResumes,
} from './storage';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  appVersion: string;
  resumes: StoredResume[];
  applications: Application[];
}

const APP_VERSION = '0.1.0';

export async function exportBackup(): Promise<void> {
  const [resumes, applications] = await Promise.all([
    listResumes(),
    listApplications(),
  ]);
  const payload: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    resumes,
    applications,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `resume-tailor-backup-${date}.json`);
}

export interface ImportStats {
  resumes: number;
  applications: number;
  mode: 'merge' | 'replace';
}

export async function importBackup(
  file: File,
  mode: 'merge' | 'replace'
): Promise<ImportStats> {
  const text = await file.text();
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (parsed?.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${parsed?.version ?? '?'} (expected ${BACKUP_VERSION}).`
    );
  }
  if (!Array.isArray(parsed.resumes) || !Array.isArray(parsed.applications)) {
    throw new Error('Backup is missing resumes or applications arrays.');
  }

  if (mode === 'replace') {
    await clearResumes();
    await clearApplications();
  }
  await bulkPutResumes(parsed.resumes);
  await bulkPutApplications(parsed.applications);

  return {
    resumes: parsed.resumes.length,
    applications: parsed.applications.length,
    mode,
  };
}
