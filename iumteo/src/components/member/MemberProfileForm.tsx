'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { profileUpdateSchema, type ProfileUpdatePayload } from '@/lib/domain';

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
  inquirerName: string;
  inquirerPhone: string;
  inquirerEmail: string;
  purpose: string;
  message: string;
  status: string;
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

export default function MemberProfileForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [profile, setProfile] = useState<MemberProfileData>(emptyProfile);
  const [inquiries, setInquiries] = useState<MemberInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [inquiriesError, setInquiriesError] = useState('');

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
        const response = await fetch('/api/account/profile', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || '회원 정보를 불러오지 못했습니다.');
        }

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
        const response = await fetch('/api/account/inquiries', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || '문의 내역을 불러오지 못했습니다.');
        }

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
      const response = await fetch('/api/account/profile', {
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
              disabled={isSubmitting || !isDirty}
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

        {inquiriesLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">문의 내역을 불러오는 중입니다.</div>
        ) : inquiriesError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{inquiriesError}</div>
        ) : inquiries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">아직 접수된 문의가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {inquiries.map((item) => (
              <div key={item.inquiryId} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.teacherName}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      접수일시 {item.receivedAt || '-'} / 문의 목적 {item.purpose || '-'}
                    </div>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-line">
                  {item.message || '상세 내용 없음'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
