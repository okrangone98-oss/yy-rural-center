import { NextResponse } from 'next/server';
import { getChatRoom, markChatRoomRead } from '@/lib/chat-store';
import { isFirebaseMirrorEnabled, isFirebaseTimeoutError } from '@/lib/firebase-admin';
import { getRequiredSession } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } },
) {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
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
    const isParticipant = room.memberEmail === email || room.instructorEmail === email || session.user.role === 'ADMIN';
    if (!isParticipant) {
      return NextResponse.json({ success: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    await markChatRoomRead(params.roomId, email);
    return NextResponse.json({ success: true });
  } catch (readError) {
    if (isFirebaseTimeoutError(readError)) {
      return NextResponse.json(
        { success: false, message: '채팅 저장소 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: readError instanceof Error ? readError.message : '읽음 처리에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
