
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart3, 
  DollarSign, 
  UserPlus, 
  ChevronRight, 
  Sparkles,
  Target,
  Shield,
  Zap,
  Briefcase,
  History,
  FileText,
  PieChart,
  Sun,
  Moon,
  Layout,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { 
  StaffMember, 
  POSOrder, 
  DailyClosure, 
  LabourShift,
  StaffingForecast,
  Rota,
  RotaShift,
  RotaSuggestion,
  StaffAvailability,
  LabourBudgetRecord,
  ShiftType
} from '../types';
import { Button } from './Button';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, LOCATION_ID, auth, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  Cell,
  Legend
} from 'recharts';

interface StaffingRotaHubProps {
  staff: StaffMember[];
  orders: POSOrder[];
  closures: DailyClosure[];
  shifts: LabourShift[];
  onSetCurrentView: (view: any) => void;
}

type Tab = 'dashboard' | 'forecast' | 'calendar' | 'rota' | 'budget' | 'availability' | 'overtime' | 'coverage';

export const StaffingRotaHub: React.FC<StaffingRotaHubProps> = ({ 
  staff, 
  orders, 
  closures, 
  shifts,
  onSetCurrentView 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [forecasts, setForecasts] = useState<StaffingForecast[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [availabilities, setAvailabilities] = useState<StaffAvailability[]>([]);
  const [budgets, setBudgets] = useState<LabourBudgetRecord[]>([]);

  // Subscriptions
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubForecasts = onSnapshot(
      query(collection(db, 'staffingForecasts'), where('locationId', '==', LOCATION_ID)),
      (snapshot) => setForecasts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StaffingForecast))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'staffingForecasts')
    );

    const unsubRotas = onSnapshot(
      query(collection(db, 'rotas'), where('locationId', '==', LOCATION_ID)),
      (snapshot) => setRotas(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rota))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'rotas')
    );

    const unsubAvail = onSnapshot(
      query(collection(db, 'staffAvailability'), where('locationId', '==', LOCATION_ID)),
      (snapshot) => setAvailabilities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StaffAvailability))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'staffAvailability')
    );

    const unsubBudgets = onSnapshot(
      query(collection(db, 'labourBudgets'), where('locationId', '==', LOCATION_ID)),
      (snapshot) => setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LabourBudgetRecord))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'labourBudgets')
    );

    setLoading(false);
    return () => {
      unsubForecasts();
      unsubRotas();
      unsubAvail();
      unsubBudgets();
    };
  }, []);

  // Helper: Get Weekly Rota
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }, []);

  const currentRota = useMemo(() => {
    return rotas.find(r => r.weekStarting === currentWeekStart) || null;
  }, [rotas, currentWeekStart]);

  // UI Components mapping
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <StaffingDashboard 
          forecasts={forecasts} 
          rotas={rotas} 
          budgets={budgets} 
          currentRota={currentRota} 
          shifts={shifts}
          orders={orders}
        />;
      case 'forecast':
        return <ForecastManager staff={staff} forecasts={forecasts} orders={orders} closures={closures} />;
      case 'calendar':
        return <CalendarView rotas={rotas} staff={staff} forecasts={forecasts} />;
      case 'rota':
        return <RotaBuilder staff={staff} rotas={rotas} forecasts={forecasts} availabilities={availabilities} />;
      case 'budget':
        return <BudgetManager budgets={budgets} closures={closures} />;
      case 'availability':
        return <AvailabilityManager staff={staff} availabilities={availabilities} />;
      case 'overtime':
        return <OvertimeControl staff={staff} shifts={shifts} currentRota={currentRota} />;
      case 'coverage':
        return <CoverageEngine currentRota={currentRota} staff={staff} forecasts={forecasts} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-accent/10 p-4 rounded-2xl">
              <Calendar className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-text-navy uppercase tracking-tight italic">Staffing & Rota Intelligence</h1>
              <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                AI-Driven Labour Efficiency & Planning System
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-secondary-surface p-1 rounded-2xl border border-border-grey overflow-x-auto max-w-full">
              {(['dashboard', 'forecast', 'calendar', 'rota', 'budget', 'availability', 'overtime', 'coverage'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
                    activeTab === tab 
                    ? 'bg-white text-accent shadow-sm border border-border-grey' 
                    : 'text-text-muted hover:text-text-navy'
                  }`}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

interface StaffingDashboardProps {
  forecasts: StaffingForecast[];
  rotas: Rota[];
  budgets: LabourBudgetRecord[];
  currentRota: Rota | null;
  shifts: LabourShift[];
  orders: POSOrder[];
}

const StaffingDashboard: React.FC<StaffingDashboardProps> = ({ forecasts, budgets, currentRota, shifts, orders }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayForecast = forecasts.find(f => f.date === today);
  
  const todaySales = orders.filter(o => o.status === 'Paid' && o.createdAt.startsWith(today)).reduce((acc, o) => acc + (o.total || 0), 0);
  const todayLabourCost = shifts.filter(s => s.date === today).reduce((acc, s) => acc + s.totalCost, 0);
  const todayLabourPercent = todaySales > 0 ? (todayLabourCost / todaySales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Forecasted Sales" 
          value={`£${(todayForecast?.forecastSales || 0).toLocaleString()}`} 
          subtitle="Expected today"
          icon={TrendingUp}
          color="accent"
        />
        <KPICard 
          title="Recommended Staff" 
          value={todayForecast?.recommendedStaff.reduce((acc, s) => acc + s.count, 0).toString() || '0'} 
          subtitle="Across all departments"
          icon={Users}
          color="success"
        />
        <KPICard 
          title="Labour Budget" 
          value={`£${(todayForecast?.labourBudget || 0).toLocaleString()}`} 
          subtitle={`Target: ${todayForecast?.expectedLabourPercent || 28}%`}
          icon={DollarSign}
          color="cta"
        />
        <KPICard 
          title="Overtime Risk" 
          value="2 Warnings" 
          subtitle="Staff nearing thresholds"
          icon={AlertTriangle}
          color="amber"
          status="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-text-navy uppercase tracking-tight flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-accent" />
              Staffing vs Sales Trend
            </h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-text-muted">
                <div className="w-2 h-2 rounded-full bg-accent" /> Sales
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-text-muted">
                <div className="w-2 h-2 rounded-full bg-success" /> Labour
              </span>
            </div>
          </div>
          <div className="h-[400px]">
             {/* Recharts here */}
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={forecasts.slice(-7)}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                 <YAxis fontSize={10} axisLine={false} tickLine={false} />
                 <Tooltip />
                 <Area type="monotone" dataKey="forecastSales" fill="#6366f1" fillOpacity={0.1} stroke="#6366f1" strokeWidth={2} name="Forecast Sales" />
                 <Area type="monotone" dataKey="labourBudget" fill="#22c55e" fillOpacity={0.1} stroke="#22c55e" strokeWidth={2} name="Labour Budget" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-6">
          <div className="bg-text-navy p-6 rounded-3xl shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-24 h-24 text-white" />
             </div>
             <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
               <Zap className="w-5 h-5 text-accent" />
               Shift Coach Insights
             </h3>
             <div className="space-y-4">
                <InsightItem 
                  text="Friday Dinner requires extra bartender. Forecasted sales up 15%."
                  priority="High"
                  impact="Better guest experience"
                />
                <InsightItem 
                  text="Tuesday Lunch is consistently overstaffed. Suggest reducing 1 FOH."
                  priority="Medium"
                  impact="Save £85/shift"
                />
                <InsightItem 
                  text="Current Rota exceeds labour budget by £240 this week."
                  priority="Critical"
                  impact="Profitability risk"
                />
             </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-border-grey shadow-sm">
             <h3 className="text-sm font-black text-text-navy uppercase tracking-widest mb-4">Coverage Status</h3>
             <div className="space-y-4">
                <CoverageItem label="Monday" foh="OK" bar="OK" kit="LOW" status="warning" />
                <CoverageItem label="Tuesday" foh="OK" bar="OK" kit="OK" status="success" />
                <CoverageItem label="Wednesday" foh="LOW" bar="OK" kit="OK" status="warning" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- HELPER UI ---

const KPICard = ({ title, value, subtitle, icon: Icon, color, status }: any) => (
  <div className={`bg-white p-6 rounded-3xl border border-border-grey shadow-sm hover:border-${color} transition-all group`}>
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 bg-${color}/10 rounded-xl group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
      {status && (
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-success/10 text-success'}`}>
          {status}
        </span>
      )}
    </div>
    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">{title}</p>
    <p className="text-2xl font-black text-text-navy tracking-tight">{value}</p>
    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2">{subtitle}</p>
  </div>
);

