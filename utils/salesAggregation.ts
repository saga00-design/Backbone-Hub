// Faithful extraction of Reports.tsx's Sales-tab per-order aggregation logic (the "V4 Rule"
// sanity checks: recalculating suspicious/missing VAT, and the stray-pence x100 correction
// when VAT or Service Charge exceeds Gross on an individual order). Confirmed solid in the
// Reports/Financial Command investigation — reused here verbatim rather than rewritten, so
// services/pnlEngine.ts computes sales the exact same way Reports.tsx already does.
//
// Reports.tsx still has its own inline copy of this logic for now (out of scope for this
// pass) — pointing it at this shared function instead is a good follow-up once pnlEngine.ts
// is proven out.
//
// This function does no date filtering — callers scope the `orders` array to the desired
// range before calling (e.g. via the 6am London business-day boundary in businessDay.ts).

import { normalizeCurrency } from './currencyUtils';

export interface SalesOrderLike {
  status?: string;
  createdAt: string;
  tips?: number;
  total?: number;
  financials?: {
    totalPaid?: number;
    vatTotal?: number;
    serviceChargeTotal?: number;
    discountTotal?: number;
    paymentTimestamp?: string | any;
  };
}

export interface SalesTotals {
  grossSalesAll: number;
  netSalesOnly: number; // Gross - VAT
  outputVat: number;
  serviceCharge: number;
  tips: number;
  discounts: number;
  profitTakeHome: number; // Gross - VAT - Service Charge
  totalPaid: number;
  orderCount: number;
}

export function aggregateOrderSales(orders: SalesOrderLike[]): SalesTotals {
  const totals: SalesTotals = {
    grossSalesAll: 0,
    netSalesOnly: 0,
    outputVat: 0,
    serviceCharge: 0,
    tips: 0,
    discounts: 0,
    profitTakeHome: 0,
    totalPaid: 0,
    orderCount: 0
  };

  orders.forEach(order => {
    if (order.status?.toLowerCase() !== 'paid') return;
    totals.orderCount++;
    const fin = order.financials || {};

    const pTotal = normalizeCurrency(fin.totalPaid || order.total || 0);
    const tTotal = normalizeCurrency(order.tips || 0);

    // Source of Truth: Gross Sales = Total Paid - Tips
    const gSales = Math.max(0, pTotal - tTotal);

    let vTotal = normalizeCurrency(fin.vatTotal || 0);
    let sTotal = normalizeCurrency(fin.serviceChargeTotal || 0);

    // Recalculate VAT if it's missing or suspicious (0 or same as Gross)
    if ((vTotal <= 0 || vTotal >= gSales) && gSales > 0) {
      const vatBase = Math.max(0, gSales - sTotal);
      vTotal = normalizeCurrency(vatBase - (vatBase / 1.2));
    }

    const dTotal = normalizeCurrency(fin.discountTotal || 0);

    // Component Sanity Check: VAT or Service can't exceed Gross per individual order
    if (vTotal > gSales && vTotal > 0) vTotal /= 100;
    if (sTotal > gSales && sTotal > 0) sTotal /= 100;

    totals.grossSalesAll += gSales;
    totals.outputVat += vTotal;
    totals.serviceCharge += sTotal;
    totals.tips += tTotal;
    totals.discounts += dTotal;
    totals.totalPaid += pTotal;

    const currentNetSales = gSales - vTotal;
    totals.netSalesOnly += currentNetSales;
    totals.profitTakeHome += (currentNetSales - sTotal);
  });

  return totals;
}
