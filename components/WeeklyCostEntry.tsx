import React, { useEffect, useMemo, useState } from 'react';
import { Save, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db, LOCATION_ID, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { Button } from './Button';
import { WeeklyCostEntry as WeeklyCostEntryDoc } from '../types';
import {
  getWeekStart,
  getCurrentPeriod,
  getPeriodWeekStarts,
  getWeeksStartingInMonth,
  getQuarterWeekStarts,
  toDateKey
} from '../utils/fiscalCalendar';

// Deliberately excludes Restaurant sales, Deliveroo sales, Cost of Sales/COGS, and Wages —
// those are automated elsewhere (POS, recipe costing, Labour Import) and must never be
// manually re-entered here. This tab is data capture + rollup display only — it is NOT wired
// into services/pnlEngine.ts or Financial Command's P&L in this pass; that's a separate
// follow-up. Entry granularity is WEEKLY (Mon-Sun); Period/Monthly/Quarterly views are
// read-only sums of the underlying weekly documents, computed client-side.
interface CostGroup {
  title: string;
  note?: string;
  items: { key: keyof NumericFields; label: string }[];
}

type NumericFields = Omit<WeeklyCostEntryDoc, 'id' | 'locationId' | 'weekId' | 'weekStartDate' | 'weekEndDate' | 'lastUpdated'>;

const GROUPS: CostGroup[] = [
  {
    title: 'Labour',
    note: 'Partial — Wages is automated via Labour Import and excluded here',
    items: [
      { key: 'salaries', label: 'Salaries' },
      { key: 'otherRota', label: 'Other rota' },
      { key: 'bonuses', label: 'Bonuses' },
      { key: 'statutoryPaymentsAndPensions', label: 'Statutory payments & pensions' },
      { key: 'uniforms', label: 'Uniforms' },
      { key: 'staffRecruitment', label: 'Staff recruitment' },
      { key: 'staffFood', label: 'Staff food' },
      { key: 'staffWelfareAndTravel', label: 'Staff welfare and travel' }
    ]
  },
  {
    title: 'Cleaning Costs',
    items: [
      { key: 'cleaningProducts', label: 'Cleaning products' },
      { key: 'tradeRefuse', label: 'Trade refuse' },
      { key: 'contractCleaning', label: 'Contract cleaning' },
      { key: 'laundry', label: 'Laundry' }
    ]
  },
  {
    title: 'Delivery Costs',
    items: [
      { key: 'takeAwayPackaging', label: 'Take away packaging' },
      { key: 'deliverooCharges', label: 'Deliveroo charges' }
    ]
  },
  {
    title: 'Disposables',
    items: [
      { key: 'replacementEquipmentAndCrockery', label: 'Replacement equipment and crockery' },
      { key: 'menusFoodAndCocktail', label: 'Menus - food & cocktail' },
      { key: 'stickersLabelsAndTillRolls', label: 'Stickers, labels and till rolls' },
      { key: 'postageAndStationery', label: 'Postage & stationery' },
      { key: 'sauces', label: 'Sauces' },
      { key: 'plantsAndDecoration', label: 'Plants & decoration' },
      { key: 'deliveryCharges', label: 'Delivery charges' }
    ]
  },
  {
    title: 'Utilities',
    items: [
      { key: 'telephoneItAndEpos', label: 'Telephone, IT & EPOS' },
      { key: 'music', label: 'Music' },
      { key: 'maintenanceContracts', label: 'Maintenance contracts' },
      { key: 'repairsAndMaintenance', label: 'Repairs & maintenance' },
      { key: 'electricity', label: 'Electricity' },
      { key: 'gas', label: 'Gas' },
      { key: 'water', label: 'Water' }
    ]
  },
  {
    title: 'Admin',
    items: [
      { key: 'centralSupportAdminAndVouchers', label: 'Central support admin & vouchers' },
      { key: 'bankingDifferences', label: 'Banking differences' },
      { key: 'sundryCosts', label: 'Sundry costs' }
    ]
  },
  {
    title: 'Variable Costs',
    items: [
      { key: 'advertisingAndPromotions', label: 'Advertising & promotions' },
      { key: 'staffTraining', label: 'Staff training' },
      { key: 'mysteryDiner', label: 'Mystery diner' },
      { key: 'bankCharges', label: 'Bank charges' },
      { key: 'creditCardCharges', label: 'Credit card charges' },
      { key: 'healthAndSafety', label: 'Health & safety' }
    ]
  },
  {
    title: 'Fixed Costs',
    items: [
      { key: 'rent', label: 'Rent' },
      { key: 'turnoverRent', label: 'Turnover rent' },
      { key: 'serviceCharge', label: 'Service charge' },
      { key: 'rates', label: 'Rates' },
      { key: 'insurance', label: 'Insurance' },
      { key: 'legalAndProfessional', label: 'Legal & professional' },
      { key: 'recruitmentFeesAndRMLarge', label: 'Recruitment fees and R&M large' }
    ]
  }
];

const ALL_KEYS = GROUPS.flatMap(g => g.items.map(i => i.key));

function blankValues(): Record<string, number> {
  const out: Record<string, number> = {};
  ALL_KEYS.forEach(k => { out[k] = 0; });
  return out;
}

function weekDocId(weekStart: Date): string {
  return `${LOCATION_ID}-W${toDateKey(weekStart)}`;
}

const money = (v: number) => `£${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type ViewMode = 'Weekly Entry' | 'Period' | 'Monthly' | 'Quarterly';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const WeeklyCostEntry: React.FC = () => {
  const current = getCurrentPeriod();
  const [viewMode, setViewMode] = useState<ViewMode>('Weekly Entry');

  // --- Shared: every saved week for this location, loaded once and reused for both the
  // editable Weekly Entry form and the read-only rollup views. ---
  const [allWeeks, setAllWeeks] = useState<WeeklyCostEntryDoc[]>([]);
  const [weeksLoaded, setWeeksLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'weeklyCostEntries'), where('locationId', '==', LOCATION_ID)),
      (snap) => {
        setAllWeeks(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklyCostEntryDoc)));
        setLoadError(null);
        setWeeksLoaded(true);
      },
      (err) => {
        // handleFirestoreError() throws (by design, for other callers) — that's fine for a
        // one-off write/read, but as an onSnapshot error handler a thrown exception here would
        // leave weeksLoaded permanently false, so the UI would spin forever with no visible
        // explanation. Catch it, surface the message inline, and always resolve the loading state.
        try {
          handleFirestoreError(err, OperationType.LIST, 'weeklyCostEntries');
        } catch (thrown) {
          console.error('[WeeklyCostEntry] weeklyCostEntries subscription failed:', thrown);
        }
        setLoadError(err?.code === 'permission-denied'
          ? 'Permission denied reading weeklyCostEntries — Firestore rules may not be deployed yet for this collection.'
          : (err?.message || 'Failed to load saved cost entries.'));
        setWeeksLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  // ==================== WEEKLY ENTRY (editable) ====================
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
  const [values, setValues] = useState<Record<string, number>>(blankValues());
  const [saving, setSaving] = useState(false);
  const weekId = weekDocId(selectedWeekStart);
  const weekEnd = useMemo(() => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [selectedWeekStart]);

  // Re-sync the editable form only when the selected week changes (or on first data load) —
  // NOT on every realtime update, so the live listener echoing back our own save doesn't
  // clobber in-progress typing.
  useEffect(() => {
    if (!weeksLoaded) return;
    const existing = allWeeks.find(w => w.weekId === weekId);
    const next = blankValues();
    if (existing) {
      ALL_KEYS.forEach(k => { next[k] = Number((existing as any)[k]) || 0; });
    }
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId, weeksLoaded]);

  const existingWeekDoc = allWeeks.find(w => w.weekId === weekId);

  const setField = (key: string, raw: string) => {
    const num = raw === '' ? 0 : Number(raw);
    setValues(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const groupSubtotal = (group: CostGroup, source: Record<string, number>) =>
    group.items.reduce((acc, item) => acc + (source[item.key] || 0), 0);
  const grandTotal = (source: Record<string, number>) => GROUPS.reduce((acc, g) => acc + groupSubtotal(g, source), 0);

  // Shared compact table-row renderer for a group — same visual density as the AI Inventory
  // Intelligence table on the main Dashboard (thin rows, label left, value right, minimal
  // padding). Used for both the editable Weekly Entry form (editable=true) and the read-only
  // Period/Monthly/Quarterly rollup views (editable=false), so both stay visually identical.
  const renderGroupTable = (group: CostGroup, source: Record<string, number>, editable: boolean) => (
    <div key={group.title} className="bg-card-bg dark:bg-slate-800 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border-grey dark:border-slate-700 bg-secondary-surface/50 dark:bg-slate-900/50">
        <h3 className="text-[10px] font-black text-text-navy dark:text-white uppercase tracking-widest">{group.title}</h3>
        {group.note && <p className="text-[9px] text-text-muted font-bold uppercase tracking-wide mt-0.5 normal-case">{group.note}</p>}
      </div>
      <table className="w-full text-left">
        <tbody>
          {group.items.map(item => (
            <tr key={item.key} className="border-b border-border-grey/50 dark:border-slate-700/50 last:border-0 hover:bg-main-bg/40 dark:hover:bg-slate-900/40 transition-colors">
              <td className="px-4 py-1.5 text-xs font-medium text-text-navy dark:text-slate-300">{item.label}</td>
              <td className="px-4 py-1.5 text-right w-32">
                {editable ? (
                  <div className="relative inline-block w-full">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-text-muted pointer-events-none">£</span>
                    <input
                      type="number"
                      step="0.01"
                      value={source[item.key] === 0 ? '' : source[item.key]}
                      onChange={(e) => setField(item.key, e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-5 pr-2 py-1 bg-secondary-surface dark:bg-slate-900 border-none rounded-md text-xs text-right focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>
                ) : (
                  <span className="text-xs font-bold text-text-navy dark:text-white">{money(source[item.key])}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-border-grey dark:border-slate-700 bg-secondary-surface/30 dark:bg-slate-900/30 flex justify-between items-center">
        <span className="text-[10px] font-black text-text-navy dark:text-white uppercase tracking-wide">Total {group.title.toLowerCase()}</span>
        <span className="text-sm font-black text-text-navy dark:text-white">{money(groupSubtotal(group, source))}</span>
      </div>
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: WeeklyCostEntryDoc = {
        id: weekId,
        locationId: LOCATION_ID,
        weekId,
        weekStartDate: toDateKey(selectedWeekStart),
        weekEndDate: toDateKey(weekEnd),
        lastUpdated: new Date().toISOString(),
        ...(values as unknown as NumericFields)
      };
      await setDoc(doc(db, 'weeklyCostEntries', weekId), payload);
      toast.success(`Saved cost entry for week of ${toDateKey(selectedWeekStart)}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `weeklyCostEntries/${weekId}`);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (deltaDays: number) => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + deltaDays);
    setSelectedWeekStart(getWeekStart(d));
  };

  // ==================== ROLLUP VIEWS (read-only) ====================
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
    const expectedKeys = expectedWeekStarts.map(toDateKey);
    const matched = expectedKeys
      .map(k => allWeeks.find(w => w.weekStartDate === k))
      .filter((w): w is WeeklyCostEntryDoc => !!w);
    const sums = blankValues();
    matched.forEach(w => {
      ALL_KEYS.forEach(k => { sums[k] += Number((w as any)[k]) || 0; });
    });
    return { sums, enteredCount: matched.length, expectedCount: expectedWeekStarts.length };
  }, [expectedWeekStarts, allWeeks]);

  const isComplete = rollup.expectedCount > 0 && rollup.enteredCount === rollup.expectedCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-navy dark:text-white">P&amp;L Cost Entry</h2>
          <p className="text-sm text-text-muted">Manual weekly line-item cost capture, with Period/Monthly/Quarterly rollup views. Not yet wired into the P&amp;L calculation — data capture only for now.</p>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-cta/5 border border-cta/20 rounded-2xl text-xs font-bold text-cta flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Couldn't load saved cost entries: {loadError}</span>
        </div>
      )}

      {/* View mode toggle — same visual pattern as Financial Command's Monthly/Quarterly toggle */}
      <div className="flex gap-2 flex-wrap">
        {(['Weekly Entry', 'Period', 'Monthly', 'Quarterly'] as ViewMode[]).map(mode => (
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

      {viewMode === 'Weekly Entry' ? (
        <>
          {/* Week selector */}
          <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-4">
            <button onClick={() => changeWeek(-7)} className="p-2 rounded-xl border border-border-grey hover:bg-secondary-surface dark:hover:bg-slate-700 transition-colors" title="Previous week">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Week starting</label>
              <input
                type="date"
                value={toDateKey(selectedWeekStart)}
                onChange={(e) => e.target.value && setSelectedWeekStart(getWeekStart(new Date(e.target.value + 'T00:00:00')))}
                className="px-3 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent"
              />
            </div>
            <button onClick={() => changeWeek(7)} className="p-2 rounded-xl border border-border-grey hover:bg-secondary-surface dark:hover:bg-slate-700 transition-colors" title="Next week">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
                {toDateKey(selectedWeekStart)} to {toDateKey(weekEnd)}
              </span>
              {weeksLoaded && (
                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${existingWeekDoc ? 'bg-success/10 text-success' : 'bg-secondary-surface text-text-muted'}`}>
                  {existingWeekDoc ? 'Saved entry loaded' : 'No entry yet — blank'}
                </span>
              )}
            </div>
          </div>

          {!weeksLoaded ? (
            <div className="flex items-center justify-center py-20 text-text-muted">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {GROUPS.map(group => renderGroupTable(group, values, true))}
              </div>

              <div className="bg-text-navy rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
                <div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Total Operation Costs — Week of {toDateKey(selectedWeekStart)}</p>
                  <p className="text-3xl font-black text-white">{money(grandTotal(values))}</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-4 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest hover:opacity-90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Week'}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Rollup selectors */}
          <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-4">
            {viewMode === 'Period' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Period</label>
                  <select value={rollupPeriod} onChange={(e) => setRollupPeriod(Number(e.target.value))} className="px-3 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                    {Array.from({ length: 13 }, (_, i) => i + 1).map(p => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fiscal Year</label>
                  <select value={rollupFiscalYear} onChange={(e) => setRollupFiscalYear(Number(e.target.value))} className="px-3 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                    {[current.fiscalYear - 1, current.fiscalYear, current.fiscalYear + 1].map(y => <option key={y} value={y}>FY{y}</option>)}
                  </select>
                </div>
              </>
            )}
            {viewMode === 'Monthly' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Month</label>
                  <select value={rollupMonth} onChange={(e) => setRollupMonth(Number(e.target.value))} className="px-3 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Year</label>
                  <select value={rollupMonthYear} onChange={(e) => setRollupMonthYear(Number(e.target.value))} className="px-3 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                    {[rollupMonthYear - 1, rollupMonthYear, rollupMonthYear + 1].filter((v, i, a) => a.indexOf(v) === i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </>
            )}
            {viewMode === 'Quarterly' && (
              <>
                <div className="flex gap-2 p-1 bg-secondary-surface dark:bg-slate-900 rounded-xl">
                  {[1, 2, 3, 4].map(q => (
                    <Button key={q} variant={rollupQuarter === q ? 'primary' : 'ghost'} size="sm" onClick={() => setRollupQuarter(q as 1 | 2 | 3 | 4)}>
                      Q{q}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fiscal Year</label>
                  <select value={rollupFiscalYear} onChange={(e) => setRollupFiscalYear(Number(e.target.value))} className="px-3 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent">
                    {[current.fiscalYear - 1, current.fiscalYear, current.fiscalYear + 1].map(y => <option key={y} value={y}>FY{y}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              {isComplete ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-success/10 text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {rollup.enteredCount} of {rollup.expectedCount} weeks entered
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> {rollup.enteredCount} of {rollup.expectedCount} weeks entered — partial sum
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {GROUPS.map(group => renderGroupTable(group, rollup.sums, false))}
          </div>

          <div className="bg-text-navy rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
            <div>
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                Total Operation Costs — {viewMode} {viewMode === 'Period' ? `${rollupPeriod}, FY${rollupFiscalYear}` : viewMode === 'Monthly' ? `${MONTH_NAMES[rollupMonth]} ${rollupMonthYear}` : `Q${rollupQuarter}, FY${rollupFiscalYear}`}
              </p>
              <p className="text-3xl font-black text-white">{money(grandTotal(rollup.sums))}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
