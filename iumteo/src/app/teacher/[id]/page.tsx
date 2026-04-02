'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inquiryCreateSchema } from '@/lib/domain';
import { getAppPath } from '@/lib/app-url';
import { resolveProfilePhotoPublicUrl } from '@/lib/profile-photo-client';

type TeacherData = {
  name: string;
  org: string;
  role: string;
  field: string;
  area: string;
  address: string;
  target: string;
  history: string;
  desc: string;
  insta: string;
  instaPublic: string;
  email: string;
  phone: string;
  photo: string;
};

type InquiryQuota = {
  monthlyLimit: number;
  usedCount: number;
  remainingCount: number;
  canSend: boolean;
};

type InquiryFormValues = {
  teacherName: string;
  teacherEmail?: string;
  inquirerName: string;
  requesterEmail: string;
  contactMethod: 'PHONE' | 'EMAIL' | 'NONE';
  contactValue?: string;
  purpose: string;
  message?: string;
};

const emptyTeacher: TeacherData = {
  name: '',
  org: '',
  role: '',
  field: '',
  area: '',
  address: '',
  target: '',
  history: '',
  desc: '',
  insta: '',
  instaPublic: '',
  email: '',
  phone: '',
  photo: '',
};

const emptyQuota: InquiryQuota = {
  monthlyLimit: 20,
  usedCount: 0,
  remainingCount: 20,
  canSend: true,
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return (value || '').trim().replace(/\s+/g, '');
}

function getField(headers: string[], row: string[], aliases: string[]) {
  const index = headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
  return index >= 0 ? (row[index] || '').trim() : '';
}

