/**
 * Firebase 클라이언트 SDK 초기화
 * NEXT_PUBLIC_FIREBASE_* 환경변수가 없으면 null 반환 (graceful degradation)
 *
 * .env.local에 추가 필요:
 *   NEXT_PUBLIC_FIREBASE_API_KEY=
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
 *   NEXT_PUBLIC_FIREBASE_APP_ID=
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

let clientApp: FirebaseApp | null = null;
let clientDb: Firestore | null = null;

function getClientConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;

  return {
    apiKey,
    projectId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getClientFirestore(): Firestore | null {
  if (typeof window === 'undefined') return null;

  if (clientDb) return clientDb;

  const config = getClientConfig();
  if (!config) return null;

  try {
    const existingApp = getApps().find((app) => app.name === 'iumteo-client');
    clientApp = existingApp ?? initializeApp(config, 'iumteo-client');
    clientDb = getFirestore(clientApp);
    return clientDb;
  } catch {
    return null;
  }
}

export function isClientFirestoreEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );
}
