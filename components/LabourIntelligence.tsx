
import React, { useState, useMemo, useEffect } from 'react';
import {
  Upload,
  Clock,
  ArrowUpDown,
  HardHat,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  LabourShift,
  StaffMember,
  POSOrder
} from '../types';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { TimePeriodLegend } from './TimePeriodLegend';
import { LabourImportPanel } from './LabourImportPanel';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, LOCATION_ID, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  getWeekStart,
  toDateKey,
  parseDateKey,
  getCurrentPeriod,
  getPeriodWeekStarts,
  getWeeksStartingInMonth,
  getQuarterWeekStarts
} from '../utils/fiscalCalendar';
import { sumLabourCostForWeeks } from '../services/labourImportService';

interface LabourIntelligenceProps {
  staff: StaffMember[];
  orders: POSOrder[];
}

const money = (v: number) => `£${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same rollup pattern as Operation Costs' P&L Cost Entry (components/WeeklyCostEntry.tsx):
// bucket into Monday-Sunday weeks, then sum expected week-starts for a Period/Month/Quarter.
type ViewMode = 'All Shifts' | 'Weekly' | 'Period' | 'Monthly' | 'Quarterly' | 'Custom Range';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Kept available (not wired to any UI) per the redesign brief: don't delete the underlying
// productivity calculation just because the leaderboard tab that displayed it is gone.
function useStaffProductivity(staff: StaffMember[], shifts: LabourShift[], orders: POSOrder[]) {
  return useMemo(() => {
    return staff.map(s => {
      const staffShifts = shifts.filter(sh => sh.staffId === s.id);
      const staffOrders = orders.filter(o => o.waiterId === s.id && o.status === 'Paid');
      const totalHours = staffShifts.reduce((acc, sh) => acc + sh.durationHours, 0);
      const totalSales = staffOrders.reduce((acc, o) => acc + (o.total || 0), 0);
      const totalLabourCost = staffShifts.reduce((acc, sh) => acc + sh.totalCost, 0);
      const salesPerHour = totalHours > 0 ? totalSales / totalHours : 0;
      return { ...s, totalHours, totalSales, totalLabourCost, salesPerHour };
    });
  }, [staff, shifts, orders]);
}

export const LabourIntelligence: React.FC<LabourIntelligenceProps> = ({ staff, orders }) => {
  const [view, setView] = useState<'dashboard' | 'import'>('dashboard');
  const [shifts, setShifts] = useState<LabourShift[]>([]);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch Import Logs — still needed by the Import Shifts panel (last-import summary)
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

  // Retained calculation, not currently rendered anywhere — see useStaffProductivity above.
  useStaffProductivity(staff, shifts, orders);

  // --- Filterable shift table ---
  const staffFilterOptions = useMemo(() => {
    const matched = staff.map(s => ({ key: s.id, label: `${s.firstName} ${s.lastName}` }));
    const matchedIds = new Set(staff.map(s => s.id));
    const unmatchedNames = Array.from(new Set(
      shifts.filter(s => !s.staffId || !matchedIds.has(s.staffId)).map(s => s.employeeName)
    )).sort();
    const unmatched = unmatchedNames.map(name => ({ key: `name:${name}`, label: `${name} (unmatched)` }));
    return [...matched, ...unmatched].sort((a, b) => a.label.localeCompare(b.label));
  }, [staff, shifts]);

  const [filterStaffKey, setFilterStaffKey] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [sortField, setSortField] = useState<'date' | 'totalCost'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: 'date' | 'totalCost') => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredShifts = useMemo(() => {
    const rows = shifts.filter(s => {
      if (filterStaffKey !== 'All') {
        if (filterStaffKey.startsWith('name:')) {
          if (s.employeeName !== filterStaffKey.slice(5)) return false;
        } else if (s.staffId !== filterStaffKey) {
          return false;
        }
      }
      if (filterDateFrom && s.date < filterDateFrom) return false;
      if (filterDateTo && s.date > filterDateTo) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sortField === 'totalCost') {
        return sortDir === 'asc' ? a.totalCost - b.totalCost : b.totalCost - a.totalCost;
      }
      return sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
  }, [shifts, filterStaffKey, filterDateFrom, filterDateTo, sortField, sortDir]);

  // Sum in whole pence (integers) rather than accumulating raw floats, so this can't drift
  // into the kind of summation artifact found in A1 (£52,929.788). Only converted back to a
  // decimal £ figure once, at the very end, purely for display.
  const totalCostPence = filteredShifts.reduce((acc, s) => acc + Math.round((s.totalCost || 0) * 100), 0);
  const totalCostFiltered = totalCostPence / 100;

  const hasAnyFilter = filterStaffKey !== 'All' || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => {
    setFilterStaffKey('All');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const [viewMode, setViewMode] = useState<ViewMode>('All Shifts');

  // --- Weekly breakdown (Step 1): buckets the already-safe, additive-per-shift storage into
  // Monday-Sunday weeks for viewing only — importing more shifts never touches prior weeks'
  // documents, so this is just a client-side grouping of what's already there.
  const weeklyBuckets = useMemo(() => {
    const map = new Map<string, { weekStartDate: string; weekEndDate: string; totalCostPence: number; shiftCount: number }>();
    shifts.forEach(s => {
      if (!s.date) return;
      const weekStart = getWeekStart(parseDateKey(s.date));
      const weekStartKey = toDateKey(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const pence = Math.round((s.totalCost || 0) * 100);
      const existing = map.get(weekStartKey);
      if (existing) {
        existing.totalCostPence += pence;
        existing.shiftCount += 1;
      } else {
        map.set(weekStartKey, { weekStartDate: weekStartKey, weekEndDate: toDateKey(weekEnd), totalCostPence: pence, shiftCount: 1 });
      }
    });
    return map;
  }, [shifts]);

  const weeklyBucketsSorted = useMemo(
    () => Array.from(weeklyBuckets.values()).sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate)),
    [weeklyBuckets]
  );

  // --- Period / Monthly / Quarterly rollups (Step 2) — same expected-week-starts + sum
  // pattern as Operation Costs' P&L Cost Entry, reused rather than rebuilt. ---
  const current = getCurrentPeriod();
  const [rollupFiscalYear, setRollupFiscalYear] = useState(current.fiscalYear);
  const [rollupPeriod, setRollupPeriod] = useState(current.periodNumber);
  const [rollupMonth, setRollupMonth] = useState(new Date().getMonth());
  const [rollupMonthYear, setRollupMonthYear] = useState(new Date().getFullYear());
  const [rollupQuarter, setRollupQuarter] = useState<1 | 2 | 3 | 4>(1);

  const expectedWeekStarts: Date[] = useMemo(() => {
    if (viewMode === 'Period') return getPeriodWeekStarts(rollupPeriod, rollupFiscalYear);
    if (viewMode === 'Monthly') return getWeeksStartingInMonth(rollupMonthYear, rollupMonth);
    if (viewMode === 'Quarterly') return getQuarterWeekStarts(rollupQuarter, rollupFiscalYear);
    return [];
  }, [viewMode, rollupPeriod, rollupFiscalYear, rollupMonth, rollupMonthYear, rollupQuarter]);

  const rollup = useMemo(() => {
    const weeklyPenceMap = new Map(
      Array.from(weeklyBuckets.entries()).map(([k, bucket]) => [k, bucket.totalCostPence])
    );
    return sumLabourCostForWeeks(weeklyPenceMap, expectedWeekStarts);
  }, [expectedWeekStarts, weeklyBuckets]);

  // --- Custom date range (Step 3) — sums whatever falls within the exact selected dates,
  // independent of week boundaries. Deliberately filters the flat shift list directly rather
  // than going through weeklyBuckets, so a range that splits a week only counts the days
  // actually inside it instead of snapping to full weeks. ---
  const [customStart, setCustomStart] = useState(() => toDateKey(getWeekStart(new Date())));
  const [customEnd, setCustomEnd] = useState(() => toDateKey(new Date()));

  const customRangeTotal = useMemo(() => {
    const rows = shifts.filter(s => s.date && s.date >= customStart && s.date <= customEnd);
    const pence = rows.reduce((acc, s) => acc + Math.round((s.totalCost || 0) * 100), 0);
    return { totalCost: pence / 100, shiftCount: rows.length };
  }, [shifts, customStart, customEnd]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HardHat}
        title="Labour Intelligence"
        subtitle="Shift Data Import & Cost Review"
        actions={
          view === 'import' ? (
            <Button variant="secondary" className="gap-2 h-12 px-6" onClick={() => setView('dashboard')}>
              <X className="w-4 h-4" />
              Back to Dashboard
            </Button>
          ) : (
            <Button variant="primary" className="gap-2 h-12 px-6" onClick={() => setView('import')}>
              <Upload className="w-4 h-4" />
              Import Shifts
            </Button>
          )
        }
      />

      {view === 'import' && (
        <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm min-h-[500px]">
          <LabourImportPanel
            staff={staff}
            shifts={shifts}
            importLogs={importLogs}
            onImported={() => setView('dashboard')}
          />
        </div>
      )}

      {view === 'dashboard' && (
        shifts.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-border-grey text-center">
            <HardHat className="w-10 h-10 text-border-grey mx-auto mb-4" />
            <p className="text-sm font-black text-text-navy uppercase tracking-widest">No shifts imported yet</p>
            <p className="text-xs text-text-muted font-bold mt-2">Click Import Shifts to get started.</p>
            <Button onClick={() => setView('import')} className="mt-6 h-11 px-6 text-[10px] font-black uppercase tracking-widest">
              <Upload className="w-4 h-4 mr-2" /> Import Shifts
            </Button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-border-grey shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Shift Labour Cost Review</h3>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                  Filter and total shift costs for manual entry into Financial Command's P&amp;L. Time Tracker Pro remains the source of truth for actual payroll.
                </p>
              </div>
            </div>

            {/* View mode toggle — same visual pattern as Operation Costs' P&L Cost Entry */}
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <div className="flex gap-2 flex-wrap">
                {(['All Shifts', 'Weekly', 'Period', 'Monthly', 'Quarterly', 'Custom Range'] as ViewMode[]).map(mode => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
              <TimePeriodLegend />
            </div>

            {viewMode === 'Weekly' && (
              <>
                <div className="border border-border-grey rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-secondary-surface z-10">
                        <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                          <th className="px-4 py-3">Week</th>
                          <th className="px-4 py-3">Shifts</th>
                          <th className="px-4 py-3">Total Labour Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey">
                        {weeklyBucketsSorted.map(w => (
                          <tr key={w.weekStartDate} className="hover:bg-secondary-surface/50 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{w.weekStartDate} to {w.weekEndDate}</td>
                            <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{w.shiftCount}</td>
                            <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{money(w.totalCostPence / 100)}</td>
                          </tr>
                        ))}
                        {weeklyBucketsSorted.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-12 text-center text-text-muted font-bold text-xs">
                              No weeks with imported shifts yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 bg-text-navy rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2.5 rounded-xl">
                      <Clock className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                        Total Labour Cost — All Weeks ({weeklyBucketsSorted.length} week{weeklyBucketsSorted.length !== 1 ? 's' : ''})
                      </p>
                      <p className="text-2xl font-black text-white">
                        {money(weeklyBucketsSorted.reduce((acc, w) => acc + w.totalCostPence, 0) / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {(viewMode === 'Period' || viewMode === 'Monthly' || viewMode === 'Quarterly') && (
              <>
                <div className="p-4 bg-secondary-surface rounded-2xl border border-border-grey mb-6 flex flex-wrap items-center gap-4">
                  {viewMode === 'Period' && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Period</label>
                        <select value={rollupPeriod} onChange={(e) => setRollupPeriod(Number(e.target.value))} className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                          {Array.from({ length: 13 }, (_, i) => i + 1).map(p => <option key={p} value={p}>Period {p}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fiscal Year</label>
                        <select value={rollupFiscalYear} onChange={(e) => setRollupFiscalYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                          {[current.fiscalYear - 1, current.fiscalYear, current.fiscalYear + 1].map(y => <option key={y} value={y}>FY{y}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {viewMode === 'Monthly' && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Month</label>
                        <select value={rollupMonth} onChange={(e) => setRollupMonth(Number(e.target.value))} className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                          {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Year</label>
                        <select value={rollupMonthYear} onChange={(e) => setRollupMonthYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                          {[rollupMonthYear - 1, rollupMonthYear, rollupMonthYear + 1].filter((v, i, a) => a.indexOf(v) === i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {viewMode === 'Quarterly' && (
                    <>
                      <div className="flex gap-2 p-1 bg-white rounded-xl">
                        {[1, 2, 3, 4].map(q => (
                          <Button key={q} variant={rollupQuarter === q ? 'primary' : 'ghost'} size="sm" onClick={() => setRollupQuarter(q as 1 | 2 | 3 | 4)}>
                            Q{q}
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fiscal Year</label>
                        <select value={rollupFiscalYear} onChange={(e) => setRollupFiscalYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                          {[current.fiscalYear - 1, current.fiscalYear, current.fiscalYear + 1].map(y => <option key={y} value={y}>FY{y}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {rollup.expectedCount > 0 && rollup.weeksWithData === rollup.expectedCount ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-success/10 text-success">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {rollup.weeksWithData} of {rollup.expectedCount} weeks have data
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" /> {rollup.weeksWithData} of {rollup.expectedCount} weeks have data
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-text-navy rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
                  <div>
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                      Total Labour Cost — {viewMode} {viewMode === 'Period' ? `${rollupPeriod}, FY${rollupFiscalYear}` : viewMode === 'Monthly' ? `${MONTH_NAMES[rollupMonth]} ${rollupMonthYear}` : `Q${rollupQuarter}, FY${rollupFiscalYear}`}
                    </p>
                    <p className="text-3xl font-black text-white">{money(rollup.totalCost)}</p>
                  </div>
                </div>
              </>
            )}

            {viewMode === 'Custom Range' && (
              <>
                <div className="p-4 bg-secondary-surface rounded-2xl border border-border-grey mb-6 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">From</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => e.target.value && setCustomStart(e.target.value)}
                      className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
                      className="px-3 py-2 bg-white border border-border-grey rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="p-6 bg-text-navy rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
                  <div>
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                      Total Labour Cost — {customStart} to {customEnd} ({customRangeTotal.shiftCount} shift{customRangeTotal.shiftCount !== 1 ? 's' : ''})
                    </p>
                    <p className="text-3xl font-black text-white">{money(customRangeTotal.totalCost)}</p>
                  </div>
                </div>
              </>
            )}

            {viewMode === 'All Shifts' && (
            <>
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-secondary-surface rounded-2xl border border-border-grey">
              <div>
                <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">Name</label>
                <select
                  value={filterStaffKey}
                  onChange={(e) => setFilterStaffKey(e.target.value)}
                  className="w-full bg-white border border-border-grey rounded-xl text-xs font-bold px-3 py-2.5"
                >
                  <option value="All">All Staff</option>
                  {staffFilterOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">Day (From)</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full bg-white border border-border-grey rounded-xl text-xs font-bold px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">Day (To)</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full bg-white border border-border-grey rounded-xl text-xs font-bold px-3 py-2.5"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  disabled={!hasAnyFilter}
                  className="h-[38px] w-full text-[10px] font-black uppercase tracking-widest rounded-xl border border-border-grey text-text-muted hover:text-text-navy hover:border-text-navy transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-border-grey rounded-2xl overflow-hidden">
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-secondary-surface z-10">
                    <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">
                        <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-text-navy">
                          Day <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Hours Scheduled</th>
                      <th className="px-4 py-3">Hourly Wage</th>
                      <th className="px-4 py-3">
                        <button onClick={() => toggleSort('totalCost')} className="flex items-center gap-1 hover:text-text-navy">
                          Total Cost <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-grey">
                    {filteredShifts.map(s => (
                      <tr key={s.id} className="hover:bg-secondary-surface/50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">
                          {s.employeeName}
                          {!s.staffId && <span className="ml-2 text-[9px] font-bold text-amber-600 uppercase">Unmatched</span>}
                        </td>
                        <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{s.date}</td>
                        <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{s.role}</td>
                        <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{s.durationHours.toFixed(2)}h</td>
                        <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{money(s.wageRate)}</td>
                        <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{money(s.totalCost)}</td>
                      </tr>
                    ))}
                    {filteredShifts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-text-muted font-bold text-xs">
                          No shifts match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sum total */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 bg-text-navy rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2.5 rounded-xl">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                    Total Labour Cost (Filtered) — {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-2xl font-black text-white">{money(totalCostFiltered)}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest max-w-xs sm:text-right">
                Enter this figure manually into Financial Command's P&amp;L labour line.
              </p>
            </div>
            </>
            )}
          </div>
        )
      )}
    </div>
  );
};
