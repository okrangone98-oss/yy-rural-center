'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAppPath } from '@/lib/app-url';

type UserType = 'user' | 'teacher' | 'visitor' | null;
type AccTab = 'teacher' | 'user';

const AVATAR: Record<NonNullable<UserType>, string> = {
  user: '😄',
  teacher: '🎉',
  visitor: '👋',
};

const BUBBLE: Record<NonNullable<UserType>, string> = {
  user: '강사님을 찾고 계시군요! 아래 단계별 가이드를 따라가 보세요 👇',
  teacher: '멋진 강사님이시네요! 이음터에서 새로운 인연을 만들어 보세요 👇',
  visitor: '센터 소식이 궁금하시군요! 아래에서 관련 안내를 확인해 보세요 👇',
};

const USER_STEPS = [
  { num: 1, title: '강사 추천 요청 또는 직접 검색', desc: "홈페이지 '강사 이음터' 탭에서 분야별로 강사를 탐색하거나, 센터에 필요한 강사 유형을 문의해 주세요.", badge: '센터 추천 또는 자율 검색 모두 가능' },
  { num: 2, title: '활동 문의 전송', desc: "마음에 드는 강사의 프로필 페이지에서 '문의하기' 버튼을 눌러 활동 일시, 내용, 대상 등의 정보를 센터로 보내주세요.", badge: '강사 연락처는 센터가 관리 · 블라인드 처리' },
  { num: 3, title: '센터 검토 및 확인', desc: '이음터 담당자가 문의 내용을 확인하고 해당 강사의 일정 및 조건을 검토합니다.', badge: '영업일 기준 1~2일 내 회신' },
  { num: 4, title: '강사 연결 및 최종 확정', desc: '강사가 수락하면 센터를 통해 안전하게 연락처가 전달됩니다. 이후 강사와 직접 세부 일정을 협의하세요.', badge: '매칭 확정 후 연락처 전달' },
];

const TEACHER_STEPS = [
  { num: 1, title: '이음터 회원가입 및 프로필 등록', desc: "상단 '강사 등록' 버튼을 클릭하여 이름, 활동 분야, 자기소개, 사진, 연락처를 입력합니다.", badge: '온라인 등록 약 5분 소요' },
  { num: 2, title: '센터 검토 및 승인', desc: '제출 후 영업일 기준 2~3일 내에 검토가 완료됩니다. 보완 사항이 있으면 개별 연락드립니다.', badge: '승인 완료 시 목록에 프로필 공개' },
  { num: 3, title: '문의 수신 및 검토', desc: '이용자 문의가 접수되면 센터 담당자가 먼저 내용을 검토한 뒤 강사님께 개별 연락합니다.', badge: '강제 매칭 없음 · 거절 자유' },
  { num: 4, title: '수락 시 연결 진행', desc: '수락하시면 센터를 통해 이용자에게 연락처가 전달되고 직접 세부 일정을 협의하시면 됩니다.', badge: '수수료 0원' },
];

const VISITOR_STEPS = [
  { num: 1, title: '센터 소식 확인', desc: '홈페이지 공지사항 또는 SNS 채널에서 최신 사업 및 행사 정보를 확인하세요.', badge: '공지사항 탭 참고' },
  { num: 2, title: '프로그램 신청', desc: '관심 있는 프로그램이 있으면 센터로 직접 문의하거나 신청 폼을 이용하세요.', badge: '전화 또는 이메일 문의 가능' },
];

const STEP_MAP: Record<NonNullable<UserType>, typeof USER_STEPS> = {
  user: USER_STEPS,
  teacher: TEACHER_STEPS,
  visitor: VISITOR_STEPS,
};

