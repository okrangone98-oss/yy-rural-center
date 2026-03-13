import React from 'react';
import { AdminMemberItem, MemberFormState } from '../../types';
import { getMemberStatusTone, MEMBER_STATUS_OPTIONS, MEMBER_TYPE_OPTIONS } from '../../utils';
import { FieldLabel } from '../shared';

interface MemberManagementProps {
  members: AdminMemberItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  form: MemberFormState | null;
  onFormChange: (update: Partial<MemberFormState>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  message: string | null;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({
  members,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  form,
  onFormChange,
  onSave,
  saving,
  message,
}) => {
  const selectedMember = members.find(m => m.id === selectedId);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Sidebar List */}
      <div className="flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">이용자 목록 ({members.length})</h3>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="이름, 이메일, 전화번호 검색"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-1">
            <button
              onClick={() => onStatusFilterChange('all')}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                statusFilter === 'all' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => onStatusFilterChange('active')}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                statusFilter === 'active' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white'
              }`}
            >
              활성
            </button>
            <button
              onClick={() => onStatusFilterChange('inactive')}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                statusFilter === 'inactive' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white'
              }`}
            >
              비활성
            </button>
          </div>
        </div>
        <div className="max-h-[700px] overflow-y-auto px-2 py-2">
          {members.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</div>
          ) : (
            <div className="space-y-1">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onSelect(member.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${
                    member.id === selectedId
                      ? 'bg-emerald-50 ring-1 ring-emerald-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{member.name || '(이름 없음)'}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getMemberStatusTone(member.status)}`}>
                      {member.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 truncate">{member.email}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{member.memberType}</span>
                    <span>row #{member.rowIndex}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="space-y-4">
        {!selectedMember || !form ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="text-sm text-gray-500">관리할 회원을 목록에서 선택해 주세요.</div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between border-b border-gray-100 pb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedMember.name} 회원 상세</h3>
                <p className="mt-1 text-xs text-gray-500">회원 등급 및 상태 정보를 수정할 수 있습니다.</p>
              </div>
              <div className="text-right text-[11px] text-gray-400">
                <div>최근 로그인: {selectedMember.lastLogin || '-'}</div>
                <div>데이터 인덱스: row #{selectedMember.rowIndex}</div>
              </div>
            </div>

            {message && (
              <div className="mb-6 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border border-gray-100">{message}</div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>이름 (성명)</FieldLabel>
                <input
                  value={form.name}
                  onChange={(e) => onFormChange({ name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <FieldLabel>이메일 (ID)</FieldLabel>
                <input
                  value={form.email}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>
              <div>
                <FieldLabel>연락처</FieldLabel>
                <input
                  value={form.phone}
                  onChange={(e) => onFormChange({ phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <FieldLabel>소속 기관</FieldLabel>
                <input
                  value={form.org}
                  onChange={(e) => onFormChange({ org: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <FieldLabel>회원 유형</FieldLabel>
                <select
                  value={form.memberType}
                  onChange={(e) => onFormChange({ memberType: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  {MEMBER_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>계정 상태</FieldLabel>
                <select
                  value={form.status}
                  onChange={(e) => onFormChange({ status: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  {MEMBER_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-xl bg-gray-900 px-8 py-3 font-semibold text-white transition-all hover:bg-gray-800 disabled:opacity-50 active:scale-[0.98]"
              >
                {saving ? '저장 중...' : '회원 정보 저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
