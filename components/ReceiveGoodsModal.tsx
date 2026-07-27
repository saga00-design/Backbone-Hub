import React, { useState, useEffect } from 'react';
import { Order, InventoryItem, ReceivingRecordItem, ReceivingRecord } from '../types';
import { X, PackageCheck, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { toSafeNumber } from '../utils/unitConversions';

interface ReceiveGoodsModalProps {
  order: Order | null;
  inventoryItems: InventoryItem[];
  receivingRecords: ReceivingRecord[];
  onClose: () => void;
  onConfirm: (orderId: string, items: ReceivingRecordItem[]) => void;
}

interface Line {
  inventoryItemId: string;
  name: string;
  unit: ReceivingRecordItem['unit'];
  unitSize: number;
  packLabel: string;
  orderedPacks: number;
  orderedBaseQty: number;
  alreadyReceivedPacks: number;
  remainingPacks: number;
  receivedPacks: string; // input value, kept as string while editing
}

// Received quantities are entered in "packs" the same way the order was placed and priced
// (Orders.tsx's own cart uses this identical packs * unitSize math) — deliberately not routed
// through any metric-factor conversion helper, so this can't reintroduce the double-conversion
// bug that inflated Stock Take completions ~1000x.
export const ReceiveGoodsModal: React.FC<ReceiveGoodsModalProps> = ({ order, inventoryItems, receivingRecords, onClose, onConfirm }) => {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!order) return;

    // Sum every prior receiving session against this order, per item, so a second (or third)
    // session defaults to what's still outstanding rather than the original full order.
    const alreadyReceivedByItem: Record<string, number> = {};
    for (const rec of receivingRecords.filter(r => r.orderId === order.id)) {
      for (const line of rec.items) {
        alreadyReceivedByItem[line.inventoryItemId] = (alreadyReceivedByItem[line.inventoryItemId] || 0) + line.receivedQuantity;
      }
    }

    setLines(order.items.map(item => {
      const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
      const unitSize = invItem?.unitSize || 1;
      const orderedPacks = unitSize > 0 ? item.quantity / unitSize : item.quantity;
      const alreadyReceivedBase = alreadyReceivedByItem[item.inventoryItemId] || 0;
      const alreadyReceivedPacks = unitSize > 0 ? alreadyReceivedBase / unitSize : alreadyReceivedBase;
      const remainingPacks = Math.max(0, orderedPacks - alreadyReceivedPacks);
      return {
        inventoryItemId: item.inventoryItemId,
        name: item.name,
        unit: item.unit,
        unitSize,
        packLabel: invItem?.packaging || item.unit,
        orderedPacks,
        orderedBaseQty: item.quantity,
        alreadyReceivedPacks,
        remainingPacks,
        receivedPacks: String(Number(remainingPacks.toFixed(2))),
      };
    }));
  }, [order, inventoryItems, receivingRecords]);

  if (!order) return null;

  const isFollowUpSession = lines.some(l => l.alreadyReceivedPacks > 0);

  const updateReceived = (inventoryItemId: string, value: string) => {
    setLines(prev => prev.map(l => l.inventoryItemId === inventoryItemId ? { ...l, receivedPacks: value } : l));
  };

  const handleConfirm = () => {
    const items: ReceivingRecordItem[] = lines.map(l => {
      const receivedPacks = toSafeNumber(l.receivedPacks);
      const receivedBaseQty = Math.max(0, receivedPacks * l.unitSize);
      return {
        inventoryItemId: l.inventoryItemId,
        name: l.name,
        unit: l.unit,
        unitSize: l.unitSize,
        orderedQuantity: l.orderedBaseQty,
        receivedQuantity: receivedBaseQty,
      };
    });
    onConfirm(order.id, items);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card-bg rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border-grey">
        <div className="flex items-center justify-between p-6 border-b border-border-grey">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <PackageCheck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-navy uppercase tracking-tight">
                {isFollowUpSession ? 'Receive Remaining Delivery' : 'Receive Delivery'}
              </h3>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{order.supplier} — ordered {order.date}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-navy hover:bg-secondary-surface rounded-xl transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {isFollowUpSession
              ? "Defaults to what's still outstanding from earlier sessions — adjust any line that's still short."
              : 'Tick off what actually arrived. Defaults to the ordered amount — adjust any line that came up short.'}
          </p>
          {lines.map(line => {
            const receivedPacks = toSafeNumber(line.receivedPacks);
            const isShort = receivedPacks < line.remainingPacks;
            return (
              <div key={line.inventoryItemId} className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${isShort ? 'border-warning/40 bg-warning/5' : 'border-border-grey bg-secondary-surface'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-navy truncate">{line.name}</p>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Ordered: {Number(line.orderedPacks.toFixed(2))} {line.packLabel}
                    {line.alreadyReceivedPacks > 0 && ` • Already received: ${Number(line.alreadyReceivedPacks.toFixed(2))} ${line.packLabel}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isShort && <AlertTriangle className="h-4 w-4 text-warning-text shrink-0" />}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="w-20 text-center font-bold border border-border-grey rounded-xl py-2 text-sm bg-card-bg focus:outline-none focus:ring-2 focus:ring-accent"
                    value={line.receivedPacks}
                    onChange={(e) => updateReceived(line.inventoryItemId, e.target.value)}
                  />
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest w-16">{line.packLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-border-grey flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm}>Confirm Receipt</Button>
        </div>
      </div>
    </div>
  );
};
