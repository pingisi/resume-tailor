import { openDB, type IDBPDatabase } from 'idb';
import type {
  Application,
  ApplicationStatus,
  Profile,
  StoredResume,
} from '../types';

const DB_NAME = 'resume-tailor';
const DB_VERSION = 3;
const RESUMES = 'resumes';
const APPLICATIONS = 'applications';
const PROFILE = 'profile';
const PROFILE_KEY = 'me';

let dbPromise: Promise<IDBPDatabase> | null = null;

function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore(RESUMES, { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          // Migrate single resume at id='current' to multi-resume shape
          if (db.objectStoreNames.contains(RESUMES)) {
            const store = tx.objectStore(RESUMES);
            const existing = (await store.get('current')) as
              | { id: string; fileName?: string; text?: string; updatedAt?: number }
              | undefined;
            if (existing) {
              await store.delete('current');
              const now = existing.updatedAt ?? Date.now();
              const migrated: StoredResume = {
                id: uuid(),
                name: 'My resume',
                fileName: existing.fileName ?? 'resume',
                text: existing.text ?? '',
                isDefault: true,
                createdAt: now,
                updatedAt: now,
              };
              await store.put(migrated);
            }
          }
          if (!db.objectStoreNames.contains(APPLICATIONS)) {
            const apps = db.createObjectStore(APPLICATIONS, { keyPath: 'id' });
            apps.createIndex('createdAt', 'createdAt');
            apps.createIndex('status', 'status');
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(PROFILE)) {
            db.createObjectStore(PROFILE);
          }
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Resumes ----------

export async function listResumes(): Promise<StoredResume[]> {
  const db = await getDB();
  const all = (await db.getAll(RESUMES)) as StoredResume[];
  return all.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (b.isDefault && !a.isDefault) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function getResume(id: string): Promise<StoredResume | undefined> {
  const db = await getDB();
  return db.get(RESUMES, id) as Promise<StoredResume | undefined>;
}

export async function getDefaultResume(): Promise<StoredResume | undefined> {
  const all = await listResumes();
  return all.find((r) => r.isDefault) ?? all[0];
}

export async function saveNewResume(
  name: string,
  fileName: string,
  text: string
): Promise<StoredResume> {
  const db = await getDB();
  const all = (await db.getAll(RESUMES)) as StoredResume[];
  const now = Date.now();
  const record: StoredResume = {
    id: uuid(),
    name: name.trim() || 'Untitled resume',
    fileName,
    text,
    isDefault: all.length === 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.put(RESUMES, record);
  return record;
}

export async function renameResume(id: string, name: string): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(RESUMES, id)) as StoredResume | undefined;
  if (!existing) return;
  existing.name = name.trim() || existing.name;
  existing.updatedAt = Date.now();
  await db.put(RESUMES, existing);
}

export async function setDefaultResume(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(RESUMES, 'readwrite');
  const store = tx.objectStore(RESUMES);
  const all = (await store.getAll()) as StoredResume[];
  for (const r of all) {
    const shouldBeDefault = r.id === id;
    if (Boolean(r.isDefault) !== shouldBeDefault) {
      r.isDefault = shouldBeDefault;
      r.updatedAt = Date.now();
      await store.put(r);
    }
  }
  await tx.done;
}

export async function deleteResume(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(RESUMES, 'readwrite');
  const store = tx.objectStore(RESUMES);
  const target = (await store.get(id)) as StoredResume | undefined;
  await store.delete(id);
  if (target?.isDefault) {
    const remaining = (await store.getAll()) as StoredResume[];
    const next = remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (next) {
      next.isDefault = true;
      next.updatedAt = Date.now();
      await store.put(next);
    }
  }
  await tx.done;
}

// ---------- Applications ----------

export async function listApplications(): Promise<Application[]> {
  const db = await getDB();
  const all = (await db.getAll(APPLICATIONS)) as Application[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getApplication(
  id: string
): Promise<Application | undefined> {
  const db = await getDB();
  return db.get(APPLICATIONS, id) as Promise<Application | undefined>;
}

export async function saveApplication(app: Application): Promise<void> {
  const db = await getDB();
  await db.put(APPLICATIONS, app);
}

export async function deleteApplication(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(APPLICATIONS, id);
}

export async function updateApplication(
  id: string,
  patch: Partial<Omit<Application, 'id' | 'createdAt'>>
): Promise<Application | undefined> {
  const db = await getDB();
  const existing = (await db.get(APPLICATIONS, id)) as Application | undefined;
  if (!existing) return undefined;
  const merged: Application = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  if (
    patch.status &&
    patch.status !== 'draft' &&
    !existing.appliedAt &&
    (patch.status === 'applied' ||
      patch.status === 'interview' ||
      patch.status === 'offer' ||
      patch.status === 'rejected')
  ) {
    merged.appliedAt = Date.now();
  }
  await db.put(APPLICATIONS, merged);
  return merged;
}

export function makeApplicationId(): string {
  return uuid();
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'draft',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

// ---------- Bulk / backup ----------

export async function clearResumes(): Promise<void> {
  const db = await getDB();
  await db.clear(RESUMES);
}

export async function clearApplications(): Promise<void> {
  const db = await getDB();
  await db.clear(APPLICATIONS);
}

export async function bulkPutResumes(items: StoredResume[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(RESUMES, 'readwrite');
  const store = tx.objectStore(RESUMES);
  for (const r of items) await store.put(r);
  await tx.done;
}

export async function bulkPutApplications(items: Application[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(APPLICATIONS, 'readwrite');
  const store = tx.objectStore(APPLICATIONS);
  for (const a of items) await store.put(a);
  await tx.done;
}

// ---------- Profile ----------

export async function getProfile(): Promise<Profile | undefined> {
  const db = await getDB();
  return (await db.get(PROFILE, PROFILE_KEY)) as Profile | undefined;
}

export async function saveProfile(p: Profile): Promise<void> {
  const db = await getDB();
  await db.put(PROFILE, { ...p, updatedAt: Date.now() }, PROFILE_KEY);
}

export async function clearProfile(): Promise<void> {
  const db = await getDB();
  await db.delete(PROFILE, PROFILE_KEY);
}
