'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

// Fallback CSV Parsing function for Client side
function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
            row.push(field); field = "";
        } else if ((c === "\n" || c === "\r") && !inQuotes) {
            if (field !== "" || row.length > 0) { row.push(field); rows.push(row); row = []; field = ""; }
        } else {
            field += c;
        }
    }
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

export default function TeacherDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const teacherId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
    const teacherName = decodeURIComponent(teacherId);

    const [teacher, setTeacher] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inquiryForm, setInquiryForm] = useState({
        inquirerName: '',
        inquirerPhone: '',
        inquirerEmail: '',
        purpose: '',
        message: '',
    });
    const [inquirySubmitting, setInquirySubmitting] = useState(false);
    const [inquiryMessage, setInquiryMessage] = useState<string | null>(null);
    const [inquiryError, setInquiryError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTeacherData() {
            try {
                const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf/pub?gid=0&single=true&output=csv";
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch teacher data");

                const text = await res.text();
                const rows = parseCSV(text);

                const headers = rows[0].map(h => (h || "").toString().trim().replace(/\s+/g, ""));

                let found = null;
                for (let i = 1; i < rows.length; i++) {
                    const nameIdx1 = headers.findIndex(h => h.includes("성명"));
                    const nameIdx2 = headers.findIndex(h => h.includes("대표자"));
                    const name1 = nameIdx1 >= 0 ? (rows[i][nameIdx1] || "").trim() : "";
                    const name2 = nameIdx2 >= 0 ? (rows[i][nameIdx2] || "").trim() : "";

                    if (name1 === teacherName || name2 === teacherName) {
                        found = rows[i];
                        break;
                    }
                }

                if (!found) {
                    setError("해당 강사 정보를 찾을 수 없습니다.");
                    setLoading(false);
                    return;
                }

                const getCol = (possibleNames: string[]) => {
                    const idx = headers.findIndex(h => possibleNames.some(pn => h.includes(pn)));
                    return idx >= 0 ? (found[idx] || "").trim() : '';
                };

                const tData = {
                    name: getCol(['성명']) || teacherName,
                    org: getCol(['소속', '단체', '농장']),
                    role: getCol(['직위', '직함', '역할']),
                    field: getCol(['분야', '영역']),
                    target: getCol(['대상']),
                    history: getCol(['주요이력', '경력', '활동내역', '자격']),
                    desc: getCol(['강의주제', '내용', '소개', '프로그램']),
                    insta: getCol(['인스타그램', 'SNS']),
                    instaPublic: getCol(['공개', '인스타공개여부'])
                };

                setTeacher(tData);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError("데이터를 불러오는데 실패했습니다.");
                setLoading(false);
            }
        }

        if (teacherName) {
            fetchTeacherData();
        }
    }, [teacherName]);

    useEffect(() => {
        async function prefillInquiryForm() {
            if (!session?.user || (session.user.role !== 'USER' && session.user.role !== 'ADMIN')) {
                return;
            }

            setInquiryForm((prev) => ({
                ...prev,
                inquirerName: prev.inquirerName || session.user.name || '',
                inquirerEmail: prev.inquirerEmail || session.user.email || '',
            }));

            try {
                const response = await fetch('/api/account/profile', { cache: 'no-store' });
                const result = await response.json();
                if (!response.ok || !result.success || !result.data) return;

                setInquiryForm((prev) => ({
                    ...prev,
                    inquirerName: prev.inquirerName || result.data['이용자명'] || result.data['Name'] || '',
                    inquirerPhone: prev.inquirerPhone || result.data['연락처'] || result.data['Phone'] || '',
                    inquirerEmail: prev.inquirerEmail || result.data['이메일'] || result.data['Email'] || '',
                }));
            } catch (err) {
                console.warn(err);
            }
        }

        void prefillInquiryForm();
    }, [session]);

    const handleInquirySubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setInquiryError(null);
        setInquiryMessage(null);

        if (!session?.user) {
            setInquiryError('문의하기는 로그인 후 이용할 수 있습니다.');
            return;
        }

        if (session.user.role !== 'USER' && session.user.role !== 'ADMIN') {
            setInquiryError('일반회원 또는 관리자 계정으로 문의를 접수할 수 있습니다.');
            return;
        }

        if (!inquiryForm.inquirerName || !inquiryForm.inquirerPhone || !inquiryForm.inquirerEmail || !inquiryForm.purpose) {
            setInquiryError('이름, 연락처, 이메일, 문의 목적을 입력해 주세요.');
            return;
        }

        setInquirySubmitting(true);

        try {
            const response = await fetch('/api/inquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherName: teacher?.name || teacherName,
                    inquirerName: inquiryForm.inquirerName,
                    inquirerPhone: inquiryForm.inquirerPhone,
                    inquirerEmail: inquiryForm.inquirerEmail,
                    purpose: inquiryForm.purpose,
                    message: inquiryForm.message,
                }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || '문의 접수에 실패했습니다.');
            }

            setInquiryMessage('문의가 접수되었습니다. 센터 확인 후 강사에게 전달됩니다.');
            setInquiryForm((prev) => ({
                ...prev,
                purpose: '',
                message: '',
            }));
        } catch (err) {
            setInquiryError(err instanceof Error ? err.message : '문의 접수에 실패했습니다.');
        } finally {
            setInquirySubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-emerald-700 justify-center flex mx-auto rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 text-sm">강사 정보를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (error || !teacher) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">접근 오류</h2>
                    <p className="text-red-500 text-sm mb-6">{error || '잘못된 접근입니다.'}</p>
                    <button onClick={() => router.push('/#teachers')} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-semibold transition-colors">
                        ← 강사 목록으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    const roleText = `${teacher.org} ${teacher.role}`.trim() || '지역 활동가';
    const isInstaPublic = teacher.insta && /공개|동의|예|yes|y/i.test(teacher.instaPublic || "");
    const fields = teacher.field ? teacher.field.split(/[,·/]+/).map((s: string) => s.trim()).filter(Boolean) : [];
    const histories = teacher.history ? teacher.history.split('\n').filter((s: string) => s.trim()) : [];

    return (
        <main className="min-h-screen bg-[#f6fbf8]">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-emerald-700 to-emerald-900 py-16 text-white text-center md:text-left">
                <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                    <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=random&color=fff&size=200`}
                        alt="강사 프로필"
                        className="w-40 h-40 md:w-48 md:h-48 rounded-full border-4 border-white/30 object-cover shadow-lg"
                    />
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">{teacher.name}</h1>
                        <div className="text-emerald-200 text-lg mb-4">{roleText}</div>
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                            {teacher.target && (
                                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">대상: {teacher.target}</span>
                            )}
                            {isInstaPublic && (
                                <a href={teacher.insta.startsWith('@') ? `https://www.instagram.com/${teacher.insta.substring(1)}/` : teacher.insta} target="_blank" rel="noopener noreferrer" className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center hover:bg-purple-200 transition-colors">
                                    📱 Instagram
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <section className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1 w-full space-y-8">
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-emerald-800 mb-4 pb-3 border-b border-gray-100">주요 강의 및 활동 계획</h3>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{teacher.desc || '등록된 상세 강의 내용이 없습니다.'}</p>
                    </div>

                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-emerald-800 mb-4 pb-3 border-b border-gray-100">주요 업력 및 자격사항</h3>
                        <ul className="space-y-3">
                            {histories.length > 0 ? (
                                histories.map((h: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-gray-700 relative pl-4 before:content-[''] before:absolute before:w-1.5 before:h-1.5 before:bg-emerald-600 before:rounded-full before:left-0 before:top-2.5">
                                        {h}
                                    </li>
                                ))
                            ) : (
                                <li className="text-gray-500 italic">등록된 이력이 없습니다.</li>
                            )}
                        </ul>
                    </div>

                    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-gray-600 flex items-center gap-2 mb-2">🛡️ 강사 정보 보호 및 안내</h3>
                        <p className="text-xs text-gray-500 leading-relaxed break-keep">
                            본 페이지의 정보는 양양군 농촌활성화지원센터 강사 이음터 운영 및 마을 교육 연계를 목적으로만 제공됩니다.
                            강사님의 개인식별정보(연락처 등)는 정보 보호 정책에 따라 비공개 처리되며, 강의 섭외 및 관련 문의는 센터를 통해 진행해 주시기 바랍니다.
                        </p>
                    </div>

                    <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-emerald-800">강사 문의하기</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    일반회원으로 로그인하면 이 강사에게 매칭 문의를 접수할 수 있습니다. 문의는 센터 확인 후 강사에게 전달됩니다.
                                </p>
                            </div>
                            {!session?.user && (
                                <button
                                    type="button"
                                    onClick={() => signIn(undefined, { callbackUrl: `/teacher/${encodeURIComponent(teacherId)}` })}
                                    className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                                >
                                    로그인 후 문의하기
                                </button>
                            )}
                        </div>

                        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleInquirySubmit}>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">문의 대상 강사</label>
                                <input value={teacher?.name || teacherName} readOnly className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">신청인 성명</label>
                                <input
                                    value={inquiryForm.inquirerName}
                                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, inquirerName: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                                    placeholder="이름을 입력해 주세요"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
                                <input
                                    value={inquiryForm.inquirerPhone}
                                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, inquirerPhone: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                                    placeholder="연락 가능한 번호"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">회신 받을 이메일</label>
                                <input
                                    value={inquiryForm.inquirerEmail}
                                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, inquirerEmail: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                                    placeholder="센터 회신을 받을 이메일"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">문의 목적</label>
                                <input
                                    value={inquiryForm.purpose}
                                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, purpose: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                                    placeholder="예: 마을 프로그램 협업 제안"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">상세 내용</label>
                                <textarea
                                    rows={5}
                                    value={inquiryForm.message}
                                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, message: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                                    placeholder="필요한 프로그램, 일정, 대상, 지역 등 상세 요청을 적어 주세요"
                                />
                            </div>

                            {(inquiryError || inquiryMessage) && (
                                <div className={`md:col-span-2 rounded-xl px-4 py-3 text-sm ${inquiryError ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                    {inquiryError || inquiryMessage}
                                </div>
                            )}

                            <div className="md:col-span-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <p className="text-xs leading-5 text-gray-500">
                                    문의 내용은 센터에서 먼저 검토한 뒤 강사에게 전달되며, 회신도 센터를 통해 전달됩니다.
                                </p>
                                <button
                                    type="submit"
                                    disabled={inquirySubmitting || sessionStatus === 'loading'}
                                    className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                                >
                                    {inquirySubmitting ? '문의 접수 중...' : '문의 접수'}
                                </button>
                            </div>
                        </form>
                    </section>

                    <button onClick={() => router.push('/#teachers')} className="inline-block mt-4 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-semibold transition-colors shadow-sm">
                        ← 강사 목록으로 돌아가기
                    </button>
                </div>

                {/* Right Sidebar */}
                <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">전문 분야</h3>
                        <div className="flex flex-wrap gap-2">
                            {fields.length > 0 ? (
                                fields.map((f: string, i: number) => (
                                    <span key={i} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-sm font-semibold border border-emerald-100">
                                        #{f}
                                    </span>
                                ))
                            ) : (
                                <span className="text-gray-500 text-sm">지정된 분야 없음</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">연락처 정보</h3>
                        <ul className="text-sm space-y-4">
                            <li className="flex items-start gap-2 text-gray-600 bg-gray-50 p-3 rounded-lg">
                                <span>🔒</span>
                                <span>연락처는 정보 보호를 위해 비공개 처리됩니다.</span>
                            </li>
                            <li className="text-gray-600 mt-4 leading-relaxed">
                                <strong>강의 섭외 문의:</strong><br />
                                양양군 농촌활성화지원센터<br />
                                <a href="tel:033-673-0221" className="text-emerald-700 hover:underline font-semibold mt-1 inline-block">📞 033-673-0221</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </main>
    );
}
