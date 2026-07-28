import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Target, Zap, Shield,
  PoundSterling, Calculator, Clock, Receipt,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  Lock, PieChart, BarChart3, HelpCircle, FileText, Download,
  ChevronRight, Play, Eye, Users, Plus, Calendar,
  Package, LayoutDashboard, X, Tag, History
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { Button } from './Button';
import {
  DailyClosure, POSOrder, StaffMember,
  Liability, AIAction,
  InventoryItem, Recipe, LabourShift, ExpenseRecord, WasteRecord, StockCountRecord
} from '../types';
import { db, LOCATION_ID } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { generateFinancialPackPDF } from '../services/pdfService';
import { computePnl, PnlEngineResult } from '../services/pnlEngine';
import { DateRange, getCurrentPeriod, getWeekRange, listPeriods, toDateKey } from '../utils/fiscalCalendar';

interface FinancialCommandCenterProps {
  closures: DailyClosure[];
  orders: POSOrder[]; // Hub's own order log — used as the independent side of the Consistency Audit
  liveSalesData: { history: any[]; aggregate: any }; // primary sales source, matches Reports.tsx's Sales tab
  staff: StaffMember[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  forecasts: any[];
  expenseRecords: ExpenseRecord[];
  wasteRecords: WasteRecord[];
  stockCountRecords: StockCountRecord[];
  onOpenView: (view: any) => void;
}

type PeriodMode = 'Weekly' | 'Period' | 'Monthly' | 'Quarterly';

interface LiveAlert {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  message: string;
  description: string;
}

function resolveSelectedRange(mode: PeriodMode, quarter: 1 | 2 | 3 | 4): DateRange {
  const now = new Date();
  if (mode === 'Weekly') return getWeekRange(now);
  if (mode === 'Period') {
    const p = getCurrentPeriod(now);
    return { start: p.start, end: p.end };
  }
  if (mode === 'Quarterly') {
    const qStartMonth = (quarter - 1) * 3;
    const start = new Date(now.getFullYear(), qStartMonth, 1);
    const end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }
  // Monthly (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

const money = (v: number) => `£${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const FinancialCommandCenter: React.FC<FinancialCommandCenterProps> = ({
  closures,
  orders,
  liveSalesData,
  staff,
  inventory,
  recipes,
  forecasts,
  expenseRecords,
  wasteRecords,
  stockCountRecords,
  onOpenView
}) => {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [aiActions, setAiActions] = useState<AIAction[]>([]);
  const [investorMode, setInvestorMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pnl' | 'cashflow' | 'vat' | 'ai'>('overview');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('Monthly');
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(Math.floor(new Date().getMonth() / 3 + 1) as any);
  const [showHistoricalReturns, setShowHistoricalReturns] = useState(false);
  const [marginTargetPercent, setMarginTargetPercent] = useState(65);
  const [liabilityAlertDays, setLiabilityAlertDays] = useState(7);

  // Real-time data subscriptions. Note: the old `cashflow` collection subscription has been
  // removed — that collection is seed/placeholder data only (see services/restaurantService.ts),
  // with no real write path anywhere in the app. The Cashflow tab now computes its own figures
  // from real transactions via pnlEngine instead. Same for the old `alerts` collection — Live
  // Alerts are now computed locally (see liveAlerts below), not read from Firestore.
  useEffect(() => {
    const unsubLiabilities = onSnapshot(
      query(collection(db, 'liabilities'), where('locationId', '==', LOCATION_ID), orderBy('dueDate', 'asc')),
      (snap) => setLiabilities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Liability)))
    );

    const unsubAiActions = onSnapshot(
      query(collection(db, 'aiActions'), where('locationId', '==', LOCATION_ID), orderBy('timestamp', 'desc'), limit(10)),
      (snap) => setAiActions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AIAction)))
    );

    return () => {
      unsubLiabilities();
      unsubAiActions();
    };
  }, []);

  // Labour Intelligence Shifts
  const [labourShifts, setLabourShifts] = useState<LabourShift[]>([]);

  useEffect(() => {
    const unsubLabour = onSnapshot(
      query(collection(db, 'labourShifts'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc')),
      (snap) => setLabourShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabourShift)))
    );
    return () => unsubLabour();
  }, []);

  // --- Single source of truth: pnlEngine, computed for two ranges ---
  // Overview always shows the CURRENT fiscal period-to-date. The P&L/Cashflow/VAT tabs share
  // a user-adjustable range (Week/Period/Month/Quarter).
  const overviewRange = useMemo(() => {
    const p = getCurrentPeriod();
    return { start: p.start, end: p.end };
  }, []);

  const selectedRange = useMemo(
    () => resolveSelectedRange(periodMode, selectedQuarter),
    [periodMode, selectedQuarter]
  );

  const pnlInputs = { closures, labourShifts, expenseRecords, wasteRecords, stockCountRecords };

  const overviewPnl: PnlEngineResult = useMemo(() => computePnl({
    range: overviewRange,
    posOrders: liveSalesData.history,
    rawOrdersForAudit: orders,
    ...pnlInputs
  }), [overviewRange, liveSalesData, orders, closures, labourShifts, expenseRecords, wasteRecords, stockCountRecords]);

  const selectedPnl: PnlEngineResult = useMemo(() => computePnl({
    range: selectedRange,
    posOrders: liveSalesData.history,
    rawOrdersForAudit: orders,
    ...pnlInputs
  }), [selectedRange, liveSalesData, orders, closures, labourShifts, expenseRecords, wasteRecords, stockCountRecords]);

  // Fixed-cost break-even threshold: the period's actual approved Rent/Rates/Insurance spend
  // (same "fixed cost" classification already used elsewhere in the app), not a hardcoded £0.
  const breakEven = useMemo(() => {
    const fixedCategories = ['rent', 'rates', 'insurance'];
    return Object.entries(overviewPnl.operatingExpensesByCategory)
      .filter(([cat]) => fixedCategories.some(f => cat.toLowerCase().includes(f)))
      .reduce((acc, [, val]) => acc + val, 0);
  }, [overviewPnl]);

  // No real bank-balance/ledger tracking exists anywhere in the app (confirmed in the
  // Reports/Financial Command investigation) — Safe Cash is honestly computed as this period's
  // profit minus pending liabilities, not a fabricated "cash on hand" figure.
  const pendingLiabilitiesTotal = useMemo(
    () => liabilities.filter(l => l.status === 'Pending').reduce((acc, l) => acc + l.amount, 0),
    [liabilities]
  );
  const safeCash = overviewPnl.netProfit - pendingLiabilitiesTotal;

  // --- Cashflow tab: real weekly Cash In / Cash Out, computed via pnlEngine, not the fake seed collection ---
  const cashflowSeries = useMemo(() => {
    const weeks: DateRange[] = Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (7 - i) * 7);
      return getWeekRange(d);
    });
    return weeks.map(range => {
      const pnl = computePnl({ range, posOrders: liveSalesData.history, rawOrdersForAudit: orders, ...pnlInputs });
      return {
        week: `${range.start.getDate()}/${range.start.getMonth() + 1}`,
        cashIn: Math.round(pnl.grossSales * 100) / 100,
        cashOut: Math.round((pnl.cogs + pnl.labour + pnl.operatingExpenses + pnl.waste) * 100) / 100
      };
    });
  }, [liveSalesData, orders, closures, labourShifts, expenseRecords, wasteRecords, stockCountRecords]);

  // --- VAT tab: only claim reconciliation when the Consistency Audit for this range is actually clean ---
  const isReconciled = Math.abs(selectedPnl.consistencyVariance) < 1;
  const vatReclaimableEst = selectedPnl.cogs * 0.2; // VAT on purchases, estimated at standard rate on COGS
  const netVatPayable = selectedPnl.vat - vatReclaimableEst;

  const historicalPeriods = useMemo(() => {
    if (!showHistoricalReturns) return [];
    const current = getCurrentPeriod();
    return listPeriods(current.fiscalYear)
      .filter(p => p.periodNumber <= current.periodNumber)
      .slice(-6)
      .reverse()
      .map(p => {
        const pnl = computePnl({ range: { start: p.start, end: p.end }, posOrders: liveSalesData.history, rawOrdersForAudit: orders, ...pnlInputs });
        return { periodNumber: p.periodNumber, start: toDateKey(p.start), end: toDateKey(p.end), vat: pnl.vat };
      });
  }, [showHistoricalReturns, liveSalesData, orders, closures, labourShifts, expenseRecords, wasteRecords, stockCountRecords]);

  // --- Live Alerts: deterministic, zero AI/LLM cost, recomputed on every render from real data ---
  const liveAlerts: LiveAlert[] = useMemo(() => {
    const out: LiveAlert[] = [];

    // Duplicate liability safety net — root cause fixed at the source (deterministic seed IDs
    // + a loading-state guard on the seed button), kept here as a defensive check in case
    // duplicates ever reappear from another path.
    const seen = new Map<string, number>();
    liabilities.forEach(l => {
      const key = `${l.name}|${l.amount}|${l.dueDate}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    const dupeNames = Array.from(seen.entries()).filter(([, count]) => count > 1).map(([key]) => key.split('|')[0]);
    if (dupeNames.length > 0) {
      out.push({
        id: 'dup-liabilities',
        severity: 'Warning',
        message: `Duplicate liability entries detected`,
        description: `${dupeNames.join(', ')} — appears more than once. Review the Liabilities list.`
      });
    }

    // Gross margin below configurable target
    const grossMarginPercent = overviewPnl.netRevenue > 0
      ? ((overviewPnl.netRevenue - overviewPnl.cogs) / overviewPnl.netRevenue) * 100
      : 0;
    if (overviewPnl.netRevenue > 0 && grossMarginPercent < marginTargetPercent) {
      out.push({
        id: 'low-margin',
        severity: 'Warning',
        message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below your ${marginTargetPercent}% target`,
        description: `This period: Net Revenue ${money(overviewPnl.netRevenue)}, COGS ${money(overviewPnl.cogs)}.`
      });
    }

    // Liabilities due soon exceeding Safe Cash
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + liabilityAlertDays);
    const dueSoon = liabilities.filter(l => l.status === 'Pending' && new Date(l.dueDate) <= cutoff);
    const dueSoonTotal = dueSoon.reduce((acc, l) => acc + l.amount, 0);
    if (dueSoon.length > 0 && dueSoonTotal > safeCash) {
      out.push({
        id: 'liabilities-exceed-cash',
        severity: 'Critical',
        message: `${money(dueSoonTotal)} due within ${liabilityAlertDays} days exceeds Safe Cash (${money(safeCash)})`,
        description: dueSoon.map(l => `${l.name} — ${money(l.amount)} due ${l.dueDate}`).join('; ')
      });
    }

    return out;
  }, [liabilities, overviewPnl, marginTargetPercent, liabilityAlertDays, safeCash]);

  const handleApproveAction = async (action: AIAction) => {
    try {
      const actionRef = doc(db, 'aiActions', action.id);
      await updateDoc(actionRef, {
        status: 'Approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Financial Director'
      });
      toast.success('Action approved and scheduled for execution');
    } catch (error) {
      toast.error('Failed to approve action');
    }
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // AI Decision Center: on-demand only (this handler is never called automatically — only from
  // the "Run AI Diagnostic" button below). Results persist to Firestore's aiActions collection
  // and are shown until the button is clicked again, so viewing this tab never re-triggers
  // generation. Grounded in real pnlEngine output rather than raw arrays the model would
  // otherwise have to (incorrectly) aggregate itself.
  const handleRunAIAnalysis = async () => {
    setIsGeneratingAI(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { generateFinancialInsights } = await import('../services/aiDecisionService');
      await generateFinancialInsights(
        today,
        closures,
        orders,
        inventory,
        liabilities,
        forecasts,
        labourShifts,
        {
          grossSales: overviewPnl.grossSales,
          netRevenue: overviewPnl.netRevenue,
          netProfit: overviewPnl.netProfit,
          cogs: overviewPnl.cogs,
          cogsPercent: overviewPnl.cogsPercent,
          labour: overviewPnl.labour,
          labourPercent: overviewPnl.labourPercent,
          operatingExpenses: overviewPnl.operatingExpenses,
          waste: overviewPnl.waste,
          stockVariance: overviewPnl.stockVariance,
          safeCash,
          pendingLiabilitiesTotal
        }
      );
      toast.success('AI Analysis complete. New recommendations generated.');
    } catch (error) {
      toast.error('AI Analysis failed');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const pdfMetrics = {
    grossSales: overviewPnl.grossSales,
    netRevenue: overviewPnl.netRevenue,
    realProfit: overviewPnl.netProfit,
    labourPercent: overviewPnl.labourPercent,
    cogsPercent: overviewPnl.cogsPercent,
    safeCash,
    variance: overviewPnl.consistencyVariance
  };

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER & INVESTOR TOGGLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-navy tracking-tight uppercase">Financial Command Center</h1>
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-3 h-3 text-accent" /> Secure Financial Truth & Operational Intelligence
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleRunAIAnalysis}
            disabled={isGeneratingAI}
            className="gap-2 bg-text-navy hover:bg-slate-800 text-white border-none"
          >
            {isGeneratingAI ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-accent fill-accent" />
            )}
            Run AI Diagnostic
          </Button>
          <Button
            variant={investorMode ? 'primary' : 'secondary'}
            onClick={() => setInvestorMode(!investorMode)}
            className="gap-2 px-6 h-12"
          >
            {investorMode ? <Shield className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {investorMode ? 'Investor Mode Active' : 'Investor Dashboard'}
          </Button>
          <Button
            variant="secondary"
            className="h-12 w-12 p-0 justify-center"
            onClick={() => {
              toast.info('Generating financial pack...');
              generateFinancialPackPDF(pdfMetrics, closures, liabilities, investorMode);
              toast.success('Financial pack downloaded successfully');
            }}
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* KPI TOP BAR — Overview period-to-date, all from pnlEngine */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Gross Sales', value: overviewPnl.grossSales, icon: BarChart3, color: 'text-text-navy' },
          { label: 'Net Revenue', value: overviewPnl.netRevenue, icon: PoundSterling, color: 'text-text-navy' },
          { label: 'Net Profit', value: overviewPnl.netProfit, icon: TrendingUp, color: overviewPnl.netProfit > 0 ? 'text-success' : 'text-cta' },
          { label: 'VAT Liability', value: overviewPnl.vat, icon: Shield, color: 'text-amber-600' },
          { label: 'Labour %', value: `${overviewPnl.labourPercent.toFixed(1)}%`, icon: Clock, color: overviewPnl.labourPercent > 30 ? 'text-cta' : 'text-success' },
          { label: 'COGS %', value: `${overviewPnl.cogsPercent.toFixed(1)}%`, icon: Package, color: overviewPnl.cogsPercent > 35 ? 'text-cta' : 'text-success' },
          { label: 'Safe Cash', value: safeCash, icon: Zap, color: safeCash > 0 ? 'text-accent' : 'text-cta' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-card-bg p-4 rounded-2xl border border-border-grey shadow-sm hover:border-accent transition-all group relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <kpi.icon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              <ArrowUpRight className="w-3 h-3 text-success opacity-0 group-hover:opacity-100" />
            </div>
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">{kpi.label}</p>
            <p className={`text-lg font-black tracking-tight ${kpi.color}`}>
              {typeof kpi.value === 'number' ? money(kpi.value) : kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAIN DASHBOARD CONTENT */}
        <div className="lg:col-span-2 space-y-8">

          {/* NAVIGATION TABS */}
          <div className="flex items-center gap-2 bg-secondary-surface p-1 rounded-xl w-fit border border-border-grey">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'pnl', label: 'Profit & Loss', icon: Calculator },
              { id: 'cashflow', label: 'Cashflow', icon: Zap },
              { id: 'vat', label: 'VAT Returns', icon: Shield },
              { id: 'ai', label: 'AI Actions', icon: Zap }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-card-bg text-accent shadow-sm border border-border-grey'
                    : 'text-text-muted hover:text-text-navy'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* 1. REVENUE VS BREAK-EVEN */}
                <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-32 -mt-32" />

                  <div className="flex items-start justify-between relative z-10 mb-8">
                    <div>
                      <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Break-Even Analysis</h3>
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Current period · Fixed costs (Rent, Rates, Insurance)</p>
                    </div>
                  </div>

                  <div className="space-y-6 relative z-10">
                    {breakEven === 0 ? (
                      <div className="p-4 bg-secondary-surface border border-border-grey rounded-2xl text-xs font-bold text-text-muted">
                        No approved Rent/Rates/Insurance expenses logged for this period yet — break-even can't be calculated until fixed costs are entered in Expenses.
                      </div>
                    ) : (
                      <>
                        <div className="h-4 w-full bg-secondary-surface rounded-full overflow-hidden flex border border-border-grey">
                          <div
                            className="h-full bg-cta transition-all duration-1000"
                            style={{ width: `${Math.min(100, Math.max(0, (overviewPnl.netRevenue / breakEven) * 100))}%` }}
                          />
                          <div
                            className="h-full bg-success transition-all duration-1000"
                            style={{ width: `${Math.max(0, (overviewPnl.netRevenue / breakEven) * 100 - 100)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-secondary-surface rounded-2xl border border-border-grey">
                            <p className="text-[10px] font-black text-text-muted uppercase mb-1">Break-Even</p>
                            <p className="text-lg font-black text-text-navy">{money(breakEven)}</p>
                          </div>
                          <div className="text-center p-4 bg-card-bg border-2 border-accent rounded-2xl shadow-lg transform -translate-y-2">
                            <p className="text-[10px] font-black text-accent uppercase mb-1">Current Revenue</p>
                            <p className="text-xl font-black text-text-navy">{money(overviewPnl.netRevenue)}</p>
                          </div>
                          <div className="text-center p-4 bg-secondary-surface rounded-2xl border border-border-grey">
                            <p className="text-[10px] font-black text-text-muted uppercase mb-1">Profit Zone</p>
                            <p className="text-lg font-black text-success">
                              {overviewPnl.netProfit > 0 ? `+${money(overviewPnl.netProfit)}` : money(0)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl flex items-center gap-4">
                      <Zap className="w-5 h-5 text-accent" />
                      <p className="text-sm font-bold text-text-navy">
                        {overviewPnl.netProfit < 0
                          ? `You need ${money(Math.abs(overviewPnl.netProfit))} more revenue to reach break-even this period.`
                          : "You are in the Profit Zone! Every additional £1 of sales now contributes directly to the bottom line."
                        }
                      </p>
                    </div>

                    {/* CONSISTENCY AUDIT SECTION */}
                    <div className="bg-secondary-surface p-4 rounded-2xl border border-border-grey space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-4 h-4 ${Math.abs(overviewPnl.consistencyVariance) < 1 ? 'text-success' : 'text-cta'}`} />
                          <h4 className="text-xs font-black text-text-navy uppercase tracking-widest">Consistency Audit (POS vs HUB)</h4>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${Math.abs(overviewPnl.consistencyVariance) < 1 ? 'bg-success text-white' : 'bg-cta text-white'}`}>
                          {Math.abs(overviewPnl.consistencyVariance) < 1 ? 'Balanced' : 'Discrepancy Detected'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">POS Sales (Raw)</p>
                          <p className="text-sm font-black text-text-navy">{money(overviewPnl.posRawSales)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">HUB Sales (Closure)</p>
                          <p className="text-sm font-black text-text-navy">{money(overviewPnl.hubClosureSales)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Variance</p>
                          <p className={`text-sm font-black ${Math.abs(overviewPnl.consistencyVariance) < 1 ? 'text-success' : 'text-cta'}`}>
                            {overviewPnl.consistencyVariance > 0 ? '+' : ''}{money(overviewPnl.consistencyVariance)}
                          </p>
                        </div>
                      </div>
                      {overviewPnl.hubClosureSales === 0 && (
                        <p className="text-[10px] font-bold text-text-muted italic">No DAY closures on file for this period yet — HUB Sales stays at £0 until one's performed. This isn't a discrepancy, it's missing closure data.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. CASHFLOW MONITOR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
                    <h4 className="text-xs font-black text-text-navy uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent" /> Safe Cash (Period Estimate)
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-text-muted">Net Profit This Period</span>
                        <span className="text-sm font-black text-text-navy">{money(overviewPnl.netProfit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-cta">
                        <span className="text-sm font-medium">Pending Liabilities</span>
                        <span className="text-sm font-black">-{money(pendingLiabilitiesTotal)}</span>
                      </div>
                      <div className="pt-4 border-t border-border-grey flex justify-between items-center">
                        <span className="text-lg font-black text-text-navy">Safe Cash</span>
                        <span className={`text-2xl font-black ${safeCash > 0 ? 'text-success' : 'text-cta'}`}>
                          {money(safeCash)}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest italic">Estimate only — no bank balance/ledger integration exists yet in Backbone Hub.</p>
                    </div>
                  </div>

                  <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
                    <h4 className="text-xs font-black text-text-navy uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-accent" /> Upcoming Liabilities
                    </h4>
                    <div className="space-y-3">
                      {liabilities.filter(l => l.status === 'Pending').length === 0 ? (
                        <p className="text-center py-8 text-xs font-bold text-text-muted uppercase tracking-widest">No pending liabilities</p>
                      ) : (
                        liabilities.filter(l => l.status === 'Pending').slice(0, 4).map(l => (
                          <div key={l.id} className="flex items-center justify-between p-3 bg-secondary-surface rounded-xl border border-border-grey">
                            <div>
                              <p className="text-xs font-black text-text-navy uppercase">{l.name}</p>
                              <p className="text-[10px] font-bold text-text-muted uppercase">Due {l.dueDate}</p>
                            </div>
                            <p className="text-sm font-black text-text-navy">{money(l.amount)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pnl' && (
              <motion.div
                key="pnl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm">
                  <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Statement of Profit & Loss</h3>
                    <div className="flex gap-2 flex-wrap">
                      {(['Weekly', 'Period', 'Monthly', 'Quarterly'] as PeriodMode[]).map(mode => (
                        <Button
                          key={mode}
                          variant={periodMode === mode ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setPeriodMode(mode)}
                        >
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {periodMode === 'Quarterly' && (
                    <div className="flex gap-2 mb-6 p-2 bg-secondary-surface rounded-xl">
                      {[1, 2, 3, 4].map(q => (
                        <Button
                          key={q}
                          variant={selectedQuarter === q ? 'primary' : 'ghost'}
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedQuarter(q as any)}
                        >
                          Q{q}
                        </Button>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6">{selectedPnl.rangeStart} to {selectedPnl.rangeEnd}</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 p-4 bg-secondary-surface rounded-xl border border-border-grey">
                      <span className="text-sm font-black text-text-navy uppercase">Gross Sales</span>
                      <span className="text-sm font-black text-right text-text-navy">{money(selectedPnl.grossSales)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-2 text-cta">
                      <span className="text-xs font-bold uppercase tracking-widest">- VAT</span>
                      <span className="text-xs font-bold text-right">-{money(selectedPnl.vat)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-2 text-text-muted">
                      <span className="text-xs font-bold uppercase tracking-widest">- Service Charge</span>
                      <span className="text-xs font-bold text-right">-{money(selectedPnl.serviceCharge)}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4 bg-accent/5 rounded-xl border border-accent/20">
                      <span className="text-sm font-black text-accent uppercase">Net Revenue</span>
                      <span className="text-sm font-black text-right text-accent">{money(selectedPnl.netRevenue)}</span>
                    </div>

                    <div className="h-px bg-border-grey my-4" />

                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Cost of Goods Sold (COGS)</span>
                      <span className="text-sm font-black text-right text-text-navy">{money(selectedPnl.cogs)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Labour Expenses</span>
                      <span className="text-sm font-black text-right text-text-navy">{money(selectedPnl.labour)}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Operating Expenses</span>
                      <span className="text-sm font-black text-right text-text-navy">{money(selectedPnl.operatingExpenses)}</span>
                    </div>
                    {Object.keys(selectedPnl.operatingExpensesByCategory).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {Object.entries(selectedPnl.operatingExpensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                          <div key={cat} className="grid grid-cols-2 px-4 py-1">
                            <span className="text-[11px] font-medium text-text-muted">{cat}</span>
                            <span className="text-[11px] font-bold text-right text-text-muted">{money(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Waste</span>
                      <span className="text-sm font-black text-right text-text-navy">{money(selectedPnl.waste)}</span>
                    </div>

                    <div className="h-px bg-border-grey my-4" />

                    <div className={`grid grid-cols-2 p-6 rounded-2xl border-2 ${selectedPnl.netProfit >= 0 ? 'bg-success/5 border-success/20' : 'bg-cta/5 border-cta/20'}`}>
                      <div>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Net Profit</p>
                        <p className={`text-3xl font-black ${selectedPnl.netProfit >= 0 ? 'text-success' : 'text-cta'}`}>
                          {money(selectedPnl.netProfit)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-3 font-black text-text-navy uppercase text-xs">
                        <Tag className="w-4 h-4 text-accent" />
                        Margin: {selectedPnl.netRevenue > 0 ? ((selectedPnl.netProfit / selectedPnl.netRevenue) * 100).toFixed(1) : '0.0'}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 p-4 bg-secondary-surface rounded-xl border border-border-grey">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Stock Variance (shrinkage/overage — informational)</span>
                      <span className={`text-xs font-black text-right ${selectedPnl.stockVariance < 0 ? 'text-cta' : 'text-success'}`}>{money(selectedPnl.stockVariance)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'cashflow' && (
              <motion.div
                key="cashflow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm">
                    <h3 className="text-xl font-black text-text-navy uppercase tracking-tight mb-1">Cash In vs Out</h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6">Last 8 weeks · Gross Sales vs COGS+Labour+OpEx+Waste</p>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashflowSeries}>
                          <defs>
                            <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="week" fontSize={10} tickLine={false} label={{ value: 'Week starting', position: 'insideBottom', offset: -5, fontSize: 9 }} />
                          <YAxis fontSize={10} tickLine={false} tickFormatter={(v) => `£${v}`} />
                          <Tooltip
                            formatter={(val: number, name: string) => [`£${val.toFixed(2)}`, name === 'cashIn' ? 'Cash In' : 'Cash Out']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend formatter={(value) => value === 'cashIn' ? 'Cash In' : 'Cash Out'} />
                          <Area type="monotone" dataKey="cashIn" name="cashIn" stroke="#10b981" fillOpacity={1} fill="url(#colorCashIn)" strokeWidth={3} />
                          <Area type="monotone" dataKey="cashOut" name="cashOut" stroke="#ef4444" fillOpacity={1} fill="url(#colorCashOut)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm">
                    <h3 className="text-xl font-black text-text-navy uppercase tracking-tight mb-1">Liabilities Distribution</h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6">Selected period · {selectedPnl.rangeStart} to {selectedPnl.rangeEnd}</p>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={[
                              { name: 'VAT', value: selectedPnl.vat },
                              { name: 'Service Charge', value: selectedPnl.serviceCharge },
                              { name: 'Upcoming Liabilities', value: pendingLiabilitiesTotal }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={(entry: any) => entry.name}
                          >
                            <Cell fill="#6366f1" />
                            <Cell fill="#f43f5e" />
                            <Cell fill="#f59e0b" />
                          </Pie>
                          <Legend />
                          <Tooltip formatter={(val: number) => `£${val.toFixed(2)}`} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'vat' && (
              <motion.div
                key="vat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="bg-text-navy p-8 rounded-3xl text-white relative overflow-hidden">
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-2">HMRC Compliance Engine</h3>
                  <div className="flex items-center gap-2 text-sm mb-6">
                    {isReconciled ? (
                      <>
                        <Shield className="w-4 h-4 text-success" />
                        <span className="text-slate-400">Fully Reconciled with POS Data</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">
                          Not reconciled — Consistency Audit shows a {money(Math.abs(selectedPnl.consistencyVariance))} variance for this period
                        </span>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">VAT Collected</p>
                      <p className="text-2xl font-black">{money(selectedPnl.vat)}</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">VAT Reclaimable (Est)</p>
                      <p className="text-2xl font-black">{money(vatReclaimableEst)}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Estimated at 20% of COGS — no purchase-invoice VAT tracking exists yet</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net VAT Payable</p>
                      <p className="text-2xl font-black text-cta">{money(netVatPayable)}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-4 flex-wrap">
                    <Button onClick={() => onOpenView('reports')} className="bg-white text-text-navy hover:bg-slate-100 border-none">
                      Generate HMRC Report
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-white border-white/20 hover:bg-white/10"
                      onClick={() => setShowHistoricalReturns(o => !o)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      {showHistoricalReturns ? 'Hide' : 'View'} Historical Returns
                    </Button>
                  </div>

                  {showHistoricalReturns && (
                    <div className="mt-6 bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-slate-400 text-[9px] uppercase tracking-widest">
                          <tr>
                            <th className="px-4 py-3">Period</th>
                            <th className="px-4 py-3">Range</th>
                            <th className="px-4 py-3 text-right">VAT Collected</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {historicalPeriods.map(p => (
                            <tr key={p.periodNumber}>
                              <td className="px-4 py-3 font-bold">Period {p.periodNumber}</td>
                              <td className="px-4 py-3 text-slate-400">{p.start} to {p.end}</td>
                              <td className="px-4 py-3 text-right font-black">{money(p.vat)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-text-navy p-8 rounded-3xl text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Zap className="w-48 h-48" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-2">AI Decision Center</h3>
                  <p className="text-slate-400 text-sm font-medium max-w-md">
                    Strategic recommendations grounded in this period's real numbers. Generated only when you click
                    "Run AI Diagnostic" above — never automatically, and never just from viewing this tab.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {aiActions.length === 0 ? (
                    <div className="text-center py-20 bg-card-bg rounded-2xl border border-dashed border-border-grey">
                      <Zap className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-black text-text-muted uppercase tracking-widest">No active AI recommendations</p>
                      <p className="text-[10px] text-text-muted mt-2">Click "Run AI Diagnostic" above to generate some.</p>
                    </div>
                  ) : (
                    aiActions.map(action => (
                      <div key={action.id} className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm hover:border-accent transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex gap-6 items-start">
                          <div className={`p-4 rounded-2xl ${
                            action.priority === 'High' ? 'bg-cta/10 text-cta' :
                            action.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-accent/10 text-accent'
                          }`}>
                            <Zap className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                action.priority === 'High' ? 'bg-cta text-white' :
                                action.priority === 'Medium' ? 'bg-amber-500 text-white' :
                                'bg-accent text-white'
                              }`}>
                                {action.priority} Priority
                              </span>
                              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">{action.type}</span>
                            </div>
                            <h4 className="text-lg font-black text-text-navy leading-tight">{action.recommendation}</h4>
                            <p className="text-xs font-medium text-text-muted">{action.reason}</p>
                            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Expected Impact: {action.expectedImpact}</p>
                          </div>
                        </div>

                        {action.status === 'Draft' ? (
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              onClick={() => toast.info('Refining recommendation...')}
                              className="text-text-muted hover:text-text-navy"
                            >
                              Reject
                            </Button>
                            <Button
                              onClick={() => handleApproveAction(action)}
                              className="gap-2 bg-success hover:bg-emerald-600"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve & Execute
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-success px-4 py-2 bg-success/5 rounded-xl border border-success/10">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">{action.status}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIDEBAR: ALERTS & REAL-TIME FEED */}
        <div className="space-y-8">
          {/* LIVE ALERTS — rule-based, zero AI cost, recomputed every render from real data */}
          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-6">
            <h4 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center justify-between">
              Live Alerts {liveAlerts.length > 0 && <span className="bg-cta text-white px-2 py-0.5 rounded-full text-[10px]">{liveAlerts.length}</span>}
            </h4>
            <div className="space-y-4">
              {liveAlerts.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">System Optimal</p>
                </div>
              ) : (
                liveAlerts.map(alert => (
                  <div key={alert.id} className={`p-4 rounded-xl border-l-4 shadow-sm ${
                    alert.severity === 'Critical' ? 'bg-red-50 border-red-500' :
                    alert.severity === 'Warning' ? 'bg-amber-50 border-amber-500' :
                    'bg-blue-50 border-blue-500'
                  }`}>
                    <p className="text-xs font-black text-text-navy uppercase mb-1">{alert.message}</p>
                    <p className="text-[10px] text-text-muted leading-relaxed">{alert.description}</p>
                  </div>
                ))
              )}
            </div>
            <div className="pt-4 border-t border-border-grey space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Margin target %</label>
                <input
                  type="number"
                  value={marginTargetPercent}
                  onChange={(e) => setMarginTargetPercent(Number(e.target.value) || 0)}
                  className="w-16 text-xs font-bold text-right bg-secondary-surface border border-border-grey rounded-lg px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Liability alert window (days)</label>
                <input
                  type="number"
                  value={liabilityAlertDays}
                  onChange={(e) => setLiabilityAlertDays(Number(e.target.value) || 0)}
                  className="w-16 text-xs font-bold text-right bg-secondary-surface border border-border-grey rounded-lg px-2 py-1"
                />
              </div>
            </div>
          </div>

          {/* STAFF METRIC DRILL DOWN */}
          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-6">
            <h4 className="text-xs font-black text-text-navy uppercase tracking-widest">Labour Efficiency</h4>
            <div className="space-y-4">
              {staff.slice(0, 5).map(s => (
                <div key={s.id} className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold text-text-navy uppercase">
                    <span>{s.firstName} {s.lastName}</span>
                    <span className="text-text-muted">£{s.performanceMetrics?.totalSales.toLocaleString() || 0}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${Math.min(100, (s.performanceScore || 0) * 10)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
