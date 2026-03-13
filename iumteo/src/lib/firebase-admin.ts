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

  return (process.env.FIREBASE_STORAGE_BUCKET || `${config.projectId}.firebasestorage.app`).trim();
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

export function getStorageAdminBucket() {
  return getStorage(getFirebaseAdminApp()).bucket(getFirebaseStorageBucketName());
}
