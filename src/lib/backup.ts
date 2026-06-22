import { saveAs } from 'file-saver';
import type { Application, Profile, StoredResume } from '../types';
import {
  bulkPutApplications,
  bulkPutResumes,
  clearApplications,
  clearProfile,
  clearResumes,
  getProfile,
  listApplications,
  listResumes,
  saveProfile,
} from './storage';

export const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2];

export interface BackupFile {
  version: number;
  exportedAt: string;
  appVersion: string;
  resumes: StoredResume[];
  applications: Application[];
  profile?: Profile | null;
}

const APP_VERSION = '0.2.0';

export async function exportBackup(): Promise<void> {
  const [resumes, applications, profile] = await Promise.all([
    listResumes(),
    listApplications(),
    getProfile(),
  ]);
  const payload: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    resumes,
    applications,
    profile: profile ?? null,
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
  profile: boolean;
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
  if (!SUPPORTED_VERSIONS.includes(parsed?.version)) {
    throw new Error(
      `Unsupported backup version ${parsed?.version ?? '?'} (expected ${SUPPORTED_VERSIONS.join(' or ')}).`
    );
  }
  if (!Array.isArray(parsed.resumes) || !Array.isArray(parsed.applications)) {
    throw new Error('Backup is missing resumes or applications arrays.');
  }

  if (mode === 'replace') {
    await clearResumes();
    await clearApplications();
    await clearProfile();
  }
  await bulkPutResumes(parsed.resumes);
  await bulkPutApplications(parsed.applications);

  const hasProfile = !!parsed.profile && typeof parsed.profile === 'object';
  if (hasProfile) {
    await saveProfile(parsed.profile as Profile);
  }

  return {
    resumes: parsed.resumes.length,
    applications: parsed.applications.length,
    profile: hasProfile,
    mode,
  };
}
