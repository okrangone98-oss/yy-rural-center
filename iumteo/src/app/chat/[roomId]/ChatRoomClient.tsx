'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Archive, CheckCircle2, MessageCircle, Send, X } from 'lucide-react';
import {
  CHAT_ROOM_MAX_LENGTH,
  CHAT_ROOM_WARN_LENGTH,
  type ChatMessage,
  type ChatRoom,
} from '@/lib/domain';
import { getAppPath } from '@/lib/app-url';
import { getClientFirestore, isClientFirestoreEnabled } from '@/lib/firebase-client';

interface ChatRoomClientProps {
  roomId: string;
  initialRoom: ChatRoom;
  initialMessages: ChatMessage[];
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ChatRoomClient({
  roomId,
  initialRoom,
  initialMessages,
}: ChatRoomClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const myEmail = session?.user?.email || '';
  const myRole = session?.user?.role || '';
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [actionState, setActionState] = useState<'sending' | 'accepting' | 'archiving' | 'closing' | null>(null);
  const [error, setError] = useState('');

  const sending = actionState === 'sending';
  const accepting = actionState === 'accepting';
  const archiving = actionState === 'archiving';
  const closing = actionState === 'closing';
  const [refreshTick, setRefreshTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isInstructor = myRole === 'INSTRUCTOR' && room.instructorEmail === myEmail;
  const isAdmin = myRole === 'ADMIN';
  const canModerate = isInstructor || isAdmin;
  const isPending = room.status === 'PENDING';
  const isArchived = room.status === 'ARCHIVED';
  const totalLength = room.totalLength ?? 0;
  const remaining = CHAT_ROOM_MAX_LENGTH - totalLength;
  const isWarning = totalLength >= CHAT_ROOM_WARN_LENGTH;
  const isLimitReached = totalLength >= CHAT_ROOM_MAX_LENGTH;
  const canAccept = canModerate && isPending;
  const canArchive = canModerate && room.status === 'ACTIVE';
  const canClose = !!myEmail;
  const isReadOnly = isPending || isArchived || isLimitReached;

  const progressTone = useMemo(() => {
    if (isLimitReached) return 'bg-red-500';
    if (isWarning) return 'bg-amber-400';
    return 'bg-emerald-500';
  }, [isLimitReached, isWarning]);

  const refreshRoom = useCallback(async () => {
    try {
      const response = await fetch(getAppPath(`/api/chat/rooms/${roomId}`), { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) return;

      setRoom(result.data.room);
      setMessages(result.data.messages);
    } catch {
      // Polling errors are ignored to keep the UI calm while retrying.
    }
  }, [roomId]);

  useEffect(() => {
    void fetch(getAppPath(`/api/chat/rooms/${roomId}/read`), { method: 'POST' });
  }, [roomId, refreshTick]);

  // Firestore onSnapshot 실시간 리스너 (NEXT_PUBLIC_FIREBASE_* 미설정 시 폴링으로 fallback)
  useEffect(() => {
    if (isClientFirestoreEnabled()) {
      const db = getClientFirestore();
      if (db) {
        const { collection, doc, onSnapshot, orderBy, query } = require('firebase/firestore') as typeof import('firebase/firestore');
        const roomRef = doc(db, 'chatRooms', roomId);
        const messagesRef = query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('createdAt', 'asc'));

        const unsubRoom = onSnapshot(roomRef, (snap: import('firebase/firestore').DocumentSnapshot) => {
          if (snap.exists()) setRoom(snap.data() as ChatRoom);
        });
        const unsubMessages = onSnapshot(messagesRef, (snap: import('firebase/firestore').QuerySnapshot) => {
          setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
        });

        return () => { unsubRoom(); unsubMessages(); };
      }
    }

    // fallback: 5초 폴링
    const interval = window.setInterval(() => { void refreshRoom(); }, 5000);
    return () => window.clearInterval(interval);
  }, [roomId, refreshRoom]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAccept = useCallback(async () => {
    if (!canAccept || accepting) return;

    setActionState('accepting');
    setError('');

    try {
      const response = await fetch(getAppPath(`/api/chat/rooms/${roomId}/accept`), { method: 'POST' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '문의 수락에 실패했습니다.');
      }

      await refreshRoom();
      setRefreshTick((value) => value + 1);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : '문의 수락에 실패했습니다.');
    } finally {
      setActionState(null);
    }
  }, [accepting, canAccept, refreshRoom, roomId]);

  const handleArchive = useCallback(async () => {
    if (!canArchive || archiving) return;

    setActionState('archiving');
    setError('');

    try {
      const response = await fetch(getAppPath(`/api/chat/rooms/${roomId}/archive`), { method: 'POST' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '문의 종료에 실패했습니다.');
      }

      await refreshRoom();
      setRefreshTick((value) => value + 1);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : '문의 종료에 실패했습니다.');
    } finally {
      setActionState(null);
    }
  }, [archiving, canArchive, refreshRoom, roomId]);

  const handleClose = useCallback(async () => {
    if (!canClose || closing) return;

    setActionState('closing');
    setError('');

    try {
      const response = await fetch(getAppPath(`/api/chat/rooms/${roomId}/close`), { method: 'POST' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '채팅방 닫기에 실패했습니다.');
      }

      router.push('/chat');
      router.refresh();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : '채팅방 닫기에 실패했습니다.');
      setActionState(null);
    }
  }, [canClose, closing, roomId, router]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending || isReadOnly) return;

