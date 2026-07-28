import { Order, ReceivingRecord, InventoryItem } from '../types';
import { formatPacksLabel } from './unitConversions';

export interface ShortfallLine {
  inventoryItemId: string;
  name: string;
  orderedQuantity: number;   // base units
  receivedQuantity: number;  // base units, cumulative across every receiving session for this order
  shortfallQuantity: number; // base units
}

/**
 * Cumulative received-vs-ordered shortfall per line, recomputed fresh from the Order and every
 * ReceivingRecord tied to it. Deliberately ignores order.status — a manually closed order still
 * reports status 'Received' even with an outstanding shortfall, so status can't be used to decide
 * whether a shortage exists.
 */
export function getOrderShortfalls(order: Order, receivingRecords: ReceivingRecord[]): ShortfallLine[] {
  const sessionsForOrder = receivingRecords.filter(r => r.orderId === order.id);
  // No delivery has been attempted yet — nothing has come up short, it just hasn't arrived.
  if (sessionsForOrder.length === 0) return [];

  return order.items.reduce<ShortfallLine[]>((lines, orderItem) => {
    const receivedQuantity = sessionsForOrder.reduce((sum, session) => {
      const line = session.items.find(i => i.inventoryItemId === orderItem.inventoryItemId);
      return sum + (line?.receivedQuantity || 0);
    }, 0);
    const shortfallQuantity = orderItem.quantity - receivedQuantity;
    if (shortfallQuantity > 0.0001) {
      lines.push({
        inventoryItemId: orderItem.inventoryItemId,
        name: orderItem.name,
        orderedQuantity: orderItem.quantity,
        receivedQuantity,
        shortfallQuantity,
      });
    }
    return lines;
  }, []);
}

/** Builds a mailto: URL drafting a shortage notice — opened for review, never sent automatically. */
export function buildShortageEmailUrl(
  order: Order,
  shortfalls: ShortfallLine[],
  supplierEmail: string,
  inventoryItems: InventoryItem[]
): string {
  const formatQty = (baseQty: number, inventoryItemId: string) => {
    const invItem = inventoryItems.find(i => i.id === inventoryItemId);
    return invItem ? formatPacksLabel(baseQty, invItem) : `${baseQty}`;
  };

  const orderRef = order.id.slice(-6);
  const subject = `Shortage on order ${orderRef} - ${order.supplier}`;
  const lines = shortfalls
    .map(s => `- ${s.name}: ordered ${formatQty(s.orderedQuantity, s.inventoryItemId)}, received ${formatQty(s.receivedQuantity, s.inventoryItemId)}, missing ${formatQty(s.shortfallQuantity, s.inventoryItemId)}`)
    .join('\n');
  const body = `Hi,\n\nOur order from ${order.date} (ref ${orderRef}) arrived short on the following item${shortfalls.length > 1 ? 's' : ''}:\n\n${lines}\n\nCould you confirm whether these are still coming, or arrange a credit/replacement?\n\nThanks`;

  return `mailto:${supplierEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
