import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

const GAS_API_URL = process.env.GAS_API_URL || '';
const GAS_API_KEY = process.env.GAS_API_KEY || '';

const STATUS_KEYS = ['status', '상태'] as const;
const LOCAL_KEYS = ['isLocal', '로컬', '로컬여부'] as const;
const SAMPLE_KEYS = ['isSample'] as const;
const EMAIL_KEYS = ['이메일', '로그인용 이메일', 'Email', 'email'] as const;

function pickFirstValue(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function normalizeStatus(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '대기';
}

function normalizeYesNo(value: unknown): 'Y' | 'N' {
  if (value === true || value === 1) return 'Y';
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (['Y', 'YES', 'TRUE', '1'].includes(normalized)) return 'Y';
  }
  return 'N';
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'y', 'yes', '1'].includes(normalized)) return true;
    if (['false', 'n', 'no', '0', ''].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeInstructorRecord(record: Record<string, unknown>) {
  const status = normalizeStatus(pickFirstValue(record, STATUS_KEYS));
  const isLocal = normalizeYesNo(pickFirstValue(record, LOCAL_KEYS));
  const isSample = normalizeBoolean(pickFirstValue(record, SAMPLE_KEYS), true);

  return {
    ...record,
    status,
    '상태': record['상태'] ?? status,
    isLocal,
    isSample,
  };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');
    const isAdmin = session?.user?.role === 'ADMIN';

    let url = `${GAS_API_URL}?apiKey=${encodeURIComponent(GAS_API_KEY)}`;

    if (emailParam) {
      url += `&action=getUser&email=${encodeURIComponent(emailParam)}`;
    } else {
      url += `&action=getInstructors`;
      if (isAdmin) {
        url += `&includeAll=Y`;
      }
    }

    const gasRes = await fetch(url, { cache: 'no-store' });
    const result = await gasRes.json();

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message || '데이터를 불러오지 못했습니다.' }, { status: 400 });
    }

    const isOwner = (itemEmail: string) => session?.user?.email === itemEmail;
    const applyBlindPolicy = (instructor: Record<string, unknown>) => {
      const normalized = normalizeInstructorRecord(instructor);
      const ownerEmail = String(pickFirstValue(normalized, EMAIL_KEYS) || '');

      if (isAdmin || isOwner(ownerEmail)) {
        return normalized;
      }

      return {
        ...normalized,
        '연락처': '*** (센터 문의)',
        '전화번호': '*** (센터 문의)',
        '이메일': '*** (센터 문의)',
        '사용자비번': '********',
      };
    };

    let data = result.data;

    if (Array.isArray(data)) {
      data = data.map((item) => applyBlindPolicy(item));
    } else if (data) {
      data = applyBlindPolicy(data);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Instructor GET API Error:', error);
    return NextResponse.json({ success: false, message: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: '인증되지 않은 요청입니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, email, data } = body;

    const isAdmin = session.user.role === 'ADMIN';
    const isOwner = session.user.email === email;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, message: '수정 권한이 없습니다.' }, { status: 403 });
    }

    const payload = {
      apiKey: GAS_API_KEY,
      action: action || 'updateInstructorProfile',
      email,
      profileData: data,
    };

    const gasRes = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await gasRes.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Instructor POST API Error:', error);
    return NextResponse.json({ success: false, message: '서버 오류' }, { status: 500 });
  }
}
