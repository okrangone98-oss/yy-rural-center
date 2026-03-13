'use client';

import { useState, useEffect } from "react";
import Link from "next/link";

interface FAQItem {
    q: string;
    a: string;
    c: string;
    s: string;
    o: number;
}

const FAQ_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTO3geLtt5vZ-bOZiY4vb_Rd48xcQGJyZbmjXcHA1ZDnDmFQWAysgxvD-EumgkalVDlmRgdHfzqIVwf/pub?gid=1574025619&single=true&output=csv";

// Helper to parse CSV manually without blowing up client bundles
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

export default function QnAPage() {
    const [faqs, setFaqs] = useState<FAQItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<string>("전체");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadFAQ() {
            try {
                const res = await fetch(FAQ_CSV_URL);
                if (!res.ok) throw new Error("FAQ CSV fetch failed");

                const rows = parseCSV(await res.text());
                if (!rows.length) return;

                const headers = rows[0].map(h => (h || "").toString().trim().replace(/\s+/g, ""));
                const idx = {
                    q: headers.findIndex(h => h.includes("질문") || h.includes("question")),
                    a: headers.findIndex(h => h.includes("답변") || h.includes("answer")),
                    c: headers.findIndex(h => h.includes("카테고리") || h.includes("category")),
                    s: headers.findIndex(h => h.includes("상태") || h.includes("status")),
                    o: headers.findIndex(h => h.includes("순서") || h.includes("order") || h.includes("정렬"))
                };

                const isActive = (val: string) => {
                    const v = (val || "").toString().trim();
                    return v === "" || v === "활성" || v.toLowerCase() === "active";
                };

                const items = rows.slice(1)
                    .map(r => ({
                        q: (r[idx.q] || "").trim(),
                        a: (r[idx.a] || "").trim(),
                        c: (r[idx.c] || "").trim() || "기타",
                        s: (r[idx.s] || "").trim(),
                        o: Number((r[idx.o] || "").toString().trim()) || 9999
                    }))
                    .filter(r => r.q && r.a && isActive(r.s))
                    .sort((a, b) => a.o - b.o);

                setFaqs(items);
                setCategories(Array.from(new Set(items.map(i => i.c))));
                setLoading(false);
            } catch (err: any) {
                console.error(err);
                setError("FAQ 데이터를 불러오지 못했습니다.");
                setLoading(false);
            }
        }

        loadFAQ();
    }, []);

    const filteredFaqs = activeFilter === "전체" ? faqs : faqs.filter(f => f.c === activeFilter);

    return (
        <main className="min-h-screen bg-gray-50 py-10 pb-16">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="bg-white border text-gray-800 border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
                    <h1 className="text-2xl font-bold mb-2">Q&A / 자주 묻는 질문</h1>
                    <p className="text-sm text-gray-500">자주 묻는 질문들을 모았습니다. 아래 FAQ를 먼저 확인해 보세요!</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* FAQ Section */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold mb-3 text-gray-800">자주 묻는 질문</h2>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={() => setActiveFilter("전체")}
                                className={`px-3 py-1 text-sm rounded-full border ${activeFilter === "전체" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                            >
                                전체
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveFilter(cat)}
                                    className={`px-3 py-1 text-sm rounded-full border ${activeFilter === cat ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="text-sm text-gray-500 py-4">FAQ 데이터를 로딩 중입니다...</div>
                        ) : error ? (
                            <div className="text-sm text-red-500 py-4">{error}</div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {filteredFaqs.map((faq, i) => (
                                    <details key={i} className="group border border-gray-100 rounded-xl p-3 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
                                        <summary className="cursor-pointer font-semibold text-gray-800 list-none flex justify-between items-center">
                                            <span>{faq.q}</span>
                                            <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <div className="mt-2 text-xs text-gray-500">카테고리: {faq.c}</div>
                                        <div className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                            {faq.a}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Contact Section */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold mb-3 text-gray-800">일반 문의 안내</h2>
                        <p className="text-sm text-gray-600 mb-3">
                            전화 또는 이메일로 문의하실 수 있습니다.
                        </p>
                        <ul className="text-sm text-gray-700 space-y-2 mb-4 border-t border-b border-gray-100 py-3">
                            <li>• 전화: 033-673-0221</li>
                            <li>• 이메일: yyfarmct@naver.com</li>
                            <li>• 운영시간: 월~금 09:00~18:00 (공휴일 제외)</li>
                        </ul>

                        <a
                            href="mailto:yyfarmct@naver.com?subject=[QnA]%20양양군%20농촌활성화지원센터%20문의"
                            className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-full transition-colors w-full sm:w-auto text-center"
                        >
                            이메일로 문의하기
                        </a>

                        <p className="text-xs text-gray-500 mt-4 mb-2">
                            센터 채널 및 소식은 아래 링크에서 확인하실 수 있습니다.
                        </p>
                        <a
                            href="https://litt.ly/yyfarmct"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-full transition-colors w-full sm:w-auto text-center"
                        >
                            센터 채널 & 소식 모아보기
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}
