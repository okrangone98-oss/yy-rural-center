import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getFirestoreAdmin, isFirebaseMirrorEnabled, runWithFirebaseTimeout } from '@/lib/firebase-admin';
import { CHAT_ROOM_MAX_LENGTH, type ChatMessage, type ChatRoom } from '@/lib/domain';

function nowIso() {
  return new Date().toISOString();
}

function noopResult<T>(data: T) {
  return { enabled: false, skipped: true, data };
}

function getChatRoomsCollection() {
  return getFirestoreAdmin().collection('chat_rooms');
}

export async function createChatRoom(room: ChatRoom) {
  if (!isFirebaseMirrorEnabled()) return noopResult(room);

  const now = nowIso();
  const roomData: ChatRoom = {
    ...room,
    status: room.status ?? 'PENDING',
    totalLength: room.totalLength ?? 0,
    lastMessage: room.lastMessage ?? '',
    lastMessageAt: room.lastMessageAt ?? now,
    firstMessageNotified: room.firstMessageNotified ?? false,
    unreadCount: room.unreadCount ?? { [room.memberEmail]: 0, [room.instructorEmail]: 0 },
    hiddenFor: room.hiddenFor ?? [],
    createdAt: room.createdAt ?? now,
    updatedAt: room.updatedAt ?? now,
  };

  await runWithFirebaseTimeout(getChatRoomsCollection().doc(room.id).set(roomData, { merge: true }), 'create chat room');
  return { enabled: true, skipped: false, data: roomData };
}

export async function getChatRoom(roomId: string): Promise<ChatRoom | null> {
  if (!isFirebaseMirrorEnabled()) return null;

  const snapshot = await runWithFirebaseTimeout(getChatRoomsCollection().doc(roomId).get(), 'get chat room');
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() } as ChatRoom;
}

export async function findChatRoomByInquiryId(inquiryId: string): Promise<ChatRoom | null> {
  if (!isFirebaseMirrorEnabled()) return null;

  const snapshot = await runWithFirebaseTimeout(
    getChatRoomsCollection().where('inquiryId', '==', inquiryId).limit(1).get(),
    'find chat room by inquiry',
  );

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as ChatRoom;
}

export async function findChatRoomsByInquiryIds(inquiryIds: string[]) {
  if (!isFirebaseMirrorEnabled() || inquiryIds.length === 0) return {} as Record<string, ChatRoom>;

  const roomMap: Record<string, ChatRoom> = {};
  const uniqueIds = Array.from(new Set(inquiryIds.filter(Boolean)));

  for (let index = 0; index < uniqueIds.length; index += 10) {
    const chunk = uniqueIds.slice(index, index + 10);
    const snapshot = await runWithFirebaseTimeout(
      getChatRoomsCollection().where('inquiryId', 'in', chunk).get(),
      'find chat rooms by inquiry ids',
    );

    snapshot.docs.forEach((doc) => {
      const room = { id: doc.id, ...doc.data() } as ChatRoom;
      if (room.inquiryId) {
        roomMap[room.inquiryId] = room;
      }
    });
  }

  return roomMap;
}

function sortRooms(rooms: ChatRoom[]) {
  return rooms.sort(
    (a, b) =>
      new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime() -
      new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime(),
  );
}

export async function findChatRoomsForUser(email: string, role: string) {
  if (!isFirebaseMirrorEnabled()) return [] as ChatRoom[];

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return [];

  if (role === 'ADMIN') {
    const snapshot = await runWithFirebaseTimeout(getChatRoomsCollection().limit(200).get(), 'list admin chat rooms');
    return sortRooms(
      snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as ChatRoom))
        .filter((room) => !(room.hiddenFor || []).includes(normalizedEmail)),
    );
  }

  const field = role === 'INSTRUCTOR' ? 'instructorEmail' : 'memberEmail';
  const snapshot = await runWithFirebaseTimeout(
    getChatRoomsCollection().where(field, '==', normalizedEmail).get(),
    'list user chat rooms',
  );
  return sortRooms(
    snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ChatRoom))
      .filter((room) => !(room.hiddenFor || []).includes(normalizedEmail)),
  );
}

export async function getChatMessages(roomId: string) {
  if (!isFirebaseMirrorEnabled()) return [] as ChatMessage[];

  const snapshot = await runWithFirebaseTimeout(
    getChatRoomsCollection().doc(roomId).collection('messages').orderBy('createdAt', 'asc').get(),
    'get chat messages',
  );

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage));
}

export type SendMessageResult =
  | { ok: true; message: ChatMessage; newTotalLength: number; notifyFirst: boolean }
  | {
      ok: false;
      reason: 'ROOM_NOT_FOUND' | 'ROOM_PENDING' | 'ROOM_ARCHIVED' | 'LIMIT_EXCEEDED' | 'FORBIDDEN';
    };

