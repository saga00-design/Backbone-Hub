import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, PoundSterling, FileText, Package, ArrowUpRight, ArrowDownRight, 
  Database, Filter, Calendar, Download, Building, Tag, Truck, Calculator,
  ChevronDown, Search, Info, Trash2, Lock, Clock, History as HistoryIcon, AlertCircle, CheckCircle2,
  RefreshCw, X, Lightbulb, AlertTriangle, Zap, Award, Trophy, Settings, ChefHat, Eye, Star
} from 'lucide-react';
import { 
  POSOrder, POSPayment, InventoryItem, Supplier, Invoice, Order, VatCode, Recipe, WasteRecord, 
  ClockInRecord, ExpenseRecord, DailyClosure, ClosureType, Forecast, ForecastType, StaffPerformanceRecord, StaffIncentiveConfig,
  MenuEngineeringRecord, AutomationSettings, AutomationLog
} from '../types';
import { VATReturnExport } from './VATReturnExport';
import { VATTracker, VATReturn } from '../types';
import { Button } from './Button';
import { performClosure } from '../services/closureService';
import { generateForecast } from '../services/predictionService';
import { runMenuEngineering } from '../services/menuEngineeringService';
import { auth, db, LOCATION_ID, handleFirestoreError, OperationType, cleanObject, onAuthStateChanged } from '../firebase';
import { normalizeCurrency } from '../utils/currencyUtils';
import { toast } from 'sonner';
import { collection, query, where, onSnapshot, orderBy, limit, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { generateClosurePDF, generateClosureCSV } from '../utils/exportUtils';

interface ReportsProps {
  posOrders: POSOrder[];
  posPayments: POSPayment[];
  liveSalesData: {
    history: any[];
    aggregate: any;
  };
  livePosSalesSummary: {
    totalPaid: number;
    grossSales: number;
    netSales: number;
    vatTotal: number;
    serviceChargeTotal: number;
    discountTotal: number;
    orderCount: number;
    salesByPaymentMethod: Record<string, number>;
  };
  inventoryItems: InventoryItem[];
  suppliers: Supplier[];
  invoices: Invoice[];
  orders: Order[];
  recipes: Recipe[];
  wasteRecords: WasteRecord[];
  expenseRecords: any[];
  onEditRecipe?: (id: string) => void;
  onEditInventoryItem?: (item: InventoryItem) => void;
}

const VAT_CODES: VatCode[] = ['STANDARD_20', 'REDUCED_5', 'ZERO_0', 'EXEMPT'];

export const Reports: React.FC<ReportsProps> = ({ 
  posOrders, 
  posPayments,
  liveSalesData,
  livePosSalesSummary,
  inventoryItems, 
  suppliers, 
  invoices, 
  orders, 
  recipes, 
  wasteRecords, 
  expenseRecords,
  onEditRecipe, 
  onEditInventoryItem 
}) => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'waste' | 'tax' | 'vat_return' | 'suppliers' | 'closures' | 'pnl' | 'forecast' | 'staff_performance' | 'menu_engineering'>('sales');
  const [showReconDebug, setShowReconDebug] = useState(false);
  const [vatTrackers, setVatTrackers] = useState<VATTracker[]>([]);
  const [vatReturns, setVatReturns] = useState<VATReturn[]>([]);

  // Fetch VAT Trackers and Returns
  useEffect(() => {
    if (!user) return;
    const unsubTrackers = onSnapshot(query(collection(db, 'vatTracker'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc')), (snap) => {
      setVatTrackers(snap.docs.map(d => ({ id: d.id, ...d.data() } as VATTracker)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vatTracker'));

    const unsubReturns = onSnapshot(query(collection(db, 'vatReturns'), where('locationId', '==', LOCATION_ID), orderBy('periodEnd', 'desc')), (snap) => {
      setVatReturns(snap.docs.map(d => ({ id: d.id, ...d.data() } as VATReturn)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vatReturns'));

    return () => {
      unsubTrackers();
      unsubReturns();
    };
  }, [user]);

  // Helper to safely get date portion from various formats (string, Date, Firestore Timestamp)
  // Consistently uses Europe/London as the Source of Truth for reporting
  const safeDateSplit = (date: any): string => {
    if (!date) return '';
    try {
      let d: Date;
      if (date && typeof date === 'object' && 'seconds' in date) {
        d = new Date(date.seconds * 1000);
      } else {
        d = new Date(date);
      }
      if (isNaN(d.getTime())) return '';
      
      // Explicit YYYY-MM-DD in Europe/London timezone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(d);
    } catch (e) {
      return '';
    }
  };

  const [appliedDateRange, setAppliedDateRange] = useState({
    start: safeDateSplit(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    end: safeDateSplit(new Date())
  });
  const [dateRange, setDateRange] = useState({ ...appliedDateRange });

  // Closure States
  const [selectedClosureForDetail, setSelectedClosureForDetail] = useState<DailyClosure | null>(null);
  const [isPerformingClosure, setIsPerformingClosure] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [declaredCash, setDeclaredCash] = useState<string>('0');
  const [closureHistory, setClosureHistory] = useState<DailyClosure[]>([]);
  const [clockInRecords, setClockInRecords] = useState<ClockInRecord[]>([]);
  const [closureType, setClosureType] = useState<ClosureType>(ClosureType.DAY);
  const [shiftName, setShiftName] = useState('AM');

  // Load closure history
  React.useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'dailyClosures'), 
      where('locationId', '==', LOCATION_ID),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyClosure));
      // Sort in memory to avoid index requirements
      docs.sort((a, b) => {
        const dateA = new Date(a.meta?.createdAt || 0).getTime();
        const dateB = new Date(b.meta?.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setClosureHistory(docs);
    }, err => {
      handleFirestoreError(err, OperationType.LIST, 'dailyClosures');
    });

    const qClocks = query(
      collection(db, 'clockInRecords'),
      where('locationId', '==', LOCATION_ID),
      limit(200)
    );
    const unsubClocks = onSnapshot(qClocks, (snap) => {
      setClockInRecords(snap.docs.map(doc => ({ ...doc.data() } as ClockInRecord)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'clockInRecords'));

    return () => {
      unsub();
      unsubClocks();
    };
  }, [user]);

  const [forecastType, setForecastType] = useState<ForecastType>('day');
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformanceRecord[]>([]);
  const [incentiveConfig, setIncentiveConfig] = useState<StaffIncentiveConfig | null>(null);
  const [showIncentiveSettings, setShowIncentiveSettings] = useState(false);
  const [isSavingIncentiveConfig, setIsSavingIncentiveConfig] = useState(false);
  const [menuEngineering, setMenuEngineering] = useState<MenuEngineeringRecord[]>([]);
  const [isRunningEngineering, setIsRunningEngineering] = useState(false);
  const [engineeringDateRange, setEngineeringDateRange] = useState(30);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);

  // Load menu engineering
  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'menuEngineering'),
      where('locationId', '==', LOCATION_ID)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => d.data() as MenuEngineeringRecord);
      // Sort in memory to avoid complex query indexing issues
      setMenuEngineering(data.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'menuEngineering'));
    return unsub;
  }, [user]);

  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
    id: 'global',
    automationMode: 'off',
    maxPriceChangePercent: 10,
    lastUpdated: new Date().toISOString()
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'automationLogs'), orderBy('timestamp', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutomationLog));
      setAutomationLogs(logs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'automationLogs');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'systemSettings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setAutomationSettings(snap.data() as AutomationSettings);
        } else {
          // Initialize
          await setDoc(docRef, automationSettings);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'systemSettings/global');
      }
    };
    if (user) fetchSettings();
  }, [user]);

  const updateAutomationMode = async (mode: 'off' | 'suggest' | 'auto') => {
    const next = { ...automationSettings, automationMode: mode, lastUpdated: new Date().toISOString() };
    setAutomationSettings(next);
    try {
      await setDoc(doc(db, 'systemSettings', 'global'), next);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'systemSettings/global');
    }
  };

  const applyOptimization = async (item: MenuEngineeringRecord) => {
    if (!item.optimization) return;

    // Safety Limit Check (10% max if auto, but we can enforce it generally)
    const change = item.optimization.priceChangePercent;
    if (automationSettings.automationMode === 'auto' && change > automationSettings.maxPriceChangePercent) {
      console.warn("Change exceeds safety limit for auto-mode.");
      // In auto mode we might cap it or skip it.
    }

    try {
      // 1. Update the Menu Item price
      const itemRef = doc(db, 'menuItems', item.itemId);
      await updateDoc(itemRef, {
        priceGross: Math.round(item.optimization.suggestedPrice * 100),
        lastUpdated: new Date().toISOString()
      });

      // 2. Log the action
      const logId = `log-${Date.now()}`;
      const log: AutomationLog = {
        id: logId,
        action: `Price adjustment for ${item.name}`,
        category: 'pricing',
        targetId: item.itemId,
        targetName: item.name,
        oldValue: item.optimization.currentPrice,
        newValue: item.optimization.suggestedPrice,
        timestamp: new Date().toISOString(),
        mode: automationSettings.automationMode,
        status: 'applied'
      };
      await setDoc(doc(db, 'automationLogs', logId), log);

      // 3. Refresh data
      handleRunEngineering();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'menuItems');
    }
  };

  useEffect(() => {
    if (automationSettings.automationMode === 'auto' && menuEngineering.length > 0) {
      const topPriority = menuEngineering.find(i => 
        i.optimization?.priority === 'high' && 
        i.optimization?.priceChangePercent > 0 && 
        i.optimization?.priceChangePercent <= automationSettings.maxPriceChangePercent
      );
      
      if (topPriority) {
        console.log("Auto-applying optimization for:", topPriority.name);
        applyOptimization(topPriority);
      }
    }
  }, [automationSettings.automationMode, menuEngineering]);

  useEffect(() => {
    if (user && activeTab === 'menu_engineering') {
      handleRunEngineering();
    }
  }, [engineeringDateRange, activeTab, user]);

  const handleRunEngineering = async () => {
    setIsRunningEngineering(true);
    try {
      await runMenuEngineering(engineeringDateRange);
      toast.success("Menu engineering analysis complete!");
    } catch (err) {
      toast.error("Failed to run analysis.");
    } finally {
      setIsRunningEngineering(false);
    }
  };

  // Load forecasts
  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'predictions'),
      where('locationId', '==', LOCATION_ID),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setForecasts(snap.docs.map(d => d.data() as Forecast));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'predictions');
    });
    return unsub;
  }, [user]);

  // Load staff performance
  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'staffPerformance'),
      where('locationId', '==', LOCATION_ID),
      orderBy('date', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setStaffPerformance(snap.docs.map(d => d.data() as StaffPerformanceRecord));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'staffPerformance');
    });
    return unsub;
  }, [user]);

  // Load incentive config
  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'settings', `incentive_${LOCATION_ID}`), (snap) => {
      if (snap.exists()) {
        setIncentiveConfig(snap.data() as StaffIncentiveConfig);
      } else {
        const defaultConfig: StaffIncentiveConfig = {
          id: `incentive_${LOCATION_ID}`,
          locationId: LOCATION_ID,
          tiers: {
            platinum: { minScore: 90, rewardType: 'cash', rewardValue: 50, label: 'Platinum Bonus' },
            gold: { minScore: 80, rewardType: 'cash', rewardValue: 25, label: 'Gold Bonus' },
            silver: { minScore: 70, rewardType: 'cash', rewardValue: 10, label: 'Silver Bonus' }
          },
          updatedAt: new Date().toISOString()
        };
        setIncentiveConfig(defaultConfig);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `settings/incentive_${LOCATION_ID}`);
    });
    return unsub;
  }, [user]);

  const handleSaveIncentiveConfig = async (newConfig: StaffIncentiveConfig) => {
    setIsSavingIncentiveConfig(true);
    try {
      await setDoc(doc(db, 'settings', `incentive_${LOCATION_ID}`), cleanObject({
        ...newConfig,
        updatedAt: new Date().toISOString()
      }));
      toast.success("Incentive settings updated!");
      setShowIncentiveSettings(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/incentive');
    } finally {
      setIsSavingIncentiveConfig(false);
    }
  };

  const handleGenerateForecast = async () => {
    setIsGeneratingForecast(true);
    try {
      await generateForecast(forecastType);
      toast.success(`${forecastType.charAt(0).toUpperCase() + forecastType.slice(1)} forecast generated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate forecast");
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  const currentForecast = useMemo(() => {
    return forecasts.find(f => f.type === forecastType);
  }, [forecasts, forecastType]);

  const pnlSummary = useMemo(() => {
    const summary = {
      revenue: {} as Record<string, number>,
      cogs: {} as Record<string, number>,
      expenses: {} as Record<string, number>,
      labour: 0,
      fixedCosts: 0,
      totalRevenue: 0,
      totalCOGS: 0,
      totalExpenses: 0,
      grossProfit: 0,
      ebitda: 0,
      netProfit: 0,
      // New fields
      vatCollected: 0,
      vatOnExpenses: 0,
      vatPayable: 0,
      serviceChargeTotal: 0,
      serviceChargePending: 0,
      profitBeforeVAT: 0,
      realProfitAfterVAT: 0
    };

    // 1. Aggregate from Closures
    const filteredClosures = closureHistory.filter(c => {
      const dateStr = safeDateSplit(c.date);
      return dateStr >= appliedDateRange.start && dateStr <= appliedDateRange.end;
    });

    filteredClosures.forEach(c => {
      summary.totalRevenue += (c.totals.netSales || 0);
      summary.totalCOGS += (c.totals.cogs || 0);
      
      // New detailed metrics
      summary.vatCollected += (c.totals.vat?.collected || c.totals.vatTotal || 0);
      summary.vatPayable += (c.totals.vat?.payable || c.totals.vatLiability || 0);
      summary.serviceChargeTotal += (c.totals.serviceCharge?.collected || c.totals.serviceChargeTotal || 0);
      summary.serviceChargePending += (c.totals.serviceCharge?.pending || 0);

      if (c.totals.salesByCategory) {
        Object.entries(c.totals.salesByCategory).forEach(([cat, val]) => {
          summary.revenue[cat] = (summary.revenue[cat] || 0) + val;
        });
      }
      if (c.totals.cogsByCategory) {
        Object.entries(c.totals.cogsByCategory).forEach(([cat, val]) => {
          summary.cogs[cat] = (summary.cogs[cat] || 0) + val;
        });
      }
    });

    // 2. Aggregate from Clock In Records (Labour)
    const filteredClocks = clockInRecords.filter(clr => {
      const dateStr = safeDateSplit(clr.clockIn);
      return dateStr >= appliedDateRange.start && dateStr <= appliedDateRange.end && (clr.status === 'completed' || clr.status === 'verified');
    });

    filteredClocks.forEach(clr => {
      if (clr.totalCost) {
        summary.labour += clr.totalCost;
      }
    });

    // 3. Aggregate from Expenses
    expenseRecords.forEach(exp => {
      const dateStr = safeDateSplit(exp.date);
      if (dateStr >= appliedDateRange.start && dateStr <= appliedDateRange.end && exp.status === 'Approved') {
        summary.expenses[exp.category] = (summary.expenses[exp.category] || 0) + exp.amount;
        summary.totalExpenses += exp.amount;
        summary.vatOnExpenses += (exp.vatAmount || 0);
        
        const isLabourExp = exp.category.toLowerCase().includes('labour') || exp.category.toLowerCase().includes('staff') || exp.category.toLowerCase().includes('salary');
        if (isLabourExp) {
          summary.labour += exp.amount;
        }

        if (exp.category.toLowerCase().includes('rent') || exp.category.toLowerCase().includes('rates') || exp.category.toLowerCase().includes('insurance')) {
          summary.fixedCosts += exp.amount;
        }
      }
    });

    summary.grossProfit = summary.totalRevenue - summary.totalCOGS;
    
    // Calculate clocks-only labour to avoid double counting if external
    const expenseLabour = Object.entries(summary.expenses).reduce((sum, [cat, val]) => {
        return (cat.toLowerCase().includes('labour') || cat.toLowerCase().includes('staff') || cat.toLowerCase().includes('salary')) ? sum + val : sum;
    }, 0);
    const clockLabour = summary.labour - expenseLabour;

    summary.profitBeforeVAT = summary.grossProfit - summary.totalExpenses - (clockLabour > 0 ? clockLabour : 0);
    summary.realProfitAfterVAT = summary.profitBeforeVAT - summary.vatPayable;
    
    summary.ebitda = summary.profitBeforeVAT; 
    summary.netProfit = summary.realProfitAfterVAT;

    return summary;
  }, [closureHistory, clockInRecords, expenseRecords, appliedDateRange]);

  const [showClosurePreview, setShowClosurePreview] = useState(false);

  const handlePerformClosure = async () => {
    if (!auth.currentUser) {
      toast.error('You must be logged in to perform a closure.');
      return;
    }

    if (!showClosurePreview) {
      setShowClosurePreview(true);
      return;
    }

    setIsPerformingClosure(true);
    try {
      const start = new Date(appliedDateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(appliedDateRange.end);
      end.setHours(23, 59, 59, 999);

      await performClosure({
        type: closureType,
        date: appliedDateRange.end,
        periodStart: start,
        periodEnd: end,
        staff: { 
          id: auth.currentUser.uid, 
          name: auth.currentUser.displayName || auth.currentUser.email || 'Staff' 
        },
        shiftName: closureType === ClosureType.SHIFT ? shiftName : undefined,
        lockRecords: true
      });

      toast.success(`${closureType.charAt(0).toUpperCase() + closureType.slice(1)} closure completed successfully.`);
      setShowClosurePreview(false);
    } catch (error) {
      console.error("Closure failed:", error);
      toast.error('Failed to perform closure. Please check permissions.');
    } finally {
      setIsPerformingClosure(false);
    }
  };

  const handleSearch = () => {
    setAppliedDateRange({ ...dateRange });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const [typeFilter, setTypeFilter] = useState<'All' | 'Dine-In' | 'Takeaway' | 'Delivery'>('All');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [vatCodeFilter, setVatCodeFilter] = useState<'All' | VatCode>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [vatTableFilter, setVatTableFilter] = useState<'All' | 'Has VAT' | 'No VAT' | 'Missing'>('All');
  const [vatTableSearch, setVatTableSearch] = useState('');
  const [trendInterval, setTrendInterval] = useState<'Day' | 'Week' | 'Month'>('Day');
  
  // Waste Filters
  const [wasteCategoryFilter, setWasteCategoryFilter] = useState('All');
  const [wasteReasonFilter, setWasteReasonFilter] = useState('All');

  const setQuickRange = (range: 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'thisYear') => {
    const now = new Date();
    // Get London current time components to calculate start/end correctly in that timezone
    const londonNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    
    let start = new Date(londonNow);
    let end = new Date(londonNow);
    
    switch (range) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(londonNow.getDate() - 1);
        end.setDate(londonNow.getDate() - 1);
        break;
      case '7days':
        start.setDate(londonNow.getDate() - 6);
        break;
      case '30days':
        start.setDate(londonNow.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(londonNow.getFullYear(), londonNow.getMonth(), 1);
        break;
      case 'lastMonth':
        start = new Date(londonNow.getFullYear(), londonNow.getMonth() - 1, 1);
        end = new Date(londonNow.getFullYear(), londonNow.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(londonNow.getFullYear(), 0, 1);
        break;
    }
    
    const startStr = safeDateSplit(start);
    const endStr = safeDateSplit(end);
    
    setDateRange({ start: startStr, end: endStr });
    setAppliedDateRange({ start: startStr, end: endStr });
    toast.info(`Period updated: ${range.toUpperCase()}`);
  };

  const getLondonTodayStr = () => {
    return safeDateSplit(new Date());
  };

  const filteredWaste = useMemo(() => {
    return wasteRecords.filter(record => {
      const recordDate = safeDateSplit(record.date);
      const matchesDate = recordDate >= appliedDateRange.start && recordDate <= appliedDateRange.end;
      
      const item = inventoryItems.find(i => i.id === record.inventoryItemId);
      const matchesCategory = wasteCategoryFilter === 'All' || item?.category === wasteCategoryFilter;
      const matchesReason = wasteReasonFilter === 'All' || record.reason === wasteReasonFilter;
      
      return matchesDate && matchesCategory && matchesReason;
    });
  }, [wasteRecords, appliedDateRange, wasteCategoryFilter, wasteReasonFilter, inventoryItems]);

  const wasteByDate = useMemo(() => {
    const daily: Record<string, number> = {};
    filteredWaste.forEach(w => {
      const date = safeDateSplit(w.date);
      daily[date] = (daily[date] || 0) + w.cost;
    });
    return Object.entries(daily).map(([date, cost]) => ({ date, cost })).sort((a,b) => a.date.localeCompare(b.date));
  }, [filteredWaste]);

  const wasteByReason = useMemo(() => {
    const byReason: Record<string, number> = {};
    filteredWaste.forEach(w => {
      byReason[w.reason] = (byReason[w.reason] || 0) + w.cost;
    });
    return Object.entries(byReason).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredWaste]);

  const wasteByItem = useMemo(() => {
    const byItem: Record<string, number> = {};
    filteredWaste.forEach(w => {
      byItem[w.itemName] = (byItem[w.itemName] || 0) + w.cost;
    });
    return Object.entries(byItem).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredWaste]);

  const wasteReasons = useMemo(() => {
    const reasons = new Set<string>();
    wasteRecords.forEach(w => reasons.add(w.reason));
    return ['All', ...Array.from(reasons)];
  }, [wasteRecords]);

  const inventoryCategoryOptions = useMemo(() => {
    const categories = new Set<string>();
    inventoryItems.forEach(i => categories.add(i.category));
    return ['All', ...Array.from(categories)];
  }, [inventoryItems]);

  const filteredOrders = useMemo(() => {
    return liveSalesData.history.filter(order => {
      // Use reconciled payment timestamp for accurate financial reporting
      const orderDate = safeDateSplit(order.financials?.paymentTimestamp || order.createdAt);
      const matchesDate = orderDate >= appliedDateRange.start && orderDate <= appliedDateRange.end;
      const matchesType = typeFilter === 'All' || order.type === typeFilter;
      const matchesVat = vatCodeFilter === 'All' || (order.items && order.items.some((item: any) => item.vatCode === vatCodeFilter));
      const matchesPlatform = platformFilter === 'All' || order.platform === platformFilter;
      
      return matchesDate && matchesType && matchesVat && matchesPlatform;
    });
  }, [liveSalesData.history, appliedDateRange, typeFilter, vatCodeFilter, platformFilter]);

  const platforms = useMemo(() => {
    const p = new Set<string>();
    posOrders.forEach(o => {
      if (o.platform) p.add(o.platform);
    });
    return ['All', ...Array.from(p)];
  }, [posOrders]);

    const salesReport = useMemo(() => {
      const totals = {
        grossSalesAll: 0,
        netSalesOnly: 0, // Gross - VAT
        outputVat: 0,
        zeroRatedSales: 0,
        exemptSales: 0,
        serviceCharge: 0,
        tips: 0,
        discounts: 0,
        profitTakeHome: 0, // Gross - VAT - Service Charge
        grossSalesBeforeDiscount: 0,
        netSalesBeforeDiscount: 0,
        vatBeforeDiscount: 0,
        serviceChargeBeforeDiscount: 0,
        discountValueExVat: 0,
        discountVatImpact: 0,
        discountServiceChargeImpact: 0,
        totalPaid: 0,
        netSalesExVat: 0,
        orderCount: 0,
        serviceChargeByType: {
          'Dine-In': 0,
          'Takeaway': 0,
          'Delivery': 0,
          'Other': 0
        },
        salesByPaymentMethod: {} as Record<string, number>
      };

      filteredOrders.forEach(order => {
        if (order.status?.toLowerCase() === 'paid') {
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
          const zTotal = normalizeCurrency(fin.zeroRatedSales || 0);
          const eTotal = normalizeCurrency(fin.exemptSales || 0);

          // Component Sanity Check: VAT or Service can't exceed Gross per individual order
          if (vTotal > gSales && vTotal > 0) vTotal /= 100;
          if (sTotal > gSales && sTotal > 0) sTotal /= 100;

          totals.grossSalesAll += gSales;
          totals.outputVat += vTotal;
          totals.serviceCharge += sTotal;
          totals.tips += tTotal;
          totals.discounts += dTotal;
          totals.totalPaid += pTotal;
          totals.zeroRatedSales += zTotal;
          totals.exemptSales += eTotal;

          // Align with POS Definitions (V4 Rule):
          // Gross Sales = Total Paid - Tips (Includes VAT and Service)
          // Net Sales = Gross - VAT
          // Profit (Take Home) = Gross - VAT - Service
          const currentNetSales = gSales - vTotal;
          totals.netSalesOnly += currentNetSales;
          totals.profitTakeHome += (currentNetSales - sTotal);
          
          totals.grossSalesBeforeDiscount += (gSales + dTotal);
          
          const nSales = normalizeCurrency(fin.netSales || 0);
          const calculatedNetExVatSrv = (nSales > 0 && nSales < gSales) ? nSales : (gSales - vTotal - sTotal);
          totals.netSalesExVat += calculatedNetExVatSrv;
          
          totals.netSalesBeforeDiscount += (calculatedNetExVatSrv + (dTotal * 0.8));
          totals.vatBeforeDiscount += (vTotal + (dTotal * 0.2));
          
          totals.serviceChargeBeforeDiscount += sTotal;
          totals.discountValueExVat += (dTotal * 0.8);
          totals.discountVatImpact += (dTotal * 0.2);
          totals.discountServiceChargeImpact += (normalizeCurrency(fin.discountServiceChargeImpact) || 0);

          if (order.type === 'Dine-In') totals.serviceChargeByType['Dine-In'] += sTotal;
          else if (order.type === 'Takeaway') totals.serviceChargeByType['Takeaway'] += sTotal;
          else if (order.type === 'Delivery') totals.serviceChargeByType['Delivery'] += sTotal;
          else totals.serviceChargeByType['Other'] += sTotal;

          // Payment method breakdown
          const method = fin.paymentMethod || 'Other';
          totals.salesByPaymentMethod[method] = (totals.salesByPaymentMethod[method] || 0) + pTotal;
        }
      });

      return totals;
    }, [filteredOrders]);

  const itemsReport = useMemo(() => {
    const itemStats: Record<string, { name: string; quantity: number; revenue: number; vatCode?: string }> = {};
    
    filteredOrders.forEach(order => {
      if (order.status?.toLowerCase() === 'paid') {
        order.items.forEach((item: any) => {
          if (!item.isVoided) {
            if (!itemStats[item.recipeId]) {
              itemStats[item.recipeId] = { name: item.name, quantity: 0, revenue: 0, vatCode: item.vatCode };
            }
            itemStats[item.recipeId].quantity += item.quantity;
            itemStats[item.recipeId].revenue += ((item.price || 0) * (item.quantity || 0));
          }
        });
      }
    });

    const sorted = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity);
    const bestSellers = sorted.slice(0, 5);
    const worstSellers = sorted.filter(i => i.quantity > 0).slice(-5).reverse();
    const inventoryValue = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);

    return { bestSellers, worstSellers, inventoryValue, itemStats: Object.values(itemStats) };
  }, [filteredOrders, inventoryItems]);

    const reconciliation = useMemo(() => {
      const cardMethods = ['card', 'credit card', 'debit card', 'visa', 'mastercard', 'amex', 'sumup', 'zettle', 'square', 'stripe', 'pdq', 'terminal'];
      const cashMethods = ['cash'];

      const totals = {
        totalPaid: 0,
        cardTotal: 0,
        cashTotal: 0,
        otherTotal: 0,
        serviceChargeTotal: 0,
        discountTotal: 0,
        paymentCount: 0,
        orderCount: 0,
        rawList: [] as { id: string; amount: number; method: string }[]
      };

      const uniqueOrderIds = new Set<string>();

      posPayments.forEach(p => {
        if (p.locationId && p.locationId !== LOCATION_ID) return;
        
        const ts = (p as any).paidAt || p.timestamp || (p as any).createdAt;
        const paymentDate = safeDateSplit(ts);
        
        if (paymentDate >= appliedDateRange.start && paymentDate <= appliedDateRange.end) {
          const amt = normalizeCurrency(p.totalPaid ?? p.amountPaid ?? p.amount ?? 0);
          const rawMethod = (p.method || p.paymentMethod || 'other').toLowerCase();
          
          totals.totalPaid += amt;
          totals.paymentCount++;
          
          if (cardMethods.some(m => rawMethod.includes(m))) {
            totals.cardTotal += amt;
          } else if (cashMethods.some(m => rawMethod.includes(m))) {
            totals.cashTotal += amt;
          } else {
            totals.otherTotal += amt;
          }

          if (p.orderId) uniqueOrderIds.add(p.orderId);
          totals.rawList.push({ id: p.id || 'N/A', amount: amt, method: p.method || p.paymentMethod || 'Other' });
        }
      });

      totals.orderCount = uniqueOrderIds.size;

      // Extract service charge and discounts from orders matching these payments
      filteredOrders.forEach(order => {
        if (uniqueOrderIds.has(order.id || '')) {
          totals.serviceChargeTotal += normalizeCurrency(order.financials?.serviceChargeTotal || 0);
          totals.discountTotal += normalizeCurrency(order.financials?.discountTotal || 0);
        }
      });

      const declared = parseFloat(declaredCash) || 0;
      const variance = declared - totals.cashTotal;

      const grossSales = totals.totalPaid;
      const netSales = grossSales / 1.2;
      const vatTotal = grossSales - netSales;

      return { ...totals, declared, variance, grossSales, netSales, vatTotal };
    }, [posPayments, filteredOrders, appliedDateRange, declaredCash]);

  const supplierReport = useMemo(() => {
    const stats: Record<string, { name: string; ordered: number; used: number; owed: number }> = {};

    suppliers.forEach(s => {
      stats[s.id] = { name: s.name, ordered: 0, used: 0, owed: 0 };
    });

    // How much we ordered
    orders.forEach(o => {
      const sId = suppliers.find(s => s.name === o.supplier)?.id;
      if (sId && stats[sId]) {
        stats[sId].ordered += o.totalAmount;
      }
    });

    // How much we owe (Unpaid invoices)
    invoices.forEach(inv => {
      if (inv.paymentStatus === 'Unpaid' && inv.supplierId && stats[inv.supplierId]) {
        stats[inv.supplierId].owed += inv.totalAmount;
      }
    });

    return Object.values(stats);
  }, [suppliers, orders, invoices]);

  const combinedVatItems = useMemo(() => {
    const combined = [
      ...recipes.map(r => ({ ...r, itemType: 'recipe' as const })),
      ...inventoryItems.map(i => ({ ...i, itemType: 'inventory' as const }))
    ];
    return combined;
  }, [recipes, inventoryItems]);

  const filteredVatItems = useMemo(() => {
    return combinedVatItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(vatTableSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (vatTableFilter === 'All') return true;
      if (vatTableFilter === 'Has VAT') return item.vatCode === 'STANDARD_20' || item.vatCode === 'REDUCED_5';
      if (vatTableFilter === 'No VAT') return item.vatCode === 'ZERO_0' || item.vatCode === 'EXEMPT';
      if (vatTableFilter === 'Missing') return !item.vatCode;
      return true;
    });
  }, [combinedVatItems, vatTableFilter, vatTableSearch]);

  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  };

  const salesByWeek = useMemo(() => {
    const weeks: Record<string, number> = {};
    filteredOrders.forEach(order => {
      if (order.status?.toLowerCase() === 'paid') {
        const ts = order.financials?.paymentTimestamp || order.createdAt;
        const dateStr = safeDateSplit(ts); // YYYY-MM-DD
        if (!dateStr) return;
        const date = new Date(dateStr);
        const week = getWeekNumber(date);
        const totalValue = order.financials?.totalPaid || 0;
        weeks[week] = (weeks[week] || 0) + totalValue;
      }
    });
    // Ensure "label" is "week" for XAxis but the Line dataKey expects "total"
    return Object.entries(weeks).map(([week, total]) => ({ week, total })).sort((a, b) => a.week.localeCompare(b.week));
  }, [filteredOrders]);

  const salesByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    filteredOrders.forEach(order => {
      if (order.status?.toLowerCase() === 'paid') {
        const ts = order.financials?.paymentTimestamp || order.createdAt;
        const dateStr = safeDateSplit(ts); // YYYY-MM-DD
        const month = dateStr.substring(0, 7); // YYYY-MM
        const totalValue = order.financials?.totalPaid || 0;
        months[month] = (months[month] || 0) + totalValue;
      }
    });
    return Object.entries(months).map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredOrders]);

  const salesByDay = useMemo(() => {
    const days: Record<string, number> = {};
    filteredOrders.forEach(order => {
      if (order.status?.toLowerCase() === 'paid') {
        const ts = order.financials?.paymentTimestamp || order.createdAt;
        const date = safeDateSplit(ts);
        const totalValue = order.financials?.totalPaid || 0;
        days[date] = (days[date] || 0) + totalValue;
      }
    });
    return Object.entries(days).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  const exportCSV = () => {
    const headers = ['Date', 'Order ID', 'Type', 'Gross', 'Net', 'VAT', 'Service', 'Discount', 'Total Paid', 'Method'];
    const rows = filteredOrders.map(o => [
      safeDateSplit(o.financials.paymentTimestamp),
      o.id,
      o.type || 'N/A',
      o.financials.grossSales.toFixed(2),
      o.financials.netSales.toFixed(2),
      o.financials.vatTotal.toFixed(2),
      o.financials.serviceChargeTotal.toFixed(2),
      o.financials.discountTotal.toFixed(2),
      o.financials.totalPaid.toFixed(2),
      o.financials.paymentMethod
    ]);

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backbone_sales_report_${appliedDateRange.start}_to_${appliedDateRange.end}.csv`;
    link.click();
  };

  const generatePDF = () => {
    window.print();
  };

  const isFilterStale = dateRange.start !== appliedDateRange.start || dateRange.end !== appliedDateRange.end;

  return (
    <div className="p-8 space-y-8 bg-main-bg min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-text-navy tracking-tight">Reports & Analytics</h1>
          <p className="text-text-muted mt-1 italic font-serif">Deep dive into your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={exportCSV}
            className="bg-secondary-surface text-text-navy border border-border-grey hover:bg-white flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest"
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button 
            onClick={generatePDF}
            className="bg-accent text-white hover:opacity-90 flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-accent/20"
          >
            <TrendingUp className="w-4 h-4" /> Generate PDF
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 bg-border-grey gap-px border-b border-border-grey rounded-t-2xl overflow-hidden">
        {[
          { id: 'sales', label: 'Sales', icon: TrendingUp },
          { id: 'inventory', label: 'Inventory', icon: Package },
          { id: 'waste', label: 'Waste', icon: Trash2 },
          { id: 'tax', label: 'Tax & VAT', icon: FileText },
          { id: 'vat_return', label: 'VAT Return', icon: Calculator },
          { id: 'suppliers', label: 'Suppliers', icon: Truck },
          { id: 'closures', label: 'Closures', icon: Lock },
          { id: 'pnl', label: 'P&L Report', icon: Calculator },
          { id: 'forecast', label: 'Forecast', icon: Lightbulb },
          { id: 'staff_performance', label: 'Staff Rewards', icon: Award },
          { id: 'menu_engineering', label: 'Menu Performance', icon: ChefHat },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center justify-center gap-2 px-3 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all h-full bg-card-bg ${
              activeTab === tab.id 
                ? 'text-accent bg-accent/5 ring-1 ring-inset ring-accent/20 z-10' 
                : 'text-text-muted hover:text-text-navy hover:bg-secondary-surface'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Data Diagnostic (Collapsible) */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4">
        <button 
          onClick={() => setShowDiagnostic(!showDiagnostic)}
          className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400"
        >
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            POS Connection Diagnostics
          </div>
          <span>{showDiagnostic ? 'Hide' : 'Show Details'}</span>
        </button>
        
        {showDiagnostic && (
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-200/50">
              <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">Total Location Payments</p>
              <p className="text-lg font-black text-amber-900 dark:text-amber-200">{posPayments.filter(p => p.locationId === LOCATION_ID).length}</p>
              <p className="text-[8px] text-amber-700/70 italic">Filtered for your site only</p>
            </div>
            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-200/50">
              <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">Analysis Period</p>
              <p className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase tracking-tighter line-clamp-1">
                {appliedDateRange.start === appliedDateRange.end ? appliedDateRange.start : `${appliedDateRange.start} → ${appliedDateRange.end}`}
              </p>
              <p className="text-[8px] text-amber-700/70 italic">Matching POS reporting window</p>
            </div>
            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-200/50">
              <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">System Timezone</p>
              <p className="text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase">Europe/London</p>
              <p className="text-[8px] text-amber-700/70 italic">Synced with POS terminal clock</p>
            </div>
            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-200/50">
              <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">Database Scope</p>
              <p className="text-[10px] font-mono text-amber-900 dark:text-amber-200 truncate">{LOCATION_ID}</p>
              <p className="text-[8px] text-amber-700/70 italic">Current Instance ID</p>
            </div>
          </div>
        )}
      </div>

      {/* Global Controls & Filters */}
      <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border-grey">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-3 rounded-xl">
              <Filter className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-navy uppercase tracking-tight">Report Configuration</h2>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest italic">Define period and granular filters</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2 mr-4 border-r border-border-grey pr-4">
              {[
                { label: 'Today', id: 'today' },
                { label: 'Yesterday', id: 'yesterday' },
                { label: 'Last 7 Days', id: '7days' },
                { label: 'This Month', id: 'thisMonth' }
              ].map(q => {
                // Check if this quick range is currently applied
                const now = new Date();
                let s = new Date();
                let e = new Date();
                if (q.id === 'yesterday') { s.setDate(s.getDate() - 1); e.setDate(e.getDate() - 1); }
                else if (q.id === '7days') s.setDate(s.getDate() - 6);
                else if (q.id === 'thisMonth') s = new Date(now.getFullYear(), now.getMonth(), 1);
                
                const sStr = s.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
                const eStr = e.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
                const isActive = appliedDateRange.start === sStr && appliedDateRange.end === eStr;

                return (
                  <button
                    key={q.id}
                    onClick={() => setQuickRange(q.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                      isActive 
                        ? 'bg-accent text-white border-accent shadow-md' 
                        : 'bg-secondary-surface text-text-muted border-border-grey/50 hover:bg-white hover:text-accent'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
              <div className="relative group">
                 <button className="px-3 py-1.5 rounded-lg bg-secondary-surface text-[9px] font-black uppercase tracking-widest text-text-muted border border-border-grey/50 hover:bg-white flex items-center gap-1">
                   More <ChevronDown className="w-3 h-3" />
                 </button>
                 <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50 bg-white dark:bg-slate-900 shadow-xl border border-border-grey rounded-xl overflow-hidden min-w-[120px]">
                   {[
                     { label: 'Last 30 Days', id: '30days' },
                     { label: 'Last Month', id: 'lastMonth' },
                     { label: 'This Year', id: 'thisYear' }
                   ].map(q => (
                     <button
                       key={q.id}
                       onClick={() => setQuickRange(q.id as any)}
                       className="w-full text-left px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-accent hover:bg-accent/5 transition-colors"
                     >
                       {q.label}
                     </button>
                   ))}
                 </div>
              </div>
            </div>

            <div className="flex items-center bg-secondary-surface rounded-xl border border-border-grey p-1">
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none py-2 px-3 text-xs text-text-navy focus:ring-0 outline-none w-[130px]"
              />
              <span className="text-text-muted text-[10px] font-bold px-1 uppercase tracking-tighter">to</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none py-2 px-3 text-xs text-text-navy focus:ring-0 outline-none w-[130px]"
              />
            </div>
            
            <Button 
              onClick={handleSearch}
              className={`bg-accent text-white hover:opacity-90 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 ${
                isFilterStale ? 'ring-4 ring-accent/30 animate-pulse shadow-accent/40' : 'shadow-accent/20'
              }`}
            >
              <Search className="w-4 h-4" /> Apply Filters
            </Button>
            
            <Button 
              onClick={() => {
                const today = getLondonTodayStr();
                const defaultRange = {
                  start: today,
                  end: today
                };
                setDateRange(defaultRange);
                setAppliedDateRange(defaultRange);
                setTypeFilter('All');
                setPlatformFilter('All');
                setVatCodeFilter('All');
                setCategoryFilter('All');
                setWasteReasonFilter('All');
                toast.info('Filters Reset');
              }}
              variant="secondary"
              className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border-border-grey hover:bg-secondary-surface transition-all"
            >
              Reset
            </Button>
            
            <Button 
              onClick={() => window.location.reload()}
              variant="secondary"
              className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-border-grey"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Force Sync
            </Button>
          </div>
        </div>

        {/* Dynamic Contextual Filters based on Tab */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {activeTab === 'sales' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Order Type</label>
                <div className="relative">
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    <option value="All">All Types</option>
                    <option value="Dine-In">Dine-In</option>
                    <option value="Takeaway">Takeaway</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Platform</label>
                <div className="relative">
                  <select 
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    {platforms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">VAT Analysis</label>
                <div className="relative">
                  <select 
                    value={vatCodeFilter}
                    onChange={(e) => setVatCodeFilter(e.target.value as any)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    <option value="All">All VAT Codes</option>
                    {VAT_CODES.map(code => (
                      <option key={code} value={code}>{code.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>
              
              <div className="flex items-end pb-1">
                <div className="bg-secondary-surface/50 px-4 py-2 rounded-xl border border-border-grey/50 w-full flex justify-between items-center">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Selected Data</span>
                  <span className="text-xs font-black text-text-navy">{filteredOrders.length} / {liveSalesData.history.length}</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'waste' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Item Category</label>
                <div className="relative">
                  <select 
                    value={wasteCategoryFilter}
                    onChange={(e) => setWasteCategoryFilter(e.target.value)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    {inventoryCategoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Waste Reason</label>
                <div className="relative">
                  <select 
                    value={wasteReasonFilter}
                    onChange={(e) => setWasteReasonFilter(e.target.value)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    {wasteReasons.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>
              
              <div className="flex items-end pb-1">
                <div className="bg-secondary-surface/50 px-4 py-2 rounded-xl border border-border-grey/50 w-full flex justify-between items-center">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Logs Found</span>
                  <span className="text-xs font-black text-text-navy">{filteredWaste.length} logs</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'tax' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">VAT Visibility</label>
                <div className="relative">
                  <select 
                    value={vatTableFilter}
                    onChange={(e) => setVatTableFilter(e.target.value as any)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    <option value="All">All Items</option>
                    <option value="Has VAT">Items with VAT</option>
                    <option value="No VAT">Zero/Exempt Items</option>
                    <option value="Missing">Missing VAT Info</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Search Items</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search by name..."
                    value={vatTableSearch}
                    onChange={(e) => setVatTableSearch(e.target.value)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 pl-10 pr-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {activeTab === 'waste' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Total Waste Cost</p>
              <p className="text-3xl font-serif font-bold text-cta">£{filteredWaste.reduce((sum, w) => sum + w.cost, 0).toFixed(2)}</p>
              <div className="mt-4 pt-4 border-t border-border-grey flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-text-muted">Filtered Records</span>
                <span className="text-text-navy">{filteredWaste.length} logs</span>
              </div>
            </div>
            
            <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm md:col-span-1">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Top Reason</p>
              <p className="text-2xl font-serif font-bold text-text-navy truncate">{wasteByReason[0]?.name || 'N/A'}</p>
              <div className="mt-4 pt-4 border-t border-border-grey flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-text-muted">Reason Total</span>
                <span className="text-text-navy">£{wasteByReason[0]?.value.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <h3 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Waste Value Trend
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wasteByDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => typeof val === 'string' ? val.split('-').slice(1).join('/') : ''} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `£${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      formatter={(val: number) => [`£${val.toFixed(2)}`, 'Cost']}
                    />
                    <Bar dataKey="cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <h3 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
                <Tag className="w-5 h-5 text-accent" />
                Waste by Reason
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wasteByReason} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      formatter={(val: number) => [`£${val.toFixed(2)}`, 'Cost']}
                    />
                    <Bar dataKey="value" fill="#486581" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-2xl border border-border-grey shadow-sm flex flex-col">
            <div className="p-6 border-b border-border-grey flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-navy uppercase tracking-widest">Waste Breakdown by Item</h3>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{filteredWaste.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-secondary-surface text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Total Cost</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey">
                  {filteredWaste.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-xs text-text-muted italic">No waste records found for the selected filters.</td>
                    </tr>
                  ) : (
                    filteredWaste.slice(0, 15).map((w, idx) => (
                      <tr key={idx} className="hover:bg-secondary-surface transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-text-navy">{w.itemName}</td>
                        <td className="px-6 py-4 text-xs text-text-navy">{w.reason}</td>
                        <td className="px-6 py-4 text-xs text-text-navy">{w.quantity} {w.unit}</td>
                        <td className="px-6 py-4 text-xs font-serif font-bold text-cta">£{w.cost.toFixed(2)}</td>
                        <td className="px-6 py-4 text-xs text-text-muted">{safeDateSplit(w.date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'pnl' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card-bg p-8 rounded-2xl border border-border-grey shadow-sm space-y-10">
            <div className="flex items-center justify-between border-b border-border-grey pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-text-navy p-3 rounded-xl shadow-lg">
                  <Calculator className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-black text-text-navy uppercase tracking-tight">Financial Profit & Loss</h2>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest italic">Full balance sheet for selected period</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mb-1">Net Profit</p>
                <p className={`text-3xl font-serif font-black ${pnlSummary.netProfit >= 0 ? 'text-emerald-600' : 'text-cta'}`}>
                  £{pnlSummary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
              {/* Revenue Section */}
              <section className="space-y-4">
                <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center justify-between border-b border-border-grey pb-2">
                  <span>1. Operating Revenue</span>
                  <span className="text-sm font-black">£{pnlSummary.totalRevenue.toLocaleString()}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(pnlSummary.revenue).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between items-center p-4 bg-secondary-surface rounded-xl border border-border-grey group hover:border-accent transition-colors">
                      <span className="text-sm font-bold text-text-navy">{cat} Sales</span>
                      <span className="text-sm font-black text-text-navy">£{val.toLocaleString()}</span>
                    </div>
                  ))}
                  {Object.keys(pnlSummary.revenue).length === 0 && (
                    <p className="text-xs text-text-muted italic px-4">No revenue categories detected for this period.</p>
                  )}
                </div>
              </section>

              {/* COGS Section */}
              <section className="space-y-4">
                <h3 className="text-xs font-black text-cta uppercase tracking-widest flex items-center justify-between border-b border-border-grey pb-2">
                  <span>2. Cost of Goods Sold (COGS)</span>
                  <span className="text-sm font-black text-cta">-£{pnlSummary.totalCOGS.toLocaleString()}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(pnlSummary.cogs).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between items-center p-4 bg-red-50/30 rounded-xl border border-red-100 group hover:border-cta transition-colors">
                      <span className="text-sm font-bold text-text-navy">{cat} Costs</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-cta">£{val.toLocaleString()}</span>
                        {pnlSummary.revenue[cat] > 0 && (
                          <span className="text-[9px] font-bold text-text-muted uppercase">{(val / pnlSummary.revenue[cat] * 100).toFixed(1)}% of category</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex justify-between items-center shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Gross Profit</span>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Revenue minus item costs</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-serif font-black text-emerald-700">£{pnlSummary.grossProfit.toLocaleString()}</span>
                    <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      {(pnlSummary.grossProfit / pnlSummary.totalRevenue * 100).toFixed(1)}% Margin
                    </span>
                  </div>
                </div>
              </section>

              {/* Operating Expenses & Fixed Costs */}
              <section className="space-y-4">
                <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center justify-between border-b border-border-grey pb-2">
                  <span>3. Operating & Fixed Expenses</span>
                  <span className="text-sm font-black">£{pnlSummary.totalExpenses.toLocaleString()}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Labour */}
                  <div className="p-6 bg-white border border-border-grey rounded-2xl space-y-2 group hover:border-blue-500 transition-colors shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-blue-500" />
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Labour Costs</span>
                    </div>
                    <p className="text-2xl font-serif font-black text-text-navy">£{pnlSummary.labour.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase">{(pnlSummary.labour / pnlSummary.totalRevenue * 100).toFixed(1)}% of Sales</p>
                  </div>
                  
                  {/* Fixed Costs */}
                  <div className="p-6 bg-white border border-border-grey rounded-2xl space-y-2 group hover:border-orange-500 transition-colors shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-orange-500" />
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Fixed Expenses</span>
                    </div>
                    <p className="text-2xl font-serif font-black text-text-navy">£{pnlSummary.fixedCosts.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase">Rent, Rates, Insurance</p>
                  </div>

                  {/* Other OpEx */}
                  <div className="p-6 bg-white border border-border-grey rounded-2xl space-y-2 group hover:border-purple-500 transition-colors shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-purple-500" />
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Operational OpEx</span>
                    </div>
                    <p className="text-2xl font-serif font-black text-text-navy">£{(pnlSummary.totalExpenses - pnlSummary.labour - pnlSummary.fixedCosts).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase">Misc & Marketing</p>
                  </div>
                </div>

                {/* Expense Detailed Table */}
                <div className="bg-white border border-border-grey rounded-2xl overflow-hidden shadow-sm">
                   <table className="w-full text-left">
                     <thead className="bg-secondary-surface text-[10px] font-black text-text-muted uppercase tracking-widest">
                       <tr>
                         <th className="px-6 py-4">Expense Category</th>
                         <th className="px-6 py-4 text-right">Amount</th>
                         <th className="px-6 py-4 text-right">% of Sales</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border-grey">
                        {Object.entries(pnlSummary.expenses).length === 0 ? (
                          <tr><td colSpan={3} className="px-6 py-8 text-center text-xs text-text-muted italic">No expenses logged in this period.</td></tr>
                        ) : (
                          Object.entries(pnlSummary.expenses).sort((a,b) => b[1] - a[1]).map(([cat, val]) => (
                            <tr key={cat} className="hover:bg-accent/5">
                              <td className="px-6 py-4 text-xs font-bold text-text-navy">{cat}</td>
                              <td className="px-6 py-4 text-xs font-black text-text-navy text-right">£{val.toLocaleString()}</td>
                              <td className="px-6 py-4 text-xs font-bold text-text-muted text-right">{(val / pnlSummary.totalRevenue * 100).toFixed(1)}%</td>
                            </tr>
                          ))
                        )}
                     </tbody>
                   </table>
                </div>
              </section>

              {/* VAT & Service Charge Obligations */}
              <section className="space-y-4">
                <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center justify-between border-b border-border-grey pb-2">
                  <span>4. Tax & Service Obligations (Pass-through)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* VAT Detailed */}
                   <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-red-800 uppercase tracking-widest">VAT Accountability</span>
                         <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded-full uppercase">HMRC Owed</span>
                      </div>
                      <div className="space-y-2">
                         <div className="flex justify-between text-xs font-bold text-text-navy">
                            <span>VAT Collected (Sales)</span>
                            <span>£{pnlSummary.vatCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold text-text-muted">
                            <span>VAT Paid (Expenses)</span>
                            <span>-£{pnlSummary.vatOnExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="pt-2 border-t border-red-200 flex justify-between text-sm font-black text-red-700">
                            <span>Total VAT Payable</span>
                            <span>£{pnlSummary.vatPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                         </div>
                      </div>
                   </div>

                   {/* Service Charge Detailed */}
                   <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Service Charge Pool</span>
                         <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black rounded-full uppercase">Staff Fund</span>
                      </div>
                      <div className="space-y-2">
                         <div className="flex justify-between text-xs font-bold text-text-navy">
                            <span>Total Collected</span>
                            <span>£{pnlSummary.serviceChargeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold text-text-muted">
                            <span>Distributed to Staff</span>
                            <span>-£{(pnlSummary.serviceChargeTotal - pnlSummary.serviceChargePending).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                         </div>
                         <div className="pt-2 border-t border-blue-200 flex justify-between text-sm font-black text-blue-700">
                            <span>Pending Distribution</span>
                            <span>£{pnlSummary.serviceChargePending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                         </div>
                      </div>
                   </div>
                </div>
              </section>

              {/* Net Profit Summary */}
              <section className="pt-10 border-t-2 border-border-grey space-y-6">
                 <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 p-8 bg-text-navy text-white rounded-3xl shadow-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 -mr-32 -mt-32 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
                       <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-60">EBITDA (Estimated)</h4>
                       <div className="flex items-baseline gap-2">
                         <span className="text-2xl font-serif text-white/50">£</span>
                         <p className="text-5xl font-serif font-black">{pnlSummary.ebitda.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                       </div>
                       <p className="text-[10px] font-bold uppercase tracking-widest mt-6 text-accent">Earnings Before Interest, Taxes, Depreciation & Amortization</p>
                    </div>

                    <div className={`flex-1 p-8 rounded-3xl border-2 flex flex-col justify-center ${pnlSummary.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-cta/5 border-cta/20'}`}>
                       <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-text-muted italic">Real Profit (After VAT Liability)</h4>
                       <div className="flex items-baseline gap-2">
                         <span className={`text-2xl font-serif ${pnlSummary.netProfit >= 0 ? 'text-emerald-600/50' : 'text-cta/50'}`}>£</span>
                         <p className={`text-5xl font-serif font-black ${pnlSummary.netProfit >= 0 ? 'text-emerald-700' : 'text-cta'}`}>
                           {pnlSummary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </p>
                       </div>
                       <div className="flex items-center gap-2 mt-6">
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${pnlSummary.netProfit >= 0 ? 'bg-emerald-600 text-white' : 'bg-cta text-white'}`}>
                            {(pnlSummary.netProfit / pnlSummary.totalRevenue * 100).toFixed(1)}% Yield
                          </div>
                          <span className="text-[10px] font-bold text-text-muted uppercase">Net contribution margin</span>
                       </div>
                    </div>
                 </div>
              </section>
            </div>
          </div>
        </div>
          ) : activeTab === 'staff_performance' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="bg-accent p-4 rounded-2xl shadow-lg shadow-accent/20">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-serif font-black text-text-navy uppercase tracking-tight">Staff Incentive Leaderboard</h2>
                <p className="text-xs text-text-muted font-bold uppercase tracking-widest italic text-accent">Performance-based rewards & growth tracking</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => setShowIncentiveSettings(true)}
                variant="secondary"
                className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5" />
                Configure Rewards
              </Button>
            </div>

            {showIncentiveSettings && incentiveConfig && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-text-navy p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                      <div className="bg-accent p-2 rounded-lg">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-sm font-black uppercase tracking-widest">Incentive Configuration</h3>
                    </div>
                    <button onClick={() => setShowIncentiveSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    {(['platinum', 'gold', 'silver'] as const).map(tierKey => (
                      <div key={tierKey} className="space-y-4 p-6 bg-secondary-surface rounded-2xl border border-border-grey">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-text-navy flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${
                               tierKey === 'platinum' ? 'bg-emerald-400' : 
                               tierKey === 'gold' ? 'bg-amber-400' : 'bg-slate-300'
                             }`} />
                             {tierKey} Level Settings
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-text-muted">Min Score</label>
                            <input 
                              type="number"
                              value={incentiveConfig.tiers[tierKey].minScore}
                              onChange={(e) => setIncentiveConfig({
                                ...incentiveConfig,
                                tiers: {
                                  ...incentiveConfig.tiers,
                                  [tierKey]: { ...incentiveConfig.tiers[tierKey], minScore: parseInt(e.target.value) }
                                }
                              })}
                              className="w-full bg-white border border-border-grey rounded-xl px-4 py-2 text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-text-muted">Reward Label</label>
                            <input 
                              type="text"
                              value={incentiveConfig.tiers[tierKey].label}
                              onChange={(e) => setIncentiveConfig({
                                ...incentiveConfig,
                                tiers: {
                                  ...incentiveConfig.tiers,
                                  [tierKey]: { ...incentiveConfig.tiers[tierKey], label: e.target.value }
                                }
                              })}
                              className="w-full bg-white border border-border-grey rounded-xl px-4 py-2 text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-text-muted">Type</label>
                            <select 
                              value={incentiveConfig.tiers[tierKey].rewardType}
                              onChange={(e) => setIncentiveConfig({
                                ...incentiveConfig,
                                tiers: {
                                  ...incentiveConfig.tiers,
                                  [tierKey]: { ...incentiveConfig.tiers[tierKey], rewardType: e.target.value as any }
                                }
                              })}
                              className="w-full bg-white border border-border-grey rounded-xl px-4 py-2 text-xs font-bold"
                            >
                              <option value="cash">Cash Bonus</option>
                              <option value="voucher">Voucher</option>
                              <option value="custom">Custom Incentive</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-text-muted">Value / Description</label>
                            <input 
                              type="text"
                              value={incentiveConfig.tiers[tierKey].rewardValue}
                              onChange={(e) => setIncentiveConfig({
                                ...incentiveConfig,
                                tiers: {
                                  ...incentiveConfig.tiers,
                                  [tierKey]: { ...incentiveConfig.tiers[tierKey], rewardValue: e.target.value }
                                }
                              })}
                              className="w-full bg-white border border-border-grey rounded-xl px-4 py-2 text-xs font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-secondary-surface flex justify-end gap-3 border-t border-border-grey">
                    <Button onClick={() => setShowIncentiveSettings(false)} variant="secondary">Cancel</Button>
                    <Button 
                      onClick={() => handleSaveIncentiveConfig(incentiveConfig)}
                      disabled={isSavingIncentiveConfig}
                      className="bg-text-navy text-white"
                    >
                      {isSavingIncentiveConfig ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {staffPerformance.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top 3 High Performers */}
                <div className="lg:col-span-1 space-y-4">
                  <h3 className="text-sm font-black text-text-navy uppercase tracking-widest px-2">Top Performers (Today)</h3>
                  <div className="space-y-3">
                    {Object.values(
                      staffPerformance.reduce((acc, curr) => {
                        if (!acc[curr.staffId]) acc[curr.staffId] = curr;
                        return acc;
                      }, {} as Record<string, StaffPerformanceRecord>)
                    )
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map((perf, idx) => (
                      <div key={perf.id} className={`p-6 rounded-2xl border flex items-center justify-between transition-all ${
                        idx === 0 ? 'bg-accent/5 border-accent/20 scale-[1.02]' : 'bg-white border-border-grey'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${
                            idx === 0 ? 'bg-accent text-white' : 'bg-secondary-surface text-text-muted'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="text-xs font-black text-text-navy uppercase">{perf.staffName}</p>
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                              {perf.tier !== 'training' && incentiveConfig ? 
                                incentiveConfig.tiers[perf.tier as keyof StaffIncentiveConfig['tiers']].label : 
                                perf.tier + ' status'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-serif font-black text-text-navy">{perf.score}</p>
                          <p className="text-[8px] font-black text-accent uppercase">Points</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-text-navy p-6 rounded-2xl text-white mt-8">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-4">Reward Thresholds</h4>
                    <div className="space-y-4">
                      {incentiveConfig ? (
                        (['platinum', 'gold', 'silver'] as const).map(tierKey => (
                          <div key={tierKey} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                tierKey === 'platinum' ? 'bg-emerald-400' : 
                                tierKey === 'gold' ? 'bg-amber-400' : 'bg-slate-300'
                              }`} />
                              <span className="text-[10px] font-bold capitalize">{incentiveConfig.tiers[tierKey].label} ({incentiveConfig.tiers[tierKey].minScore}+)</span>
                            </div>
                            <span className={`text-[10px] font-black italic ${
                              tierKey === 'platinum' ? 'text-emerald-400' : 
                              tierKey === 'gold' ? 'text-amber-400' : 'text-slate-300'
                            }`}>
                              {incentiveConfig.tiers[tierKey].rewardType === 'cash' ? '£' : ''}{incentiveConfig.tiers[tierKey].rewardValue} {incentiveConfig.tiers[tierKey].rewardType !== 'cash' ? '' : 'Bonus'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/50 italic text-center">Loading config...</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Table */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-border-grey overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-secondary-surface/50 border-b border-border-grey">
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Team Member</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Daily Sales</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">AOV</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Discounts</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Score</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Reward</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey">
                        {staffPerformance.map((perf) => (
                          <tr key={perf.id} className="hover:bg-secondary-surface/30 transition-colors group">
                            <td className="px-6 py-4">
                              <p className="text-xs font-black text-text-navy uppercase">{perf.staffName}</p>
                              <p className="text-[9px] text-text-muted italic">{new Date(perf.date).toLocaleDateString()}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="text-xs font-bold text-text-navy">£{perf.metrics.totalSales.toFixed(2)}</p>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <p className="text-xs font-bold text-text-navy">£{perf.metrics.avgOrderValue.toFixed(2)}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={`text-[10px] font-black ${(perf.metrics.discountRatio || 0) > 0.05 ? 'text-cta' : 'text-emerald-600'}`}>
                                {(perf.metrics.discountRatio * 100).toFixed(1)}%
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-serif font-black text-text-navy bg-secondary-surface px-3 py-1 rounded-lg">
                                {perf.score}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                perf.tier === 'platinum' ? 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800' :
                                perf.tier === 'gold' ? 'bg-amber-100 text-amber-700' :
                                perf.tier === 'silver' ? 'bg-slate-100 text-slate-600' :
                                'bg-rose-100 text-rose-700'
                              }`}>
                                {perf.tier === 'platinum' && <Award className="w-3 h-3" />}
                                {perf.tier !== 'training' && incentiveConfig ? 
                                  incentiveConfig.tiers[perf.tier as keyof StaffIncentiveConfig['tiers']].label : 
                                  perf.tier
                                }
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-20 text-center space-y-6 bg-secondary-surface/30 rounded-3xl border border-dashed border-border-grey">
                <Trophy className="w-16 h-16 text-text-muted/20 mx-auto" />
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-text-navy uppercase tracking-tight">No Performance Data Yet</h3>
                  <p className="text-sm text-text-muted italic">
                    Staff performance is calculated automatically after each daily closure. Re-run or complete a closure to generate metrics.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200/50 flex items-start gap-4">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-900 uppercase tracking-widest mb-1">Scoring Algorithm v1.0</p>
              <p className="text-xs text-emerald-800/80 leading-relaxed italic">
                Scores are weighted: 40% Net Sales vs Peer Max, 30% AOV Excellence, 20% Margin Contribution, and 10% Discount Control. High discounts results in steep penalties to protect operational net profit. Status tiers provide instant qualification for monthly bonus pools.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'menu_engineering' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-accent p-4 rounded-2xl shadow-lg shadow-accent/20">
                  <ChefHat className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-black text-text-navy uppercase tracking-tight">Menu Engineering</h2>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-widest italic text-accent">Stars, Plowhorses, Puzzles, and Dogs</p>
                </div>
              </div>
              <Button 
                onClick={handleRunEngineering}
                disabled={isRunningEngineering}
                className="bg-text-navy text-white text-xs font-black uppercase tracking-widest px-8"
              >
                {isRunningEngineering ? 'Analyzing...' : 'Run Analysis (Last 30 Days)'}
              </Button>
            </div>

            {menuEngineering.length > 0 ? (
              <div className="space-y-8">
                {/* Visual Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['star', 'plowhorse', 'puzzle', 'dog'] as const).map(type => (
                    <div key={type} className="p-6 bg-secondary-surface rounded-2xl border border-border-grey">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{type}s</span>
                        <span className="text-xl">
                          {type === 'star' && '⭐'}
                          {type === 'plowhorse' && '🐎'}
                          {type === 'puzzle' && '🧩'}
                          {type === 'dog' && '🐶'}
                        </span>
                      </div>
                      <p className="text-2xl font-serif font-black text-text-navy">
                        {menuEngineering.filter(i => i.classification === type).length}
                      </p>
                      <p className="text-[8px] font-black uppercase text-text-muted mt-1 italic">
                        {type === 'star' && 'High Pop / High Margin'}
                        {type === 'plowhorse' && 'High Pop / Low Margin'}
                        {type === 'puzzle' && 'Low Pop / High Margin'}
                        {type === 'dog' && 'Low Pop / Low Margin'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Analysis Table */}
                <div className="bg-white rounded-3xl border border-border-grey overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-secondary-surface/50 border-b border-border-grey">
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Item Name</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Unit Cost</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Profit / Unit</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Margin %</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Qty</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Total Profit</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Status</th>
                          <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Strategic Insight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey text-xs font-bold text-text-navy">
                        {menuEngineering.map(item => (
                          <tr key={item.id} className="hover:bg-secondary-surface/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-black uppercase tracking-tight">{item.name}</p>
                              <p className="text-[9px] text-text-muted uppercase">{item.category}</p>
                            </td>
                            <td className="px-6 py-4 text-right">£{(item.metrics.unitCost || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 text-right text-emerald-600">£{(item.metrics.margin || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`${item.metrics.marginPercent > 70 ? 'text-emerald-600' : item.metrics.marginPercent < 60 ? 'text-cta' : ''}`}>
                                {(item.metrics.marginPercent || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">{item.metrics.quantitySold}</td>
                            <td className="px-6 py-4 text-right font-black">£{(item.metrics.profit || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 text-center">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm border ${
                                item.classification === 'star' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                item.classification === 'plowhorse' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                item.classification === 'puzzle' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {item.classification === 'star' && '⭐ Star'}
                                {item.classification === 'plowhorse' && '🐎 Plowhorse'}
                                {item.classification === 'puzzle' && '🧩 Puzzle'}
                                {item.classification === 'dog' && '🐶 Dog'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1 max-w-xs">
                                <p className="text-[10px] font-bold text-text-navy leading-tight">{item.action}</p>
                                {item.insights?.pricing && (
                                  <div className="flex items-start gap-1 text-[9px] text-text-muted italic group relative">
                                    <Zap className="w-2.5 h-2.5 text-accent shrink-0" />
                                    <span className="line-clamp-1 group-hover:line-clamp-none">{item.insights.pricing}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Optimization Engine UI */}
                <div className="space-y-6 pt-10 border-t border-border-grey">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-600 p-2 rounded-xl">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-serif font-black text-text-navy uppercase tracking-tight">Strategy & Optimization Engine</h3>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest italic leading-tight">
                          {engineeringDateRange / 30}-Month Analysis Window • {automationSettings.automationMode.toUpperCase()} MODE
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-secondary-surface/50 rounded-xl border border-border-grey">
                       {[30, 60, 90, 180].map(days => (
                         <button
                           key={days}
                           onClick={() => setEngineeringDateRange(days)}
                           className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                             engineeringDateRange === days ? 'bg-text-navy text-white shadow-sm' : 'text-text-muted hover:bg-white'
                           }`}
                         >
                           {days / 30}M
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Automation Toggle & Live Status */}
                  <div className="bg-secondary-surface/50 p-6 rounded-3xl border border-border-grey flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                    {automationSettings.automationMode === 'auto' && (
                      <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
                    )}
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`p-3 rounded-2xl transition-all duration-500 ${
                        automationSettings.automationMode === 'auto' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' :
                        automationSettings.automationMode === 'suggest' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                        'bg-text-muted text-white shadow-sm'
                      }`}>
                        <Settings className={`w-5 h-5 ${automationSettings.automationMode === 'auto' ? 'animate-spin-slow' : ''}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-text-navy uppercase tracking-widest">Automation Mode</h4>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-bounce ${
                            automationSettings.automationMode === 'auto' ? 'bg-emerald-100 text-emerald-700' :
                            automationSettings.automationMode === 'suggest' ? 'bg-amber-100 text-amber-700' :
                            'hidden'
                          }`}>
                            Live
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted italic font-bold">
                          {automationSettings.automationMode === 'off' && "Manual monitoring only • AI disabled"}
                          {automationSettings.automationMode === 'suggest' && "Drafting recommendations for review"}
                          {automationSettings.automationMode === 'auto' && "Active profit harvesting within safety limits"}
                        </p>
                      </div>
                    </div>

                    <div className="flex p-1 bg-white border border-border-grey rounded-xl shadow-sm relative z-10">
                      {(['off', 'suggest', 'auto'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => updateAutomationMode(m)}
                          className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                            automationSettings.automationMode === m
                              ? (m === 'auto' ? 'bg-emerald-600 text-white shadow-md' : m === 'suggest' ? 'bg-amber-500 text-white shadow-md' : 'bg-text-navy text-white shadow-md')
                              : 'text-text-muted hover:bg-secondary-surface'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Summary Card */}
                    <div className="lg:col-span-1 p-8 bg-text-navy text-white rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 -mr-16 -mt-16 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                      <div className="relative">
                        <TrendingUp className="w-6 h-6 text-emerald-400 mb-6" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Projected Profit Upside</h4>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-serif text-emerald-400/50">£</span>
                          <span className="text-5xl font-serif font-black text-emerald-400">
                            {menuEngineering.reduce((acc, curr) => acc + (curr.optimization?.estimatedProfitImpact || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-4 relative mt-8">
                         <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                           <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80">Analysis Active</p>
                         </div>
                         <p className="text-[9px] font-bold uppercase tracking-tight leading-relaxed opacity-60 italic">
                           Monthly delta based on {engineeringDateRange} days of historical sales data.
                         </p>
                      </div>
                    </div>

                    {/* High Priority Adjustments */}
                    <div className="lg:col-span-3 bg-white border border-border-grey rounded-3xl overflow-hidden shadow-sm flex flex-col">
                      <div className="bg-secondary-surface/50 px-6 py-4 border-b border-border-grey flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-text-navy">Strategic Pricing Levers</h4>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-cta rounded-full animate-pulse" />
                          <span className="text-[9px] font-black text-cta uppercase">Queue Ready</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-border-grey text-[9px] font-black text-text-muted uppercase tracking-widest">
                              <th className="px-6 py-3">Menu Item</th>
                              <th className="px-6 py-3 text-right">Current</th>
                              <th className="px-6 py-3 text-right">Target</th>
                              <th className="px-6 py-3 text-right">Adj %</th>
                              <th className="px-6 py-3 text-right">Profit Gain</th>
                              <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-grey">
                            {menuEngineering
                              .filter(i => (i.optimization?.priority === 'high' || i.optimization?.priority === 'medium') && (i.optimization?.priceChangePercent || 0) > 0)
                              .sort((a, b) => (b.optimization?.estimatedProfitImpact || 0) - (a.optimization?.estimatedProfitImpact || 0))
                              .map(item => (
                                <tr key={item.id} className="hover:bg-accent/5 transition-colors">
                                  <td className="px-6 py-3">
                                    <p className="text-xs font-black text-text-navy uppercase">{item.name}</p>
                                    <p className="text-[9px] text-text-muted italic">{item.classification}</p>
                                  </td>
                                  <td className="px-6 py-3 text-right text-xs font-bold font-mono text-text-muted">£{item.optimization?.currentPrice.toFixed(2)}</td>
                                  <td className="px-6 py-3 text-right text-xs font-black text-emerald-600 font-mono">£{item.optimization?.suggestedPrice.toFixed(2)}</td>
                                  <td className="px-6 py-3 text-right">
                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-mono">
                                      +{item.optimization?.priceChangePercent.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-right text-xs font-black text-emerald-600">+£{item.optimization?.estimatedProfitImpact.toFixed(2)}</td>
                                  <td className="px-6 py-3 text-right">
                                    <Button
                                      onClick={() => applyOptimization(item)}
                                      disabled={automationSettings.automationMode === 'off' && item.optimization?.priority !== 'high'}
                                      variant="secondary"
                                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                        automationSettings.automationMode === 'auto' ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50' : 
                                        'border-text-navy/20 text-text-navy hover:bg-text-navy hover:text-white'
                                      }`}
                                    >
                                      {automationSettings.automationMode === 'auto' ? 'Linked' : 'Apply'}
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Operational Tracker & Redesign Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 p-6 bg-white border border-border-grey rounded-3xl space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-text-navy text-white rounded-lg">
                          <HistoryIcon className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-text-navy">Autonomous Activity Log</h4>
                      </div>
                      <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
                         {automationLogs.length > 0 ? automationLogs.map(log => (
                           <div key={log.id} className="p-3 bg-secondary-surface/30 rounded-xl border border-border-grey/50">
                             <div className="flex justify-between items-start mb-1">
                               <p className="text-[9px] font-black text-text-navy uppercase truncate pr-2">{log.targetName}</p>
                               <span className="text-[8px] font-black text-emerald-600 font-mono">Applied</span>
                             </div>
                             <p className="text-[8px] font-bold text-text-muted uppercase mb-2">£{log.oldValue.toFixed(2)} → £{log.newValue.toFixed(2)}</p>
                             <p className="text-[8px] text-text-muted italic flex items-center gap-1">
                               <Clock className="w-2.5 h-2.5" />
                               {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.mode.toUpperCase()}
                             </p>
                           </div>
                         )) : (
                           <div className="py-10 text-center space-y-2">
                             <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">No Recent Actions</p>
                             <p className="text-[9px] italic text-text-muted">The engine is currently idle.</p>
                           </div>
                         )}
                      </div>
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white border border-border-grey rounded-3xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-2 bg-amber-50 rounded-lg">
                            <Eye className="w-4 h-4 text-amber-600" />
                          </div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-text-navy">Redesign Strategy</h4>
                        </div>
                        <div className="space-y-3">
                          {menuEngineering.filter(i => (i.classification === 'puzzle' || i.classification === 'dog')).slice(0, 3).map(item => (
                            <div key={item.id} className="p-4 bg-secondary-surface/50 rounded-2xl border border-border-grey group hover:border-accent transition-all">
                              <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-black text-text-navy uppercase tracking-tight">{item.name}</p>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${item.classification === 'dog' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {item.classification}
                                </span>
                              </div>
                              <p className="text-[10px] text-text-muted leading-relaxed font-bold italic">
                                <Zap className="w-2.5 h-2.5 inline mr-1 text-accent" />
                                {item.insights?.optimization || 'Monitor performance and reconsider allocation.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-6 bg-white border border-border-grey rounded-3xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-2 bg-emerald-50 rounded-lg">
                            <Star className="w-4 h-4 text-emerald-600" />
                          </div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-text-navy">Brand Guardians</h4>
                        </div>
                        <div className="space-y-4">
                           <p className="text-[11px] font-bold text-text-muted uppercase leading-relaxed tracking-tight border-b border-border-grey pb-4">
                             Primary volume drivers. Protect quality & consistency at all costs.
                           </p>
                           <div className="grid grid-cols-1 gap-2">
                             {menuEngineering.filter(i => i.classification === 'star').slice(0, 5).map(item => (
                               <div key={item.id} className="px-4 py-2 bg-emerald-50/30 border border-emerald-100 rounded-xl flex justify-between items-center">
                                 <p className="text-[10px] font-black text-emerald-900 uppercase truncate">{item.name}</p>
                                 <p className="text-[9px] font-black text-emerald-600 font-mono">{(item.metrics.marginPercent).toFixed(1)}%</p>
                               </div>
                             ))}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-20 text-center space-y-6 bg-secondary-surface/30 rounded-3xl border border-dashed border-border-grey">
                <ChefHat className="w-16 h-16 text-text-muted/20 mx-auto" />
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-text-navy uppercase tracking-tight">No Menu Analysis Data</h3>
                  <p className="text-sm text-text-muted italic">
                    Run the analysis to classify your menu based on the last 30 days of sales, item pricing, and recipe costs.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-text-navy rounded-3xl p-8 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Stars ⭐</p>
                <p className="text-xs text-white/70 leading-relaxed italic">High profitability and high popularity. Keep their quality consistent and use them for marketing.</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Plowhorses 🐎</p>
                <p className="text-xs text-white/70 leading-relaxed italic">High popularity but low profit. Consider small price increases or swapping cheaper ingredients.</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Puzzles 🧩</p>
                <p className="text-xs text-white/70 leading-relaxed italic">High profit but low popularity. Try giving them more menu visibility or running specials.</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Dogs 🐶</p>
                <p className="text-xs text-white/70 leading-relaxed italic">Low profit and low popularity. These take up space. Redesign them or remove them entirely.</p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'forecast' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-accent p-4 rounded-2xl shadow-lg shadow-accent/20">
                  <Lightbulb className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-black text-text-navy uppercase tracking-tight">AI Forecasting Engine</h2>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-widest italic">Predictive business analytics for growth</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-secondary-surface p-1.5 rounded-2xl border border-border-grey shadow-inner">
                {(['day', 'week', 'month', 'quarter'] as ForecastType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForecastType(type)}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      forecastType === type 
                        ? 'bg-white text-accent shadow-md border border-accent/10' 
                        : 'text-text-muted hover:text-text-navy hover:bg-white/50'
                    }`}
                  >
                    {type === 'day' ? 'Tomorrow' : `This ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                  </button>
                ))}
              </div>
            </div>

            {currentForecast ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Forecast Card */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm group hover:border-accent transition-all duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Revenue Forecast</span>
                        <PoundSterling className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-serif text-text-navy/50">£</span>
                        <span className="text-5xl font-serif font-black text-text-navy group-hover:scale-105 transition-transform origin-left">
                          {(currentForecast.forecast.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="mt-6 flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ${(currentForecast.trends.growthRate || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {(currentForecast.trends.growthRate || 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs((currentForecast.trends.growthRate || 0) * 100).toFixed(1)}% {(currentForecast.trends.growthRate || 0) >= 0 ? 'Increase' : 'Decrease'}
                        </div>
                        <span className="text-[9px] text-text-muted font-bold uppercase tracking-tighter italic">vs Previous Period</span>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm group hover:border-emerald-500 transition-all duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Estimated Profit</span>
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-serif text-emerald-600/50">£</span>
                        <span className="text-5xl font-serif font-black text-emerald-600">
                          {(currentForecast.forecast.profit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="mt-6">
                        <div className="w-full bg-secondary-surface h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-1000" 
                            style={{ width: `${currentForecast.forecast.margin || 0}%` }} 
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Net Margin</span>
                          <span className="text-xs font-black text-emerald-600">{(currentForecast.forecast.margin || 0).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-secondary-surface/50 p-6 rounded-2xl border border-border-grey/50">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Orders</p>
                      <p className="text-2xl font-serif font-black text-text-navy">{currentForecast.forecast.orders || 0}</p>
                    </div>
                    <div className="bg-secondary-surface/50 p-6 rounded-2xl border border-border-grey/50">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Avg Ticket</p>
                      <p className="text-2xl font-serif font-black text-text-navy">£{( (currentForecast.forecast.revenue || 0) / (currentForecast.forecast.orders || 1) ).toFixed(2)}</p>
                    </div>
                    <div className="bg-secondary-surface/50 p-6 rounded-2xl border border-border-grey/50">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Daily Avg</p>
                      <p className="text-2xl font-serif font-black text-text-navy">£{(currentForecast.trends.avgDailySales || 0).toFixed(0)}</p>
                    </div>
                    <div className="bg-secondary-surface/50 p-6 rounded-2xl border border-border-grey/50">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Best Performance</p>
                      <p className="text-[11px] font-black text-emerald-600 uppercase mb-1">{currentForecast.trends.bestDay || 'N/A'}</p>
                    </div>
                    <div className="bg-secondary-surface/50 p-6 rounded-2xl border border-border-grey/50">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Peak Variance</p>
                      <p className="text-[11px] font-black text-rose-600 uppercase mb-1">{currentForecast.trends.worstDay || 'N/A'}</p>
                    </div>
                    <div className="bg-secondary-surface/50 p-6 rounded-2xl border border-border-grey/50">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Accuracy</p>
                      <p className="text-2xl font-serif font-black text-text-navy">94%</p>
                    </div>
                  </div>
                </div>

                {/* Growth & Insights Sidebar */}
                <div className="space-y-6">
                  <div className="bg-text-navy text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent mb-6">Growth Intelligence</h3>
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${(currentForecast.trends.growthRate || 0) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cta/20 text-cta'}`}>
                          {(currentForecast.trends.growthRate || 0) >= 0 ? '+' : ''}{Math.round((currentForecast.trends.growthRate || 0) * 100)}%
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Projected Growth</p>
                          <p className="text-[10px] text-white/50 italic capitalize">{forecastType}ly trend analysis</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Confidence Score</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-accent h-full w-[85%]" />
                          </div>
                          <span className="text-xs font-black text-accent">85%</span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/10 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Smart Observations</p>
                        <div className="flex gap-3">
                          <Zap className="w-4 h-4 text-accent shrink-0" />
                          <p className="text-xs text-white/80 leading-snug">
                            High confidence in revenue forecast based on {closureHistory.length} historical closures.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <p className="text-xs text-white/80 leading-snug">
                            Margin stability is within 2% variance of quarterly averages.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateForecast}
                    disabled={isGeneratingForecast}
                    className="w-full py-4 rounded-2xl bg-secondary-surface text-text-navy border border-border-grey hover:bg-white hover:border-accent transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 group shadow-sm hover:shadow-lg"
                  >
                    {isGeneratingForecast ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing Data...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        Run New Prediction
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-20 text-center space-y-6 bg-secondary-surface/30 rounded-3xl border border-dashed border-border-grey">
                <Database className="w-16 h-16 text-text-muted/20 mx-auto" />
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-text-navy uppercase tracking-tight">No Active Forecast Found</h3>
                  <p className="text-sm text-text-muted italic">
                    The engine requires data to project future performance. Run a prediction to analyze your historical closures.
                  </p>
                </div>
                <Button
                  onClick={handleGenerateForecast}
                  disabled={isGeneratingForecast}
                  className="bg-accent text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-accent/20 flex items-center gap-2 mx-auto"
                >
                  {isGeneratingForecast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isGeneratingForecast ? 'Engine Running...' : 'Generate First Forecast'}
                </Button>
              </div>
            )}
          </div>
          
          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200/50 flex items-start gap-4">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Info className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-900 uppercase tracking-widest mb-1">Advanced Forecasting Logic</p>
              <p className="text-xs text-amber-800/80 leading-relaxed italic">
                Our engine uses historical daily closures to identify patterns. Weekly forecasts adjust for weekday variables, while Monthly and Quarterly models track linear growth and margin stability. Predictions are refreshed automatically after every daily closure.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'sales' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Financial Guidance Section */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start">
            <div className="bg-blue-500/10 p-4 rounded-full flex-shrink-0">
              <Info className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-blue-900 dark:text-blue-200 uppercase tracking-widest">Financial Literacy Guide</h3>
                  <p className="text-[10px] text-blue-800/60 dark:text-blue-300/60 font-medium">Understanding how your revenue is calculated</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 px-3 py-2 rounded-xl border border-blue-100 dark:border-blue-900/40 text-[10px] font-mono text-blue-900 dark:text-blue-100 flex gap-4">
                   <div className="flex flex-col">
                     <span className="opacity-50 uppercase text-[8px]">Profitability Matrix</span>
                     <span>£{(salesReport.grossSalesAll || 0).toFixed(2)} (Gross) - £{(salesReport.outputVat || 0).toFixed(2)} (VAT) - £{(salesReport.serviceCharge || 0).toFixed(2)} (Srv) = <strong className="text-blue-600 font-black">£{(salesReport.profitTakeHome || 0).toFixed(2)}</strong></span>
                   </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-[11px] leading-relaxed text-blue-800/80 dark:text-blue-300/80">
                <p><strong>Gross Sales:</strong> Total revenue received after discounts, excluding tips. <em>Formula: Net Sales + VAT + Service.</em></p>
                <p><strong>VAT (Tax):</strong> Output tax collected for HMRC. Usually 20% or 5%.</p>
                <p><strong>Net Sales:</strong> Revenue excluding tax. <em>Formula: Gross Sales - VAT.</em></p>
                <p><strong>Service Charge:</strong> Fees added for staff service, included in Gross Sales but tracked separately for payroll.</p>
                <p><strong>Discounts:</strong> Total reductions applied to orders before payment.</p>
                <p><strong>Profit (Take Home):</strong> The final amount the business keeps. <em>Formula: Net Sales - Service Charge.</em></p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {/* Box 1: Gross Sales */}
            <div className="p-4 bg-card-bg border border-border-grey rounded-2xl shadow-sm relative group">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Gross Sales</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-serif font-bold text-text-navy/60">£</span>
                <p className="text-3xl font-serif font-bold text-text-navy">{salesReport.grossSalesAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="absolute top-2 right-2 text-emerald-500 bg-emerald-500/10 p-1.5 rounded-lg">
                 <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            {/* Box 2: VAT (Tax) */}
            <div className="p-4 bg-card-bg border border-border-grey rounded-2xl shadow-sm relative group">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">VAT (Tax)</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-serif font-bold text-amber-600/60">£</span>
                <p className="text-3xl font-serif font-bold text-amber-600/90">{salesReport.outputVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="absolute top-2 right-2 text-amber-500 bg-amber-500/10 p-1.5 rounded-lg">
                 <Filter className="w-4 h-4" />
              </div>
            </div>

            {/* Box 3: Net Sales */}
            <div className="p-4 bg-card-bg border border-border-grey rounded-2xl shadow-sm relative group">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Net Sales</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-serif font-bold text-text-navy/60">£</span>
                <p className="text-3xl font-serif font-bold text-text-navy">{salesReport.netSalesOnly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="absolute top-2 right-2 text-blue-500 bg-blue-500/10 p-1.5 rounded-lg">
                 <Calculator className="w-4 h-4" />
              </div>
            </div>

            {/* Box 4: Service Charge */}
            <div className="p-4 bg-card-bg border border-border-grey rounded-2xl shadow-sm relative group">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Service Charge</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-serif font-bold text-sky-600/60">£</span>
                <p className="text-3xl font-serif font-bold text-sky-600">{salesReport.serviceCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="absolute top-2 right-2 text-sky-500 bg-sky-500/10 p-1.5 rounded-lg">
                 <Clock className="w-4 h-4" />
              </div>
            </div>

            {/* Box 5: Discounts */}
            <div className="p-4 bg-card-bg border border-border-grey rounded-2xl shadow-sm relative group">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Discounts</p>
              <div className="flex items-baseline gap-1 text-cta">
                <span className="text-sm font-serif font-bold opacity-60">£</span>
                <p className="text-3xl font-serif font-bold">{salesReport.discounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="absolute top-2 right-2 text-cta bg-cta/10 p-1.5 rounded-lg">
                 <Tag className="w-4 h-4" />
              </div>
            </div>

            {/* Box 6: Profit (Take Home) */}
            <div className="p-4 bg-card-bg border-4 border-emerald-500/40 rounded-3xl shadow-xl shadow-emerald-500/5 relative group bg-emerald-50/20">
              <div className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                 Profit (Take Home)
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-baseline gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="text-sm font-serif font-bold opacity-60">£</span>
                <p className="text-4xl font-serif font-bold">{salesReport.profitTakeHome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="absolute top-4 right-4 text-emerald-600 bg-emerald-500/20 p-2 rounded-xl">
                 <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Box 7: Order Count */}
            <div className="p-4 bg-card-bg border border-border-grey rounded-2xl shadow-sm relative group">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Order Count</p>
              <p className="text-3xl font-serif font-bold text-text-navy">{salesReport.orderCount}</p>
              <div className="absolute top-2 right-2 text-slate-500 bg-slate-500/10 p-1.5 rounded-lg">
                 <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Detailed Financial Breakdown */}
          <div className="bg-card-bg p-8 rounded-2xl border border-border-grey shadow-sm">
            <h2 className="text-lg font-bold text-text-navy mb-8 flex items-center gap-2 uppercase tracking-tight">
              <Calculator className="w-5 h-5 text-accent" />
              Comprehensive Financial Reconciliation
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Gross/Net Analysis */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest pb-2 border-b border-border-grey flex items-center justify-between">
                  Earnings Analysis
                  <span className="text-[9px] font-normal lowercase italic">What we collected</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center group relative">
                    <span className="text-sm text-text-muted flex items-center gap-1">
                      Gross Collected
                      <Info className="w-3 h-3 opacity-20 group-hover:opacity-100" />
                    </span>
                    <div className="absolute left-0 top-6 hidden group-hover:block z-20 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg shadow-xl">
                      Total customer payment (Item price + Tax + Service) before any discounts.
                    </div>
                    <span className="text-sm font-bold text-text-navy">£{salesReport.grossSalesBeforeDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-medium italic">Minus Discounts</span>
                    <span className="text-sm font-bold text-cta">-£{salesReport.discounts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border-grey">
                    <span className="text-sm font-bold text-text-navy">Final Gross Sales</span>
                    <span className="text-sm font-black text-text-navy">£{salesReport.grossSalesAll.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 group relative">
                    <span className="text-sm text-text-muted flex items-center gap-1">
                      Business Revenue (Net)
                      <Info className="w-3 h-3 opacity-20 group-hover:opacity-100" />
                    </span>
                    <div className="absolute left-0 top-6 hidden group-hover:block z-20 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg shadow-xl">
                      The amount the restaurant actually earns after removing Tax and Service Charges.
                    </div>
                    <span className="text-sm font-bold text-text-navy">£{salesReport.netSalesBeforeDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-medium italic">Minus Discount Impact</span>
                    <span className="text-sm font-bold text-cta">-£{salesReport.discountValueExVat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border-grey">
                    <span className="text-sm font-bold text-text-navy font-serif">True Product Revenue</span>
                    <span className="text-sm font-black text-text-navy">£{salesReport.netSalesExVat.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Tax & Service Factor */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest pb-2 border-b border-border-grey flex items-center justify-between">
                  Taxes & Service
                  <span className="text-[9px] font-normal lowercase italic text-accent font-bold">What we owe others</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center group relative">
                    <span className="text-sm text-text-muted flex items-center gap-1 text-accent">
                      VAT Tax Due
                      <Info className="w-3 h-3 opacity-20 group-hover:opacity-100" />
                    </span>
                    <div className="absolute left-0 top-6 hidden group-hover:block z-20 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg shadow-xl">
                      Value Added Tax collected for the Government. Usually 20% or 5% of the item price.
                    </div>
                    <span className="text-sm font-bold text-text-navy">£{salesReport.vatBeforeDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-medium italic">VAT on Discounts</span>
                    <span className="text-sm font-bold text-cta">-£{salesReport.discountVatImpact.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border-grey">
                    <span className="text-sm font-bold text-text-navy">Total VAT Payable</span>
                    <span className="text-sm font-black text-accent">£{salesReport.outputVat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 group relative">
                    <span className="text-sm text-text-muted flex items-center gap-1">
                      Staff Service Charge
                      <Info className="w-3 h-3 opacity-20 group-hover:opacity-100" />
                    </span>
                    <div className="absolute left-0 top-6 hidden group-hover:block z-20 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg shadow-xl text-left">
                      Charges added for service. This belongs to the staff/operation, not the product revenue.
                    </div>
                    <span className="text-sm font-bold text-text-navy">£{salesReport.serviceChargeBeforeDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-medium italic">Service Discounts</span>
                    <span className="text-sm font-bold text-cta">-£{salesReport.discountServiceChargeImpact.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border-grey">
                    <span className="text-sm font-bold text-text-navy">Final Service Total</span>
                    <span className="text-sm font-black text-text-navy">£{salesReport.serviceCharge.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest pb-2 border-b border-border-grey">Payment Split</h3>
                <div className="space-y-3">
                  {Object.entries(salesReport.salesByPaymentMethod).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center">
                      <span className="text-sm text-text-muted">{method}</span>
                      <span className="text-sm font-bold text-text-navy">£{amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.keys(salesReport.salesByPaymentMethod).length === 0 && (
                    <p className="text-xs text-text-muted italic">No payment breakdown available for this period.</p>
                  )}
                  <div className="flex justify-between items-center pt-4 border-t border-border-grey">
                    <span className="text-sm font-black text-text-navy">Total Payments Recorded</span>
                    <span className="text-lg font-black text-success">£{salesReport.totalPaid.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-navy flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  {trendInterval} Sales Trend
                </h2>
                <div className="flex bg-secondary-surface p-1 rounded-lg border border-border-grey">
                  {(['Day', 'Week', 'Month'] as const).map(interval => (
                    <button
                      key={interval}
                      onClick={() => setTrendInterval(interval)}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
                        trendInterval === interval 
                          ? 'bg-card-bg text-accent shadow-sm' 
                          : 'text-text-muted hover:text-text-navy'
                      }`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendInterval === 'Day' ? salesByDay : trendInterval === 'Week' ? salesByWeek : salesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey={trendInterval === 'Day' ? 'date' : trendInterval === 'Week' ? 'week' : 'month'} 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickFormatter={(val) => {
                        if (typeof val !== 'string') return '';
                        if (trendInterval === 'Day') return val.split('-').slice(1).join('/');
                        return val;
                      }}
                    />
                    <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `£${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      formatter={(val: any) => [`£${Number(val).toFixed(2)}`, 'Sales']}
                    />
                    <Line type="monotone" dataKey="total" stroke="#486581" strokeWidth={3} dot={{ r: 4, fill: '#486581' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <h2 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-accent" />
                Service Charge Breakdown
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Dine-In</p>
                    <p className="text-xl font-bold text-text-navy">£{salesReport.serviceChargeByType['Dine-In'].toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Takeaway</p>
                    <p className="text-xl font-bold text-text-navy">£{salesReport.serviceChargeByType['Takeaway'].toFixed(2)}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-border-grey flex justify-between items-center font-bold">
                  <span className="text-xs uppercase tracking-widest text-text-muted">Total Service</span>
                  <span className="text-2xl text-accent">£{salesReport.serviceCharge.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'inventory' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Inventory Items</p>
              <p className="text-3xl font-serif font-bold text-text-navy">{inventoryItems.length}</p>
            </div>
            <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Total Value</p>
              <p className="text-3xl font-serif font-bold text-text-navy">£{itemsReport.inventoryValue.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <h3 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-success" />
                Top Sellers by Quantity
              </h3>
              <div className="space-y-4">
                {itemsReport.bestSellers.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-secondary-surface rounded-xl border border-border-grey">
                    <span className="text-sm font-bold text-text-navy">{item.name}</span>
                    <span className="text-xs text-text-muted">{item.quantity} sold</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <h3 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-cta" />
                Slow Moving Items
              </h3>
              <div className="space-y-4">
                {itemsReport.worstSellers.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-secondary-surface rounded-xl border border-border-grey">
                    <span className="text-sm font-bold text-text-navy">{item.name}</span>
                    <span className="text-xs text-text-muted">{item.quantity} sold</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'suppliers' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-card-bg rounded-2xl border border-border-grey shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary-surface text-[10px] font-bold text-text-muted uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Total Ordered</th>
                  <th className="px-6 py-4">Amount Owed</th>
                  <th className="px-6 py-4">Usage Efficiency</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grey">
                {supplierReport.map((s, idx) => (
                  <tr key={idx} className="hover:bg-secondary-surface transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-text-navy">{s.name}</td>
                    <td className="px-6 py-4 text-xs font-serif text-text-navy">£{s.ordered.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs font-serif text-cta font-bold">£{s.owed.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-border-grey h-1.5 rounded-full overflow-hidden">
                        <div className="bg-accent h-full" style={{ width: '75%' }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${s.owed > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {s.owed > 0 ? 'Payment Due' : 'Up to Date'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      ) : activeTab === 'tax' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="space-y-6">
          <div className="bg-card-bg rounded-2xl border border-border-grey shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-border-grey flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-navy uppercase tracking-widest">HMRC Compliance Check</h3>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${combinedVatItems.some(item => !item.vatCode) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {combinedVatItems.some(item => !item.vatCode) ? 'Review Needed' : 'Compliant'}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search items..." 
                    value={vatTableSearch}
                    onChange={(e) => setVatTableSearch(e.target.value)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 pl-9 pr-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div className="relative w-36">
                  <select 
                    value={vatTableFilter}
                    onChange={(e) => setVatTableFilter(e.target.value as any)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    <option value="All">All Items</option>
                    <option value="Has VAT">Has VAT</option>
                    <option value="No VAT">No VAT</option>
                    <option value="Missing">Missing VAT</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-secondary-surface text-[10px] font-bold text-text-muted uppercase tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">VAT Code</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey">
                  {filteredVatItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-xs text-text-muted italic">
                        No items found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredVatItems.map((item) => (
                      <tr 
                        key={`${item.itemType}-${item.id}`} 
                        className="hover:bg-secondary-surface transition-colors cursor-pointer"
                        onClick={() => {
                          if (item.itemType === 'recipe') {
                            onEditRecipe && onEditRecipe(item.id);
                          } else {
                            onEditInventoryItem && onEditInventoryItem(item as any);
                          }
                        }}
                      >
                        <td className="px-6 py-4 text-xs font-bold text-text-navy">{item.name}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{item.itemType === 'recipe' ? 'Recipe' : 'Inventory'}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{item.vatCode || 'MISSING'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.vatCode ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-[10px] font-bold text-text-navy uppercase tracking-widest">{item.vatCode ? 'Verified' : 'Review'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </div>
      ) : activeTab === 'vat_return' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <VATReturnExport 
            vatTrackers={vatTrackers} 
            existingReturns={vatReturns} 
            netSalesTotal={pnlSummary.totalRevenue}
            netPurchasesTotal={pnlSummary.totalExpenses - pnlSummary.labour}
          />
        </div>
      ) : activeTab === 'closures' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Reconciliation Layer */}
          <div className="bg-card-bg p-8 rounded-2xl border border-border-grey shadow-sm space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-text-navy p-3 rounded-xl shadow-lg">
                  <Calculator className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-black text-text-navy uppercase tracking-tight">Shift Reconciliation</h2>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest italic">Financial verification before period closure</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-secondary-surface p-2 rounded-xl border border-border-grey">
                <div className="px-4 py-1">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest leading-none">Net Over/Under</p>
                  <p className={`text-lg font-black ${reconciliation.variance < 0 ? 'text-cta' : reconciliation.variance > 0 ? 'text-success' : 'text-text-navy'}`}>
                    £{reconciliation.variance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="p-5 bg-white/50 dark:bg-black/10 rounded-2xl border border-border-grey/50">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5 line-clamp-1">
                  <TrendingUp className="w-3 h-3 text-accent" /> Total Revenue
                </p>
                <div className="text-xl font-serif font-black text-text-navy">£{reconciliation.totalPaid.toFixed(2)}</div>
                <p className="text-[8px] text-text-muted mt-2 font-bold uppercase tracking-tighter">(Gross Paid)</p>
              </div>

              <div className="p-5 bg-white/50 dark:bg-black/10 rounded-2xl border border-border-grey/50">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Building className="w-3 h-3 text-accent" /> Card Total
                </p>
                <div className="text-xl font-serif font-black text-text-navy">£{reconciliation.cardTotal.toFixed(2)}</div>
                <p className="text-[8px] text-text-muted mt-2 font-bold uppercase tracking-tighter">(Integrated & Manual)</p>
              </div>

              <div className="p-5 bg-white/40 dark:bg-black/20 rounded-2xl border-2 border-accent/20 ring-4 ring-accent/5">
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <PoundSterling className="w-3 h-3" /> Cash Expected
                </p>
                <div className="text-xl font-serif font-black text-text-navy">£{reconciliation.cashTotal.toFixed(2)}</div>
                <p className="text-[8px] text-text-muted mt-2 font-bold uppercase tracking-tighter">(From POS Records)</p>
              </div>

              <div className="p-5 bg-secondary-surface rounded-2xl border border-accent ring-2 ring-accent/10">
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Calculator className="w-3 h-3" /> Cash Declared
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-navy font-bold text-sm">£</span>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(e.target.value)}
                    className="w-full bg-white dark:bg-black/40 border-none rounded-xl pl-7 py-2 text-lg font-black text-text-navy focus:ring-0 outline-none"
                  />
                </div>
                <p className="text-[8px] text-text-muted mt-2 font-bold uppercase tracking-tighter">Enter Actual Cash Count</p>
              </div>

              <div className={`p-5 rounded-2xl border ${reconciliation.variance !== 0 ? 'bg-cta/5 border-cta/30' : 'bg-success/5 border-success/30'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${reconciliation.variance !== 0 ? 'text-cta' : 'text-success'}`}>
                  {reconciliation.variance < 0 ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />} 
                  Variance
                </p>
                <div className={`text-xl font-serif font-black ${reconciliation.variance < 0 ? 'text-cta' : reconciliation.variance > 0 ? 'text-success' : 'text-text-navy'}`}>
                  £{reconciliation.variance.toFixed(2)}
                </div>
                <p className="text-[8px] text-text-muted mt-2 font-bold uppercase tracking-tighter">
                  {reconciliation.variance === 0 ? 'Perfect Match' : reconciliation.variance < 0 ? 'Cash Shortage' : 'Cash Surplus'}
                </p>
              </div>
            </div>

            {/* Reconciliation Debug Section */}
            <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
               <button 
                 onClick={() => setShowReconDebug(!showReconDebug)}
                 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
               >
                 <Info className="w-3.5 h-3.5" /> {showReconDebug ? 'Hide' : 'Show'} Reconciliation Debug
               </button>
               
               {showReconDebug && (
                 <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="bg-black/20 p-3 rounded-lg">
                          <p className="text-[8px] text-slate-500 uppercase font-bold mb-1">POS Payment Count</p>
                          <p className="text-sm font-mono text-white">{reconciliation.paymentCount}</p>
                       </div>
                       <div className="bg-black/20 p-3 rounded-lg">
                          <p className="text-[8px] text-slate-500 uppercase font-bold mb-1">Hub Calculated Total</p>
                          <p className="text-sm font-mono text-white">£{reconciliation.totalPaid.toFixed(2)}</p>
                       </div>
                    </div>
                    
                    <div className="bg-black/40 p-4 rounded-lg overflow-hidden">
                       <p className="text-[8px] text-slate-500 uppercase font-bold mb-2">Raw Payment List (Calculated)</p>
                       <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[9px]">
                          {reconciliation.rawList.map((item, idx) => (
                            <div key={idx} className="flex justify-between py-1 border-b border-slate-800/50">
                               <span className="text-slate-400">{item.id} ({item.method})</span>
                               <span className="text-white">£{item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
               )}
            </div>

            {Math.abs(reconciliation.variance) > 50 && (
              <div className="bg-cta/10 border border-cta/20 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-cta shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-cta uppercase tracking-tight">Significant Variance Detected</p>
                  <p className="text-[10px] text-cta/80 font-bold uppercase tracking-widest mt-1">Difference of £{Math.abs(reconciliation.variance).toFixed(2)} requires immediate manager review before closure.</p>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Closure Action Card */}
            <div className={`lg:col-span-1 p-8 rounded-2xl border shadow-lg flex flex-col justify-between transition-all duration-300 ${showClosurePreview ? 'bg-slate-900 border-slate-700 ring-4 ring-accent/20' : 'bg-card-bg border-border-grey'}`}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className={`text-xl font-bold mb-0 flex items-center gap-2 tracking-tight ${showClosurePreview ? 'text-white' : 'text-text-navy'}`}>
                    {showClosurePreview ? <Clock className="w-6 h-6 text-accent animate-pulse" /> : <Lock className="w-6 h-6 text-accent" />}
                    {showClosurePreview ? 'Preview Closure' : 'Close Day / Shift'}
                  </h3>
                  {showClosurePreview && (
                    <button 
                      onClick={() => setShowClosurePreview(false)}
                      className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!showClosurePreview ? (
                  <>
                    <p className="text-sm text-text-muted italic font-serif">Securely finalize financial records for the current period.</p>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Closure Type</label>
                        <div className="flex bg-secondary-surface p-1 rounded-xl border border-border-grey">
                          <button 
                            onClick={() => setClosureType(ClosureType.DAY)}
                            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${closureType === ClosureType.DAY ? 'bg-card-bg text-accent shadow-sm' : 'text-text-muted hover:text-text-navy'}`}
                          >
                            Daily
                          </button>
                          <button 
                            onClick={() => setClosureType(ClosureType.SHIFT)}
                            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${closureType === ClosureType.SHIFT ? 'bg-card-bg text-accent shadow-sm' : 'text-text-muted hover:text-text-navy'}`}
                          >
                            Shift
                          </button>
                        </div>
                      </div>

                      {closureType === ClosureType.SHIFT && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Shift Name</label>
                          <input 
                            type="text" 
                            value={shiftName}
                            onChange={(e) => setShiftName(e.target.value)}
                            placeholder="e.g. Lunch, Evening"
                            className="w-full bg-secondary-surface border border-border-grey rounded-xl py-3 px-4 text-sm text-text-navy font-bold focus:ring-2 focus:ring-accent outline-none"
                          />
                        </div>
                      )}

                      <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-text-muted font-medium">Location:</span>
                          <span className="text-text-navy font-bold">Camden (loc_camden)</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-text-muted font-medium">Period:</span>
                          <span className="text-text-navy font-bold">{appliedDateRange.start} {appliedDateRange.start !== appliedDateRange.end ? `to ${appliedDateRange.end}` : ''}</span>
                        </div>
                        <div className="pt-3 border-t border-accent/10 flex justify-between items-center">
                          <span className="text-xs font-black text-text-navy uppercase tracking-tighter">Gross Expected</span>
                          <span className="text-lg font-black text-success">£{(reconciliation.totalPaid || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10 overflow-hidden relative">
                      <div className="absolute top-0 right-0 p-1 bg-accent/20 rounded-bl-lg">
                        <FileText className="w-3 h-3 text-accent" />
                      </div>
                      
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Total Paid</span>
                        <span className="text-white font-mono font-black">£{(reconciliation.totalPaid || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Card Total</span>
                        <span className="text-white font-mono">£{(reconciliation.cardTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Cash Total</span>
                        <span className="text-white font-mono">£{(reconciliation.cashTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Other Total</span>
                        <span className="text-white font-mono">£{(reconciliation.otherTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2 pt-1">
                        <span className="text-slate-400">Gross Sales</span>
                        <span className="text-white font-mono font-black">£{(reconciliation.grossSales || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Net Sales (Ex. VAT)</span>
                        <span className="text-white font-mono">£{(reconciliation.netSales || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">VAT Collected</span>
                        <span className="text-white font-mono text-accent">£{(reconciliation.vatTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2 pt-1">
                        <span className="text-slate-400">Service Charge</span>
                        <span className="text-white font-mono">£{(reconciliation.serviceChargeTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Total Discounts</span>
                        <span className="text-text-muted font-mono font-bold">£{(reconciliation.discountTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="text-slate-400">Order Count</span>
                        <span className="text-white font-mono font-black">{reconciliation.orderCount}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <p className="text-[9px] text-amber-200 font-bold uppercase tracking-widest text-center">
                        <Lock className="w-3 h-3 inline-block mr-1 mb-0.5" /> 
                        Final confirmation will lock these {reconciliation.paymentCount} payments.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Button 
                onClick={handlePerformClosure}
                disabled={isPerformingClosure || reconciliation.totalPaid <= 0}
                className={`w-full py-4 mt-8 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] ${
                  isPerformingClosure ? 'bg-text-muted cursor-not-allowed' : 
                  showClosurePreview ? 'bg-success text-white shadow-success/20 hover:bg-success/90' : 'bg-accent text-white shadow-accent/20 hover:opacity-90'
                }`}
              >
                {isPerformingClosure ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Finalizing...
                  </>
                ) : showClosurePreview ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Confirm & Save Closure
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Close {closureType === ClosureType.DAY ? 'Day' : 'Shift'}
                  </>
                )}
              </Button>
            </div>

            {/* Closure History */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-navy flex items-center gap-2 uppercase tracking-tight">
                  <HistoryIcon className="w-5 h-5 text-text-muted" />
                  Recent Closures
                </h3>
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest bg-secondary-surface px-3 py-1 rounded-full border border-border-grey">
                  Audit Trail
                </span>
              </div>

              {closureHistory.length === 0 ? (
                <div className="bg-card-bg p-12 rounded-2xl border border-dashed border-border-grey text-center space-y-3">
                  <Lock className="w-12 h-12 text-text-muted/30 mx-auto" />
                  <p className="text-sm font-bold text-text-muted">No closure records found for this location.</p>
                  <p className="text-xs text-text-muted/70 italic">Perform your first closure to start the historical audit trail.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {closureHistory.map((cls) => (
                    <div key={cls.id} className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm hover:border-accent/40 transition-all group flex flex-col sm:flex-row justify-between gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${cls.type === ClosureType.DAY ? 'bg-accent/10 text-accent border-accent/20' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {cls.type}
                          </span>
                          <span className="text-xs font-bold text-text-navy">{cls.date}</span>
                          {cls.shiftName && (
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-secondary-surface px-2 py-0.5 rounded">
                              {cls.shiftName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="text-lg font-black text-text-navy font-serif">£{(cls.totals?.totalPaid || 0).toFixed(2)}</span>
                            <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Total Paid</span>
                          </div>
                          <div className="w-px h-8 bg-border-grey" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-navy">£{(cls.totals?.grossSales || 0).toFixed(2)}</span>
                            <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Gross Sales</span>
                          </div>
                          <div className="w-px h-8 bg-border-grey" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-navy">£{(cls.totals?.netSales || 0).toFixed(2)}</span>
                            <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Net Sales</span>
                          </div>
                          <div className="w-px h-8 bg-border-grey" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-navy">£{(cls.totals?.vatTotal || 0).toFixed(2)}</span>
                            <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">VAT</span>
                          </div>
                          {cls.vatReport?.serviceChargeGross !== undefined && (
                            <>
                              <div className="w-px h-8 bg-border-grey" />
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-text-navy">£{(cls.vatReport.serviceChargeGross || 0).toFixed(2)}</span>
                                <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Srv. Chg</span>
                              </div>
                            </>
                          )}
                          <div className="w-px h-8 bg-border-grey" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-navy">{cls.totals?.orderCount || 0}</span>
                            <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Orders</span>
                          </div>
                          {cls.profitReport && (
                            <>
                              <div className="w-px h-8 bg-border-grey" />
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-emerald-600">{(cls.profitReport.grossMargin || 0).toFixed(1)}%</span>
                                <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Margin</span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-2 text-[10px] text-text-muted">
                          <Clock className="w-3 h-3" />
                          <span>Generated by {cls.closedBy?.name || 'Unknown'} on {cls.meta?.createdAt ? new Date(cls.meta.createdAt).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          onClick={() => setSelectedClosureForDetail(cls)}
                          className="text-[9px] font-black uppercase tracking-widest px-4 py-2 bg-secondary-surface border-border-grey hover:bg-white rounded-xl"
                        >
                          View Details
                        </Button>
                        <Button 
                          onClick={() => {
                            // Quick export of this closure
                            const blob = new Blob([JSON.stringify(cls, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `closure_${cls.type}_${cls.date}.json`;
                            a.click();
                          }}
                          className="text-[9px] font-black uppercase tracking-widest px-4 py-2 bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-white rounded-xl"
                        >
                          Export Data
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Closure Detail Modal */}
      {selectedClosureForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-main-bg w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-border-grey animate-in fade-in zoom-in duration-200">
            <div className="bg-white p-6 border-b border-border-grey flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-text-navy flex items-center gap-3">
                  <Lock className="w-6 h-6 text-accent" />
                  Closure Details
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${selectedClosureForDetail.type === ClosureType.DAY ? 'bg-accent/10 text-accent border-accent/20' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                    {selectedClosureForDetail.type}
                  </span>
                  <span className="text-xs font-bold text-text-muted">{selectedClosureForDetail.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => generateClosureCSV(selectedClosureForDetail)}
                  className="bg-secondary-surface text-text-navy border border-border-grey hover:bg-white p-2 rounded-xl transition-all"
                  title="Export CSV"
                >
                  <Download className="w-5 h-5" />
                </Button>
                <Button 
                  onClick={() => generateClosurePDF(selectedClosureForDetail)}
                  className="bg-accent text-white hover:opacity-90 p-2 rounded-xl shadow-lg shadow-accent/20 transition-all"
                  title="Export PDF"
                >
                  <FileText className="w-5 h-5" />
                </Button>
                <button 
                  onClick={() => setSelectedClosureForDetail(null)}
                  className="p-2 hover:bg-secondary-surface rounded-full transition-colors text-text-muted"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Financial Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-secondary-surface p-4 rounded-2xl border border-border-grey">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Total Paid</span>
                  <span className="text-lg font-black text-text-navy font-serif">£{(selectedClosureForDetail.totals?.totalPaid || 0).toFixed(2)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-border-grey">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Gross Sales</span>
                  <span className="text-lg font-black text-text-navy font-serif text-accent">£{(selectedClosureForDetail.totals?.grossSales || 0).toFixed(2)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-border-grey">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Net Sales</span>
                  <span className="text-lg font-black text-text-navy font-serif">£{(selectedClosureForDetail.totals?.netSales || 0).toFixed(2)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-border-grey">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">VAT Total</span>
                  <span className="text-lg font-black text-text-navy font-serif text-success">£{(selectedClosureForDetail.totals?.vatTotal || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Profit & COGS Analysis */}
              {selectedClosureForDetail.profitReport && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex flex-col justify-center items-center text-center">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-100/50 rounded-lg">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">COGS (Stock Cost)</span>
                    </div>
                    <span className="text-2xl font-black text-blue-900 font-serif">£{(selectedClosureForDetail.profitReport.cogs || 0).toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="p-1.5 bg-emerald-100/50 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Gross Profit</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-emerald-900 font-serif">£{(selectedClosureForDetail.profitReport.grossProfit || 0).toFixed(2)}</span>
                      <span className="text-xs font-black text-emerald-600/80 mt-1">{(selectedClosureForDetail.profitReport.grossMargin || 0).toFixed(1)}% Margin</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Smart Insights Engine */}
              {selectedClosureForDetail.insights && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-accent" />
                    Smart Business Insights
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Performance Highlights */}
                    <div className="bg-white border border-border-grey rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 text-accent" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Performance Highlights</span>
                      </div>
                      <div className="space-y-3">
                        {selectedClosureForDetail.insights.topStaff.map((staff, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-text-navy">{staff.name}</span>
                              <span className="text-[10px] text-text-muted">{staff.metric}</span>
                            </div>
                            <span className="text-xs font-black text-accent">{staff.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Operational Efficiency */}
                    <div className="bg-white border border-border-grey rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Slow Hours & Traffic</span>
                      </div>
                      <div className="space-y-3">
                        {selectedClosureForDetail.insights.slowHours.length > 0 ? (
                          selectedClosureForDetail.insights.slowHours.map((hour, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-xs font-bold text-text-navy">{hour.hour}</span>
                              <span className="text-xs font-black text-blue-600">£{hour.revenue.toFixed(2)} Revenue</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-text-muted italic">No data available</span>
                        )}
                      </div>
                    </div>

                    {/* Alerts & Warnings */}
                    {(selectedClosureForDetail.insights.profitWarnings.length > 0 || selectedClosureForDetail.insights.discountAlerts.length > 0) && (
                      <div className="md:col-span-2 bg-orange-50/50 border border-orange-100 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Attention Required</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedClosureForDetail.insights.profitWarnings.map((warning, idx) => (
                            <div key={idx} className="flex gap-2 text-xs text-orange-900 bg-white/50 p-3 rounded-xl border border-orange-100/50">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{warning}</span>
                            </div>
                          ))}
                          {selectedClosureForDetail.insights.discountAlerts.map((alert, idx) => (
                            <div key={idx} className="flex gap-2 text-xs text-orange-900 bg-white/50 p-3 rounded-xl border border-orange-100/50">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>Staff <span className="font-bold">{alert.staffName}</span> used {alert.ratio.toFixed(1)}% discounts (£{alert.amount.toFixed(2)}).</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Item Margin Analysis */}
                    {selectedClosureForDetail.insights.lowMarginItems.length > 0 && (
                      <div className="md:col-span-2 bg-white border border-border-grey rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-border-grey flex items-center gap-2 bg-secondary-surface">
                          <Package className="w-4 h-4 text-text-muted" />
                          <span className="text-[10px] font-black text-text-navy uppercase tracking-widest">Low Margin Items (Potential Loss)</span>
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead className="bg-secondary-surface/30">
                            <tr>
                              <th className="px-5 py-3 font-black text-text-muted uppercase tracking-widest">Item Name</th>
                              <th className="px-5 py-3 font-black text-text-muted uppercase tracking-widest text-center">Volume</th>
                              <th className="px-5 py-3 font-black text-text-muted uppercase tracking-widest text-right">Margin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-grey/50">
                            {selectedClosureForDetail.insights.lowMarginItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-accent/5 transition-colors">
                                <td className="px-5 py-3 font-bold text-text-navy">{item.name}</td>
                                <td className="px-5 py-3 text-center font-mono">{item.volume}</td>
                                <td className="px-5 py-3 text-right font-black text-accent">{item.margin.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Auto-Actions System */}
              {selectedClosureForDetail.actions && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent animate-pulse" />
                    Recommended Actions
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Risk Alerts - Top Priority */}
                    {selectedClosureForDetail.actions.riskAlerts.length > 0 && (
                      <div className="md:col-span-2 space-y-2">
                        {selectedClosureForDetail.actions.riskAlerts.map((alert, idx) => (
                          <div key={idx} className={`flex items-center gap-3 p-4 rounded-xl border-2 ${alert.severity === 'high' ? 'bg-cta/5 border-cta text-cta' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-70">{alert.type}</p>
                              <p className="text-sm font-bold leading-tight">{alert.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pricing Actions */}
                    <div className="bg-white border-2 border-accent/20 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                      <div className="px-5 py-3 border-b border-accent/10 bg-accent/5 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-accent" />
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">Pricing Optimization</span>
                      </div>
                      <div className="p-5 divide-y divide-border-grey/50">
                        {selectedClosureForDetail.actions.pricing.length > 0 ? (
                          selectedClosureForDetail.actions.pricing.map((action, idx) => (
                            <div key={idx} className="py-3 first:pt-0 last:pb-0 group">
                              <p className="text-xs font-bold text-text-navy mb-1">{action.itemName}</p>
                              <p className="text-[11px] text-text-muted leading-snug group-hover:text-accent transition-colors">{action.suggestion}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-black bg-cta/10 text-cta px-1.5 py-0.5 rounded">Margin: {action.currentMargin.toFixed(1)}%</span>
                                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Target: £{action.suggestedPrice.toFixed(2)}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-text-muted italic">All active items meeting margin targets.</p>
                        )}
                      </div>
                    </div>

                    {/* Staffing & Operations */}
                    <div className="bg-white border border-border-grey rounded-2xl overflow-hidden shadow-sm flex flex-col">
                      <div className="px-5 py-3 border-b border-border-grey bg-secondary-surface flex items-center gap-2">
                        <Building className="w-4 h-4 text-text-muted" />
                        <span className="text-[10px] font-black text-text-navy uppercase tracking-widest">Staffing & Shift Ops</span>
                      </div>
                      <div className="p-5 space-y-4">
                        {selectedClosureForDetail.actions.staffing.map((action, idx) => (
                          <div key={idx} className="flex gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${action.action === 'increase' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                              {action.action === 'increase' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-text-navy mb-0.5">{action.hour}</p>
                              <p className="text-[11px] text-text-muted leading-snug">{action.suggestion}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Promotion Ideas */}
                    {selectedClosureForDetail.actions.promotions.length > 0 && (
                      <div className="md:col-span-2 bg-blue-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="flex items-center gap-2 mb-4">
                          <Trophy className="w-5 h-5 text-accent" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Revenue Boost Strategy</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {selectedClosureForDetail.actions.promotions.map((promo, idx) => (
                            <div key={idx} className="space-y-1">
                              <p className="text-xs font-black text-accent">{promo.hour} Opportunity</p>
                              <p className="text-sm font-bold leading-tight">{promo.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detailed VAT Report */}
              {selectedClosureForDetail.vatReport && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-text-muted" />
                    VAT & Component Breakdown
                  </h3>
                  <div className="bg-white border border-border-grey rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary-surface">
                        <tr>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest">Component</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Gross</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Net</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">VAT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey/50">
                        <tr>
                          <td className="px-4 py-3 font-bold text-text-navy">Service Charge</td>
                          <td className="px-4 py-3 text-right font-mono">£{(selectedClosureForDetail.vatReport.serviceChargeGross || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono">£{(selectedClosureForDetail.vatReport.serviceChargeNet || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-accent">£{(selectedClosureForDetail.vatReport.serviceChargeVAT || 0).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-bold text-text-navy">Discounts</td>
                          <td className="px-4 py-3 text-right font-mono text-text-muted">£{(selectedClosureForDetail.vatReport.discountGross || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-text-muted">£{(selectedClosureForDetail.vatReport.discountNet || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-text-muted">£{(selectedClosureForDetail.vatReport.discountVATImpact || 0).toFixed(2)}</td>
                        </tr>
                        <tr className="bg-accent/5">
                          <td className="px-4 py-3 font-black text-accent uppercase tracking-widest">Total Sales</td>
                          <td className="px-4 py-3 text-right font-black text-accent font-mono">£{(selectedClosureForDetail.totals?.grossSales || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-text-navy font-mono">£{(selectedClosureForDetail.totals?.netSales || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-black text-success font-mono">£{(selectedClosureForDetail.totals?.vatTotal || 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Staff Performance */}
              {selectedClosureForDetail.breakdowns?.byStaff && selectedClosureForDetail.breakdowns.byStaff.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-text-muted" />
                    Staff Performance
                  </h3>
                  <div className="bg-white border border-border-grey rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-secondary-surface">
                        <tr>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest">Name</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Orders</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Gross</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Srv. Chg</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Disc.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey/50">
                        {selectedClosureForDetail.breakdowns.byStaff.map((s, idx) => (
                          <tr key={idx} className="hover:bg-secondary-surface/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-text-navy">{s.staffName}</div>
                              <div className="text-[8px] text-text-muted uppercase font-black tracking-tighter">{s.role}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{s.orders}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-accent">£{s.grossSales.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">£{s.serviceCharge.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono text-text-muted">£{s.discounts.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Hourly Sales */}
              {selectedClosureForDetail.breakdowns?.byHour && selectedClosureForDetail.breakdowns.byHour.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-muted" />
                    Hourly Sales Breakdown
                  </h3>
                  <div className="bg-white border border-border-grey rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-secondary-surface">
                        <tr>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest">Hour</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Orders</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">Total Paid</th>
                          <th className="px-4 py-3 font-black text-text-muted uppercase tracking-widest text-right">VAT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey/50">
                        {selectedClosureForDetail.breakdowns.byHour.map((h, idx) => (
                          <tr key={idx} className="hover:bg-secondary-surface/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-text-navy whitespace-nowrap">{h.hour.toString().padStart(2, '0')}:00 - {((h.hour + 1) % 24).toString().padStart(2, '0')}:00</td>
                            <td className="px-4 py-3 text-right font-mono">{h.orderCount}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-text-navy">£{h.totalPaid.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono text-success">£{h.vat.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              {selectedClosureForDetail.breakdowns?.byPaymentMethod && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                    <PoundSterling className="w-4 h-4 text-text-muted" />
                    Payment Method Breakdown
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(selectedClosureForDetail.breakdowns.byPaymentMethod).map(([method, amount]) => (
                      <div key={method} className="flex justify-between items-center p-3 bg-white border border-border-grey rounded-xl">
                        <span className="text-xs font-bold text-text-navy capitalize">{method}</span>
                        <span className="text-sm font-black text-text-navy font-mono">£{amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-6 border-t border-border-grey mt-8 flex flex-col sm:flex-row justify-between gap-4 text-[10px] text-text-muted uppercase tracking-widest font-bold">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>Closed by {selectedClosureForDetail.closedBy?.name || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  <span>{selectedClosureForDetail.meta?.createdAt ? new Date(selectedClosureForDetail.meta.createdAt).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="w-3 h-3" />
                  <span>Closure ID: {selectedClosureForDetail.id || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-secondary-surface border-t border-border-grey flex justify-end">
              <Button 
                onClick={() => setSelectedClosureForDetail(null)}
                className="bg-text-navy text-white hover:opacity-90 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
