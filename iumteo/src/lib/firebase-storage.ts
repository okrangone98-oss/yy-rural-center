import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  getFirebaseStorageBucketCandidates,
  getFirebaseStorageBucketName,
  getStorageAdminBucket,
} from '@/lib/firebase-admin';

const PROFILE_PHOTO_ROOT = 'instructor-register/profile-photos';
const LEGACY_PROFILE_PHOTO_ROOT = 'profile_photos';

function sanitizeSegment(value: string, fallback: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function getExtension(originalName: string, contentType: string) {
  const ext = path.extname(originalName).replace('.', '').toLowerCase();
  if (ext) return ext;
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function buildDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export function getLegacyProfilePhotoRoot() {
  return LEGACY_PROFILE_PHOTO_ROOT;
}

export function resolveProfilePhotoObjectPath(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) return trimmed;
  return `${LEGACY_PROFILE_PHOTO_ROOT}/${trimmed}`;
}

export function resolveProfilePhotoPublicUrl(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|images\/|\.\/|\/)/i.test(trimmed)) return trimmed;
  const objectPath = resolveProfilePhotoObjectPath(trimmed);
  const bucketName = getFirebaseStorageBucketName();
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

export async function uploadInstructorProfilePhoto(input: {
  buffer: Buffer;
  contentType: string;
  originalName: string;
  name: string;
  email: string;
}) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = getExtension(input.originalName, input.contentType);
  const objectPath = [
    PROFILE_PHOTO_ROOT,
    year,
    month,
    `${Date.now()}-${sanitizeSegment(input.name, 'instructor')}-${sanitizeSegment(input.email, 'member')}.${ext}`,
  ].join('/');

  let lastError: unknown = null;

  for (const bucketName of getFirebaseStorageBucketCandidates()) {
    try {
      const bucket = getStorageAdminBucket(bucketName);
      const token = randomUUID();
      const file = bucket.file(objectPath);

      await file.save(input.buffer, {
        resumable: false,
        contentType: input.contentType,
        metadata: {
          cacheControl: 'public,max-age=31536000,immutable',
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      return {
        bucket: bucket.name,
        objectPath,
        url: buildDownloadUrl(bucket.name, objectPath, token),
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('bucket does not exist')) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('프로필 사진 업로드에 실패했습니다.');
}

export function extractStorageObjectPath(fileUrl: string) {
  const parsed = new URL(fileUrl);
  const expectedBuckets = getFirebaseStorageBucketCandidates();

  if (!parsed.pathname.startsWith('/v0/b/')) {
    return null;
  }

  const segments = parsed.pathname.split('/');
  const bucketName = segments[3] || '';
  if (!expectedBuckets.includes(bucketName)) {
    return null;
  }

  const encodedObjectPath = segments.slice(5).join('/');
  if (!encodedObjectPath) {
    return null;
  }

  return decodeURIComponent(encodedObjectPath);
}

export async function deleteInstructorProfilePhotoByUrl(fileUrl: string) {
  const objectPath = extractStorageObjectPath(fileUrl);
  if (!objectPath) {
    return { deleted: false, skipped: true };
  }

  const bucket = getStorageAdminBucket();
  await bucket.file(objectPath).delete({ ignoreNotFound: true });
  return { deleted: true, skipped: false, objectPath };
}
