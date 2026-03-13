'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  AdminInstructorItem, AdminMemberItem, InquiryItem, MemberFormState, 
  InstructorProfile, SheetBundle, InquiryActionMode, InquiryActionDraft, Role
} from './types';
import { 
  STATUS, findField,
  getInstructorName, getInstructorField, getInstructorOrg, getInstructorArea,
  getInstructorPhone, getInstructorEmail, getInstructorIntro, getInstructorCareer,
  getInstructorAddress, getInstructorInstagram, getInstructorInstagramOpen,
  getInstructorPortfolioLink, getInstructorProfilePhoto, getInstructorUpdatedAt,
  getInstructorStatus, getInstructorFinalStatus,
  getMemberName, getMemberEmail, getMemberPhone, getMemberOrg, getMemberStatus,
  getMemberType, getMemberLastLogin, isLocalInstructor, 
  isMeaningfulRecord
} from './utils';

import { InstructorList } from './components/instructor/InstructorList';
import { InstructorDetail } from './components/instructor/InstructorDetail';
import { MemberManagement } from './components/member/MemberManagement';
import { InquiryManagement } from './components/instructor/InquiryManagement';
import { DataCenter } from './components/shared/DataCenter';

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'member' | 'instructor' | 'admin'>('instructor');
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'inquiry' | 'dashboard'>('profile');
  const [previewRole, setPreviewRole] = useState<Role | null>(null);

  // Global Data
  const [sheetBundle, setSheetBundle] = useState<SheetBundle | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [adminRefreshedAt, setAdminRefreshedAt] = useState<string | null>(null);
  const [mirrorSyncing, setMirrorSyncing] = useState(false);

  // Member State
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberForm, setMemberForm] = useState<MemberFormState | null>(null);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);

  // Instructor State
  const [adminInstructorStatusFilter, setAdminInstructorStatusFilter] = useState<string>('all');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [adminInstructorForm, setAdminInstructorForm] = useState<InstructorProfile | null>(null);
  const [adminInstructorSaving, setAdminInstructorSaving] = useState(false);
  const [adminInstructorMessage, setAdminInstructorMessage] = useState<string | null>(null);
  const [adminInstructorPhotoUploading, setAdminInstructorPhotoUploading] = useState(false);
  const [instructorStatusLoading, setInstructorStatusLoading] = useState<string | null>(null);

  // Inquiry State
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('pending');
  const [inquiryActionTarget, setInquiryActionTarget] = useState<{ inquiryId: string; mode: InquiryActionMode } | null>(null);
  const [forwardDrafts, setForwardDrafts] = useState<Record<string, InquiryActionDraft>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, InquiryActionDraft>>({});
  const [inquiryActionLoadingId, setInquiryActionLoadingId] = useState<string | null>(null);
  const [inquiryActionMessage, setInquiryActionMessage] = useState<string | null>(null);
  const [inquiryStatusLoadingId, setInquiryStatusLoadingId] = useState<string | null>(null);
  const [inquiryGeneralMessage, setInquiryGeneralMessage] = useState<string | null>(null);

  const actualRole = (session?.user?.role || 'GUEST') as Role;

  const fetchAdminSheets = useCallback(async () => {
    if (actualRole !== 'ADMIN') return;
    setSheetLoading(true);
    setSheetError(null);
    try {
      const res = await fetch('/api/admin/sheets?limit=200');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '데이터 로드 실패');
      setSheetBundle(data);
      setAdminRefreshedAt(new Date().toLocaleString('ko-KR'));
    } catch (e: any) {
      setSheetError(e.message);
    } finally {
      setSheetLoading(false);
    }
  }, [actualRole]);

  useEffect(() => {
    if (actualRole === 'ADMIN' && !sheetBundle) fetchAdminSheets();
  }, [actualRole, fetchAdminSheets, sheetBundle]);

  const handleMirrorSync = async () => {
    setMirrorSyncing(true);
    try {
      const res = await fetch('/api/admin/mirror/sync', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      await fetchAdminSheets();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setMirrorSyncing(false);
    }
  };

  // --- Member Handlers ---
  const handleSaveMember = async () => {
    if (!memberForm?.email) return;
    setMemberSaving(true);
    setMemberMessage(null);
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      });
      const data = await res.json();
      if (data.success) {
        setMemberMessage('성공적으로 저장되었습니다.');
        await fetchAdminSheets();
      } else {
        setMemberMessage('저장 실패: ' + data.message);
      }
    } catch {
      setMemberMessage('통신 중 오류가 발생했습니다.');
    } finally {
      setMemberSaving(false);
    }
  };

  // --- Instructor Handlers ---
  const handleSaveAdminInstructor = async () => {
    if (!adminInstructorForm || !selectedInstructorId) return;
    setAdminInstructorSaving(true);
    setAdminInstructorMessage(null);
    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedInstructorId,
          ...adminInstructorForm
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAdminInstructorMessage('저장 완료');
        await fetchAdminSheets();
      } else {
        setAdminInstructorMessage('저장 실패: ' + data.message);
      }
    } catch {
      setAdminInstructorMessage('통신 오류');
    } finally {
      setAdminInstructorSaving(false);
    }
  };

  const handleUpdateInstructorStatus = async (status: string) => {
    if (!selectedInstructorId) return;
    setInstructorStatusLoading(status);
    try {
      const res = await fetch('/api/admin/instructors/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedInstructorId, status }),
      });
      const data = await res.json();
      if (data.success) await fetchAdminSheets();
    } catch {
      alert('상태 변경 실패');
    } finally {
      setInstructorStatusLoading(null);
    }
  };

  const handleAdminInstructorPhotoFile = async (file: File | null) => {
    if (!selectedInstructorId || !adminInstructorForm) return;
    if (!file) {
      setAdminInstructorForm({ ...adminInstructorForm, '프로필사진': '' });
      return;
    }
    setAdminInstructorPhotoUploading(true);
    try {
      // Import dynamic or use from utils
      const { compressImageForProfile, uploadProfilePhoto } = await import('./utils');
      const compressed = await compressImageForProfile(file);
      const photoUrl = await uploadProfilePhoto(compressed, getInstructorName(adminInstructorForm), selectedInstructorId);
      setAdminInstructorForm({ ...adminInstructorForm, '프로필사진': photoUrl });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdminInstructorPhotoUploading(false);
    }
  };

  // --- Inquiry Handlers ---
  const handleInquiryStatusUpdate = async (inquiryId: string, status: string, memo?: string) => {
    setInquiryStatusLoadingId(inquiryId);
    setInquiryGeneralMessage(null);
    try {
      const res = await fetch('/api/admin/inquiries/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId, status, memo }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAdminSheets();
      } else {
        setInquiryGeneralMessage('상태 변경 실패: ' + data.message);
      }
    } catch {
      setInquiryGeneralMessage('통신 오류');
    } finally {
      setInquiryStatusLoadingId(null);
    }
  };

  const handleInquiryAction = async (item: InquiryItem, mode: InquiryActionMode) => {
    const endpoint = mode === 'forward' ? '/api/admin/inquiries/forward' : '/api/admin/inquiries/reply';
    const draft = mode === 'forward' ? forwardDrafts[item.inquiryId] : replyDrafts[item.inquiryId];

    if (!draft?.subject || !draft?.message) {
      setInquiryActionMessage('제목과 메시지를 입력해 주세요.');
      return;
    }

    setInquiryActionLoadingId(item.inquiryId);
    setInquiryActionMessage(null);

    try {
      const payload = mode === 'forward' 
        ? { inquiryId: item.inquiryId, teacherEmail: item.teacherEmail, subject: draft.subject, message: draft.message }
        : { inquiryId: item.inquiryId, memberEmail: item.memberEmail, subject: draft.subject, message: draft.message };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setInquiryActionMessage(mode === 'forward' ? '전달 완료' : '회신 완료');
        setInquiryActionTarget(null);
        await fetchAdminSheets();
      } else {
        setInquiryActionMessage('실패: ' + data.message);
      }
    } catch (e: any) {
      setInquiryActionMessage('오류: ' + e.message);
    } finally {
      setInquiryActionLoadingId(null);
    }
  };

  // --- Memos/Computed ---
  const adminInstructorItems = useMemo<AdminInstructorItem[]>(() => {
    if (!sheetBundle) return [];
    return sheetBundle.sources.instructorDb.rows
      .filter(r => isMeaningfulRecord(r, ['성명', '이메일']))
      .map(r => ({
        id: getInstructorEmail(r) || String(r.rowIndex),
        rowIndex: Number(r.rowIndex),
        name: getInstructorName(r),
        phone: getInstructorPhone(r),
        email: getInstructorEmail(r),
        loginEmail: getInstructorEmail(r),
        org: getInstructorOrg(r),
        field: getInstructorField(r),
        area: getInstructorArea(r),
        status: getInstructorStatus(r as any),
        finalStatus: getInstructorFinalStatus(r),
        updatedAt: getInstructorUpdatedAt(r),
        intro: getInstructorIntro(r),
        career: getInstructorCareer(r),
        address: getInstructorAddress(r),
        instagram: getInstructorInstagram(r),
        instagramOpen: getInstructorInstagramOpen(r),
        portfolioLink: getInstructorPortfolioLink(r),
        profilePhoto: getInstructorProfilePhoto(r),
        isLocal: isLocalInstructor(r as any),
        raw: r as any
      }));
  }, [sheetBundle]);

  const memberItems = useMemo<AdminMemberItem[]>(() => {
    if (!sheetBundle) return [];
    return sheetBundle.sources.memberDb.rows
      .filter(r => isMeaningfulRecord(r, ['이름', '이메일']))
      .map(r => ({
        id: getMemberEmail(r) || String(r.rowIndex),
        rowIndex: Number(r.rowIndex),
        name: getMemberName(r),
        email: getMemberEmail(r),
        phone: getMemberPhone(r),
        org: getMemberOrg(r),
        status: getMemberStatus(r),
        memberType: getMemberType(r),
        lastLogin: getMemberLastLogin(r),
        raw: r
      }));
  }, [sheetBundle]);

  const inquiryItems = useMemo<InquiryItem[]>(() => {
    if (!sheetBundle) return [];
    return sheetBundle.sources.inquiryDb.rows
      .filter(r => isMeaningfulRecord(r, ['신청인 성명']))
      .map(r => ({
        inquiryId: String(r.inquiryId || r.rowIndex),
        rowIndex: Number(r.rowIndex),
        receivedAt: String(findField(r, ['접수일시', '받은날짜', 'created_at'])),
        teacherName: String(findField(r, ['문의대상(강사명)', '강사명'])),
        teacherEmail: String(findField(r, ['강사 이메일', 'teacherEmail'])),
        memberName: String(findField(r, ['신청인 성명', 'name'])),
        memberPhone: String(findField(r, ['신청인 연락처', 'phone'])),
        memberEmail: String(findField(r, ['연락받을 이메일', 'email'])),
        purpose: String(findField(r, ['문의 목적', 'purpose'])),
        message: String(findField(r, ['상세 내용', '문의 내용', 'message'])),
        status: String(findField(r, ['처리 상태', '상태', 'status'])) || '접수대기',
      }));
  }, [sheetBundle]);

  const selectedAdminInstructor = useMemo(
    () => adminInstructorItems.find(it => it.id === selectedInstructorId) || null,
    [adminInstructorItems, selectedInstructorId]
  );

  const selectedMember = useMemo(
    () => memberItems.find(it => it.id === selectedMemberId) || null,
    [memberItems, selectedMemberId]
  );

  useEffect(() => {
    if (selectedAdminInstructor) setAdminInstructorForm({ ...selectedAdminInstructor.raw });
  }, [selectedAdminInstructor]);

  useEffect(() => {
    if (selectedMember) setMemberForm({
      email: selectedMember.email,
      name: selectedMember.name,
      phone: selectedMember.phone,
      org: selectedMember.org,
      status: selectedMember.status,
      memberType: selectedMember.memberType,
      lastLogin: selectedMember.lastLogin
    });
  }, [selectedMember]);

  if (actualRole !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">접근 권한이 없습니다</h1>
          <p className="mt-2 text-gray-500">관리자 계정으로 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-black tracking-tight text-gray-900">양양이음터 <span className="text-blue-600">ADMIN</span></h1>
            <nav className="flex items-center gap-1.5 rounded-xl bg-gray-100 p-1.5">
              <button
                onClick={() => setActiveTab('member')}
                className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeTab === 'member' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                회원 관리
              </button>
              <button
                onClick={() => { setActiveTab('instructor'); setActiveSubTab('profile'); }}
                className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeTab === 'instructor' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                강사 프로필 관리
              </button>
              <button
                onClick={() => { setActiveTab('admin'); setActiveSubTab('dashboard'); }}
                className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeTab === 'admin' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                시트 통합 관리
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleMirrorSync}
              disabled={mirrorSyncing}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95 disabled:opacity-50"
            >
              {mirrorSyncing ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  동기화 중
                </span>
              ) : '실시간 데이터 동기화'}
            </button>
            <div className="h-10 w-px bg-gray-200 mx-2" />
            <div className="text-right">
              <p className="text-sm font-black text-gray-900">{session?.user?.name || '관리자'}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                {adminRefreshedAt ? `Last Sync: ${adminRefreshedAt}` : 'Waiting for sync...'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-6 lg:p-10">
        {sheetError && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600">!</span>
              {sheetError}
            </div>
          </div>
        )}

        {activeTab === 'member' && (
          <MemberManagement
            members={memberItems}
            selectedId={selectedMemberId}
            onSelect={setSelectedMemberId}
            search={memberSearch}
            onSearchChange={setMemberSearch}
            statusFilter={memberStatusFilter}
            onStatusFilterChange={(s) => setMemberStatusFilter(s as any)}
            form={memberForm}
            onFormChange={(u) => setMemberForm(p => p ? { ...p, ...u } : null)}
            onSave={handleSaveMember}
            saving={memberSaving}
            message={memberMessage}
          />
        )}

        {activeTab === 'instructor' && (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr] animate-in fade-in slide-in-from-bottom-4">
            {/* Sidebar */}
            <InstructorList
              instructors={adminInstructorItems}
              selectedId={selectedInstructorId}
              onSelect={setSelectedInstructorId}
              statusFilter={adminInstructorStatusFilter}
              onStatusFilterChange={setAdminInstructorStatusFilter}
            />

            {/* Content Hub */}
            <div className="min-w-0">
              {selectedAdminInstructor ? (
                <InstructorDetail
                  instructor={selectedAdminInstructor}
                  form={adminInstructorForm || selectedAdminInstructor.raw}
                  setForm={(u) => setAdminInstructorForm(p => p ? { ...p, ...u } : null)}
                  onSave={handleSaveAdminInstructor}
                  onStatusUpdate={handleUpdateInstructorStatus}
                  onPhotoUpload={handleAdminInstructorPhotoFile}
                  loading={adminInstructorSaving}
                  statusLoading={instructorStatusLoading}
                  message={adminInstructorMessage}
                  photoUploading={adminInstructorPhotoUploading}
                />
              ) : (
                <div className="flex h-[500px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white/50 backdrop-blur-sm p-10 text-center">
                  <div className="mb-4 rounded-full bg-gray-100 p-6">
                    <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">선택된 강사가 없습니다</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-xs">왼쪽 목록에서 관리할 강사를 선택하여 프로필 정보를 확인하고 업데이트하세요.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm border border-gray-100 max-w-fit">
              <button
                onClick={() => setActiveSubTab('dashboard')}
                className={`rounded-xl px-6 py-2.5 text-sm font-bold transition-all ${
                  activeSubTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                데이터 현황
              </button>
              <button
                onClick={() => setActiveSubTab('inquiry')}
                className={`rounded-xl px-6 py-2.5 text-sm font-bold transition-all ${
                  activeSubTab === 'inquiry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                문의 운영함
              </button>
            </div>

            <div className="transition-all">
              {activeSubTab === 'dashboard' && sheetBundle && (
                <DataCenter sheetBundle={sheetBundle} />
              )}

              {activeSubTab === 'inquiry' && (
                <InquiryManagement
                  inquiries={inquiryItems}
                  search={inquirySearch}
                  onSearchChange={setInquirySearch}
                  statusFilter={inquiryStatusFilter}
                  onStatusFilterChange={setInquiryStatusFilter}
                  actionTarget={inquiryActionTarget}
                  onOpenAction={(item, mode) => {
                    setInquiryActionMessage(null);
                    setInquiryActionTarget({ inquiryId: item.inquiryId, mode });
                    if (mode === 'forward') {
                      setForwardDrafts(prev => ({
                        ...prev,
                        [item.inquiryId]: prev[item.inquiryId] || {
                          subject: `[양양이음터] '${item.purpose}' 문의 전달드립니다.`,
                          message: `${item.teacherName} 강사님,\n신청자 ${item.memberName}님의 문의 내용을 전달드립니다.\n\n[문의 내용]\n${item.message}`
                        }
                      }));
                    } else {
                      setReplyDrafts(prev => ({
                        ...prev,
                        [item.inquiryId]: prev[item.inquiryId] || {
                          subject: `[양양이음터] '${item.purpose}' 문의 답변드립니다.`,
                          message: `${item.memberName}님,\n안녕하세요. 양양이음터입니다.\n\n문의하신 내용에 대해 다음과 같이 답변드립니다.`
                        }
                      }));
                    }
                  }}
                  onCloseAction={() => setInquiryActionTarget(null)}
                  onHandleAction={handleInquiryAction}
                  onStatusUpdate={handleInquiryStatusUpdate}
                  loadingId={inquiryStatusLoadingId}
                  actionLoadingId={inquiryActionLoadingId}
                  message={inquiryGeneralMessage}
                  actionMessage={inquiryActionMessage}
                  forwardDrafts={forwardDrafts}
                  replyDrafts={replyDrafts}
                  onDraftUpdate={(id, mode, update) => {
                    if (mode === 'forward') {
                      setForwardDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...update } }));
                    } else {
                      setReplyDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...update } }));
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
