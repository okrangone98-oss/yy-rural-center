import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { assertGasSuccess, gasGet, type GasEnvelope } from '@/lib/gas-api';
import { normalizeEmail, normalizePhone, parseCsv, pickByAliases, rowsToRecords, type CsvRecord } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

type SourceKey = 'instructorDb' | 'memberDb' | 'inquiryDb';

type SourceBundle = {
  source: 'gas' | 'csv-fallback';
  rowCount: number;
  rows: CsvRecord[];
};


function parseLimit(param: string | null): number {
  const parsed = Number(param || '200');
  if (!Number.isFinite(parsed) || parsed < 10) return 200;
  return Math.min(parsed, 1000);
}

function countBy<T>(items: T[], keyGetter: (item: T) => string) {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function findDuplicates(values: string[]) {
  const counter = countBy(values, (value) => value);
  return Object.entries(counter)
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function getStatus(record: CsvRecord): string {
  return pickByAliases(record, ['상태', 'status', '처리 상태', '승인여부']) || '';
}

function categorizeInstructorStatus(record: CsvRecord) {
  const status = getStatus(record).trim();
  if (status === '승인') return 'approved';
  if (!status || status === '대기') return 'pending';
  return 'other';
}

function getEmail(record: CsvRecord): string {
  return normalizeEmail(
    pickByAliases(record, [
      '이메일',
      '이메일(로그인용)',
      '로그인용 이메일',
      'Email',
      'email',
      '연락받을 이메일',
      'inquirerEmail',
    ]),
  );
}

function getPhone(record: CsvRecord): string {
  return normalizePhone(
    pickByAliases(record, [
      '연락처',
      '핸드폰 번호',
      '전화번호',
      'Phone',
      'phone',
      '신청인 연락처',
      'inquirerPhone',
    ]),
  );
}

function getName(record: CsvRecord): string {
  return pickByAliases(record, ['성명', '이용자명', '이름', 'Name', 'name', '신청인 성명', 'inquirerName']);
}

function getInstructorName(record: CsvRecord): string {
  return pickByAliases(record, ['성명', 'Name', 'name', '강사명', 'teacherName']);
}

function getInquiryTeacherName(record: CsvRecord): string {
  return pickByAliases(record, ['문의대상(강사명)', 'teacherName', '강사명']);
}

function getIsLocal(record: CsvRecord): boolean {
  const flag = pickByAliases(record, ['isLocal', '로컬', '로컬여부']);
  return ['Y', 'YES', 'TRUE', '1'].includes(flag.trim().toUpperCase());
}

function categorizeInquiryStatus(record: CsvRecord) {
  const status = getStatus(record).trim().toLowerCase();
  if (!status) return 'pending';
  if (status.includes('전달') || status.includes('forward')) return 'forwarded';
  if (status.includes('완료') || status.includes('답변') || status.includes('회신') || status.includes('closed')) {
    return 'completed';
  }
  return 'pending';
}

async function fetchGasSheetRecords(action: 'getInstructors' | 'getMembers' | 'getInquiries', limit: number, includeAll = false) {
  const params = new URLSearchParams({ action });
  if (includeAll) {
    params.set('includeAll', 'Y');
  }

  const result = assertGasSuccess(
    await gasGet<GasEnvelope<CsvRecord[]>>(params),
    action,
  );

  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    source: 'gas' as const,
    rowCount: rows.length,
    rows: rows.slice(0, limit),
    allRows: rows,
  };
}


export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));

    const instructorSource = await fetchGasSheetRecords('getInstructors', limit, true);
    const memberSource = await fetchGasSheetRecords('getMembers', limit);
    const inquirySource = await fetchGasSheetRecords('getInquiries', limit);

    const instructorDb = instructorSource.allRows;
    const memberDb = memberSource.allRows;
    const inquiryDb = inquirySource.allRows;

    const instructorEmails = instructorDb.map(getEmail).filter(Boolean);
    const memberEmails = memberDb.map(getEmail).filter(Boolean);
    const instructorNames = unique(instructorDb.map(getInstructorName));
    const inquiryTeacherNames = unique(inquiryDb.map(getInquiryTeacherName));

    const overlappingEmails = unique(instructorEmails.filter((email) => memberEmails.includes(email)));
    const unknownInquiryTeachers = inquiryTeacherNames.filter((name) => name && !instructorNames.includes(name));

    const instructorMissingRequired = instructorDb
      .map((record) => ({
        name: getInstructorName(record),
        phone: getPhone(record),
        email: getEmail(record),
      }))
      .filter((item) => !item.name || !item.phone || !item.email);

    const memberMissingRequired = memberDb
      .map((record) => ({
        name: getName(record),
        phone: getPhone(record),
        email: getEmail(record),
      }))
      .filter((item) => !item.name || !item.phone || !item.email);

    const inquiryMissingRequired = inquiryDb
      .map((record) => ({
        teacherName: getInquiryTeacherName(record),
        inquirerName: getName(record),
        inquirerPhone: getPhone(record),
        inquirerEmail: getEmail(record),
        purpose: pickByAliases(record, ['문의 목적', 'purpose']),
      }))
      .filter((item) => !item.teacherName || !item.inquirerName || !item.inquirerPhone || !item.inquirerEmail || !item.purpose);

    const duplicates = {
      instructorDb: findDuplicates(instructorEmails),
      memberDb: findDuplicates(memberEmails),
    };

    const issues = [
      ...(overlappingEmails.length
        ? [
            {
              id: 'overlap_member_instructor_email',
              severity: 'medium',
              message: '강사DB와 이용자DB에 같은 이메일이 중복 등록되어 있습니다.',
              count: overlappingEmails.length,
              samples: overlappingEmails.slice(0, 10),
            },
          ]
        : []),
      ...(unknownInquiryTeachers.length
        ? [
            {
              id: 'unknown_inquiry_teacher',
              severity: 'medium',
              message: '문의접수에 등록된 강사명이 강사DB에서 확인되지 않습니다.',
              count: unknownInquiryTeachers.length,
              samples: unknownInquiryTeachers.slice(0, 10),
            },
          ]
        : []),
      ...(instructorMissingRequired.length
        ? [
            {
              id: 'missing_instructor_required',
              severity: 'high',
              message: '강사DB에 필수값(성명/연락처/로그인 이메일)이 누락된 행이 있습니다.',
              count: instructorMissingRequired.length,
              samples: instructorMissingRequired.slice(0, 10),
            },
          ]
        : []),
      ...(memberMissingRequired.length
        ? [
            {
              id: 'missing_member_required',
              severity: 'high',
              message: '이용자DB에 필수값(이름/연락처/이메일)이 누락된 행이 있습니다.',
              count: memberMissingRequired.length,
              samples: memberMissingRequired.slice(0, 10),
            },
          ]
        : []),
      ...(inquiryMissingRequired.length
        ? [
            {
              id: 'missing_inquiry_required',
              severity: 'high',
              message: '문의접수에 필수값(강사명/신청인/연락처/이메일/문의목적)이 누락된 행이 있습니다.',
              count: inquiryMissingRequired.length,
              samples: inquiryMissingRequired.slice(0, 10),
            },
          ]
        : []),
      ...Object.entries(duplicates)
        .filter(([, rows]) => rows.length > 0)
        .map(([dataset, rows]) => ({
          id: `duplicate_email_${dataset}`,
          severity: 'high',
          message: `${dataset} 시트에서 중복 이메일이 발견되었습니다.`,
          count: rows.length,
          samples: rows.slice(0, 10),
        })),
    ];

    const approvedInstructors = instructorDb.filter((record) => categorizeInstructorStatus(record) === 'approved').length;
    const pendingInstructors = instructorDb.filter((record) => categorizeInstructorStatus(record) === 'pending').length;
    const localInstructors = instructorDb.filter((record) => getIsLocal(record)).length;
    const pendingInquiries = inquiryDb.filter((record) => categorizeInquiryStatus(record) === 'pending').length;
    const forwardedInquiries = inquiryDb.filter((record) => categorizeInquiryStatus(record) === 'forwarded').length;
    const completedInquiries = inquiryDb.filter((record) => categorizeInquiryStatus(record) === 'completed').length;

    return NextResponse.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      stats: {
        instructorDb: {
          total: instructorDb.length,
          approved: approvedInstructors,
          pending: pendingInstructors,
          local: localInstructors,
        },
        memberDb: {
          total: memberDb.length,
        },
        inquiryDb: {
          total: inquiryDb.length,
          pending: pendingInquiries,
          forwarded: forwardedInquiries,
          completed: completedInquiries,
        },
      },
      integrity: {
        issueCount: issues.length,
        issues,
      },
      sources: {
        instructorDb: {
          source: instructorSource.source,
          rowCount: instructorSource.rowCount,
          rows: instructorSource.rows,
        },
        memberDb: {
          source: memberSource.source,
          rowCount: memberSource.rowCount,
          rows: memberSource.rows,
        },
        inquiryDb: {
          source: inquirySource.source,
          rowCount: inquirySource.rowCount,
          rows: inquirySource.rows,
        },
      } satisfies Record<SourceKey, SourceBundle>,
    });
  } catch (error) {
    console.error('Admin sheets GET error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '관리자 시트 데이터를 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
