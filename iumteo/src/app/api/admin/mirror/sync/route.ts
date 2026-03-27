import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import { areNonCoreFirestoreMirrorsEnabled } from '@/lib/firestore-mirror';
import { syncSheetsToFirestoreMirror } from '@/lib/mirror-sync';

export async function POST() {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

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
    return NextResponse.json(
      { success: false, message: syncError instanceof Error ? syncError.message : '미러 동기화 실패' },
      { status: 500 },
    );
  }
}
