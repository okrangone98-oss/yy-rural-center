'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { registerPayloadSchema, type RegisterPayload, type RegisterMemberType } from '@/lib/domain';
import { compressImageForProfile, getImageFileFromClipboard, uploadProfilePhoto } from '@/lib/profile-photo-client';

const defaultValues: RegisterPayload = {
  memberType: 'USER',
  name: '',
  email: '',
  phone: '',
  password: '',
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
  consent: {
    requiredAccepted: false,
    profilePublicAccepted: false,
    marketingAccepted: false,
    consentVersion: 'blind-policy-2026-03',
  },
};

function RoleCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-500">{description}</div>
    </button>
  );
}

const INSTRUCTOR_FIELD_OPTIONS = [
  '농촌,공동체,정책',
  '환경,생태',
  '사진,아카이브,영상',
  '미술,공예,예술',
  '요리,식문화',
  '정리,실버,복지,치유',
  '디지털,AI,문해',
  '레크레이션,진행',
  '세무,회계',
  '인문,철학',
  '마케팅,로컬브랜딩',
  '건강,스포츠',
  '기타',
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const usingSocialSession = !!session?.user?.email && session.user.provider !== 'credentials';
  const currentRole = session?.user?.role;

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterPayload>({
    resolver: zodResolver(registerPayloadSchema) as any,
    defaultValues: {
      ...defaultValues,
      email: session?.user?.email || '',
      name: session?.user?.name || '',
    },
  });

  const memberType = watch('memberType');
  const profilePhoto = watch('profilePhoto');
  const watchedName = watch('name');
  const watchedEmail = watch('email');

  useEffect(() => {
    if (session?.user?.email) {
      setValue('email', session.user.email);
    }
    if (session?.user?.name) {
      setValue('name', session.user.name);
    }
  }, [session, setValue]);

  useEffect(() => {
    if (!session?.user) return;
    if (currentRole === 'GUEST') return;

    if (currentRole === 'ADMIN' || currentRole === 'INSTRUCTOR') {
      router.replace('/admin');
      return;
    }

    if (currentRole === 'USER') {
      router.replace('/profile');
    }
  }, [currentRole, router, session]);

  useEffect(() => {
    setPhotoPreview(profilePhoto || '');
  }, [profilePhoto]);

  const handleProfilePhotoFile = async (file: File | null) => {
    if (!file) return;

    setPhotoError('');
    setUploadingPhoto(true);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드할 수 있습니다.');
      }

      const compressed = await compressImageForProfile(file);
      const uploadedUrl = await uploadProfilePhoto(compressed, watchedName, watchedEmail);
      setValue('profilePhoto', uploadedUrl, { shouldDirty: true, shouldValidate: true });
      setPhotoPreview(uploadedUrl);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : '프로필 사진 업로드에 실패했습니다.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePastePhoto = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedFile = getImageFileFromClipboard(event);
    if (!pastedFile) return;
    event.preventDefault();
    await handleProfilePhotoFile(pastedFile);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    setSubmitMessage('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '가입 처리 실패');
      }

      setSubmitMessage(result.message);
      if (usingSocialSession) {
        await signOut({ callbackUrl: '/login?registered=1' });
        return;
      }

      router.push('/login?registered=1');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '가입 처리 실패');
    } finally {
      setSubmitting(false);
    }
  });

  const setMemberType = (type: RegisterMemberType) => {
    setValue('memberType', type);
    if (type === 'USER') {
      setValue('field', '');
      setValue('area', '');
      setValue('intro', '');
      setValue('career', '');
      setValue('address', '');
      setValue('instagram', '');
      setValue('instagramOpen', '미공개');
      setValue('portfolioLink', '');
      setValue('consent.profilePublicAccepted', false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f8f5_0%,#eef3ef_100%)] py-10 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[28px] border border-white/70 bg-white/90 shadow-[0_25px_80px_rgba(13,56,36,0.08)] backdrop-blur p-6 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-emerald-900">양양 강사 이음터 가입</h1>
            <p className="mt-2 text-sm text-gray-600">
              일반회원과 강사는 같은 가입 흐름을 쓰되, 역할에 따라 입력 카드와 동의 항목이 달라집니다.
            </p>
          </div>

          {!usingSocialSession && (
            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/register' })}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                구글 로그인 후 가입 이어가기
              </button>
              <button
                type="button"
                onClick={() => signIn('naver', { callbackUrl: '/register' })}
                className="rounded-2xl border border-[#03C75A] bg-[#03C75A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#02b350]"
              >
                네이버 로그인 후 가입 이어가기
              </button>
            </div>
          )}

          {usingSocialSession && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              소셜 로그인 계정으로 가입을 이어갑니다. 이름과 이메일은 미리 채워졌고, 나머지 정보는 일반회원/강사와 동일하게 입력합니다.
              <div className="mt-1 font-medium">이메일: {session.user.email}</div>
            </div>
          )}

          <form className="space-y-8" onSubmit={onSubmit}>
            <section className="grid gap-3 md:grid-cols-2">
              <RoleCard
                active={memberType === 'USER'}
                onClick={() => setMemberType('USER')}
                title="일반회원"
                description="강사 매칭 문의를 위한 기관 및 민간 일반 회원"
              />
              <RoleCard
                active={memberType === 'INSTRUCTOR'}
                onClick={() => setMemberType('INSTRUCTOR')}
                title="강사"
                description="전문 분야와 프로필을 등록하고 센터를 통해 문의를 전달받는 활동 주체"
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
                <input {...register('name')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
                <input
                  {...register('email')}
                  disabled={usingSocialSession}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm disabled:bg-gray-100"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
                <input {...register('phone')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">소속</label>
                <input {...register('org')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              </div>
              {!usingSocialSession && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">비밀번호</label>
                  <input
                    type="password"
                    {...register('password')}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                  />
                </div>
              )}
            </section>

            {memberType === 'INSTRUCTOR' && (
              <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
                <h2 className="text-lg font-semibold text-emerald-900">강사 프로필 카드</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">강의 분야 (카테고리)</label>
                    <select
                      {...register('field')}
                      title="강의 분야 카테고리를 선택해 주세요"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                    >
                      <option value="">강의 분야를 선택해 주세요</option>
                      {INSTRUCTOR_FIELD_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">스프레드시트에는 선택한 카테고리가 강의 분야로 저장됩니다.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">활동 지역</label>
                    <input {...register('area')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">주요 경력</label>
                    <input {...register('career')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
                    <input {...register('address')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">인스타그램</label>
                    <input {...register('instagram')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">인스타그램 공개 여부</label>
                    <select {...register('instagramOpen')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm">
                      <option value="미공개">미공개</option>
                      <option value="공개">공개</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">포트폴리오 링크</label>
                    <input {...register('portfolioLink')} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">프로필 사진</label>
                    <input type="hidden" {...register('profilePhoto')} />
                    <div
                      onPaste={handlePastePhoto}
                      className="rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-4 text-sm text-gray-600"
                    >
                      <div className="font-medium text-gray-800">사진 파일 첨부 또는 붙여넣기</div>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        JPG, PNG, WEBP 파일을 선택하거나 클립보드의 이미지를 붙여넣으면 자동으로 5MB 이하 JPEG로 압축 후 저장됩니다.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {uploadingPhoto ? '업로드 중...' : '사진 파일 선택'}
                        </button>
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setValue('profilePhoto', '', { shouldDirty: true, shouldValidate: true });
                              setPhotoPreview('');
                              setPhotoError('');
                            }}
                            className="text-xs font-medium text-gray-500 hover:text-gray-900"
                          >
                            사진 제거
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
                    </div>
                    {photoPreview && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
                        <img src={photoPreview} alt="강사 프로필 미리보기" className="h-48 w-full object-cover" />
                      </div>
                    )}
                    {photoError && <p className="mt-2 text-xs text-red-600">{photoError}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">소개</label>
                    <textarea
                      rows={4}
                      {...register('intro')}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <h2 className="text-lg font-semibold text-gray-900">개인정보 및 서비스 동의</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <label className="flex items-start gap-3">
                  <input type="checkbox" {...register('consent.requiredAccepted')} className="mt-1" />
                  <span>(필수) 서비스 이용 및 개인정보 수집·이용에 동의합니다.</span>
                </label>
                {memberType === 'INSTRUCTOR' && (
                  <label className="flex items-start gap-3">
                    <input type="checkbox" {...register('consent.profilePublicAccepted')} className="mt-1" />
                    <span>(필수) 연락처를 제외한 강사 프로필, 활동 분야, 소개 정보의 대외 공개에 동의합니다.</span>
                  </label>
                )}
                <label className="flex items-start gap-3">
                  <input type="checkbox" {...register('consent.marketingAccepted')} className="mt-1" />
                  <span>(선택) 프로그램 소식, 모집 안내, 센터 공지 등 마케팅 정보 수신에 동의합니다.</span>
                </label>
              </div>
            </section>

            {submitError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
            {submitMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitMessage}</div>}

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="submit"
                disabled={submitting || uploadingPhoto}
                className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
              >
                {submitting ? '처리 중...' : uploadingPhoto ? '사진 업로드 중...' : memberType === 'INSTRUCTOR' ? '강사 가입 접수' : '일반회원 가입'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                로그인 화면으로 이동
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
