import React from 'react';
import { HelpCircle } from 'lucide-react';

interface TimePeriodLegendProps {
  className?: string;
}

// Compact info-icon tooltip explaining the Week/Period/Month/Quarter/Custom Range vocabulary
// used by every time-period selector built this session (Operation Costs, Labour Import,
// Financial Command). Same hover-reveal mechanism as ItemSpecsTooltip.tsx (Inventory's
// Case/Box/Sack specs) — Tailwind's group/tip + opacity transition, no library, no JS state.
export const TimePeriodLegend: React.FC<TimePeriodLegendProps> = ({ className = '' }) => {
  return (
    <span className={`relative inline-flex group/tip ${className}`}>
      <HelpCircle className="h-3.5 w-3.5 text-text-muted/60 hover:text-accent transition-colors cursor-help" />
      <span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-72 -translate-x-1/2 rounded-xl bg-text-navy text-white p-4 opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip:opacity-100 normal-case text-left">
        <span className="block uppercase tracking-widest text-white/50 text-[8px] font-bold mb-2">Time Period Guide</span>
        <span className="block space-y-1.5 text-[11px] leading-snug">
          <span className="block"><strong className="text-white">Week</strong> — Monday to Sunday.</span>
          <span className="block"><strong className="text-white">Period</strong> — 4 weeks. 13 Periods per year, starting the Monday of the week containing 6 April.</span>
          <span className="block"><strong className="text-white">Month</strong> — a week is counted in whichever calendar month it starts in.</span>
          <span className="block"><strong className="text-white">Quarter</strong> — Periods 1–3, 4–6, 7–9 (3 periods each), and 10–13 (4 periods) for the year's final quarter.</span>
          <span className="block"><strong className="text-white">Custom Range</strong> — pick any exact start/end date, independent of the buckets above.</span>
        </span>
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-text-navy" />
      </span>
    </span>
  );
};
