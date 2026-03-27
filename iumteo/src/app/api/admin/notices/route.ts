import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { gasPost } from '@/lib/gas-api';
import {
  getFirestoreAdmin,
  isFirebaseMirrorEnabled,
  isFirebaseTimeoutError,
  runWithFirebaseTimeout,
} from '@/lib/firebase-admin';

type NoticeTag = '중요' | '안내' | '공지';

type NoticeItem = {
  id: string;
  tag: NoticeTag;
  tagColor: string;
  title: string;
  body: string;
  date: string;
  createdAt: number;
};

const COLLECTION = 'notices';
const NOTICE_TAGS: NoticeTag[] = ['중요', '안내', '공지'];

function tagColor(tag: NoticeTag) {
  if (tag === '중요') return 'bg-red-100 text-red-700';
  if (tag === '안내') return 'bg-sky-100 text-sky-700';
  return 'bg-emerald-100 text-emerald-700';
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export async function GET() {
  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json({ ok: true, success: true, notices: [], degraded: true });
    }

    const db = getFirestoreAdmin();
    const snapshot = await runWithFirebaseTimeout(
      db.collection(COLLECTION).orderBy('createdAt', 'desc').get(),
      'load notices',
    );

    const notices: NoticeItem[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const tag = (data.tag || '공지') as NoticeTag;
      const createdAt = Number(data.createdAt || Date.now());

      return {
        id: doc.id,
        tag,
        tagColor: tagColor(tag),
        title: String(data.title || ''),
        body: String(data.body || ''),
        date: formatDate(createdAt),
        createdAt,
      };
    });

    return NextResponse.json({ ok: true, success: true, notices });
  } catch (error) {
    console.error('[GET /api/admin/notices]', error);

    if (isFirebaseTimeoutError(error)) {
      return NextResponse.json({
        ok: true,
        success: true,
        notices: [],
        degraded: true,
        warning: '공지 저장소 응답이 지연되어 임시로 빈 목록을 보여드립니다.',
      });
    }

    return NextResponse.json({ ok: false, success: false, error: '공지 목록 조회에 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json({ ok: false, error: '공지 기능을 사용하려면 Firebase 설정이 필요합니다.' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자만 공지를 작성할 수 있습니다.' }, { status: 403 });
    }

    const payload = (await request.json()) as { tag?: NoticeTag; title?: string; body?: string };
    const tag = payload.tag || '공지';
    const title = payload.title?.trim() || '';
    const body = payload.body?.trim() || '';

    if (!NOTICE_TAGS.includes(tag) || !title || !body) {
      return NextResponse.json({ ok: false, error: 'tag, title, body는 모두 필요합니다.' }, { status: 400 });
    }

    const db = getFirestoreAdmin();
    const createdAt = Date.now();
    const docRef = await runWithFirebaseTimeout(
      db.collection(COLLECTION).add({
        tag,
        title,
        body,
        createdAt,
        createdBy: session.user.email || 'admin',
      }),
      'create notice',
    );

    try {
      await gasPost({
        action: 'addNotice',
        noticeId: docRef.id,
        tag,
        title,
        body,
        date: formatDate(createdAt),
        createdBy: session.user.email || 'admin',
      });
    } catch (gasError) {
      console.warn('[POST /api/admin/notices] GAS sync failed:', gasError);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      notice: {
        id: docRef.id,
        tag,
        tagColor: tagColor(tag),
        title,
        body,
        date: formatDate(createdAt),
        createdAt,
      },
    });
  } catch (error) {
    console.error('[POST /api/admin/notices]', error);

    if (isFirebaseTimeoutError(error)) {
      return NextResponse.json({ ok: false, error: '공지 저장소 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
    }

    return NextResponse.json({ ok: false, error: '공지 저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isFirebaseMirrorEnabled()) {
      return NextResponse.json({ ok: false, error: '공지 기능을 사용하려면 Firebase 설정이 필요합니다.' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자만 공지를 삭제할 수 있습니다.' }, { status: 403 });
    }

    const payload = (await request.json()) as { id?: string };
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: 'id는 필수입니다.' }, { status: 400 });
    }

    const db = getFirestoreAdmin();
    await runWithFirebaseTimeout(db.collection(COLLECTION).doc(payload.id).delete(), 'delete notice');

    try {
      await gasPost({
        action: 'deleteNotice',
        noticeId: payload.id,
      });
    } catch (gasError) {
      console.warn('[DELETE /api/admin/notices] GAS sync failed:', gasError);
    }

    return NextResponse.json({ ok: true, success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/notices]', error);

    if (isFirebaseTimeoutError(error)) {
      return NextResponse.json({ ok: false, error: '공지 저장소 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
    }

    return NextResponse.json({ ok: false, error: '공지 삭제에 실패했습니다.' }, { status: 500 });
  }
}