    setActionState('sending');
    setError('');

    try {
      const response = await fetch(getAppPath(`/api/chat/rooms/${roomId}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || '메시지 전송에 실패했습니다.');
      }

      setMessages((prev) => [...prev, result.data.message]);
      setRoom((prev) => ({
        ...prev,
        status: 'ACTIVE',
        totalLength: result.data.newTotalLength,
        lastMessage: result.data.message.content,
        lastMessageAt: result.data.message.createdAt,
      }));
      setInput('');
      setRefreshTick((value) => value + 1);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '메시지 전송에 실패했습니다.');
    } finally {
      setActionState(null);
    }
  }, [input, isReadOnly, roomId, sending]);

  return (
    <div className="flex min-h-[70vh] flex-col bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {isInstructor ? room.memberName : room.instructorName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isPending ? '강사 수락 대기 중' : isArchived ? '문의 완료' : '채팅 가능'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAccept ? (
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                {accepting ? '수락 중...' : '문의 수락'}
              </button>
            ) : null}

            {canArchive ? (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Archive size={16} />
                {archiving ? '종료 중...' : '문의 완료'}
              </button>
            ) : null}
            {canClose ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={closing}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <X size={16} />
                {closing ? '닫는 중..' : '목록에서 닫기'}
              </button>
            ) : null}
          </div>
        </div>

        {isPending ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {canAccept
              ? '문의가 접수되었습니다. 수락하면 바로 채팅을 시작할 수 있습니다.'
              : '강사가 문의를 수락하면 채팅을 시작할 수 있습니다.'}
          </div>
        ) : null}

        {isArchived ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            종료된 문의입니다. 현재는 읽기 전용으로만 확인할 수 있습니다.
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <MessageCircle size={30} className="mb-3" />
            <p className="text-sm">아직 채팅 메시지가 없습니다.</p>
            <p className="mt-1 text-xs">문의 수락 후 이곳에서 대화를 이어갈 수 있습니다.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderEmail === myEmail;

            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${
                    isMine ? 'bg-emerald-600 text-white' : 'bg-white text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  <p className={`mt-2 text-[11px] ${isMine ? 'text-emerald-50/80' : 'text-gray-400'}`}>
                    {message.senderName} · {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 bg-white px-5 py-4">
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>
              {isLimitReached
                ? '채팅 누적 글자 수 300자에 도달했습니다.'
                : isWarning
                ? `남은 글자 수 ${remaining}자`
                : '채팅 누적 글자 수'}
            </span>
            <span>
              {totalLength} / {CHAT_ROOM_MAX_LENGTH}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${progressTone}`}
              style={{ width: `${Math.min((totalLength / CHAT_ROOM_MAX_LENGTH) * 100, 100)}%` }}
            />
          </div>
        </div>

        {error ? (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : null}

        {isReadOnly ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            {isPending
              ? '강사 수락 이후 대화를 시작할 수 있습니다.'
              : isArchived
              ? '문의가 종료되어 더 이상 메시지를 보낼 수 없습니다.'
              : '누적 글자 수 제한에 도달했습니다.'}
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="메시지를 입력해 주세요."
              rows={3}
              className="min-h-[84px] flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
              aria-label="메시지 전송"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
