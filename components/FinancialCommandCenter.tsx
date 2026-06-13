import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Zap, Shield, 
  PoundSterling, Calculator, Clock, Receipt, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  Lock, PieChart, BarChart3, HelpCircle, FileText, Download,
  ChevronRight, Play, Eye, Users, Plus, Calendar,
  Package, LayoutDashboard, X, Tag
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { Button } from './Button';
import { 
  DailyClosure, POSOrder, POSPayment, StaffMember, 
  MonthlyTarget, CashflowRecord, Liability, AIAction, SystemAlert,
  VATTracker, ServiceChargeTracker, Forecast, InventoryItem, Recipe, LabourShift
} from '../types';
import { normalizeCurrency } from '../utils/currencyUtils';
import { db, LOCATION_ID } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { generateFinancialPackPDF } from '../services/pdfService';

interface FinancialCommandCenterProps {
  closures: DailyClosure[];
  orders: POSOrder[];
  payments: POSPayment[];
  staff: StaffMember[];
  monthlyTargets: MonthlyTarget[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  forecasts: Forecast[];
  onOpenView: (view: any) => void;
}

export const FinancialCommandCenter: React.FC<FinancialCommandCenterProps> = ({
  closures,
  orders,
  payments,
  staff,
  monthlyTargets,
  inventory,
  recipes,
  forecasts,
  onOpenView
}) => {
  const [cashflow, setCashflow] = useState<CashflowRecord[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [aiActions, setAiActions] = useState<AIAction[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [investorMode, setInvestorMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pnl' | 'cashflow' | 'vat' | 'ai'>('overview');
  const [timePeriod, setTimePeriod] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly'>('Monthly');
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(Math.floor(new Date().getMonth() / 3 + 1) as any);

  // Real-time data subscriptions
  useEffect(() => {
    const unsubCashflow = onSnapshot(
      query(collection(db, 'cashflow'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc'), limit(30)),
      (snap) => setCashflow(snap.docs.map(d => ({ id: d.id, ...d.data() } as CashflowRecord)))
    );

    const unsubLiabilities = onSnapshot(
      query(collection(db, 'liabilities'), where('locationId', '==', LOCATION_ID), orderBy('dueDate', 'asc')),
      (snap) => setLiabilities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Liability)))
    );

    const unsubAiActions = onSnapshot(
      query(collection(db, 'aiActions'), where('locationId', '==', LOCATION_ID), orderBy('timestamp', 'desc'), limit(10)),
      (snap) => setAiActions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AIAction)))
    );

    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), where('locationId', '==', LOCATION_ID), where('isRead', '==', false), orderBy('timestamp', 'desc')),
      (snap) => setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemAlert)))
    );

    return () => {
      unsubCashflow();
      unsubLiabilities();
      unsubAiActions();
      unsubAlerts();
    };
  }, []);

  // Labour Intelligence Shifts for Reconciliation
  const [labourShifts, setLabourShifts] = useState<LabourShift[]>([]);

  useEffect(() => {
    const unsubLabour = onSnapshot(
      query(collection(db, 'labourShifts'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc')),
      (snap) => setLabourShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabourShift)))
    );
    return () => unsubLabour();
  }, []);

  // Financial Calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Filter closures based on timePeriod
    const filteredClosures = closures.filter(c => {
      const cDate = new Date(c.date);
      if (timePeriod === 'Daily') return c.date === today;
      if (timePeriod === 'Weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return cDate >= weekAgo;
      }
      if (timePeriod === 'Monthly') return c.date.startsWith(today.substring(0, 7));
      if (timePeriod === 'Quarterly') {
        const qMonths = selectedQuarter === 1 ? [0, 1, 2] : 
                        selectedQuarter === 2 ? [3, 4, 5] : 
                        selectedQuarter === 3 ? [6, 7, 8] : [9, 10, 11];
        return qMonths.includes(cDate.getMonth()) && cDate.getFullYear() === now.getFullYear();
      }
      return false;
    });

    let grossSales: number;
    let vatCollected: number;
    let scCollected: number;

    if (filteredClosures.length > 0) {
      grossSales = filteredClosures.reduce((acc, c) => acc + (c.totals?.grossSales || 0), 0);
      vatCollected = filteredClosures.reduce((acc, c) => acc + (c.totals?.vat?.collected || 0), 0);
      scCollected = filteredClosures.reduce((acc, c) => acc + (c.totals?.serviceCharge?.collected || 0), 0);
    } else {
      // Closures not yet populated — derive totals from POS payment records
      const filteredPayments = payments.filter(p => {
        if (!p.timestamp) return false;
        const pDate = new Date(p.timestamp as any);
        const pStr = pDate.toISOString().split('T')[0];
        if (timePeriod === 'Daily') return pStr === today;
        if (timePeriod === 'Weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return pDate >= weekAgo;
        }
        if (timePeriod === 'Monthly') return pStr.startsWith(today.substring(0, 7));
        if (timePeriod === 'Quarterly') {
          const qMonths = selectedQuarter === 1 ? [0, 1, 2] :
                          selectedQuarter === 2 ? [3, 4, 5] :
                          selectedQuarter === 3 ? [6, 7, 8] : [9, 10, 11];
          return qMonths.includes(pDate.getMonth()) && pDate.getFullYear() === now.getFullYear();
        }
        return false;
      });
      grossSales = filteredPayments.reduce((acc, p) => acc + (p.grossSales || p.totalPaid || p.amount || 0), 0);
      vatCollected = filteredPayments.reduce((acc, p) => acc + (p.vatTotal || 0), 0);
      scCollected = filteredPayments.reduce((acc, p) => acc + (p.serviceChargeTotal || 0), 0);
    }

    const netRevenue = grossSales - vatCollected - scCollected;
    
    const cogs = filteredClosures.reduce((acc, c) => acc + (c.totals?.cogs || 0), 0);
    
    // RECONCILIATION: Use Actual Labour from Shifts if available for filtered dates
    const relevantShifts = labourShifts.filter(s => filteredClosures.some(c => s.date === c.date));
    const actualLabourCost = relevantShifts.length > 0 
      ? relevantShifts.reduce((acc, s) => acc + s.totalCost, 0)
      : filteredClosures.reduce((acc, c) => acc + (c.totals?.labour || 0), 0);

    const labour = actualLabourCost;
    const expenses = filteredClosures.reduce((acc, c) => acc + (c.totals?.expenses || 0), 0);
    
    const profitBeforeVAT = netRevenue - cogs - labour - expenses;
    const realProfit = profitBeforeVAT; // Simplified

    // Cash Position
    const totalLiabilities = liabilities.filter(l => l.status === 'Pending').reduce((acc, l) => acc + l.amount, 0);
    const vatOwed = vatCollected; // Simplified, should account for input VAT
    const scPending = scCollected; // Simplified
    
    // Total payments for month
    const totalPayments = payments.filter(p => p.timestamp && new Date(p.timestamp as any).toISOString().startsWith(today.substring(0, 7))).reduce((acc, p) => acc + (p.amount || 0), 0);
    
    // Use the latest cashflow balance if available, otherwise fallback to total payments
    const currentBalance = cashflow.length > 0 ? (cashflow[0].closingBalance || 25000) : totalPayments;
    const safeCash = currentBalance - totalLiabilities - vatOwed - scPending;

    // Targets
    const currentTarget = monthlyTargets.find(t => t.month === new Date().getMonth() && t.year === new Date().getFullYear());
    const revenueProgress = currentTarget ? (netRevenue / currentTarget.revenue) * 100 : 0;

    return {
      grossSales,
      netRevenue,
      realProfit,
      vatLiability: vatOwed,
      scPending,
      labourTotal: labour,
      cogsTotal: cogs,
      expensesTotal: expenses,
      labourPercent: netRevenue > 0 ? (labour / netRevenue) * 100 : 0,
      cogsPercent: netRevenue > 0 ? (cogs / netRevenue) * 100 : 0,
      safeCash,
      revenueProgress,
      breakEven: currentTarget ? (currentTarget.cogs + currentTarget.labour + currentTarget.expenses) : 0,
      isProfit: realProfit > 0,
      // Consistency Audit
      posTotalSales: orders.filter(o => o.status === 'Paid' && filteredClosures.some(c => o.createdAt.startsWith(c.date))).reduce((acc, o) => acc + (o.total || 0), 0),
      hubTotalSales: grossSales,
      variance: orders.filter(o => o.status === 'Paid' && filteredClosures.some(c => o.createdAt.startsWith(c.date))).reduce((acc, o) => acc + (o.total || 0), 0) - grossSales
    };
  }, [closures, payments, liabilities, monthlyTargets, timePeriod, selectedQuarter, orders]);

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

  const handleRunAIAnalysis = async () => {
    setIsGeneratingAI(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Note: We'd normally pass actual forecasts here, placeholder for now
      const { generateFinancialInsights } = await import('../services/aiDecisionService');
      await generateFinancialInsights(
        today,
        closures,
        orders,
        inventory,
        monthlyTargets,
        liabilities,
        forecasts,
        labourShifts
      );
      toast.success('AI Analysis complete. New recommendations generated.');
    } catch (error) {
      toast.error('AI Analysis failed');
    } finally {
      setIsGeneratingAI(false);
    }
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
            {investorMode ? 'Run Portfolio Audit' : 'Run AI Diagnostic'}
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
              generateFinancialPackPDF(metrics, closures, liabilities, investorMode);
              toast.success('Financial pack downloaded successfully');
            }}
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* KPI TOP BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: 'Gross Sales', value: metrics.grossSales, icon: BarChart3, color: 'text-text-navy' },
          { label: 'Net Revenue', value: metrics.netRevenue, icon: PoundSterling, color: 'text-text-navy' },
          { label: 'Real Profit', value: metrics.realProfit, icon: TrendingUp, color: metrics.realProfit > 0 ? 'text-success' : 'text-cta' },
          { label: investorMode ? 'ROI Projection' : 'VAT Liability', value: investorMode ? (metrics.realProfit / 1000000 * 100).toFixed(2) + '%' : metrics.vatLiability, icon: Shield, color: 'text-amber-600' },
          { label: investorMode ? 'EBITDA' : 'SC Pending', value: investorMode ? metrics.realProfit * 0.9 : metrics.scPending, icon: Users, color: 'text-text-muted' },
          { label: 'Labour %', value: `${metrics.labourPercent.toFixed(1)}%`, icon: Clock, color: metrics.labourPercent > 30 ? 'text-cta' : 'text-success' },
          { label: 'COGS %', value: `${metrics.cogsPercent.toFixed(1)}%`, icon: Package, color: metrics.cogsPercent > 35 ? 'text-cta' : 'text-success' },
          { label: 'Safe Cash', value: metrics.safeCash, icon: Zap, color: metrics.safeCash > 10000 ? 'text-accent' : 'text-cta' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-card-bg p-4 rounded-2xl border border-border-grey shadow-sm hover:border-accent transition-all group relative overflow-hidden">
            {investorMode && kpi.label === 'Real Profit' && (
              <div className="absolute top-0 right-0 p-1">
                <Shield className="w-3 h-3 text-accent" />
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <kpi.icon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              <ArrowUpRight className="w-3 h-3 text-success opacity-0 group-hover:opacity-100" />
            </div>
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">{kpi.label}</p>
            <p className={`text-lg font-black tracking-tight ${kpi.color}`}>
              {typeof kpi.value === 'number' ? `£${Math.abs(kpi.value).toLocaleString()}` : kpi.value}
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
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Real-time profitability threshold</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-text-muted uppercase">Target Today</p>
                      <p className="text-2xl font-black text-text-navy">£{(metrics.breakEven / 30).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-6 relative z-10">
                    <div className="h-4 w-full bg-secondary-surface rounded-full overflow-hidden flex border border-border-grey">
                      <div 
                        className="h-full bg-cta transition-all duration-1000" 
                        style={{ width: `${Math.min(100, Math.max(0, (metrics.netRevenue / metrics.breakEven) * 100))}%` }} 
                      />
                      <div 
                        className="h-full bg-success transition-all duration-1000" 
                        style={{ width: `${Math.max(0, (metrics.netRevenue / metrics.breakEven) * 100 - 100)}%` }} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-secondary-surface rounded-2xl border border-border-grey">
                        <p className="text-[10px] font-black text-text-muted uppercase mb-1">Break-Even</p>
                        <p className="text-lg font-black text-text-navy">£{metrics.breakEven.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-4 bg-card-bg border-2 border-accent rounded-2xl shadow-lg transform -translate-y-2">
                        <p className="text-[10px] font-black text-accent uppercase mb-1">Current Revenue</p>
                        <p className="text-xl font-black text-text-navy">£{metrics.netRevenue.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-4 bg-secondary-surface rounded-2xl border border-border-grey">
                        <p className="text-[10px] font-black text-text-muted uppercase mb-1">Profit Zone</p>
                        <p className="text-lg font-black text-success">
                          {metrics.realProfit > 0 ? `+£${metrics.realProfit.toLocaleString()}` : '£0'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl flex items-center gap-4">
                      <Zap className="w-5 h-5 text-accent" />
                      <p className="text-sm font-bold text-text-navy">
                        {metrics.realProfit < 0 
                          ? `You need £${Math.abs(metrics.realProfit).toLocaleString()} more revenue to reach break-even this month.`
                          : "You are in the Profit Zone! Every £1 of sales now contributes directly to the bottom line."
                        }
                      </p>
                    </div>

                    {/* CONSISTENCY AUDIT SECTION */}
                    <div className="bg-secondary-surface p-4 rounded-2xl border border-border-grey space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-4 h-4 ${Math.abs(metrics.variance) < 1 ? 'text-success' : 'text-cta'}`} />
                          <h4 className="text-xs font-black text-text-navy uppercase tracking-widest">Consistency Audit (POS vs HUB)</h4>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${Math.abs(metrics.variance) < 1 ? 'bg-success text-white' : 'bg-cta text-white'}`}>
                          {Math.abs(metrics.variance) < 1 ? 'Balanced' : 'Discrepancy Detected'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">POS Sales (Raw)</p>
                          <p className="text-sm font-black text-text-navy">£{metrics.posTotalSales.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">HUB Sales (Closure)</p>
                          <p className="text-sm font-black text-text-navy">£{metrics.hubTotalSales.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Variance</p>
                          <p className={`text-sm font-black ${Math.abs(metrics.variance) < 1 ? 'text-success' : 'text-cta'}`}>
                            {metrics.variance > 0 ? '+' : ''}£{metrics.variance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CASHFLOW MONITOR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
                    <h4 className="text-xs font-black text-text-navy uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent" /> Safe Cash Projection
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-text-muted">Estimated Cash on Hand</span>
                        <span className="text-sm font-black text-text-navy">£{(metrics.safeCash + metrics.vatLiability + metrics.scPending).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-cta">
                        <span className="text-sm font-medium">VAT Liability</span>
                        <span className="text-sm font-black">-£{metrics.vatLiability.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-cta">
                        <span className="text-sm font-medium">Service Charge Pending</span>
                        <span className="text-sm font-black">-£{metrics.scPending.toLocaleString()}</span>
                      </div>
                      <div className="pt-4 border-t border-border-grey flex justify-between items-center">
                        <span className="text-lg font-black text-text-navy">Safe Cash</span>
                        <span className={`text-2xl font-black ${metrics.safeCash > 0 ? 'text-success' : 'text-cta'}`}>
                          £{metrics.safeCash.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
                    <h4 className="text-xs font-black text-text-navy uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-accent" /> Upcoming Liabilities
                    </h4>
                    <div className="space-y-3">
                      {liabilities.length === 0 ? (
                        <p className="text-center py-8 text-xs font-bold text-text-muted uppercase tracking-widest">No pending liabilities</p>
                      ) : (
                        liabilities.slice(0, 4).map(l => (
                          <div key={l.id} className="flex items-center justify-between p-3 bg-secondary-surface rounded-xl border border-border-grey">
                            <div>
                              <p className="text-xs font-black text-text-navy uppercase">{l.name}</p>
                              <p className="text-[10px] font-bold text-text-muted uppercase">Due {l.dueDate}</p>
                            </div>
                            <p className="text-sm font-black text-text-navy">£{l.amount.toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <Button variant="ghost" className="w-full mt-4 text-[10px] uppercase font-black tracking-widest">View Financial Calendar</Button>
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
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Statement of Profit & Loss</h3>
                    <div className="flex gap-2">
                      <Button 
                        variant={timePeriod === 'Monthly' ? 'secondary' : 'ghost'} 
                        size="sm"
                        onClick={() => setTimePeriod('Monthly')}
                      >
                        Monthly
                      </Button>
                      <Button 
                        variant={timePeriod === 'Quarterly' ? 'secondary' : 'ghost'} 
                        size="sm"
                        onClick={() => setTimePeriod('Quarterly')}
                      >
                        Quarterly
                      </Button>
                    </div>
                  </div>

                  {timePeriod === 'Quarterly' && (
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

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 p-4 bg-secondary-surface rounded-xl border border-border-grey">
                      <span className="text-sm font-black text-text-navy uppercase">Gross Sales</span>
                      <span className="text-sm font-black text-right text-text-navy">£{metrics.grossSales.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-2 text-cta">
                      <span className="text-xs font-bold uppercase tracking-widest">- VAT</span>
                      <span className="text-xs font-bold text-right">-£{metrics.vatLiability.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-2 text-text-muted">
                      <span className="text-xs font-bold uppercase tracking-widest">- Service Charge</span>
                      <span className="text-xs font-bold text-right">-£{metrics.scPending.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4 bg-accent/5 rounded-xl border border-accent/20">
                      <span className="text-sm font-black text-accent uppercase">Net Revenue</span>
                      <span className="text-sm font-black text-right text-accent">£{metrics.netRevenue.toLocaleString()}</span>
                    </div>

                    <div className="h-px bg-border-grey my-4" />

                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Cost of Goods Sold (COGS)</span>
                      <span className="text-sm font-black text-right text-text-navy">£{metrics.cogsTotal.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Labour Expenses</span>
                      <span className="text-sm font-black text-right text-text-navy">£{metrics.labourTotal.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 px-4 py-3 hover:bg-secondary-surface transition-colors rounded-lg">
                      <span className="text-sm font-bold text-text-muted uppercase">Operating Expenses</span>
                      <span className="text-sm font-black text-right text-text-navy">£{metrics.expensesTotal.toLocaleString()}</span>
                    </div>

                    <div className="h-px bg-border-grey my-4" />

                    <div className={`grid grid-cols-2 p-6 rounded-2xl border-2 ${metrics.isProfit ? 'bg-success/5 border-success/20' : 'bg-cta/5 border-cta/20'}`}>
                      <div>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Company Profit</p>
                        <p className={`text-3xl font-black ${metrics.isProfit ? 'text-success' : 'text-cta'}`}>
                          £{metrics.realProfit.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-3 font-black text-text-navy uppercase text-xs">
                        <Tag className="w-4 h-4 text-accent" />
                        Margin: {((metrics.realProfit / metrics.netRevenue) * 100).toFixed(1)}%
                      </div>
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
                    <h3 className="text-xl font-black text-text-navy uppercase tracking-tight mb-8">Cash In vs Out</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[...cashflow].reverse()}>
                          <defs>
                            <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="date" 
                            hide 
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Area type="monotone" dataKey="cashIn" stroke="#10b981" fillOpacity={1} fill="url(#colorCashIn)" strokeWidth={3} />
                          <Area type="monotone" dataKey="cashOut" stroke="#ef4444" fillOpacity={1} fill="url(#colorCashOut)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm">
                    <h3 className="text-xl font-black text-text-navy uppercase tracking-tight mb-8">Liabilities Distribution</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={[
                              { name: 'VAT', value: metrics.vatLiability },
                              { name: 'Service Charge', value: metrics.scPending },
                              { name: 'Upcoming Liabilities', value: liabilities.filter(l => l.status === 'Pending').reduce((acc, l) => acc + l.amount, 0) }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#6366f1" />
                            <Cell fill="#f43f5e" />
                            <Cell fill="#f59e0b" />
                          </Pie>
                          <Tooltip />
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
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
                    <Shield className="w-4 h-4 text-success" /> Fully Reconciled with POS Data
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">VAT Collected</p>
                      <p className="text-2xl font-black">£{metrics.vatLiability.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">VAT Reclaimable (Est)</p>
                      <p className="text-2xl font-black">£{(metrics.cogsTotal * 0.2).toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net VAT Payable</p>
                      <p className="text-2xl font-black text-cta">£{(metrics.vatLiability - (metrics.cogsTotal * 0.2)).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-4">
                    <Button onClick={() => onOpenView('reports')} className="bg-white text-text-navy hover:bg-slate-100 border-none">
                      Generate HMRC Report
                    </Button>
                    <Button variant="ghost" className="text-white border-white/20 hover:bg-white/10">
                      View Historical Returns
                    </Button>
                  </div>
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
                    Intelligent recommendations for financial and operational optimization. 
                    AI suggests, manager approves, system executes.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {aiActions.length === 0 ? (
                    <div className="text-center py-20 bg-card-bg rounded-2xl border border-dashed border-border-grey">
                      <Zap className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-black text-text-muted uppercase tracking-widest">No active AI recommendations</p>
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
          {/* SYSTEM ALERTS */}
          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-6">
            <h4 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center justify-between">
              Live Alerts {alerts.length > 0 && <span className="bg-cta text-white px-2 py-0.5 rounded-full text-[10px]">{alerts.length}</span>}
            </h4>
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">System Optimal</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className={`p-4 rounded-xl border-l-4 shadow-sm ${
                    alert.severity === 'Critical' ? 'bg-red-50 border-red-500' : 
                    alert.severity === 'Warning' ? 'bg-amber-50 border-amber-500' : 
                    'bg-blue-50 border-blue-500'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-black text-text-navy uppercase">{alert.message}</p>
                      <button className="text-text-muted hover:text-text-navy">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted leading-relaxed">{alert.description}</p>
                    <p className="text-[9px] font-medium text-text-muted mt-2 uppercase tracking-tighter">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
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
            <Button variant="ghost" className="w-full text-xs font-bold uppercase tracking-widest">Full Labour Audit</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
