'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { profileUpdateSchema, type ProfileUpdatePayload } from '@/lib/domain';
import {
  compressImageForProfile,
  deleteProfilePhoto,
  getImageFileFromClipboard,
  uploadProfilePhoto,
} from '@/lib/profile-photo-client';

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

export default function InstructorProfileForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profile, setProfile] = useState<InstructorProfileData>(emptyProfile);

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
  const previewPhoto = useMemo(() => profilePhoto || '', [profilePhoto]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch('/api/account/profile', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || '강사 프로필을 불러오지 못했습니다.');
        }

        const normalized = normalizeProfile(result.data);
        setProfile(normalized);
        reset(normalized);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '강사 프로필을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [reset]);

  const handleProfilePhotoFile = async (file: File | null) => {
    if (!file) return;

    setSubmitError('');
    setUploadingPhoto(true);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드할 수 있습니다.');
      }

      const compressed = await compressImageForProfile(file);
      const uploadedUrl = await uploadProfilePhoto(compressed, watch('name') || profile.name, profile.email);
      setValue('profilePhoto', uploadedUrl, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '프로필 사진 업로드에 실패했습니다.');
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
      setValue('profilePhoto', '', { shouldDirty: true, shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    setSubmitMessage('');

    try {
      const response = await fetch('/api/account/profile', {
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Instructor My Page</p>
            <h1 className="mt-2 text-3xl font-bold">{profile.name || '강사 프로필'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50/90">
              가입 후 강사카드 운영에 필요한 주요경력, 주소, 포트폴리오, 인스타그램 공개여부를 이 화면에서 직접 관리합니다.
            </p>
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
          </div>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(19,60,44,0.08)]">
          <h2 className="text-xl font-semibold text-gray-900">소셜 및 포트폴리오</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">인스타그램</label>
              <input {...register('instagram')} className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" />
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
          <div
            onPaste={handlePastePhoto}
            className="mt-5 grid gap-5 md:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5">
              <p className="text-sm font-medium text-gray-900">첨부 또는 붙여넣기</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                JPG, PNG, WEBP 파일을 선택하거나 클립보드 이미지를 붙여넣으면 자동으로 5MB 이하 JPEG로 압축 후 저장합니다.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {uploadingPhoto ? '업로드 중...' : '사진 파일 선택'}
                </button>
                {previewPhoto && (
                  <button
                    type="button"
                    onClick={() => void handleRemovePhoto()}
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
              <input type="hidden" {...register('profilePhoto')} />
            </div>

            <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gray-50">
              {previewPhoto ? (
                <img src={previewPhoto} alt="강사 프로필 사진 미리보기" className="h-72 w-full object-cover" />
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-gray-400">등록된 프로필 사진이 없습니다.</div>
              )}
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
          <div className="text-sm text-gray-500">
            {profile.updatedAt ? `마지막 시트 반영 시각: ${profile.updatedAt}` : '저장 후 시트와 Firestore 미러에 동시에 반영됩니다.'}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              관리자 화면
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingPhoto || !isDirty}
              className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              {isSubmitting ? '저장 중...' : uploadingPhoto ? '사진 업로드 중...' : '강사 프로필 저장'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
