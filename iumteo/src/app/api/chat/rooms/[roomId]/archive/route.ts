import { NextResponse } from 'next/server';
import { archiveChatRoom, getChatRoom } from '@/lib/chat-store';
import { isFirebaseMirrorEnabled, isFirebaseTimeoutError } from '@/lib/firebase-admin';
import { getRequiredSession } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } },
) {
  const { session, error } = await getRequiredSession(['INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json({ success: false, message: '채팅 기능 설정이 아직 완료되지 않았습니다.' }, { status: 503 });
    }

    const room = await getChatRoom(params.roomId);
    if (!room) {
      return NextResponse.json({ success: false, message: '채팅방을 찾을 수 없습니다.' }, { status: 404 });
    }

    const email = session.user.email || '';
    if (session.user.role !== 'ADMIN' && room.instructorEmail !== email) {
      return NextResponse.json({ success: false, message: '문의 종료 권한이 없습니다.' }, { status: 403 });
    }

    if (room.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, message: '대화 중인 문의만 종료할 수 있습니다.' }, { status: 400 });
    }

    await archiveChatRoom(params.roomId);
    return NextResponse.json({ success: true, message: '문의가 종료되어 읽기 전용으로 전환되었습니다.' });
  } catch (archiveError) {
    if (isFirebaseTimeoutError(archiveError)) {
      return NextResponse.json(
        { success: false, message: '채팅 저장소 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: archiveError instanceof Error ? archiveError.message : '문의 종료에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
