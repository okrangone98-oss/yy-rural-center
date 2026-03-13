import React from 'react';

export function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm shadow-gray-100/60">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{description}</div>
    </div>
  );
}

export const FieldLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={`mb-2 block text-sm font-medium text-gray-700 ${className || ''}`}>{children}</label>
);
