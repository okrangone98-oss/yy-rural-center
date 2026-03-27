'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { getAppPath } from '@/lib/app-url';
import { resolveProfilePhotoPublicUrl } from '@/lib/profile-photo-client';
import NotificationBell from '@/components/common/NotificationBell';

type PublicInstructor = {
  id?: string;
  name?: string;
  field?: string;
  area?: string;
  org?: string;
  profilePhoto?: string;
};

type NoticeItem = {
  id: string;
  tag: string;
  title: string;
  body: string;
  date?: string;
};

function InstructorCard({ instructor }: { instructor: PublicInstructor }) {
  const router = useRouter();
  const name = instructor.name || '강사';

  return (
    <button
      type="button"
      onClick={() => router.push(`/teacher/${encodeURIComponent(name)}`)}
      className="group flex flex-col items-center gap-3 rounded-3xl border border-emerald-100 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
    >
      <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-emerald-100 bg-emerald-50">
        {instructor.profilePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={instructor.profilePhoto}
            alt={name}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=80`;
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-black text-emerald-700">
            {name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-bold text-gray-900 group-hover:text-emerald-700">{name}</p>
        {instructor.field ? <p className="text-sm text-emerald-700">{instructor.field}</p> : null}
        {instructor.area ? <p className="text-xs text-gray-500">{instructor.area}</p> : null}
      </div>
    </button>
  );
}

function QuickCard({
  icon,
  title,
  description,
  href,
  highlight,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-3xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        highlight ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white'
      }`}
    >
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${highlight ? 'bg-emerald-100' : 'bg-gray-50'}`}>
        {icon}
      </div>
      <h3 className={`text-base font-bold ${highlight ? 'text-emerald-800' : 'text-gray-900'}`}>{title}</h3>
      <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
    </Link>
  );
}

function NoticeBadge({ tag }: { tag: string }) {
  const styles: Record<string, string> = {
    중요: 'border-red-100 bg-red-50 text-red-700',
    안내: 'border-sky-100 bg-sky-50 text-sky-700',
    공지: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles[tag] || styles.공지}`}>{tag}</span>;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [instructors, setInstructors] = useState<PublicInstructor[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const role = session?.user?.role;
  const isLoggedIn = status === 'authenticated';
  const userName = session?.user?.name || '이음터 사용자';

  useEffect(() => {
    fetch(getAppPath('/api/instructor'), { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (!json.success || !Array.isArray(json.data)) return;

        setInstructors(
          json.data
            .filter((item: PublicInstructor) => item.name)
            .slice(0, 6)
            .map((item: PublicInstructor) => ({
              ...item,
              profilePhoto: resolveProfilePhotoPublicUrl(item.profilePhoto),
            })),
        );
      })
      .catch(() => {
        setInstructors([]);
      });
  }, []);

  useEffect(() => {
    fetch(getAppPath('/api/admin/notices'), { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (Array.isArray(json.notices)) {
          setNotices(json.notices.slice(0, 3));
        }
      })
      .catch(() => {
        setNotices([]);
      });
  }, []);

  const quickActions = useMemo(() => {
    if (role === 'ADMIN') {
      return [
        { icon: '⚙️', title: '운영 대시보드', description: '회원, 강사, 문의 흐름을 한 번에 확인합니다.', href: '/admin', highlight: true },
        { icon: '📨', title: '문의 운영함', description: '강사 전달, 상태 정리, 회신 메일을 관리합니다.', href: '/admin?tab=inquiries' },
        { icon: '✅', title: '강사 승인', description: '새 강사 등록과 공개 상태를 점검합니다.', href: '/admin?tab=approvals' },
        { icon: '📢', title: '공지 운영', description: '센터 공지와 안내 메시지를 등록합니다.', href: '/notices' },
      ];
    }

    if (role === 'INSTRUCTOR') {
      return [
        { icon: '📥', title: '받은 문의', description: '기관과 지역 주민에게서 도착한 문의를 먼저 확인합니다.', href: '/teacher', highlight: true },
        { icon: '💬', title: '채팅', description: '수락한 문의의 대화를 이어가며 협의를 진행합니다.', href: '/chat' },
        { icon: '🪪', title: '강사 카드', description: '소개, 경력, 활동 분야와 공개 동의한 인스타그램까지 정리해 자연스럽게 홍보합니다.', href: '/teacher' },
        { icon: '📢', title: '공지사항', description: '센터 운영 소식과 안내를 확인합니다.', href: '/notices' },
      ];
    }

    if (role === 'USER') {
      return [
        { icon: '🔎', title: '강사찾기', description: '양양에서 활동하는 강사님을 분야와 지역별로 살펴봅니다.', href: '/instructors', highlight: true },
        { icon: '📝', title: '문의하기 중', description: '접수한 문의 현황과 응답 상태를 확인합니다.', href: '/profile' },
        { icon: '💬', title: '채팅', description: '수락된 문의는 채팅으로 이어서 협의할 수 있습니다.', href: '/chat' },
        { icon: '📢', title: '공지사항', description: '센터 공지와 지역 커뮤니티 안내를 확인합니다.', href: '/notices' },
      ];
    }

    return [
      { icon: '🔎', title: '강사찾기', description: '양양에서 활동하는 강사님을 공개 목록으로 확인합니다.', href: '/instructors', highlight: true },
      { icon: '🙋', title: '일반회원 가입', description: '기관 또는 지역 주민으로 가입해 문의와 채팅을 이용합니다.', href: '/register?type=user' },
      { icon: '🎓', title: '지역강사 가입', description: '강사님으로 가입해 프로필을 등록하고 문의를 전달받습니다.', href: '/register?type=instructor' },
      { icon: '📢', title: '공지사항', description: '센터 운영 공지와 자주 묻는 내용을 확인합니다.', href: '/notices' },
    ];
  }, [role]);

  const heroCopy = useMemo(() => {
    if (role === 'INSTRUCTOR') {
      return {
        badge: 'Instructor Home',
        title: '첫 문의부터\n지역과의 협력까지\n양양 이음터와 함께',
        description:
          '양양 이음터는 강사님과 기관, 지역 주민을 연결해 수업 문의와 업무 협의가 자연스럽게 이어지도록 돕는 비영리 커뮤니티 플랫폼입니다.',
        secondary:
          '받은 문의를 확인하고, 필요한 경우 채팅으로 협의를 이어가며, 공개 동의한 인스타그램 주소와 연동 버튼으로 강사님의 프로필 홍보도 자연스럽게 이어지도록 지원합니다.',
        primaryHref: '/teacher',
        primaryLabel: '받은 문의 확인하기',
        secondaryHref: '/chat',
        secondaryLabel: '채팅 열기',
      };
    }

    if (role === 'USER') {
      return {
        badge: 'Local Matching',
        title: '지역과 강사님을\n연결하는\n양양 이음터',
        description:
          '교육과 지역 서비스를 위한 문의를 남기고, 수락된 건은 채팅으로 이어서 협의할 수 있는 양양 지역 커뮤니티 플랫폼입니다.',
        secondary:
          '일반회원은 문의하기 중, 채팅, 공지사항을 한 흐름으로 확인하고, 필요한 강사님을 찾아 지역 협업을 시작할 수 있습니다.',
        primaryHref: '/instructors',
        primaryLabel: '강사찾기',
        secondaryHref: '/profile',
        secondaryLabel: '문의 현황 보기',
      };
    }

    return {
      badge: 'Yangyang Iumteo',
      title: '양양의 강사님과\n기관, 지역 주민을 연결하는\n지역 커뮤니티 플랫폼',
      description:
        '양양 이음터는 교육과 지역 서비스를 중심으로 수업 문의, 업무 협의, 관계 형성이 이어지도록 돕는 비영리 연결 플랫폼입니다.',
      secondary:
        '강사님은 활동 분야와 강사 카드를 운영하고, 공개 동의한 경우 인스타그램 주소와 연동 버튼도 함께 노출할 수 있습니다. 기관과 지역 주민은 필요한 강사님을 찾아 문의와 채팅으로 협의할 수 있습니다.',
      primaryHref: '/instructors',
      primaryLabel: '강사찾기',
      secondaryHref: isLoggedIn ? '/chat' : '/login',
      secondaryLabel: isLoggedIn ? '채팅 확인하기' : '로그인하기',
    };
  }, [isLoggedIn, role]);

  const heroStats = useMemo(() => {
    if (role === 'INSTRUCTOR') {
      return [
        { label: '받은 문의 확인', value: '1단계', caption: '기관·지역 주민의 문의를 먼저 확인합니다.' },
        { label: '채팅 협의', value: '2단계', caption: '원하는 문의는 채팅으로 이어서 조율합니다.' },
        { label: '관계 성장', value: '3단계', caption: '서비스 진행 후 양양 지역과 함께 관계가 성장합니다.' },
      ];
    }

      return [
        { label: '공개 강사 카드', value: `${Math.max(instructors.length, 6)}+`, caption: '양양 지역 강사님의 전문 분야와 공개 프로필을 한눈에 확인할 수 있습니다.' },
        { label: '월 문의 가능 횟수', value: '20회', caption: '일반회원은 월 20회 범위 안에서 문의를 접수할 수 있습니다.' },
        { label: '공지와 안내', value: `${Math.max(notices.length, 3)}건`, caption: '센터 공지와 운영 안내를 빠르게 확인할 수 있습니다.' },
      ];
  }, [instructors.length, notices.length, role]);

  const workflowSteps = useMemo(() => {
    if (role === 'INSTRUCTOR') {
      return [
        {
          step: 'STEP 1',
          title: '기관과 지역 주민의 문의를 전달받습니다',
          body: '강사님께 필요한 문의가 도착하면 받은 문의와 알림 영역에서 먼저 확인할 수 있습니다.',
        },
        {
          step: 'STEP 2',
          title: '원하는 문의를 확인하고 채팅으로 협의합니다',
          body: '문의 수락 후 채팅으로 수업 내용, 일정, 준비사항을 자연스럽게 조율할 수 있습니다.',
        },
        {
          step: 'STEP 3',
          title: '서비스 진행 후 양양 지역과 함께 관계가 한층 더 성장하였습니다',
          body: '단발성 수업을 넘어 지속적인 지역 연결과 협업이 이어지도록 커뮤니티 흐름을 설계합니다.',
        },
      ];
    }

    return [
      {
        step: 'STEP 1',
        title: '강사님을 찾고 상세 정보를 확인합니다',
        body: '활동 분야와 지역을 살펴보며 우리 기관 또는 지역 주민에게 맞는 강사님을 찾습니다.',
      },
      {
        step: 'STEP 2',
        title: '문의하기로 수업 문의나 업무 협의를 남깁니다',
        body: '문의는 강사님과 센터에 함께 전달되며, 수락 후에는 채팅으로 이어서 논의할 수 있습니다.',
      },
      {
        step: 'STEP 3',
        title: '서비스 진행 후 양양 지역과 함께 관계가 한층 더 성장하였습니다',
        body: '단순 매칭을 넘어 지역 기반의 장기적인 협력과 커뮤니티 연결을 지향합니다.',
      },
    ];
  }, [role]);

  const fieldChips = [
    '전체',
    '공동체',
    '환경·생태',
    '사진·영상',
    '요리·식문화',
    '정리·돌봄',
    '예술·공예',
    '숲·생태',
    '건강·체육',
    '기타',
  ];

  return (
    <div className="min-h-screen bg-[#f7fbf8] text-gray-900">
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-lg font-black text-white">이</div>
            <div>
              <p className="font-black tracking-tight text-gray-900">양양 강사 이음터</p>
              <p className="text-xs text-gray-500">양양군 농촌활성화지원센터</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link href="/instructors" className="text-gray-600 hover:text-emerald-700">강사찾기</Link>
            <Link href="/notices" className="text-gray-600 hover:text-emerald-700">공지사항</Link>
            <Link href="/qna" className="text-gray-600 hover:text-emerald-700">이용안내</Link>
            <a href="https://yycenter.kr" target="_blank" rel="noreferrer" className="text-gray-600 hover:text-emerald-700">
              yycenter.kr
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <NotificationBell />
                <span className="hidden rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 md:inline-flex">
                  {userName}
                </span>
                <Link
                  href={role === 'USER' ? '/profile' : role === 'INSTRUCTOR' ? '/teacher' : '/admin'}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  마이페이지
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: getAppPath('/') })}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
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
        </div>
      </header>

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#0f766e_0%,#065f46_50%,#022c22_100%)] px-4 py-16 text-white md:py-24">
        <div className="absolute -right-16 top-0 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-100">
              {heroCopy.badge}
            </div>
            <h1 className="mt-6 whitespace-pre-line text-4xl font-black leading-tight md:text-6xl">
              {heroCopy.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-emerald-100 md:text-lg">
              {heroCopy.description}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/90 md:text-base">
              {heroCopy.secondary}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={heroCopy.primaryHref} className="rounded-2xl bg-white px-7 py-3.5 text-center font-bold text-emerald-800 hover:bg-emerald-50">
                {heroCopy.primaryLabel}
              </Link>
              <Link href={heroCopy.secondaryHref} className="rounded-2xl border border-white/20 bg-white/10 px-7 py-3.5 text-center font-semibold hover:bg-white/20">
                {heroCopy.secondaryLabel}
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {heroStats.map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
                <p className="text-sm font-semibold text-emerald-100">{item.label}</p>
                <h2 className="mt-3 text-3xl font-black text-white">{item.value}</h2>
                <p className="mt-3 text-sm leading-7 text-emerald-100">{item.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Quick Access</p>
          <h2 className="mt-2 text-2xl font-black text-gray-900">자주 쓰는 메뉴를 한곳에 모았습니다</h2>
          <p className="mt-2 text-sm text-gray-500">역할별로 가장 많이 쓰는 기능을 먼저 배치해 MVP 흐름이 바로 이어지도록 구성했습니다.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((item) => (
            <QuickCard key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Instructor Directory</p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">강사찾기</h2>
              <p className="mt-2 text-sm text-gray-500">양양에서 활동하는 강사님을 공개 목록으로 살펴보고, 상세 페이지에서 문의를 이어가거나 공개 동의한 인스타그램 정보를 확인할 수 있습니다.</p>
            </div>
            <Link href="/instructors" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
              전체 보기 →
            </Link>
          </div>

          <div className="mb-6 rounded-2xl border border-amber-100 bg-[#fffdf7] px-5 py-4 text-sm leading-7 text-gray-600 shadow-sm">
            분야와 지역을 먼저 훑어본 뒤, 적합한 강사님을 찾으면 상세 페이지에서 문의를 남겨보세요. 강사님이 공개에 동의한 경우 인스타그램 주소와 연동 버튼도 함께 확인할 수 있어 프로필과 활동 분위기를 더 자연스럽게 살펴볼 수 있습니다.
          </div>

          <div className="mb-8 flex flex-wrap gap-2">
            {fieldChips.map((topic, index) => (
              <span
                key={topic}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  index === 0
                    ? 'border-emerald-600 bg-emerald-700 text-white'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {topic}
              </span>
            ))}
          </div>

          {instructors.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {instructors.map((instructor, index) => (
                <InstructorCard key={instructor.id || `${instructor.name}-${index}`} instructor={instructor} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-500">
              강사 목록을 불러오는 중입니다.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[32px] bg-[#eef7f2] p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">How It Works</p>
            <h2 className="mt-3 text-2xl font-black text-gray-900">문의와 채팅은 이렇게 이어집니다</h2>
            <div className="mt-6 space-y-4">
              {workflowSteps.map((item) => (
                <div key={item.step} className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-emerald-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Community Board</p>
                <h2 className="mt-2 text-2xl font-black text-gray-900">공지사항</h2>
              </div>
              <Link href="/notices" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
                전체 보기
              </Link>
            </div>

            <p className="mt-3 text-sm leading-7 text-gray-500">
              공지사항을 통해 이음터 운영 소식, 지역 프로그램 안내 등의 내용을 공유합니다. 향후 커뮤니티가 발전되도록 기능을 보완할 예정입니다.
            </p>

            <div className="mt-6 space-y-3">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <article key={notice.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <NoticeBadge tag={notice.tag} />
                      {notice.date ? <span className="text-xs text-gray-400">{notice.date}</span> : null}
                    </div>
                    <h3 className="mt-3 font-bold text-gray-900">{notice.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{notice.body}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                  등록된 공지사항이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {!isLoggedIn ? (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-[36px] bg-gradient-to-r from-emerald-800 to-teal-700 px-8 py-10 text-white">
            <h2 className="text-2xl font-black">지금 양양 이음터를 시작해 보세요</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-100">
              일반회원은 강사님께 문의와 채팅을, 지역강사는 강사 카드 등록과 받은 문의 관리를 사용할 수 있습니다. 우리는 비영리기관으로서 지역 안의 연결과 협력을 돕는 데 집중합니다.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/register?type=user" className="rounded-2xl bg-white px-6 py-3 text-center font-bold text-emerald-800 hover:bg-emerald-50">
                일반회원 가입
              </Link>
              <Link href="/register?type=instructor" className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-center font-semibold hover:bg-white/20">
                지역강사 가입
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
