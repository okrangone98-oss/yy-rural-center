import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { MessageCircle } from 'lucide-react';
import { authOptions } from '@/lib/auth-options';
import { findChatRoomsForUser } from '@/lib/chat-store';
import { CHAT_ROOM_MAX_LENGTH, type ChatRoom } from '@/lib/domain';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';

function StatusBadge({ status }: { status: ChatRoom['status'] }) {
  const tone = {
    PENDING: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    ARCHIVED: 'bg-gray-100 text-gray-500',
  } satisfies Record<ChatRoom['status'], string>;

  const label = status === 'PENDING' ? '수락 대기' : status === 'ACTIVE' ? '대화 중' : '문의 완료';
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone[status]}`}>{label}</span>;
}

export default async function ChatListPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login?callbackUrl=/chat');
  }

  const chatEnabled = isFirebaseMirrorEnabled();
  const rooms = await findChatRoomsForUser(session.user.email || '', session.user.role);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6fbf8_0%,#eef4f6_100%)] px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#0f4d3a_0%,#1b7a5d_100%)] px-6 py-7 text-white shadow-[0_25px_80px_rgba(9,56,38,0.18)]">
          <h1 className="text-3xl font-bold">문의 채팅</h1>
          <p className="mt-2 text-sm text-emerald-50/90">
            문의 접수 후 생성된 대화방입니다. 강사가 수락하면 바로 대화를 이어갈 수 있습니다.
          </p>
        </section>

        {!chatEnabled ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-10 text-center shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-amber-700">
              <MessageCircle size={24} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">채팅 기능 설정이 아직 완료되지 않았습니다</h2>
            <p className="mt-2 text-sm text-gray-600">현재는 문의 접수 흐름만 우선 사용 가능하며, 채팅은 Firebase 설정 후 활성화됩니다.</p>
          </section>
        ) : rooms.length === 0 ? (
          <section className="rounded-[28px] border border-white/80 bg-white/95 p-10 text-center shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <MessageCircle size={24} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">아직 생성된 채팅방이 없습니다</h2>
            <p className="mt-2 text-sm text-gray-500">문의 접수 후 이곳에서 진행 상태와 대화를 확인할 수 있습니다.</p>
          </section>
        ) : (
          <section className="space-y-3">
            {rooms.map((room) => {
              const unread = room.unreadCount?.[session.user.email || ''] ?? 0;
              const progress = Math.min((room.totalLength / CHAT_ROOM_MAX_LENGTH) * 100, 100);

              return (
                <Link
                  key={room.id}
                  href={`/chat/${room.id}`}
                  className="block rounded-[24px] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(19,60,44,0.08)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {session.user.role === 'INSTRUCTOR' ? room.memberName : room.instructorName}
                        </h2>
                        <StatusBadge status={room.status} />
                        {unread > 0 ? (
                          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                            새 메시지 {unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {room.lastMessage || '아직 채팅 메시지가 없습니다.'}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">{room.lastMessageAt?.replace('T', ' ').slice(0, 16)}</div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                      <span>누적 글자 수</span>
                      <span>
                        {room.totalLength} / {CHAT_ROOM_MAX_LENGTH}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