const TEACHER_ACCORDION = [
  { icon: '📝', title: '프로필 등록 방법', sub: '어떤 정보를 입력해야 하나요?', body: '등록 폼에서 아래 항목을 작성합니다:\n• 이름, 활동 분야(최대 3개 선택)\n• 한 줄 소개 + 상세 자기소개\n• 활동 가능 지역 (양양 내 동/면 등)\n• 프로필 사진 업로드 (권장 1:1 비율)\n• 연락처 (비공개 · 센터만 확인 가능)' },
  { icon: '✅', title: '센터 승인 절차', sub: '승인까지 얼마나 걸리나요?', body: '제출 후 영업일 기준 2~3일 내에 담당자가 검토합니다. 보완이 필요한 경우 입력하신 연락처로 개별 안내드립니다. 승인 완료 시 홈페이지 강사 목록에 프로필이 공개됩니다.' },
  { icon: '🔒', title: '강사 정보 보호 정책', sub: '연락처가 외부에 노출되나요?', body: '아니요, 절대 공개되지 않습니다.\n\n강사님의 연락처(전화번호, 이메일)는 이음터 시스템 내에서 블라인드 처리되며, 이용자에게는 표시되지 않습니다. 매칭이 확정된 경우에만 센터를 통해 안전하게 전달됩니다.' },
  { icon: '💬', title: '문의 접수 및 처리', sub: '문의가 오면 어떻게 되나요?', body: '이용자가 문의를 보내면 센터 담당자가 먼저 내용을 검토합니다. 이후 강사님께 개별 연락하여 수락 여부를 확인합니다. 원하지 않는 문의는 거절하실 수 있으며, 강제로 연결되는 경우는 없습니다.' },
  { icon: '💰', title: '수수료 및 비용', sub: '이음터 이용에 비용이 드나요?', body: '이음터 서비스 자체는 완전히 무료입니다. 강사 등록, 프로필 관리, 문의 수신 모두 수수료가 없습니다. 강의 활동비는 강사와 기관이 별도 협의하시면 됩니다.' },
];

const USER_ACCORDION = [
  { icon: '🔍', title: '강사 탐색 방법', sub: '원하는 강사를 어떻게 찾나요?', body: "홈페이지 '강사 이음터' 탭에서 분야(농촌, 공예, 요리 등)별로 강사를 필터링할 수 있습니다. 직접 검색이 어려우시면 센터로 문의하시면 담당자가 추천해 드립니다." },
  { icon: '📨', title: '문의 전송 방법', sub: '강사에게 어떻게 문의하나요?', body: "강사 프로필 페이지 하단의 '문의하기' 버튼을 클릭하면 문의 폼이 열립니다. 활동 일시, 장소, 대상, 목적 등을 입력하여 센터로 전송하세요." },
  { icon: '⏱️', title: '처리 소요 시간', sub: '연결까지 얼마나 걸리나요?', body: '문의 접수 후 영업일 기준 1~2일 내 담당자 검토 → 강사 확인 → 연락처 전달 순으로 진행됩니다. 전체 소요 시간은 3~5일 정도이며, 급한 경우 전화(033-673-0221)로 문의하시면 더 빠르게 처리됩니다.' },
  { icon: '🔒', title: '강사 직접 연락 불가 안내', sub: '강사에게 직접 연락하면 안 되나요?', body: '이음터 강사의 연락처는 플랫폼에 공개되지 않습니다. 강사의 개인정보 보호를 위해 반드시 이음터(센터)를 통해 문의해 주세요.' },
];

