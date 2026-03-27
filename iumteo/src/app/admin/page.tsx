'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { INSTAGRAM_VISIBILITY_OPTIONS, INSTRUCTOR_FIELD_OPTIONS } from '@/lib/domain';
import { getAppPath } from '@/lib/app-url';
import { compressImageForProfile, getImageFileFromClipboard, uploadProfilePhoto } from '@/lib/profile-photo-client';

type Role = 'GUEST' | 'USER' | 'INSTRUCTOR' | 'ADMIN';

type GenericRecord = Record<string, string | number | boolean | null | undefined>;

type InstructorProfile = {
  status?: string;
  isLocal?: 'Y' | 'N';
  [key: string]: string | number | boolean | null | undefined;
};

type InquiryActionMode = 'forward' | 'reply';

type InquiryActionDraft = {
  subject: string;
  message: string;
};

type InquiryItem = {
  inquiryId: string;
  rowIndex: number;
  receivedAt: string;
  teacherName: string;
  teacherEmail: string;
  memberName: string;
  memberPhone: string;
  memberEmail: string;
  purpose: string;
  message: string;
  status: string;
};

type SheetSource = {
  rows: GenericRecord[];
  rowCount: number;
};

type SheetBundle = {
  stats: {
    instructorDb: { total: number; approved: number; pending: number; local: number };
    memberDb: { total: number };
    inquiryDb: { total: number; pending: number; forwarded: number; completed: number };
  };
  integrity: {
    issueCount: number;
    issues: Array<{ id: string; severity: string; message: string; count: number; samples: unknown[] }>;
  };
  sources: {
    instructorDb: SheetSource;
    memberDb: SheetSource;
    inquiryDb: SheetSource;
  };
};

type AdminInstructorItem = {
  id: string;
  rowIndex: number;
  name: string;
  phone: string;
  email: string;
  loginEmail: string;
  org: string;
  field: string;
  area: string;
  status: string;
  finalStatus: string;
  updatedAt: string;
  intro: string;
  career: string;
  address: string;
  instagram: string;
  instagramOpen: string;
  portfolioLink: string;
  profilePhoto: string;
  isLocal: boolean;
  raw: InstructorProfile;
};

type AdminMemberItem = {
  id: string;
  rowIndex: number;
  name: string;
  email: string;
  phone: string;
  org: string;
  status: string;
  memberType: string;
  lastLogin: string;
  raw: GenericRecord;
};

type MemberFormState = {
  email: string;
  name: string;
  phone: string;
  org: string;
  status: string;
  memberType: string;
  lastLogin: string;
};

const STATUS = {
  approved: '승인',
  pending: '대기',
  deleteRequested: '삭제요청',
};

const MEMBER_STATUS_OPTIONS = ['활성', '휴면', '탈퇴', '검토중'];
const MEMBER_TYPE_OPTIONS = ['일반회원', '기관회원', '주민', '담당자'];
const INQUIRY_STATUS_PRESETS = ['운영확인중', '강사전달완료', '회원회신완료'];
const INSTRUCTOR_STATUS_OPTIONS = ['대기', '승인', '삭제요청', '반려'];

const PUBLIC_PAGE_SIZE = 20;
const ADMIN_INQUIRY_PAGE_SIZE = 7;

function hasMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
}

