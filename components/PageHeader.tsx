import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Skip the outer bg/border/shadow/padding card — for pages that already render their own
   * enclosing card around the header (e.g. Inventory's single all-in-one card). The icon size,
   * color, and position stay identical either way; only the surrounding chrome is omitted. */
  bare?: boolean;
}

/**
 * The one standard page-title header for every top-level sidebar page — icon (accent color,
 * in a rounded accent-tinted box), title, and optional subtitle, with an optional actions
 * slot on the right (buttons/badges). Reused everywhere instead of each page hand-rolling its
 * own slightly different icon/title styling, so size/color/position never drift apart again.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, title, subtitle, actions, bare }) => {
  const content = (
    <>
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="bg-accent/10 p-3 sm:p-4 rounded-2xl flex-shrink-0">
          <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
        </div>
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-text-navy uppercase tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-[10px] sm:text-sm font-bold text-text-muted uppercase tracking-widest mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">{actions}</div>}
    </>
  );

  if (bare) {
    return <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">{content}</div>;
  }

  return (
    <div className="bg-card-bg p-6 sm:p-8 rounded-3xl border border-border-grey shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      {content}
    </div>
  );
};