const FAQS = [
  { tag: '강사', q: '강사로 등록하려면 어떻게 하나요?', a: "상단 메뉴의 '강사 이음터 → 강사 정보 등록'을 클릭하면 등록 폼으로 이동합니다. 이름, 활동 분야, 소개, 사진, 연락처 등을 입력하고 제출하면 센터 검토 후 목록에 게시됩니다. 등록은 온라인으로만 가능하며 약 5분 소요됩니다." },
  { tag: '강사', q: '등록한 내 연락처가 외부에 노출되나요?', a: '아니요, 절대 공개되지 않습니다. 강사의 연락처는 이음터 내에서 블라인드 처리됩니다. 매칭이 확정된 경우에만 센터를 통해 안전하게 전달됩니다.' },
  { tag: '강사', q: '강사 등록 후 승인까지 얼마나 걸리나요?', a: '제출 후 영업일 기준 2~3일 내에 검토가 완료됩니다. 보완이 필요한 경우 입력하신 연락처로 개별 연락드립니다. 승인 완료 즉시 홈페이지 강사 목록에 프로필이 노출됩니다.' },
  { tag: '이용자', q: '원하는 강사를 찾지 못했을 때 어떻게 하나요?', a: '센터로 직접 문의해 주세요. 담당자가 필요하신 분야와 조건에 맞는 강사를 추천해 드립니다.\n전화: 033-673-0221 / 이메일: yyfarmct@naver.com' },
  { tag: '이용자', q: '강사에게 직접 연락하면 안 되나요?', a: '이음터 강사의 연락처는 플랫폼에 공개되지 않습니다. 강사의 개인정보 보호를 위해 반드시 이음터(센터)를 통해 문의해 주세요.' },
  { tag: '공통', q: '이음터 이용에 비용이 드나요?', a: '이음터 서비스 자체는 완전히 무료입니다. 강사 등록, 강사 검색, 문의 전송, 매칭 모두 수수료가 없습니다. 강사 활동비(강의료)는 강사와 기관이 별도로 협의하시면 됩니다.' },
  { tag: '강사', q: '원하지 않는 문의는 거절할 수 있나요?', a: '네, 가능합니다. 이음터는 강사의 의사를 최우선으로 존중합니다. 센터에서 연락드렸을 때 거절 의사를 표시하시면 해당 문의는 처리되지 않습니다. 강제 매칭은 없습니다.' },
  { tag: '이용자', q: '문의 후 연결까지 얼마나 걸리나요?', a: '문의 접수 후 영업일 기준 1~2일 내에 담당자가 검토하고 강사 측에 확인합니다. 강사 수락 후 연락처를 전달하므로 전체 소요 시간은 3~5일 정도입니다. 급한 경우 전화(033-673-0221)로 직접 문의하시면 더 빠르게 처리됩니다.' },
  { tag: '공통', q: '이음터는 어떤 분야의 강사를 연결해 주나요?', a: '양양 지역을 기반으로 활동하는 다양한 분야의 강사를 연결합니다. 농촌체험, 공예, 요리, 건강·웰니스, 예술·문화, 생태·환경 등 지역 특색을 살린 프로그램 강사를 만나보세요.' },
];

const TAG_COLOR: Record<string, string> = {
  강사: 'bg-emerald-50 text-emerald-700',
  이용자: 'bg-sky-50 text-sky-700',
  공통: 'bg-gray-100 text-gray-600',
};

