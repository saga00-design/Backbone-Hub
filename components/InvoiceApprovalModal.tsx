import React, { useState, useMemo } from 'react';
import { Invoice, Order, ReceivingRecord, InventoryItem, SupplierPriceHistoryEntry, Unit } from '../types';
import { X, CheckCircle, AlertTriangle, ArrowUp, ArrowDown, LinkIcon } from 'lucide-react';
import { Button } from './Button';
import { resolveInvoiceLine } from '../utils/unitConversions';

interface InvoiceApprovalModalProps {
  invoice: Invoice | null;
  orders: Order[];
  receivingRecords: ReceivingRecord[];
  inventoryItems: InventoryItem[];
  supplierPriceHistory: SupplierPriceHistoryEntry[];
  onClose: () => void;
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void;
  onApprove: (invoice: Invoice) => void;
}

interface LineCheck {
  index: number;
  name: string;
  invItem?: InventoryItem;
  quantityInBase: number;
  pricePerBase: number;
  qtyFlag?: { invoicedBase: number; receivedBase: number };
  priceFlag?: { previousPrice: number; newPrice: number; diff: number; percent: number; direction: 'up' | 'down' };
}

const QTY_EPSILON = 0.01; // base units — floating point noise tolerance, not a real mismatch
const PRICE_EPSILON = 0.0001; // £ per base unit

