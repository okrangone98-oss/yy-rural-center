'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import LocalBadge from '@/components/common/LocalBadge';
import { FIELD_FILTER_OPTIONS, matchFieldCategory } from '@/lib/field-categories';
import { getAppPath } from '@/lib/app-url';
import { resolveProfilePhotoPublicUrl } from '@/lib/profile-photo-client';

type Instructor = {
  id?: string;
  email?: string;
  name?: string;
  field?: string;
  area?: string;
  org?: string;
  intro?: string;
  profilePhoto?: string;
  isLocal?: 'Y' | 'N' | boolean;
};

function normalizeIsLocal(value: Instructor['isLocal']): 'Y' | 'N' {
  return value === true || value === 'Y' ? 'Y' : 'N';
}

function InstructorCard({ instructor }: { instructor: Instructor }) {
  const router = useRouter();
  const name = instructor.name || '이름 없음';
  const isLocal = normalizeIsLocal(instructor.isLocal);

  return (
    <button
      type="button"
      onClick={() => router.push(`/teacher/${encodeURIComponent(name)}`)}
      className="group flex w-full flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-emerald-100 bg-emerald-50">
          {instructor.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={instructor.profilePhoto}
              alt={name}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=64`;
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-black text-emerald-700">
              {name.slice(0, 1)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-bold text-gray-900 group-hover:text-emerald-700">{name}</p>
            <LocalBadge isLocal={isLocal} size="sm" />
          </div>
          {instructor.org ? <p className="mt-0.5 truncate text-xs text-gray-500">{instructor.org}</p> : null}
          {instructor.field ? (
            <p className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {instructor.field}
            </p>
          ) : null}
        </div>
      </div>

      {instructor.intro ? <p className="line-clamp-2 text-sm leading-6 text-gray-500">{instructor.intro}</p> : null}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{instructor.area ? `📍 ${instructor.area}` : ''}</span>
        <span className="font-semibold text-emerald-700">상세 보기</span>
      </div>
    </button>
  );
}

export default function InstructorsPage() {
  const { data: session, status } = useSession();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = status === 'authenticated' && !!session?.user;
  const userRole = session?.user?.role;
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || '';

  useEffect(() => {
    fetch(getAppPath('/api/instructor'), { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (!json.success || !Array.isArray(json.data)) {
          setInstructors([]);
          return;
        }

        const listed = json.data
          .filter((item: Instructor) => !!item.name)
          .map((item: Instructor) => ({
            ...item,
            profilePhoto: resolveProfilePhotoPublicUrl(item.profilePhoto),
          }));

        setInstructors(listed);
      })
      .catch(() => {
        setInstructors([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return instructors.filter((item) => {
      const matchesKeyword =
        !keyword ||
        (item.name || '').toLowerCase().includes(keyword) ||
        (item.field || '').toLowerCase().includes(keyword) ||
        (item.area || '').toLowerCase().includes(keyword) ||
        (item.org || '').toLowerCase().includes(keyword);

      const matchesField = fieldFilter === 'all' || matchFieldCategory(item.field || '') === fieldFilter;

      return matchesKeyword && matchesField;
    });
  }, [fieldFilter, instructors, search]);

  const myPageHref =
    userRole === 'ADMIN' ? '/admin' : userRole === 'INSTRUCTOR' ? '/teacher' : '/profile';

  return (
    <div className="min-h-screen bg-[#f7fbf8]">
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white">이</div>
            <div>
              <p className="font-black text-gray-900">양양 이음터</p>
              <p className="text-xs text-gray-500">강사 공개 목록</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link href="/" className="text-gray-600 hover:text-emerald-700">홈</Link>
            <Link href="/instructors" className="text-emerald-700">강사 찾기</Link>
            <Link href="/notices" className="text-gray-600 hover:text-emerald-700">센터 공지</Link>
            <Link href="/qna" className="text-gray-600 hover:text-emerald-700">자주 묻는 질문</Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isLoggedIn ? (
              <>
                <Link href={myPageHref} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {userName || '내 페이지'}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: getAppPath('/instructors') })}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link href="/register" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  회원가입
                </Link>
                <Link href="/login" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                  로그인
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 md:hidden"
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label="메뉴"
          >
            <span className="flex flex-col gap-1">
              <span className={`block h-0.5 w-5 bg-gray-700 transition-transform ${mobileMenuOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-5 bg-gray-700 transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 bg-gray-700 transition-transform ${mobileMenuOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </span>
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-emerald-100 bg-white px-4 pb-4 md:hidden">
            <nav className="flex flex-col gap-1 pt-2">
              <Link href="/" className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">홈</Link>
              <Link href="/instructors" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">강사 찾기</Link>
              <Link href="/notices" className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">센터 공지</Link>
              <Link href="/qna" className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">자주 묻는 질문</Link>
            </nav>
          </div>
        ) : null}
      </header>

      <section className="bg-[radial-gradient(circle_at_top_left,#0f766e_0%,#065f46_48%,#022c22_100%)] px-4 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-black md:text-4xl">강사 찾기</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-100 md:text-base">
            양양에서 활동하는 강사를 공개 목록으로 살펴보고, 상세 페이지에서 문의를 이어갈 수 있습니다.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름, 분야, 지역으로 검색"
                className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
              />
            </div>
            <select
              value={fieldFilter}
              onChange={(event) => setFieldFilter(event.target.value)}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
            >
              {FIELD_FILTER_OPTIONS.map((option) => (
                <option key={option.key} value={option.key} className="text-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {!loading ? (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {search || fieldFilter !== 'all' ? (
                <>검색 결과 <span className="font-bold text-gray-900">{filtered.length}명</span></>
              ) : (
                <>등록 강사 <span className="font-bold text-gray-900">{filtered.length}명</span></>
              )}
            </p>
            {search || fieldFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFieldFilter('all');
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                필터 초기화
              </button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-3xl bg-gray-200" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item, index) => (
              <InstructorCard key={item.id || `${item.name}-${index}`} instructor={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
            <p className="text-4xl">🔎</p>
            <p className="mt-4 text-lg font-bold text-gray-900">검색 결과가 없습니다</p>
            <p className="mt-2 text-sm text-gray-500">다른 키워드나 전체 분야로 다시 확인해보세요.</p>
          </div>
        )}

        {!isLoggedIn && filtered.length > 0 ? (
          <div className="mt-10 rounded-[32px] bg-gradient-to-r from-emerald-800 to-teal-700 px-6 py-8 text-white">
            <h2 className="text-xl font-black">마음에 드는 강사를 찾으셨나요?</h2>
            <p className="mt-2 text-sm text-emerald-100">로그인하면 강사 상세 페이지에서 바로 문의를 접수할 수 있습니다.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center font-semibold hover:bg-white/20">
                회원가입
              </Link>
              <Link href="/login" className="rounded-2xl bg-white px-5 py-3 text-center font-bold text-emerald-800 hover:bg-emerald-50">
                로그인하기
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
