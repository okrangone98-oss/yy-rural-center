import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const FIREBASE_OPERATION_TIMEOUT_MS = Number(process.env.FIREBASE_OPERATION_TIMEOUT_MS || '8000');

function normalizePrivateKey(value?: string | null) {
  return value?.replace(/\\n/g, '\n').trim() || '';
}

function parseServiceAccountJson(jsonText: string): FirebaseAdminConfig | null {
  const parsed = JSON.parse(jsonText) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  const projectId = parsed.project_id?.trim() || '';
  const clientEmail = parsed.client_email?.trim() || '';
  const privateKey = normalizePrivateKey(parsed.private_key);

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

function loadServiceAccountFromPath(serviceAccountPath: string) {
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);
  const jsonText = readFileSync(resolvedPath, 'utf-8');
  return parseServiceAccountJson(jsonText);
}

function getFirebaseConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!serviceAccountPath) {
    return null;
  }

  return loadServiceAccountFromPath(serviceAccountPath);
}

export function getFirebaseStorageBucketName() {
  const config = getFirebaseConfig();
  if (!config) {
    throw new Error('Firebase Admin credentials are not configured.');
  }

  return getFirebaseStorageBucketCandidates()[0];
}

export function getFirebaseStorageBucketCandidates() {
  const config = getFirebaseConfig();
  if (!config) {
    throw new Error('Firebase Admin credentials are not configured.');
  }

  const configured = (process.env.FIREBASE_STORAGE_BUCKET || '').trim();
  return Array.from(
    new Set(
      [configured, `${config.projectId}.appspot.com`, `${config.projectId}.firebasestorage.app`].filter(Boolean),
    ),
  );
}

export function isFirebaseMirrorEnabled() {
  return !!getFirebaseConfig();
}

export function getFirebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const config = getFirebaseConfig();
  if (!config) {
    throw new Error('Firebase Admin credentials are not configured.');
  }

  return initializeApp({
    credential: cert(config),
    projectId: config.projectId,
    storageBucket: getFirebaseStorageBucketName(),
  });
}

export function getFirestoreAdmin() {
  return getFirestore(getFirebaseAdminApp());
}

export function getStorageAdminBucket(bucketName?: string) {
  return getStorage(getFirebaseAdminApp()).bucket(bucketName || getFirebaseStorageBucketName());
}

export function isFirebaseTimeoutError(error: unknown) {
  return error instanceof Error && error.message.startsWith('Firebase operation timed out:');
}

export async function runWithFirebaseTimeout<T>(operation: Promise<T>, label: string) {
  if (!Number.isFinite(FIREBASE_OPERATION_TIMEOUT_MS) || FIREBASE_OPERATION_TIMEOUT_MS <= 0) {
    return operation;
  }

  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Firebase operation timed out: ${label}`));
        }, FIREBASE_OPERATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