function findField(record: GenericRecord, aliases: string[]) {
  for (const alias of aliases) {
    const matchedKey = Object.keys(record).find(
      (key) => key === alias || key.replace(/\s+/g, '') === alias.replace(/\s+/g, ''),
    );
    if (matchedKey && hasMeaningfulValue(record[matchedKey])) {
      return String(record[matchedKey] ?? '').trim();
    }
  }
  return '';
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function getInstructorName(record: GenericRecord) {
  return findField(record, ['성명', 'Name', 'name']);
}

function getInstructorField(record: GenericRecord) {
  return findField(record, ['전문분야', '강의분야', 'Field', 'field']);
}

function getInstructorOrg(record: GenericRecord) {
  return findField(record, ['소속', 'Org', 'org']);
}

function getInstructorArea(record: GenericRecord) {
  return findField(record, ['활동지역', 'Activity_Area', 'Area', 'area']);
}

function getInstructorPhone(record: GenericRecord) {
  return findField(record, ['연락처', '전화번호', 'Phone', 'phone']);
}

function getInstructorEmail(record: GenericRecord) {
  return findField(record, ['로그인용 이메일', '이메일', 'Email', 'email']);
}

function getInstructorIntro(record: GenericRecord) {
  return findField(record, ['소개', '상세내용', 'Intro', 'intro']);
}

function getInstructorCareer(record: GenericRecord) {
  return findField(record, ['주요경력', 'career']);
}

function getInstructorAddress(record: GenericRecord) {
  return findField(record, ['주소', 'Address', 'address']);
}

function getInstructorInstagram(record: GenericRecord) {
  return findField(record, ['인스타그램주소', 'Instagram', 'instagram']);
}

function getInstructorInstagramOpen(record: GenericRecord) {
  return findField(record, ['인스타그램공개여부', 'instagramOpen']) || '미공개';
}

function getInstructorPortfolioLink(record: GenericRecord) {
  return findField(record, ['Portfolio_Link', 'portfolioLink']);
}

function getInstructorProfilePhoto(record: GenericRecord) {
  return findField(record, ['프로필사진', 'Profile_Photo', 'profilePhoto']);
}

function getInstructorUpdatedAt(record: GenericRecord) {
  return findField(record, ['수정일', 'Updated_At', 'updatedAt']);
}

function getInstructorStatus(record: InstructorProfile) {
  return findField(record, ['상태', 'status', '승인상태(최종)']) || record.status || STATUS.pending;
}

function getInstructorFinalStatus(record: GenericRecord) {
  return findField(record, ['승인상태(최종)', 'finalStatus']) || getInstructorStatus(record as InstructorProfile);
}

function getMemberName(record: GenericRecord) {
  return findField(record, ['이용자명', '이름', '성명', 'Name', 'name']);
}

function getMemberEmail(record: GenericRecord) {
  return findField(record, ['이메일', 'Email', 'email']);
}

function getMemberPhone(record: GenericRecord) {
  return findField(record, ['연락처', '전화번호', 'Phone', 'phone']);
}

function getMemberOrg(record: GenericRecord) {
  return findField(record, ['소속명', '소속', '기관', 'Org', 'org']);
}

function getMemberStatus(record: GenericRecord) {
  return findField(record, ['상태', 'status']) || '활성';
}

function getMemberType(record: GenericRecord) {
  return findField(record, ['회원유형', 'memberType']) || '일반회원';
}

function getMemberLastLogin(record: GenericRecord) {
  return findField(record, ['Last_Login', '마지막로그인', 'lastLogin']);
}

function isLocalInstructor(instructor: InstructorProfile) {
  const fieldValue = findField(instructor, ['isLocal', '로컬', '로컬여부']).toUpperCase();
  return instructor.isLocal === 'Y' || ['Y', 'YES', 'TRUE', '1'].includes(fieldValue);
}

function getInquiryStatusTone(status: string) {
  if (status.includes('완료') || status.includes('회신')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status.includes('전달')) return 'bg-sky-100 text-sky-700 border-sky-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

function getInstructorStatusTone(status: string) {
  if (status === STATUS.approved) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === STATUS.deleteRequested) return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

function getMemberStatusTone(status: string) {
  if (status.includes('활성')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status.includes('휴면') || status.includes('검토')) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function getInstructorStatusCategory(status: string) {
  if (status === STATUS.approved) return 'approved';
  if (status === STATUS.deleteRequested) return 'deleteRequested';
  if (!status || status === STATUS.pending) return 'pending';
  return 'other';
}

function getInquiryStatusCategory(status: string) {
  if (status.includes('삭제')) return 'deleted';
  if (status.includes('완료') || status.includes('회신')) return 'completed';
  if (status.includes('전달')) return 'forwarded';
  return 'pending';
}

function isMeaningfulRecord(record: GenericRecord, primaryKeys: string[] = []) {
  if (primaryKeys.some((key) => hasMeaningfulValue(record[key]))) {
    return true;
  }

  return Object.entries(record).some(([key, value]) => {
    if (key === 'rowIndex') return false;
    if ((key === '상태' || key === 'status') && String(value || '').trim() === '대기') return false;
    return hasMeaningfulValue(value);
  });
}

function isMeaningfulInstructor(instructor: InstructorProfile) {
  return isMeaningfulRecord(instructor, ['성명', '강의분야', '전문분야', 'Activity_Area', '활동지역', '연락처', '이메일']);
}

function renderGenericTable(records: GenericRecord[], emptyText: string) {
  if (!records.length) {
    return <div className="p-4 text-sm text-gray-500">{emptyText}</div>;
  }

  const headers = Object.keys(records[0]).slice(0, 8);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map((record, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {headers.map((header) => (
                <td key={header} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[220px] truncate">
                  {String(record[header] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm shadow-gray-100/60">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{description}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-gray-500">{children}</label>;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const adminPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'member' | 'instructor' | 'admin'>('public');
  const [previewRole, setPreviewRole] = useState<Role | null>(null);

  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [profileForm, setProfileForm] = useState<InstructorProfile>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [instructors, setInstructors] = useState<InstructorProfile[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [fieldFilter, setFieldFilter] = useState('all');
  const [publicPage, setPublicPage] = useState(1);

  const [sheetBundle, setSheetBundle] = useState<SheetBundle | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [adminRefreshedAt, setAdminRefreshedAt] = useState<string | null>(null);
  const [mirrorSyncing, setMirrorSyncing] = useState(false);
  const [mirrorMessage, setMirrorMessage] = useState<string | null>(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberForm, setMemberForm] = useState<MemberFormState | null>(null);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);

  const [adminInstructorSearch, setAdminInstructorSearch] = useState('');
  const [adminInstructorStatusFilter, setAdminInstructorStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'deleteRequested' | 'other'
  >('pending');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [adminInstructorForm, setAdminInstructorForm] = useState<InstructorProfile | null>(null);
  const [adminInstructorSaving, setAdminInstructorSaving] = useState(false);
  const [adminInstructorMessage, setAdminInstructorMessage] = useState<string | null>(null);
  const [adminInstructorPhotoUploading, setAdminInstructorPhotoUploading] = useState(false);
  const [instructorStatusLoading, setInstructorStatusLoading] = useState<string | null>(null);

  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<'all' | 'pending' | 'forwarded' | 'completed' | 'deleted'>('pending');
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [inquiryPage, setInquiryPage] = useState(1);
  const [bulkInquiryDeleting, setBulkInquiryDeleting] = useState(false);
  const [manualInquiryLoadingId, setManualInquiryLoadingId] = useState<string | null>(null);
  const [manualInquiryMessage, setManualInquiryMessage] = useState<string | null>(null);
  const [inquiryActionTarget, setInquiryActionTarget] = useState<{ inquiryId: string; mode: InquiryActionMode } | null>(null);
  const [forwardDrafts, setForwardDrafts] = useState<Record<string, InquiryActionDraft>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, InquiryActionDraft>>({});
  const [inquiryActionLoadingId, setInquiryActionLoadingId] = useState<string | null>(null);
  const [inquiryActionMessage, setInquiryActionMessage] = useState<string | null>(null);

  const actualRole = (session?.user?.role || 'GUEST') as Role;
  const effectiveRole: Role = actualRole === 'ADMIN' ? previewRole || actualRole : actualRole;
  const isPreviewing = actualRole === 'ADMIN' && !!previewRole && previewRole !== 'ADMIN';

  const fetchMyProfile = useCallback(async () => {
    if (!session?.user?.email) return;
    setProfileLoading(true);
    setProfileError(null);

    try {
      const res = await fetch(`/api/instructor?email=${encodeURIComponent(session.user.email)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setProfile(data.data);
        setProfileForm(data.data);
      } else {
        setProfileError(data.message || '프로필 데이터를 불러오지 못했습니다.');
      }
    } catch {
      setProfileError('프로필 조회 중 오류가 발생했습니다.');
    } finally {
      setProfileLoading(false);
    }
  }, [session]);

  const fetchAllInstructors = useCallback(async () => {
    setInstructorsLoading(true);
    try {
      const res = await fetch(getAppPath('/api/instructor'));
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInstructors(data.data);
      }
    } catch {
      // noop
    } finally {
      setInstructorsLoading(false);
    }
  }, []);

  const fetchAdminSheets = useCallback(async () => {
    if (actualRole !== 'ADMIN') return;
    setSheetLoading(true);
    setSheetError(null);

    try {
      const res = await fetch(getAppPath('/api/admin/sheets?limit=200'));
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '시트 통합 데이터를 불러오지 못했습니다.');
      }
      setSheetBundle(data);
      setAdminRefreshedAt(new Date().toLocaleString('ko-KR'));
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : '시트 데이터 로드 실패');
    } finally {
      setSheetLoading(false);
    }
  }, [actualRole]);

  useEffect(() => {
    if (activeTab === 'public') {
      fetchAllInstructors();
    }

    if (
      activeTab === 'instructor' &&
      (effectiveRole === 'INSTRUCTOR' || effectiveRole === 'ADMIN') &&
      !(actualRole === 'ADMIN' && isPreviewing)
    ) {
      fetchMyProfile();
    }

    if (actualRole === 'ADMIN' && (activeTab === 'admin' || activeTab === 'member') && !sheetBundle) {
      fetchAdminSheets();
    }
  }, [
    activeTab,
    actualRole,
    effectiveRole,
    fetchAdminSheets,
    fetchAllInstructors,
    fetchMyProfile,
    isPreviewing,
    sheetBundle,
  ]);

  const handleSaveProfile = async () => {
    if (!session?.user?.email || isPreviewing) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(getAppPath('/api/instructor'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateInstructorProfile',
          email: session.user.email,
          data: profileForm,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setSaveMessage('저장이 완료되었습니다.');
        setProfile(profileForm);
      } else {
        setSaveMessage(`저장 실패: ${result.message || '다시 시도해주세요.'}`);
      }
    } catch {
      setSaveMessage('저장 중 통신 오류가 발생했습니다.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleMirrorSync = async () => {
    setMirrorSyncing(true);
    setMirrorMessage(null);

    try {
      const res = await fetch(getAppPath('/api/admin/mirror/sync'), { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '미러 동기화 실패');
      }
      setMirrorMessage(
        `Firestore 미러 동기화 완료: members ${data.data.members}건, instructors ${data.data.instructors}건, inquiries ${data.data.inquiries}건`,
      );
      await fetchAdminSheets();
    } catch (error) {
      setMirrorMessage(error instanceof Error ? error.message : '미러 동기화 실패');
    } finally {
      setMirrorSyncing(false);
    }
  };

  const filteredInstructors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return instructors.filter((inst) => {
      if (!isMeaningfulInstructor(inst)) return false;
      if (localOnly && !isLocalInstructor(inst)) return false;
      if (fieldFilter !== 'all' && getInstructorField(inst) !== fieldFilter) return false;
      if (!keyword) return true;

      const name = getInstructorName(inst).toLowerCase();
      const field = getInstructorField(inst).toLowerCase();
      const area = getInstructorArea(inst).toLowerCase();
      return name.includes(keyword) || field.includes(keyword) || area.includes(keyword);
    });
  }, [fieldFilter, instructors, localOnly, search]);

  const visibleInstructors = useMemo<InstructorProfile[]>(() => {
    if (effectiveRole === 'ADMIN') return filteredInstructors;
    return filteredInstructors.map((row) => ({
      ...row,
      연락처: '*** (센터 문의)',
      전화번호: '*** (센터 문의)',
      이메일: '*** (센터 문의)',
    }) as InstructorProfile);
  }, [effectiveRole, filteredInstructors]);

  const publicFieldOptions = useMemo(() => {
    const existingFields = Array.from(
      new Set(
        instructors
          .map((inst) => getInstructorField(inst))
          .filter((value) => value && value.trim()),
      ),
    );

    const orderedKnownFields = INSTRUCTOR_FIELD_OPTIONS.filter((option) => existingFields.includes(option));
    const extraFields = existingFields
      .filter((value) => !INSTRUCTOR_FIELD_OPTIONS.includes(value as (typeof INSTRUCTOR_FIELD_OPTIONS)[number]))
      .sort((left, right) => left.localeCompare(right, 'ko-KR'));

    return ['all', ...orderedKnownFields, ...extraFields];
  }, [instructors]);

  const publicTotalPages = Math.max(1, Math.ceil(visibleInstructors.length / PUBLIC_PAGE_SIZE));

  useEffect(() => {
    setPublicPage(1);
  }, [fieldFilter, localOnly, search]);

  useEffect(() => {
    if (publicPage > publicTotalPages) {
      setPublicPage(publicTotalPages);
    }
  }, [publicPage, publicTotalPages]);

  const paginatedVisibleInstructors = useMemo(() => {
    const start = (publicPage - 1) * PUBLIC_PAGE_SIZE;
    return visibleInstructors.slice(start, start + PUBLIC_PAGE_SIZE);
  }, [publicPage, visibleInstructors]);

  const publicPaginationItems = useMemo(() => {
    if (publicTotalPages <= 1) return [1];

    const pages = new Set<number>([1, publicTotalPages, publicPage - 1, publicPage, publicPage + 1]);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= publicTotalPages)
      .sort((left, right) => left - right);
  }, [publicPage, publicTotalPages]);

  const filteredSheetSources = useMemo(() => {
    if (!sheetBundle) return null;

    const sanitize = (source: SheetSource, primaryKeys: string[]) => ({
      ...source,
      rows: source.rows.filter((record) => isMeaningfulRecord(record, primaryKeys)),
    });

    return {
      instructorDb: sanitize(sheetBundle.sources.instructorDb, ['성명', '강의분야', '전문분야', '연락처', '이메일', '로그인용 이메일']),
      memberDb: sanitize(sheetBundle.sources.memberDb, ['이용자명', '이름', '연락처', '이메일']),
      inquiryDb: sanitize(sheetBundle.sources.inquiryDb, [
        '문의대상(강사명)',
        '신청인 성명',
        '신청인 연락처',
        '연락받을 이메일',
        '문의 목적',
      ]),
    };
  }, [sheetBundle]);

  const adminInstructorItems = useMemo<AdminInstructorItem[]>(() => {
    if (!filteredSheetSources) return [];

    return filteredSheetSources.instructorDb.rows.map((record) => {
      const email = getInstructorEmail(record);
      const rowIndex = Number(record.rowIndex || 0);
      return {
        id: email || `row-${rowIndex}`,
        rowIndex,
        name: getInstructorName(record),
        phone: getInstructorPhone(record),
        email: findField(record, ['이메일', 'Email', 'email']),
        loginEmail: findField(record, ['로그인용 이메일', '이메일', 'Email', 'email']),
        org: getInstructorOrg(record),
        field: getInstructorField(record),
        area: getInstructorArea(record),
        status: getInstructorStatus(record as InstructorProfile),
        finalStatus: getInstructorFinalStatus(record),
        updatedAt: getInstructorUpdatedAt(record),
        intro: getInstructorIntro(record),
        career: getInstructorCareer(record),
        address: getInstructorAddress(record),
        instagram: getInstructorInstagram(record),
        instagramOpen: getInstructorInstagramOpen(record),
        portfolioLink: getInstructorPortfolioLink(record),
        profilePhoto: getInstructorProfilePhoto(record),
        isLocal: isLocalInstructor(record as InstructorProfile),
        raw: { ...(record as InstructorProfile) },
      };
    });
  }, [filteredSheetSources]);

  const filteredAdminInstructors = useMemo(() => {
    const keyword = adminInstructorSearch.trim().toLowerCase();

    return adminInstructorItems.filter((item) => {
      const category = getInstructorStatusCategory(item.status);
      if (adminInstructorStatusFilter !== 'all' && category !== adminInstructorStatusFilter) return false;
      if (!keyword) return true;
      return [item.name, item.field, item.area, item.loginEmail, item.phone].some((value) =>
        value.toLowerCase().includes(keyword),
      );
    });
  }, [adminInstructorItems, adminInstructorSearch, adminInstructorStatusFilter]);

  useEffect(() => {
    if (!filteredAdminInstructors.length) {
      setSelectedInstructorId('');
      return;
    }

    if (!filteredAdminInstructors.some((item) => item.id === selectedInstructorId)) {
      setSelectedInstructorId(filteredAdminInstructors[0].id);
    }
  }, [filteredAdminInstructors, selectedInstructorId]);

  const selectedAdminInstructor = useMemo(
    () => adminInstructorItems.find((item) => item.id === selectedInstructorId) || null,
    [adminInstructorItems, selectedInstructorId],
  );

  useEffect(() => {
    if (!selectedAdminInstructor) {
      setAdminInstructorForm(null);
      return;
    }
    setAdminInstructorForm({ ...selectedAdminInstructor.raw });
  }, [selectedAdminInstructor]);

  const memberItems = useMemo<AdminMemberItem[]>(() => {
    if (!filteredSheetSources) return [];

    return filteredSheetSources.memberDb.rows.map((record) => {
      const email = getMemberEmail(record);
      const rowIndex = Number(record.rowIndex || 0);
      return {
        id: email || `row-${rowIndex}`,
        rowIndex,
        name: getMemberName(record),
        email,
        phone: getMemberPhone(record),
        org: getMemberOrg(record),
        status: getMemberStatus(record),
        memberType: getMemberType(record),
        lastLogin: getMemberLastLogin(record),
        raw: record,
      };
    });
  }, [filteredSheetSources]);

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();

    return memberItems.filter((item) => {
      if (memberStatusFilter === 'active' && !item.status.includes('활성')) return false;
      if (memberStatusFilter === 'inactive' && item.status.includes('활성')) return false;
      if (!keyword) return true;
      return [item.name, item.email, item.phone, item.org].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [memberItems, memberSearch, memberStatusFilter]);

  useEffect(() => {
    if (!filteredMembers.length) {
      setSelectedMemberId('');
      return;
    }

    if (!filteredMembers.some((item) => item.id === selectedMemberId)) {
      setSelectedMemberId(filteredMembers[0].id);
    }
  }, [filteredMembers, selectedMemberId]);

  const selectedMember = useMemo(
    () => memberItems.find((item) => item.id === selectedMemberId) || null,
    [memberItems, selectedMemberId],
  );

  useEffect(() => {
    if (!selectedMember) {
      setMemberForm(null);
      return;
    }

    setMemberForm({
      email: selectedMember.email,
      name: selectedMember.name,
      phone: selectedMember.phone,
      org: selectedMember.org,
      status: selectedMember.status,
      memberType: selectedMember.memberType,
      lastLogin: selectedMember.lastLogin,
    });
  }, [selectedMember]);

  const inquiryItems = useMemo<InquiryItem[]>(() => {
    if (!filteredSheetSources) return [];

    const teacherEmailByName = new Map<string, string>();
    filteredSheetSources.instructorDb.rows.forEach((record) => {
      const name = getInstructorName(record);
      const email = getInstructorEmail(record);
      if (name && email) {
        teacherEmailByName.set(normalizeKey(name), email);
      }
    });

    const memberEmailByNamePhone = new Map<string, string>();
    const memberEmailByName = new Map<string, string>();
    filteredSheetSources.memberDb.rows.forEach((record) => {
      const name = getMemberName(record);
      const phone = normalizePhone(getMemberPhone(record));
      const email = getMemberEmail(record);
      if (name && email) {
        memberEmailByName.set(normalizeKey(name), email);
        if (phone) {
          memberEmailByNamePhone.set(`${normalizeKey(name)}::${phone}`, email);
        }
      }
    });

    return filteredSheetSources.inquiryDb.rows
      .map((record) => {
        const rowIndex = Number(record.rowIndex || 0);
        const teacherName = findField(record, ['문의대상(강사명)', 'teacherName', '강사명']);
        const memberName = findField(record, ['신청인 성명', 'inquirerName']);
        const memberPhone = findField(record, ['신청인 연락처', 'inquirerPhone', '연락처']);
        const memberEmailFromSheet = findField(record, ['연락받을 이메일', 'inquirerEmail', '이메일']);
        const teacherEmailFromSheet = findField(record, ['강사 이메일', 'teacherEmail']);
        const teacherEmail = teacherEmailFromSheet || teacherEmailByName.get(normalizeKey(teacherName)) || '';
        const memberEmail =
          memberEmailFromSheet ||
          memberEmailByNamePhone.get(`${normalizeKey(memberName)}::${normalizePhone(memberPhone)}`) ||
          memberEmailByName.get(normalizeKey(memberName)) ||
          '';

        return {
          inquiryId: String(record.inquiryId || `sheet-${rowIndex}`),
          rowIndex,
          receivedAt: findField(record, ['접수일시']),
          teacherName,
          teacherEmail,
          memberName,
          memberPhone,
          memberEmail,
          purpose: findField(record, ['문의 목적', 'purpose']),
          message: findField(record, ['상세 내용', 'message']),
          status: findField(record, ['처리 상태', 'status']) || '접수대기',
        };
      })
      .filter((item) => item.rowIndex > 0 && item.teacherName && item.memberName)
      .sort((a, b) => b.rowIndex - a.rowIndex);
  }, [filteredSheetSources]);

  const filteredInquiryItems = useMemo(() => {
    const keyword = inquirySearch.trim().toLowerCase();

    return inquiryItems.filter((item) => {
      const category = getInquiryStatusCategory(item.status);
      if (inquiryStatusFilter !== 'all' && category !== inquiryStatusFilter) return false;
      if (!keyword) return true;
      return [item.teacherName, item.memberName, item.memberEmail, item.purpose, item.message].some((value) =>
        value.toLowerCase().includes(keyword),
      );
    });
  }, [inquiryItems, inquirySearch, inquiryStatusFilter]);

  useEffect(() => {
    setInquiryPage(1);
    setSelectedInquiryIds([]);
  }, [inquirySearch, inquiryStatusFilter, filteredInquiryItems.length]);

  const inquiryPageCount = Math.max(1, Math.ceil(filteredInquiryItems.length / ADMIN_INQUIRY_PAGE_SIZE));

  const paginatedInquiryItems = useMemo(() => {
    const start = (inquiryPage - 1) * ADMIN_INQUIRY_PAGE_SIZE;
    return filteredInquiryItems.slice(start, start + ADMIN_INQUIRY_PAGE_SIZE);
  }, [filteredInquiryItems, inquiryPage]);

  const openInquiryAction = useCallback((item: InquiryItem, mode: InquiryActionMode) => {
    setInquiryActionMessage(null);
    setManualInquiryMessage(null);
    setInquiryActionTarget({ inquiryId: item.inquiryId, mode });

    if (mode === 'forward') {
      setForwardDrafts((prev) => ({
        ...prev,
        [item.inquiryId]: prev[item.inquiryId] || {
          subject: `[양양이음터 문의 전달] ${item.teacherName} 강사님`,
          message: `${item.teacherName} 강사님께 문의 내용을 전달드립니다.\n\n신청자: ${item.memberName}\n연락처: ${item.memberPhone}\n이메일: ${item.memberEmail || '-'}\n문의 목적: ${item.purpose}\n\n문의 내용:\n${item.message || '-'}`,
        },
      }));
      return;
    }

    setReplyDrafts((prev) => ({
      ...prev,
      [item.inquiryId]: prev[item.inquiryId] || {
        subject: `[양양이음터 회신] ${item.memberName}님 문의 답변`,
        message: `${item.memberName}님,\n센터 확인 후 회신드립니다.\n\n문의 대상 강사: ${item.teacherName}\n문의 목적: ${item.purpose}\n\n답변 내용을 아래에 입력해 발송해 주세요.`,
      },
    }));
  }, []);

  const handleInquiryAction = useCallback(
    async (item: InquiryItem, mode: InquiryActionMode) => {
      const endpoint = getAppPath(mode === 'forward' ? '/api/admin/inquiries/forward' : '/api/admin/inquiries/reply');
      const draft = mode === 'forward' ? forwardDrafts[item.inquiryId] : replyDrafts[item.inquiryId];

      if (!draft?.subject || !draft?.message) {
        setInquiryActionMessage('제목과 메시지를 입력해 주세요.');
        return;
      }

      if (mode === 'forward' && !item.teacherEmail) {
        setInquiryActionMessage('강사 이메일을 찾지 못했습니다. 강사DB의 로그인용 이메일 또는 이메일을 확인해 주세요.');
        return;
      }

      if (mode === 'reply' && !item.memberEmail) {
        setInquiryActionMessage('회원 이메일을 찾지 못했습니다. 문의접수 또는 이용자DB의 이메일을 확인해 주세요.');
        return;
      }

      setInquiryActionLoadingId(item.inquiryId);
      setInquiryActionMessage(null);

      try {
        const payload =
          mode === 'forward'
            ? {
                inquiryId: item.inquiryId,
                teacherEmail: item.teacherEmail,
                teacherName: item.teacherName,
                subject: draft.subject,
                message: draft.message,
              }
            : {
                inquiryId: item.inquiryId,
                memberEmail: item.memberEmail,
                memberName: item.memberName,
                subject: draft.subject,
                message: draft.message,
              };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || '문의 작업 실패');
        }

        setInquiryActionMessage(mode === 'forward' ? '강사 전달이 완료되었습니다.' : '회원 회신이 완료되었습니다.');
        setInquiryActionTarget(null);
        await fetchAdminSheets();
      } catch (error) {
        setInquiryActionMessage(error instanceof Error ? error.message : '문의 작업 실패');
      } finally {
        setInquiryActionLoadingId(null);
      }
    },
    [fetchAdminSheets, forwardDrafts, replyDrafts],
  );

  const handleSaveMember = async () => {
    if (!memberForm?.email) {
      setMemberMessage('회원 이메일이 없어 저장할 수 없습니다.');
      return;
    }

    setMemberSaving(true);
    setMemberMessage(null);

    try {
      const res = await fetch(getAppPath('/api/admin/members'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberForm.email,
          name: memberForm.name,
          phone: memberForm.phone,
          org: memberForm.org,
          status: memberForm.status,
          memberType: memberForm.memberType,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '회원 정보 저장 실패');
      }

      setMemberMessage('회원 정보가 저장되었습니다.');
      await fetchAdminSheets();
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : '회원 정보 저장 실패');
    } finally {
      setMemberSaving(false);
    }
  };

  const handleSaveAdminInstructor = async () => {
    if (!selectedAdminInstructor || !adminInstructorForm) return;

    const targetEmail =
      getInstructorEmail(adminInstructorForm) || selectedAdminInstructor.loginEmail || selectedAdminInstructor.email;

    if (!targetEmail) {
      setAdminInstructorMessage('로그인용 이메일이 없어 저장할 수 없습니다.');
      return;
    }

    setAdminInstructorSaving(true);
    setAdminInstructorMessage(null);

    try {
      const res = await fetch(getAppPath('/api/admin/instructors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          contactEmail: findField(adminInstructorForm, ['이메일', 'Email', 'email']),
          name: getInstructorName(adminInstructorForm),
          phone: getInstructorPhone(adminInstructorForm),
          org: getInstructorOrg(adminInstructorForm),
          field: getInstructorField(adminInstructorForm),
          area: findField(adminInstructorForm, ['Activity_Area', '활동지역']),
          intro: getInstructorIntro(adminInstructorForm),
          career: getInstructorCareer(adminInstructorForm),
          address: getInstructorAddress(adminInstructorForm),
          instagram: getInstructorInstagram(adminInstructorForm),
          instagramOpen: getInstructorInstagramOpen(adminInstructorForm) as '공개' | '미공개',
          portfolioLink: getInstructorPortfolioLink(adminInstructorForm),
          profilePhoto: getInstructorProfilePhoto(adminInstructorForm),
          isLocal: isLocalInstructor(adminInstructorForm) ? 'Y' : 'N',
          status: getInstructorStatus(adminInstructorForm),
          finalStatus: getInstructorFinalStatus(adminInstructorForm),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '강사 정보 저장 실패');
      }

      setAdminInstructorMessage('강사 카드 정보가 저장되었습니다.');
      await Promise.all([fetchAdminSheets(), fetchAllInstructors()]);
    } catch (error) {
      setAdminInstructorMessage(error instanceof Error ? error.message : '강사 정보 저장 실패');
    } finally {
      setAdminInstructorSaving(false);
    }
  };

  const handleAdminInstructorPhotoFile = useCallback(
    async (file: File | null) => {
      if (!file || !adminInstructorForm || !selectedAdminInstructor) return;

      const targetEmail =
        getInstructorEmail(adminInstructorForm) || selectedAdminInstructor.loginEmail || selectedAdminInstructor.email;

      if (!targetEmail) {
        setAdminInstructorMessage('로그인용 이메일이 없어 사진을 업로드할 수 없습니다.');
        return;
      }

      setAdminInstructorPhotoUploading(true);
      setAdminInstructorMessage(null);

      try {
        if (!file.type.startsWith('image/')) {
          throw new Error('이미지 파일만 업로드할 수 있습니다.');
        }

        const compressed = await compressImageForProfile(file);
        const uploadedUrl = await uploadProfilePhoto(compressed, getInstructorName(adminInstructorForm), targetEmail);

        setAdminInstructorForm((prev) => (prev ? { ...prev, 프로필사진: uploadedUrl } : prev));
        setAdminInstructorMessage('새 프로필 사진이 업로드되었습니다. 저장하면 강사카드에 반영됩니다.');
      } catch (error) {
        setAdminInstructorMessage(error instanceof Error ? error.message : '프로필 사진 업로드 실패');
      } finally {
        setAdminInstructorPhotoUploading(false);
        if (adminPhotoInputRef.current) adminPhotoInputRef.current.value = '';
      }
    },
    [adminInstructorForm, selectedAdminInstructor],
  );

  const handleAdminInstructorPhotoPaste = useCallback(
    async (event: React.ClipboardEvent<HTMLDivElement>) => {
      const pastedFile = getImageFileFromClipboard(event);
      if (!pastedFile) return;
      event.preventDefault();
      await handleAdminInstructorPhotoFile(pastedFile);
    },
    [handleAdminInstructorPhotoFile],
  );

  const handleAdminInstructorPhotoClear = useCallback(() => {
    setAdminInstructorForm((prev) => (prev ? { ...prev, 프로필사진: '' } : prev));
    setAdminInstructorMessage('프로필 사진 값을 비웠습니다. 저장하면 강사카드에서 제거됩니다.');
  }, []);

  const handleUpdateInstructorStatus = async (statusValue: string) => {
    if (!selectedAdminInstructor) return;

    const targetEmail = selectedAdminInstructor.loginEmail || selectedAdminInstructor.email;
    if (!targetEmail) {
      setAdminInstructorMessage('로그인용 이메일이 없는 강사는 상태를 변경할 수 없습니다.');
      return;
    }

    setInstructorStatusLoading(statusValue);
    setAdminInstructorMessage(null);

    try {
      const res = await fetch(getAppPath('/api/admin/instructors/status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          status: statusValue,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '강사 상태 변경 실패');
      }

      setAdminInstructorMessage(`강사 상태를 '${statusValue}'(으)로 변경했습니다.`);
      await Promise.all([fetchAdminSheets(), fetchAllInstructors()]);
    } catch (error) {
      setAdminInstructorMessage(error instanceof Error ? error.message : '강사 상태 변경 실패');
    } finally {
      setInstructorStatusLoading(null);
    }
  };

  const handleManualInquiryStatus = async (inquiryId: string, statusValue: string) => {
    setManualInquiryLoadingId(inquiryId);
    setManualInquiryMessage(null);

    try {
      const res = await fetch(getAppPath('/api/admin/inquiries/status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId,
          status: statusValue,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '문의 상태 변경 실패');
      }

      setManualInquiryMessage(`문의 상태를 '${statusValue}'(으)로 변경했습니다.`);
      await fetchAdminSheets();
    } catch (error) {
      setManualInquiryMessage(error instanceof Error ? error.message : '문의 상태 변경 실패');
    } finally {
      setManualInquiryLoadingId(null);
    }
  };

  const handleToggleInquirySelection = useCallback((inquiryId: string) => {
    setSelectedInquiryIds((prev) =>
      prev.includes(inquiryId) ? prev.filter((item) => item !== inquiryId) : [...prev, inquiryId],
    );
  }, []);

  const handleToggleInquiryPageSelection = useCallback(() => {
    const pageIds = paginatedInquiryItems.map((item) => item.inquiryId);
    const allSelected = pageIds.every((id) => selectedInquiryIds.includes(id));

    setSelectedInquiryIds((prev) =>
      allSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])),
    );
  }, [paginatedInquiryItems, selectedInquiryIds]);

  const handleBulkDeleteInquiries = useCallback(async () => {
    if (selectedInquiryIds.length === 0) return;

    setBulkInquiryDeleting(true);
    setManualInquiryMessage(null);
    setInquiryActionMessage(null);

    try {
      const responses = await Promise.all(
        selectedInquiryIds.map((inquiryId) =>
          fetch(getAppPath('/api/admin/inquiries/status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inquiryId,
              status: '삭제완료',
            }),
          }).then((response) => response.json()),
        ),
      );

      const failed = responses.find((item) => !item.success);
      if (failed) {
        throw new Error(failed.message || '선택한 문의 삭제 처리에 실패했습니다.');
      }

      setSelectedInquiryIds([]);
      setManualInquiryMessage(`${responses.length}건의 문의를 운영함에서 제외했습니다.`);
      await fetchAdminSheets();
    } catch (error) {
      setManualInquiryMessage(error instanceof Error ? error.message : '문의 일괄 삭제 처리에 실패했습니다.');
    } finally {
      setBulkInquiryDeleting(false);
    }
  }, [fetchAdminSheets, selectedInquiryIds]);

  const navigateToInquiryInbox = useCallback(() => {
    setActiveTab('admin');
    window.setTimeout(() => {
      document.getElementById('admin-inquiry-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const overview = useMemo(() => {
    const pendingInstructors = adminInstructorItems.filter((item) => getInstructorStatusCategory(item.status) === 'pending').length;
    const deleteRequested = adminInstructorItems.filter(
      (item) => getInstructorStatusCategory(item.status) === 'deleteRequested',
    ).length;
    const activeMembers = memberItems.filter((item) => item.status.includes('활성')).length;
    const pendingInquiries = inquiryItems.filter((item) => getInquiryStatusCategory(item.status) === 'pending').length;

    return {
      pendingInstructors,
      deleteRequested,
      activeMembers,
      pendingInquiries,
      issueCount: sheetBundle?.integrity.issueCount || 0,
    };
  }, [adminInstructorItems, inquiryItems, memberItems, sheetBundle?.integrity.issueCount]);

  const publicTabContent = (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">강사 목록 조회</h1>
        <p className="mt-1 text-sm text-gray-500">
          현재 모드: {effectiveRole} {isPreviewing ? '(미리보기)' : ''}
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이름, 전문분야, 활동지역 검색"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={localOnly} onChange={(event) => setLocalOnly(event.target.checked)} />
            양양 로컬만 보기
          </label>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setLocalOnly(false);
              setFieldFilter('all');
              setPublicPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            필터 초기화
          </button>
          <button
            type="button"
            onClick={fetchAllInstructors}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            새로고침
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {publicFieldOptions.map((option) => {
            const isActive = fieldFilter === option;
            const label = option === 'all' ? '전체 분야' : option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setFieldFilter(option)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
          <span>
            전체 {visibleInstructors.length}명 중{' '}
            {visibleInstructors.length === 0 ? 0 : (publicPage - 1) * PUBLIC_PAGE_SIZE + 1}-
            {Math.min(publicPage * PUBLIC_PAGE_SIZE, visibleInstructors.length)}번째 표시 중
          </span>
          <span>페이지당 20명씩 표시</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {instructorsLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : visibleInstructors.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">표시할 강사 데이터가 없습니다.</div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">성명</th>
                    <th className="px-3 py-2 text-left">전문분야</th>
                    <th className="px-3 py-2 text-left">활동지역</th>
                    <th className="px-3 py-2 text-left">연락처</th>
                    <th className="px-3 py-2 text-left">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedVisibleInstructors.map((inst, idx) => (
                    <tr key={`${getInstructorName(inst)}-${publicPage}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {getInstructorName(inst) || '-'}
                        {isLocalInstructor(inst) && (
                          <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white">로컬</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{getInstructorField(inst) || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{getInstructorArea(inst) || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{getInstructorPhone(inst) || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{getInstructorStatus(inst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 pb-4 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-gray-500">
                {publicPage} / {publicTotalPages} 페이지
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPublicPage((prev) => Math.max(1, prev - 1))}
                  disabled={publicPage === 1}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                {publicPaginationItems.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPublicPage(page)}
                    className={`min-w-9 rounded-lg border px-3 py-2 text-xs font-medium ${
                      page === publicPage
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPublicPage((prev) => Math.min(publicTotalPages, prev + 1))}
                  disabled={publicPage === publicTotalPages}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-l-emerald-700" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-gray-800">로그인이 필요합니다</h2>
          <p className="mb-6 text-sm text-gray-500">강사 이음터 관리 시스템 접근을 위해 로그인해 주세요.</p>
          <button
            onClick={() => signIn()}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-800"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="flex w-full flex-col border-r border-gray-200 bg-white p-4 md:w-72">
        <div className="mb-4 hidden border-b border-gray-100 px-4 py-4 md:block">
          <h2 className="text-lg font-bold text-emerald-800">이음터 통합 관리자</h2>
          <p className="mt-1 text-xs text-gray-500">계정: {session.user?.name || '-'}</p>
          <p className="mt-1 text-xs text-gray-500">실제 권한: {actualRole}</p>
        </div>

        {actualRole === 'ADMIN' && (
          <div className="mb-3 px-2">
            <label className="mb-1 block text-xs text-gray-500">테스트 미리보기 권한</label>
            <select
              value={previewRole || 'ADMIN'}
              onChange={(event) => setPreviewRole(event.target.value as Role)}
              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="ADMIN">ADMIN (실제 운영)</option>
              <option value="INSTRUCTOR">INSTRUCTOR 미리보기</option>
              <option value="USER">USER 미리보기</option>
              <option value="GUEST">GUEST 미리보기</option>
            </select>
            {isPreviewing && (
              <p className="mt-1 text-[11px] text-amber-700">
                미리보기 모드에서는 공용 화면만 점검하세요. 관리자용 수정 액션은 실제 ADMIN 모드에서 쓰는 편이 안전합니다.
              </p>
            )}
          </div>
        )}

        <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-hidden md:pb-0">
          <button
            onClick={() => setActiveTab('public')}
            className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium ${
              activeTab === 'public' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            강사 목록 조회
          </button>

          {(actualRole === 'ADMIN' || effectiveRole === 'USER') && (
            <button
              onClick={() => setActiveTab('member')}
              className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium ${
                activeTab === 'member' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {actualRole === 'ADMIN' ? '회원 관리' : '일반회원 화면'}
            </button>
          )}

          {(effectiveRole === 'INSTRUCTOR' || effectiveRole === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('instructor')}
              className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium ${
                activeTab === 'instructor' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              강사 프로필 관리
            </button>
          )}

          {actualRole === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium ${
                activeTab === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              시트 통합 관리
            </button>
          )}
          {actualRole === 'ADMIN' && (
            <button
              onClick={navigateToInquiryInbox}
              className="whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              문의 운영함
            </button>
          )}
        </nav>

        <div className="mt-auto hidden pt-4 md:block">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full rounded-lg bg-gray-50 px-4 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
        {activeTab === 'public' && publicTabContent}

        {false && activeTab === 'public' && (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">강사 목록 조회</h1>
              <p className="mt-1 text-sm text-gray-500">
                현재 모드: {effectiveRole} {isPreviewing ? '(미리보기)' : ''}
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름, 전문분야, 활동지역 검색"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={localOnly} onChange={(event) => setLocalOnly(event.target.checked)} />
                양양 로컬만 보기
              </label>
              <button
                onClick={fetchAllInstructors}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                새로고침
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {publicFieldOptions.map((option) => {
                const isActive = fieldFilter === option;
                const label = option === 'all' ? '전체 분야' : option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFieldFilter(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setLocalOnly(false);
                  setFieldFilter('all');
                  setPublicPage(1);
                }}
                className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-gray-400 hover:bg-gray-50"
              >
                필터 초기화
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              {instructorsLoading ? (
                <div className="p-6 text-center text-sm text-gray-500">데이터를 불러오는 중입니다...</div>
              ) : visibleInstructors.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">표시할 강사 데이터가 없습니다.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 px-4 pt-4 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                    <span>
                      전체 {visibleInstructors.length}명 중{' '}
                      {Math.min((publicPage - 1) * PUBLIC_PAGE_SIZE + 1, visibleInstructors.length || 1)}-
                      {Math.min(publicPage * PUBLIC_PAGE_SIZE, visibleInstructors.length)}번째 표시 중
                    </span>
                    <span>페이지당 20명씩 표시</span>
                  </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">성명</th>
                        <th className="px-3 py-2 text-left">전문분야</th>
                        <th className="px-3 py-2 text-left">활동지역</th>
                        <th className="px-3 py-2 text-left">연락처</th>
                        <th className="px-3 py-2 text-left">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedVisibleInstructors.map((inst, idx) => (
                        <tr key={`${getInstructorName(inst)}-${publicPage}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {getInstructorName(inst) || '-'}
                            {isLocalInstructor(inst) && (
                              <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white">로컬</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{getInstructorField(inst) || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{getInstructorArea(inst) || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{getInstructorPhone(inst) || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{getInstructorStatus(inst)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

        {activeTab === 'member' && actualRole !== 'ADMIN' && effectiveRole === 'USER' && (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">일반회원 모드</h1>
              <p className="mt-1 text-sm text-gray-500">문의 접수와 이용자DB 구조를 확인하는 미리보기 화면입니다.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">이용자DB 샘플</h3>
              {filteredSheetSources ? (
                renderGenericTable(filteredSheetSources.memberDb.rows, '이용자DB 데이터가 없습니다.')
              ) : (
                <div className="text-sm text-gray-500">관리자 데이터가 아직 로드되지 않았습니다.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'member' && actualRole === 'ADMIN' && (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">회원 관리</h1>
              <p className="mt-1 text-sm text-gray-500">이름, 연락처, 소속, 상태를 운영 기준으로 정리하는 기본 관리 화면입니다.</p>
            </div>

            {sheetLoading && <div className="text-sm text-gray-500">회원 데이터를 불러오는 중입니다...</div>}
            {sheetError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sheetError}</div>}

            {filteredSheetSources && (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard
                    label="전체 회원"
                    value={memberItems.length}
                    description={`활성 ${overview.activeMembers}명 / 기타 ${Math.max(memberItems.length - overview.activeMembers, 0)}명`}
                  />
                  <StatCard
                    label="검색 결과"
                    value={filteredMembers.length}
                    description={memberSearch ? '검색어가 적용된 목록입니다.' : '전체 목록 기준입니다.'}
                  />
                  <StatCard
                    label="최근 로그인 기록"
                    value={memberItems.filter((item) => item.lastLogin).length}
                    description="Last_Login 값이 있는 회원 수"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row">
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="이름, 이메일, 연락처, 소속 검색"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={memberStatusFilter}
                    onChange={(event) => setMemberStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">전체 상태</option>
                    <option value="active">활성만</option>
                    <option value="inactive">활성 외</option>
                  </select>
                  <button
                    onClick={fetchAdminSheets}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    새로고침
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <h3 className="text-sm font-semibold text-gray-800">회원 목록</h3>
                      <p className="mt-1 text-xs text-gray-500">최대 {filteredMembers.length}건</p>
                    </div>
                    <div className="max-h-[640px] overflow-y-auto p-3">
                      {filteredMembers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                          조건에 맞는 회원이 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredMembers.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedMemberId(item.id)}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                                item.id === selectedMemberId
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-gray-900">{item.name || '(이름 없음)'}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getMemberStatusTone(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-500">{item.email || '이메일 없음'}</div>
                              <div className="mt-2 text-xs text-gray-600">
                                {item.phone || '연락처 없음'} · {item.org || '소속 없음'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    {!memberForm ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                        수정할 회원을 선택해 주세요.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{memberForm.name || '회원 상세'}</h3>
                            <p className="mt-1 text-sm text-gray-500">이메일은 현재 식별키로 사용하므로 읽기 전용입니다.</p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <div>row #{selectedMember?.rowIndex || '-'}</div>
                            <div>최근 로그인: {memberForm.lastLogin || '-'}</div>
                          </div>
                        </div>

                        {memberMessage && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            {memberMessage}
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <FieldLabel>이름</FieldLabel>
                            <input
                              value={memberForm.name}
                              onChange={(event) =>
                                setMemberForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <FieldLabel>이메일</FieldLabel>
                            <input
                              value={memberForm.email}
                              readOnly
                              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                            />
                          </div>
                          <div>
                            <FieldLabel>연락처</FieldLabel>
                            <input
                              value={memberForm.phone}
                              onChange={(event) =>
                                setMemberForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev))
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <FieldLabel>소속</FieldLabel>
                            <input
                              value={memberForm.org}
                              onChange={(event) =>
                                setMemberForm((prev) => (prev ? { ...prev, org: event.target.value } : prev))
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <FieldLabel>상태</FieldLabel>
                            <select
                              value={memberForm.status}
                              onChange={(event) =>
                                setMemberForm((prev) => (prev ? { ...prev, status: event.target.value } : prev))
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              {[memberForm.status, ...MEMBER_STATUS_OPTIONS]
                                .filter((value, index, array) => value && array.indexOf(value) === index)
                                .map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <FieldLabel>회원유형</FieldLabel>
                            <select
                              value={memberForm.memberType}
                              onChange={(event) =>
                                setMemberForm((prev) => (prev ? { ...prev, memberType: event.target.value } : prev))
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              {[memberForm.memberType, ...MEMBER_TYPE_OPTIONS]
                                .filter((value, index, array) => value && array.indexOf(value) === index)
                                .map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleSaveMember}
                            disabled={memberSaving}
                            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {memberSaving ? '저장 중...' : '회원 정보 저장'}
                          </button>
                          <button
                            onClick={fetchAdminSheets}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                          >
                            시트 다시 불러오기
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'instructor' && (effectiveRole === 'INSTRUCTOR' || effectiveRole === 'ADMIN') && (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">강사 프로필 관리</h1>
              <p className="mt-1 text-sm text-gray-500">강사 계정이 직접 수정하는 기본 프로필 화면입니다.</p>
            </div>

            {isPreviewing && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                관리자 미리보기 모드에서는 강사 개인 프로필 수정 대신 화면 동작만 점검할 수 있습니다.
              </div>
            )}
            {profileLoading && <div className="text-sm text-gray-500">프로필 로딩 중...</div>}
            {profileError && <div className="text-sm text-red-600">{profileError}</div>}

            {profile && !profileLoading && (
              <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2">
                {['성명', '연락처', '강의분야', 'Activity_Area'].map((fieldKey) => (
                  <div key={fieldKey}>
                    <FieldLabel>{fieldKey}</FieldLabel>
                    <input
                      value={String(profileForm[fieldKey] || '')}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, [fieldKey]: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      disabled={isPreviewing}
                    />
                  </div>
                ))}

                <div className="md:col-span-2">
                  <FieldLabel>소개</FieldLabel>
                  <textarea
                    rows={5}
                    value={String(profileForm['상세내용'] || '')}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, 상세내용: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    disabled={isPreviewing}
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving || isPreviewing}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  {saveMessage && <span className="text-sm text-gray-600">{saveMessage}</span>}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'admin' && actualRole === 'ADMIN' && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">시트 통합 관리</h1>
                <p className="mt-1 text-sm text-gray-500">승인 대기 강사, 회원 운영, 문의 처리까지 한 번에 점검하는 운영 대시보드입니다.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {adminRefreshedAt && <span className="text-xs text-gray-500">마지막 새로고침: {adminRefreshedAt}</span>}
                <button
                  onClick={handleMirrorSync}
                  disabled={mirrorSyncing}
                  className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {mirrorSyncing ? '미러 동기화 중...' : 'Firestore 미러 동기화'}
                </button>
                <button
                  onClick={fetchAdminSheets}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  통합 새로고침
                </button>
              </div>
            </div>

            {sheetLoading && <div className="text-sm text-gray-500">시트 통합 데이터 로딩 중...</div>}
            {sheetError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sheetError}</div>}
            {mirrorMessage && <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{mirrorMessage}</div>}

            {sheetBundle && filteredSheetSources && (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <StatCard
                    label="승인 대기 강사"
                    value={overview.pendingInstructors}
                    description={`삭제요청 ${overview.deleteRequested}건`}
                  />
                  <StatCard
                    label="전체 강사"
                    value={sheetBundle.stats.instructorDb.total}
                    description={`승인 ${sheetBundle.stats.instructorDb.approved}명 / 로컬 ${sheetBundle.stats.instructorDb.local}명`}
                  />
                  <StatCard
                    label="활성 회원"
                    value={overview.activeMembers}
                    description={`전체 회원 ${sheetBundle.stats.memberDb.total}명`}
                  />
                  <StatCard
                    label="문의 대기"
                    value={overview.pendingInquiries}
                    description={`전달 ${sheetBundle.stats.inquiryDb.forwarded}건 / 완료 ${sheetBundle.stats.inquiryDb.completed}건`}
                  />
                  <StatCard
                    label="무결성 경고"
                    value={overview.issueCount}
                    description={overview.issueCount === 0 ? '즉시 조치 필요 항목 없음' : '중복/누락 데이터 확인 필요'}
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-100 px-4 py-4">
                      <h3 className="text-sm font-semibold text-gray-800">강사 승인 큐</h3>
                      <p className="mt-1 text-xs text-gray-500">상태 변경과 기본 정보 정리를 한 곳에서 처리합니다.</p>
                    </div>
                    <div className="space-y-3 p-4">
                      <input
                        value={adminInstructorSearch}
                        onChange={(event) => setAdminInstructorSearch(event.target.value)}
                        placeholder="이름, 분야, 지역, 이메일 검색"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <select
                        value={adminInstructorStatusFilter}
                        onChange={(event) =>
                          setAdminInstructorStatusFilter(
                            event.target.value as 'all' | 'pending' | 'approved' | 'deleteRequested' | 'other',
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="pending">승인 대기</option>
                        <option value="all">전체 상태</option>
                        <option value="approved">승인 완료</option>
                        <option value="deleteRequested">삭제 요청</option>
                        <option value="other">기타 상태</option>
                      </select>
                    </div>
                    <div className="max-h-[760px] overflow-y-auto px-4 pb-4">
                      {filteredAdminInstructors.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                          조건에 맞는 강사가 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredAdminInstructors.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedInstructorId(item.id)}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                                item.id === selectedInstructorId
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{item.name || '(이름 없음)'}</div>
                                  <div className="mt-1 text-xs text-gray-500">{item.field || '분야 미입력'}</div>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getInstructorStatusTone(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-gray-600">
                                {item.area || '활동지역 없음'} · {item.phone || '연락처 없음'}
                              </div>
                              <div className="mt-1 text-[11px] text-gray-400">
                                {item.loginEmail || item.email || '이메일 없음'} · row #{item.rowIndex || '-'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    {!selectedAdminInstructor || !adminInstructorForm ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-500">
                        운영할 강사를 선택해 주세요.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900">{selectedAdminInstructor.name || '강사 상세'}</h3>
                              {selectedAdminInstructor.isLocal && (
                                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white">양양 로컬</span>
                              )}
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getInstructorStatusTone(selectedAdminInstructor.status)}`}>
                                {selectedAdminInstructor.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              승인 상태와 카드 노출 정보를 함께 정리할 수 있습니다. 저장은 관리자 전용 경로로 처리됩니다.
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <div>row #{selectedAdminInstructor.rowIndex || '-'}</div>
                            <div>최근 수정: {selectedAdminInstructor.updatedAt || '-'}</div>
                          </div>
                        </div>

                        {adminInstructorMessage && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            {adminInstructorMessage}
                          </div>
                        )}

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_340px]">
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <FieldLabel>성명</FieldLabel>
                                <input
                                  value={getInstructorName(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 성명: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <FieldLabel>로그인용 이메일</FieldLabel>
                                <input
                                  value={getInstructorEmail(adminInstructorForm)}
                                  readOnly
                                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                                />
                              </div>
                              <div>
                                <FieldLabel>연락처</FieldLabel>
                                <input
                                  value={getInstructorPhone(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 연락처: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <FieldLabel>공개 연락 이메일</FieldLabel>
                                <input
                                  value={findField(adminInstructorForm, ['이메일', 'Email', 'email'])}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 이메일: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <FieldLabel>소속</FieldLabel>
                                <input
                                  value={getInstructorOrg(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 소속: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <FieldLabel>활동지역</FieldLabel>
                                <input
                                  value={findField(adminInstructorForm, ['Activity_Area', '활동지역'])}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, Activity_Area: event.target.value, 활동지역: event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <FieldLabel>강의분야</FieldLabel>
                                <select
                                  value={getInstructorField(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, 강의분야: event.target.value, 전문분야: event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                >
                                  <option value="">강의 분야를 선택해 주세요</option>
                                  {INSTRUCTOR_FIELD_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <FieldLabel>로컬 강사 여부</FieldLabel>
                                <select
                                  value={isLocalInstructor(adminInstructorForm) ? 'Y' : 'N'}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, isLocal: event.target.value as 'Y' | 'N', 로컬: event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                >
                                  <option value="N">일반</option>
                                  <option value="Y">양양 로컬</option>
                                </select>
                              </div>
                              <div>
                                <FieldLabel>현재 상태</FieldLabel>
                                <select
                                  value={getInstructorStatus(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 상태: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                >
                                  {[getInstructorStatus(adminInstructorForm), ...INSTRUCTOR_STATUS_OPTIONS]
                                    .filter((value, index, array) => value && array.indexOf(value) === index)
                                    .map((value) => (
                                      <option key={value} value={value}>
                                        {value}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <FieldLabel>최종 승인 상태</FieldLabel>
                                <select
                                  value={getInstructorFinalStatus(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, '승인상태(최종)': event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                >
                                  {[getInstructorFinalStatus(adminInstructorForm), ...INSTRUCTOR_STATUS_OPTIONS]
                                    .filter((value, index, array) => value && array.indexOf(value) === index)
                                    .map((value) => (
                                      <option key={value} value={value}>
                                        {value}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <FieldLabel>인스타그램 주소</FieldLabel>
                                <input
                                  value={getInstructorInstagram(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, 인스타그램주소: event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <FieldLabel>인스타그램 공개 여부</FieldLabel>
                                <select
                                  value={getInstructorInstagramOpen(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, 인스타그램공개여부: event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                >
                                  {INSTAGRAM_VISIBILITY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <FieldLabel>포트폴리오 링크</FieldLabel>
                                <input
                                  value={getInstructorPortfolioLink(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) =>
                                      prev ? { ...prev, Portfolio_Link: event.target.value } : prev,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <FieldLabel>주소</FieldLabel>
                                <input
                                  value={getInstructorAddress(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 주소: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <FieldLabel>주요경력</FieldLabel>
                                <textarea
                                  rows={4}
                                  value={getInstructorCareer(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 주요경력: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <FieldLabel>소개</FieldLabel>
                                <textarea
                                  rows={6}
                                  value={getInstructorIntro(adminInstructorForm)}
                                  onChange={(event) =>
                                    setAdminInstructorForm((prev) => (prev ? { ...prev, 상세내용: event.target.value } : prev))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div
                              onPaste={handleAdminInstructorPhotoPaste}
                              className="rounded-2xl border border-gray-200 bg-gray-50 p-3"
                            >
                              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                                {getInstructorProfilePhoto(adminInstructorForm) ? (
                                  <Image
                                    src={getInstructorProfilePhoto(adminInstructorForm)}
                                    alt={`${getInstructorName(adminInstructorForm)} 강사 프로필 사진`}
                                    width={1200}
                                    height={960}
                                    unoptimized
                                    className="h-80 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-80 items-center justify-center text-sm text-gray-400">
                                    등록된 프로필 사진이 없습니다.
                                  </div>
                                )}
                              </div>
                              <div className="mt-3 space-y-2">
                                <div className="text-xs text-gray-500">
                                  파일 첨부 또는 붙여넣기로 새 사진을 올릴 수 있습니다. 업로드 후 저장해야 카드에 반영됩니다.
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => adminPhotoInputRef.current?.click()}
                                    disabled={adminInstructorPhotoUploading}
                                    className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    {adminInstructorPhotoUploading ? '사진 업로드 중...' : '새 사진 업로드'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAdminInstructorPhotoClear}
                                    disabled={adminInstructorPhotoUploading || !getInstructorProfilePhoto(adminInstructorForm)}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs hover:bg-gray-100 disabled:opacity-50"
                                  >
                                    사진 값 비우기
                                  </button>
                                </div>
                                <input
                                  ref={adminPhotoInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => {
                                    void handleAdminInstructorPhotoFile(event.target.files?.[0] || null);
                                  }}
                                />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <div className="text-sm font-semibold text-gray-900">카드 미리보기</div>
                              <div className="mt-3 space-y-3">
                                <div>
                                  <div className="text-lg font-semibold text-gray-900">{getInstructorName(adminInstructorForm) || '이름 없음'}</div>
                                  <div className="mt-1 text-sm text-emerald-700">{getInstructorField(adminInstructorForm) || '강의분야 미입력'}</div>
                                </div>
                                <div className="text-sm text-gray-600">{findField(adminInstructorForm, ['Activity_Area', '활동지역']) || '활동지역 미입력'}</div>
                                <div className="text-sm text-gray-600">{getInstructorOrg(adminInstructorForm) || '소속 미입력'}</div>
                                <div className="rounded-xl bg-white p-3 text-sm text-gray-600">
                                  {getInstructorIntro(adminInstructorForm) || '소개 문구가 없습니다.'}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                              <div className="text-sm font-semibold text-gray-900">운영 메모</div>
                              <div className="mt-3 space-y-2 text-xs text-gray-500">
                                <div>강사ID: {findField(adminInstructorForm, ['강사ID']) || '-'}</div>
                                <div>로그인 이메일: {getInstructorEmail(adminInstructorForm) || '-'}</div>
                                <div>공개 연락 이메일: {findField(adminInstructorForm, ['이메일', 'Email', 'email']) || '-'}</div>
                                <div>포트폴리오: {getInstructorPortfolioLink(adminInstructorForm) || '-'}</div>
                                <div>인스타 공개: {getInstructorInstagramOpen(adminInstructorForm)}</div>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {getInstructorProfilePhoto(adminInstructorForm) && (
                                  <a
                                    href={getInstructorProfilePhoto(adminInstructorForm)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
                                  >
                                    사진 열기
                                  </a>
                                )}
                                {getInstructorPortfolioLink(adminInstructorForm) && (
                                  <a
                                    href={getInstructorPortfolioLink(adminInstructorForm)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
                                  >
                                    포트폴리오 열기
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">원본 필드 확인</div>
                              <div className="mt-1 text-xs text-gray-500">스프레드시트에 들어가는 실제 키와 값을 바로 점검합니다.</div>
                            </div>
                            <div className="text-xs text-gray-400">
                              {Object.entries(adminInstructorForm).filter(([, value]) => hasMeaningfulValue(value)).length}개 필드
                            </div>
                          </div>
                          <div className="mt-4 grid gap-x-4 gap-y-2 md:grid-cols-2">
                            {Object.entries(adminInstructorForm)
                              .filter(([key, value]) => key !== 'rowIndex' && hasMeaningfulValue(value))
                              .sort(([a], [b]) => a.localeCompare(b, 'ko'))
                              .map(([key, value]) => (
                                <div key={key} className="rounded-xl border border-white bg-white px-3 py-2">
                                  <div className="text-[11px] font-medium text-gray-400">{key}</div>
                                  <div className="mt-1 break-all text-sm text-gray-700">{String(value)}</div>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleSaveAdminInstructor}
                            disabled={adminInstructorSaving || adminInstructorPhotoUploading}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {adminInstructorSaving ? '저장 중...' : adminInstructorPhotoUploading ? '사진 업로드 중...' : '강사 카드 저장'}
                          </button>
                          {['승인', '대기', '삭제요청'].map((statusValue) => (
                            <button
                              key={statusValue}
                              onClick={() => handleUpdateInstructorStatus(statusValue)}
                              disabled={instructorStatusLoading !== null}
                              className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                                statusValue === '승인'
                                  ? 'bg-emerald-700 text-white'
                                  : statusValue === '삭제요청'
                                    ? 'bg-rose-600 text-white'
                                    : 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              {instructorStatusLoading === statusValue ? `${statusValue} 처리 중...` : statusValue}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">데이터 무결성 진단</h3>
                  {sheetBundle.integrity.issueCount === 0 ? (
                    <div className="text-sm text-emerald-700">무결성 경고가 없습니다.</div>
                  ) : (
                    <div className="space-y-2">
                      {sheetBundle.integrity.issues.map((issue) => (
                        <div key={issue.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="text-sm font-semibold text-amber-900">
                            [{issue.severity.toUpperCase()}] {issue.message}
                          </div>
                          <div className="text-xs text-amber-800">건수: {issue.count}</div>
                          <div className="truncate text-xs text-amber-700">샘플: {JSON.stringify(issue.samples)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div id="admin-inquiry-box" className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">문의 운영함</h3>
                      <p className="mt-1 text-xs text-gray-500">문의 상태 정리, 강사 전달, 회원 회신까지 처리하는 운영 큐입니다.</p>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row">
                      <input
                        value={inquirySearch}
                        onChange={(event) => setInquirySearch(event.target.value)}
                        placeholder="강사, 신청자, 목적, 내용 검색"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <select
                        value={inquiryStatusFilter}
                        onChange={(event) =>
                          setInquiryStatusFilter(event.target.value as 'all' | 'pending' | 'forwarded' | 'completed' | 'deleted')
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="pending">대기 문의</option>
                        <option value="all">전체 상태</option>
                        <option value="forwarded">강사 전달 완료</option>
                        <option value="completed">회신 완료</option>
                        <option value="deleted">삭제완료</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleBulkDeleteInquiries}
                        disabled={bulkInquiryDeleting || selectedInquiryIds.length === 0}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {bulkInquiryDeleting ? '삭제 처리 중...' : `선택 삭제 ${selectedInquiryIds.length}`}
                      </button>
                    </div>
                  </div>

                  {manualInquiryMessage && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {manualInquiryMessage}
                    </div>
                  )}
                  {inquiryActionMessage && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {inquiryActionMessage}
                    </div>
                  )}

                  {filteredInquiryItems.length === 0 ? (
                    <div className="text-sm text-gray-500">조건에 맞는 문의가 없습니다.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={
                              paginatedInquiryItems.length > 0 &&
                              paginatedInquiryItems.every((item) => selectedInquiryIds.includes(item.inquiryId))
                            }
                            onChange={handleToggleInquiryPageSelection}
                          />
                          현재 페이지 전체 선택
                        </label>
                        <span>
                          총 {filteredInquiryItems.length}건 중 {Math.min((inquiryPage - 1) * ADMIN_INQUIRY_PAGE_SIZE + 1, filteredInquiryItems.length)}-
                          {Math.min(inquiryPage * ADMIN_INQUIRY_PAGE_SIZE, filteredInquiryItems.length)}번째
                        </span>
                      </div>
                      {paginatedInquiryItems.map((item) => {
                        const isForwardOpen =
                          inquiryActionTarget?.inquiryId === item.inquiryId && inquiryActionTarget.mode === 'forward';
                        const isReplyOpen =
                          inquiryActionTarget?.inquiryId === item.inquiryId && inquiryActionTarget.mode === 'reply';
                        const forwardDraft = forwardDrafts[item.inquiryId];
                        const replyDraft = replyDrafts[item.inquiryId];

                        return (
                          <div key={item.inquiryId} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="space-y-1">
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
                                  <input
                                    type="checkbox"
                                    checked={selectedInquiryIds.includes(item.inquiryId)}
                                    onChange={() => handleToggleInquirySelection(item.inquiryId)}
                                  />
                                  선택
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">{item.teacherName}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getInquiryStatusTone(item.status)}`}>
                                    {item.status}
                                  </span>
                                  <span className="text-[11px] text-gray-400">#{item.inquiryId}</span>
                                </div>
                                <div className="text-sm text-gray-700">
                                  신청자 {item.memberName} / {item.memberPhone || '-'} / {item.memberEmail || '이메일 없음'}
                                </div>
                                <div className="text-sm text-gray-600">문의 목적: {item.purpose || '-'}</div>
                                <div className="text-xs text-gray-500">접수일시: {item.receivedAt || '-'}</div>
                                <div className="whitespace-pre-wrap text-sm text-gray-600">{item.message || '상세 내용 없음'}</div>
                                <div className="text-xs text-gray-500">강사 이메일: {item.teacherEmail || '강사DB에서 찾지 못함'}</div>
                              </div>

                              <div className="flex flex-col gap-2 xl:w-56">
                                {INQUIRY_STATUS_PRESETS.map((preset) => (
                                  <button
                                    key={preset}
                                    onClick={() => handleManualInquiryStatus(item.inquiryId, preset)}
                                    disabled={manualInquiryLoadingId === item.inquiryId}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    {manualInquiryLoadingId === item.inquiryId ? '처리 중...' : preset}
                                  </button>
                                ))}
                                <button
                                  onClick={() => openInquiryAction(item, 'forward')}
                                  className="rounded-lg border border-sky-300 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50"
                                >
                                  강사 전달 메일
                                </button>
                                <button
                                  onClick={() => openInquiryAction(item, 'reply')}
                                  className="rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                                >
                                  회원 회신 메일
                                </button>
                              </div>
                            </div>

                            {isForwardOpen && (
                              <div className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
                                <div className="text-sm font-semibold text-sky-900">강사 전달 메일 작성</div>
                                <div className="text-xs text-sky-800">수신: {item.teacherEmail || '강사 이메일 없음'}</div>
                                <input
                                  value={forwardDraft?.subject || ''}
                                  onChange={(event) =>
                                    setForwardDrafts((prev) => ({
                                      ...prev,
                                      [item.inquiryId]: {
                                        subject: event.target.value,
                                        message: prev[item.inquiryId]?.message || '',
                                      },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm"
                                  placeholder="메일 제목"
                                />
                                <textarea
                                  rows={7}
                                  value={forwardDraft?.message || ''}
                                  onChange={(event) =>
                                    setForwardDrafts((prev) => ({
                                      ...prev,
                                      [item.inquiryId]: {
                                        subject: prev[item.inquiryId]?.subject || '',
                                        message: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleInquiryAction(item, 'forward')}
                                    disabled={inquiryActionLoadingId === item.inquiryId}
                                    className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                                  >
                                    {inquiryActionLoadingId === item.inquiryId ? '전달 중...' : '전달 실행'}
                                  </button>
                                  <button
                                    onClick={() => setInquiryActionTarget(null)}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-white"
                                  >
                                    닫기
                                  </button>
                                </div>
                              </div>
                            )}

                            {isReplyOpen && (
                              <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="text-sm font-semibold text-emerald-900">회원 회신 메일 작성</div>
                                <div className="text-xs text-emerald-800">수신: {item.memberEmail || '회원 이메일 없음'}</div>
                                <input
                                  value={replyDraft?.subject || ''}
                                  onChange={(event) =>
                                    setReplyDrafts((prev) => ({
                                      ...prev,
                                      [item.inquiryId]: {
                                        subject: event.target.value,
                                        message: prev[item.inquiryId]?.message || '',
                                      },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                                  placeholder="메일 제목"
                                />
                                <textarea
                                  rows={7}
                                  value={replyDraft?.message || ''}
                                  onChange={(event) =>
                                    setReplyDrafts((prev) => ({
                                      ...prev,
                                      [item.inquiryId]: {
                                        subject: prev[item.inquiryId]?.subject || '',
                                        message: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleInquiryAction(item, 'reply')}
                                    disabled={inquiryActionLoadingId === item.inquiryId}
                                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                                  >
                                    {inquiryActionLoadingId === item.inquiryId ? '회신 중...' : '회신 발송'}
                                  </button>
                                  <button
                                    onClick={() => setInquiryActionTarget(null)}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-white"
                                  >
                                    닫기
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {inquiryPageCount > 1 ? (
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                          {Array.from({ length: inquiryPageCount }, (_, index) => index + 1).map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setInquiryPage(page)}
                              className={`h-8 min-w-8 rounded-full px-3 text-xs font-semibold ${
                                inquiryPage === page
                                  ? 'bg-gray-900 text-white'
                                  : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-700'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      강사DB 샘플 ({filteredSheetSources.instructorDb.rows.length}/{sheetBundle.sources.instructorDb.rowCount})
                    </h3>
                    {renderGenericTable(filteredSheetSources.instructorDb.rows, '강사DB 데이터가 없습니다.')}
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      이용자DB 샘플 ({filteredSheetSources.memberDb.rows.length}/{sheetBundle.sources.memberDb.rowCount})
                    </h3>
                    {renderGenericTable(filteredSheetSources.memberDb.rows, '이용자DB 데이터가 없습니다.')}
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 xl:col-span-2">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      문의접수 샘플 ({filteredSheetSources.inquiryDb.rows.length}/{sheetBundle.sources.inquiryDb.rowCount})
                    </h3>
                    {renderGenericTable(filteredSheetSources.inquiryDb.rows, '문의접수 데이터가 없습니다.')}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
