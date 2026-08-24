
import React, { useState, useMemo, useEffect } from 'react';
import {
  Upload,
  Clock,
  ArrowUpDown,
  HardHat,
  X,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Send,
  Loader2,
  Building2,
  ChevronRight
} from 'lucide-react';
import {
  LabourShift,
  StaffMember,
  POSOrder,
  DailyClosure,
  ExpenseRecord,
  WasteRecord,
  StockCountRecord,
  PayrollAccrualRecord,
  PayrollCentreWeekRecord
} from '../types';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { TimePeriodLegend } from './TimePeriodLegend';
import { LabourImportPanel } from './LabourImportPanel';
import { LabourShiftDrilldown } from './LabourShiftDrilldown';
import { collection, onSnapshot, query, where, orderBy, doc, setDoc } from 'firebase/firestore';
import { db, LOCATION_ID, auth, handleFirestoreError, OperationType, cleanObject } from '../firebase';
import {
  getWeekStart,
  toDateKey,
  parseDateKey,
  getCurrentPeriod,
  getPeriodRange,
  getPeriodWeekStarts,
  getWeeksStartingInMonth,
  getQuarterWeekStarts
} from '../utils/fiscalCalendar';
import {
  sumLabourCostForWeeks,
  filterShiftsForCost,
  normalizeDepartment,
  mergeRealPayrollData,
  sumPayrollCentreForPeriod
} from '../services/labourImportService';
import { computePnl } from '../services/pnlEngine';
import { pushLabourReviewToWeeklyCostEntries } from '../services/weeklyCostEntryService';
import { toast } from 'sonner';

interface LabourIntelligenceProps {
  staff: StaffMember[];
  orders: POSOrder[];
  closures: DailyClosure[];
  liveSalesData: { history: any[]; aggregate: any };
  expenseRecords: ExpenseRecord[];
  wasteRecords: WasteRecord[];
  stockCountRecords: StockCountRecord[];
}

