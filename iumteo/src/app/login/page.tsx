'use client';

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const registered = searchParams?.get('registered') === '1';

    const handleCredentialsLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!username || !password) {
            setError("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        const res = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("등록되지 않은 사용자거나 비밀번호가 틀립니다.");
        } else {
            router.push('/admin');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-extrabold text-emerald-800 mb-2">양양 강사 이음터</h2>
                        <p className="text-gray-500 text-sm font-medium">관리자 및 로컬 전문가 통합 로그인</p>
                    </div>

                    <div className="space-y-6">
                        {registered && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                가입이 완료되었습니다. 권한 반영을 위해 다시 로그인해 주세요.
                            </div>
                        )}

                        {/* Social Logins */}
                        <div className="space-y-3">
                            <button
                                onClick={() => signIn("kakao", { callbackUrl: "/register" })}
                                className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-bold text-black bg-[#FEE500] hover:bg-[#FEE500]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FEE500]"
                            >
                                카카오 계정으로 가입/로그인
                            </button>
                            <button
                                onClick={() => signIn("naver", { callbackUrl: "/register" })}
                                className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#03C75A] hover:bg-[#02b350] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#03C75A]"
                            >
                                네이버 계정으로 가입/로그인
                            </button>
                            <button
                                onClick={() => signIn("google", { callbackUrl: "/register" })}
                                className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                            >
                                <svg className="w-5 h-5 mr-2 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                구글 계정으로 가입/로그인
                            </button>
                        </div>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-400 font-medium">관리자 및 테스트용 접속</span>
                            </div>
                        </div>

                        {/* Credentials Form */}
                        <form className="space-y-5" onSubmit={handleCredentialsLogin}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">아이디 (연락처 등)</label>
                                <input
                                    type="text"
                                    required
                                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-gray-50 bg-white"
                                    placeholder="예: admin"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                                <input
                                    type="password"
                                    required
                                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-gray-50 focus:bg-white"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                            >
                                관리자 로그인 (테스트용 admin/admin)
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/register')}
                                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                            >
                                일반회원 / 강사 가입
                            </button>
                        </form>
                    </div>
                </div>

                <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                    <button onClick={() => router.push('/')} className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">
                        ← 홈으로 돌아가기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
            <LoginPageContent />
        </Suspense>
    );
}
