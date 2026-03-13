import React from 'react';
import { InstructorProfile, AdminInstructorItem } from '../../types';
import { 
  getInstructorName, getInstructorEmail, getInstructorPhone, findField, 
  getInstructorOrg, getInstructorField, isLocalInstructor, getInstructorStatus, 
  getInstructorFinalStatus, getInstructorInstagram, getInstructorInstagramOpen, 
  getInstructorPortfolioLink, getInstructorAddress, getInstructorCareer, 
  getInstructorIntro, getInstructorStatusTone, getInstructorProfilePhoto,
  INSTRUCTOR_STATUS_OPTIONS, STATUS
} from '../../utils';
import { INSTRUCTOR_FIELD_OPTIONS, INSTAGRAM_VISIBILITY_OPTIONS } from '@/lib/domain';
import { FieldLabel } from '../shared';
import { InstructorPhoto } from './InstructorPhoto';

interface InstructorDetailProps {
  instructor: AdminInstructorItem;
  form: InstructorProfile;
  setForm: (update: Partial<InstructorProfile>) => void;
  onSave: () => Promise<void>;
  loading: boolean;
  message: string | null;
  statusLoading: string | null;
  onStatusUpdate: (status: string) => Promise<void>;
  onPhotoUpload: (file: File | null) => Promise<void>;
  photoUploading: boolean;
}

