import { randomUUID } from 'crypto';
import { pickByAliases, normalizeEmail, normalizePhone, type CsvRecord } from '@/lib/sheets';
import { createMirrorInquiry, upsertMirrorInstructorProfile, upsertMirrorUser } from '@/lib/firestore-mirror';
import type { MirrorInquiry, MirrorInstructorProfile, MirrorUserRecord } from '@/lib/domain';
import { assertGasSuccess, gasGet, type GasEnvelope } from '@/lib/gas-api';

async function fetchGasRecords(action: 'getInstructors' | 'getMembers' | 'getInquiries', includeAll = false): Promise<CsvRecord[]> {
  const params = new URLSearchParams({ action });
  if (includeAll) {
    params.set('includeAll', 'Y');
  }

  const result = assertGasSuccess(
    await gasGet<GasEnvelope<CsvRecord[]>>(params),
    action,
  );

  return Array.isArray(result.data) ? result.data : [];
}

function mapApprovalStatus(record: CsvRecord): MirrorInstructorProfile['approvalStatus'] {
  const raw = pickByAliases(record, ['상태', 'status', '승인여부']).trim();
  if (raw === '승인') return 'APPROVED';
  if (raw === '반려' || raw === '거절') return 'REJECTED';
  return 'PENDING';
}

function mapInquiryStatus(record: CsvRecord): MirrorInquiry['status'] {
  const raw = pickByAliases(record, ['처리 상태', 'status']).trim().toLowerCase();
  if (!raw) return 'PENDING_CENTER_REVIEW';
  if (raw.includes('전달') || raw.includes('forward')) return 'FORWARDED_TO_TEACHER';
  if (raw.includes('완료') || raw.includes('답변') || raw.includes('회신') || raw.includes('closed')) return 'ANSWERED';
  return 'PENDING_CENTER_REVIEW';
}

