'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Home } from 'lucide-react';
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
  chatRoomStatus?: 'PENDING' | 'ACTIVE' | 'ARCHIVED' | 'DELETED';
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
  const [inquiryView, setInquiryView] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'ARCHIVED' | 'DELETED'>('ALL');
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryPage, setInquiryPage] = useState(1);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<Set<string>>(new Set());

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
    async function loadInitialData() {
      setLoading(true);
      setInquiriesLoading(true);
      setLoadError('');
      setInquiriesError('');

      const [profileResult, inquiriesResult] = await Promise.allSettled([
        fetch(getAppPath('/api/account/profile'), { cache: 'no-store' }).then((r) => r.json()),
        fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' }).then((r) => r.json()),
      ]);

      if (profileResult.status === 'fulfilled') {
        const result = profileResult.value;
        if (!result.success || !result.data) {
          setLoadError(result.message || '회원 정보를 불러오지 못했습니다.');
        } else {
          setProfileWarning(result.degraded ? result.message || '' : '');
          setSaveAvailable(result.saveAvailable !== false);
          const normalized = normalizeProfile(result.data);
          setProfile(normalized);
          reset(normalized);
        }
      } else {
        setLoadError('회원 정보를 불러오지 못했습니다.');
      }
      setLoading(false);

      if (inquiriesResult.status === 'fulfilled') {
        const result = inquiriesResult.value;
        if (!result.success) {
          setInquiriesError(result.message || '문의 내역을 불러오지 못했습니다.');
        } else {
          setChatEnabled(result.chatEnabled !== false);
          setInquiries(Array.isArray(result.data) ? result.data : []);
        }
      } else {
        setInquiriesError('문의 내역을 불러오지 못했습니다.');
      }
      setInquiriesLoading(false);
    }

    void loadInitialData();
  }, [reset]);

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
          password: values.password || undefined,
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

  const handleWithdraw = async () => {
    setWithdrawError('');
    setIsWithdrawing(true);

    try {
      const response = await fetch(getAppPath('/api/account/withdraw'), {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '회원 탈퇴 요청 중 오류가 발생했습니다.');
      }

      // 탈퇴 성공 시 로그아웃 후 홈으로 이동
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : '회원 탈퇴 처리에 실패했습니다.');
      setIsWithdrawing(false);
    }
  };

  const handleDeleteInquiry = async (inquiryId: string) => {
    if (!confirm('이 문의를 삭제하시겠습니까? (프론트엔드 목록에서 사라집니다)')) return;

    try {
      const response = await fetch(getAppPath(`/api/chat/inquiries/${inquiryId}/delete`), {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '삭제에 실패했습니다.');

      // Reload inquiries
      const inquiriesResult = await fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' }).then((r) => r.json());
      if (inquiriesResult.success) {
        setInquiries(Array.isArray(inquiriesResult.data) ? inquiriesResult.data : []);
        setSelectedInquiryIds((prev) => {
          const next = new Set(prev);
          next.delete(inquiryId);
          return next;
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedInquiryIds.size === 0) return;
    if (!confirm(`${selectedInquiryIds.size}개의 문의를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(getAppPath('/api/chat/inquiries/bulk-delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryIds: Array.from(selectedInquiryIds) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '삭제에 실패했습니다.');

      // Reload inquiries
      const inquiriesResult = await fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' }).then((r) => r.json());
      if (inquiriesResult.success) {
        setInquiries(Array.isArray(inquiriesResult.data) ? inquiriesResult.data : []);
        setSelectedInquiryIds(new Set());
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleSelectAll = () => {
    if (selectedInquiryIds.size === paginatedInquiries.length && paginatedInquiries.length > 0) {
      setSelectedInquiryIds(new Set());
    } else {
      setSelectedInquiryIds(new Set(paginatedInquiries.map((i) => i.inquiryId)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedInquiryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inquiryStats = useMemo(
    () => ({
      total: inquiries.filter((item) => item.chatRoomStatus !== 'DELETED').length,
      pending: inquiries.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus).length,
      active: inquiries.filter((item) => item.chatRoomStatus === 'ACTIVE').length,
      archived: inquiries.filter((item) => item.chatRoomStatus === 'ARCHIVED').length,
      deleted: inquiries.filter((item) => item.chatRoomStatus === 'DELETED').length,
    }),
    [inquiries],
  );

  // 뷰필터 → 검색 → 페이지네이션을 단일 useMemo로 통합
  const { filteredVisibleInquiries, paginatedInquiries, inquiryPageCount } = useMemo(() => {
    let filtered = inquiries;

    if (inquiryView !== 'ALL') {
      if (inquiryView === 'PENDING') {
        filtered = filtered.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus);
      } else {
        filtered = filtered.filter((item) => item.chatRoomStatus === inquiryView);
      }
    } else {
      filtered = filtered.filter((item) => item.chatRoomStatus !== 'DELETED');
    }

    const keyword = inquirySearch.trim().toLowerCase();
    if (keyword) {
      filtered = filtered.filter((item) =>
        [item.teacherName, item.inquirerPhone, item.purpose, item.message]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword)),
      );
    }

    const pageCount = Math.max(1, Math.ceil(filtered.length / INQUIRY_PAGE_SIZE));
    const start = (inquiryPage - 1) * INQUIRY_PAGE_SIZE;
    const paginated = filtered.slice(start, start + INQUIRY_PAGE_SIZE);

    return { filteredVisibleInquiries: filtered, paginatedInquiries: paginated, inquiryPageCount: pageCount };
  }, [inquiries, inquiryView, inquirySearch, inquiryPage]);

  useEffect(() => {
    setInquiryPage(1);
  }, [inquirySearch, inquiryView]);

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
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100/80">Member My Page</p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-bold text-sky-100 transition hover:bg-sky-400/20"
              >
                <Home className="h-3 w-3" />
                홈으로
              </button>
            </div>
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
            <div className="md:col-span-2 rounded-2xl bg-amber-50/50 p-5 mt-4 border border-amber-100">
              <h3 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2">
                <span>🔒</span> 보안을 위해 주기적인 비밀번호 변경을 권장합니다
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호</label>
                  <input
                    type="password"
                    {...register('password')}
                    placeholder="변경 시에만 입력"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm bg-white"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">* 8자 이상, 특수문자 2개 이상 필수</p>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
                  <input
                    type="password"
                    {...register('confirmPassword')}
                    placeholder="비밀번호 재입력"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm bg-white"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
                </div>
              </div>
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
            className={`rounded-2xl px-4 py-3 text-sm ${submitError ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
          >
            {submitError || submitMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-500"></div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              회원 탈퇴
            </button>
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

      {/* 회원 탈퇴 확인 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 rounded-[24px] border border-white/20 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">회원 탈퇴 확인</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              정말로 이음터 서비스를 탈퇴하시겠습니까? 탈퇴 시 기존의 프로필 정보와 이용 기록이 모두 삭제되며, 이 작업은 되돌릴 수 없습니다.
            </p>
            {withdrawError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-100">
                {withdrawError}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                disabled={isWithdrawing}
                className="flex-1 rounded-full border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleWithdraw()}
                disabled={isWithdrawing}
                className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isWithdrawing ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-gray-900">내 문의 내역</h2>
          <p className="mt-1 text-sm text-gray-500">센터를 통해 접수한 강사 문의 현황을 확인합니다.</p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-4">
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
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">삭제</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.deleted}</p>
            <p className="mt-1 text-xs text-slate-500">삭제된 문의함</p>
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
            { key: 'DELETED', label: '삭제', count: inquiryStats.deleted },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setInquiryView(tab.key as 'ALL' | 'PENDING' | 'ACTIVE' | 'ARCHIVED' | 'DELETED')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${inquiryView === tab.key
                ? 'bg-slate-900 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:text-sky-700'
                }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            id="member-inquiry-search"
            type="search"
            value={inquirySearch}
            onChange={(event) => setInquirySearch(event.target.value)}
            placeholder="강사명, 연락처, 문의 목적, 문의 내용 검색"
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
          <div className="flex items-center gap-3">
            {selectedInquiryIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="rounded-full bg-red-50 px-4 py-2 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-100 transition"
              >
                선택 삭제 ({selectedInquiryIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={toggleSelectAll}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              {selectedInquiryIds.size === paginatedInquiries.length && paginatedInquiries.length > 0 ? '선택 해제' : '전체 선택'}
            </button>
          </div>
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
              <div key={item.inquiryId} className={`rounded-2xl border p-4 transition ${selectedInquiryIds.has(item.inquiryId) ? 'border-sky-300 bg-sky-50/30' : 'border-gray-200'}`}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      title="문의 선택"
                      checked={selectedInquiryIds.has(item.inquiryId)}
                      onChange={() => toggleSelectOne(item.inquiryId)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{item.teacherName}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        접수일시 {item.receivedAt || '-'} / 문의 목적 {item.purpose || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                      {item.status === '삭제완료' ? '문의 완료' : item.status}
                    </span>
                    <ChatStatusBadge status={item.chatRoomStatus} />
                  </div>
                </div>
                <div className="mt-3 whitespace-pre-line rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {item.message || '상세 내용 없음'}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {item.chatRoomStatus !== 'DELETED' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteInquiry(item.inquiryId)}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      문의 삭제
                    </button>
                  )}
                  {item.chatRoomId && item.chatRoomStatus !== 'DELETED' && (
                    <button
                      type="button"
                      onClick={() => router.push(`/chat/${item.chatRoomId}`)}
                      className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                    >
                      {item.chatRoomStatus === 'ACTIVE' ? '채팅 열기' : '문의 현황 보기'}
                    </button>
                  )}
                </div>
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
                      className={`h-9 min-w-9 rounded-full border px-3 text-sm font-semibold transition ${active
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
