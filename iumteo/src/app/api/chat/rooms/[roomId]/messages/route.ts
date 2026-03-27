import { NextResponse } from 'next/server';
import { getChatMessages, getChatRoom, sendChatMessage } from '@/lib/chat-store';
import type { ChatMessage, MailOutboxEntry } from '@/lib/domain';
import { sendManagedMail } from '@/lib/mail';
import { getAppPath } from '@/lib/app-url';
import { isFirebaseMirrorEnabled, isFirebaseTimeoutError } from '@/lib/firebase-admin';
import { getRequiredSession } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
) {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json(
        { success: false, message: '채팅 기능 설정이 아직 완료되지 않았습니다.' },
        { status: 503 },
      );
    }

    const room = await getChatRoom(params.roomId);
    if (!room) {
      return NextResponse.json({ success: false, message: '채팅방을 찾을 수 없습니다.' }, { status: 404 });
    }

    const email = session.user.email || '';
    const isParticipant =
      room.memberEmail === email || room.instructorEmail === email || session.user.role === 'ADMIN';
    if (!isParticipant) {
      return NextResponse.json({ success: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const messages = await getChatMessages(params.roomId);
    return NextResponse.json({ success: true, data: { messages } });
  } catch (fetchError) {
    if (isFirebaseTimeoutError(fetchError)) {
      return NextResponse.json(
        { success: false, message: '채팅 메시지를 불러오는 중 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: fetchError instanceof Error ? fetchError.message : '채팅 메시지를 불러오지 못했습니다.',
      },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json(
        { success: false, message: '채팅 기능 설정이 아직 완료되지 않았습니다.' },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { content?: string };
    const content = String(body.content || '').trim();

    if (!content) {
      return NextResponse.json({ success: false, message: '메시지를 입력해 주세요.' }, { status: 400 });
    }

    const senderEmail = session.user.email || '';
    const senderName = session.user.name || senderEmail.split('@')[0];
    const senderRole = session.user.role as 'USER' | 'INSTRUCTOR' | 'ADMIN';

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId: params.roomId,
      senderEmail,
      senderName,
      senderRole,
      content,
      createdAt: new Date().toISOString(),
    };

    const result = await sendChatMessage(params.roomId, message, senderEmail, senderRole);
    if (!result.ok) {
      const statusCode =
        result.reason === 'ROOM_NOT_FOUND'
          ? 404
          : result.reason === 'FORBIDDEN'
            ? 403
            : result.reason === 'LIMIT_EXCEEDED'
              ? 422
              : 400;

      const messageText =
        result.reason === 'ROOM_PENDING'
          ? '강사가 문의를 수락해야 채팅을 시작할 수 있습니다.'
          : result.reason === 'ROOM_ARCHIVED'
            ? '이미 종료된 문의 채팅방입니다.'
            : result.reason === 'LIMIT_EXCEEDED'
              ? '채팅 누적 글자 수 300자를 초과했습니다.'
              : result.reason === 'FORBIDDEN'
                ? '참여 중인 사용자만 메시지를 보낼 수 있습니다.'
                : '메시지를 전송하지 못했습니다.';

      return NextResponse.json(
        { success: false, code: result.reason, message: messageText },
        { status: statusCode },
      );
    }

    if (result.notifyFirst) {
      const room = await getChatRoom(params.roomId);
      if (room) {
        const recipientEmail =
          senderEmail === room.memberEmail ? room.instructorEmail : room.memberEmail;
        const recipientName =
          senderEmail === room.memberEmail ? room.instructorName : room.memberName;
        const chatUrl = new URL(getAppPath(`/chat/${params.roomId}`), request.url).toString();

        const mailEntry: MailOutboxEntry = {
          id: `chat-first-${message.id}`,
          category: 'CHAT_MESSAGE',
          to: recipientEmail,
          subject: `[양양 이음터] ${senderName}님의 새 채팅 메시지가 도착했습니다`,
          html: `
            <div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#ffffff;">
              <h2 style="margin:0 0 16px;color:#0f4d3a;">새 채팅 메시지가 도착했습니다</h2>
              <p style="margin:0 0 12px;color:#374151;">${recipientName}님, ${senderName}님이 대화를 시작했습니다.</p>
              <div style="border:1px solid #d1fae5;border-radius:12px;padding:14px 16px;background:#f0fdf4;color:#166534;white-space:pre-wrap;">${content}</div>
              <a href="${chatUrl}" style="display:inline-block;margin-top:18px;background:#0f4d3a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">
                채팅방 바로가기
              </a>
            </div>
          `,
          relatedRoomId: params.roomId,
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };

        sendManagedMail(mailEntry).catch((mailError) => {
          console.warn('[chat/messages] first-message mail failed:', mailError);
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { message: result.message, newTotalLength: result.newTotalLength },
    });
  } catch (sendError) {
    if (isFirebaseTimeoutError(sendError)) {
      return NextResponse.json(
        { success: false, message: '메시지 저장이 잠시 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: sendError instanceof Error ? sendError.message : '메시지 전송에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
