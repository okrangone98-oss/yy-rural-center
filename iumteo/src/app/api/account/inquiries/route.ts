import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import { assertGasSuccess, gasGet, type GasEnvelope } from '@/lib/gas-api';
import { parseCsv, pickByAliases, rowsToRecords, type CsvRecord } from '@/lib/sheets';

const CSV_INQUIRY_DB_URL =
  process.env.CSV_INQUIRY_DB_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf/pub?gid=1950022642&single=true&output=csv';

function normalizeInquiry(record: CsvRecord) {
  return {
    inquiryId: pickByAliases(record, ['inquiryId']) || `sheet-${pickByAliases(record, ['rowIndex'])}`,
    rowIndex: Number(pickByAliases(record, ['rowIndex']) || '0'),
    receivedAt: pickByAliases(record, ['접수일시', 'createdAt']),
    teacherName: pickByAliases(record, ['문의대상(강사명)', 'teacherName', '강사명']),
    inquirerName: pickByAliases(record, ['신청인 성명', 'inquirerName']),
    inquirerPhone: pickByAliases(record, ['신청인 연락처', 'inquirerPhone']),
    inquirerEmail: pickByAliases(record, ['연락받을 이메일', 'inquirerEmail', '이메일']),
    purpose: pickByAliases(record, ['문의 목적', 'purpose']),
    message: pickByAliases(record, ['상세 내용', 'message']),
    status: pickByAliases(record, ['처리 상태', 'status']) || '접수대기',
  };
}

export async function GET() {
  const { session, error } = await getRequiredSession(['USER', 'ADMIN']);
  if (error) return error;

  try {
    const rows = await gasGet<GasEnvelope<CsvRecord[]>>(
      new URLSearchParams({
        action: 'getInquiries',
      }),
    )
      .then((result) => assertGasSuccess(result, 'getInquiries'))
      .then((result) => (Array.isArray(result.data) ? result.data : []))
      .catch(async (error) => {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('지원하지 않습니다')) {
          throw error;
        }

        const response = await fetch(`${CSV_INQUIRY_DB_URL}&t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('문의 내역을 불러오지 못했습니다.');
        }

        return rowsToRecords(parseCsv(await response.text())).map((record, index) => ({
          ...record,
          rowIndex: String(index + 2),
          inquiryId: `sheet-${index + 2}`,
        }));
      });

    const email = String(session.user.email || '').trim().toLowerCase();

    const items = rows
      .map(normalizeInquiry)
      .filter((item) => String(item.inquirerEmail || '').trim().toLowerCase() === email)
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

    return NextResponse.json({ success: true, data: items });
  } catch (fetchError) {
    return NextResponse.json(
      { success: false, message: fetchError instanceof Error ? fetchError.message : '문의 내역을 불러오지 못했습니다.' },
      { status: 400 },
    );
  }
}
