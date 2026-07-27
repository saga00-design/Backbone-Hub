import React from 'react';
import { Info } from 'lucide-react';
import { InventoryItem } from '../types';
import { formatPackSize, getCaseBoxSackDetails, pluralizePackaging } from '../utils/unitConversions';

type ItemSpecsTooltipItem = Pick<InventoryItem, 'unitSize' | 'unit' | 'packaging' | 'caseSize' | 'casePackaging' | 'quantity'>;

interface ItemSpecsTooltipProps {
  item: ItemSpecsTooltipItem;
  className?: string;
}

// Compact info-icon tooltip showing an item's full pack/case specs on hover, so table cells
// (Price/Item, Case/Box/Sack) can stay reduced to a bare value while the detail is still
// reachable without navigating to the edit modal. Reuses the same case/box/sack data used by
// the Inventory and Stock Orders columns — no separate calculation.
export const ItemSpecsTooltip: React.FC<ItemSpecsTooltipProps> = ({ item, className = '' }) => {
  const packSize = formatPackSize(item);
  const packLabel = item.packaging || item.unit;
  const caseInfo = getCaseBoxSackDetails(item);

  return (
    <span className={`relative inline-flex group/tip ${className}`}>
      <Info className="h-3.5 w-3.5 text-text-muted/60 hover:text-accent transition-colors cursor-help" />
      <span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-56 -translate-x-1/2 rounded-xl bg-text-navy text-white p-3 opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip:opacity-100 normal-case">
        <span className="block uppercase tracking-widest text-white/50 text-[8px] font-bold mb-1.5">Pack &amp; Case Specs</span>
        <span className="flex justify-between gap-3 text-[10px] font-bold py-0.5">
          <span className="text-white/60">Pack size</span>
          <span>{packSize} {item.unit} / {packLabel}</span>
        </span>
        <span className="flex justify-between gap-3 text-[10px] font-bold py-0.5">
          <span className="text-white/60">Case size</span>
          {caseInfo.isSet ? (
            <span>{caseInfo.caseSize} {pluralizePackaging(caseInfo.packLabel, caseInfo.caseSize || 0)} = 1 {caseInfo.casePackaging}</span>
          ) : (
            <span className="text-white/50">Not set</span>
          )}
        </span>
        {caseInfo.isSet && (
          <span className="flex justify-between gap-3 text-[10px] font-bold py-0.5">
            <span className="text-white/60">In stock</span>
            <span>{caseInfo.fullCases} full {pluralizePackaging(caseInfo.casePackaging, caseInfo.fullCases)}</span>
          </span>
        )}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-text-navy" />
      </span>
    </span>
  );
};
