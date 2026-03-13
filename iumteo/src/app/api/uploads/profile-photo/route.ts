import { NextRequest, NextResponse } from 'next/server';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import {
  deleteInstructorProfilePhotoByUrl,
  uploadInstructorProfilePhoto,
} from '@/lib/firebase-storage';
import { assertUploadImageInput, normalizeProfileImage } from '@/lib/image-normalization';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function getAllowedOrigins() {
  const configured = (process.env.PROFILE_UPLOAD_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function buildCorsHeaders(origin: string | null) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });

  if (origin && getAllowedOrigins().includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  return headers;
}

function withCors(response: NextResponse, origin: string | null) {
  const corsHeaders = buildCorsHeaders(origin);
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

function getSafeString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get('origin'));
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (!isFirebaseMirrorEnabled()) {
    return withCors(
      NextResponse.json({ success: false, message: 'Firebase Admin credentials are not configured.' }, { status: 400 }),
      origin,
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const name = getSafeString(formData, 'name') || 'instructor';
    const email = getSafeString(formData, 'email') || getSafeString(formData, 'identifier') || 'unknown';

    if (!(file instanceof File)) {
      return withCors(
        NextResponse.json({ success: false, message: '이미지 파일이 필요합니다.' }, { status: 400 }),
        origin,
      );
    }

    assertUploadImageInput(file);
    const normalized = await normalizeProfileImage({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
    });

    const uploaded = await uploadInstructorProfilePhoto({
      buffer: normalized.buffer,
      contentType: normalized.contentType,
      originalName: normalized.originalName,
      name,
      email,
    });

    return withCors(NextResponse.json({
      success: true,
      data: {
        ...uploaded,
        normalized: {
          width: normalized.width,
          height: normalized.height,
          size: normalized.size,
          contentType: normalized.contentType,
          quality: normalized.quality,
        },
      },
    }), origin);
  } catch (error) {
    return withCors(
      NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : '프로필 사진 업로드 실패' },
        { status: 500 },
      ),
      origin,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (!isFirebaseMirrorEnabled()) {
    return withCors(
      NextResponse.json({ success: false, message: 'Firebase Admin credentials are not configured.' }, { status: 400 }),
      origin,
    );
  }

  try {
    const payload = (await request.json()) as { fileUrl?: string };
    const fileUrl = String(payload.fileUrl || '').trim();

    if (!fileUrl) {
      return withCors(
        NextResponse.json({ success: false, message: '삭제할 파일 URL이 필요합니다.' }, { status: 400 }),
        origin,
      );
    }

    const result = await deleteInstructorProfilePhotoByUrl(fileUrl);
    return withCors(NextResponse.json({ success: true, data: result }), origin);
  } catch (error) {
    return withCors(
      NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : '프로필 사진 삭제 실패' },
        { status: 500 },
      ),
      origin,
    );
  }
}
