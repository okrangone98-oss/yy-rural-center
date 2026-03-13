import React from 'react';
import { InquiryItem, InquiryActionDraft, InquiryActionMode } from '../../types';
import { 
  getInquiryStatusTone, INQUIRY_STATUS_PRESETS, getInquiryStatusCategory 
} from '../../utils';
import { FieldLabel } from '../shared';

interface InquiryManagementProps {
  inquiries: InquiryItem[];
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  actionTarget: { inquiryId: string; mode: InquiryActionMode } | null;
  onOpenAction: (item: InquiryItem, mode: InquiryActionMode) => void;
  onCloseAction: () => void;
  onHandleAction: (item: InquiryItem, mode: InquiryActionMode) => Promise<void>;
  onStatusUpdate: (id: string, status: string, memo?: string) => Promise<void>;
  loadingId: string | null;
  actionLoadingId: string | null;
  message: string | null;
  actionMessage: string | null;
  forwardDrafts: Record<string, InquiryActionDraft>;
  replyDrafts: Record<string, InquiryActionDraft>;
  onDraftUpdate: (id: string, mode: InquiryActionMode, update: Partial<InquiryActionDraft>) => void;
}

export const InquiryManagement: React.FC<InquiryManagementProps> = ({
  inquiries,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  actionTarget,
  onOpenAction,
  onCloseAction,
  onHandleAction,
  onStatusUpdate,
  loadingId,
  actionLoadingId,
  message,
  actionMessage,
  forwardDrafts,
  replyDrafts,
  onDraftUpdate,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between bg-white p-4 rounded-2xl border border-gray-200">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">문의 운영함</h3>
          <p className="mt-1 text-xs text-gray-500">강사 전달 및 회원 회신을 처리하는 운영 큐입니다.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="강사, 신청자, 목적 검색"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="pending">대기 문의</option>
            <option value="all">전체 상태</option>
            <option value="forwarded">강사 전달 완료</option>
            <option value="completed">회신 완료</option>
          </select>
        </div>
      </div>

      {(message || actionMessage) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {message || actionMessage}
        </div>
      )}

      <div className="space-y-3">
        {inquiries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            조건에 맞는 문의가 없습니다.
          </div>
        ) : (
          inquiries.map((item) => {
            const isForwardOpen = actionTarget?.inquiryId === item.inquiryId && actionTarget.mode === 'forward';
            const isReplyOpen = actionTarget?.inquiryId === item.inquiryId && actionTarget.mode === 'reply';
            const forwardDraft = forwardDrafts[item.inquiryId];
            const replyDraft = replyDrafts[item.inquiryId];

            return (
              <div key={item.inquiryId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{item.teacherName} 강사님</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getInquiryStatusTone(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="text-[11px] text-gray-400">#{item.inquiryId}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      신청자: <span className="font-medium text-gray-900">{item.memberName}</span> ({item.memberPhone || '-'})
                    </div>
                    <div className="text-sm text-gray-600">문의 목적: {item.purpose || '-'}</div>
                    <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                      {item.message || '상세 내용 없음'}
                    </div>
                    
                    <div className="mt-3">
                      <FieldLabel className="!mb-1 text-[11px] text-gray-400">상담 메모 (비공개)</FieldLabel>
                      <textarea
                        rows={2}
                        defaultValue={item['운영 메모'] || item['운영메모'] || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (item['운영 메모'] || '')) {
                            void onStatusUpdate(item.inquiryId, item.status, e.target.value);
                          }
                        }}
                        placeholder="상담 이력이나 참고사항을 입력하세요."
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/30 p-2 text-xs text-gray-600 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 xl:w-60">
                    <div className="grid grid-cols-2 gap-1 xl:grid-cols-1">
                      {INQUIRY_STATUS_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => onStatusUpdate(item.inquiryId, preset)}
                          disabled={loadingId === item.inquiryId}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                          {loadingId === item.inquiryId ? '...' : preset}
                        </button>
                      ))}
                    </div>
                    
                    <div className="mt-1">
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          onDraftUpdate(item.inquiryId, 'reply', {
                            subject: `[양양이음터] '${item.purpose}' 문의 답변드립니다.`,
                            message: val
                          });
                          onOpenAction(item, 'reply');
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-500"
                      >
                        <option value="">회신 템플릿 선택</option>
                        <option value={`안녕하세요, ${item.memberName}님.\n양양이음터입니다. 문의하신 '${item.purpose}' 내용에 대해 강사님께 전달하였으며, 답변을 기다리는 중입니다.`}>접수 안내</option>
                        <option value="문의하신 내용이 정상적으로 처리 완료되었습니다. 감사합니다.">완료 안내</option>
                      </select>
                    </div>

                    <button
                      onClick={() => onOpenAction(item, 'forward')}
                      className="rounded-lg border border-sky-300 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50"
                    >
                      강사 전달 메일
                    </button>
                    <button
                      onClick={() => onOpenAction(item, 'reply')}
                      className="rounded-lg border border-emerald-300 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      회원 회신 메일
                    </button>
                  </div>
                </div>

                {isForwardOpen && (
                  <div className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <div className="text-xs font-semibold text-sky-900 text-right">To: {item.teacherEmail || '이메일 없음'}</div>
                    <input
                      value={forwardDraft?.subject || ''}
                      onChange={(e) => onDraftUpdate(item.inquiryId, 'forward', { subject: e.target.value })}
                      className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm"
                      placeholder="메일 제목"
                    />
                    <textarea
                      rows={5}
                      value={forwardDraft?.message || ''}
                      onChange={(e) => onDraftUpdate(item.inquiryId, 'forward', { message: e.target.value })}
                      className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm font-light"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onHandleAction(item, 'forward')}
                        disabled={actionLoadingId === item.inquiryId}
                        className="rounded-lg bg-sky-700 px-4 py-2 text-xs text-white"
                      >
                        {actionLoadingId === item.inquiryId ? '전송중...' : '메일 전송'}
                      </button>
                      <button onClick={onCloseAction} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs">취소</button>
                    </div>
                  </div>
                )}

                {isReplyOpen && (
                  <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold text-emerald-900 text-right">To: {item.memberEmail || '이메일 없음'}</div>
                    <input
                      value={replyDraft?.subject || ''}
                      onChange={(e) => onDraftUpdate(item.inquiryId, 'reply', { subject: e.target.value })}
                      className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                      placeholder="메일 제목"
                    />
                    <textarea
                      rows={5}
                      value={replyDraft?.message || ''}
                      onChange={(e) => onDraftUpdate(item.inquiryId, 'reply', { message: e.target.value })}
                      className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm font-light"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onHandleAction(item, 'reply')}
                        disabled={actionLoadingId === item.inquiryId}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-xs text-white"
                      >
                        {actionLoadingId === item.inquiryId ? '전송중...' : '메일 전송'}
                      </button>
                      <button onClick={onCloseAction} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs">취소</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
