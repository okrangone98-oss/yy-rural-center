'use client';

import { MapPin } from 'lucide-react';

type LocalBadgeProps = {
  isLocal?: 'Y' | 'N' | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_STYLES = {
  sm: { container: 'gap-1 px-2 py-0.5 text-xs', icon: 'h-3 w-3' },
  md: { container: 'gap-1.5 px-2.5 py-1 text-sm', icon: 'h-3.5 w-3.5' },
  lg: { container: 'gap-2 px-3 py-1.5 text-base', icon: 'h-4 w-4' },
};

export default function LocalBadge({ isLocal, size = 'sm', className = '' }: LocalBadgeProps) {
  if (isLocal !== 'Y') return null;

  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 ${sizeStyle.container} ${className}`}
      aria-label="양양 지역 강사"
      title="양양 지역 강사"
    >
      <MapPin className={sizeStyle.icon} aria-hidden="true" />
      <span>로컬</span>
    </span>
  );
}
