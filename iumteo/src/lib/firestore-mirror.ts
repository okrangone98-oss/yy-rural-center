import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreAdmin, isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import type { MailOutboxEntry, MirrorInquiry, MirrorInstructorProfile, MirrorUserRecord } from '@/lib/domain';

function nowIso() {
  return new Date().toISOString();
}

function noopResult<T>(data: T) {
  return { enabled: false, skipped: true, data };
}

export async function upsertMirrorUser(user: MirrorUserRecord) {
  if (!isFirebaseMirrorEnabled()) return noopResult(user);
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
  if (!isFirebaseMirrorEnabled()) return noopResult({ userId, ...payload });
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

export async function upsertMirrorInstructorProfile(profile: MirrorInstructorProfile) {
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

export async function updateMirrorInstructorProfile(profileId: string, payload: Partial<MirrorInstructorProfile>) {
  if (!isFirebaseMirrorEnabled()) return noopResult({ profileId, ...payload });
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
  if (!isFirebaseMirrorEnabled()) return noopResult(inquiry);
  const db = getFirestoreAdmin();
  await db.collection('inquiries').doc(inquiry.id).set({
    ...inquiry,
    mirroredAt: FieldValue.serverTimestamp(),
  });
  return { enabled: true, skipped: false, data: inquiry };
}

export async function updateMirrorInquiry(inquiryId: string, payload: Partial<MirrorInquiry>) {
  if (!isFirebaseMirrorEnabled()) return noopResult({ inquiryId, ...payload });
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
  if (!isFirebaseMirrorEnabled()) return noopResult(entry);
  const db = getFirestoreAdmin();
  await db.collection('mail_outbox').doc(entry.id).set({
    ...entry,
    mirroredAt: FieldValue.serverTimestamp(),
  });
  return { enabled: true, skipped: false, data: entry };
}
