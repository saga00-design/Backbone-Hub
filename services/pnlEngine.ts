// Single source of truth for P&L-shaped figures across Financial Command (and, as a future
// step, Reports.tsx — see the note at the bottom of this file). Replaces the three separate,
// disagreeing calculations found during the Reports/Financial Command investigation:
// Reports.tsx's pnlSummary, Financial Command's old local `metrics`, and closureService.ts's
// embedded profitReport/vatReport.
//
// Conventions carried over unchanged from the existing app (not redefined here):
// - Sales: utils/salesAggregation.ts (Reports.tsx's Sales-tab sanity-checked logic, reused
//   verbatim — see that file for details).
// - COGS: recipe-theoretical ingredient cost at time of sale, as already computed by
//   closureService.ts and stored on each DailyClosure. This engine does not recompute COGS
//   from recipes/inventory — it reads the existing closure-level figure, correctly scoped.
// - "Net Revenue" = Gross Sales − VAT − Service Charge (matches the P&L waterfall order
//   Gross Sales → VAT/Service Charge → Net Revenue → COGS → Labour → OpEx → Waste → Profit).
//
// Date scoping: POS orders are bucketed to a business day via the 6am London cutoff
// (utils/businessDay.ts) before being compared against the input range. Closures, labour
// shifts, expenses, waste, and stock counts already store a business-day-keyed `date` string,
// so they're compared directly against the range's date keys. Closures are ALWAYS filtered to
// ClosureType.DAY only — a business day can have several SHIFT closures sharing one date,
// which previously double-counted revenue/COGS/labour/VAT in both Reports.tsx and Financial
// Command (the same bug already found and fixed in Labour Intelligence's trend chart, A2).
//
// No AI/LLM calls anywhere in this file — pure arithmetic over already-loaded data.

import {
  DailyClosure,
  ClosureType,
  LabourShift,
  ExpenseRecord,
  WasteRecord,
  StockCountRecord
} from '../types';
import { getBusinessDayFor } from '../utils/businessDay';
import { DateRange, toDateKey } from '../utils/fiscalCalendar';
import { aggregateOrderSales, SalesOrderLike } from '../utils/salesAggregation';

export interface PnlEngineParams {
  range: DateRange;
  // Primary sales source for all headline figures (Gross Sales, VAT, Service Charge, Net
  // Revenue) — pass liveSalesData.history, matching Reports.tsx's Sales tab exactly.
  posOrders: SalesOrderLike[];
  // A genuinely SEPARATE record of orders (e.g. the `orders`/posOrders collection prop, as
  // distinct from liveSalesData.history) used only for the Consistency Audit. The whole point
  // of that audit is comparing two independently-recorded totals — if this is omitted, it
  // falls back to `posOrders`, which makes the audit trivially always balanced.
  rawOrdersForAudit?: SalesOrderLike[];
  closures: DailyClosure[];
  labourShifts: LabourShift[];
  expenseRecords: ExpenseRecord[];
  wasteRecords: WasteRecord[];
  stockCountRecords: StockCountRecord[];
}

export interface PnlEngineResult {
  rangeStart: string; // YYYY-MM-DD
  rangeEnd: string;

  // Sales (from raw POS orders, business-day scoped)
  grossSales: number;
  vat: number;
  serviceCharge: number;
  discounts: number;
  netRevenue: number; // grossSales - vat - serviceCharge
  orderCount: number;

  // Costs
  cogs: number;
  cogsPercent: number; // % of netRevenue
  labour: number;
  labourPercent: number; // % of netRevenue
  operatingExpenses: number;
  operatingExpensesByCategory: Record<string, number>;
  waste: number;
  stockVariance: number; // signed: negative = shrinkage/loss, positive = overage. Informational only — NOT subtracted in netProfit.

  // Bottom line: Net Revenue - COGS - Labour - Operating Expenses - Waste
  netProfit: number;

  // Consistency Audit: two independently-recorded totals, scoped to the SAME business-day
  // range on both sides (previously each side used different date logic entirely).
  posRawSales: number;   // aggregateOrderSales() total over business-day-scoped rawOrdersForAudit
  hubClosureSales: number; // sum of totals.grossSales across ClosureType.DAY closures in range
  consistencyVariance: number; // posRawSales - hubClosureSales
}

function isWithinRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

export function resolveOrderBusinessDay(order: SalesOrderLike): string {
  const raw = order.financials?.paymentTimestamp || order.createdAt;
  const ts = new Date(raw);
  if (isNaN(ts.getTime())) return '';
  return getBusinessDayFor(ts); // already returns a YYYY-MM-DD string
}

