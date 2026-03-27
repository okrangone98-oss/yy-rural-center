'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, MessageCircle, NotebookPen } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { getAppPath } from '@/lib/app-url';

type ChatNotification = {
  id: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
};

type InquiryItem = {
  inquiryId: string;
  purpose?: string;
  status?: string;
  chatRoomStatus?: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
};

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [chatItems, setChatItems] = useState<ChatNotification[]>([]);
  const [inquiryItems, setInquiryItems] = useState<InquiryItem[]>([]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    async function fetchNotifications() {
      try {
        const [chatResponse, inquiryResponse] = await Promise.all([
          fetch(getAppPath('/api/chat/notifications'), { cache: 'no-store' }),
          fetch(
            getAppPath(session?.user?.role === 'INSTRUCTOR' ? '/api/instructor/inquiries' : '/api/account/inquiries'),
            { cache: 'no-store' },
          ),
        ]);

        const chatResult = await chatResponse.json().catch(() => null);
        const inquiryResult = await inquiryResponse.json().catch(() => null);

        if (chatResponse.ok && chatResult?.success) {
          setChatItems(Array.isArray(chatResult.data?.unreadRooms) ? chatResult.data.unreadRooms : []);
        }

        if (inquiryResponse.ok && inquiryResult?.success) {
          setInquiryItems(Array.isArray(inquiryResult.data) ? inquiryResult.data.slice(0, 5) : []);
        }
      } catch {
        // keep bell quiet if notifications fail
      }
    }

    void fetchNotifications();
  }, [session?.user?.role, status]);

  const pendingInquiries = useMemo(() => {
    if (session?.user?.role === 'INSTRUCTOR') {
      return inquiryItems.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus).length;
    }

    return inquiryItems.filter((item) => item.chatRoomStatus === 'ACTIVE').length;
  }, [inquiryItems, session?.user?.role]);

  const totalUnread = useMemo(
    () => chatItems.reduce((sum, item) => sum + item.unreadCount, 0) + pendingInquiries,
    [chatItems, pendingInquiries],
  );

  if (status !== 'authenticated') return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:text-emerald-700"
        aria-label="알림 열기"
      >
        <Bell size={18} />
        {totalUnread > 0 ? (
          <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
            {Math.min(totalUnread, 9)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-14 z-50 w-[320px] rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_24px_80px_rgba(14,58,45,0.18)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">알림</p>
              <p className="text-xs text-gray-500">문의와 채팅 흐름을 한 번에 확인합니다.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {totalUnread}건
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <Link
              href={session?.user?.role === 'INSTRUCTOR' ? '/teacher' : '/profile'}
              onClick={() => setOpen(false)}
              className="block rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <NotebookPen size={16} className="text-emerald-700" />
                {session?.user?.role === 'INSTRUCTOR' ? '받은 문의' : '문의 현황'}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {pendingInquiries > 0 ? `${pendingInquiries}건을 먼저 확인해주세요.` : '새롭게 확인할 문의는 없습니다.'}
              </p>
            </Link>

            <Link
              href="/chat"
              onClick={() => setOpen(false)}
              className="block rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MessageCircle size={16} className="text-emerald-700" />
                채팅 알림
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {chatItems.length > 0 ? `읽지 않은 채팅 ${chatItems.length}건이 있습니다.` : '새 채팅 알림은 없습니다.'}
              </p>
            </Link>

            {chatItems.length > 0 ? (
              <div className="space-y-2 border-t border-gray-100 pt-3">
                {chatItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={`/chat/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl border border-transparent bg-emerald-50/60 px-4 py-3 hover:border-emerald-200"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        {item.unreadCount}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-600">{item.lastMessage || '새 메시지가 도착했습니다.'}</p>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
