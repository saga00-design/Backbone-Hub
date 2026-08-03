
import React, { useMemo, useState } from 'react';
import { InventoryItem, DailyClosure } from '../types';
import { CategorySalesSplit } from '../utils/recipeUtils';
import { TrendingUp, AlertTriangle, PoundSterling, Brain, RefreshCw, ArrowRight, Banknote, ShoppingCart, Clock, Bot, Wifi, WifiOff, ChevronDown, ChevronUp, HardHat, LayoutDashboard } from 'lucide-react';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface LivePosSalesSummary {
  totalPaid: number;
  grossSales: number;
  netSales: number;
  vatTotal: number;
  serviceChargeTotal: number;
  discountTotal: number;
  orderCount: number;
  salesByPaymentMethod: Record<string, number>;
}

interface LabourCostPeriodToDate {
  totalCost: number;
  weeksWithData: number;
  expectedCount: number;
  periodNumber: number;
}

interface DashboardProps {
  items: InventoryItem[];
  totalRevenue: number;
  posPaymentsCount: number;
  isPosLive: boolean;
  databaseId?: string;
  orderCountToday: number;
  livePosSalesSummary: LivePosSalesSummary;
  todayCovers: number;
  todaysClosure: DailyClosure | null;
  todayCategorySalesSplit: CategorySalesSplit;
  labourCostPeriodToDate: LabourCostPeriodToDate;
  setCurrentView?: (view: any) => void;
  onAddToCart?: (item: InventoryItem, quantity: number) => void;
}

interface Alert {
  id: string;
  type: 'REORDER' | 'EXPIRY';
  priority: 'high' | 'medium';
  title: string;
  message: string;
  action: string;
  targetView?: string;
}