const InsightItem = ({ text, priority, impact }: any) => (
  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group">
    <div className="flex items-center justify-between mb-2">
      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
        priority === 'High' ? 'bg-cta text-white' : 
        priority === 'Critical' ? 'bg-red-500 text-white' : 
        'bg-accent text-white'
      }`}>
        {priority}
      </span>
      <span className="text-[9px] font-bold text-white/50">{impact}</span>
    </div>
    <p className="text-xs text-white/90 font-medium leading-relaxed group-hover:text-white transition-colors">{text}</p>
  </div>
);

const CoverageItem = ({ label, foh, bar, kit, status }: any) => (
  <div className="flex items-center justify-between p-3 bg-secondary-surface rounded-xl border border-border-grey">
    <span className="text-xs font-black text-text-navy uppercase w-20">{label}</span>
    <div className="flex items-center gap-3">
      <div className="text-center">
        <p className="text-[8px] font-black text-text-muted uppercase">FOH</p>
        <span className={`text-[10px] font-black ${foh === 'LOW' ? 'text-cta' : 'text-success'}`}>{foh}</span>
      </div>
      <div className="text-center">
        <p className="text-[8px] font-black text-text-muted uppercase">BAR</p>
        <span className={`text-[10px] font-black ${bar === 'LOW' ? 'text-cta' : 'text-success'}`}>{bar}</span>
      </div>
      <div className="text-center">
        <p className="text-[8px] font-black text-text-muted uppercase">KIT</p>
        <span className={`text-[10px] font-black ${kit === 'LOW' ? 'text-cta' : 'text-success'}`}>{kit}</span>
      </div>
    </div>
  </div>
);

// --- SECTION MANAGERS ---

const ForecastManager: React.FC<any> = ({ staff, forecasts, orders, closures }) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight">Staffing Forecast</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1">Predicting requirements based on demand</p>
        </div>
        <Button className="gap-2">
          <Sparkles className="w-4 h-4" />
          Update AI Forecast
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['Tomorrow', 'Sat May 9', 'Sun May 10'].map((day, i) => (
          <div key={i} className="p-6 bg-secondary-surface rounded-3xl border border-border-grey border-t-4 border-t-accent shadow-sm">
            <h4 className="text-lg font-black text-text-navy uppercase mb-4">{day}</h4>
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-border-grey">
                <p className="text-[10px] font-black text-text-muted uppercase mb-2">Sales Forecast</p>
                <p className="text-xl font-black text-accent italic">£3,450</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-3">Recommended Staffing</p>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-border-grey">
                  <span className="text-xs font-bold uppercase">Front of House</span>
                  <span className="font-black text-accent">5</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-border-grey">
                  <span className="text-xs font-bold uppercase">Bar & Drinks</span>
                  <span className="font-black text-accent">2</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-border-grey">
                  <span className="text-xs font-bold uppercase">Kitchen Team</span>
                  <span className="font-black text-accent">4</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RotaBuilderProps {
  staff: StaffMember[];
  rotas: Rota[];
  forecasts: StaffingForecast[];
  availabilities: StaffAvailability[];
}

const RotaBuilder: React.FC<RotaBuilderProps> = ({ staff, rotas, forecasts, availabilities }) => {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingRota, setEditingRota] = useState<Partial<Rota> | null>(null);

  // Helper: Get Weekly Rota Dates
  const weekDates = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  }, []);

  const weekStarting = weekDates[0];
  const activeRota = useMemo(() => {
    return rotas.find(r => r.weekStarting === weekStarting) || null;
  }, [rotas, weekStarting]);

  const generateAiSuggestions = async () => {
    setIsGenerating(true);
    toast.loading('AI is analyzing demand and staff preferences...', { id: 'rota-gen' });

    try {
      // Logic for AI Suggestion
      // In a real app, this would call a cloud function or Gemini
      const suggestedShifts: RotaShift[] = [];
      const roles = ['Front of House', 'Bar & Drinks', 'Kitchen Team'];

      weekDates.forEach(date => {
        const forecast = forecasts.find(f => f.date === date);
        if (forecast) {
          roles.forEach(role => {
            const roleCount = forecast.departments[role === 'Front of House' ? 'foh' : role === 'Kitchen Team' ? 'kitchen' : 'bar'] || 0;
            const qualifiedStaff = staff.filter(s => s.role === role);
            
            for (let i = 0; i < roleCount; i++) {
              const staffMember = qualifiedStaff[i % qualifiedStaff.length];
              if (staffMember) {
                suggestedShifts.push({
                  id: Math.random().toString(36).substr(2, 9),
                  staffId: staffMember.id,
                  staffName: `${staffMember.firstName} ${staffMember.lastName}`,
                  role: staffMember.role,
                  date,
                  startTime: '17:00',
                  endTime: '23:30',
                  breakMinutes: 30,
                  estimatedCost: (staffMember.hourlyRate || 12) * 6.5,
                  department: role === 'Front of House' ? 'foh' : role === 'Kitchen Team' ? 'kitchen' : 'bar'
                });
              }
            }
          });
        }
      });

      const newRota: Omit<Rota, 'id'> = {
        locationId: LOCATION_ID,
        weekStarting,
        shifts: suggestedShifts,
        status: 'Draft',
        totalEstimatedLabour: suggestedShifts.reduce((acc, s) => acc + s.estimatedCost, 0),
        totalForecastSales: forecasts.filter(f => weekDates.includes(f.date)).reduce((acc, f) => acc + f.forecastSales, 0),
        targetLabourPercent: 28,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'rotas'), newRota);
      toast.success('Smart Rota generated successfully!', { id: 'rota-gen' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate rota', { id: 'rota-gen' });
    } finally {
      setIsGenerating(false);
    }
  };

  const publishRota = async () => {
    if (!activeRota) return;
    try {
      await updateDoc(doc(db, 'rotas', activeRota.id), { status: 'Published' });
      toast.success('Rota published! Staff will be notified.');
    } catch (error) {
      toast.error('Failed to publish rota');
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight">Smart Rota Builder</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1 italic">Week Commencing: {weekStarting}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="secondary" 
            className="gap-2"
            onClick={generateAiSuggestions}
            disabled={isGenerating || !!activeRota}
          >
            {isGenerating ? <Zap className="w-4 h-4 animate-spin text-accent" /> : <Sparkles className="w-4 h-4 text-accent" />}
            {isGenerating ? 'Analyzing...' : 'Generate Suggestions'}
          </Button>
          <Button 
            className="gap-2"
            onClick={publishRota}
            disabled={!activeRota || activeRota.status === 'Published'}
          >
            <CheckCircle2 className="w-4 h-4" />
            {activeRota?.status === 'Published' ? 'Already Published' : 'Publish Rota'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          <div className="bg-secondary-surface rounded-3xl border border-border-grey overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-8 border-b border-border-grey bg-white/50">
              <div className="p-4 border-r border-border-grey text-[10px] font-black uppercase text-text-muted">Staff Member</div>
              {weekDates.map(date => (
                <div key={date} className="p-4 border-r border-border-grey text-center">
                  <p className="text-[10px] font-black uppercase text-text-navy">{new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                  <p className="text-[8px] font-bold text-text-muted uppercase">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="divide-y divide-border-grey">
              {staff.map((member) => (
                <div key={member.id} className="grid grid-cols-8 hover:bg-accent/5 transition-colors group">
                  <div className="p-4 border-r border-border-grey bg-white/30 sticky left-0 z-10 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase text-text-navy truncate">{member.firstName} {member.lastName}</p>
                    <p className="text-[8px] font-bold text-text-muted uppercase">{member.role}</p>
                  </div>
                  {weekDates.map((date) => {
                    const shift = activeRota?.shifts.find(s => s.staffId === member.id && s.date === date);
                    return (
                      <div key={date} className="p-2 border-r border-border-grey min-h-[100px] flex items-center justify-center relative">
                        {shift ? (
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white p-3 rounded-2xl border border-border-grey shadow-sm text-center w-full group-hover:border-accent transition-all hover:scale-105 cursor-pointer"
                          >
                            <div className="bg-accent/10 rounded-full w-2 h-2 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-text-navy">{shift.startTime} - {shift.endTime}</p>
                            <p className="text-[8px] font-bold text-text-muted uppercase mt-1">{shift.department.toUpperCase()}</p>
                            
                            {activeRota?.status === 'Draft' && (
                              <button className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </motion.div>
                        ) : (
                          <button className="p-2 opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all">
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rota Summary Bar */}
      {activeRota && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-text-navy p-6 rounded-3xl text-white border border-white/10"
        >
          <div className="flex items-center gap-4">
             <div className="bg-white/10 p-3 rounded-2xl">
                <DollarSign className="w-6 h-6 text-accent" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Total Labour Cost</p>
                <p className="text-xl font-black">£{activeRota.totalEstimatedLabour.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-white/10 p-3 rounded-2xl">
                <Target className="w-6 h-6 text-success" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Target Labour %</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-xl font-black">{((activeRota.totalEstimatedLabour / (activeRota.totalForecastSales || 1)) * 100).toFixed(1)}%</p>
                   <span className="text-[10px] font-bold text-white/40">vs {activeRota.targetLabourPercent}%</span>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-white/10 p-3 rounded-2xl">
                <Clock className="w-6 h-6 text-cta" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Total Weekly Hours</p>
                <p className="text-xl font-black uppercase">{activeRota.shifts.length * 6.5}h</p>
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const CalendarView: React.FC<any> = ({ rotas, staff, forecasts }) => {
  const weekDates = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  }, []);

  const weekStarting = weekDates[0];
  const activeRota = rotas.find((r: Rota) => r.weekStarting === weekStarting);

  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight italic">Shift Calendar</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1">Weekly Overview: {weekStarting}</p>
        </div>
        <div className="flex items-center gap-2">
          {['FOH', 'BAR', 'KIT'].map(dept => (
             <div key={dept} className="flex items-center gap-2 px-3 py-1 bg-secondary-surface rounded-full border border-border-grey">
                <div className={`w-2 h-2 rounded-full ${dept === 'FOH' ? 'bg-accent' : dept === 'BAR' ? 'bg-success' : 'bg-cta'}`} />
                <span className="text-[10px] font-black uppercase text-text-muted">{dept}</span>
             </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDates.map((date) => {
          const dayShifts = activeRota?.shifts.filter((s: RotaShift) => s.date === date) || [];
          const forecast = forecasts.find((f: StaffingForecast) => f.date === date);
          
          return (
            <div key={date} className="space-y-4">
              <div className="text-center p-3 bg-secondary-surface rounded-2xl border border-border-grey">
                <p className="text-xs font-black text-text-navy uppercase">{new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                <p className="text-[10px] font-bold text-text-muted">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              </div>

              <div className="space-y-2 min-h-[400px]">
                {dayShifts.map((shift: RotaShift) => (
                  <motion.div
                    key={shift.id}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`p-3 rounded-2xl border border-border-grey shadow-sm relative overflow-hidden group hover:brightness-95 cursor-pointer transition-all ${
                      shift.department === 'foh' ? 'bg-accent/5' : shift.department === 'bar' ? 'bg-success/5' : 'bg-cta/5'
                    }`}
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      shift.department === 'foh' ? 'bg-accent' : shift.department === 'bar' ? 'bg-success' : 'bg-cta'
                    }`} />
                    <p className="text-[9px] font-black text-text-navy uppercase truncate">{shift.staffName}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-bold text-text-muted italic">{shift.startTime}</span>
                      <span className="text-[8px] font-black uppercase text-text-muted">{shift.department}</span>
                    </div>
                  </motion.div>
                ))}
                
                {dayShifts.length === 0 && (
                  <div className="h-full rounded-2xl border border-dashed border-border-grey flex items-center justify-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase italic">No Shifts</p>
                  </div>
                )}
              </div>

              {forecast && (
                <div className="p-3 bg-text-navy/5 rounded-2xl border border-text-navy/10">
                   <p className="text-[8px] font-black text-text-muted uppercase mb-1">Target Sales</p>
                   <p className="text-sm font-black text-text-navy italic">£{forecast.forecastSales.toLocaleString()}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BudgetManager: React.FC<any> = ({ budgets, closures }) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
       <div className="flex items-center justify-between mb-8 text-center md:text-left">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight">Labour Budget Control</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1 italic italic">Optimizing profitability thresholds</p>
        </div>
        <div className="bg-cta/10 p-4 rounded-2xl border border-cta/20">
          <p className="text-[10px] font-black text-cta uppercase tracking-widest">Active Target</p>
          <p className="text-2xl font-black text-cta italic">28.5%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
           <h3 className="text-lg font-black text-text-navy uppercase tracking-tight italic">Daily Budget Breakdown</h3>
           <div className="space-y-3">
              {[
                { date: 'Monday', forecast: 2400, budget: 684, scheduled: 650 },
                { date: 'Tuesday', forecast: 2600, budget: 741, scheduled: 780 },
                { date: 'Wednesday', forecast: 2800, budget: 798, scheduled: 810 },
                { date: 'Thursday', forecast: 3200, budget: 912, scheduled: 890 },
              ].map((item, i) => (
                <div key={i} className="bg-secondary-surface p-4 rounded-2xl border border-border-grey flex items-center justify-between group hover:border-accent transition-colors">
                  <div>
                    <p className="text-xs font-black text-text-navy uppercase">{item.date}</p>
                    <p className="text-[10px] font-bold text-text-muted uppercase">Forecast: £{item.forecast.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-text-navy">Sched: £{item.scheduled}</p>
                    <p className={`text-[10px] font-black uppercase ${item.scheduled > item.budget ? 'text-cta' : 'text-success'}`}>
                      {item.scheduled > item.budget ? `Over by £${item.scheduled - item.budget}` : `Under by £${item.budget - item.scheduled}`}
                    </p>
                  </div>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-border-grey shadow-sm">
           <h3 className="text-lg font-black text-text-navy uppercase tracking-tight mb-6 italic">Budget Efficiency Metric</h3>
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[
                   { name: 'Mon', budget: 684, actual: 650 },
                   { name: 'Tue', budget: 741, actual: 780 },
                   { name: 'Wed', budget: 798, actual: 810 },
                   { name: 'Thu', budget: 912, actual: 890 },
                 ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="budget" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Max Budget" />
                    <Bar dataKey="actual" fill="#6366f1" radius={[4, 4, 0, 0]} name="Scheduled" />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <p className="text-[10px] text-text-muted font-bold text-center mt-6 italic">Goal: Keep Scheduled below Max Budget without sacrificing service quality.</p>
        </div>
      </div>
    </div>
  );
};

const AvailabilityManager: React.FC<any> = ({ staff, availabilities }) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
       <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight text-center md:text-left">Staff Availability & Leave</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1 italic">Managing preferences and holiday requests</p>
        </div>
        <Button variant="secondary" className="gap-2">
          <Calendar className="w-4 h-4" />
          Request Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
             <h3 className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-4">Pending Holiday Requests</h3>
             {[
               { name: 'Maria Gonzalez', dates: 'May 14 - May 18', type: 'Holiday', status: 'Pending' },
               { name: 'John Smith', dates: 'June 5', type: 'Personal', status: 'Pending' },
             ].map((req, i) => (
                <div key={i} className="bg-secondary-surface p-4 rounded-2xl border border-border-grey flex items-center justify-between">
                   <div>
                      <p className="text-xs font-black text-text-navy uppercase">{req.name}</p>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{req.dates} ({req.type})</p>
                   </div>
                   <div className="flex gap-2">
                      <button className="p-2 bg-success text-white rounded-lg hover:brightness-110"><Check className="w-3 h-3" /></button>
                      <button className="p-2 bg-cta text-white rounded-lg hover:brightness-110"><X className="w-3 h-3" /></button>
                   </div>
                </div>
             ))}
          </div>

          <div className="bg-secondary-surface p-8 rounded-3xl border border-border-grey text-center md:text-left">
             <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-accent/10 rounded-2xl">
                   <Clock className="w-6 h-6 text-accent" />
                </div>
                <div>
                   <h4 className="text-lg font-black text-text-navy uppercase tracking-tight">Maximum Hours Alert</h4>
                   <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Enforce weekly work thresholds</p>
                </div>
             </div>
             <p className="text-sm text-text-navy font-bold leading-relaxed mb-6">
               Managers are warned if rota suggestions exceed staff member\'s maximum preferred weekly hours.
             </p>
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white p-4 rounded-2xl border border-border-grey shadow-sm">
                    <p className="text-[9px] font-black text-text-muted uppercase mb-1 underline decoration-accent decoration-2 underline-offset-4">Full Time Cap</p>
                    <p className="text-xl font-black text-text-navy italic">45 Hours</p>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-border-grey shadow-sm">
                    <p className="text-[9px] font-black text-text-muted uppercase mb-1 underline decoration-accent decoration-2 underline-offset-4">Part Time Cap</p>
                    <p className="text-xl font-black text-text-navy italic">16 Hours</p>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};

const OvertimeControl: React.FC<any> = ({ staff, shifts, currentRota }) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
       <div className="flex items-center justify-between mb-8 text-center md:text-left">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight">Overtime Control Center</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1 italic">Vigilant monitoring of labour leakage</p>
        </div>
        <div className="bg-amber-100 p-4 rounded-2xl border border-amber-200">
           <div className="flex items-center gap-2 text-amber-900 mb-1">
             <AlertCircle className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-widest">Estimated OT Cost</span>
           </div>
           <p className="text-2xl font-black text-amber-900 italic">£412</p>
        </div>
      </div>

      <div className="space-y-6">
         <div className="bg-cta p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
               <Shield className="w-32 h-32 text-white" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Critical Overtime Breach Risks</h3>
            <p className="text-white/70 text-sm mb-6 max-w-xl">The following staff members are projected to exceed their standard contract hours based on the current published rota.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
               {[
                 { name: 'Maria Gonzalez', role: 'Kitchen', hours: 48, threshold: 45, risk: 'High' },
                 { name: 'David Wilson', role: 'Bar', hours: 46.5, threshold: 45, risk: 'Medium' },
               ].map((staff, i) => (
                 <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                          <p className="text-sm font-black text-white uppercase">{staff.name}</p>
                          <p className="text-[9px] font-bold text-white/60 uppercase">{staff.role}</p>
                       </div>
                       <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${staff.risk === 'High' ? 'bg-white text-cta' : 'bg-white/20 text-white'}`}>
                         {staff.risk} Risk
                       </span>
                    </div>
                    <div className="flex items-end justify-between">
                       <div>
                          <p className="text-[9px] font-bold text-white/50 uppercase mb-1">Projected Hours</p>
                          <p className="text-2xl font-black text-white italic">{staff.hours}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-bold text-white/50 uppercase mb-1">Threshold</p>
                          <p className="text-sm font-black text-white">{staff.threshold}</p>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="bg-white p-8 rounded-3xl border border-border-grey">
            <h3 className="text-lg font-black text-text-navy uppercase tracking-tight mb-6">Historical OT Trends</h3>
            <div className="h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { week: 'W16', otHours: 12 },
                    { week: 'W17', otHours: 24 },
                    { week: 'W18', otHours: 15 },
                    { week: 'W19', otHours: 42 },
                    { week: 'W20', otHours: 8 },
                  ]}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="week" fontSize={10} axisLine={false} tickLine={false} />
                     <YAxis fontSize={10} axisLine={false} tickLine={false} />
                     <Tooltip />
                     <Line type="monotone" dataKey="otHours" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 4 }} name="OT Hours" />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
    </div>
  );
};

const CoverageEngine: React.FC<any> = ({ currentRota, staff, forecasts }) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[600px]">
       <div className="flex items-center justify-between mb-8 text-center md:text-left">
        <div>
          <h2 className="text-2xl font-black text-text-navy uppercase tracking-tight">Shift Coverage Engine</h2>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1 italic">Gap analysis and department synchronization</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest border border-success/20">
              <CheckCircle2 className="w-3 h-3" /> All Roles Met
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-secondary-surface p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-accent transition-all">
            <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-6 pb-2 border-b-2 border-accent inline-block">Front of House</h4>
            <div className="space-y-4">
               {['Mon Dinner', 'Fri Lunch', 'Sat Dinner'].map((shift, i) => (
                 <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border-grey">
                    <span className="text-xs font-bold text-text-navy uppercase">{shift}</span>
                    <span className="text-[10px] font-black text-success uppercase">Optimal</span>
                 </div>
               ))}
               <div className="flex justify-between items-center bg-cta/5 p-3 rounded-xl border border-cta/20">
                  <span className="text-xs font-bold text-cta uppercase">Sun Lunch</span>
                  <span className="text-[10px] font-black text-cta uppercase italic animate-pulse">-1 Waiter</span>
               </div>
            </div>
         </div>

         <div className="bg-secondary-surface p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-cta transition-all">
            <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-6 pb-2 border-b-2 border-cta inline-block">Kitchen Team</h4>
            <div className="space-y-4">
               {['Mon Lunch', 'Tue Dinner', 'Fri Dinner'].map((shift, i) => (
                 <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border-grey">
                    <span className="text-xs font-bold text-text-navy uppercase">{shift}</span>
                    <span className="text-[10px] font-black text-success uppercase">Optimal</span>
                 </div>
               ))}
               <div className="flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <span className="text-xs font-bold text-amber-700 uppercase">Sat Dinner</span>
                  <span className="text-[10px] font-black text-amber-700 uppercase italic">Role Imbalance</span>
               </div>
            </div>
         </div>

         <div className="bg-secondary-surface p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-success transition-all">
            <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-6 pb-2 border-b-2 border-success inline-block">Bar & Drinks</h4>
            <div className="space-y-4">
               {['Wed Dinner', 'Thu Dinner', 'Fri Dinner', 'Sat Dinner'].map((shift, i) => (
                 <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border-grey">
                    <span className="text-xs font-bold text-text-navy uppercase">{shift}</span>
                    <span className="text-[10px] font-black text-success uppercase">Optimal</span>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};
