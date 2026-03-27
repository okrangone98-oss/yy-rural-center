'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { profileUpdateSchema, type ProfileUpdatePayload } from '@/lib/domain';
import { getAppPath } from '@/lib/app-url';

type MemberProfileData = {
  name: string;
  email: string;
  phone: string;
  org: string;
  memberType: string;
  status: string;
  joinedAt: string;
};

type MemberInquiry = {
  inquiryId: string;
  rowIndex: number;
  receivedAt: string;
  teacherName: string;
  teacherEmail?: string;
  inquirerName: string;
  inquirerPhone: string;
  inquirerEmail: string;
  purpose: string;
  message: string;
  status: string;
  chatRoomId?: string;
  chatRoomStatus?: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
};

function firstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeProfile(raw: Record<string, unknown>): MemberProfileData {
  return {
    name: firstString(raw, ['이용자명', '이름', '성명', 'Name', 'name']),
    email: firstString(raw, ['이메일', '로그인용 이메일', 'Email', 'email']),
    phone: firstString(raw, ['연락처', 'Phone', 'phone']),
    org: firstString(raw, ['소속명', '소속', 'Org', 'org']),
    memberType: firstString(raw, ['회원유형', 'memberType']) || '일반회원',
    status: firstString(raw, ['상태', 'status']) || '활성',
    joinedAt: firstString(raw, ['가입일', 'joinedAt', 'Created_At']),
  };
}

const emptyProfile: MemberProfileData = {
  name: '',
  email: '',
  phone: '',
  org: '',
  memberType: '일반회원',
  status: '활성',
  joinedAt: '',
};

const INQUIRY_PAGE_SIZE = 4;

