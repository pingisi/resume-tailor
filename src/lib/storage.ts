import { openDB, type IDBPDatabase } from 'idb';
import type { StoredResume } from '../types';

const DB_NAME = 'resume-tailor';
const STORE = 'resumes';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveResume(fileName: string, text: string): Promise<void> {
  const db = await getDB();
  const record: StoredResume = {
    id: 'current',
    fileName,
    text,
    updatedAt: Date.now(),
  };
  await db.put(STORE, record);
}

export async function loadResume(): Promise<StoredResume | undefined> {
  const db = await getDB();
  return db.get(STORE, 'current');
}

export async function clearResume(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, 'current');
}
