import { doc, setDoc } from 'firebase/firestore';
import { db, LOCATION_ID } from '../firebase';
import { toDateKey } from '../utils/fiscalCalendar';

function weekDocId(weekStart: Date): string {
  return `${LOCATION_ID}-W${toDateKey(weekStart)}`;
}

/**
 * Pushes a fiscal Period's Salaries and Bonus totals (from Labour Import's Review) into
 * Operation Costs' weekly cost-entry documents for that Period — split evenly across the
 * Period's 4 weeks, since weeklyCostEntries is a per-week schema and Period/Monthly/Quarterly
 * views there are just client-side sums of the underlying weekly docs (see
 * components/WeeklyCostEntry.tsx). Splitting evenly (rather than dumping the whole Period
 * total into one week) keeps both the Weekly Entry view and the Period rollup accurate.
 *
 * Uses setDoc with merge so any other manually-entered fields already saved for that week
 * (rent, utilities, etc.) are left untouched — only salaries/bonuses/lastUpdated are written.
 * Wages is deliberately NOT written here — it already flows into services/pnlEngine.ts
 * automatically from Labour Import's imported shifts, unchanged by this feature.
 */
export async function pushLabourReviewToWeeklyCostEntries(
  periodWeekStarts: Date[],
  totals: { salaries: number; bonuses: number }
): Promise<void> {
  if (periodWeekStarts.length === 0) return;
  const perWeekSalaries = totals.salaries / periodWeekStarts.length;
  const perWeekBonuses = totals.bonuses / periodWeekStarts.length;

  await Promise.all(periodWeekStarts.map(weekStart => {
    const weekStartDate = toDateKey(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const id = weekDocId(weekStart);
    return setDoc(doc(db, 'weeklyCostEntries', id), {
      id,
      locationId: LOCATION_ID,
      weekId: id,
      weekStartDate,
      weekEndDate: toDateKey(weekEnd),
      lastUpdated: new Date().toISOString(),
      salaries: perWeekSalaries,
      bonuses: perWeekBonuses,
    }, { merge: true });
  }));
}