const money = (v: number) => `£${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Dashboard: React.FC<DashboardProps> = ({
  items,
  totalRevenue,
  posPaymentsCount,
  isPosLive,
  databaseId,
  orderCountToday,
  livePosSalesSummary,
  todayCovers,
  todaysClosure,
  todayCategorySalesSplit,
  labourCostPeriodToDate,
  setCurrentView,
  onAddToCart
}) => {
  const totalValue = items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.averageCostBase || item.pricePerUnit) || 0;
    return acc + (q * p);
  }, 0);

  const lowStockItems = items.filter(item => item.quantity <= item.minStockLevel);
  const totalItems = items.length;

  const triggerAIChat = (message: string) => {
    window.dispatchEvent(new CustomEvent('inventory-ai-chat', { detail: { message } }));
  };

  // Calculate Value per Sub Category
  const subCategoryValueMap = items.reduce((acc: Record<string, number>, item) => {
    const key = item.subCategory || item.category || 'Uncategorized';
    const currentValue = acc[key] || 0;

    const quantity = Number(item.quantity) || 0;
    const price = Number(item.averageCostBase || item.pricePerUnit) || 0;
    const itemValue = quantity * price;

    acc[key] = currentValue + itemValue;
    return acc;
  }, {} as Record<string, number>);

  const subCategoryBreakdown = Object.entries(subCategoryValueMap)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  const [showAllCategories, setShowAllCategories] = useState(false);
  const TOP_CATEGORY_COUNT = 6;
  const topCategories = subCategoryBreakdown.slice(0, TOP_CATEGORY_COUNT);
  const remainingCategories = subCategoryBreakdown.slice(TOP_CATEGORY_COUNT);
  const remainingTotal = remainingCategories.reduce((acc, c) => acc + c.value, 0);

  const goToInventoryCategory = (categoryName: string) => {
    // Reuse InventoryList's existing localStorage-persisted filters (inv_filter / inv_subfilter)
    // rather than building a new filtering/navigation mechanism.
    localStorage.setItem('inv_filter', 'All');
    localStorage.setItem('inv_subfilter', categoryName);
    setCurrentView?.('inventory');
  };

  // Generate Alerts Locally (Instant) — plain rule-based checks over Firestore-backed
  // inventory data. No AI/LLM call is involved anywhere in this computation.
  const alerts = useMemo(() => {
    const generatedAlerts: Alert[] = [];
    const today = new Date();

    items.forEach(item => {
        // 1. Expiry Check
        if (item.expiryDate) {
            const expiry = new Date(item.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                generatedAlerts.push({
                    id: `exp-${item.id}`,
                    type: 'EXPIRY',
                    priority: 'high',
                    title: `EXPIRED: ${item.name}`,
                    message: `Item expired on ${item.expiryDate}. Immediate disposal required.`,
                    action: `Review batch and contact ${item.supplier || 'supplier'} for replacement.`,
                    targetView: 'orders'
                });
            } else if (diffDays <= 7) {
                generatedAlerts.push({
                    id: `exp-warn-${item.id}`,
                    type: 'EXPIRY',
                    priority: 'medium',
                    title: `EXPIRY SOON: ${item.name}`,
                    message: `Expires in ${diffDays} days (${item.expiryDate}).`,
                    action: `Prioritize usage in specials or reduce price.`,
                    targetView: 'inventory'
                });
            }
        }
    });

    return generatedAlerts.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return 0;
    });
  }, [items]);

  // AI Inventory Intelligence table selection
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());
  const toggleStockSelect = (id: string) => {
    setSelectedStockIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleOrderSelected = () => {
    if (!onAddToCart) return;
    lowStockItems.filter(i => selectedStockIds.has(i.id)).forEach(i => onAddToCart(i, 1));
    setSelectedStockIds(new Set());
  };
  const handleOrderAll = () => {
    if (!onAddToCart) return;
    lowStockItems.forEach(i => onAddToCart(i, 1));
    setSelectedStockIds(new Set());
  };

  // Forecasting Logic — gated on the same dailyUsageRate signal that already reflects
  // accumulated real usage history; renders nothing until there's genuine data.
  const forecastingData = useMemo(() => {
    return items
      .filter(item => item.dailyUsageRate && item.dailyUsageRate > 0)
      .map(item => {
        const totalInStock = item.quantity || 0;
        const daysRemaining = Math.floor(totalInStock / item.dailyUsageRate!);
        const status = daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'safe';
        return {
          ...item,
          daysRemaining,
          status
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8); // Show top 8 items at risk
  }, [items]);

  const COLORS = ['#F27D26', '#141414', '#5A5A40', '#E4E3E0', '#8E9299', '#4a4a4a'];

  // Gross Sales hover/click popover
  const [grossDetailOpen, setGrossDetailOpen] = useState(false);
  const sph = todayCovers > 0 ? totalRevenue / todayCovers : 0;

  // Food/Beverage/Uncategorized % of today's live categorized sales — Uncategorized is only
  // shown when it's actually non-zero, so a fully-categorized menu just shows Food/Beverage.
  const categoryPercentEntries = Object.entries(todayCategorySalesSplit.percentByCategory)
    .filter(([category, percent]) => percent > 0 && category !== 'Uncategorized')
    .sort(([, a], [, b]) => b - a);
  const uncategorizedPercent = todayCategorySalesSplit.percentByCategory['Uncategorized'] || 0;

  // System connectivity compact indicator — driven by the app-wide Firestore heartbeat
  // signal (App.tsx: useConnectionStatus), the same source as OfflineBanner and the
  // reconnect toast, so all three always agree. Previously this used `posPaymentsCount > 0`,
  // which is "has this location ever had a payment" — permanently true once any history
  // exists, so the dot could never go red.
  const [connDetailOpen, setConnDetailOpen] = useState(false);
  const isOnline = isPosLive;

  const expiryAlerts = alerts.filter(a => a.type === 'EXPIRY');

  return (
    <div className="space-y-6">

      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Live operations overview" />

      {/* Compact connectivity indicator — auto-hidden detail, unobtrusive top-corner dot */}
      <div className="flex justify-end">
        <div
          className="relative"
          onMouseEnter={() => setConnDetailOpen(true)}
          onMouseLeave={() => setConnDetailOpen(false)}
        >
          <button
            onClick={() => setConnDetailOpen(o => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border-grey bg-card-bg hover:border-accent/40 transition-all"
            title="System Connectivity"
          >
            <span className={`h-2 w-2 rounded-full animate-pulse ${isOnline ? 'bg-success' : 'bg-error'}`}></span>
            {isOnline ? <Wifi className="h-3 w-3 text-text-muted" /> : <WifiOff className="h-3 w-3 text-error" />}
          </button>

          {connDetailOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-card-bg border border-border-grey rounded-xl shadow-xl p-4 z-30">
              <p className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-3">System Connectivity</p>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-text-muted font-bold uppercase">Database</span>
                  <span className="font-mono font-medium text-text-navy truncate max-w-[120px]" title={databaseId}>{databaseId || 'default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted font-bold uppercase">Payments</span>
                  <span className="font-bold text-text-navy">{posPaymentsCount} Records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted font-bold uppercase">Today's Hub Volume</span>
                  <span className="font-bold text-text-navy">{orderCountToday} Orders</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted font-bold uppercase">Sync Status</span>
                  <span className={`font-bold uppercase tracking-tighter ${isOnline ? 'text-success' : 'text-error'}`}>{isOnline ? 'Live' : 'Offline'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-5">
        <div
          className="relative bg-card-bg overflow-visible shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300"
          onMouseEnter={() => setGrossDetailOpen(true)}
          onMouseLeave={() => setGrossDetailOpen(false)}
        >
          <button
            type="button"
            onClick={() => setGrossDetailOpen(o => !o)}
            className="w-full text-left p-4 sm:p-6"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-success/10 rounded-xl">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              </div>
              <div className="ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Gross Sales (Today)</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">{money(totalRevenue)}</dd>
                </dl>
              </div>
            </div>
          </button>

          {grossDetailOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 w-72 bg-card-bg border border-border-grey rounded-xl shadow-xl p-4 z-30">
              <p className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-3">Today's Breakdown</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                <div className="flex justify-between col-span-2">
                  <span className="text-text-muted font-bold uppercase">VAT</span>
                  <span className="font-bold text-text-navy">{money(livePosSalesSummary.vatTotal)}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-text-muted font-bold uppercase">Service Charge</span>
                  <span className="font-bold text-text-navy">{money(livePosSalesSummary.serviceChargeTotal)}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-text-muted font-bold uppercase">Discounts</span>
                  <span className="font-bold text-text-navy">{money(livePosSalesSummary.discountTotal)}</span>
                </div>
                <div className="flex justify-between col-span-2 pt-2 border-t border-border-grey">
                  <span className="text-text-muted font-bold uppercase">Net Sales</span>
                  <span className="font-bold text-text-navy">{money(livePosSalesSummary.netSales)}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-text-muted font-bold uppercase">Covers</span>
                  <span className="font-bold text-text-navy">{todayCovers || '—'}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-text-muted font-bold uppercase">Spend Per Head</span>
                  <span className="font-bold text-text-navy">{todayCovers > 0 ? money(sph) : '—'}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-border-grey">
                  {todayCategorySalesSplit.totalGross > 0 ? (
                    <>
                      {categoryPercentEntries.map(([category, percent]) => (
                        <div key={category} className="flex justify-between">
                          <span className="text-text-muted font-bold uppercase">{category} %</span>
                          <span className="font-bold text-text-navy">{percent.toFixed(1)}%</span>
                        </div>
                      ))}
                      {uncategorizedPercent > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-muted font-bold uppercase">Uncategorized %</span>
                          <span className="font-bold text-text-navy">{uncategorizedPercent.toFixed(1)}%</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[9px] text-text-muted italic">No categorized sales yet today.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300"
          title={`${labourCostPeriodToDate.weeksWithData} of ${labourCostPeriodToDate.expectedCount} weeks imported this Period`}
        >
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-warning/10 rounded-xl">
                <HardHat className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              </div>
              <div className="ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">P{labourCostPeriodToDate.periodNumber} Labour Cost</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">{money(labourCostPeriodToDate.totalCost)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-text-muted/10 rounded-xl">
                <PoundSterling className="h-4 w-4 sm:h-5 sm:w-5 text-text-muted" />
              </div>
              <div className="ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Holding Value</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">{money(totalValue)}</dd>
                </dl>
                <button
                  onClick={() => triggerAIChat("tell me how can we improve this")}
                  className="mt-4 px-3 py-1.5 bg-accent/5 text-accent text-[9px] font-black uppercase tracking-widest rounded-xl border border-accent/20 hover:bg-accent hover:text-white transition-all shadow-sm inline-flex items-center group/btn"
                >
                  <Brain className="h-3 w-3 mr-2 group-hover/btn:scale-110 transition-transform" />
                  Improve
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-cta/10 rounded-xl">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-cta" />
              </div>
              <div className="ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Low Stock</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">{lowStockItems.length}</dd>
                </dl>
                <button
                  onClick={() => triggerAIChat("tell me which items are low in stock")}
                  className="mt-4 px-3 py-1.5 bg-cta/5 text-cta text-[9px] font-black uppercase tracking-widest rounded-xl border border-cta/20 hover:bg-cta hover:text-white transition-all shadow-sm inline-flex items-center group/btn"
                >
                  <AlertTriangle className="h-3 w-3 mr-2 group-hover/btn:scale-110 transition-transform" />
                  Check
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 bg-accent/10 rounded-xl">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
              </div>
              <div className="ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Health</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">
                    {totalItems > 0 ? Math.round(((totalItems - lowStockItems.length) / totalItems) * 100) : 0}%
                  </dd>
                </dl>
                <button
                  onClick={() => triggerAIChat("tell me how can we improve")}
                  className="mt-4 px-3 py-1.5 bg-accent/5 text-accent text-[9px] font-black uppercase tracking-widest rounded-xl border border-accent/20 hover:bg-accent hover:text-white transition-all shadow-sm inline-flex items-center group/btn"
                >
                  <TrendingUp className="h-3 w-3 mr-2 group-hover/btn:scale-110 transition-transform" />
                  Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Alerts Section — AI Inventory Intelligence (rule-based, no live AI call) */}
      <div className="bg-primary-surface border border-border-grey rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div className="flex items-center">
            <div className="p-2.5 bg-accent/10 rounded-xl mr-3 border border-accent/20">
              <Brain className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-navy uppercase tracking-tight">AI Inventory Intelligence</h2>
              <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Real-time critical actions</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="text-[10px] font-black uppercase tracking-widest h-10 px-5 bg-card-bg border-border-grey text-text-navy hover:border-accent hover:text-accent transition-all rounded-xl shadow-sm flex-shrink-0 w-full sm:w-auto flex items-center justify-center"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            <span>Refresh System</span>
          </Button>
        </div>

        {lowStockItems.length === 0 && expiryAlerts.length === 0 ? (
            <div className="text-center py-8 text-text-muted bg-card-bg rounded-2xl border border-dashed border-border-grey text-sm">
                <p className="font-bold uppercase tracking-widest text-xs opacity-50">System Status: Optimal</p>
                <p className="mt-2">No critical stock or expiry issues detected.</p>
            </div>
        ) : (
          <>
            {lowStockItems.length > 0 && (
              <div className="bg-card-bg rounded-2xl border border-border-grey overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-grey bg-main-bg/50">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need reordering</span>
                  {onAddToCart && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOrderSelected}
                        disabled={selectedStockIds.size === 0}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-accent/30 text-accent bg-accent/5 hover:bg-accent hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Order Selected ({selectedStockIds.size})
                      </button>
                      <button
                        onClick={handleOrderAll}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-all"
                      >
                        Order All
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-card-bg">
                      <tr className="text-[9px] text-text-muted font-black uppercase tracking-widest border-b border-border-grey">
                        <th className="px-4 py-2 w-8"></th>
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2">Current Stock</th>
                        <th className="px-2 py-2">Min Level</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockItems.map(item => (
                        <tr key={item.id} className="border-b border-border-grey/50 last:border-0 hover:bg-main-bg/40 transition-colors">
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedStockIds.has(item.id)}
                              onChange={() => toggleStockSelect(item.id)}
                              className="h-3.5 w-3.5 rounded border-border-grey accent-accent cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-2.5 text-xs font-bold text-text-navy">
                            {item.name}
                            {item.quantity === 0 && <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-error">Out of Stock</span>}
                          </td>
                          <td className="px-2 py-2.5 text-xs text-text-muted">{item.quantity} {item.baseUnit}</td>
                          <td className="px-2 py-2.5 text-xs text-text-muted">{item.minStockLevel} {item.baseUnit}</td>
                          <td className="px-4 py-2.5 text-right">
                            {onAddToCart && (
                              <button
                                onClick={() => onAddToCart(item, 1)}
                                className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-white transition-all"
                                title="Add to Cart"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expiryAlerts.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {expiryAlerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => { if (setCurrentView && alert.targetView) setCurrentView(alert.targetView); }}
                    className={`flex items-center justify-between px-4 py-2 rounded-xl border cursor-pointer hover:shadow-sm transition-all ${
                      alert.priority === 'high' ? 'bg-error/5 border-error/20' : 'bg-warning/5 border-warning/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0 text-cta" />
                      <span className="text-[11px] font-bold text-text-navy truncate">{alert.title}</span>
                      <span className="text-[10px] text-text-muted truncate hidden sm:inline">{alert.message}</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-text-muted/50 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sub Categories Breakdown */}
      <div className="bg-card-bg shadow rounded-lg p-6 border border-border-grey">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg leading-6 font-medium text-text-navy">Total Value by Sub Category</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subCategoryBreakdown.slice(0, 6)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subCategoryBreakdown.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`£${value.toFixed(2)}`, 'Value']}
                  contentStyle={{ backgroundColor: '#151619', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2">
            <div className="divide-y divide-border-grey/60">
              {topCategories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => goToInventoryCategory(cat.name)}
                  className="w-full flex items-center justify-between py-2.5 px-2 hover:bg-main-bg/60 rounded-lg transition-colors group text-left"
                >
                  <span className="text-xs font-medium text-text-navy group-hover:text-accent transition-colors truncate" title={cat.name}>{cat.name}</span>
                  <span className="text-sm font-bold text-text-navy flex items-center gap-2 flex-shrink-0">
                    £{cat.value.toFixed(0)}
                    <ArrowRight className="h-3 w-3 text-text-muted/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                  </span>
                </button>
              ))}
              {topCategories.length === 0 && (
                 <p className="text-text-muted text-sm py-4">No inventory data to display.</p>
              )}
            </div>

            {remainingCategories.length > 0 && (
              <div className="mt-2 border-t border-border-grey pt-2">
                <button
                  onClick={() => setShowAllCategories(o => !o)}
                  className="w-full flex items-center justify-between py-2 px-2 text-xs font-bold text-accent hover:bg-main-bg/60 rounded-lg transition-colors"
                >
                  <span>+{remainingCategories.length} more categories — £{remainingTotal.toFixed(0)} total</span>
                  {showAllCategories ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showAllCategories && (
                  <div className="divide-y divide-border-grey/60 mt-1 max-h-[240px] overflow-y-auto">
                    {remainingCategories.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => goToInventoryCategory(cat.name)}
                        className="w-full flex items-center justify-between py-2.5 px-2 hover:bg-main-bg/60 rounded-lg transition-colors group text-left"
                      >
                        <span className="text-xs font-medium text-text-navy group-hover:text-accent transition-colors truncate" title={cat.name}>{cat.name}</span>
                        <span className="text-sm font-bold text-text-navy flex items-center gap-2 flex-shrink-0">
                          £{cat.value.toFixed(0)}
                          <ArrowRight className="h-3 w-3 text-text-muted/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Run-out Forecast — hidden entirely until real usage data exists (dailyUsageRate > 0) */}
      {forecastingData.length > 0 && (
        <div className="bg-card-bg shadow-sm rounded-2xl p-6 border border-border-grey">
          <div className="flex items-center mb-8">
            <div className="p-2.5 bg-accent/10 rounded-xl mr-3 border border-accent/20">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-black text-text-navy uppercase tracking-tight">Stock Run-out Forecast</h3>
              <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Projected depletion timeline</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={forecastingData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e5e5" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fill: '#141414', fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(242, 125, 38, 0.05)' }}
                    formatter={(value: number) => [`${value} days`, 'Remaining']}
                    contentStyle={{ backgroundColor: '#151619', border: 'none', borderRadius: '12px', color: '#fff', padding: '12px' }}
                  />
                  <Bar
                    dataKey="daysRemaining"
                    radius={[0, 6, 6, 0]}
                    barSize={24}
                  >
                    {forecastingData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.status === 'critical' ? '#FF4444' : entry.status === 'warning' ? '#F27D26' : '#5A5A40'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {forecastingData.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-primary-surface rounded-xl border border-border-grey hover:border-accent/30 transition-all group cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-text-navy uppercase tracking-tight group-hover:text-accent transition-colors">{item.name}</span>
                    <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-0.5">{item.subCategory || item.category}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-black uppercase tracking-widest ${
                      item.status === 'critical' ? 'text-cta' : item.status === 'warning' ? 'text-warning' : 'text-success'
                    }`}>
                      {item.daysRemaining} days left
                    </div>
                    <div className="text-[10px] text-text-muted font-medium mt-1">
                      Usage: <span className="font-bold text-text-navy">{item.dailyUsageRate}</span> {item.unit}/day
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Sales Forecasting — read-only cached insight generated once at daily closure.
          Renders nothing until a closure has produced one; never triggers a live AI call. */}
      {todaysClosure?.aiInsight && (
        <div className="bg-card-bg shadow-2xl rounded-2xl p-6 sm:p-10 border border-border-grey relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
            <Bot className="h-48 w-48" />
          </div>

          <div className="flex items-center mb-6 relative z-10">
            <div className="p-4 bg-accent/10 rounded-2xl mr-5 border border-accent/20">
              <Bot className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-text-navy uppercase tracking-tight">AI Sales Forecasting</h3>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1.5 max-w-md">Generated automatically at last night's closure — {todaysClosure.date}</p>
            </div>
          </div>

          <div className="bg-primary-surface p-8 rounded-2xl text-sm text-text-navy border border-border-grey whitespace-pre-wrap leading-relaxed shadow-inner relative z-10 font-medium">
            <div className="flex items-center mb-4 text-accent">
              <Brain className="h-4 w-4 mr-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">Intelligence Output</span>
            </div>
            {todaysClosure.aiInsight}
          </div>
        </div>
      )}
    </div>
  );
};
