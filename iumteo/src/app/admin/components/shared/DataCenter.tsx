import React from 'react';
import { SheetBundle } from '../../types';
import { DataTable } from '../shared/DataTable';

interface DataCenterProps {
  sheetBundle: SheetBundle;
}

export const DataCenter: React.FC<DataCenterProps> = ({ sheetBundle }) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">데이터 무결성 진단</h3>
        <div className="mt-4">
          {sheetBundle.integrity.issueCount === 0 ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-700 border border-emerald-100">
              현재 발견된 데이터 무결성 이슈가 없습니다. (정상)
            </div>
          ) : (
            <div className="space-y-2">
              {sheetBundle.integrity.issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-amber-900">
                      [{issue.severity.toUpperCase()}] {issue.message}
                    </div>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      {issue.count}건
                    </span>
                  </div>
                  <div className="mt-2 truncate text-xs text-amber-700">샘플 데이데: {JSON.stringify(issue.samples)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <DataTable
          title="강사DB 샘플"
          data={sheetBundle.sources.instructorDb.rows}
          renderHeader={() => (
            <tr>
              {Object.keys(sheetBundle.sources.instructorDb.rows[0] || {}).slice(0, 8).map(key => (
                <th key={key} className="px-4 py-2 text-left">{key}</th>
              ))}
            </tr>
          )}
          renderRow={(row, i) => (
            <tr key={i}>
              {Object.values(row).slice(0, 8).map((val, j) => (
                <td key={j} className="px-4 py-2 text-gray-600 truncate max-w-[150px]">{String(val)}</td>
              ))}
            </tr>
          )}
        />

        <DataTable
          title="이용자DB 샘플"
          data={sheetBundle.sources.memberDb.rows}
          renderHeader={() => (
            <tr>
              {Object.keys(sheetBundle.sources.memberDb.rows[0] || {}).slice(0, 8).map(key => (
                <th key={key} className="px-4 py-2 text-left">{key}</th>
              ))}
            </tr>
          )}
          renderRow={(row, i) => (
            <tr key={i}>
              {Object.values(row).slice(0, 8).map((val, j) => (
                <td key={j} className="px-4 py-2 text-gray-600 truncate max-w-[150px]">{String(val)}</td>
              ))}
            </tr>
          )}
        />

        <DataTable
          title="문의접수 샘플"
          data={sheetBundle.sources.inquiryDb.rows}
          renderHeader={() => (
            <tr>
              {Object.keys(sheetBundle.sources.inquiryDb.rows[0] || {}).slice(0, 8).map(key => (
                <th key={key} className="px-4 py-2 text-left">{key}</th>
              ))}
            </tr>
          )}
          renderRow={(row, i) => (
            <tr key={i}>
              {Object.values(row).slice(0, 8).map((val, j) => (
                <td key={j} className="px-4 py-2 text-gray-600 truncate max-w-[150px]">{String(val)}</td>
              ))}
            </tr>
          )}
        />
      </div>
    </div>
  );
};
