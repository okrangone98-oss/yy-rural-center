import { NextResponse } from 'next/server';
import { closeChatRoom } from '@/lib/chat-store';
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

    const result = await closeChatRoom(params.roomId, session.user.email || '', session.user.role);

    if (!result.ok) {
      const status = result.reason === 'ROOM_NOT_FOUND' ? 404 : result.reason === 'FORBIDDEN' ? 403 : 400;
      const message =
        result.reason === 'ROOM_NOT_FOUND'
          ? '채팅방을 찾을 수 없습니다.'
          : result.reason === 'FORBIDDEN'
          ? '이 채팅방을 닫을 권한이 없습니다.'
          : '채팅방 닫기에 실패했습니다.';

      return NextResponse.json({ success: false, message }, { status });
    }

    return NextResponse.json({ success: true, message: '채팅방이 내 목록에서 숨겨졌습니다.' });
  } catch (closeError) {
    if (isFirebaseTimeoutError(closeError)) {
      return NextResponse.json(
        { success: false, message: '채팅방 닫기 처리 중 지연이 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: closeError instanceof Error ? closeError.message : '채팅방 닫기에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