export const InstructorDetail: React.FC<InstructorDetailProps> = ({
  instructor,
  form,
  setForm,
  onSave,
  loading,
  message,
  statusLoading,
  onStatusUpdate,
  onPhotoUpload,
  photoUploading,
}) => {
  const updateField = (key: string, value: string) => setForm({ [key]: value });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        {/* Title Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-extrabold text-gray-900">{instructor.name || '강사 상세'}</h3>
              {instructor.isLocal && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                  양양 로컬
                </span>
              )}
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm ${getInstructorStatusTone(instructor.status)}`}>
                {instructor.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">프로필 정보와 노출 상태를 관리합니다.</p>
          </div>
          <div className="text-right text-[11px] text-gray-400 font-medium">
            <div className="bg-gray-50 rounded px-2 py-1 inline-block">row #{instructor.rowIndex || '-'}</div>
            <div className="mt-1">최근 수정: {instructor.updatedAt || '-'}</div>
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              {message}
            </div>
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main Info */}
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>성명</FieldLabel>
                <input
                  value={getInstructorName(form)}
                  onChange={(e) => updateField('성명', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>로그인용 이메일 (ID)</FieldLabel>
                <input
                  value={getInstructorEmail(form)}
                  readOnly
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 font-mono"
                />
              </div>
              <div>
                <FieldLabel>연락처</FieldLabel>
                <input
                  value={getInstructorPhone(form)}
                  onChange={(e) => updateField('연락처', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>공개 연락 이메일</FieldLabel>
                <input
                  value={findField(form, ['이메일', 'Email', 'email'])}
                  onChange={(e) => updateField('이메일', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>소속</FieldLabel>
                <input
                  value={getInstructorOrg(form)}
                  onChange={(e) => updateField('소속', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>활동지역</FieldLabel>
                <input
                  value={findField(form, ['Activity_Area', '활동지역'])}
                  onChange={(e) => setForm({ Activity_Area: e.target.value, 활동지역: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>강의분야</FieldLabel>
                <select
                  value={getInstructorField(form)}
                  onChange={(e) => setForm({ 강의분야: e.target.value, 전문분야: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                >
                  <option value="">강의 분야 선택</option>
                  {INSTRUCTOR_FIELD_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
              <div>
                <FieldLabel>로컬 강사 여부</FieldLabel>
                <select
                  value={isLocalInstructor(form) ? 'Y' : 'N'}
                  onChange={(e) => setForm({ isLocal: e.target.value as 'Y' | 'N', 로컬: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                >
                  <option value="N">일반</option>
                  <option value="Y">양양 로컬</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>포트폴리오 링크</FieldLabel>
                <input
                  value={getInstructorPortfolioLink(form)}
                  onChange={(e) => updateField('Portfolio_Link', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="https://..."
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>인스타그램</FieldLabel>
                <div className="flex gap-3">
                  <input
                    value={getInstructorInstagram(form)}
                    onChange={(e) => updateField('인스타그램주소', e.target.value)}
                    className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="@username"
                  />
                  <select
                    value={getInstructorInstagramOpen(form)}
                    onChange={(e) => updateField('인스타그램공개여부', e.target.value)}
                    className="w-32 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {INSTAGRAM_VISIBILITY_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <FieldLabel>주요경력</FieldLabel>
                <textarea
                  rows={4}
                  value={getInstructorCareer(form)}
                  onChange={(e) => updateField('주요경력', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>소개</FieldLabel>
                <textarea
                  rows={6}
                  value={getInstructorIntro(form)}
                  onChange={(e) => updateField('상세내용', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <FieldLabel>관리자 메모 (비공개)</FieldLabel>
                <textarea
                  rows={3}
                  value={findField(form, ['운영 메모', '운영메모', '관리자메모'])}
                  onChange={(e) => updateField('운영 메모', e.target.value)}
                  placeholder="특이사항이나 보완이 필요한 항목을 기록하세요."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-8">
              <button
                onClick={onSave}
                disabled={loading || photoUploading}
                className="rounded-xl bg-gray-900 px-10 py-3.5 font-bold text-white shadow-lg transition-all hover:bg-black hover:shadow-xl disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? '저장 중...' : photoUploading ? '사진 처리 중...' : '프로필 정보 저장'}
              </button>
              
              <div className="h-10 w-px bg-gray-200 mx-2" />
              
              <button
                onClick={() => onStatusUpdate(STATUS.active)}
                disabled={statusLoading !== null}
                className={`rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${
                  instructor.status === STATUS.active
                    ? 'bg-emerald-600 text-white shadow-emerald-200'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {statusLoading === STATUS.active ? '처리 중...' : '사이트 노출 (활성)'}
              </button>
              <button
                onClick={() => onStatusUpdate(STATUS.hidden)}
                disabled={statusLoading !== null}
                className={`rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${
                  instructor.status === STATUS.hidden
                    ? 'bg-amber-500 text-white shadow-amber-200'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {statusLoading === STATUS.hidden ? '처리 중...' : '검토 중 (숨김)'}
              </button>
              <button
                onClick={() => onStatusUpdate(STATUS.deleteRequested)}
                disabled={statusLoading !== null}
                className={`rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${
                  instructor.status === STATUS.deleteRequested
                    ? 'bg-rose-600 text-white shadow-rose-200'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-rose-300 hover:text-rose-600'
                }`}
              >
                {statusLoading === STATUS.deleteRequested ? '처리 중...' : '강사 삭제'}
              </button>
            </div>
          </div>

          {/* Side Panels */}
          <div className="space-y-6">
            <InstructorPhoto 
              onUpload={onPhotoUpload}
              uploading={photoUploading}
              photoUrl={getInstructorProfilePhoto(form)}
              onClear={() => updateField('프로필사진', '')}
              name={getInstructorName(form)}
            />
            
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-inner">
              <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                <span className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <span className="h-4 w-1 bg-emerald-500 rounded-full" />
                  카드 미리보기
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center">
                  <div className="h-20 w-20 rounded-full bg-white shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center mb-3">
                    {getInstructorProfilePhoto(form) ? (
                      <img src={getInstructorProfilePhoto(form)} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-gray-300 text-xs">No Image</span>
                    )}
                  </div>
                  <div className="text-base font-bold text-gray-900">{getInstructorName(form) || '이름 없음'}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                    {getInstructorField(form) || '강의분야 미입력'}
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">활동지역</span>
                    <span className="text-gray-700 font-medium">{findField(form, ['Activity_Area', '활동지역']) || '-'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">소속</span>
                    <span className="text-gray-700 font-medium truncate max-w-[150px]">{getInstructorOrg(form) || '-'}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 text-xs text-gray-600 leading-relaxed shadow-sm border border-gray-100 italic">
                  "{getInstructorIntro(form) || '소개 문구가 없습니다.'}"
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-extrabold text-gray-900 mb-4">운영 메타 정보</div>
              <div className="space-y-2.5 text-[11px] text-gray-500">
                <div className="flex justify-between">
                  <span>강위분야 코드</span>
                  <span className="font-mono text-gray-700">{findField(form, ['강위분야_코드']) || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>로그인 계정</span>
                  <span className="text-gray-700 truncate max-w-[160px]">{getInstructorEmail(form) || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>사진 경로</span>
                  <button 
                    onClick={() => {
                      const url = getInstructorProfilePhoto(form);
                      if (url) window.open(url, '_blank');
                    }}
                    className="text-blue-600 hover:underline truncate max-w-[160px]"
                  >
                    {getInstructorProfilePhoto(form) ? 'URL 열기' : '없음'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
