'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { getAppPath } from '@/lib/app-url';
import { FIELD_CATEGORIES } from '@/lib/field-categories';
import { resolveProfilePhotoPublicUrl } from '@/lib/profile-photo-client';
import NotificationBell from '@/components/common/NotificationBell';

type PublicInstructor = {
  id?: string;
  name?: string;
  field?: string;
  area?: string;
  org?: string;
  profilePhoto?: string;
  photo?: string;
  Profile_Photo?: string;
  profile_photo?: string;
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
      className="group flex w-full flex-col gap-4 rounded-[28px] border border-emerald-100 bg-white p-5 text-left shadow-[0_14px_40px_rgba(16,185,129,0.08)] transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_20px_46px_rgba(16,185,129,0.14)]"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-emerald-100 bg-emerald-50 shadow-inner">
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

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-black text-gray-900 group-hover:text-emerald-700">{name}</p>
            {instructor.field ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {instructor.field}
              </span>
            ) : null}
          </div>
          {instructor.org ? <p className="mt-1 line-clamp-1 text-sm text-gray-600">{instructor.org}</p> : null}
          {instructor.area ? <p className="mt-2 text-xs font-medium text-gray-500">활동 지역 {instructor.area}</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-[#f7fbf8] px-4 py-3">
        <p className="text-sm text-gray-500">카드를 눌러 상세 약력과 문의 정보를 확인해보세요.</p>
        <span className="text-sm font-bold text-emerald-700">상세 보기 →</span>
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
      className={`group rounded-3xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white'
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
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryField, setDirectoryField] = useState('전체');
  const [instructorPage, setInstructorPage] = useState(1);

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
            .map((item: PublicInstructor) => ({
              ...item,
              profilePhoto: resolveProfilePhotoPublicUrl(
                item.profilePhoto || item.photo || item.Profile_Photo || item.profile_photo,
              ),
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
        { icon: '💬', title: '채팅', description: '수락한 문의는 채팅을 이어가며 협의할 수 있습니다.', href: '/chat' },
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
        title: '양양의 어제와 오늘을 잇고,\n내일을 일구는 사람들의 네트워크',
        description:
          '양양 이음터는 강사님과 기관, 지역 주민을 연결해 수업 문의와 업무 협의가 자연스럽게 이어지도록 돕는 비영리 커뮤니티 플랫폼입니다.',
        secondary:
          '받은 문의를 확인하고, 필요한 경우 채팅으로 협의를 이어가 보세요.',
        primaryHref: '/teacher',
        primaryLabel: '받은 문의 확인하기',
        secondaryHref: '/chat',
        secondaryLabel: '채팅 열기',
      };
    }

    if (role === 'USER') {
      return {
        badge: 'Local Matching',
        title: '양양의 어제와 오늘을 잇고,\n내일을 일구는 사람들의 네트워크',
        description:
          '교육과 지역 서비스를 위한 문의를 강사님께 남기고, 수락된 건은 채팅으로 이어서 협의할 수 있도록 돕는 비영리 플랫폼입니다.',
        secondary:
          '일반회원은 문의하기를 통해 필요한 강사님을 찾아 협업을 시작할 수 있습니다.',
        primaryHref: '/instructors',
        primaryLabel: '강사찾기',
        secondaryHref: '/profile',
        secondaryLabel: '문의 현황 보기',
      };
    }

    return {
      badge: 'Yangyang Iumteo',
      title: '양양의 어제와 오늘을 잇고,\n내일을 일구는 사람들의 네트워크',
      description:
        "'양양 이음터'는 지역의 숨은 전문가를 발굴하고, 인적 자원이 필요한 기관에는 신뢰할 수 있는 인력 데이터 풀을 제공하는 징검다리입니다.",
      secondary:
        '다양한 분야에서 활동 중인 양양의 전문가들을 만나보세요. 서로의 경험을 나누고 함께 성장하는 단단한 공동체를 지향합니다.',
      primaryHref: '/instructors',
      primaryLabel: '양양 강사 보기',
      secondaryHref: '/register',
      secondaryLabel: '회원가입하기',
    };
  }, [role]);

  const heroStats = useMemo(() => {
    if (role === 'INSTRUCTOR') {
      return [
        { label: '받은 문의 확인', value: '1단계', caption: '기관·지역 주민의 문의를 먼저 확인합니다.' },
        { label: '채팅 협의', value: '2단계', caption: '원하는 문의는 채팅으로 이어서 조율합니다.' },
        { label: '관계 성장', value: '3단계', caption: '서비스 진행 후 양양 지역과 함께 관계가 성장합니다.' },
      ];
    }

    return [
      { label: '이용 에티켓 1', value: '존중하는 소통', caption: '강사님과의 문의 및 채팅 시 서로를 존중하고 다정한 언어를 사용해 주세요.' },
      { label: '이용 에티켓 2', value: '구체적인 문의', caption: '수업 목적, 대상 인원, 희망 장소와 일정을 명확히 적어주시면 빠른 협의가 가능합니다.' },
      { label: '이용 에티켓 3', value: '소중한 약속', caption: '협의가 완료된 일정은 꼭 지켜주시고, 부득이한 변동이 생기면 미리 당사자에게 알려주세요.' },
    ];
  }, [role]);

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

  const fieldChips = ['전체', ...FIELD_CATEGORIES.map((category) => category.label)];
  const guestHighlights = [
    {
      icon: '🤝',
      title: '가치 있는 연결',
      description: '필요한 곳에 검증된 인력을 매칭해 지역 안에서 믿을 수 있는 협업의 시작점을 만듭니다.',
    },
    {
      icon: '🌱',
      title: '지속 가능한 성장',
      description: '지역을 잘 아는 로컬 전문가와 기관, 주민이 함께하며 지역 안의 선순환을 차곡차곡 키워갑니다.',
    },
    {
      icon: '🛡️',
      title: '신뢰받는 데이터',
      description: '센터의 확인과 운영 기준을 바탕으로 더 안전하고 투명한 연결 흐름을 설계합니다.',
    },
  ];
  const guestGuideItems = [
    {
      icon: '🔒',
      title: '개인정보 보호',
      body: '개인 전화번호는 외부에 노출되지 않으며, 타 기관 문의 시 센터 확인 후 중계 절차를 거칩니다.',
    },
    {
      icon: '✏️',
      title: '자율적 정보 관리',
      body: '가입 후에는 본인 정보를 직접 수정할 수 있고, SNS 노출 여부도 스스로 선택할 수 있습니다.',
    },
    {
      icon: '🖼️',
      title: '프로필 사진 등록',
      body: '본인을 잘 나타내는 사진 1장을 함께 업로드하면 신뢰도 높은 강사 프로필을 완성할 수 있습니다.',
    },
  ];
  const guestJourney = [
    { icon: '🏢', label: '기관 문의' },
    { icon: '🔎', label: '센터 확인' },
    { icon: '💬', label: '의사 타진' },
    { icon: '🫶', label: '연결 완료' },
  ];
  const filteredInstructors = useMemo(() => {
    const keyword = directorySearch.trim().toLowerCase();

    return instructors.filter((item) => {
      const matchesKeyword =
        !keyword ||
        (item.name || '').toLowerCase().includes(keyword) ||
        (item.field || '').toLowerCase().includes(keyword) ||
        (item.area || '').toLowerCase().includes(keyword) ||
        (item.org || '').toLowerCase().includes(keyword);

      const matchesField = directoryField === '전체' || item.field === directoryField;

      return matchesKeyword && matchesField;
    });
  }, [directoryField, directorySearch, instructors]);

  useEffect(() => {
    setInstructorPage(1);
  }, [directoryField, directorySearch]);

  const INSTRUCTORS_PER_PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(filteredInstructors.length / INSTRUCTORS_PER_PAGE));
  const previewInstructors = filteredInstructors.slice(
    (instructorPage - 1) * INSTRUCTORS_PER_PAGE,
    instructorPage * INSTRUCTORS_PER_PAGE
  );
  
  const isDirectoryFiltered = directorySearch.trim().length > 0 || directoryField !== '전체';

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

      {role === 'GUEST' ? (
        <>
          <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#f9fdf9_0%,#f2f8f4_58%,#ecf5f0_100%)] px-4 pb-16 pt-16 md:pb-20 md:pt-20">
            <div className="absolute left-1/2 top-12 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-100/70 blur-3xl" />
            <div className="absolute -left-16 bottom-10 h-56 w-56 rounded-full bg-[#d7efe3] blur-3xl" />
            <div className="absolute -right-10 top-20 h-64 w-64 rounded-full bg-[#e2f4eb] blur-3xl" />

            <div className="relative mx-auto max-w-5xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-emerald-700">{heroCopy.badge}</p>
              <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-emerald-100 bg-white/90 px-5 py-3 shadow-sm shadow-emerald-100/60">
                <div className="flex -space-x-3">
                  {previewInstructors.slice(0, 5).map((instructor, i) => (
                    <div key={i} className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-emerald-100 shadow-sm transition-transform hover:scale-110">
                      <img
                        src={instructor.profilePhoto}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(instructor.name || '')}&background=10b981&color=fff&size=80`;
                        }}
                      />
                    </div>
                  ))}
                </div>
                <span className="text-sm font-bold tracking-tight text-emerald-950 md:text-base">
                  {instructors.length}+명의 지역 강사가 함께합니다
                </span>
              </div>
              <h1 className="mx-auto mt-10 max-w-4xl whitespace-pre-line text-4xl font-black leading-tight tracking-tight text-emerald-950 break-keep md:text-5xl md:leading-[1.15]">
                {heroCopy.title}
              </h1>
              <p className="mx-auto mt-6 max-w-4xl text-base leading-8 text-gray-700 md:text-xl">
                {heroCopy.description}
              </p>
              <p className="mx-auto mt-4 max-w-4xl text-sm leading-7 text-gray-600 md:text-lg">
                {heroCopy.secondary}
              </p>
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href={heroCopy.primaryHref} className="rounded-2xl bg-emerald-700 px-7 py-3.5 text-center font-bold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-800">
                  {heroCopy.primaryLabel}
                </Link>
                <Link href={heroCopy.secondaryHref} className="rounded-2xl border border-emerald-200 bg-white px-7 py-3.5 text-center font-semibold text-emerald-800 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50">
                  {heroCopy.secondaryLabel}
                </Link>
              </div>
            </div>

            <div className="relative mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-3">
              {guestHighlights.map((item) => (
                <article key={item.title} className="rounded-[30px] border border-emerald-100 bg-white/85 p-8 text-left shadow-[0_20px_50px_rgba(5,95,70,0.08)] backdrop-blur">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eff8f3] text-3xl shadow-inner shadow-emerald-50">
                    {item.icon}
                  </div>
                  <h2 className="mt-6 text-2xl font-black text-emerald-950">{item.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-gray-600 md:text-base">{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-12">
            <div className="rounded-[36px] border border-emerald-100 bg-white p-8 shadow-[0_24px_60px_rgba(16,185,129,0.08)] md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Iumteo Guide</p>
                  <h2 className="mt-3 text-3xl font-black text-gray-900">이음터 안내</h2>
                  <p className="mt-3 text-sm leading-7 text-gray-600 md:text-base">
                    양양 이음터는 지역 전문가와 기관, 주민이 안심하고 연결될 수 있도록 센터 확인을 거친 운영 원칙을 안내합니다.
                  </p>

                  <div className="mt-7 space-y-4">
                    {guestGuideItems.map((item) => (
                      <div key={item.title} className="rounded-3xl bg-[#f7fbf8] px-5 py-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                            {item.icon}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-gray-600">{item.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                    <span className="font-bold">인증 마크 제도(준비 중)</span> 추후 행정 서류 제출을 통한 센터 인증 마크 제도가 도입될 예정입니다.
                  </div>
                </div>

                <div className="rounded-[32px] bg-[linear-gradient(180deg,#f4fbf7_0%,#eef7f2_100%)] p-6 md:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Connection Flow</p>
                  <h3 className="mt-3 text-2xl font-black text-gray-900">기관 의뢰부터 연결 완료까지</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    기관 문의가 접수되면 센터가 내용을 확인하고, 적합한 강사님께 의사를 타진한 뒤 연결을 진행합니다.
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {guestJourney.map((item, index) => (
                      <div key={item.label} className="rounded-3xl border border-white/70 bg-white/80 px-5 py-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                            {item.icon}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-600">0{index + 1}</span>
                        </div>
                        <p className="mt-4 text-base font-bold text-gray-900">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#0f766e_0%,#065f46_50%,#022c22_100%)] px-4 py-16 text-white md:py-24">
          <div className="absolute -right-16 top-0 h-72 w-72 rounded-full bg-white/5" />
          <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-white/5" />

          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-100">
                {heroCopy.badge}
              </div>
              <h1 className="mt-6 whitespace-pre-line text-4xl font-black leading-tight tracking-tight break-keep md:text-6xl md:leading-[1.1] lg:text-6xl">
                {heroCopy.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-emerald-100 md:text-lg">
                {heroCopy.description}
              </p>

              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-4">
                  {previewInstructors.slice(0, 5).map((instructor, i) => (
                    <div key={i} className="h-14 w-14 overflow-hidden rounded-full border-4 border-emerald-900/20 bg-emerald-800 shadow-xl transition-transform hover:z-10 hover:scale-110">
                      <img
                        src={instructor.profilePhoto}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(instructor.name || '')}&background=10b981&color=fff&size=80`;
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-left text-white/90">
                  <p className="text-lg font-black">{instructors.length}+명</p>
                  <p className="text-xs font-medium text-emerald-100">함께하는 지역 강사</p>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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
      )}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Quick Access</p>
          <h2 className="mt-2 text-2xl font-black text-gray-900">자주 쓰는 메뉴를 한곳에 모았습니다</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((item) => (
            <QuickCard key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Instructor Directory</p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">양양 강사 정보</h2>
            </div>
            <Link href="/instructors" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
              전체 보기 →
            </Link>
          </div>

          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-800">
            <span className="shrink-0 text-emerald-500">📋</span>
            <p>카드를 눌러 상세 약력을 확인할 수 있습니다. 상단 카테고리를 눌러 분야별로 필터링해 보세요.</p>
          </div>

          <p className="mb-5 text-sm leading-7 text-gray-600">
            우리 지역 활동가부터 분야별 전문 강사까지, 최적의 파트너를 검색해보세요.
          </p>

          <div className="mb-5 max-w-xl">
            <label className="relative block">
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg text-emerald-500">🔎</span>
              <input
                type="text"
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="강사명, 분야, 소속 검색..."
                className="w-full rounded-full border border-emerald-100 bg-white py-4 pl-14 pr-5 text-sm shadow-[0_10px_30px_rgba(16,185,129,0.08)] outline-none transition placeholder:text-gray-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {fieldChips.map((topic, index) => (
              <button
                type="button"
                key={topic}
                onClick={() => setDirectoryField(topic)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${directoryField === topic
                  ? 'border-emerald-600 bg-emerald-700 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
              >
                {topic}
              </button>
            ))}
          </div>

          <div className="mb-8 flex items-center justify-between gap-4 text-sm">
            <p className="text-gray-500">
              {isDirectoryFiltered ? (
                <>
                  검색 결과 <span className="font-bold text-gray-900">{filteredInstructors.length}명</span>
                </>
              ) : (
                <>
                  등록 강사 <span className="font-bold text-gray-900">{instructors.length}명</span> 중 미리보기
                </>
              )}
            </p>
            {isDirectoryFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setDirectorySearch('');
                  setDirectoryField('전체');
                }}
                className="rounded-full border border-gray-200 px-4 py-2 font-medium text-gray-600 hover:border-emerald-200 hover:text-emerald-700"
              >
                필터 초기화
              </button>
            ) : null}
          </div>

          {previewInstructors.length > 0 ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {previewInstructors.map((instructor, index) => (
                  <InstructorCard key={instructor.id || `${instructor.name}-${index}`} instructor={instructor} />
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInstructorPage(p => Math.max(1, p - 1))}
                    disabled={instructorPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setInstructorPage(p)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                        instructorPage === p
                          ? 'border-emerald-600 bg-emerald-700 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setInstructorPage(p => Math.min(totalPages, p + 1))}
                    disabled={instructorPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-500">
              조건에 맞는 강사를 찾지 못했습니다. 검색어나 카테고리를 다시 조정해보세요.
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