function normalizeTeacherData(headers: string[], row: string[], teacherName: string): TeacherData {
  return {
    name: getField(headers, row, ['성명', '강사명']) || teacherName,
    org: getField(headers, row, ['소속', '기관', '직장']),
    role: getField(headers, row, ['직위', '직함', '역할']),
    field: getField(headers, row, ['분야', '영역']),
    area: getField(headers, row, ['활동지역', '활동 지역']),
    address: getField(headers, row, ['주소', '거주지']),
    target: getField(headers, row, ['대상']),
    history: getField(headers, row, ['주요이력', '경력', '활동이력', '자격']),
    desc: getField(headers, row, ['강의주제', '내용', '소개', '프로그램']),
    insta: getField(headers, row, ['인스타그램', 'SNS']),
    instaPublic: getField(headers, row, ['공개', '인스타공개여부']),
    email: getField(headers, row, ['이메일', '로그인용이메일', 'Email', 'email']),
    phone: getField(headers, row, ['연락처', '전화번호', '핸드폰번호', '휴대폰']),
    photo: '',
  };
}

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const teacherId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const teacherName = decodeURIComponent(teacherId);

  const [teacher, setTeacher] = useState<TeacherData>(emptyTeacher);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [quota, setQuota] = useState<InquiryQuota>(emptyQuota);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryCreateSchema),
    defaultValues: {
      teacherName,
      teacherEmail: '',
      inquirerName: '',
      requesterEmail: '',
      contactMethod: 'PHONE',
      contactValue: '',
      purpose: '',
      message: '',
    },
  });

  const messageValue = watch('message') || '';
  const contactMethod = watch('contactMethod');
  const sessionRole = session?.user?.role || '';
  const canInquire = sessionRole === 'USER' || sessionRole === 'ADMIN' || sessionRole === 'INSTRUCTOR';
  const isOwner =
    !!session?.user?.email &&
    !!teacher.email &&
    session.user.email.toLowerCase() === teacher.email.toLowerCase();

  const fieldTags = useMemo(
    () => teacher.field.split(/[,/]+/).map((item) => item.trim()).filter(Boolean),
    [teacher.field],
  );

  const histories = useMemo(
    () => teacher.history.split('\n').map((item) => item.trim()).filter(Boolean),
    [teacher.history],
  );

  const instagramHandle = useMemo(() => {
    if (!teacher.insta) return '';
    return teacher.insta
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/\/?$/, '')
      .trim();
  }, [teacher.insta]);

  const instagramHref = useMemo(() => {
    if (!teacher.insta) return '';
    return /^https?:\/\//i.test(teacher.insta) ? teacher.insta : `https://www.instagram.com/${instagramHandle}/`;
  }, [instagramHandle, teacher.insta]);

  useEffect(() => {
    async function fetchTeacherData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${getAppPath('/api/instructor')}?name=${encodeURIComponent(teacherName)}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('강사 정보를 불러오지 못했습니다.');
        }

        const json = await response.json();
        const record = json?.data as (Partial<TeacherData> & { intro?: string; photo?: string }) | null;
        if (!json?.success || !record) {
          throw new Error('해당 강사 정보를 찾을 수 없습니다.');
        }

        const nextTeacher: TeacherData = {
          ...emptyTeacher,
          name: record.name || teacherName,
          org: record.org || '',
          role: record.role || '',
          field: record.field || '',
          area: record.area || '',
          address: record.address || '',
          target: record.target || '',
          history: record.history || '',
          desc: record.desc || record.intro || '',
          insta: record.insta || '',
          instaPublic: record.instaPublic || '',
          email: typeof record.email === 'string' && record.email.includes('@') ? record.email : '',
          phone: record.phone || '',
          photo: resolveProfilePhotoPublicUrl(record.photo || (record as Partial<TeacherData> & { profilePhoto?: string }).profilePhoto || ''),
        };

        setPhotoError(false);
        setTeacher(nextTeacher);
        setValue('teacherName', nextTeacher.name);
        setValue('teacherEmail', nextTeacher.email);
        setValue('requesterEmail', session?.user?.email || '');
      } catch (fetchError) {
        console.error(fetchError);
        setError(fetchError instanceof Error ? fetchError.message : '강사 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    if (teacherName) {
      void fetchTeacherData();
    }
  }, [session?.user?.email, setValue, teacherName]);

  useEffect(() => {
    async function prefillInquiryForm() {
      if (!session?.user || !canInquire) return;

      setValue('inquirerName', session.user.name || '');
      setValue('requesterEmail', session.user.email || '');

      try {
        const response = await fetch(getAppPath('/api/account/profile'), { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) return;

        setValue('inquirerName', result.data['이용자명'] || result.data.Name || session.user.name || '');
      } catch (prefillError) {
        console.warn(prefillError);
      }
    }

    void prefillInquiryForm();
  }, [canInquire, session, setValue]);

  useEffect(() => {
    async function fetchQuota() {
      if (!session?.user || !canInquire || !teacher.name) {
        setQuota(emptyQuota);
        return;
      }

      setQuotaLoading(true);
      try {
        const query = new URLSearchParams({
          teacherName: teacher.name,
          teacherEmail: teacher.email || '',
        });
        const response = await fetch(`${getAppPath('/api/inquiries')}?${query.toString()}`, { cache: 'no-store' });
        const result = await response.json();

        if (response.ok && result.success && result.quota) {
          setQuota(result.quota as InquiryQuota);
        }
      } catch (quotaError) {
        console.warn('[teacher page] quota fetch failed:', quotaError);
      } finally {
        setQuotaLoading(false);
      }
    }

    void fetchQuota();
  }, [canInquire, session, teacher.email, teacher.name]);

  const onSubmitInquiry = handleSubmit(async (data) => {
    setInquiryError(null);
    setInquiryMessage(null);

    if (!session?.user) {
      setInquiryError('로그인 후 문의를 남길 수 있습니다.');
      return;
    }

    if (!canInquire) {
      setInquiryError('문의는 일반 회원 계정에서만 보낼 수 있습니다.');
      return;
    }

    if (!quota.canSend) {
      setInquiryError('이번 달 문의 가능 횟수를 모두 사용했습니다.');
      return;
    }

    setInquirySubmitting(true);

    try {
      const response = await fetch(getAppPath('/api/inquiries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: teacher.name || teacherName,
          teacherEmail: teacher.email || '',
          inquirerName: data.inquirerName,
          requesterEmail: session.user.email,
          contactMethod: data.contactMethod,
          contactValue: data.contactValue,
          purpose: data.purpose,
          message: data.message,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || '문의 접수에 실패했습니다.');
      }

      setInquiryMessage(result.message || '문의가 접수되었습니다.');
      if (result.data?.quota) {
        setQuota(result.data.quota as InquiryQuota);
      }

      reset({
        teacherName: teacher.name || teacherName,
        teacherEmail: teacher.email || '',
        inquirerName: data.inquirerName,
        requesterEmail: session.user.email || '',
        contactMethod: data.contactMethod,
        contactValue: '',
        purpose: '',
        message: '',
      });
    } catch (submitError) {
      setInquiryError(submitError instanceof Error ? submitError.message : '문의 접수에 실패했습니다.');
    } finally {
      setInquirySubmitting(false);
    }
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbf8]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-700" />
          <p className="text-sm text-gray-500">강사 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbf8] px-4">
        <div className="w-full max-w-md rounded-[32px] bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-black text-gray-900">정보를 불러오지 못했습니다</h2>
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/instructors')}
            className="mt-6 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            강사 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5faf7]">
      <section className="bg-[radial-gradient(circle_at_top_left,#0f766e_0%,#065f46_48%,#022c22_100%)] py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center">
          <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-white/25 bg-emerald-900 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                !photoError && teacher.photo
                  ? teacher.photo
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=047857&color=ffffff&size=240`
              }
              alt={`${teacher.name} 강사 프로필`}
              className="h-full w-full object-cover"
              onError={() => setPhotoError(true)}
            />
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Yangyang Iumteo Instructor</p>
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="mt-3 text-4xl font-black">{teacher.name}</h1>
              {sessionRole === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => router.push('/admin')}
                  className="mt-3 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-lg"
                >
                  정보 수정(관리자)
                </button>
              )}
            </div>
            <p className="mt-2 text-lg text-emerald-100">{`${teacher.org} ${teacher.role}`.trim() || '양양 지역 강사'}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {teacher.target ? (
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm">
                  대상 {teacher.target}
                </span>
              ) : null}
              {teacher.area ? (
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm">
                  활동 지역 {teacher.area}
                </span>
              ) : null}
              {teacher.insta && /^(공개|동의|yes|y|true)$/i.test(teacher.instaPublic || '') ? (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${teacher.name} 강사의 인스타그램 열기`}
                  className="group relative inline-flex overflow-hidden rounded-full p-[1.5px] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_16px_36px_rgba(7,89,67,0.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_20px_44px_rgba(12,110,84,0.3)]"
                >
                  <span className="absolute inset-0 bg-[linear-gradient(120deg,#f4c95d_0%,#f68b4d_18%,#db5f82_46%,#8b5cf6_74%,#0f766e_100%)]" />
                  <span className="absolute -inset-2 rounded-full bg-[radial-gradient(circle_at_18%_18%,rgba(244,201,93,0.5),transparent_32%),radial-gradient(circle_at_70%_26%,rgba(219,95,130,0.45),transparent_38%),radial-gradient(circle_at_82%_78%,rgba(15,118,110,0.5),transparent_40%)] opacity-70 blur-lg transition duration-300 group-hover:opacity-100 group-hover:blur-xl" />
                  <span className="absolute right-3 top-2 text-[10px] font-black text-white/80 animate-[pulse_2.6s_ease-in-out_infinite]">
                    ✦
                  </span>
                  <span className="relative z-10 inline-flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,rgba(249,253,251,0.96),rgba(233,247,240,0.92))] px-3 py-2 text-sm text-slate-900 backdrop-blur">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4c95d_0%,#f68b4d_18%,#db5f82_46%,#8b5cf6_74%,#0f766e_100%)] text-white shadow-[0_0_18px_rgba(15,118,110,0.28)]">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current">
                        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.5" strokeWidth="2.2" />
                        <circle cx="12" cy="12" r="4.1" strokeWidth="2.2" />
                        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    <span className="flex flex-col items-start leading-none">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700/80">Instagram</span>
                      <span className="mt-1 text-sm font-bold text-emerald-950 transition group-hover:text-emerald-800">
                        @{instagramHandle}
                      </span>
                    </span>
                  </span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row">
        <div className="flex-1 space-y-8">
          <div className="rounded-[28px] border border-white/80 bg-white p-8 shadow-[0_20px_60px_rgba(8,48,37,0.08)]">
            <h2 className="text-xl font-bold text-emerald-900">강의 소개</h2>
            <p className="mt-4 whitespace-pre-wrap leading-8 text-gray-700">
              {teacher.desc || '등록된 강의 소개가 아직 없습니다.'}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white p-8 shadow-[0_20px_60px_rgba(8,48,37,0.08)]">
            <h2 className="text-xl font-bold text-emerald-900">주요 이력</h2>
            {histories.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {histories.map((history, index) => (
                  <li key={`${history}-${index}`} className="relative pl-5 text-gray-700">
                    <span className="absolute left-0 top-2.5 h-2 w-2 rounded-full bg-emerald-600" />
                    {history}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-gray-500">등록된 이력이 아직 없습니다.</p>
            )}
          </div>

          <div className="rounded-[28px] border border-dashed border-emerald-200 bg-emerald-50/70 p-6">
            <h2 className="text-sm font-bold text-emerald-900">안심 블라인드 정책</h2>
            <p className="mt-3 break-keep text-sm leading-7 text-emerald-900/80">
              강사님의 전화번호와 이메일은 공용 화면에 공개되지 않습니다. 문의는 센터를 통해 접수되며,
              강사님께 전달된 뒤 확인 후 회신이 진행됩니다.
            </p>
          </div>
        </div>

        <aside className="w-full space-y-6 lg:sticky lg:top-8 lg:w-[340px]">
          <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(8,48,37,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">전문 분야</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {fieldTags.length > 0 ? (
                fieldTags.map((field) => (
                  <span key={field} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                    #{field}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">등록된 전문 분야가 없습니다.</span>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(8,48,37,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">연락 안내</h2>
            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              강사님 개인정보는 보호를 위해 비공개 처리됩니다.
            </div>
            <p className="mt-4 text-sm leading-7 text-gray-600">
              강의 외 센터 문의는 양양군 농촌활성화지원센터로 연락해주세요.
            </p>
            <a href="tel:033-673-0221" className="mt-3 inline-flex text-sm font-bold text-emerald-700 hover:underline">
              033-673-0221
            </a>

            {(sessionRole === 'ADMIN' || isOwner) && teacher.address ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">관리용 주소</p>
                <p className="mt-2 text-sm text-gray-700">{teacher.address}</p>
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-[36px] border border-white/80 bg-white p-8 shadow-[0_25px_80px_rgba(8,48,37,0.08)] md:p-10">
          <div className="flex flex-col gap-5 border-b border-gray-100 pb-8 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Async Inquiry</p>
              <h2 className="mt-3 text-3xl font-black text-emerald-900">강사님께 문의 남기기</h2>
              <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-gray-600">
                강사님께 문의 내용이 메일로 전달되며, 강사님 확인 시 회신됩니다.
              </p>
            </div>

            {!session?.user ? (
              <button
                type="button"
                onClick={() => signIn(undefined, { callbackUrl: getAppPath(`/teacher/${encodeURIComponent(teacherId)}`) })}
                className="rounded-full border border-emerald-700 px-6 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
              >
                로그인 후 문의하기
              </button>
            ) : canInquire ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
                {quotaLoading ? '문의 가능 횟수를 확인하는 중입니다...' : `이번 달 잔여 문의 횟수: ${quota.remainingCount}회`}
              </div>
            ) : (
              <div className="rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
                문의는 일반 회원 계정에서 이용할 수 있습니다.
              </div>
            )}
          </div>

          <form className="mt-10 grid gap-6 md:grid-cols-2" onSubmit={onSubmitInquiry}>
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">이름</label>
              <input
                {...register('inquirerName')}
                className={`w-full rounded-2xl border px-4 py-3 text-sm ${errors.inquirerName ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="문의하시는 분 성함"
              />
              {errors.inquirerName ? <p className="mt-1 text-xs text-red-600">{errors.inquirerName.message}</p> : null}
            </div>

            <div>
              <input type="hidden" {...register('requesterEmail')} />
              <label className="mb-2 block text-sm font-bold text-gray-700">회신 받을 연락처</label>
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  { value: 'PHONE', label: '전화번호' },
                  { value: 'EMAIL', label: '이메일' },
                  { value: 'NONE', label: '선택 안 함' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${contactMethod === option.value
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200'
                      }`}
                  >
                    <input type="radio" value={option.value} {...register('contactMethod')} className="sr-only" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <input
                {...register('contactValue')}
                disabled={contactMethod === 'NONE'}
                className={`w-full rounded-2xl border px-4 py-3 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 ${errors.contactValue ? 'border-red-500' : 'border-gray-200'}`}
                placeholder={
                  contactMethod === 'NONE'
                    ? '연락처 없이 문의를 보냅니다'
                    : contactMethod === 'EMAIL'
                      ? '회신 받을 이메일을 입력해주세요'
                      : '회신 받을 전화번호를 입력해주세요'
                }
              />
              {errors.contactValue ? <p className="mt-1 text-xs text-red-600">{errors.contactValue.message}</p> : null}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-gray-700">문의 목적</label>
              <select
                {...register('purpose')}
                className={`w-full rounded-2xl border px-4 py-3 text-sm ${errors.purpose ? 'border-red-500' : 'border-gray-200'}`}
              >
                <option value="">문의 목적을 선택해주세요</option>
                <option value="강의 섭외">강의 섭외</option>
                <option value="협업 제안">협업 제안</option>
                <option value="정보 교류">정보 교류</option>
                <option value="프로그램 기획">프로그램 기획</option>
                <option value="기타">기타</option>
              </select>
              {errors.purpose ? <p className="mt-1 text-xs text-red-600">{errors.purpose.message}</p> : null}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-gray-700">문의 내용</label>
              <textarea
                rows={7}
                {...register('message')}
                className={`w-full rounded-3xl border px-5 py-4 text-sm leading-7 ${errors.message ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="강의 요청 배경, 희망 일정, 진행 방식 등 필요한 내용을 300자 이내로 작성해주세요."
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={errors.message ? 'text-red-600' : 'text-gray-500'}>
                  {errors.message ? errors.message.message : '텍스트만 전송되며 파일과 사진은 첨부되지 않습니다.'}
                </span>
                <span className={messageValue.length > 300 ? 'font-semibold text-red-600' : 'text-gray-500'}>
                  {messageValue.length} / 300자
                </span>
              </div>
            </div>

            {inquiryError || inquiryMessage ? (
              <div
                className={`md:col-span-2 rounded-2xl border px-4 py-3 text-sm ${inquiryError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
              >
                {inquiryError || inquiryMessage}
              </div>
            ) : null}

            <div className="md:col-span-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-gray-500">
                {quotaLoading
                  ? '문의 가능 횟수를 확인하는 중입니다...'
                  : `이번 달 잔여 문의 횟수: ${quota.remainingCount}회 / 총 ${quota.monthlyLimit}회`}
              </p>

              <button
                type="submit"
                disabled={inquirySubmitting || sessionStatus === 'loading' || !session?.user || !canInquire || !quota.canSend}
                className="inline-flex items-center justify-center rounded-full bg-emerald-800 px-7 py-3 text-sm font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inquirySubmitting ? '문의 접수 중...' : quota.canSend ? '문의 접수하기' : '이번 달 문의 마감'}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => router.push('/instructors')}
              className="rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              강사 목록으로 돌아가기
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