const money = (v: number) => `£${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same rollup pattern as Operation Costs' P&L Cost Entry (components/WeeklyCostEntry.tsx):
// bucket into Monday-Sunday weeks, then sum expected week-starts for a Period/Month/Quarter.
type ViewMode = 'All Shifts' | 'Weekly' | 'Period' | 'Monthly' | 'Quarterly' | 'Custom Range';
// Tab order — the time-bucket tabs are the primary entry point (drill down into a bucket to see
// its shifts); "All Shifts" is the flat, ungrouped view and deliberately listed last since it's
// no longer the default landing view.
const VIEW_MODES: ViewMode[] = ['Weekly', 'Period', 'Monthly', 'Quarterly', 'Custom Range', 'All Shifts'];
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

export const LabourIntelligence: React.FC<LabourIntelligenceProps> = ({ staff, orders, closures, liveSalesData, expenseRecords, wasteRecords, stockCountRecords }) => {
  const [view, setView] = useState<'dashboard' | 'import'>('dashboard');
  const [shifts, setShifts] = useState<LabourShift[]>([]);
  const [payrollCentreRecords, setPayrollCentreRecords] = useState<PayrollCentreWeekRecord[]>([]);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // annualSalary lives in the separate manager-only staffSecrets collection now
  // (see types.ts StaffSecret) - fetched here rather than off StaffMember directly.
  const [annualSalaryByStaffId, setAnnualSalaryByStaffId] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(collection(db, 'staffSecrets'), (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.docs.forEach(d => { map[d.id] = d.data().annualSalary || 0; });
      setAnnualSalaryByStaffId(map);
    }, (err) => { handleFirestoreError(err, OperationType.LIST, 'staffSecrets'); });
  }, []);

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

  // Real-time Payroll Centre (real weekly payroll) subscription — real data always wins over
  // the Rota-based estimate for any week it covers, see costEligibleShifts below.
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'payrollCentreWeeks'),
      where('locationId', '==', LOCATION_ID)
    );

    return onSnapshot(q, (snapshot) => {
      setPayrollCentreRecords(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PayrollCentreWeekRecord)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'payrollCentreWeeks');
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

  const [viewMode, setViewMode] = useState<ViewMode>('Weekly');

  // Drill-down: set when a specific week/period/etc. bucket is clicked, showing that bucket's
  // individual shifts instead of the summary. Cleared whenever the tab changes.
  const [drilldownRange, setDrilldownRange] = useState<{ label: string; start: string; end: string } | null>(null);
  const selectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setDrilldownRange(null);
  };

  // Salaried staff's real cost is a fixed salary, not hours x rate — their shifts are excluded
  // from every automated Wages/cost total below (Weekly/Period/Monthly/Quarterly/Custom Range),
  // matching what feeds services/pnlEngine.ts and the Dashboard's labour cost card. The raw
  // "All Shifts" table further down deliberately keeps using the unfiltered `shifts`/
  // `filteredShifts` so hours/attendance tracking for Salaried staff is completely unaffected.
  //
  // Real Payroll Centre data then wins over that estimate for any week it covers (see
  // mergeRealPayrollData()) — a week with real payroll figures no longer uses hours x rate
  // (or the Salaried exclusion) at all, regardless of employment type, since the real figure
  // IS the true cost. Weeks with no Payroll Centre import yet keep using the live estimate.
  const costEligibleShifts = useMemo(
    () => mergeRealPayrollData(filterShiftsForCost(shifts, staff), payrollCentreRecords),
    [shifts, staff, payrollCentreRecords]
  );

  // --- Weekly breakdown (Step 1): buckets the already-safe, additive-per-shift storage into
  // Monday-Sunday weeks for viewing only — importing more shifts never touches prior weeks'
  // documents, so this is just a client-side grouping of what's already there.
  const weeklyBuckets = useMemo(() => {
    const map = new Map<string, { weekStartDate: string; weekEndDate: string; totalCostPence: number; shiftCount: number }>();
    costEligibleShifts.forEach(s => {
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
  }, [costEligibleShifts]);

  const weeklyBucketsSorted = useMemo(
    () => Array.from(weeklyBuckets.values()).sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate)),
    [weeklyBuckets]
  );

  // Shift-level detail for whichever bucket was drilled into (see drilldownRange above) — same
  // cost-eligible shift set the bucket totals themselves are built from, so the drilled-in
  // shifts always add up to the summary figure the user clicked through from.
  const drilldownShifts = useMemo(() => {
    if (!drilldownRange) return [];
    return costEligibleShifts
      .filter(s => s.date && s.date >= drilldownRange.start && s.date <= drilldownRange.end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [costEligibleShifts, drilldownRange]);

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
    const rows = costEligibleShifts.filter(s => s.date && s.date >= customStart && s.date <= customEnd);
    const pence = rows.reduce((acc, s) => acc + Math.round((s.totalCost || 0) * 100), 0);
    return { totalCost: pence / 100, shiftCount: rows.length };
  }, [costEligibleShifts, customStart, customEnd]);

  // ==================== REVIEW: Wages / Salaries / Department split / Bonus ====================
  // Only meaningful for the Period view (Push to P&L writes to specific weeks of one Period),
  // gated in the UI on the same "X of 4 weeks have data" completeness check as `rollup` above.
  const [showReview, setShowReview] = useState(false);
  const [pushingToPnl, setPushingToPnl] = useState(false);

  const periodReview = useMemo(() => {
    const range = getPeriodRange(rollupPeriod, rollupFiscalYear);
    const startKey = toDateKey(range.start);
    const endKey = toDateKey(range.end);

    // Wages — costEligibleShifts already: (1) excludes Salaried staff's ESTIMATE shifts, then
    // (2) for any week with a real Payroll Centre import, replaces that week's figure with
    // real Basic Wages for EVERY employee in the import regardless of employment type (real
    // payroll doesn't distinguish Hourly/Salaried — see mergeRealPayrollData()). So for a
    // Period with real data, this figure can include Salaried employees' real pay too, not
    // just Hourly's estimate — the UI label reflects that nuance rather than saying
    // "Hourly only" unconditionally. Department is normalized (see normalizeDepartment()) so
    // raw TTP text like "Foh"/"Kitchen" collapses onto Settings' canonical department list —
    // stored data is untouched, this is purely a grouping key for display here.
    const periodCostShifts = costEligibleShifts.filter(s => s.date && s.date >= startKey && s.date <= endKey);
    const wagesByDept = new Map<string, number>();
    periodCostShifts.forEach(s => {
      const key = normalizeDepartment(s.department);
      wagesByDept.set(key, (wagesByDept.get(key) || 0) + (s.totalCost || 0));
    });
    const wages = periodCostShifts.reduce((acc, s) => acc + (s.totalCost || 0), 0);
    const wagesIncludesRealData = periodCostShifts.some(s => s.source && s.source.includes('Payroll Centre'));

    // Salaries — same real-data-wins-per-week rule as Wages above, applied per employee per
    // week so the two figures never overlap: for each Salaried employee, for each of this
    // Period's 4 weeks, a week with real Payroll Centre data covering them contributes £0
    // (their real cost for that week is already inside Wages via costEligibleShifts) — only
    // weeks with NO real data yet contribute their prorated share (annualSalary / 13 Periods
    // / 4 weeks). Once every week of a Period has real data for an employee, their
    // contribution here is structurally £0 — not just numerically coincidental. Grouped by
    // the SAME normalizeDepartment() as Wages, so e.g. a shift department of "Foh" and a
    // StaffMember.department of "Front of the house" merge into one row instead of two.
    const periodWeekStartKeys = getPeriodWeekStarts(rollupPeriod, rollupFiscalYear).map(toDateKey);
    const salariedStaff = staff.filter(s => s.employmentType === 'Salaried');
    const salariesByDept = new Map<string, number>();
    let salaries = 0;
    salariedStaff.forEach(s => {
      const weeklyShare = (annualSalaryByStaffId[s.id] || 0) / 13 / periodWeekStartKeys.length;
      const gapWeeks = periodWeekStartKeys.filter(
        weekKey => !payrollCentreRecords.some(r => r.staffId === s.id && r.weekStartDate === weekKey)
      );
      const employeeSalaryForPeriod = weeklyShare * gapWeeks.length;
      salaries += employeeSalaryForPeriod;
      const key = normalizeDepartment(s.department);
      salariesByDept.set(key, (salariesByDept.get(key) || 0) + employeeSalaryForPeriod);
    });

    // Bonus — 1% of this Period's Net Profit, computed BEFORE the bonus is added anywhere
    // (Salaries/Bonus aren't wired into pnlEngine at all yet — see WeeklyCostEntry.tsx — so
    // netProfit here is already "before bonus" with no extra step needed). Floored at 0: a
    // loss-making Period can't sensibly produce a negative bonus.
    const periodPnl = computePnl({
      range,
      posOrders: liveSalesData.history,
      closures,
      labourShifts: costEligibleShifts,
      expenseRecords,
      wasteRecords,
      stockCountRecords
    });
    const bonus = Math.max(0, periodPnl.netProfit * 0.01);

    const departments = Array.from(new Set([...wagesByDept.keys(), ...salariesByDept.keys()]))
      .sort((a, b) => (a === 'Not Chosen' ? 1 : b === 'Not Chosen' ? -1 : a.localeCompare(b)));

    return {
      range, wages, salaries, bonus, netProfitBeforeBonus: periodPnl.netProfit,
      wagesByDept, salariesByDept, departments, salariedStaff, wagesIncludesRealData
    };
  }, [rollupPeriod, rollupFiscalYear, costEligibleShifts, staff, liveSalesData, closures, expenseRecords, wasteRecords, stockCountRecords]);

  const handlePushToPnl = async () => {
    setPushingToPnl(true);
    try {
      const weekStarts = getPeriodWeekStarts(rollupPeriod, rollupFiscalYear);
      await pushLabourReviewToWeeklyCostEntries(weekStarts, {
        salaries: periodReview.salaries,
        bonuses: periodReview.bonus
      });
      toast.success(`Pushed Salaries (${money(periodReview.salaries)}) and Bonus (${money(periodReview.bonus)}) to P&L for Period ${rollupPeriod}, FY${rollupFiscalYear}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'weeklyCostEntries');
      toast.error('Failed to push to P&L. Please try again.');
    } finally {
      setPushingToPnl(false);
    }
  };

  // ==================== NI / Pension / Holiday Accrual — structure only ====================
  // Per-employee figures for the reviewed Period, manually entered (a real payroll import is
  // future work — see types.ts's PayrollAccrualRecord). This section only stores what's typed
  // in and sums it by department + an "All" total; it never calculates NI/pension/holiday from
  // salary or hours itself.
  const [accrualRecords, setAccrualRecords] = useState<PayrollAccrualRecord[]>([]);
  const [accrualDraft, setAccrualDraft] = useState<Record<string, { ni: number; pension: number; holidayAccrual: number }>>({});
  const [savingAccruals, setSavingAccruals] = useState(false);

  useEffect(() => {
    if (!auth.currentUser || !showReview) return;
    const q = query(
      collection(db, 'payrollAccruals'),
      where('locationId', '==', LOCATION_ID),
      where('periodNumber', '==', rollupPeriod),
      where('fiscalYear', '==', rollupFiscalYear)
    );
    return onSnapshot(q, (snap) => {
      setAccrualRecords(snap.docs.map(d => ({ ...d.data(), id: d.id } as PayrollAccrualRecord)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'payrollAccruals'));
  }, [showReview, rollupPeriod, rollupFiscalYear]);

  // Real Payroll Centre data always wins here too, same principle as Wages: if real Employer
  // NI/Pension/Holiday Accrual figures exist for any of this Period's weeks, they replace
  // whatever's manually saved for that employee (self-correcting — even a stray manual edit
  // gets overwritten by real data again next time this effect runs). Manual entry remains the
  // fallback for employees/periods with no real data yet. `accrualSource` drives the read-only
  // badge/disabled state in the table below so it's never ambiguous which rows are real.
  const [accrualSource, setAccrualSource] = useState<Record<string, 'real' | 'manual'>>({});
  const [accrualRealWeeksCovered, setAccrualRealWeeksCovered] = useState<Record<string, number>>({});

  useEffect(() => {
    const periodWeekKeys = getPeriodWeekStarts(rollupPeriod, rollupFiscalYear).map(toDateKey);
    const next: Record<string, { ni: number; pension: number; holidayAccrual: number }> = {};
    const nextSource: Record<string, 'real' | 'manual'> = {};
    const nextWeeksCovered: Record<string, number> = {};
    staff.forEach(s => {
      const real = sumPayrollCentreForPeriod(payrollCentreRecords, s.id, periodWeekKeys);
      if (real) {
        next[s.id] = { ni: real.ni, pension: real.pension, holidayAccrual: real.holidayAccrual };
        nextSource[s.id] = 'real';
        nextWeeksCovered[s.id] = real.weeksCovered;
      } else {
        const existing = accrualRecords.find(r => r.staffId === s.id);
        next[s.id] = {
          ni: existing?.ni || 0,
          pension: existing?.pension || 0,
          holidayAccrual: existing?.holidayAccrual || 0
        };
        nextSource[s.id] = 'manual';
      }
    });
    setAccrualDraft(next);
    setAccrualSource(nextSource);
    setAccrualRealWeeksCovered(nextWeeksCovered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollupPeriod, rollupFiscalYear, staff.length, payrollCentreRecords]);

  const accrualRollup = useMemo(() => {
    const byDept = new Map<string, { ni: number; pension: number; holidayAccrual: number }>();
    let all = { ni: 0, pension: 0, holidayAccrual: 0 };
    staff.forEach(s => {
      const draft = accrualDraft[s.id];
      if (!draft) return;
      const key = normalizeDepartment(s.department);
      const existing = byDept.get(key) || { ni: 0, pension: 0, holidayAccrual: 0 };
      byDept.set(key, {
        ni: existing.ni + draft.ni,
        pension: existing.pension + draft.pension,
        holidayAccrual: existing.holidayAccrual + draft.holidayAccrual
      });
      all = { ni: all.ni + draft.ni, pension: all.pension + draft.pension, holidayAccrual: all.holidayAccrual + draft.holidayAccrual };
    });
    return { byDept, all };
  }, [staff, accrualDraft]);

  const handleSaveAccruals = async () => {
    setSavingAccruals(true);
    try {
      // Only persist MANUAL entries — real-sourced rows are disabled in the UI and derived
      // fresh from payrollCentreWeeks every time (see the reset effect above), so writing
      // them here too would just be a redundant, potentially stale copy.
      await Promise.all(staff.filter(s => accrualSource[s.id] !== 'real').map(s => {
        const draft = accrualDraft[s.id];
        if (!draft) return Promise.resolve();
        const id = `${LOCATION_ID}-${s.id}-P${rollupPeriod}-FY${rollupFiscalYear}`;
        const payload: PayrollAccrualRecord = {
          id,
          locationId: LOCATION_ID,
          staffId: s.id,
          employeeName: `${s.firstName} ${s.lastName}`.trim(),
          department: s.department || null,
          periodNumber: rollupPeriod,
          fiscalYear: rollupFiscalYear,
          ni: draft.ni,
          pension: draft.pension,
          holidayAccrual: draft.holidayAccrual,
          lastUpdated: new Date().toISOString()
        };
        return setDoc(doc(db, 'payrollAccruals', id), cleanObject(payload), { merge: true });
      }));
      toast.success('Saved NI / Pension / Holiday Accrual figures');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'payrollAccruals');
      toast.error('Failed to save accrual figures. Please try again.');
    } finally {
      setSavingAccruals(false);
    }
  };

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
            payrollCentreRecords={payrollCentreRecords}
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
                {VIEW_MODES.map(mode => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => selectViewMode(mode)}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
              <TimePeriodLegend />
            </div>

            {drilldownRange ? (
              <LabourShiftDrilldown
                label={drilldownRange.label}
                shifts={drilldownShifts}
                payrollCentreRecords={payrollCentreRecords}
                onBack={() => setDrilldownRange(null)}
              />
            ) : (
            <>
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
                          <th className="px-4 py-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey">
                        {weeklyBucketsSorted.map(w => (
                          <tr
                            key={w.weekStartDate}
                            onClick={() => setDrilldownRange({ label: `Week ${w.weekStartDate} to ${w.weekEndDate}`, start: w.weekStartDate, end: w.weekEndDate })}
                            className="hover:bg-secondary-surface/50 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{w.weekStartDate} to {w.weekEndDate}</td>
                            <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{w.shiftCount}</td>
                            <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{money(w.totalCostPence / 100)}</td>
                            <td className="px-4 py-2.5 text-text-muted"><ChevronRight className="w-3.5 h-3.5" /></td>
                          </tr>
                        ))}
                        {weeklyBucketsSorted.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center text-text-muted font-bold text-xs">
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
                    {viewMode === 'Period' && rollup.expectedCount > 0 && rollup.weeksWithData === rollup.expectedCount && (
                      <Button variant={showReview ? 'secondary' : 'primary'} size="sm" className="gap-1.5" onClick={() => setShowReview(v => !v)}>
                        <ClipboardList className="w-3.5 h-3.5" />
                        {showReview ? 'Hide Review' : 'Review'}
                      </Button>
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
                  {/* Prominent, top-level Push to P&L — previously only reachable by opening
                      Review and scrolling to the bottom of that sub-panel, which made it hard
                      to find. Shown as soon as the Period is review-ready, not gated on Review
                      being open. */}
                  {viewMode === 'Period' && rollup.expectedCount > 0 && rollup.weeksWithData === rollup.expectedCount && (
                    <Button variant="primary" className="gap-2 shrink-0" onClick={handlePushToPnl} disabled={pushingToPnl}>
                      {pushingToPnl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {pushingToPnl ? 'Pushing...' : 'Push to P&L'}
                    </Button>
                  )}
                </div>

                {/* Constituent weeks — the "summary for this bucket"; click a week to drill into
                    its individual shifts. */}
                {expectedWeekStarts.length > 0 && (
                  <div className="mt-6 border border-border-grey rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary-surface">
                        <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                          <th className="px-4 py-3">Week</th>
                          <th className="px-4 py-3">Shifts</th>
                          <th className="px-4 py-3">Total Labour Cost</th>
                          <th className="px-4 py-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-grey">
                        {expectedWeekStarts.map(weekStart => {
                          const weekStartKey = toDateKey(weekStart);
                          const bucket = weeklyBuckets.get(weekStartKey);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          const weekEndKey = toDateKey(weekEnd);
                          return (
                            <tr
                              key={weekStartKey}
                              onClick={() => setDrilldownRange({ label: `Week ${weekStartKey} to ${weekEndKey}`, start: weekStartKey, end: weekEndKey })}
                              className="hover:bg-secondary-surface/50 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{weekStartKey} to {weekEndKey}</td>
                              <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{bucket ? bucket.shiftCount : 0}</td>
                              <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">
                                {bucket ? money(bucket.totalCostPence / 100) : <span className="text-text-muted font-bold italic">No data yet</span>}
                              </td>
                              <td className="px-4 py-2.5 text-text-muted"><ChevronRight className="w-3.5 h-3.5" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {viewMode === 'Period' && showReview && rollup.expectedCount > 0 && rollup.weeksWithData === rollup.expectedCount && (
                  <div className="mt-6 space-y-4">
                    <div className="p-6 bg-card-bg rounded-2xl border border-border-grey shadow-sm">
                      <h4 className="text-sm font-black text-text-navy uppercase tracking-wide mb-4">
                        Period {rollupPeriod}, FY{rollupFiscalYear} — Review
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                            Wages ({periodReview.wagesIncludesRealData ? 'real payroll where imported' : 'Hourly staff, estimated'})
                          </p>
                          <p className="text-xl font-black text-text-navy mt-1">{money(periodReview.wages)}</p>
                          <p className="text-[9px] text-text-muted font-bold mt-1">
                            Feeds P&amp;L automatically — not pushed manually{periodReview.wagesIncludesRealData ? '. Includes real pay for any Salaried staff covered by a Payroll Centre import this Period.' : ''}
                          </p>
                        </div>
                        <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Salaries ({periodReview.salariedStaff.length} staff, prorated estimate)</p>
                          <p className="text-xl font-black text-text-navy mt-1">{money(periodReview.salaries)}</p>
                          <p className="text-[9px] text-text-muted font-bold mt-1">
                            Only covers weeks without confirmed payroll data for each employee — shrinks automatically as Payroll Centre imports arrive, and reaches £0 once this Period is fully covered.
                          </p>
                        </div>
                        <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Bonus (1% of Net Profit before bonus)</p>
                          <p className="text-xl font-black text-text-navy mt-1">{money(periodReview.bonus)}</p>
                          <p className="text-[9px] text-text-muted font-bold mt-1">Net Profit before bonus: {money(periodReview.netProfitBeforeBonus)}</p>
                        </div>
                      </div>

                      <div className="border border-border-grey rounded-2xl overflow-hidden mb-6">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-secondary-surface">
                            <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                              <th className="px-4 py-3 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Department</th>
                              <th className="px-4 py-3">Wages</th>
                              <th className="px-4 py-3">Salaries</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-grey">
                            {periodReview.departments.map(dept => (
                              <tr key={dept}>
                                <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{dept}</td>
                                <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{money(periodReview.wagesByDept.get(dept) || 0)}</td>
                                <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{money(periodReview.salariesByDept.get(dept) || 0)}</td>
                              </tr>
                            ))}
                            {periodReview.departments.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-text-muted font-bold text-xs">
                                  No Wages or Salaries recorded for this Period yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-main-bg rounded-2xl border border-border-grey">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide max-w-md">
                          Pushes Salaries and Bonus to Operation Costs' P&amp;L Cost Entry, split evenly across this Period's 4 weeks. Wages is not pushed — it already flows automatically.
                        </p>
                        <Button variant="primary" className="gap-2" onClick={handlePushToPnl} disabled={pushingToPnl}>
                          {pushingToPnl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {pushingToPnl ? 'Pushing...' : 'Push to P&L'}
                        </Button>
                      </div>
                    </div>

                    <div className="p-6 bg-card-bg rounded-2xl border border-border-grey shadow-sm">
                      <h4 className="text-sm font-black text-text-navy uppercase tracking-wide mb-1">NI / Pension / Holiday Accrual</h4>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-4 normal-case">
                        Real figures from Payroll Centre imports fill in automatically (locked — see the "Real" badge) and always
                        win over manual entry. Employees with no Payroll Centre data yet still take manual entry, from a real payroll
                        system, until that import exists.
                      </p>
                      <div className="border border-border-grey rounded-2xl overflow-hidden mb-4">
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-secondary-surface z-10">
                              <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Department</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">NI (£)</th>
                                <th className="px-4 py-3">Pension (£)</th>
                                <th className="px-4 py-3">Holiday Accrual (£)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-grey">
                              {staff.filter(s => s.active).map(s => {
                                const isReal = accrualSource[s.id] === 'real';
                                return (
                                <tr key={s.id}>
                                  <td className="px-4 py-2 font-bold text-text-navy whitespace-nowrap">{s.firstName} {s.lastName}</td>
                                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{normalizeDepartment(s.department)}</td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {isReal ? (
                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-success/10 text-success" title={`From ${accrualRealWeeksCovered[s.id] || 0} week(s) of real Payroll Centre data`}>
                                        Real ({accrualRealWeeksCovered[s.id] || 0}/4 wks)
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-secondary-surface text-text-muted">Manual</span>
                                    )}
                                  </td>
                                  {(['ni', 'pension', 'holidayAccrual'] as const).map(field => (
                                    <td key={field} className="px-4 py-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        disabled={isReal}
                                        value={accrualDraft[s.id]?.[field] === 0 ? '' : accrualDraft[s.id]?.[field] ?? ''}
                                        onChange={(e) => {
                                          const num = e.target.value === '' ? 0 : Number(e.target.value);
                                          setAccrualDraft(prev => ({
                                            ...prev,
                                            [s.id]: { ...(prev[s.id] || { ni: 0, pension: 0, holidayAccrual: 0 }), [field]: isNaN(num) ? 0 : num }
                                          }));
                                        }}
                                        placeholder="0.00"
                                        className="w-24 bg-secondary-surface border-none rounded-md text-xs px-2 py-1 focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="border border-border-grey rounded-2xl overflow-hidden mb-4">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-secondary-surface">
                            <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                              <th className="px-4 py-3">Rollup</th>
                              <th className="px-4 py-3">NI</th>
                              <th className="px-4 py-3">Pension</th>
                              <th className="px-4 py-3">Holiday Accrual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-grey">
                            {Array.from(accrualRollup.byDept.entries()).map(([dept, totals]) => (
                              <tr key={dept}>
                                <td className="px-4 py-2 font-bold text-text-navy whitespace-nowrap">{dept}</td>
                                <td className="px-4 py-2 text-text-muted whitespace-nowrap">{money(totals.ni)}</td>
                                <td className="px-4 py-2 text-text-muted whitespace-nowrap">{money(totals.pension)}</td>
                                <td className="px-4 py-2 text-text-muted whitespace-nowrap">{money(totals.holidayAccrual)}</td>
                              </tr>
                            ))}
                            <tr className="bg-secondary-surface/50">
                              <td className="px-4 py-2 font-black text-text-navy whitespace-nowrap">All</td>
                              <td className="px-4 py-2 font-black text-text-navy whitespace-nowrap">{money(accrualRollup.all.ni)}</td>
                              <td className="px-4 py-2 font-black text-text-navy whitespace-nowrap">{money(accrualRollup.all.pension)}</td>
                              <td className="px-4 py-2 font-black text-text-navy whitespace-nowrap">{money(accrualRollup.all.holidayAccrual)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end">
                        <Button variant="primary" className="gap-2" onClick={handleSaveAccruals} disabled={savingAccruals}>
                          {savingAccruals ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          {savingAccruals ? 'Saving...' : 'Save Accrual Figures'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
                  <Button
                    variant="secondary"
                    className="gap-2 shrink-0"
                    onClick={() => setDrilldownRange({ label: `${customStart} to ${customEnd}`, start: customStart, end: customEnd })}
                    disabled={customRangeTotal.shiftCount === 0}
                  >
                    View Individual Shifts <ChevronRight className="w-4 h-4" />
                  </Button>
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
            </>
            )}
          </div>
        )
      )}
    </div>
  );
};
