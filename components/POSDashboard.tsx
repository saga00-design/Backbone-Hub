import React, { useMemo } from 'react';
import { POSOrder, Table, Forecast, StaffMember, Recipe, InventoryItem, ShiftInsight } from '../types';
import { 
  Zap, Clock, AlertTriangle, Users, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Bell, MessageSquare, 
  Activity, Timer, Coffee, Flame, CheckCircle2, Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { generateShiftInsights } from '../services/shiftCoachService';
import { ShiftCoach } from './ShiftCoach';
import { initializeSystem } from '../services/restaurantService';
import { toast } from 'sonner';

interface POSDashboardProps {
  orders: POSOrder[];
  payments?: any[];
  tables: Table[];
  forecasts: Forecast[];
  staff: StaffMember[];
  recipes: Recipe[];
  inventory: InventoryItem[];
  locationId: string;
  onNotifyStaff?: (msg: string) => void;
  onPushSuggestion?: (msg: string) => void;
}

export const POSDashboard: React.FC<POSDashboardProps> = ({ 
  orders, 
  payments = [],
  tables, 
  forecasts, 
  staff,
  recipes,
  inventory,
  locationId,
  onNotifyStaff,
  onPushSuggestion 
}) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  const parseDate = (d: any) => {
    if (!d) return new Date(0);
    if (d.toDate && typeof d.toDate === 'function') return d.toDate(); // Firestore Timestamp
    return new Date(d);
  };

  // 1. LIVE METRICS CALCULATIONS
  const todayOrders = orders.filter(o => parseDate(o.createdAt) >= startOfToday);
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentOrders = todayOrders.filter(o => parseDate(o.createdAt) >= oneHourAgo);
  const activeOrders = todayOrders.filter(o => o.status === 'Open' || o.status === 'Sent');
  const delayedOrders = activeOrders.filter(o => {
    const waitTime = (new Date().getTime() - new Date(o.createdAt).getTime()) / 60000;
    return waitTime > 15; // 15 mins thresh
  });

  const avgPrepTime = useMemo(() => {
    const completed = todayOrders.filter(o => o.paidAt || o.status === 'Paid');
    if (completed.length === 0) return 0;
    const total = completed.reduce((acc, o) => {
      const start = parseDate(o.createdAt).getTime();
      const end = parseDate(o.paidAt || o.updatedAt).getTime();
      return acc + (end - start);
    }, 0);
    return Math.round(total / completed.length / 60000);
  }, [todayOrders]);

  const activeTables = tables.filter(t => t.status === 'occupied' || t.status === 'Seated' || t.status === 'Ordered');
  const stalledTables = activeTables.filter(t => {
    const lastAction = t.lastActionAt || t.seatedAt;
    if (!lastAction) return false;
    const idleTime = (Date.now() - parseDate(lastAction).getTime()) / 60000;
    return idleTime > 30; // 30 mins since last order
  });

  // 2. REVENUE CALCULATIONS
  const totalSalesToday = todayOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  
  // Real revenue from payments if available
  const todayPayments = payments.filter(p => parseDate(p.createdAt || p.timestamp).getTime() >= startOfToday.getTime());
  const actualRevenueToday = todayPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // VAT & Service Charge Separated
  const totalVATToday = todayOrders.reduce((acc, o) => acc + (Number(o.vat || o.financials?.vatTotal) || 0), 0);
  const totalServiceChargeToday = todayOrders.reduce((acc, o) => acc + (Number(o.serviceCharge || o.financials?.serviceChargeTotal) || 0), 0);
  const netSalesToday = totalSalesToday - totalVATToday - totalServiceChargeToday;

  // Estimation logic for COGS & Labour in real-time if full records not yet in props
  // In a real scenario, these would be passed down from App.tsx
  const estimatedCOGS = todayOrders.reduce((acc, o) => {
    let orderCogs = 0;
    o.items?.forEach(item => {
      const recipe = recipes.find(r => r.id === item.recipeId);
      if (recipe) {
        recipe.ingredients?.forEach(ing => {
          const inv = inventory.find(i => i.id === ing.inventoryItemId);
          if (inv) orderCogs += (inv.pricePerUnit || 0) * (ing.baseQuantity || 0);
        });
      }
    });
    return acc + orderCogs;
  }, 0);

  const currentForecast = forecasts.find(f => f.periodStart.startsWith(now.toISOString().split('T')[0]))?.forecast.revenue || 0;

  // Real Profit Metrics
  const profitBeforeVAT = netSalesToday - estimatedCOGS; // Simplified for live dashboard
  const vatPayable = totalVATToday; // Simplified (Collected)
  const realProfit = profitBeforeVAT - vatPayable;

  // 3. STAFF PERFORMANCE
  const staffPerformance = useMemo(() => {
    const perf: Record<string, { sales: number; counts: number; name: string }> = {};
    todayOrders.forEach(o => {
      const s = staff.find(st => st.id === o.waiterId);
      const name = s ? `${s.firstName} ${s.lastName}` : 'Unknown';
      if (!perf[o.waiterId]) perf[o.waiterId] = { sales: 0, counts: 0, name };
      perf[o.waiterId].sales += o.total;
      perf[o.waiterId].counts += 1;
    });
    return Object.entries(perf)
      .map(([id, data]) => ({ id, ...data, avg: data.sales / data.counts }))
      .sort((a, b) => b.sales - a.sales);
  }, [todayOrders, staff]);

  const insights = useMemo(() => generateShiftInsights(
    orders, tables, staff, recipes, inventory, locationId
  ), [orders, tables, staff, recipes, inventory, locationId]);

  const handleCoachAction = (insight: ShiftInsight) => {
    if (insight.type === 'timing' || insight.type === 'staff') {
      onNotifyStaff?.(`COACH ALERT: ${insight.message} - ${insight.action}`);
    } else if (insight.type === 'menu' || insight.type === 'sales') {
      onPushSuggestion?.(`COACH TIP: ${insight.action}`);
    } else {
      onNotifyStaff?.(`${insight.message}: ${insight.action}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black text-text-navy dark:text-white flex items-center tracking-tighter">
              <Zap className="mr-3 h-8 w-8 text-accent fill-accent/20" />
              LIVE POS COMMAND
            </h1>
            {orders.length === 0 && (
              <span className="px-2 py-0.5 bg-cta/10 text-cta text-[8px] font-black rounded-full uppercase">No Live Sync</span>
            )}
            {orders.length > 0 && todayOrders.length === 0 && (
              <span className="px-2 py-0.5 bg-warning/10 text-warning text-[8px] font-black rounded-full uppercase">No Orders Today</span>
            )}
          </div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em]">
            Real-time operational visibility & floor control • {now.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {todayOrders.length === 0 && (
            <button 
              onClick={async () => {
                const t = toast.loading('Seeding sample orders for today...');
                await initializeSystem();
                toast.dismiss(t);
                toast.success('System checked. If empty, sample data was generated.');
              }}
              className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Database className="h-4 w-4" /> Seed Sample Orders
            </button>
          )}
          <button 
            onClick={() => onNotifyStaff?.('Check Table 4 - Long wait')}
            className="px-4 py-2 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-accent/20 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Bell className="h-4 w-4" /> Notify All
          </button>
        </div>
      </div>

      {/* TOP METRICS GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          label="Orders Per Hour" 
          value={recentOrders.length.toString()} 
          icon={Activity} 
          trend={12} 
          sub="Last 60 mins"
        />
        <MetricCard 
          label="Avg Prep Time" 
          value={`${avgPrepTime}m`} 
          icon={Timer} 
          trend={-5} 
          sub="Target: < 12m"
          variant={avgPrepTime > 12 ? 'warning' : 'success'}
        />
        <MetricCard 
          label="Delayed Tickets" 
          value={delayedOrders.length.toString()} 
          icon={AlertTriangle} 
          sub="Exceeding 15m"
          variant={delayedOrders.length > 0 ? 'danger' : 'success'}
        />
        <MetricCard 
          label="Active Tables" 
          value={`${activeTables.length}/${tables.length}`} 
          icon={Users} 
          sub={`${Math.round(activeTables.length / tables.length * 100)}% Occupancy`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* REVENUE & FORECAST */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-border-grey dark:border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp className="h-32 w-32" />
            </div>
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-6">Today's Sales (Gross)</h3>
            <div className="space-y-1">
              <p className="text-5xl font-black text-text-navy dark:text-white">£{totalSalesToday.toLocaleString()}</p>
              <div className="flex items-center gap-4 mt-2">
                <div>
                   <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Revenue (Paid)</p>
                   <p className="text-sm font-black text-success">£{actualRevenueToday.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-success flex items-center font-bold text-xs">
                    <ArrowUpRight className="h-3 w-3" /> 18%
                  </span>
                  <span className="text-[8px] text-text-muted font-bold uppercase">vs Yes.</span>
                </div>
              </div>
            </div>

            {/* FINANCIAL BREAKDOWN PANELS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-cta/5 border border-cta/10 dark:border-cta/20 rounded-2xl p-4">
                <p className="text-[9px] font-black text-cta uppercase tracking-widest mb-1">VAT Liability</p>
                <p className="text-xl font-black text-cta">£{totalVATToday.toLocaleString()}</p>
                <p className="text-[8px] text-text-muted font-bold mt-1 uppercase">Collected Today</p>
              </div>
              <div className="bg-accent/5 border border-accent/10 dark:border-accent/20 rounded-2xl p-4">
                <p className="text-[9px] font-black text-accent uppercase tracking-widest mb-1">Service Charge</p>
                <p className="text-xl font-black text-accent">£{totalServiceChargeToday.toLocaleString()}</p>
                <p className="text-[8px] text-text-muted font-bold mt-1 uppercase">Pending Dist.</p>
              </div>
            </div>

            <div className="bg-success/5 border border-success/10 dark:border-success/20 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black text-success uppercase tracking-widest">Real Profit (Est.)</h4>
                <TrendingUp className="h-4 w-4 text-success opacity-50" />
              </div>
              <p className="text-3xl font-black text-success mb-4">£{realProfit.toLocaleString()}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                  <span>Net Sales</span>
                  <span>£{netSalesToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                  <span>Estimated COGS</span>
                  <span>-£{estimatedCOGS.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-8 border-t border-border-grey dark:border-white/5 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Vs Forecast</p>
                  <p className="text-xl font-bold dark:text-white">£{currentForecast.toLocaleString()}</p>
                </div>
                <p className={`text-sm font-black ${totalSalesToday >= currentForecast ? 'text-success' : 'text-cta'}`}>
                  {Math.round((totalSalesToday / (currentForecast || 1)) * 100)}%
                </p>
              </div>
              <div className="w-full bg-main-bg dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(100, (totalSalesToday / (currentForecast || 1)) * 100)}%` }}
                   className={`h-full ${totalSalesToday >= currentForecast ? 'bg-success' : 'bg-accent'}`}
                />
              </div>
            </div>
          </div>

          {/* SHIFT COACH */}
          <ShiftCoach insights={insights} onAction={handleCoachAction} />

          {/* QUICK ACTIONS */}
          <div className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-3xl p-6">
            <h3 className="text-xs font-black text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4" /> Smart Actions
            </h3>
            <div className="space-y-3">
              <ActionButton 
                label="Suggest Sparkling Wine" 
                sub="Occupancy high, upsell potential" 
                onClick={() => onPushSuggestion?.('Upsell Sparkling: 3 tables haven\'t ordered drinks yet.')}
              />
              <ActionButton 
                label="Kitchen: Start Pre-Prep" 
                sub="Orders picking up (12/hr)" 
                onClick={() => onNotifyStaff?.('Kitchen: Incoming rush expected based on floor occupancy.')}
              />
              <ActionButton 
                label="Trigger Slow Service Alert" 
                sub="3 tables idle > 30m" 
                variant="danger"
                onClick={() => onNotifyStaff?.('Service Alert: Clear idle tables/check checks on T4, T7, T9')}
              />
            </div>
          </div>
        </div>

        {/* LIVE TABLE & STAFF TABS */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* STAFF PERFORMANCE */}
          <div className="bg-white dark:bg-slate-900 border border-border-grey dark:border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-border-grey dark:border-white/5 bg-main-bg/50 dark:bg-slate-800/50">
              <h3 className="text-xs font-black text-text-navy dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Live Staff Sales
              </h3>
            </div>
            <div className="divide-y divide-border-grey dark:divide-white/5">
              {staffPerformance.slice(0, 5).map((s, idx) => (
                <div key={s.id} className="p-4 flex items-center justify-between hover:bg-main-bg/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-text-muted w-4">{idx + 1}</span>
                    <div>
                      <p className="text-xs font-bold text-text-navy dark:text-white">{s.name}</p>
                      <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">{s.counts} Orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-text-navy dark:text-white">£{s.sales.toFixed(0)}</p>
                    <p className="text-[9px] text-success font-black">£{s.avg.toFixed(2)} avg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TABLE MONITOR */}
          <div className="bg-white dark:bg-slate-900 border border-border-grey dark:border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-border-grey dark:border-white/5 bg-main-bg/50 dark:bg-slate-800/50 flex justify-between items-center">
              <h3 className="text-xs font-black text-text-navy dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Coffee className="h-4 w-4 text-accent" /> Stalled Tables
              </h3>
              <span className="px-2 py-0.5 bg-cta/10 text-cta text-[8px] font-black rounded-full uppercase">
                {stalledTables.length} Flagged
              </span>
            </div>
            <div className="divide-y divide-border-grey dark:divide-white/5">
              {stalledTables.map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center text-cta font-black">
                      {t.number}
                    </div>
                    <div>
                      <p className="text-xs font-black text-text-navy dark:text-white">Table {t.number}</p>
                      <p className="text-[9px] text-cta font-black uppercase tracking-widest flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Idle {Math.round((Date.now() - parseDate(t.lastActionAt || t.seatedAt).getTime()) / 60000)}m
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onNotifyStaff?.(`Check Table ${t.number} - Long idle time`)}
                    className="p-2 opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-800 border border-border-grey dark:border-white/10 rounded-lg shadow-sm transition-all"
                  >
                    <MessageSquare className="h-4 w-4 text-accent" />
                  </button>
                </div>
              ))}
              {stalledTables.length === 0 && (
                <div className="p-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-success/20 mx-auto mb-3" />
                  <p className="text-xs text-text-muted font-bold uppercase tracking-widest">No stalled tables</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, trend, sub, variant = 'default' }: any) => {
  const colorMap = {
    default: 'text-accent bg-accent/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-cta bg-cta/10',
    success: 'text-success bg-success/10'
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-border-grey dark:border-white/5 rounded-3xl p-6 shadow-xl relative group hover:border-accent/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorMap[variant as keyof typeof colorMap]}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend !== undefined && (
          <span className={`text-[10px] font-black rounded-lg px-2 py-1 ${trend > 0 ? 'bg-success/10 text-success' : 'bg-cta/10 text-cta'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">{label}</h3>
      <p className="text-3xl font-black text-text-navy dark:text-white tracking-tighter">{value}</p>
      <p className="text-[10px] text-text-muted font-bold mt-2">{sub}</p>
    </div>
  );
};

const ActionButton = ({ label, sub, onClick, variant = 'default' }: any) => (
  <button 
    onClick={onClick}
    className={`w-full text-left p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 ${
      variant === 'danger' 
        ? 'bg-cta/5 border-cta/20 hover:bg-cta/10' 
        : 'bg-white dark:bg-slate-800 border-border-grey dark:border-white/10 hover:shadow-lg'
    }`}
  >
    <p className={`text-xs font-black ${variant === 'danger' ? 'text-cta' : 'text-text-navy dark:text-white'} uppercase tracking-widest`}>{label}</p>
    <p className="text-[9px] text-text-muted font-bold mt-0.5">{sub}</p>
  </button>
);
