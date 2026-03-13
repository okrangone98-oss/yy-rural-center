import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
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