export default function GuidePage() {
  const [userType, setUserType] = useState<UserType>(null);
  const [accTab, setAccTab] = useState<AccTab>('teacher');

  const avatar = userType ? AVATAR[userType] : '👩‍💼';
  const bubble = userType
    ? BUBBLE[userType]
    : '안녕하세요! 저는 이음터 디자인실장 영자예요 😊 아래에서 나의 상황을 선택하면, 딱 맞는 이용 방법을 알려드릴게요!';

  const steps = userType ? STEP_MAP[userType] : null;
  const accordion = accTab === 'teacher' ? TEACHER_ACCORDION : USER_ACCORDION;

  return (
    <main className="min-h-screen bg-[#f0f4f2] pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0b7c5b] via-[#1a9e78] to-[#0f8a66] py-12 px-4 relative overflow-hidden">
        <div className="max-w-3xl mx-auto flex items-center gap-6 relative z-10">
          <div className="text-5xl shrink-0 select-none" aria-hidden="true">{avatar}</div>
          <div>
            <h1 className="text-white font-bold text-2xl leading-snug">
              이음터 100% 활용하기
              <span className="block text-sm font-normal opacity-80 mt-1">양양 강사 이음터 · 사용자 가이드</span>
            </h1>
            <div className="mt-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-4 py-3 text-white text-sm leading-relaxed max-w-xl">
              {bubble}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8 space-y-8">

        {/* STEP 1 */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-emerald-700 mb-1">STEP 1 · 나는 누구일까요?</p>
          <h2 className="text-lg font-bold text-gray-800 mb-4">저의 상황을 선택해 주세요</h2>

          <div className="grid grid-cols-3 gap-3">
            {([
              { type: 'user' as UserType, icon: '🔍', title: '좋은 강사님을\n찾고 있어요!', sub: '이용자 / 기관' },
              { type: 'teacher' as UserType, icon: '🧑‍🏫', title: '멋진 프로그램을\n가진 강사입니다!', sub: '강사' },
              { type: 'visitor' as UserType, icon: '👀', title: '센터 소식이\n궁금해요!', sub: '방문자' },
            ] as const).map(({ type, icon, title, sub }) => (
              <button
                key={type}
                onClick={() => setUserType(type)}
                className={`rounded-xl border-2 p-4 text-center transition-all ${
                  userType === type
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="text-3xl mb-2">{icon}</div>
                <div className="text-xs font-semibold text-gray-800 whitespace-pre-line leading-tight mb-1">{title}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </button>
            ))}
          </div>

          {steps && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex flex-col gap-4">
                {steps.map((step, i) => (
                  <div key={step.num} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">{step.num}</div>
                      {i < steps.length - 1 && <div className="w-px flex-1 bg-emerald-200 my-1" />}
                    </div>
                    <div className="pb-1">
                      <div className="text-sm font-semibold text-gray-800">{step.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{step.desc}</div>
                      <span className="inline-block mt-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">{step.badge}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* STEP 2 */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-emerald-700 mb-1">STEP 2 · 상세 이용 안내</p>
          <h2 className="text-lg font-bold text-gray-800 mb-4">역할별 자세한 프로세스</h2>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setAccTab('teacher')}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${accTab === 'teacher' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'}`}
            >
              🧑‍🏫 강사 모드
            </button>
            <button
              onClick={() => setAccTab('user')}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${accTab === 'user' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'}`}
            >
              🔍 이용자 모드
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {accordion.map((item) => (
              <details key={item.title} className="group border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{item.title}</div>
                    <div className="text-xs text-gray-500">{item.sub}</div>
                  </div>
                  <span className="text-gray-400 text-xs transition-transform group-open:rotate-180 shrink-0">▾</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-sm text-gray-600 leading-relaxed whitespace-pre-line border-t border-gray-50">
                  {item.body}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* 핵심 정책 */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-emerald-700 mb-1">핵심 정책</p>
          <h2 className="text-lg font-bold text-gray-800 mb-4">이음터가 지키는 약속</h2>

          <div className="flex flex-col gap-3">
            {[
              { icon: '🔒', title: '강사 연락처 블라인드 정책', desc: '강사의 전화번호와 이메일은 플랫폼에 공개되지 않습니다. 모든 연결은 이음터 센터를 통해 이루어지며, 매칭 확정 후에만 안전하게 전달됩니다.' },
              { icon: '💰', title: '중개 수수료 0원', desc: '이음터는 공공 플랫폼으로 강사와 이용자 모두에게 어떠한 중개 수수료도 받지 않습니다.' },
              { icon: '🤝', title: '강사 의사 존중', desc: '강사는 모든 문의에 대해 수락·거절을 자유롭게 결정할 수 있습니다. 강제 매칭은 존재하지 않습니다.' },
            ].map((p) => (
              <div key={p.title} className="flex gap-3 border-l-4 border-emerald-600 bg-gray-50 rounded-r-xl p-3">
                <span className="text-xl shrink-0">{p.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-emerald-700">{p.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-emerald-700 mb-1">FAQ</p>
          <h2 className="text-lg font-bold text-gray-800 mb-4">자주 묻는 질문</h2>

          <div className="flex flex-col gap-2">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TAG_COLOR[faq.tag] ?? 'bg-gray-100 text-gray-600'}`}>
                    {faq.tag}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">{faq.q}</span>
                  <span className="text-gray-400 text-xs transition-transform group-open:rotate-180 shrink-0">▾</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-sm text-gray-600 leading-relaxed whitespace-pre-line border-t border-gray-50">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-br from-[#0b7c5b] to-[#1a9e78] rounded-2xl p-6 text-white">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">📞 더 궁금한 것이 있으신가요?</h2>
          <ul className="text-sm space-y-1.5 opacity-90 mb-4">
            <li>📱 전화: 033-673-0221</li>
            <li>✉️ 이메일: yyfarmct@naver.com</li>
            <li>⏰ 운영시간: 월~금 09:00~18:00 (공휴일 제외)</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <a
              href="mailto:yyfarmct@naver.com?subject=[이음터]%20문의합니다"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/20 border border-white/35 text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              ✉️ 이메일 문의
            </a>
            <a
              href="https://litt.ly/yyfarmct"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/20 border border-white/35 text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              🔗 센터 채널 보기
            </a>
            <Link
              href={getAppPath('/instructors')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/20 border border-white/35 text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              👤 강사 목록 보기
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