export function computePnl(params: PnlEngineParams): PnlEngineResult {
  const { range, posOrders, rawOrdersForAudit, closures, labourShifts, expenseRecords, wasteRecords, stockCountRecords } = params;
  const startKey = toDateKey(range.start);
  const endKey = toDateKey(range.end);

  // --- Sales: raw POS orders, business-day scoped, via the shared sanity-checked aggregator ---
  const scopedOrders = posOrders.filter(o => {
    const dayKey = resolveOrderBusinessDay(o);
    return dayKey && isWithinRange(dayKey, startKey, endKey);
  });
  const salesTotals = aggregateOrderSales(scopedOrders);

  const grossSales = salesTotals.grossSalesAll;
  const vat = salesTotals.outputVat;
  const serviceCharge = salesTotals.serviceCharge;
  const discounts = salesTotals.discounts;
  const netRevenue = grossSales - vat - serviceCharge;

  // --- Closures: DAY type only, date-range scoped (no limit() truncation — caller passes
  // an already appropriately-loaded closures array; see App.tsx query for the removed cap) ---
  const dayClosuresInRange = closures.filter(c => {
    if (c.type !== ClosureType.DAY) return false;
    return isWithinRange(toDateKey(new Date(c.date)), startKey, endKey);
  });

  const cogs = dayClosuresInRange.reduce((acc, c) => acc + (c.totals?.cogs || 0), 0);
  const hubClosureSales = dayClosuresInRange.reduce((acc, c) => acc + (c.totals?.grossSales || 0), 0);

  // --- Labour: labourShifts, date-range scoped ---
  const labour = labourShifts
    .filter(s => isWithinRange(s.date, startKey, endKey))
    .reduce((acc, s) => acc + (s.totalCost || 0), 0);

  // --- Operating expenses: approved only, date-range scoped, grouped by category ---
  const operatingExpensesByCategory: Record<string, number> = {};
  let operatingExpenses = 0;
  expenseRecords.forEach(exp => {
    if (exp.status !== 'Approved') return;
    if (!isWithinRange(exp.date, startKey, endKey)) return;
    operatingExpensesByCategory[exp.category] = (operatingExpensesByCategory[exp.category] || 0) + exp.amount;
    operatingExpenses += exp.amount;
  });

  // --- Waste: date-range scoped ---
  const waste = wasteRecords
    .filter(w => isWithinRange(toDateKey(new Date(w.date)), startKey, endKey))
    .reduce((acc, w) => acc + (w.cost || 0), 0);

  // --- Stock variance: date-range scoped, kept separate from COGS per the investigation's
  // finding that this real shrinkage data currently isn't aggregated into any report ---
  const stockVariance = stockCountRecords
    .filter(sc => isWithinRange(toDateKey(new Date(sc.date)), startKey, endKey))
    .reduce((acc, sc) => acc + sc.items.reduce((itemAcc, item) => itemAcc + (item.varianceValue || 0), 0), 0);

  const netProfit = netRevenue - cogs - labour - operatingExpenses - waste;

  // --- Consistency Audit: two independently-recorded totals, same business-day-scoped range
  // on both sides (previously each side used different date-matching logic entirely) ---
  const auditSourceOrders = rawOrdersForAudit ?? posOrders;
  const scopedAuditOrders = auditSourceOrders.filter(o => {
    const dayKey = resolveOrderBusinessDay(o);
    return dayKey && isWithinRange(dayKey, startKey, endKey);
  });
  const posRawSales = aggregateOrderSales(scopedAuditOrders).grossSalesAll;
  const consistencyVariance = posRawSales - hubClosureSales;

  return {
    rangeStart: startKey,
    rangeEnd: endKey,
    grossSales,
    vat,
    serviceCharge,
    discounts,
    netRevenue,
    orderCount: salesTotals.orderCount,
    cogs,
    cogsPercent: netRevenue > 0 ? (cogs / netRevenue) * 100 : 0,
    labour,
    labourPercent: netRevenue > 0 ? (labour / netRevenue) * 100 : 0,
    operatingExpenses,
    operatingExpensesByCategory,
    waste,
    stockVariance,
    netProfit,
    posRawSales,
    hubClosureSales,
    consistencyVariance
  };
}

// Reports.tsx's Sales tab (filteredOrders/salesReport) and its 'pnl' tab (pnlSummary) now
// also invoke aggregateOrderSales()/computePnl() from here — see Reports.tsx for how it wires
// its own labourShifts/wasteRecords/stockCountRecords/closures into the same shared engine.
// This removed the last of the three originally-disagreeing P&L implementations.
