import React from 'react';
import { AdminInstructorItem } from '../../types';
import { getInstructorStatusTone } from '../../utils';

interface InstructorListProps {
  instructors: AdminInstructorItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export const InstructorList: React.FC<InstructorListProps> = ({
  instructors,
  selectedId,
  onSelect,
  statusFilter,
  onStatusFilterChange,
}) => {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">강사 목록</h3>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 상태</option>
          <option value="active">승인됨 (카드 노출)</option>
          <option value="pending">대기 중 (검토 필요)</option>
          <option value="deleteRequested">삭제 요청</option>
        </select>
      </div>
      <div className="max-h-[760px] overflow-y-auto px-4 py-4">
        {instructors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            조건에 맞는 강사가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {instructors.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  item.id === selectedId
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.name || '(이름 없음)'}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.field || '분야 미입력'}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getInstructorStatusTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {item.area || '활동지역 없음'} · {item.phone || '연락처 없음'}
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  {item.loginEmail || item.email || '이메일 없음'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
