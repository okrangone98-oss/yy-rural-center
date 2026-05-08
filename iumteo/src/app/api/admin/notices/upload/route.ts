import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getStorageAdminBucket, isFirebaseMirrorEnabled } from '@/lib/firebase-admin';

// 허용 MIME 타입
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/haansofthwp': 'hwp',
  'application/x-hwp': 'hwp',
  'application/vnd.hancom.hwp': 'hwp',
  'application/pdf': 'pdf',
};

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function isImageType(mimeType: string) {
  return mimeType.startsWith('image/');
}

function buildDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json({ ok: false, error: 'Firebase 설정이 필요합니다.' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자만 파일을 업로드할 수 있습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: '파일 크기는 20MB 이하여야 합니다.' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const ext = ALLOWED_TYPES[mimeType];
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: '허용되지 않는 파일 형식입니다. (JPG, PNG, WebP, GIF, HWP, DOC, DOCX, PDF)' },
        { status: 400 },
      );
    }

    const isImage = isImageType(mimeType);
    const folder = isImage ? 'notices/posters' : 'notices/attachments';
    const originalName = path.basename(file.name).replace(/[^\w가-힣.\-]/g, '_');
    const objectPath = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}-${originalName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getStorageAdminBucket();
    const token = randomUUID();
    const storageFile = bucket.file(objectPath);

    await storageFile.save(buffer, {
      resumable: false,
      contentType: mimeType,
      metadata: {
        cacheControl: 'public,max-age=31536000,immutable',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const url = buildDownloadUrl(bucket.name, objectPath, token);

    return NextResponse.json({
      ok: true,
      url,
      fileName: file.name,
      isImage,
    });
  } catch (error) {
    console.error('[POST /api/admin/notices/upload]', error);
    return NextResponse.json({ ok: false, error: '파일 업로드에 실패했습니다.' }, { status: 500 });
  }
}
