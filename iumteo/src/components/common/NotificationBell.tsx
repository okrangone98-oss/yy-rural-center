'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, MessageCircle, NotebookPen, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
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
  chatRoomId?: string;
  chatRoomStatus?: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
};

const ITEM_PER_PAGE = 3;

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [chatItems, setChatItems] = useState<ChatNotification[]>([]);
  const [inquiryItems, setInquiryItems] = useState<InquiryItem[]>([]);

  const [inquiryPage, setInquiryPage] = useState(0);
  const [chatPage, setChatPage] = useState(0);
  const [showInquiries, setShowInquiries] = useState(true);
  const [showChats, setShowChats] = useState(true);

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
          setInquiryItems(Array.isArray(inquiryResult.data) ? inquiryResult.data : []);
        }
      } catch {
        // keep bell quiet if notifications fail
      }
    }

    void fetchNotifications();
  }, [session?.user?.role, status]);

  const pendingInquiryList = useMemo(() => {
    if (session?.user?.role === 'INSTRUCTOR') {
      return inquiryItems.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus);
    }
    return [];
  }, [inquiryItems, session?.user?.role]);

  const activeInquiryCount = useMemo(() => {
    return inquiryItems.filter((item) => item.chatRoomStatus === 'ACTIVE').length;
  }, [inquiryItems]);

  const pendingInquiriesCount = session?.user?.role === 'INSTRUCTOR' ? pendingInquiryList.length : activeInquiryCount;

  const totalUnread = useMemo(
    () => chatItems.reduce((sum, item) => sum + item.unreadCount, 0) + pendingInquiriesCount,
    [chatItems, pendingInquiriesCount],
  );

  const inquiryTotalPages = Math.ceil(pendingInquiryList.length / ITEM_PER_PAGE);
  const chatTotalPages = Math.ceil(chatItems.length / ITEM_PER_PAGE);

  const currentInquiries = pendingInquiryList.slice(inquiryPage * ITEM_PER_PAGE, (inquiryPage + 1) * ITEM_PER_PAGE);
  const currentChats = chatItems.slice(chatPage * ITEM_PER_PAGE, (chatPage + 1) * ITEM_PER_PAGE);

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
            {Math.min(totalUnread, 99)}
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

          <div className="mt-4 max-h-[70vh] overflow-y-auto no-scrollbar pb-2">

            {/* 문의 알림 헤더 */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowInquiries(!showInquiries)}
                  className="flex flex-1 items-center gap-2 text-sm font-semibold text-gray-900 group"
                >
                  <NotebookPen size={16} className="text-emerald-700" />
                  {session?.user?.role === 'INSTRUCTOR' ? '받은 문의 보기' : '문의 현황'}
                  {showInquiries ? <ChevronUp size={14} className="text-gray-400 group-hover:text-emerald-600" /> : <ChevronDown size={14} className="text-gray-400 group-hover:text-emerald-600" />}
                </button>
                <Link
                  href={session?.user?.role === 'INSTRUCTOR' ? '/teacher#inquiries' : '/profile'}
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 ml-2 whitespace-nowrap bg-emerald-50 px-2 py-1 rounded-md"
                >
                  게시판 이동
                </Link>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {pendingInquiriesCount > 0
                  ? (session?.user?.role === 'INSTRUCTOR' ? `새로운 문의 ${pendingInquiriesCount}건이 대기 중입니다.` : `내 문의 내역 ${pendingInquiriesCount}건을 확인해주세요.`)
                  : '새롭게 확인할 문의는 없습니다.'}
              </p>
            </div>

            {/* 문의 알림 본문 */}
            {showInquiries && pendingInquiryList.length > 0 && (
              <div className="space-y-2 mt-2 pl-2">
                {currentInquiries.map((item) => (
                  <Link
                    key={item.inquiryId}
                    href={item.chatRoomId ? `/chat/${item.chatRoomId}` : '/teacher#inquiries'}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-semibold text-amber-900">{item.purpose || '새로운 문의가 도착했습니다'}</p>
                      <span className="shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        수락 대기
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-amber-700">여기를 눌러 수락하고 채팅을 시작하세요.</p>
                  </Link>
                ))}

                {inquiryTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 py-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setInquiryPage((p) => Math.max(0, p - 1))}
                      disabled={inquiryPage === 0}
                      className="p-1 text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors bg-white rounded-full shadow-sm border border-gray-100"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[11px] font-semibold text-gray-500 tracking-widest">
                      {inquiryPage + 1} / {inquiryTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInquiryPage((p) => Math.min(inquiryTotalPages - 1, p + 1))}
                      disabled={inquiryPage === inquiryTotalPages - 1}
                      className="p-1 text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors bg-white rounded-full shadow-sm border border-gray-100"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 채팅 알림 헤더 */}
            <div className={`rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 ${showInquiries && pendingInquiryList.length > 0 ? 'mt-4' : 'mt-2'}`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowChats(!showChats)}
                  className="flex flex-1 items-center gap-2 text-sm font-semibold text-gray-900 group"
                >
                  <MessageCircle size={16} className="text-emerald-700" />
                  채팅 알림 조회
                  {showChats ? <ChevronUp size={14} className="text-gray-400 group-hover:text-emerald-600" /> : <ChevronDown size={14} className="text-gray-400 group-hover:text-emerald-600" />}
                </button>
                <Link
                  href="/chat"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 ml-2 whitespace-nowrap bg-emerald-50 px-2 py-1 rounded-md"
                >
                  게시판 이동
                </Link>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {chatItems.length > 0 ? `읽지 않은 채팅 ${chatItems.length}건이 있습니다.` : '새 채팅 알림은 없습니다.'}
              </p>
            </div>

            {/* 채팅 알림 본문 */}
            {showChats && chatItems.length > 0 && (
              <div className="space-y-2 mt-2 pl-2">
                {currentChats.map((item) => (
                  <Link
                    key={item.id}
                    href={`/chat/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl border border-transparent bg-emerald-50/60 px-4 py-3 hover:border-emerald-200 transition-colors"
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

                {chatTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 py-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setChatPage((p) => Math.max(0, p - 1))}
                      disabled={chatPage === 0}
                      className="p-1 text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors bg-white rounded-full shadow-sm border border-gray-100"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[11px] font-semibold text-gray-500 tracking-widest">
                      {chatPage + 1} / {chatTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChatPage((p) => Math.min(chatTotalPages - 1, p + 1))}
                      disabled={chatPage === chatTotalPages - 1}
                      className="p-1 text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors bg-white rounded-full shadow-sm border border-gray-100"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