export async function sendChatMessage(
  roomId: string,
  message: ChatMessage,
  senderEmail: string,
  role: string,
): Promise<SendMessageResult> {
  if (!isFirebaseMirrorEnabled()) {
    return { ok: true, message, newTotalLength: message.content.length, notifyFirst: false };
  }

  const roomRef = getChatRoomsCollection().doc(roomId);
  const messageRef = roomRef.collection('messages').doc(message.id);

  return runWithFirebaseTimeout(
    getFirestoreAdmin().runTransaction(async (tx) => {
      const roomSnapshot = await tx.get(roomRef);
      if (!roomSnapshot.exists) return { ok: false as const, reason: 'ROOM_NOT_FOUND' as const };

      const room = { id: roomSnapshot.id, ...roomSnapshot.data() } as ChatRoom;
      const isParticipant =
        room.memberEmail === senderEmail ||
        room.instructorEmail === senderEmail ||
        role === 'ADMIN';

      if (!isParticipant) return { ok: false as const, reason: 'FORBIDDEN' as const };
      if (room.status === 'PENDING') return { ok: false as const, reason: 'ROOM_PENDING' as const };
      if (room.status === 'ARCHIVED') return { ok: false as const, reason: 'ROOM_ARCHIVED' as const };

      const currentLength = room.totalLength ?? 0;
      const nextLength = currentLength + message.content.length;
      if (nextLength > CHAT_ROOM_MAX_LENGTH) {
        return { ok: false as const, reason: 'LIMIT_EXCEEDED' as const };
      }

      const recipientEmail = senderEmail === room.memberEmail ? room.instructorEmail : room.memberEmail;
      const notifyFirst = !room.firstMessageNotified;
      const now = nowIso();

      tx.set(messageRef, { ...message, createdAt: now });
      tx.set(
        roomRef,
        {
          totalLength: nextLength,
          lastMessage: message.content.slice(0, 120),
          lastMessageAt: now,
          updatedAt: now,
          firstMessageNotified: notifyFirst ? true : room.firstMessageNotified,
          unreadCount: {
            ...(room.unreadCount || {}),
            [recipientEmail]: (room.unreadCount?.[recipientEmail] ?? 0) + 1,
          },
          hiddenFor: (room.hiddenFor || []).filter(
            (hiddenEmail) => hiddenEmail !== senderEmail && hiddenEmail !== recipientEmail,
          ),
        },
        { merge: true },
      );

      return { ok: true as const, message: { ...message, createdAt: now }, newTotalLength: nextLength, notifyFirst };
    }),
    'send chat message',
  );
}

export async function acceptChatRoom(roomId: string) {
  if (!isFirebaseMirrorEnabled()) return false;

  await runWithFirebaseTimeout(
    getChatRoomsCollection().doc(roomId).set(
      {
        status: 'ACTIVE',
        updatedAt: nowIso(),
      },
      { merge: true },
    ),
    'accept chat room',
  );

  return true;
}

export async function markChatRoomRead(roomId: string, email: string) {
  if (!isFirebaseMirrorEnabled()) return false;

  await runWithFirebaseTimeout(
    getChatRoomsCollection().doc(roomId).set(
      {
        unreadCount: {
          [email]: 0,
        },
        updatedAt: nowIso(),
      },
      { merge: true },
    ),
    'mark chat room read',
  );

  return true;
}

export async function archiveChatRoom(roomId: string) {
  if (!isFirebaseMirrorEnabled()) return false;

  await runWithFirebaseTimeout(
    getChatRoomsCollection().doc(roomId).set(
      {
        status: 'ARCHIVED',
        archivedAt: nowIso(),
        expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: nowIso(),
      },
      { merge: true },
    ),
    'archive chat room',
  );

  return true;
}

export async function closeChatRoom(roomId: string, email: string, role: string) {
  if (!isFirebaseMirrorEnabled()) return { ok: false as const, reason: 'DISABLED' as const };

  const normalizedEmail = email.trim().toLowerCase();
  const roomRef = getChatRoomsCollection().doc(roomId);

  return runWithFirebaseTimeout(
    getFirestoreAdmin().runTransaction(async (tx) => {
      const roomSnapshot = await tx.get(roomRef);
      if (!roomSnapshot.exists) return { ok: false as const, reason: 'ROOM_NOT_FOUND' as const };

      const room = { id: roomSnapshot.id, ...roomSnapshot.data() } as ChatRoom;
      const isParticipant =
        room.memberEmail === normalizedEmail ||
        room.instructorEmail === normalizedEmail ||
        role === 'ADMIN';

      if (!isParticipant) return { ok: false as const, reason: 'FORBIDDEN' as const };

      const hiddenFor = Array.from(new Set([...(room.hiddenFor || []), normalizedEmail]));
      tx.set(
        roomRef,
        {
          hiddenFor,
          updatedAt: nowIso(),
        },
        { merge: true },
      );

      return { ok: true as const };
    }),
    'close chat room',
  );
}

export async function incrementRoomUnread(roomId: string, recipientEmail: string) {
  if (!isFirebaseMirrorEnabled()) return false;

  await runWithFirebaseTimeout(
    getChatRoomsCollection().doc(roomId).set(
      {
        [`unreadCount.${recipientEmail}`]: FieldValue.increment(1),
        updatedAt: nowIso(),
      },
      { merge: true },
    ),
    'increment room unread',
  );

  return true;
}
