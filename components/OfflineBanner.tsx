import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  position?: 'top' | 'inline';
  isOnline: boolean;
  offlineDuration: string | null;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ position = 'top', isOnline, offlineDuration }) => {
  if (isOnline) return null;

  const isTop = position === 'top';

  const baseClasses = isTop
    ? 'fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-center justify-center gap-3'
    : 'rounded-xl px-4 py-3 flex items-center gap-3 w-full';

  return (
    <div className={`${baseClasses} bg-red-600 text-white`}>
      <WifiOff className="h-5 w-5 shrink-0" />
      <div className="flex flex-col md:flex-row md:items-center md:gap-4 min-w-0">
        <span className="text-sm font-bold whitespace-nowrap">
          You are offline{offlineDuration ? ` — ${offlineDuration}` : ''}
        </span>
        <span className="text-sm font-black uppercase tracking-widest">
          DO NOT PROCESS PAYMENTS
        </span>
      </div>
    </div>
  );
};
