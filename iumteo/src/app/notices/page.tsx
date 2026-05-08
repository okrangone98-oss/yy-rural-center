'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getAppPath } from '@/lib/app-url';

type NoticeTag = '공지' | '안내' | '중요';

type NoticeItem = {
  id: string;
  tag: NoticeTag;
  title: string;
  body: string;
  date: string;
  createdAt: number;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
};

function NoticeBadge({ tag }: { tag: NoticeTag }) {
  const styles: Record<NoticeTag, string> = {
    중요: 'border-red-100 bg-red-50 text-red-700',
    안내: 'border-sky-100 bg-sky-50 text-sky-700',
    공지: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles[tag]}`}>{tag}</span>;
}

export default function NoticesPage() {
  const { data: session } = useSession();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [form, setForm] = useState({ tag: '공지' as NoticeTag, title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';

  // 파일 업로드 상태
  const posterInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ url: string } | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string } | null>(null);

  async function handleUpload(file: File, type: 'poster' | 'file') {
    const setter = type === 'poster' ? setUploadingPoster : setUploadingFile;
    setter(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(getAppPath('/api/admin/notices/upload'), { method: 'POST', body: fd });
      const json = (await res.json()) as { ok: boolean; url?: string; fileName?: string; error?: string };
      if (!json.ok || !json.url) throw new Error(json.error || '업로드 실패');
      if (type === 'poster') {
        setAttachedImage({ url: json.url });
      } else {
        setAttachedFile({ url: json.url, name: json.fileName || file.name });
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setter(false);
    }
  }

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getAppPath('/api/admin/notices'), { cache: 'no-store' });
      const json = await response.json();

      if (!response.ok || !Array.isArray(json.notices)) {
        throw new Error(json.error || '공지사항을 불러오지 못했습니다.');
      }

      setDegraded(json.degraded === true);
      setNotices(json.notices);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '공지사항을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotices();
  }, [fetchNotices]);

  async function handleCreate() {
    if (!form.title.trim() || !form.body.trim()) {
      setMessage('제목과 내용을 모두 입력해 주세요.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(getAppPath('/api/admin/notices'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: form.tag,
          title: form.title.trim(),
          body: form.body.trim(),
          imageUrl: attachedImage?.url || '',
          fileUrl: attachedFile?.url || '',
          fileName: attachedFile?.name || '',
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || '공지사항 등록에 실패했습니다.');
      }

      setForm({ tag: '공지', title: '', body: '' });
      setAttachedImage(null);
      setAttachedFile(null);
      setMessage('공지사항이 등록되었습니다.');
      await fetchNotices();
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : '공지사항 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 공지사항을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(getAppPath('/api/admin/notices'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || '공지사항 삭제에 실패했습니다.');
      }

      await fetchNotices();
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : '공지사항 삭제에 실패했습니다.');
    }
  }

  const pinnedNotices = useMemo(() => notices.filter((notice) => notice.tag === '중요').slice(0, 1), [notices]);
  const regularNotices = useMemo(() => notices.filter((notice) => notice.tag !== '중요'), [notices]);

  return (
    <div className="min-h-screen bg-[#f7fbf8]">
      <header className="border-b border-emerald-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white">이</div>
            <div>
              <p className="font-black text-gray-900">양양 강사 이음터</p>
              <p className="text-xs text-gray-500">센터 소식과 지역 안내</p>
            </div>
          </Link>
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
            홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Community Board</p>
            <h1 className="mt-2 text-3xl font-black text-gray-900">공지사항</h1>
            <p className="mt-3 text-sm leading-7 text-gray-500">
              이음터의 커뮤니티 영역은 센터 공지와 지역 안내를 중심으로 운영합니다. 프로그램 소식, 이용 안내, 문의 관련 공지를 이곳에서 확인할 수 있습니다.
            </p>
          </div>
          <div className="rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f0faf5_0%,#ffffff_100%)] p-6 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">운영 원칙</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
              <li>강사님과 기관, 지역 주민에게 필요한 공지를 먼저 제공합니다.</li>
              <li>상업적 홍보보다 지역 협력과 운영 안내를 우선합니다.</li>
              <li>문의와 채팅 흐름에 영향을 주는 변경 사항은 이곳에서 가장 먼저 안내합니다.</li>
            </ul>
          </div>
        </div>

        {isAdmin ? (
          <section className="mb-8 rounded-[32px] border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">관리자 공지 등록</h2>
            {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {(['공지', '안내', '중요'] as NoticeTag[]).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tag }))}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    form.tag === tag ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="공지 제목"
              className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
            <textarea
              rows={4}
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              placeholder="공지 내용"
              className="mt-3 w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm leading-7 focus:border-emerald-400 focus:outline-none"
            />
            {/* 포스터 이미지 업로드 */}
            <div className="mt-4">
              <input
                ref={posterInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, 'poster'); e.target.value = ''; }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => posterInputRef.current?.click()}
                  disabled={uploadingPoster}
                  className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  🖼️ {uploadingPoster ? '업로드 중...' : '포스터 이미지 첨부'}
                </button>
                {attachedImage && (
                  <div className="flex items-center gap-2">
                    <img src={attachedImage.url} alt="포스터 미리보기" className="h-16 rounded-xl object-cover shadow" />
                    <button type="button" onClick={() => setAttachedImage(null)} className="text-xs text-red-500 hover:underline">제거</button>
                  </div>
                )}
              </div>
            </div>

            {/* 첨부파일 (HWP/Word/PDF) 업로드 */}
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".hwp,.doc,.docx,.pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, 'file'); e.target.value = ''; }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                >
                  📎 {uploadingFile ? '업로드 중...' : '파일 첨부 (HWP · DOCX · PDF)'}
                </button>
                {attachedFile && (
                  <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm">
                    <span className="font-medium text-sky-700">{attachedFile.name}</span>
                    <button type="button" onClick={() => setAttachedFile(null)} className="text-xs text-red-500 hover:underline">제거</button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? '등록 중...' : '공지 등록'}
              </button>
            </div>
          </section>
        ) : null}

        {degraded ? (
          <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
            공지 기능의 저장 설정이 아직 완료되지 않아 현재는 비어 있는 목록으로 보일 수 있습니다. Firebase 설정 후 관리자 공지 등록이 활성화됩니다.
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-700" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-8 text-sm text-red-700">{error}</div>
        ) : (
          <div className="space-y-8">
            {pinnedNotices.length > 0 ? (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-black text-gray-900">먼저 확인할 공지</h2>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Pinned</span>
                </div>
                <div className="space-y-4">
                  {pinnedNotices.map((notice) => (
                    <article key={notice.id} className="rounded-[32px] border border-red-100 bg-[#fff7f6] p-6 shadow-sm">
                      {notice.imageUrl ? (
                        <img
                          src={notice.imageUrl}
                          alt="공지 포스터"
                          className="mb-5 w-full rounded-2xl object-contain shadow-sm"
                        />
                      ) : null}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <NoticeBadge tag={notice.tag} />
                            <span className="text-xs text-gray-400">{notice.date}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-black text-gray-900">{notice.title}</h3>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">{notice.body}</p>
                          {notice.fileUrl ? (
                            <a
                              href={notice.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              {notice.fileName || '첨부파일 다운로드'}
                            </a>
                          ) : null}
                        </div>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(notice.id)}
                            className="rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {regularNotices.length > 0 ? (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-black text-gray-900">센터 소식</h2>
                  <span className="text-xs text-gray-400">{regularNotices.length}건</span>
                </div>
                <div className="space-y-4">
                  {regularNotices.map((notice) => (
                    <article key={notice.id} className="rounded-[32px] border border-white bg-white p-6 shadow-sm">
                      {notice.imageUrl ? (
                        <img
                          src={notice.imageUrl}
                          alt="공지 포스터"
                          className="mb-5 w-full rounded-2xl object-contain shadow-sm"
                        />
                      ) : null}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <NoticeBadge tag={notice.tag} />
                            <span className="text-xs text-gray-400">{notice.date}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-black text-gray-900">{notice.title}</h3>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">{notice.body}</p>
                          {notice.fileUrl ? (
                            <a
                              href={notice.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              {notice.fileName || '첨부파일 다운로드'}
                            </a>
                          ) : null}
                        </div>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(notice.id)}
                            className="rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {notices.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
                <p className="text-4xl">📢</p>
                <p className="mt-4 text-lg font-bold text-gray-900">등록된 공지사항이 없습니다</p>
                <p className="mt-2 text-sm text-gray-500">센터 소식이 등록되면 이곳에서 바로 확인할 수 있습니다.</p>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
