'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Home } from 'lucide-react';
import { INSTRUCTOR_FIELD_OPTIONS, profileUpdateSchema, type ProfileUpdatePayload } from '@/lib/domain';
import { getAppPath } from '@/lib/app-url';
import {
  compressImageForProfile,
  deleteProfilePhoto,
  getImageFileFromClipboard,
  resolveProfilePhotoPublicUrl,
  uploadProfilePhoto,
} from '@/lib/profile-photo-client';

type InstructorProfileData = {
  name: string;
  email: string;
  phone: string;
  org: string;
  field: string;
  area: string;
  intro: string;
  career: string;
  address: string;
  instagram: string;
  instagramOpen: '공개' | '미공개';
  portfolioLink: string;
  profilePhoto: string;
  status: string;
  finalStatus: string;
  updatedAt: string;
};

type InquiryItemType = {
  inquiryId: string;
  receivedAt?: string;
  submittedAt?: string;
  memberName?: string;
  memberPhone?: string;
  memberEmail?: string;
  teacherName?: string;
  teacherField?: string;
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

function normalizeProfile(raw: Record<string, unknown>): InstructorProfileData {
  return {
    name: firstString(raw, ['성명', 'Name', 'name']),
    email: firstString(raw, ['로그인용 이메일', '이메일', 'Email', 'email']),
    phone: firstString(raw, ['연락처', 'Phone', 'phone']),
    org: firstString(raw, ['소속', 'Org', 'org']),
    field: firstString(raw, ['강의분야', 'Field', 'field']),
    area: firstString(raw, ['Activity_Area', '활동지역', 'area']),
    intro: firstString(raw, ['상세내용', 'Intro', 'intro']),
    career: firstString(raw, ['주요경력', 'career']),
    address: firstString(raw, ['주소', 'Address', 'address']),
    instagram: firstString(raw, ['인스타그램주소', 'Instagram', 'instagram']),
    instagramOpen: (firstString(raw, ['인스타그램공개여부', 'instagramOpen']) || '미공개') as '공개' | '미공개',
    portfolioLink: firstString(raw, ['Portfolio_Link', 'portfolioLink']),
    profilePhoto: firstString(raw, ['프로필사진', 'Profile_Photo', 'profile_photo']),
    status: firstString(raw, ['상태', 'status']) || '대기',
    finalStatus: firstString(raw, ['승인상태(최종)', 'finalStatus']) || '대기',
    updatedAt: firstString(raw, ['Updated_At', 'updatedAt']),
  };
}

const emptyProfile: InstructorProfileData = {
  name: '',
  email: '',
  phone: '',
  org: '',
  field: '',
  area: '',
  intro: '',
  career: '',
  address: '',
  instagram: '',
  instagramOpen: '미공개',
  portfolioLink: '',
  profilePhoto: '',
  status: '대기',
  finalStatus: '대기',
  updatedAt: '',
};

const INQUIRY_PAGE_SIZE = 4;

function ChatStatusBadge({ status }: { status?: InquiryItemType['chatRoomStatus'] }) {
  if (!status) return null;

  const tone =
    status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'PENDING'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-500';

  const label = status === 'ACTIVE' ? '채팅 가능' : status === 'PENDING' ? '수락 필요' : '종료';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export default function InstructorProfileForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [profile, setProfile] = useState<InstructorProfileData>(emptyProfile);
  const [profileWarning, setProfileWarning] = useState('');
  const [saveAvailable, setSaveAvailable] = useState(true);
  const [receivedInquiries, setReceivedInquiries] = useState<InquiryItemType[]>([]);
  const [sentInquiries, setSentInquiries] = useState<InquiryItemType[]>([]);
  const [inquiryType, setInquiryType] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
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
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileUpdatePayload>({
    resolver: zodResolver(profileUpdateSchema) as any,
    defaultValues: emptyProfile,
  });

  const profilePhoto = watch('profilePhoto') || '';
  const previewPhoto = useMemo(
    () => localPreviewUrl || resolveProfilePhotoPublicUrl(profilePhoto || ''),
    [localPreviewUrl, profilePhoto],
  );

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch(getAppPath('/api/account/profile'), { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || '강사 프로필을 불러오지 못했습니다.');
        }

        setProfileWarning(result.degraded ? result.message || '' : '');
        setSaveAvailable(result.saveAvailable !== false);
        const normalized = normalizeProfile(result.data);
        setProfile(normalized);
        reset(normalized);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '강사 프로필을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    async function loadInquiries() {
      setInquiriesLoading(true);
      setInquiriesError('');
      try {
        const [receivedRes, sentRes] = await Promise.all([
          fetch(getAppPath('/api/instructor/inquiries'), { cache: 'no-store' }),
          fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' }),
        ]);
        const receivedResult = await receivedRes.json();
        const sentResult = await sentRes.json();

        setChatEnabled(receivedResult.chatEnabled !== false);
        setReceivedInquiries(Array.isArray(receivedResult.data) ? receivedResult.data : []);
        setSentInquiries(Array.isArray(sentResult.data) ? sentResult.data : []);
      } catch (error) {
        setInquiriesError(error instanceof Error ? error.message : '문의 내역을 불러오지 못했습니다.');
      } finally {
        setInquiriesLoading(false);
      }
    }

    void loadProfile();
    void loadInquiries();
  }, [reset]);

  const handleProfilePhotoFile = async (file: File | null) => {
    if (!file) return;

    setSubmitError('');
    setUploadingPhoto(true);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드할 수 있습니다.');
      }

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl(URL.createObjectURL(file));

      const compressed = await compressImageForProfile(file);
      const oldPhoto = watch('profilePhoto');
      const uploadedUrl = await uploadProfilePhoto(compressed, watch('name') || profile.name, profile.email);
      // Delete old photo from Firebase after successful upload (non-blocking)
      if (oldPhoto) {
        deleteProfilePhoto(oldPhoto).catch(() => { });
      }
      setLocalPreviewUrl('');
      setValue('profilePhoto', uploadedUrl, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl('');
      }
      const message = error instanceof Error ? error.message : '프로필 사진 업로드에 실패했습니다.';
      setSubmitError(message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePastePhoto = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedFile = getImageFileFromClipboard(event);
    if (!pastedFile) return;
    event.preventDefault();
    await handleProfilePhotoFile(pastedFile);
  };

  const handleRemovePhoto = async () => {
    if (!profilePhoto) return;
    try {
      await deleteProfilePhoto(profilePhoto);
    } catch (error) {
      console.warn(error);
    } finally {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl('');
      }
      setValue('profilePhoto', '', { shouldDirty: true, shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    setSubmitMessage('');

    try {
      const response = await fetch(getAppPath('/api/account/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || '프로필 수정에 실패했습니다.');
      }

      setSubmitMessage('강사 프로필이 저장되었습니다.');
      const nextProfile = {
        ...profile,
        ...values,
        profilePhoto: values.profilePhoto || '',
        instagramOpen: (values.instagramOpen || '미공개') as '공개' | '미공개',
      };
      setProfile(nextProfile);
      reset(nextProfile);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '프로필 수정에 실패했습니다.');
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
    if (!confirm('이 문의를 삭제하시겠습니까? (삭제된 문의함으로 이동합니다)')) return;

    try {
      const response = await fetch(getAppPath(`/api/chat/inquiries/${inquiryId}/delete`), {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '삭제에 실패했습니다.');

      const [receivedRes, sentRes] = await Promise.all([
        fetch(getAppPath('/api/instructor/inquiries'), { cache: 'no-store' }),
        fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' }),
      ]);
      const receivedResult = await receivedRes.json();
      const sentResult = await sentRes.json();

      setReceivedInquiries(Array.isArray(receivedResult.data) ? receivedResult.data : []);
      setSentInquiries(Array.isArray(sentResult.data) ? sentResult.data : []);
      setSelectedInquiryIds((prev) => {
        const next = new Set(prev);
        next.delete(inquiryId);
        return next;
      });
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

      const [receivedRes, sentRes] = await Promise.all([
        fetch(getAppPath('/api/instructor/inquiries'), { cache: 'no-store' }),
        fetch(getAppPath('/api/account/inquiries'), { cache: 'no-store' }),
      ]);
      const receivedResult = await receivedRes.json();
      const sentResult = await sentRes.json();

      setReceivedInquiries(Array.isArray(receivedResult.data) ? receivedResult.data : []);
      setSentInquiries(Array.isArray(sentResult.data) ? sentResult.data : []);
      setSelectedInquiryIds(new Set());
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

  const activeInquiries = inquiryType === 'RECEIVED' ? receivedInquiries : sentInquiries;

  const inquiryStats = useMemo(
    () => ({
      total: activeInquiries.filter((item) => item.chatRoomStatus !== 'DELETED').length,
      pending: activeInquiries.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus).length,
      active: activeInquiries.filter((item) => item.chatRoomStatus === 'ACTIVE').length,
      archived: activeInquiries.filter((item) => item.chatRoomStatus === 'ARCHIVED').length,
      deleted: activeInquiries.filter((item) => item.chatRoomStatus === 'DELETED').length,
    }),
    [activeInquiries],
  );

  const visibleInquiries = useMemo(() => {
    if (inquiryView === 'ALL') return activeInquiries.filter((item) => item.chatRoomStatus !== 'DELETED');
    if (inquiryView === 'PENDING') {
      return activeInquiries.filter((item) => item.chatRoomStatus === 'PENDING' || !item.chatRoomStatus);
    }
    return activeInquiries.filter((item) => item.chatRoomStatus === inquiryView);
  }, [activeInquiries, inquiryView]);

  const filteredVisibleInquiries = useMemo(() => {
    const keyword = inquirySearch.trim().toLowerCase();
    if (!keyword) return visibleInquiries;

    return visibleInquiries.filter((item) =>
      [item.memberName, item.memberPhone, item.memberEmail, item.teacherName, item.teacherField, item.purpose, item.message]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [inquirySearch, visibleInquiries]);

  useEffect(() => {
    setInquiryPage(1);
    setSelectedInquiryIds(new Set());
  }, [inquirySearch, inquiryView, inquiryType]);

  const inquiryPageCount = Math.max(1, Math.ceil(filteredVisibleInquiries.length / INQUIRY_PAGE_SIZE));

  const paginatedInquiries = useMemo(() => {
    const start = (inquiryPage - 1) * INQUIRY_PAGE_SIZE;
    return filteredVisibleInquiries.slice(start, start + INQUIRY_PAGE_SIZE);
  }, [filteredVisibleInquiries, inquiryPage]);

  const instructorAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (inquiryStats.pending > 0) {
      alerts.push(`지금 수락이 필요한 받은 문의 ${inquiryStats.pending}건`);
    }
    if (inquiryStats.active > 0) {
      alerts.push(`응답을 이어갈 수 있는 채팅 ${inquiryStats.active}건`);
    }
    return alerts;
  }, [inquiryStats.active, inquiryStats.pending]);

  if (loading) {
    return <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-sm text-gray-500">강사 프로필을 불러오는 중입니다.</div>;
  }

  if (loadError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#0f4d3a_0%,#1b7a5d_100%)] px-6 py-7 text-white shadow-[0_25px_80px_rgba(9,56,38,0.18)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Instructor My Page</p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white transition hover:bg-white/20"
              >
                <Home className="h-3 w-3" />
                홈으로
              </button>
            </div>
            <h1 className="mt-2 text-3xl font-bold">지역과 강사님을 연결하는 양양 이음터</h1>
            <div className="mt-4 max-w-2xl text-sm text-emerald-50/90 space-y-1">
              <p>• 빠른 연결: 수업 문의부터 업무 협의, 타 강사와의 협업까지 한 곳에서</p>
              <p>• 쉬운 소통: 필요한 순간, 실시간 채팅으로 끊김 없는 대화 진행</p>
              <p>• 자연스러운 홍보: 인스타그램 계정 연동으로 손쉬운 프로필 알림</p>
            </div>
          </div>
          <div className="grid min-w-[220px] gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-emerald-100/85">현재 상태</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{profile.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-100/85">최종 승인</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{profile.finalStatus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-100/85">로그인 이메일</span>
              <span className="truncate pl-4 text-xs">{profile.email}</span>
            </div>
          </div>
        </div>
      </section>

      <form className="space-y-6" onSubmit={onSubmit}>
        <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">강사 카드 기본 정보</h2>
              <p className="mt-1 text-sm text-gray-500">센터와 수요처가 보는 기본 노출 정보입니다.</p>
            </div>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">소속</label>
              <input {...register('org')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">강의 분야 (카테고리)</label>
              <select
                {...register('field')}
                title="강의 분야 카테고리를 선택해 주세요"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
              >
                <option value="">강의 분야를 선택해 주세요</option>
                {INSTRUCTOR_FIELD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">강사 카드와 스프레드시트에는 같은 강의 분야 카테고리가 반영됩니다.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">활동 지역</label>
              <input {...register('area')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
              <input {...register('address')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">주요 경력</label>
              <textarea rows={4} {...register('career')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">소개</label>
              <textarea rows={5} {...register('intro')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
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
                  {errors.password && <p className="mt-1 text-xs text-red-600">{(errors.password as any).message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
                  <input
                    type="password"
                    {...register('confirmPassword')}
                    placeholder="비밀번호 재입력"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm bg-white"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{(errors.confirmPassword as any).message}</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <h2 className="text-xl font-semibold text-gray-900">소셜 및 포트폴리오</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">인스타그램</label>
              <input {...register('instagram')} placeholder="아이디만 입력 (예: yangyang_life)" className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">인스타그램 공개 여부</label>
              <select {...register('instagramOpen')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm">
                <option value="미공개">미공개</option>
                <option value="공개">공개</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">포트폴리오 링크</label>
              <input {...register('portfolioLink')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <h2 className="text-xl font-semibold text-gray-900">프로필 사진</h2>
          <div onPaste={handlePastePhoto} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-emerald-100 bg-gray-100">
                {previewPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewPhoto}
                    alt="프로필 사진 미리보기"
                    className="h-full w-full object-cover"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">👤</div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-emerald-700">업로드 중...</div>
                )}
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <p className="text-sm text-gray-500">JPG, PNG, WEBP · 최대 5MB · 자동 압축</p>
              <p className="text-xs text-gray-400">파일 선택 또는 클립보드 이미지 붙여넣기</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {uploadingPhoto ? '업로드 중...' : '사진 선택'}
                </button>
                {previewPhoto && (
                  <button
                    type="button"
                    onClick={() => void handleRemovePhoto()}
                    className="rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
                  >
                    사진 삭제
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleProfilePhotoFile(event.target.files?.[0] || null);
                }}
              />
              <input type="hidden" {...register('profilePhoto')} />
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
          {profile.updatedAt ? <div className="text-sm text-gray-500">{`마지막 시트 반영 시각: ${profile.updatedAt}`}</div> : <div />}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              강사 탈퇴
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
              disabled={isSubmitting || uploadingPhoto || !isDirty || !saveAvailable}
              className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              {isSubmitting ? '저장 중...' : uploadingPhoto ? '사진 업로드 중...' : '강사 프로필 저장'}
            </button>
          </div>
        </div>
      </form>

      {/* 회원 탈퇴 확인 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 rounded-[24px] border border-white/20 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">강사 탈퇴 확인</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              정말로 강사 활동을 중단하고 탈퇴하시겠습니까? 탈퇴 시 등록된 강사 프로필 정보와 이용 기록이 모두 삭제되며, 이 작업은 되돌릴 수 없습니다.
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

      <section id="inquiries" className="scroll-mt-24 rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
        <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">문의 관리</h2>
            <p className="mt-1 text-sm text-gray-500">
              내게 들어온 문의를 수락하거나, 다른 강사에게 보낸 문의 현황을 확인하세요.
            </p>
          </div>
          <div className="flex shrink-0 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setInquiryType('RECEIVED');
                setInquiryView('ALL');
              }}
              className={`rounded-lg px-6 py-2 text-sm font-semibold transition ${inquiryType === 'RECEIVED' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              받은 문의
            </button>
            <button
              type="button"
              onClick={() => {
                setInquiryType('SENT');
                setInquiryView('ALL');
              }}
              className={`rounded-lg px-6 py-2 text-sm font-semibold transition ${inquiryType === 'SENT' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              보낸 문의
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              {inquiryType === 'RECEIVED' ? '받은 문의' : '보낸 문의'}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.pending}</p>
            <p className="mt-1 text-xs text-slate-500">
              {inquiryType === 'RECEIVED' ? '지금 수락을 기다리는 문의' : '상대방의 수락을 기다리는 문의'}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">채팅 진행</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.active}</p>
            <p className="mt-1 text-xs text-slate-500">응답 중이거나 바로 열 수 있는 대화</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">문의 완료</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.archived}</p>
            <p className="mt-1 text-xs text-slate-500">읽기 전용으로 보관된 문의</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">삭제</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{inquiryStats.deleted}</p>
            <p className="mt-1 text-xs text-slate-500">삭제된 문의함</p>
          </div>
        </div>

        {instructorAlerts.length > 0 && inquiryType === 'RECEIVED' ? (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">새 알림</p>
                <p className="text-xs text-emerald-700">문의 수락과 채팅 응답이 필요한 건을 먼저 확인해 주세요.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                {instructorAlerts.length}건
              </span>
            </div>
            <div className="space-y-2">
              {instructorAlerts.map((alert) => (
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
            { key: 'PENDING', label: inquiryType === 'RECEIVED' ? '받은 문의' : '보낸 문의', count: inquiryStats.pending },
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
                : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-700'
                }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            id="instructor-inquiry-search"
            type="search"
            value={inquirySearch}
            onChange={(event) => setInquirySearch(event.target.value)}
            placeholder="회원명, 연락처, 강사명, 문의 목적, 문의 내용 검색"
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
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
            문의 목록은 확인할 수 있지만, 채팅 기능은 아직 설정되지 않았습니다. Firebase 설정 후 문의 수락과 채팅 흐름이 활성화됩니다.
          </div>
        ) : filteredVisibleInquiries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            {inquiryType === 'RECEIVED' ? '아직 접수된 문의가 없습니다.' : '보낸 문의가 없습니다.'}
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedInquiries.map((item) => (
              <div key={item.inquiryId} className={`rounded-2xl border p-4 transition ${selectedInquiryIds.has(item.inquiryId) ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200'}`}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      title="문의 선택"
                      checked={selectedInquiryIds.has(item.inquiryId)}
                      onChange={() => toggleSelectOne(item.inquiryId)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {inquiryType === 'RECEIVED' ? item.memberName : item.teacherName}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        접수일시 {item.receivedAt || item.submittedAt || '-'} / 문의 목적 {item.purpose || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
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
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {item.chatRoomStatus === 'ACTIVE'
                        ? '채팅방 열기'
                        : item.chatRoomStatus === 'PENDING'
                          ? '수락 및 닫기'
                          : '채팅 내역 보기'}
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
                        ? 'border-emerald-800 bg-emerald-800 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-700'
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
