import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ChevronLeft } from 'lucide-react';
import { authOptions } from '@/lib/auth-options';
import { getChatMessages, getChatRoom } from '@/lib/chat-store';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import ChatRoomClient from './ChatRoomClient';

interface PageProps {
  params: { roomId: string };
}

export default async function ChatRoomPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=/chat/${params.roomId}`);
  }

  if (!isFirebaseMirrorEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-8 text-center shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <h1 className="text-xl font-semibold text-gray-900">채팅 기능 설정이 아직 완료되지 않았습니다</h1>
          <Link href="/chat" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline">
            채팅 목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const room = await getChatRoom(params.roomId);
  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-[24px] border border-white/80 bg-white/95 p-8 text-center shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <h1 className="text-xl font-semibold text-gray-900">채팅방을 찾을 수 없습니다</h1>
          <Link href="/chat" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline">
            채팅 목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const email = session.user.email || '';
  const isParticipant = room.memberEmail === email || room.instructorEmail === email || session.user.role === 'ADMIN';
  if (!isParticipant) {
    redirect('/chat');
  }

  const messages = await getChatMessages(params.roomId);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6fbf8_0%,#eef4f6_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Link
          href="/chat"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft size={18} />
          목록으로 돌아가기
        </Link>
        <Link href="/" className="inline-flex w-fit text-sm font-medium text-gray-500 hover:text-emerald-700">
          홈으로 돌아가기
        </Link>

        <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <ChatRoomClient roomId={params.roomId} initialRoom={room} initialMessages={messages} />
        </section>
      </div>
    </main>
  );
}
