import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, Play, Activity, Lock, TrendingUp, AlertCircle, 
  Users, Package, Clock, CheckCircle2, ChevronRight,
  TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb,
  ShoppingBag, PoundSterling, BarChart3, LayoutDashboard, Award
} from 'lucide-react';
import { 
  POSOrder, POSPayment, InventoryItem, DailyClosure, 
  Forecast, ForecastType, StaffPerformanceRecord
} from '../types';
import { Button } from './Button';
import { db, LOCATION_ID } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Reports } from './Reports';

interface ManagerModeProps {
  inventory: InventoryItem[];
  payments: POSPayment[];
  orders: POSOrder[];
  closures: DailyClosure[];
  forecasts: Forecast[];
  staffPerformance: StaffPerformanceRecord[];
  onNavigate: (tab: string) => void;
}

const ManagerMode: React.FC<ManagerModeProps> = ({ 
  inventory, 
  payments, 
  orders, 
  closures,
  forecasts,
  staffPerformance,
  onNavigate
}) => {
  const [activeStep, setActiveStep] = useState<'start' | 'live' | 'close' | 'review'>('start');

  // 1. START DAY DATA
  const todayForecast = forecasts.find(f => f.type === 'day');
  const criticalStock = inventory.filter(item => (item.quantity || 0) <= (item.minStockLevel || 0));
  const recentInsights = closures.length > 0 ? closures[0].actions : null;
  const topPerformer = useMemo(() => {
    return [...staffPerformance].sort((a,b) => b.score - a.score)[0];
  }, [staffPerformance]);

  // 2. LIVE SERVICE DATA
  const liveStats = useMemo(() => {
    const now = new Date();
    const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    
    const recentPayments = payments.filter(p => {
      const ts = p.timestamp as any;
      const pDate = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      return pDate >= startOfHour;
    });

    const recentOrders = orders.filter(o => {
      const ts = o.createdAt as any;
      const oDate = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      return oDate >= startOfHour;
    });

    return {
      revenueThisHour: recentPayments.reduce((sum, p) => sum + p.amount, 0),
      ordersThisHour: recentOrders.length,
      avgTicket: recentOrders.length > 0 ? recentPayments.reduce((sum, p) => sum + p.amount, 0) / recentOrders.length : 0
    };
  }, [payments, orders]);

  const renderStartDay = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Forecast Overview */}
        <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2.5 rounded-xl">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xs font-black text-text-navy uppercase tracking-widest">Today's Forecast</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-baseline border-b border-border-grey pb-4">
              <span className="text-[10px] font-black text-text-muted uppercase">Expected Revenue</span>
              <span className="text-2xl font-serif font-black text-text-navy">£{todayForecast?.forecast.revenue.toLocaleString() || '---'}</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-border-grey pb-4">
              <span className="text-[10px] font-black text-text-muted uppercase">Projected Covers</span>
              <span className="text-2xl font-serif font-black text-text-navy">{todayForecast?.forecast.orders || '---'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-secondary-surface rounded-2xl border border-border-grey">
            <Users className="w-4 h-4 text-accent" />
            <p className="text-[10px] font-bold text-text-navy uppercase tracking-wider">
              Suggested Staffing: <span className="font-black">4 Floor, 3 Kitchen</span>
            </p>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-cta/10 p-2.5 rounded-xl">
              <AlertCircle className="w-5 h-5 text-cta" />
            </div>
            <h3 className="text-xs font-black text-text-navy uppercase tracking-widest">Pre-service Risks</h3>
          </div>

          <div className="space-y-3">
            {criticalStock.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-cta/5 border border-cta/20 rounded-xl">
                <span className="text-xs font-bold text-text-navy">{item.name}</span>
                <span className="text-[10px] font-black text-cta uppercase">Low Stock: {item.quantity}{item.unit}</span>
              </div>
            ))}
            {recentInsights?.riskAlerts.slice(0, 2).map((alert, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-xs font-bold text-text-navy">{alert.type}</span>
                <span className="text-[10px] font-black text-amber-700 uppercase">Analysis Risk</span>
              </div>
            ))}
            {criticalStock.length === 0 && (recentInsights?.riskAlerts.length || 0) === 0 && (
              <p className="text-xs text-text-muted italic py-4 text-center">No critical risks detected for today.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-6">
        <Button 
          onClick={() => {
            setActiveStep('live');
            toast.success("Service Started. Live monitoring active.");
          }}
          className="bg-text-navy text-white px-12 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all flex items-center gap-3"
        >
          <Play className="w-4 h-4 fill-current" />
          Authorize & Start Day
        </Button>
      </div>
    </div>
  );

  const renderLiveService = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Live Monitor Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue (Hour)', value: `£${liveStats.revenueThisHour.toFixed(2)}`, icon: PoundSterling, color: 'text-emerald-600' },
          { label: 'Orders (Hour)', value: liveStats.ordersThisHour, icon: ShoppingBag, color: 'text-accent' },
          { label: 'Avg Ticket', value: `£${liveStats.avgTicket.toFixed(2)}`, icon: Activity, color: 'text-blue-600' },
          { label: 'Service Load', value: 'Moderate', icon: Clock, color: 'text-amber-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-border-grey shadow-sm group hover:border-accent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">{stat.label}</p>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-serif font-black text-text-navy">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Hourly Trend Chart Area */}
      <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm h-64 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-secondary-surface/30 flex items-center justify-center">
            <BarChart3 className="w-12 h-12 text-text-muted/20" />
            <span className="absolute bottom-6 text-[10px] font-black text-text-muted uppercase tracking-widest">Real-time Hourly Sales Distribution</span>
        </div>
      </div>

      {/* Operational Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border-grey shadow-sm space-y-4">
           <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
             <LayoutDashboard className="w-4 h-4 text-accent" />
             Floor Actions
           </h4>
           <div className="grid grid-cols-1 gap-2">
             <Button variant="ghost" className="justify-start text-xs font-bold hover:bg-accent/5">Update 86'd List</Button>
             <Button variant="ghost" className="justify-start text-xs font-bold hover:bg-accent/5">Broadcast to Staff</Button>
             <Button variant="ghost" className="justify-start text-xs font-bold hover:bg-accent/5 text-cta">Alert: Slow Kitchen</Button>
           </div>
        </div>

        <div className="md:col-span-2 bg-text-navy text-white rounded-3xl p-8 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 -mr-32 -mt-32 rounded-full blur-3xl opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 h-full">
            <div className="space-y-2">
               <h3 className="text-2xl font-serif font-black uppercase">Close Shift Soon?</h3>
               <p className="text-xs text-white/60">Ready to reconcile payments and verify stock?</p>
            </div>
            <Button 
               onClick={() => setActiveStep('close')}
               className="bg-accent text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-accent/20 flex items-center gap-2 hover:scale-105 transition-all"
            >
              Start Closure Process
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Header & Stepper */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif font-black text-text-navy uppercase tracking-tighter">Manager Mode</h1>
          <p className="text-xs text-text-muted font-bold uppercase tracking-widest italic flex items-center gap-2">
            <Activity className="w-3 h-3 text-accent animate-pulse" />
            Guided Operational Workflow
          </p>
        </div>

        <div className="flex items-center gap-1 bg-secondary-surface p-1.5 rounded-2xl border border-border-grey shadow-inner overflow-x-auto custom-scrollbar max-w-full">
          {[
            { id: 'start', label: 'Start Day', icon: Play },
            { id: 'live', label: 'Live Service', icon: Activity },
            { id: 'close', label: 'Close Day', icon: Lock },
            { id: 'review', label: 'Review', icon: TrendingUp }
          ].map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all flex-shrink-0 whitespace-nowrap ${
                activeStep === step.id 
                  ? 'bg-white text-text-navy shadow-md border border-border-grey/50' 
                  : 'text-text-muted hover:text-text-navy'
              }`}
            >
              <step.icon className={`w-4 h-4 ${activeStep === step.id ? 'text-accent' : 'opacity-40'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${activeStep === step.id ? 'opacity-100' : 'opacity-60'}`}>
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content Area */}
      <div className="min-h-[60vh]">
        {activeStep === 'start' && renderStartDay()}
        {activeStep === 'live' && renderLiveService()}
        {activeStep === 'close' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm text-center space-y-6 max-w-2xl mx-auto py-20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-cta" />
                <Lock className="w-16 h-16 text-text-navy/10 mx-auto mb-4" />
                <h3 className="text-2xl font-serif font-black text-text-navy uppercase">Daily Reconciliation</h3>
                <p className="text-sm text-text-muted italic">Ready to finalize today's figures? The system will guide you through cash declaration, order verification, and performance analysis.</p>
                <div className="flex justify-center gap-4 pt-6">
                  <Button 
                    onClick={() => onNavigate('reports')}
                    className="bg-accent text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
                  >
                    Open Closure Terminal
                  </Button>
                </div>
             </div>
          </div>
        )}
        {activeStep === 'review' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-12">
             <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-200 flex flex-col md:flex-row items-center gap-8 shadow-sm">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-serif font-black text-emerald-900 uppercase">Performance Review</h3>
                  <p className="text-sm text-emerald-800/70 italic">Sales targets met. Margin stability verified. Review auto-actions to further optimize tomorrow's service.</p>
                </div>
                <Button 
                    onClick={() => onNavigate('reports')}
                    variant="accent"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-8 py-3 rounded-xl text-xs font-black uppercase"
                >
                  View P&L Report
                </Button>
             </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Top Performer Card */}
                {topPerformer && (
                  <div className="bg-text-navy p-8 rounded-3xl text-white space-y-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 -mr-16 -mt-16 rounded-full blur-3xl" />
                    <div className="flex items-center justify-between relative z-10">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Top Performer</h4>
                       <Award className="w-5 h-5 text-accent" />
                    </div>
                    <div className="relative z-10">
                       <p className="text-3xl font-serif font-black">{topPerformer.staffName}</p>
                       <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] px-2 py-1 bg-white/10 rounded-lg font-black uppercase tracking-widest">{topPerformer.tier}</span>
                          <span className="text-[10px] font-bold text-white/60">Score: {topPerformer.score}</span>
                       </div>
                    </div>
                  </div>
                )}
                {/* Operational Recommendations */}
                <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm space-y-6">
                  <h4 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-accent" />
                    Operational Recommendations
                  </h4>
                  <div className="space-y-4">
                     {recentInsights?.pricing.slice(0, 2).map((p, idx) => (
                       <div key={idx} className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                          <p className="text-xs font-bold text-text-navy">{p.itemName}</p>
                          <p className="text-[10px] text-text-muted mt-1">{p.suggestion}</p>
                       </div>
                     ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm space-y-6">
                   <h4 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                     <Users className="w-4 h-4 text-blue-500" />
                     Staffing Insights
                   </h4>
                   <div className="space-y-4">
                     {recentInsights?.staffing.slice(0, 2).map((s, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                          <div className={`p-2 rounded-lg ${s.action === 'increase' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>
                             {s.action === 'increase' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-navy">{s.hour}</p>
                            <p className="text-[10px] text-text-muted">{s.suggestion}</p>
                          </div>
                        </div>
                     ))}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerMode;
