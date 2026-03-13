import React, { useState } from 'react';

interface DataTableProps<T> {
  title: string;
  data: T[];
  pageSize?: number;
  renderHeader: () => React.ReactNode;
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T>({
  title,
  data,
  pageSize = 20,
  renderHeader,
  renderRow,
  emptyMessage = '데이터가 없습니다.',
}: DataTableProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = data.slice(startIndex, startIndex + pageSize);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div 
        className="flex items-center justify-between bg-gray-50/50 px-4 py-3 cursor-pointer hover:bg-gray-100/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{title} ({data.length})</h3>
          <span className="text-[10px] text-gray-400 font-normal">컬럼 클릭 시 펼침/접힘</span>
        </div>
        <button className="text-gray-400">
          {isExpanded ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="拉5 15l7-7 7 7" />
              <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M5 15l7-7 7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100">
          {data.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">{emptyMessage}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/30 text-xs text-gray-500">
                    {renderHeader()}
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedData.map((item, idx) => renderRow(item, startIndex + idx))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 bg-white">
                  <div className="text-xs text-gray-500">
                    {currentPage} / {totalPages} 페이지
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      이전
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage - 2 + i;
                      if (currentPage <= 2) pageNum = i + 1;
                      if (currentPage >= totalPages - 1) pageNum = totalPages - 4 + i;
                      if (pageNum < 1 || pageNum > totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                            pageNum === currentPage
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