function ChatStatusBadge({ status }: { status?: MemberInquiry['chatRoomStatus'] }) {
  if (!status) return null;

  const tone =
    status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'PENDING'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-500';

  const label = status === 'ACTIVE' ? '채팅 가능' : status === 'PENDING' ? '수락 대기' : '종료';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export default function MemberProfileForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [profile, setProfile] = useState<MemberProfileData>(emptyProfile);
  const [profileWarning, setProfileWarning] = useState('');
  const [saveAvailable, setSaveAvailable] = useState(true);
  const [inquiries, setInquiries] = useState<MemberInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [inquiriesError, setInquiriesError] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [inquiryView, setInquiryView] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryPage, setInquiryPage] = useState(1);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileUpdatePayload>({
    resolver: zodResolver(profileUpdateSchema) as any,
    defaultValues: emptyProfile,
  });

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setLoadError('');

      try {
        const response = await fetch(getAppPath('/api/account/profile'), { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || '회원 정보를 불러오지 못했습니다.');
        }

        setProfileWarning(result.degraded ? result.message || '' : '');
        setSaveAvailable(result.saveAvailable !== false);
        const normalized = normalizeProfile(result.data);
        setProfile(normalized);
        reset(normalized);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '회원 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [reset]);

  useEffect(() => {
    async function loadInquiries() {
      setInquiriesLoading(true);
      setInquiriesError('');

      try {
        const response = await fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || '문의 내역을 불러오지 못했습니다.');
        }

        setChatEnabled(result.chatEnabled !== false);
        setInquiries(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        setInquiriesError(error instanceof Error ? error.message : '문의 내역을 불러오지 못했습니다.');
      } finally {
        setInquiriesLoading(false);
      }
    }

    void loadInquiries();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    setSubmitMessage('');

    try {
      const response = await fetch(getAppPath('/api/account/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name || '',
          phone: values.phone || '',
          org: values.org || '',
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '회원 정보 저장에 실패했습니다.');
      }

      const nextProfile = {
        ...profile,
        name: values.name || '',
        phone: values.phone || '',
        org: values.org || '',
      };
      setProfile(nextProfile);
      reset(nextProfile);
      setSubmitMessage('일반회원 정보가 저장되었습니다.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '회원 정보 저장에 실패했습니다.');
    }
  });

  const inquiryStats = useMemo(
    () => ({
      total: inquiries.length,
      pending: inquiries.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus).length,
      active: inquiries.filter((item) => item.chatRoomStatus === 'ACTIVE').length,
      archived: inquiries.filter((item) => item.chatRoomStatus === 'ARCHIVED').length,
    }),
    [inquiries],
  );

  const visibleInquiries = useMemo(() => {
    if (inquiryView === 'ALL') return inquiries;
    if (inquiryView === 'PENDING') {
      return inquiries.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus);
    }
    return inquiries.filter((item) => item.chatRoomStatus === inquiryView);
  }, [inquiries, inquiryView]);

  const filteredVisibleInquiries = useMemo(() => {
    const keyword = inquirySearch.trim().toLowerCase();
    if (!keyword) return visibleInquiries;

    return visibleInquiries.filter((item) =>
      [item.teacherName, item.inquirerPhone, item.purpose, item.message]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [inquirySearch, visibleInquiries]);

  useEffect(() => {
    setInquiryPage(1);
  }, [inquirySearch, inquiryView]);

  const inquiryPageCount = Math.max(1, Math.ceil(filteredVisibleInquiries.length / INQUIRY_PAGE_SIZE));

  const paginatedInquiries = useMemo(() => {
    const start = (inquiryPage - 1) * INQUIRY_PAGE_SIZE;
    return filteredVisibleInquiries.slice(start, start + INQUIRY_PAGE_SIZE);
  }, [filteredVisibleInquiries, inquiryPage]);

  const memberAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (inquiryStats.pending > 0) {
      alerts.push(`답변 또는 수락을 기다리는 문의 ${inquiryStats.pending}건`);
    }
    if (inquiryStats.active > 0) {
      alerts.push(`바로 채팅 가능한 문의 ${inquiryStats.active}건`);
    }
    if (!alerts.length && inquiries.length > 0) {
      alerts.push('최근 문의 이력이 보관되어 있습니다.');
    }
    return alerts;
  }, [inquiries.length, inquiryStats.active, inquiryStats.pending]);

  if (loading) {
    return <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-sm text-gray-500">회원 정보를 불러오는 중입니다.</div>;
  }

  if (loadError) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">{loadError}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-sky-100 bg-[linear-gradient(135deg,#0b3b5e_0%,#14638c_100%)] px-6 py-7 text-white shadow-[0_25px_80px_rgba(8,42,66,0.18)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100/80">Member My Page</p>
            <h1 className="mt-2 text-3xl font-bold">{profile.name || '일반회원 마이페이지'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-sky-50/90">
              강사 매칭 문의를 위해 등록한 기본 회원정보를 여기서 직접 수정합니다.
            </p>
          </div>
          <div className="grid min-w-[220px] gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-sky-100/85">회원 유형</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{profile.memberType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sky-100/85">상태</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{profile.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sky-100/85">로그인 이메일</span>
              <span className="truncate pl-4 text-xs">{profile.email}</span>
            </div>
          </div>
        </div>
      </section>

      <form className="space-y-6" onSubmit={onSubmit}>
        <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-gray-900">회원 기본 정보</h2>
            <p className="mt-1 text-sm text-gray-500">센터 문의와 강사 매칭에 사용하는 기본 연락 정보를 수정합니다.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
              <input {...register('name')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
              <input {...register('phone')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">소속명</label>
              <input {...register('org')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
              <input value={profile.email} readOnly className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">가입일</label>
              <input value={profile.joinedAt || '-'} readOnly className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            </div>
          </div>
        </section>

        {profileWarning && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {profileWarning} 저장 기능은 설정이 완료되면 다시 사용할 수 있습니다.
          </div>
        )}

        {(submitError || submitMessage) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              submitError ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {submitError || submitMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-500">저장 후 이용자DB와 Firestore 미러에 동시에 반영됩니다.</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              홈으로 이동
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty || !saveAvailable}
              className="rounded-full bg-sky-800 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-50"
            >
              {isSubmitting ? '저장 중...' : '일반회원 정보 저장'}
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-gray-900">내 문의 내역</h2>
          <p className="mt-1 text-sm text-gray-500">센터를 통해 접수한 강사 문의 현황을 확인합니다.</p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">문의하기 중</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.pending}</p>
            <p className="mt-1 text-xs text-slate-500">수락 대기 또는 진행 전 문의</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">채팅 진행</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.active}</p>
            <p className="mt-1 text-xs text-slate-500">강사와 대화를 이어가는 문의</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">문의 완료</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.archived}</p>
            <p className="mt-1 text-xs text-slate-500">답변 완료 후 보관된 문의</p>
          </div>
        </div>

        {memberAlerts.length > 0 ? (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">알림</p>
                <p className="text-xs text-emerald-700">새로운 내용이나 확인이 필요한 문의를 먼저 보여드립니다.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                {memberAlerts.length}건
              </span>
            </div>
            <div className="space-y-2">
              {memberAlerts.map((alert) => (
                <div key={alert} className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-700">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: '전체', count: inquiryStats.total },
            { key: 'PENDING', label: '문의하기 중', count: inquiryStats.pending },
            { key: 'ACTIVE', label: '채팅', count: inquiryStats.active },
            { key: 'ARCHIVED', label: '완료', count: inquiryStats.archived },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setInquiryView(tab.key as 'ALL' | 'PENDING' | 'ACTIVE' | 'ARCHIVED')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                inquiryView === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:text-sky-700'
              }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <label className="sr-only" htmlFor="member-inquiry-search">
            문의 검색
          </label>
          <input
            id="member-inquiry-search"
            type="search"
            value={inquirySearch}
            onChange={(event) => setInquirySearch(event.target.value)}
            placeholder="강사명, 연락처, 문의 목적, 문의 내용 검색"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        {inquiriesLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">문의 내역을 불러오는 중입니다.</div>
        ) : inquiriesError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{inquiriesError}</div>
        ) : !chatEnabled ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            문의 내역은 확인할 수 있지만, 채팅 기능은 아직 설정되지 않았습니다. 현재는 센터를 통한 문의 접수와 확인 흐름만 우선 사용 가능합니다.
          </div>
        ) : filteredVisibleInquiries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">아직 접수된 문의가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {paginatedInquiries.map((item) => (
              <div key={item.inquiryId} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.teacherName}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      접수일시 {item.receivedAt || '-'} / 문의 목적 {item.purpose || '-'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                      {item.status}
                    </span>
                    <ChatStatusBadge status={item.chatRoomStatus} />
                  </div>
                </div>
                <div className="mt-3 whitespace-pre-line rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {item.message || '상세 내용 없음'}
                </div>
                {item.chatRoomId && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => router.push(`/chat/${item.chatRoomId}`)}
                      className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                    >
                      {item.chatRoomStatus === 'ACTIVE' ? '채팅 열기' : '문의 현황 보기'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {inquiryPageCount > 1 ? (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {Array.from({ length: inquiryPageCount }, (_, index) => {
                  const pageNumber = index + 1;
                  const active = inquiryPage === pageNumber;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setInquiryPage(pageNumber)}
                      className={`h-9 min-w-9 rounded-full border px-3 text-sm font-semibold transition ${
                        active
                          ? 'border-sky-800 bg-sky-800 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:text-sky-700'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
