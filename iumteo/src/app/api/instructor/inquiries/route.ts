import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { findChatRoomsByInquiryIds } from '@/lib/chat-store';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
import { parseCsv, rowsToRecords, pickByAliases } from '@/lib/sheets';

import { assertGasSuccess, gasGet, type GasEnvelope } from '@/lib/gas-api';

export const dynamic = 'force-dynamic';

const CSV_INQUIRY_DB_URL =
  process.env.CSV_INQUIRY_DB_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf/pub?gid=1950022642&single=true&output=csv';

const CSV_INSTRUCTOR_DB_URL =
  process.env.CSV_INSTRUCTOR_DB_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf/pub?gid=0&single=true&output=csv';

type CsvRecord = Record<string, string>;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

async function fetchCsv(url: string): Promise<CsvRecord[]> {
  const response = await fetch(`${url}&t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`CSV fetch failed: ${response.status}`);
  }

  return rowsToRecords(parseCsv(await response.text()));
}

async function fetchInquiryRows(): Promise<CsvRecord[]> {
  try {
    const result = assertGasSuccess(
      await gasGet<GasEnvelope<CsvRecord[]>>(new URLSearchParams({ action: 'getInquiries' })),
      'getInquiries',
    );
    return Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message.toLowerCase() : '';
    if (!errorMsg.includes('unknown action') && !errorMsg.includes('지원하지 않습')) throw err;
    return fetchCsv(CSV_INQUIRY_DB_URL);
  }
}

async function fetchInstructorRows(): Promise<CsvRecord[]> {
  try {
    const result = assertGasSuccess(
      await gasGet<GasEnvelope<CsvRecord[]>>(new URLSearchParams({ action: 'getInstructors', cacheBust: String(Date.now()) })),
      'getInstructors',
    );
    return Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message.toLowerCase() : '';
    if (!errorMsg.includes('unknown action') && !errorMsg.includes('지원하지 않습')) throw err;
    return fetchCsv(CSV_INSTRUCTOR_DB_URL);
  }
}

function getInstructorName(record: CsvRecord) {
  return pickByAliases(record, ['성명', 'Name', 'name']) || '';
}

function getInstructorEmail(record: CsvRecord) {
  return normalizeEmail(
    pickByAliases(record, ['로그인용 이메일', '이메일', 'Email', 'email']) || '',
  );
}

function normalizeInquiry(record: CsvRecord, index: number) {
  return {
    inquiryId: pickByAliases(record, ['inquiryId']) || `sheet-${index + 2}`,
    rowIndex: String(index + 2),
    receivedAt: pickByAliases(record, ['접수일시', 'createdAt']) || '',
    teacherName: pickByAliases(record, ['문의대상(강사명)', '문의대상 강사명', '강사명', 'teacherName']) || '',
    teacherEmail: pickByAliases(record, ['강사 이메일', 'teacherEmail', 'Teacher_Email']) || '',
    memberName: pickByAliases(record, ['신청인 성명', '문의자명', 'inquirerName']) || '',
    memberPhone: pickByAliases(record, ['신청인 연락처', '연락처', 'inquirerPhone']) || '',
    memberEmail: pickByAliases(record, ['연락받을 이메일', '요청자 이메일', 'inquirerEmail']) || '',
    purpose: pickByAliases(record, ['문의 목적', 'purpose']) || '',
    message: pickByAliases(record, ['상세 내용', '문의내용', 'message']) || '',
    status: pickByAliases(record, ['처리 상태', 'status']) || '접수대기',
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
  }

  if (session.user.role !== 'INSTRUCTOR' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: '강사만 조회할 수 있습니다.' }, { status: 403 });
  }

  try {
    const chatEnabled = isFirebaseMirrorEnabled();
    const [inquiryRows, instructorRows] = await Promise.all([
      fetchInquiryRows(),
      fetchInstructorRows(),
    ]);

    const sessionEmail = normalizeEmail(session.user.email);
    const instructorRecord = instructorRows.find((row) => getInstructorEmail(row) === sessionEmail);
    const normalizedInstructorName = normalizeKey(
      instructorRecord ? getInstructorName(instructorRecord) : session.user.name || '',
    );

    const inquiries = inquiryRows
      .map(normalizeInquiry)
      .filter((row) => {
        const teacherEmail = normalizeEmail(row.teacherEmail || '');
        const teacherName = normalizeKey(row.teacherName || '');

        return (
          (teacherEmail && teacherEmail === sessionEmail) ||
          (normalizedInstructorName && teacherName === normalizedInstructorName)
        );
      })
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

    const chatRooms = await findChatRoomsByInquiryIds(inquiries.map((item) => item.inquiryId));
    const enriched = inquiries.map((item) => ({
      ...item,
      chatRoomId: chatRooms[item.inquiryId]?.id,
      chatRoomStatus: chatRooms[item.inquiryId]?.status,
    }));

    return NextResponse.json({ success: true, data: enriched, chatEnabled });
  } catch (fetchError) {
    return NextResponse.json(
      {
        success: false,
        message: fetchError instanceof Error ? fetchError.message : '문의 내역을 불러오지 못했습니다.',
      },
      { status: 400 },
    );
  }
}
