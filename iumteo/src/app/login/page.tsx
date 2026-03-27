'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { getAppPath, getRoutePath } from '@/lib/app-url';

function resolveNextRoute(role?: string | null) {
  if (role === 'USER') return '/profile';
  if (role === 'INSTRUCTOR') return '/teacher';
  if (role === 'ADMIN') return '/admin';
  return '/';
}

async function resolveSessionRole() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sessionResponse = await fetch(getAppPath('/api/auth/session'), { cache: 'no-store' });
    const sessionJson = await sessionResponse.json();
    const role = sessionJson?.user?.role as string | undefined;
    if (role) {
      return role;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return undefined;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const registered = searchParams?.get('registered') === '1';
  const rawCallbackUrl = searchParams?.get('callbackUrl');
  const callbackUrl = useMemo(
    () => (rawCallbackUrl ? getRoutePath(rawCallbackUrl) : ''),
    [rawCallbackUrl],
  );

  const handleCredentialsLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const formData = new FormData(event.currentTarget);
    const submittedUsername = String(formData.get('username') || username || '').trim();
    const submittedPassword = String(formData.get('password') || password || '').trim();

    if (!submittedUsername || !submittedPassword) {
      setError('전화번호 또는 가입 이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setUsername(submittedUsername);
    setPassword(submittedPassword);
    setSubmitting(true);

    try {
      const response = await signIn('credentials', {
        username: submittedUsername,
        password: submittedPassword,
        redirect: false,
      });

      if (!response || response.error) {
        setError('전화번호, 가입 이메일 또는 비밀번호를 다시 확인해 주세요.');
        return;
      }

      const role = await resolveSessionRole();
      const nextRoute = callbackUrl || resolveNextRoute(role);
      router.push(nextRoute);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      <div className="grid min-h-screen lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(180deg,#0f6a50_0%,#0b5b46_100%)] px-10 py-12 text-white lg:flex lg:flex-col">
          <div className="absolute -right-12 top-8 h-48 w-48 rounded-full bg-white/8" />
          <div className="absolute left-10 top-40 h-32 w-32 rounded-full bg-white/6" />
          <div className="absolute -left-8 bottom-16 h-44 w-44 rounded-full bg-white/6" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 text-3xl font-black">
              이
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight">양양 강사 이음터</p>
              <p className="mt-1 text-sm text-emerald-50/80">양양군 농촌활성화지원센터</p>
            </div>
          </div>

          <div className="relative z-10 mt-auto">
            <h1 className="max-w-xs text-5xl font-black leading-tight">
              강사와 주민, 지역을 연결하는 양양 이음터
            </h1>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-xl rounded-[32px] bg-white px-6 py-7 shadow-[0_30px_80px_rgba(15,77,58,0.09)] sm:px-10 sm:py-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-700"
            >
              <ArrowLeft size={16} />
              홈으로 돌아가기
            </Link>

            <div className="mt-7">
              <h2 className="text-4xl font-black tracking-tight text-slate-900">로그인</h2>
              <p className="mt-3 text-base leading-7 text-slate-500">
                전화번호 또는 가입된 이메일과 비밀번호로 로그인합니다.
              </p>
            </div>

            {registered ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                가입이 완료되었습니다. 승인 또는 권한 반영 후 로그인해 주세요.
              </div>
            ) : null}

            {searchParams?.get('error') ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                로그인 정보 또는 접근 권한을 다시 확인해 주세요.
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleCredentialsLogin}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  전화번호, 가입 이메일 또는 관리자 아이디
                </label>
                <input
                  type="text"
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="01012345678 또는 example@yycenter.kr"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-emerald-700 px-5 py-4 text-base font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div className="mt-9">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-sm font-medium text-slate-400">회원가입 안내</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="mt-5 space-y-3 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <button
                  type="button"
                  onClick={() => router.push('/register?type=user')}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-5 py-5 text-left transition hover:border-emerald-200 hover:shadow-sm"
                >
                  <p className="text-lg font-bold text-slate-900">일반회원 가입</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    강사 문의, 회신 메일 확인, 채팅 진행이 필요한 이용자용 가입입니다.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/register?type=instructor')}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-5 py-5 text-left transition hover:border-emerald-200 hover:shadow-sm"
                >
                  <p className="text-lg font-bold text-slate-900">지역강사 가입</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    강사 프로필 등록과 문의 수락, 채팅 응답을 위한 강사용 가입입니다.
                  </p>
                </button>
              </div>
            </div>

            <p className="mt-7 text-center text-sm text-slate-400">
              로그인에 계속 문제가 있으면{' '}
              <a
                href="https://yycenter.kr"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-700"
              >
                센터로 문의
              </a>
              해 주세요.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f7f5]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
