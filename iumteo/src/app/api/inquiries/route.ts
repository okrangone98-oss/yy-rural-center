import { NextResponse } from 'next/server';
import {
  inquiryCreateSchema,
  type ChatRoom,
  type MailOutboxEntry,
  type MirrorInquiry,
} from '@/lib/domain';
import { assertGasSuccess, gasGet, gasPost, isGasConfigured, type GasEnvelope } from '@/lib/gas-api';
import { createChatRoom } from '@/lib/chat-store';
import { createMirrorInquiry } from '@/lib/firestore-mirror';
import { isMailConfigured, sendManagedMail } from '@/lib/mail';
import { getAppPath } from '@/lib/app-url';
import { getRequiredSession } from '@/lib/rbac';
import { normalizeEmail, pickByAliases, rowsToRecords, parseCsv, type CsvRecord } from '@/lib/sheets';

const MONTHLY_LIMIT = 20;
const CSV_INQUIRY_DB_URL =
  process.env.CSV_INQUIRY_DB_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf/pub?gid=1950022642&single=true&output=csv';

function sanitizeInquiryId(inquiryId: string) {
  return inquiryId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeInquiry(record: CsvRecord, index: number) {
  return {
    inquiryId: pickByAliases(record, ['inquiryId']) || `sheet-${index + 2}`,
    teacherName: pickByAliases(record, ['문의대상 강사명', 'teacherName', '강사명']) || '',
    teacherEmail: normalizeEmail(pickByAliases(record, ['강사 이메일', 'teacherEmail', 'Teacher_Email'])),
    inquirerName: pickByAliases(record, ['신청인 성명', '문의자명', 'inquirerName']) || '',
    inquirerPhone: pickByAliases(record, ['신청인 연락처', 'inquirerPhone', '연락처', '전화번호']) || '',
    inquirerEmail: normalizeEmail(pickByAliases(record, ['회신받을 이메일', 'inquirerEmail', '이메일', 'email'])),
    purpose: pickByAliases(record, ['문의 목적', 'purpose']) || '',
    message: pickByAliases(record, ['상세 내용', '문의내용', 'message']) || '',
    status: pickByAliases(record, ['처리 상태', 'status']) || '접수대기',
    createdAt: pickByAliases(record, ['접수일시', 'createdAt']) || '',
  };
}

async function fetchInquiryRows() {
  try {
    const result = assertGasSuccess(
      await gasGet<GasEnvelope<CsvRecord[]>>(new URLSearchParams({ action: 'getInquiries' })),
      'getInquiries',
    );
    return Array.isArray(result.data) ? result.data : [];
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : '';
    if (!message.toLowerCase().includes('unknown action') && !message.includes('최신')) {
      throw fetchError;
    }

    const response = await fetch(`${CSV_INQUIRY_DB_URL}&t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('문의 이력을 불러오지 못했습니다.');
    }

    return rowsToRecords(parseCsv(await response.text()));
  }
}

function calculateQuota(
  rows: CsvRecord[],
  inquirerEmail: string,
  teacherName?: string,
  teacherEmail?: string,
) {
  const normalizedUserEmail = normalizeEmail(inquirerEmail);
  const normalizedTeacherEmail = normalizeEmail(teacherEmail || '');
  const normalizedTeacherName = String(teacherName || '').trim();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const matched = rows
    .map(normalizeInquiry)
    .filter((item) => {
      if (item.inquirerEmail !== normalizedUserEmail) return false;

      const matchesTeacher =
        (normalizedTeacherEmail && item.teacherEmail === normalizedTeacherEmail) ||
        (!normalizedTeacherEmail && normalizedTeacherName && item.teacherName === normalizedTeacherName);

      if (!matchesTeacher) return false;

      const createdMonth = String(item.createdAt || '').slice(0, 7);
      return createdMonth === currentMonth;
    });

  const usedCount = matched.length;
  const remainingCount = Math.max(0, MONTHLY_LIMIT - usedCount);

  return {
    monthlyLimit: MONTHLY_LIMIT,
    usedCount,
    remainingCount,
    canSend: remainingCount > 0,
    recent: matched.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5),
  };
}

function formatInquiryContact(contactMethod: 'PHONE' | 'EMAIL' | 'NONE', contactValue: string) {
  if (contactMethod === 'NONE') {
    return '선택 안 함';
  }

  return contactValue.trim();
}

function buildCenterMail(entry: MirrorInquiry): MailOutboxEntry | null {
  const to = process.env.CENTER_NOTIFICATION_EMAIL;
  if (!to) return null;

  return {
    id: `${entry.id}-center`,
    category: 'CENTER_INQUIRY',
    to,
    subject: `[양양 이음터 문의 접수] ${entry.teacherName} / ${entry.inquirerName}`,
    html: `
      <div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
        <h2 style="margin:0 0 16px;color:#0f4d3a;">강사 문의가 접수되었습니다.</h2>
        <p><strong>대상 강사:</strong> ${entry.teacherName}</p>
        <p><strong>문의자:</strong> ${entry.inquirerName}</p>
        <p><strong>연락처:</strong> ${entry.inquirerPhone}</p>
        <p><strong>이메일:</strong> ${entry.inquirerEmail}</p>
        <p><strong>문의 목적:</strong> ${entry.purpose}</p>
        <p><strong>문의 내용:</strong><br/>${entry.message || '-'}</p>
      </div>
    `,
    relatedInquiryId: entry.id,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };
}

function buildTeacherMail(entry: MirrorInquiry, roomId: string, request: Request): MailOutboxEntry | null {
  if (!entry.teacherEmail) return null;

  const chatUrl = new URL(getAppPath(`/chat/${roomId}`), request.url).toString();

  return {
    id: `${entry.id}-teacher`,
    category: 'TEACHER_FORWARD',
    to: entry.teacherEmail,
    subject: `[양양 이음터] ${entry.inquirerName}님 문의가 도착했습니다`,
    html: `
      <div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
        <h2 style="margin:0 0 16px;color:#0f4d3a;">새 문의가 도착했습니다.</h2>
        <p style="margin:0 0 12px;color:#374151;">${entry.teacherName} 강사님에게 새로운 문의가 등록되었습니다.</p>
        <p><strong>문의자:</strong> ${entry.inquirerName}</p>
        <p><strong>연락처:</strong> ${entry.inquirerPhone}</p>
        <p><strong>이메일:</strong> ${entry.inquirerEmail}</p>
        <p><strong>문의 목적:</strong> ${entry.purpose}</p>
        <div style="margin-top:16px;border:1px solid #d1fae5;border-radius:12px;padding:14px 16px;background:#f0fdf4;color:#166534;white-space:pre-wrap;">${entry.message || '-'}</div>
        <p style="margin-top:18px;color:#4b5563;">로그인 후 문의를 수락하면 채팅을 시작할 수 있습니다.</p>
        <a href="${chatUrl}" style="display:inline-block;margin-top:10px;background:#0f4d3a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">
          문의 확인하기
        </a>
      </div>
    `,
    relatedInquiryId: entry.id,
    relatedRoomId: roomId,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { session, error } = await getRequiredSession(['USER', 'ADMIN', 'INSTRUCTOR']);
  if (error) return error;

  try {
    if (!isGasConfigured() && !CSV_INQUIRY_DB_URL) {
      return NextResponse.json(
        { success: false, message: '문의 조회 설정이 아직 완료되지 않았습니다. 관리자 환경변수를 확인해 주세요.' },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const teacherName = searchParams.get('teacherName') || '';
    const teacherEmail = searchParams.get('teacherEmail') || '';

    const rows = await fetchInquiryRows();
    const quota = calculateQuota(rows, session.user.email || '', teacherName, teacherEmail);

    return NextResponse.json({
      success: true,
      quota: {
        monthlyLimit: quota.monthlyLimit,
        usedCount: quota.usedCount,
        remainingCount: quota.remainingCount,
        canSend: quota.canSend,
      },
      data: quota.recent,
    });
  } catch (fetchError) {
    return NextResponse.json(
      {
        success: false,
        message: fetchError instanceof Error ? fetchError.message : '문의 가능 횟수를 확인하지 못했습니다.',
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await getRequiredSession(['USER', 'ADMIN', 'INSTRUCTOR']);
  if (error) return error;

  try {
    if (!isGasConfigured()) {
      return NextResponse.json(
        { success: false, message: '문의 접수 설정이 아직 완료되지 않았습니다. 관리자 환경변수를 확인해 주세요.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = inquiryCreateSchema.parse(body);
    const requesterEmail = normalizeEmail(parsed.requesterEmail);
    const replyContact = formatInquiryContact(parsed.contactMethod, parsed.contactValue);
    const rows = await fetchInquiryRows();
    const quota = calculateQuota(rows, requesterEmail, parsed.teacherName, parsed.teacherEmail);

    if (!quota.canSend) {
      return NextResponse.json(
        {
          success: false,
          code: 'MONTHLY_LIMIT',
          message: '이번 달 문의 가능 횟수 20회를 모두 사용했습니다.',
        },
        { status: 429 },
      );
    }

    const now = new Date().toISOString();
    const sheetResult = assertGasSuccess(
      await gasPost<GasEnvelope<Record<string, unknown>>>({
        action: 'inquiry',
        teacherName: parsed.teacherName,
        teacherEmail: parsed.teacherEmail,
        inquirerName: parsed.inquirerName,
        inquirerPhone: replyContact,
        inquirerEmail: requesterEmail,
        contactMethod: parsed.contactMethod,
        contactValue: parsed.contactValue,
        purpose: parsed.purpose,
        message: parsed.message,
        status: '접수대기',
      }),
      'inquiry',
    );

    const rowIndex = sheetResult?.data?.rowIndex;
    const inquiryId = rowIndex ? `sheet-${rowIndex}` : `inquiry-${Date.now()}`;
    const roomId = parsed.teacherEmail ? `room_${sanitizeInquiryId(inquiryId)}` : null;

    const mirrorInquiry: MirrorInquiry = {
      id: inquiryId,
      teacherName: parsed.teacherName,
      teacherEmail: parsed.teacherEmail ? normalizeEmail(parsed.teacherEmail) : '',
      inquirerName: parsed.inquirerName,
      inquirerPhone: replyContact,
      inquirerEmail: requesterEmail,
      purpose: parsed.purpose,
      message: parsed.message || '',
      status: parsed.teacherEmail ? 'FORWARDED_TO_TEACHER' : 'PENDING_CENTER_REVIEW',
      createdAt: now,
      updatedAt: now,
    };

    const mirrorResult = await createMirrorInquiry(mirrorInquiry);
    let chatRoomResult = null;

    if (roomId && parsed.teacherEmail) {
      const memberEmail = requesterEmail;
      const instructorEmail = normalizeEmail(parsed.teacherEmail);
      const room: ChatRoom = {
        id: roomId,
        inquiryId,
        memberEmail,
        memberName: parsed.inquirerName,
        instructorEmail,
        instructorName: parsed.teacherName,
        status: 'PENDING',
        totalLength: 0,
        lastMessage: '',
        lastMessageAt: now,
        firstMessageNotified: false,
        unreadCount: {
          [memberEmail]: 0,
          [instructorEmail]: 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      chatRoomResult = await createChatRoom(room);
    }

    const mails = [
      buildCenterMail(mirrorInquiry),
      roomId ? buildTeacherMail(mirrorInquiry, roomId, request) : null,
    ].filter(Boolean) as MailOutboxEntry[];

    await Promise.allSettled(mails.map((entry) => sendManagedMail(entry)));

    return NextResponse.json({
      success: true,
      message: roomId
        ? '문의가 접수되었습니다. 강사가 문의를 수락하면 채팅으로 이어집니다.'
        : '문의가 접수되었습니다. 센터 확인 후 강사에게 전달됩니다.',
      data: {
        mailConfigured: isMailConfigured(),
        sessionRole: session.user.role,
        inquiryId,
        roomId,
        quota: {
          monthlyLimit: MONTHLY_LIMIT,
          usedCount: quota.usedCount + 1,
          remainingCount: Math.max(0, quota.remainingCount - 1),
          canSend: quota.remainingCount - 1 > 0,
        },
        sheetResult,
        mirrorResult,
        chatRoomResult,
      },
    });
  } catch (inquiryError) {
    return NextResponse.json(
      {
        success: false,
        message: inquiryError instanceof Error ? inquiryError.message : '문의 접수에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
