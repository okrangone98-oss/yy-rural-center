import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import {
  deleteInstructorProfilePhotoByUrl,
  uploadInstructorProfilePhoto,
} from '@/lib/firebase-storage';
import { assertUploadImageInput, normalizeProfileImage } from '@/lib/image-normalization';

const PROD_ALLOWED_ORIGINS = [
  'https://yycenter.kr',
  'https://www.yycenter.kr',
];

const DEV_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const DEFAULT_ALLOWED_ORIGINS =
  process.env.NODE_ENV === 'production'
    ? PROD_ALLOWED_ORIGINS
    : [...PROD_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS];

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

  const ip = getClientIp(request);
  // 개발: 분당 20회 / 운영: 분당 5회
  const uploadMax = process.env.NODE_ENV === 'production' ? 5 : 20;
  const rateLimit = checkRateLimit(`upload:${ip}`, { windowMs: 60_000, max: uploadMax });
  if (!rateLimit.success) {
    return withCors(
      NextResponse.json({ success: false, message: '잠시 후 다시 시도해 주세요.' }, { status: 429 }),
      origin,
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return withCors(
      NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 }),
      origin,
    );
  }

  if (!isFirebaseMirrorEnabled()) {
    return withCors(
      NextResponse.json({ success: false, message: '파일 업로드를 처리할 수 없습니다.' }, { status: 400 }),
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[profile-photo POST]', errorMessage);

    const isUserError = error instanceof Error && (
      error.message.includes('이미지') ||
      error.message.includes('파일') ||
      error.message.includes('MB') ||
      error.message.includes('압축')
    );

    // 개발 환경에서는 실제 에러를 노출해 진단 가능하게 함
    const isDev = process.env.NODE_ENV !== 'production';
    const clientMessage = isUserError
      ? error.message
      : isDev
        ? `업로드 실패: ${errorMessage}`
        : '프로필 사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.';

    return withCors(
      NextResponse.json(
        { success: false, message: clientMessage },
        { status: isUserError ? 400 : 500 },
      ),
      origin,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return withCors(
      NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 }),
      origin,
    );
  }

  if (!isFirebaseMirrorEnabled()) {
    return withCors(
      NextResponse.json({ success: false, message: '파일 삭제를 처리할 수 없습니다.' }, { status: 400 }),
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
    console.error('[profile-photo DELETE]', error);
    return withCors(
      NextResponse.json(
        { success: false, message: '프로필 사진 삭제에 실패했습니다.' },
        { status: 500 },
      ),
      origin,
    );
  }
}