export const InvoiceApprovalModal: React.FC<InvoiceApprovalModalProps> = ({
  invoice, orders, receivingRecords, inventoryItems, supplierPriceHistory, onClose, onUpdateInvoice, onApprove
}) => {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const linkedOrder = invoice?.orderId ? orders.find(o => o.id === invoice.orderId) : undefined;

  const candidateOrders = useMemo(() => {
    if (!invoice) return [];
    return orders.filter(o =>
      o.supplier.toLowerCase() === invoice.vendor.toLowerCase() &&
      (o.status === 'Sent' || o.status === 'Partially Received' || o.status === 'Received')
    );
  }, [orders, invoice]);

  const lines: LineCheck[] = useMemo(() => {
    if (!invoice) return [];

    const cumulativeReceivedByItem: Record<string, number> = {};
    if (linkedOrder) {
      for (const rec of receivingRecords.filter(r => r.orderId === linkedOrder.id)) {
        for (const line of rec.items) {
          cumulativeReceivedByItem[line.inventoryItemId] = (cumulativeReceivedByItem[line.inventoryItemId] || 0) + line.receivedQuantity;
        }
      }
    }

    return invoice.items.map((item, index) => {
      const unit = (item.unit || 'pcs') as Unit;
      const { invItem, quantityInBase, pricePerBase } = resolveInvoiceLine(item.name, item.quantity, unit, item.price, inventoryItems);

      let qtyFlag: LineCheck['qtyFlag'];
      if (linkedOrder && invItem) {
        const receivedBase = cumulativeReceivedByItem[invItem.id] || 0;
        if (Math.abs(quantityInBase - receivedBase) > QTY_EPSILON) {
          qtyFlag = { invoicedBase: quantityInBase, receivedBase };
        }
      }

      let priceFlag: LineCheck['priceFlag'];
      if (invItem) {
        const previous = supplierPriceHistory
          .filter(e => e.inventoryItemId === invItem.id && e.supplier.toLowerCase() === invoice.vendor.toLowerCase())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (previous && Math.abs(previous.price - pricePerBase) > PRICE_EPSILON) {
          const diff = pricePerBase - previous.price;
          const percent = previous.price > 0 ? (diff / previous.price) * 100 : 0;
          priceFlag = { previousPrice: previous.price, newPrice: pricePerBase, diff, percent, direction: diff > 0 ? 'up' : 'down' };
        }
      }

      return { index, name: item.name, invItem, quantityInBase, pricePerBase, qtyFlag, priceFlag };
    });
  }, [invoice, linkedOrder, receivingRecords, inventoryItems, supplierPriceHistory]);

  if (!invoice) return null;

  const flagKeys: string[] = [];
  lines.forEach(l => {
    if (l.qtyFlag) flagKeys.push(`${l.index}-qty`);
    if (l.priceFlag) flagKeys.push(`${l.index}-price`);
  });
  const allAcknowledged = flagKeys.every(k => acknowledged.has(k));

  const toggleAck = (key: string) => {
    setAcknowledged(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleApprove = () => {
    onApprove(invoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Review &amp; Approve Invoice</h3>
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">{invoice.vendor} — {invoice.date}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-xl transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Order linking */}
          <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
            {linkedOrder ? (
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                <LinkIcon className="h-3.5 w-3.5" />
                Linked to order from {linkedOrder.date} (£{linkedOrder.totalAmount.toFixed(2)})
                <button onClick={() => onUpdateInvoice(invoice.id, { orderId: undefined })} className="ml-auto text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 normal-case font-bold">Unlink</button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  Link to the Stock Order this invoice is for, to check invoiced quantities against what was actually received
                </label>
                <select
                  className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent"
                  value=""
                  onChange={(e) => e.target.value && onUpdateInvoice(invoice.id, { orderId: e.target.value })}
                >
                  <option value="">
                    {candidateOrders.length === 0 ? 'No matching orders found — skip linking' : 'Select an order...'}
                  </option>
                  {candidateOrders.map(o => (
                    <option key={o.id} value={o.id}>{o.date} — £{o.totalAmount.toFixed(2)} ({o.status})</option>
                  ))}
                </select>
                {candidateOrders.length === 0 && (
                  <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    No open or received order from {invoice.vendor} found. You can still approve — only the quantity check will be skipped.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="space-y-3">
            {lines.map(line => {
              const hasFlags = line.qtyFlag || line.priceFlag;
              return (
                <div key={line.index} className={`p-4 rounded-xl border ${hasFlags ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-100 dark:border-slate-800'}`}>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{line.name}</p>

                  {line.qtyFlag && (
                    <div className="mt-2 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                          Invoiced: {line.qtyFlag.invoicedBase} {line.invItem?.baseUnit} — Received: {line.qtyFlag.receivedBase} {line.invItem?.baseUnit} — mismatch
                        </p>
                        <label className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acknowledged.has(`${line.index}-qty`)}
                            onChange={() => toggleAck(`${line.index}-qty`)}
                            className="rounded"
                          />
                          I've reviewed this quantity mismatch — approve anyway
                        </label>
                      </div>
                    </div>
                  )}

                  {line.priceFlag && (
                    <div className="mt-2 flex items-start gap-2">
                      {line.priceFlag.direction === 'up' ? (
                        <ArrowUp className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                          Price {line.priceFlag.direction} from {invoice.vendor}: £{line.priceFlag.previousPrice.toFixed(4)} → £{line.priceFlag.newPrice.toFixed(4)}
                          {' '}({line.priceFlag.diff > 0 ? '+' : ''}£{line.priceFlag.diff.toFixed(4)}, {line.priceFlag.percent > 0 ? '+' : ''}{line.priceFlag.percent.toFixed(1)}%)
                        </p>
                        <label className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acknowledged.has(`${line.index}-price`)}
                            onChange={() => toggleAck(`${line.index}-price`)}
                            className="rounded"
                          />
                          I've reviewed this price change — approve anyway
                        </label>
                      </div>
                    </div>
                  )}

                  {!hasFlags && (
                    <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> Matches — no flags
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
            {flagKeys.length === 0 ? 'No flags on this invoice.' : `${flagKeys.length} flag${flagKeys.length !== 1 ? 's' : ''} — all must be acknowledged to approve.`}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button variant="primary" onClick={handleApprove} disabled={!allAcknowledged} className="rounded-xl">
              Approve Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
