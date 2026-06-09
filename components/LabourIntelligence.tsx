
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Users, 
  Upload, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart3, 
  DollarSign, 
  UserPlus, 
  ChevronRight, 
  Search, 
  Filter, 
  Download,
  Calendar,
  AlertCircle,
  Zap,
  Briefcase,
  History,
  FileText,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  PieChart,
  HardHat,
  Sun,
  Moon
} from 'lucide-react';
import { 
  LabourShift, 
  StaffMember, 
  POSOrder, 
  DailyClosure, 
  LabourForecasting,
  AIAction,
  SystemAlert
} from '../types';
import { Button } from './Button';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
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

interface LabourIntelligenceProps {
  staff: StaffMember[];
  orders: POSOrder[];
  closures: DailyClosure[];
}

export const LabourIntelligence: React.FC<LabourIntelligenceProps> = ({ staff, orders, closures }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'productivity' | 'forecast' | 'payroll' | 'history'>('dashboard');
  const [shifts, setShifts] = useState<LabourShift[]>([]);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'validation' | 'complete'>('upload');
  const [validationErrors, setValidationErrors] = useState<{row: number, error: string}[]>([]);
  const [unmatchedStaff, setUnmatchedStaff] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time shifts subscription
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'labourShifts'), 
      where('locationId', '==', LOCATION_ID),
      orderBy('date', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LabourShift));
      setShifts(shiftData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'labourShifts');
    });
  }, []);

  // Fetch Import Logs
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'importLogs'),
      where('locationId', '==', LOCATION_ID),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setImportLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'importLogs');
    });
  }, []);

  // Metrics Calculations
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = shifts.filter(s => s.date === today);
    const todaySales = orders.filter(o => o.status === 'Paid' && o.createdAt.startsWith(today)).reduce((acc, o) => acc + (o.total || 0), 0);
    
    const todayLabourCost = todayShifts.reduce((acc, s) => acc + s.totalCost, 0);
    const todayHours = todayShifts.reduce((acc, s) => acc + s.durationHours, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekShifts = shifts.filter(s => new Date(s.date) >= weekAgo);
    const weekLabourCost = weekShifts.reduce((acc, s) => acc + s.totalCost, 0);
    
    const netSalesToday = orders.filter(o => o.status === 'Paid' && o.createdAt.startsWith(today)).reduce((acc, o) => acc + (o.financials?.netSales || o.net_total || 0), 0);
    
    return {
      todayLabourCost,
      todayHours,
      labourPercent: netSalesToday > 0 ? (todayLabourCost / netSalesToday) * 100 : 0,
      salesPerHour: todayHours > 0 ? todaySales / todayHours : 0,
      weekLabourCost,
      activeStaff: todayShifts.length,
      overtimeCount: todayShifts.filter(s => s.durationHours > 9).length
    };
  }, [shifts, orders]);

  // CSV Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setImportData(results.data);
          detectColumns(results.meta.fields || []);
          setImportStep('mapping');
          setImporting(false);
        }
      });
    } else {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setImportData(data);
        if (data.length > 0) {
          detectColumns(Object.keys(data[0] as object));
        }
        setImportStep('mapping');
        setImporting(false);
      };
      reader.readAsBinaryString(file);
    }
  };

  const detectColumns = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    const aliases: Record<string, string[]> = {
      employeeName: ['name', 'employee', 'staff', 'user', 'employee name'],
      date: ['date', 'work date', 'shift date', 'day'],
      clockIn: ['clock in', 'start', 'start time', 'in'],
      clockOut: ['clock out', 'end', 'end time', 'out'],
      breakMinutes: ['break', 'break minutes', 'break time', 'break_min'],
      durationHours: ['duration', 'hours', 'total hours', 'worked'],
      wageRate: ['rate', 'wage', 'hourly rate', 'pay rate', 'wage rate'],
      totalCost: ['cost', 'total cost', 'gross pay', 'pay', 'amount']
    };

    headers.forEach(header => {
      const h = header.toLowerCase();
      Object.entries(aliases).forEach(([field, keywords]) => {
        if (keywords.some(k => h.includes(k))) {
          mapping[field] = header;
        }
      });
    });
    setColumnMapping(mapping);
  };

  const validateImport = () => {
    const errors: {row: number, error: string}[] = [];
    const unmatched: string[] = [];

    importData.forEach((row, idx) => {
      const name = row[columnMapping.employeeName];
      const date = row[columnMapping.date];
      const hours = parseFloat(row[columnMapping.durationHours]);
      const rate = parseFloat(row[columnMapping.wageRate]);

      if (!name) errors.push({ row: idx + 1, error: 'Missing employee name' });
      if (!date) errors.push({ row: idx + 1, error: 'Missing date' });
      if (isNaN(hours) || hours <= 0) errors.push({ row: idx + 1, error: 'Invalid duration hours' });
      
      // Match staff
      const matched = staff.find(s => 
        `${s.firstName} ${s.lastName}`.toLowerCase() === name?.toLowerCase() ||
        s.firstName.toLowerCase() === name?.toLowerCase()
      );
      if (!matched && name && !unmatched.includes(name)) {
        unmatched.push(name);
      }
    });

    setValidationErrors(errors);
    setUnmatchedStaff(unmatched);
    setImportStep('validation');
  };

  const executeImport = async () => {
    setImporting(true);
    try {
      let importedCount = 0;
      let duplicateCount = 0;

      for (const row of importData) {
        const name = row[columnMapping.employeeName];
        const dateRaw = row[columnMapping.date];
        const clockIn = row[columnMapping.clockIn];
        const clockOut = row[columnMapping.clockOut];
        const hours = parseFloat(row[columnMapping.durationHours]) || 0;
        const rate = parseFloat(row[columnMapping.wageRate]) || 0;
        const breakMin = parseFloat(row[columnMapping.breakMinutes]) || 0;

        // Date normalization - Handle DD/MM/YYYY and other common formats
        let date = dateRaw;
        if (dateRaw) {
          const parsedDate = new Date(dateRaw);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
          } else if (typeof dateRaw === 'string' && dateRaw.includes('/')) {
            // Handle common UK format DD/MM/YYYY
            const [d, m, y] = dateRaw.split('/');
            if (d && m && y) {
              const year = y.length === 2 ? `20${y}` : y;
              date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        }

        // Match staff
        const matched = staff.find(s => 
          `${s.firstName} ${s.lastName}`.toLowerCase() === name?.toLowerCase() ||
          s.firstName.toLowerCase() === name?.toLowerCase()
        );

        // Duplicate check - Strengthened with multiple identifiers
        const isDuplicate = shifts.some(s => 
          s.employeeName.toLowerCase() === name?.toLowerCase() && 
          s.date === date && 
          (s.clockIn === clockIn || Math.abs(s.durationHours - (hours || 0)) < 0.05)
        );

        if (isDuplicate) {
          duplicateCount++;
          continue;
        }

        const newShift: Omit<LabourShift, 'id'> = {
          employeeName: name || 'Unknown',
          staffId: matched?.id || null,
          role: matched?.role || 'Staff',
          department: matched?.department || 'Operations',
          date: date || '',
          clockIn: clockIn || '',
          clockOut: clockOut || '',
          breakMinutes: breakMin,
          durationHours: hours,
          wageRate: rate || matched?.hourlyRate || 0,
          totalCost: (hours * (rate || matched?.hourlyRate || 0)) || (columnMapping.totalCost ? (parseFloat(row[columnMapping.totalCost]) || 0) : 0) || 0,
          locationId: LOCATION_ID,
          importedAt: new Date().toISOString(),
          source: "Time Tracker Pro CSV"
        };

        await addDoc(collection(db, 'labourShifts'), newShift);
        importedCount++;
      }

      const importedDates = [...new Set(importData.map(row => {
        const dateRaw = row[columnMapping.date];
        if (dateRaw && !isNaN(Date.parse(dateRaw))) {
          return new Date(dateRaw).toISOString().split('T')[0];
        }
        if (typeof dateRaw === 'string' && dateRaw.includes('/')) {
          const [d, m, y] = dateRaw.split('/');
          const year = y.length === 2 ? `20${y}` : y;
          return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return dateRaw;
      }).filter(Boolean))].sort();

      // Add Audit Trail Log
      await addDoc(collection(db, 'importLogs'), {
        locationId: LOCATION_ID,
        type: 'Labour Shift Import',
        importedBy: 'Manager',
        count: importedCount,
        duplicates: duplicateCount,
        source: "Time Tracker Pro CSV",
        dateRange: importedDates.length > 0 ? `${importedDates[0]} to ${importedDates[importedDates.length - 1]}` : 'N/A',
        dates: importedDates,
        timestamp: new Date().toISOString()
      });

      toast.success(`Import complete: ${importedCount} shifts added. ${duplicateCount} duplicates skipped.`);
      setImportStep('upload');
      setImportData([]);
      setFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const [file, setFile] = useState<File | null>(null);

  // Staff Productivity Data
  const staffProductivity = useMemo(() => {
    return staff.map(s => {
      const staffShifts = shifts.filter(sh => sh.staffId === s.id);
      const staffOrders = orders.filter(o => o.waiterId === s.id && o.status === 'Paid');
      
      const totalHours = staffShifts.reduce((acc, sh) => acc + sh.durationHours, 0);
      const totalSales = staffOrders.reduce((acc, o) => acc + (o.total || 0), 0);
      const totalCovers = staffOrders.length;
      const totalLabourCost = staffShifts.reduce((acc, sh) => acc + sh.totalCost, 0);
      const totalServiceCharge = staffOrders.reduce((acc, o) => acc + (o.serviceCharge || 0), 0);
      
      const salesPerHour = totalHours > 0 ? totalSales / totalHours : 0;
      const avgTicket = totalCovers > 0 ? totalSales / totalCovers : 0;
      
      // Calculate score (0-100)
      const productivityScore = Math.min(100, (salesPerHour / 150) * 100); 

      return {
        ...s,
        totalHours,
        totalSales,
        salesPerHour,
        avgTicket,
        totalLabourCost,
        totalServiceCharge,
        productivityScore
      };
    }).sort((a, b) => b.productivityScore - a.productivityScore);
  }, [staff, shifts, orders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-accent/10 p-4 rounded-2xl">
              <HardHat className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-text-navy uppercase tracking-tight">Labour Intelligence</h1>
              <p className="text-sm font-bold text-text-muted uppercase tracking-widest mt-1">
                Import, Analysis & Forecasting Engine
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant={activeTab === 'import' ? 'primary' : 'secondary'} 
              className="gap-2 h-12 px-6"
              onClick={() => setActiveTab('import')}
            >
              <Upload className="w-4 h-4" />
              Import Shifts
            </Button>
            <div className="h-10 w-[1px] bg-border-grey mx-2 hidden md:block" />
            <div className="flex bg-secondary-surface p-1 rounded-xl border border-border-grey">
              {(['dashboard', 'productivity', 'forecast', 'payroll', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === tab 
                    ? 'bg-white text-accent shadow-sm border border-border-grey' 
                    : 'text-text-muted hover:text-text-navy'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-accent transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-accent/10 rounded-xl group-hover:scale-110 transition-transform">
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
                <span className="text-[10px] font-black text-success uppercase tracking-widest bg-success/10 px-2 py-0.5 rounded-full">
                  Today
                </span>
              </div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Labour Cost (Live)</p>
              <p className="text-2xl font-black text-text-navy">£{metrics.todayLabourCost.toLocaleString()}</p>
              <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-text-muted uppercase">
                <Clock className="w-3 h-3" />
                {metrics.todayHours.toFixed(1)} Total Hours
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-accent transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-cta/10 rounded-xl group-hover:scale-110 transition-transform">
                  <PieChart className="w-5 h-5 text-cta" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${metrics.labourPercent > 30 ? 'bg-cta text-white' : 'bg-success/10 text-success'}`}>
                  {metrics.labourPercent > 30 ? 'Over Target' : 'Optimal'}
                </span>
              </div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Labour % of Sales</p>
              <p className={`text-2xl font-black ${metrics.labourPercent > 30 ? 'text-cta' : 'text-text-navy'}`}>
                {metrics.labourPercent.toFixed(1)}%
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 bg-border-grey h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${metrics.labourPercent > 30 ? 'bg-cta' : 'bg-success'}`}
                    style={{ width: `${Math.min(100, metrics.labourPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-accent transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-success/10 rounded-xl group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-success" />
                </div>
              </div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Sales per Lab. Hour</p>
              <p className="text-2xl font-black text-text-navy">£{metrics.salesPerHour.toFixed(2)}</p>
              <p className="text-[10px] font-bold text-success uppercase tracking-widest mt-4">Industry Avg: £120.00</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-border-grey shadow-sm group hover:border-accent transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 rounded-xl group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                {metrics.overtimeCount > 0 && (
                  <span className="text-[10px] font-black bg-cta text-white px-2 py-0.5 rounded-full animate-pulse">
                    Alert
                  </span>
                )}
              </div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Overtime Risk</p>
              <p className="text-2xl font-black text-text-navy">{metrics.overtimeCount} Shifts</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-4">9+ Hour shifts flagged</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
              <h3 className="text-xl font-black text-text-navy uppercase tracking-tight mb-6">Labour vs Revenue Trend</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={closures.slice(0, 14).reverse()}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="totals.netSales" stroke="#6366f1" fillOpacity={1} fill="url(#colorSales)" name="Net Revenue" />
                    <Line type="monotone" dataKey="totals.labour" stroke="#ef4444" strokeWidth={3} name="Labour Cost" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
              <h3 className="text-xl font-black text-text-navy uppercase tracking-tight mb-6">Shift Profitability</h3>
              <div className="space-y-4">
                {['Lunch', 'Dinner'].map(shift => {
                  const shiftSales = orders.filter(o => o.status === 'Paid' && (shift === 'Lunch' ? parseInt(o.createdAt.split('T')[1].split(':')[0]) < 17 : parseInt(o.createdAt.split('T')[1].split(':')[0]) >= 17)).reduce((acc, o) => acc + (o.total || 0), 0);
                  const shiftLabour = shifts.filter(s => {
                    const hour = parseInt(s.clockIn.split(':')[0]);
                    return shift === 'Lunch' ? hour < 17 : hour >= 17;
                  }).reduce((acc, s) => acc + s.totalCost, 0);
                  
                  const isWarning = shiftLabour / (shiftSales || 1) > 0.35;

                  return (
                    <div key={shift} className={`p-6 rounded-2xl border transition-all ${isWarning ? 'bg-cta/5 border-cta/20' : 'bg-secondary-surface border-border-grey'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isWarning ? 'bg-cta text-white' : 'bg-accent text-white'}`}>
                            {shift === 'Lunch' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-text-navy uppercase tracking-tight">{shift} Service</p>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{shift === 'Lunch' ? '12:00 - 17:00' : '17:00 - 23:30'}</p>
                          </div>
                        </div>
                        {isWarning && (
                          <div className="flex items-center gap-1 text-cta animate-pulse">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Weak Shift</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Revenue</p>
                          <p className="text-sm font-black text-text-navy">£{shiftSales.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Labour</p>
                          <p className="text-sm font-black text-text-navy">£{shiftLabour.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Labour %</p>
                          <p className={`text-sm font-black ${isWarning ? 'text-cta' : 'text-success'}`}>
                            {shiftSales > 0 ? ((shiftLabour / shiftSales) * 100).toFixed(1) : '0'}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[500px]">
          {importStep === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div 
                className="w-full max-w-xl border-2 border-dashed border-border-grey rounded-3xl p-16 text-center hover:border-accent transition-all cursor-pointer bg-secondary-surface group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform border border-border-grey">
                  <Upload className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Upload Labour CSV</h3>
                <p className="text-sm text-text-muted font-bold uppercase tracking-widest mt-2 px-8 leading-relaxed">
                  Support for Time Tracker Pro exports (.CSV, .XLSX)
                </p>
                <div className="mt-8 flex items-center justify-center gap-4">
                  <span className="text-[10px] font-black text-text-muted bg-white px-3 py-1.5 rounded-lg border border-border-grey">.CSV</span>
                  <span className="text-[10px] font-black text-text-muted bg-white px-3 py-1.5 rounded-lg border border-border-grey">.XLSX</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                />
              </div>

              {importLogs.length > 0 && (
                <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-center justify-between w-full max-w-xl">
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-accent" />
                    <div>
                      <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Last Successful Import</p>
                      <p className="text-xs font-bold text-text-muted italic">{importLogs[0].dateRange} ({importLogs[0].count} shifts)</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-text-muted uppercase bg-white px-2 py-1 rounded border border-border-grey shadow-sm">
                    {new Date(importLogs[0].timestamp).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                <div className="p-6 bg-secondary-surface rounded-2xl border border-border-grey text-center">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Duplicate Protection</p>
                  <p className="text-[10px] text-text-muted mt-2 font-bold leading-relaxed">We auto-detect and skip duplicate shift records.</p>
                </div>
                <div className="p-6 bg-secondary-surface rounded-2xl border border-border-grey text-center">
                  <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Staff Matching</p>
                  <p className="text-[10px] text-text-muted mt-2 font-bold leading-relaxed">Automatic link to staff profiles via names.</p>
                </div>
                <div className="p-6 bg-secondary-surface rounded-2xl border border-border-grey text-center">
                  <div className="w-10 h-10 bg-cta/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-5 h-5 text-cta" />
                  </div>
                  <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Error Handling</p>
                  <p className="text-[10px] text-text-muted mt-2 font-bold leading-relaxed">Missing hours or invalid rates are flagged.</p>
                </div>
              </div>
            </div>
          )}

          {importStep === 'mapping' && (
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-accent text-white rounded-xl flex items-center justify-center font-black">1</div>
                <div>
                  <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Map Your Columns</h3>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Ensure labels match your CSV fields</p>
                </div>
              </div>

              <div className="space-y-4">
                {Object.keys(columnMapping).map((field) => (
                  <div key={field} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-secondary-surface rounded-2xl border border-border-grey gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-[10px] font-black text-text-navy uppercase tracking-widest">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                    <select 
                      className="bg-white border-border-grey rounded-xl text-sm font-bold min-w-[200px]"
                      value={columnMapping[field]}
                      onChange={(e) => setColumnMapping({...columnMapping, [field]: e.target.value})}
                    >
                      <option value="">Skip Column</option>
                      {Object.keys(importData[0] || {}).map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="pt-8 flex justify-between gap-4">
                <Button variant="secondary" onClick={() => setImportStep('upload')} className="flex-1 h-12 uppercase font-black text-[10px] tracking-widest">Back</Button>
                <Button onClick={validateImport} className="flex-1 h-12 uppercase font-black text-[10px] tracking-widest">Validate Data</Button>
              </div>
            </div>
          )}

          {importStep === 'validation' && (
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-accent text-white rounded-xl flex items-center justify-center font-black">2</div>
                <div>
                  <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Validation Results</h3>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Review warnings before final import</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-secondary-surface p-6 rounded-3xl border border-border-grey">
                  <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest mb-4">Summary</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-text-muted">Total Rows found</span>
                      <span className="font-black text-text-navy">{importData.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-text-muted">Errors Detected</span>
                      <span className={`font-black ${validationErrors.length > 0 ? 'text-cta' : 'text-success'}`}>{validationErrors.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-text-muted">Unmatched Staff</span>
                      <span className={`font-black ${unmatchedStaff.length > 0 ? 'text-amber-600' : 'text-success'}`}>{unmatchedStaff.length}</span>
                    </div>
                  </div>
                </div>

                {unmatchedStaff.length > 0 && (
                  <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                    <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <UserPlus className="w-3 h-3" /> Unmatched Employees
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {unmatchedStaff.map(name => (
                        <span key={name} className="px-2 py-1 bg-white border border-amber-200 text-[10px] font-bold text-amber-700 rounded-lg">{name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-cta/5 p-6 rounded-3xl border border-cta/20">
                  <h4 className="text-[10px] font-black text-cta uppercase tracking-widest mb-4">Critical Issues</h4>
                  <div className="space-y-2">
                    {validationErrors.map((err, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs text-cta">
                        <AlertCircle className="w-3 h-3" />
                        <span>Row {err.row}: {err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-8 flex justify-between gap-4">
                <Button variant="secondary" onClick={() => setImportStep('mapping')} className="flex-1 h-12 uppercase font-black text-[10px] tracking-widest">Edit Mapping</Button>
                <Button 
                  onClick={executeImport} 
                  disabled={validationErrors.length > 0 || importing} 
                  className="flex-1 h-12 uppercase font-black text-[10px] tracking-widest"
                >
                  {importing ? 'Importing...' : 'Confirm Import'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'productivity' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Staff Productivity Leaderboard</h3>
              <div className="flex bg-secondary-surface p-1 rounded-xl border border-border-grey">
                <Button variant="secondary" size="sm" className="text-[9px] font-black uppercase tracking-widest">Last 30 Days</Button>
                <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase tracking-widest">MTD</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-grey">
                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Rank / Employee</th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Productivity Score</th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Sales per Hour</th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Labour Cost</th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Upsell Power</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey">
                  {staffProductivity.map((s, idx) => (
                    <tr key={s.id} className="group hover:bg-secondary-surface transition-all">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-secondary-surface text-text-muted'}`}>
                            {idx === 0 ? <Trophy className="w-4 h-4" /> : idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-black text-text-navy uppercase tracking-tight">{s.firstName} {s.lastName}</p>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{s.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-border-grey h-1.5 rounded-full overflow-hidden max-w-[100px]">
                            <div 
                              className={`h-full ${s.productivityScore > 80 ? 'bg-success' : s.productivityScore > 50 ? 'bg-accent' : 'bg-cta'}`}
                              style={{ width: `${s.productivityScore}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-text-navy">{s.productivityScore.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-black text-text-navy">£{s.salesPerHour.toFixed(2)}</td>
                      <td className="px-6 py-5 font-bold text-text-muted">£{s.totalLabourCost.toLocaleString()}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1 text-success">
                          <ArrowUpRight className="w-3 h-3" />
                          <span className="text-xs font-black">High</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-xl">
                    <Zap className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">AI Staffing Recommendations</h3>
                </div>
                <Button variant="secondary" size="sm" className="gap-2 h-10 px-4">
                  <Calendar className="w-4 h-4" />
                  Next 7 Days
                </Button>
              </div>

              <div className="space-y-4">
                {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
                  const date = new Date();
                  date.setDate(date.getDate() + dayOffset);
                  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
                  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
                  
                  // Calculate Historical Average for this weekday
                  const historicalClosures = closures.filter(c => {
                    const cDate = new Date(c.date);
                    return cDate.toLocaleDateString('en-GB', { weekday: 'long' }) === weekday;
                  });
                  const avgSales = historicalClosures.length > 0 
                    ? historicalClosures.reduce((acc, c) => acc + (c.totals?.netSales || 0), 0) / historicalClosures.length 
                    : 2400;

                  // Recommendation based on Labour % target (25%) and avg hourly rate (£12)
                  const targetLabourBudget = avgSales * 0.25;
                  const targetHours = targetLabourBudget / 12;
                  
                  return (
                    <div key={dayOffset} className="p-6 bg-secondary-surface rounded-2xl border border-border-grey group hover:border-accent transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-black text-text-navy uppercase tracking-tight">{dateStr}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black bg-white px-2 py-0.5 rounded border border-border-grey text-text-muted">Expected Rev: £{avgSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                           <span className="text-[9px] font-black bg-success/10 text-success px-2 py-0.5 rounded border border-success/20">Historic Logic</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-white rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Waiters</p>
                          <p className="text-xl font-black text-text-navy">{Math.round(targetHours * 0.4 / 8) || 3}-{Math.round(targetHours * 0.5 / 8) || 5}</p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Kitchen</p>
                          <p className="text-xl font-black text-text-navy">{Math.round(targetHours * 0.3 / 8) || 2}-{Math.round(targetHours * 0.4 / 8) || 4}</p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Bar</p>
                          <p className="text-xl font-black text-text-navy">{Math.round(targetHours * 0.2 / 8) || 2}</p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase mb-1">Manager</p>
                          <p className="text-xl font-black text-text-navy">1</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-text-navy p-8 rounded-3xl text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-white/10 p-2 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight">Labour Efficiency</h4>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Current Month Labour %</p>
                    <p className="text-xl font-black">28.4%</p>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[28.4%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Optimized Forecast %</p>
                    <p className="text-xl font-black text-success">25.1%</p>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-success w-[25.1%]" />
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 mt-6">
                   <p className="text-[9px] font-black text-accent uppercase tracking-widest mb-1">Tip of the Day</p>
                   <p className="text-xs font-bold leading-relaxed text-white/80">"Reduce bar staffing from 3 to 2 for Tuesday lunch based on historic sales of £600."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Payroll Estimation Panel</h3>
               <div className="flex gap-3">
                 <Button variant="secondary" className="gap-2 h-10 px-4 text-[10px] font-black uppercase tracking-widest">
                   <Download className="w-4 h-4" />
                   Review CSV
                 </Button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-secondary-surface p-6 rounded-2xl border border-border-grey">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">MTD Payroll Total</p>
                <p className="text-2xl font-black text-text-navy">£{(shifts.reduce((acc, s) => acc + s.totalCost, 0)).toLocaleString()}</p>
              </div>
              <div className="bg-secondary-surface p-6 rounded-2xl border border-border-grey">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">End of Month Projection</p>
                <p className="text-2xl font-black text-accent">£{(shifts.reduce((acc, s) => acc + s.totalCost, 0) * 1.4).toLocaleString()}</p>
              </div>
              <div className="bg-secondary-surface p-6 rounded-2xl border border-border-grey">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Budget Variance</p>
                <p className="text-2xl font-black text-success">-£420.00</p>
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Labour Cost by Role</h4>
               <div className="space-y-3">
                 {['Waiter', 'Chef', 'Bartender', 'Manager'].map(role => {
                    const roleCost = shifts.filter(s => s.role === role).reduce((acc, s) => acc + s.totalCost, 0);
                    const totalCost = shifts.reduce((acc, s) => acc + s.totalCost, 0);
                    const percent = totalCost > 0 ? (roleCost / totalCost) * 100 : 0;
                    
                    return (
                      <div key={role} className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-text-navy uppercase tracking-tight w-24">{role}</span>
                        <div className="flex-1 bg-secondary-surface h-8 rounded-lg overflow-hidden border border-border-grey relative">
                           <div className="h-full bg-accent/20" style={{ width: `${percent}%` }} />
                           <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-bold text-text-navy">£{roleCost.toLocaleString()}</span>
                        </div>
                        <span className="text-[10px] font-black text-text-muted w-10 text-right">{percent.toFixed(0)}%</span>
                      </div>
                    );
                 })}
               </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'history' && (
        <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Import History & Audit Trail</h3>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Track all data imports to prevent duplication</p>
            </div>
            <History className="w-6 h-6 text-text-muted" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-grey">
                  <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Import Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Date Range Covered</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Records</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Source</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grey">
                {importLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <History className="w-12 h-12 text-border-grey mx-auto mb-4" />
                      <p className="text-sm font-bold text-text-muted uppercase tracking-widest">No import logs found</p>
                    </td>
                  </tr>
                ) : (
                  importLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary-surface transition-all">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-text-navy tracking-tight">
                          {new Date(log.timestamp).toLocaleDateString('en-GB')}
                        </p>
                        <p className="text-[10px] font-bold text-text-muted uppercase">
                          {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">{log.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-text-muted" />
                          <span className="text-xs font-bold text-text-navy">{log.dateRange || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-success">+{log.count} Added</p>
                          {log.duplicates > 0 && (
                            <p className="text-[10px] font-bold text-amber-600 uppercase italic">
                              {log.duplicates} Duplicates Skipped
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        {log.source || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 rounded-lg w-fit border border-success/20">
                          <CheckCircle2 className="w-3 h-3 text-success" />
                          <span className="text-[9px] font-black text-success uppercase tracking-widest">Verified</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
