import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreAdmin, isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import type { MailOutboxEntry, MirrorInquiry, MirrorInstructorProfile, MirrorUserRecord } from '@/lib/domain';

const NON_CORE_FIRESTORE_MIRRORS_ENABLED = process.env.ENABLE_NON_CORE_FIRESTORE_MIRRORS === 'true';

function nowIso() {
  return new Date().toISOString();
}

function noopResult<T>(data: T) {
  return { enabled: false, skipped: true, data };
}

export function areNonCoreFirestoreMirrorsEnabled() {
  return isFirebaseMirrorEnabled() && NON_CORE_FIRESTORE_MIRRORS_ENABLED;
}

export async function upsertMirrorUser(user: MirrorUserRecord) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult(user);
  const db = getFirestoreAdmin();
  await db.collection('users').doc(user.id).set(
    {
      ...user,
      updatedAt: nowIso(),
      mirroredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await db.collection('users').doc(user.id).collection('consent_log').doc(user.consent.consentDate).set(user.consent, { merge: true });
  return { enabled: true, skipped: false, data: user };
}

export async function updateMirrorUser(userId: string, payload: Partial<MirrorUserRecord>) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult({ userId, ...payload });
  const db = getFirestoreAdmin();
  await db.collection('users').doc(userId).set(
    {
      ...payload,
      updatedAt: nowIso(),
      mirroredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { enabled: true, skipped: false, data: { userId, ...payload } };
}

// GAS 없이도 Firestore에 직접 강사 프로필을 저장 (CRUD 주 경로)
export async function saveInstructorProfileDirect(profile: MirrorInstructorProfile) {
  if (!isFirebaseMirrorEnabled()) return noopResult(profile);
  const db = getFirestoreAdmin();
  await db.collection('lecturer_profiles').doc(profile.id).set(
    {
      ...profile,
      updatedAt: nowIso(),
      mirroredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { enabled: true, skipped: false, data: profile };
}

// Firestore에서 강사 프로필 읽기 (GAS 폴백용)
export async function getInstructorProfileFromFirestore(email: string) {
  if (!isFirebaseMirrorEnabled()) return null;
  const db = getFirestoreAdmin();
  const doc = await db.collection('lecturer_profiles').doc(email).get();
  if (!doc.exists) return null;
  return doc.data() as MirrorInstructorProfile;
}

export async function upsertMirrorInstructorProfile(profile: MirrorInstructorProfile) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult(profile);
  const db = getFirestoreAdmin();
  await db.collection('lecturer_profiles').doc(profile.id).set(
    {
      ...profile,
      updatedAt: nowIso(),
      mirroredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { enabled: true, skipped: false, data: profile };
}

export async function updateMirrorInstructorProfile(profileId: string, payload: Partial<MirrorInstructorProfile>) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult({ profileId, ...payload });
  const db = getFirestoreAdmin();
  await db.collection('lecturer_profiles').doc(profileId).set(
    {
      ...payload,
      updatedAt: nowIso(),
      mirroredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { enabled: true, skipped: false, data: { profileId, ...payload } };
}

export async function createMirrorInquiry(inquiry: MirrorInquiry) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult(inquiry);
  const db = getFirestoreAdmin();
  await db.collection('inquiries').doc(inquiry.id).set({
    ...inquiry,
    mirroredAt: FieldValue.serverTimestamp(),
  });
  return { enabled: true, skipped: false, data: inquiry };
}

export async function updateMirrorInquiry(inquiryId: string, payload: Partial<MirrorInquiry>) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult({ inquiryId, ...payload });
  const db = getFirestoreAdmin();
  await db.collection('inquiries').doc(inquiryId).set(
    {
      ...payload,
      updatedAt: nowIso(),
      mirroredAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { enabled: true, skipped: false, data: { inquiryId, ...payload } };
}

export async function queueMailOutbox(entry: MailOutboxEntry) {
  if (!areNonCoreFirestoreMirrorsEnabled()) return noopResult(entry);
  const db = getFirestoreAdmin();
  await db.collection('mail_outbox').doc(entry.id).set({
    ...entry,
    mirroredAt: FieldValue.serverTimestamp(),
  });
  return { enabled: true, skipped: false, data: entry };
}

export async function deleteMirrorUser(userId: string) {
  if (!isFirebaseMirrorEnabled()) return { enabled: false, skipped: true, userId };
  const db = getFirestoreAdmin();
  await db.collection('users').doc(userId).delete();
  return { enabled: true, skipped: false, userId };
}

export async function deleteMirrorInstructorProfile(profileId: string) {
  if (!isFirebaseMirrorEnabled()) return { enabled: false, skipped: true, profileId };
  const db = getFirestoreAdmin();
  await db.collection('lecturer_profiles').doc(profileId).delete();
  return { enabled: true, skipped: false, profileId };
}