function toMirrorMember(record: CsvRecord): MirrorUserRecord | null {
  const email = normalizeEmail(
    pickByAliases(record, ['이메일', '이메일(로그인용)', '로그인용 이메일', 'Email', 'email']),
  );
  if (!email) return null;

  const now = new Date().toISOString();

  return {
    id: email,
    email,
    name: pickByAliases(record, ['이용자명', '이름', '성명', 'Name', 'name']) || email.split('@')[0],
    phone: normalizePhone(pickByAliases(record, ['연락처', '핸드폰 번호', '전화번호', 'Phone', 'phone'])),
    role: 'USER',
    actualRole: 'USER',
    provider: 'credentials',
    organization: pickByAliases(record, ['소속', '기관', 'Org', 'org']),
    memberType: 'USER',
    consent: {
      requiredAccepted: true,
      profilePublicAccepted: false,
      marketingAccepted: false,
      consentVersion: 'legacy-sheet-member-bootstrap',
      consentDate: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function toMirrorInstructorUser(record: CsvRecord): MirrorUserRecord | null {
  const email = normalizeEmail(
    pickByAliases(record, ['로그인용 이메일', '이메일', '이메일(로그인용)', 'Email', 'email']),
  );
  if (!email) return null;

  const now = new Date().toISOString();

  return {
    id: email,
    email,
    name: pickByAliases(record, ['성명', 'Name', 'name']) || email.split('@')[0],
    phone: normalizePhone(pickByAliases(record, ['연락처', '핸드폰 번호', '전화번호', 'Phone', 'phone'])),
    role: 'INSTRUCTOR',
    actualRole: 'INSTRUCTOR',
    provider: 'credentials',
    organization: pickByAliases(record, ['소속', '기관', 'Org', 'org']),
    memberType: 'INSTRUCTOR',
    consent: {
      requiredAccepted: true,
      profilePublicAccepted: true,
      marketingAccepted: false,
      consentVersion: 'legacy-sheet-instructor-bootstrap',
      consentDate: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function toMirrorInstructorProfile(record: CsvRecord): MirrorInstructorProfile | null {
  const email = normalizeEmail(
    pickByAliases(record, ['로그인용 이메일', '이메일', '이메일(로그인용)', 'Email', 'email']),
  );
  if (!email) return null;

  const now = new Date().toISOString();

  return {
    id: email,
    email,
    name: pickByAliases(record, ['성명', 'Name', 'name']) || email.split('@')[0],
    phone: normalizePhone(pickByAliases(record, ['연락처', '핸드폰 번호', '전화번호', 'Phone', 'phone'])),
    organization: pickByAliases(record, ['소속', '기관', 'Org', 'org']),
    field: pickByAliases(record, ['전문분야', '강의분야', '상세내용', 'Field', 'field']),
    area: pickByAliases(record, ['활동지역', 'Area', 'area']),
    intro: pickByAliases(record, ['소개', '상세내용', 'Intro', 'intro']),
    career: pickByAliases(record, ['주요경력', 'career']),
    address: pickByAliases(record, ['주소', 'address']),
    instagram: pickByAliases(record, ['인스타그램', '인스타그램주소', 'Instagram', 'instagram']),
    instagramOpen: (pickByAliases(record, ['인스타그램공개여부', 'instagramOpen']) || '미공개') as '공개' | '미공개',
    portfolioLink: pickByAliases(record, ['Portfolio_Link', 'portfolioLink', '포트폴리오']),
    profilePhoto: pickByAliases(record, ['프로필사진', 'Profile_Photo', 'profile_photo']),
    approvalStatus: mapApprovalStatus(record),
    createdAt: now,
    updatedAt: now,
  };
}

function toMirrorInquiry(record: CsvRecord, index: number): MirrorInquiry | null {
  const teacherName = pickByAliases(record, ['문의대상(강사명)', 'teacherName', '강사명']);
  const inquirerEmail = normalizeEmail(
    pickByAliases(record, ['연락받을 이메일', 'inquirerEmail', '이메일', 'email']),
  );
  const inquirerName = pickByAliases(record, ['신청인 성명', 'inquirerName', '이름', '이용자명']);
  const inquirerPhone = normalizePhone(
    pickByAliases(record, ['신청인 연락처', 'inquirerPhone', '연락처', '전화번호']),
  );
  const purpose = pickByAliases(record, ['문의 목적', 'purpose']);
  if (!teacherName || !inquirerName || !inquirerEmail) return null;

  const createdAt = pickByAliases(record, ['접수일시', 'createdAt']) || new Date().toISOString();
  const rowIndex = index + 2;

  return {
    id: `sheet-${rowIndex}`,
    teacherName,
    teacherEmail: normalizeEmail(pickByAliases(record, ['teacherEmail', '강사 이메일'])),
    inquirerName,
    inquirerPhone,
    inquirerEmail,
    purpose,
    message: pickByAliases(record, ['상세 내용', 'message']),
    status: mapInquiryStatus(record),
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncSheetsToFirestoreMirror() {
  const [instructorDb, memberDb, inquiryDb] = await Promise.all([
    fetchGasRecords('getInstructors', true),
    fetchGasRecords('getMembers'),
    fetchGasRecords('getInquiries'),
  ]);

  const memberRecords = memberDb.map(toMirrorMember).filter(Boolean) as MirrorUserRecord[];
  const instructorUsers = instructorDb.map(toMirrorInstructorUser).filter(Boolean) as MirrorUserRecord[];
  const instructorProfiles = instructorDb.map(toMirrorInstructorProfile).filter(Boolean) as MirrorInstructorProfile[];
  const inquiryRecords = inquiryDb.map(toMirrorInquiry).filter(Boolean) as MirrorInquiry[];

  await Promise.all([
    ...memberRecords.map((member) => upsertMirrorUser(member)),
    ...instructorUsers.map((instructor) => upsertMirrorUser(instructor)),
    ...instructorProfiles.map((profile) => upsertMirrorInstructorProfile(profile)),
    ...inquiryRecords.map((inquiry) => createMirrorInquiry(inquiry)),
  ]);

  return {
    syncId: randomUUID(),
    members: memberRecords.length,
    instructors: instructorProfiles.length,
    inquiries: inquiryRecords.length,
  };
}
