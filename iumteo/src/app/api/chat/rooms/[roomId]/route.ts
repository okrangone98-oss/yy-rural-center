import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import { getChatMessages, getChatRoom } from '@/lib/chat-store';
import { isFirebaseMirrorEnabled, isFirebaseTimeoutError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
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
    const role = session.user.role;
    const isParticipant = room.memberEmail === email || room.instructorEmail === email || role === 'ADMIN';

    if (!isParticipant) {
      return NextResponse.json({ success: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const messages = await getChatMessages(params.roomId);
    return NextResponse.json({ success: true, data: { room, messages } });
  } catch (fetchError) {
    if (isFirebaseTimeoutError(fetchError)) {
      return NextResponse.json(
        { success: false, message: '채팅 내용을 불러오는 중 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: fetchError instanceof Error ? fetchError.message : '채팅방 정보를 불러오지 못했습니다.',
      },
      { status: 400 },
    );
  }
}
