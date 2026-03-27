import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import { areNonCoreFirestoreMirrorsEnabled } from '@/lib/firestore-mirror';
import { syncSheetsToFirestoreMirror } from '@/lib/mirror-sync';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const { session, error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  const userId = session!.user.id;
  const rateLimit = checkRateLimit(`mirror-sync:${userId}`, { windowMs: 60_000, max: 1 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { success: false, message: '동기화는 1분에 1회만 실행할 수 있습니다.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  if (!isFirebaseMirrorEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: 'Firebase Admin credentials are not configured.',
      },
      { status: 400 },
    );
  }

  if (!areNonCoreFirestoreMirrorsEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: '비핵심 Firestore 미러링은 현재 기본 비활성화 상태입니다. 채팅과 공지처럼 실제로 읽는 저장소만 유지합니다.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await syncSheetsToFirestoreMirror();
    return NextResponse.json({ success: true, data: result });
  } catch (syncError) {
    console.error('[admin/mirror/sync POST]', syncError);
    return NextResponse.json({ success: false, message: '미러 동기화에 실패했습니다.' }, { status: 500 });
  }
}
