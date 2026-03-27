import { NextResponse } from 'next/server';
import { findChatRoomsForUser } from '@/lib/chat-store';
import { getRequiredSession } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    const email = session.user.email || '';
    const role = session.user.role;
    const rooms = await findChatRoomsForUser(email, role);

    const unreadRooms = rooms
      .map((room) => ({
        id: room.id,
        name: role === 'INSTRUCTOR' ? room.memberName : room.instructorName,
        status: room.status,
        unreadCount: room.unreadCount?.[email] ?? 0,
        lastMessage: room.lastMessage || '',
        lastMessageAt: room.lastMessageAt || room.updatedAt || room.createdAt,
      }))
      .filter((room) => room.unreadCount > 0)
      .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

    return NextResponse.json({
      success: true,
      data: {
        totalUnread: unreadRooms.reduce((sum, room) => sum + room.unreadCount, 0),
        unreadRooms: unreadRooms.slice(0, 5),
      },
    });
  } catch (fetchError) {
    return NextResponse.json(
      {
        success: false,
        message: fetchError instanceof Error ? fetchError.message : '알림 정보를 불러오지 못했습니다.',
      },
      { status: 400 },
    );
  }
}
