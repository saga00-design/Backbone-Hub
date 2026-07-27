// UK-style retail fiscal calendar: Monday-Sunday weeks, 13 four-week Periods per fiscal year,
// fiscal year anchored to the Monday of the week containing 6 April.
//
// This is deliberately separate from utils/businessDay.ts, which answers "what single
// business day did this timestamp fall on" using a 6am London cutoff. This module answers
// a different question: "which week/Period does that business day belong to". The P&L engine
// (services/pnlEngine.ts) uses both together — businessDay.ts to bucket a transaction to a
// day, then this module to bucket that day into a week/Period.
//
// NOTE (future revisit, not solved here): 13 Periods x 4 weeks = 52 weeks = 364 days, which
// is 1-2 days short of a real year. Retail 4-4-5-style calendars normally re-anchor with an
// occasional 53-week year. For 2026 the calendar cleanly starts Monday 6 April (confirmed),
// so this isn't an issue yet — but whoever revisits this for FY2027+ (or beyond) should check
// whether 6 April is still a Monday for the relevant year and insert a 53-week year if the
// anchor has drifted. getPeriodRange currently folds any 53rd week into Period 13.

export interface DateRange {
  start: Date; // Monday 00:00, inclusive
  end: Date;   // Sunday 23:59:59.999, inclusive
}

export interface FiscalPeriod {
  fiscalYear: number;   // calendar year the fiscal year STARTS in, e.g. 2026 for FY2026/27
  periodNumber: number; // 1-13
  start: Date;
  end: Date;
}

export interface FiscalWeek {
  fiscalYear: number;
  periodNumber: number; // 1-13
  weekInPeriod: number;  // 1-4 (or 5 for a rare 53rd week, folded into Period 13)
  weekNumber: number;    // 1-52 (or 53) within the fiscal year
  start: Date; // Monday
  end: Date;   // Sunday
  monthLabel: string; // calendar month the week STARTS in, e.g. "January"
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKS_PER_PERIOD = 4;
const PERIODS_PER_YEAR = 13;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Parses a YYYY-MM-DD key (e.g. from utils/businessDay.ts) as a LOCAL date, avoiding the
 * UTC-midnight-parse gotcha of `new Date('YYYY-MM-DD')` shifting the date on non-UK machines. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** YYYY-MM-DD, for comparing against business-day-keyed data (closures, labourShifts, etc). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday of the calendar week containing `date` (Mon-Sun weeks). */
export function getWeekStart(date: Date): Date {
  const d = startOfDay(date);
  const dayOfWeek = d.getDay(); // 0 = Sun ... 6 = Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

/** Monday-Sunday range containing `date`. */
export function getWeekRange(date: Date): DateRange {
  const start = getWeekStart(date);
  const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
  return { start, end };
}

/** The calendar month name the week containing `date` STARTS in. */
export function getWeekMonthLabel(date: Date): string {
  const { start } = getWeekRange(date);
  return start.toLocaleDateString('en-GB', { month: 'long' });
}

/** Anchor Monday for the fiscal year that starts in `calendarYear` — the Monday of the
 * week containing 6 April of that year. */
export function getFiscalYearStart(calendarYear: number): Date {
  return getWeekStart(new Date(calendarYear, 3, 6)); // month index 3 = April
}

/** Which fiscal year (identified by its start calendar year) a given date falls into. */
export function getFiscalYearForDate(date: Date): number {
  const d = startOfDay(date);
  const calendarYear = d.getFullYear();
  return d >= getFiscalYearStart(calendarYear) ? calendarYear : calendarYear - 1;
}

/** 1-based week number within its fiscal year (1-52 for a standard 52-week year). */
export function getFiscalWeekNumber(date: Date): number {
  const fiscalYear = getFiscalYearForDate(date);
  const yearStart = getFiscalYearStart(fiscalYear);
  const weekStart = getWeekStart(date);
  return Math.round((weekStart.getTime() - yearStart.getTime()) / (7 * MS_PER_DAY)) + 1;
}

/** Full fiscal-week descriptor (Period, week-in-Period, month label) for a given date. */
export function getFiscalWeek(date: Date): FiscalWeek {
  const fiscalYear = getFiscalYearForDate(date);
  const weekNumber = getFiscalWeekNumber(date);
  const periodNumber = Math.min(PERIODS_PER_YEAR, Math.floor((weekNumber - 1) / WEEKS_PER_PERIOD) + 1);
  const weekInPeriod = weekNumber - (periodNumber - 1) * WEEKS_PER_PERIOD;
  const { start, end } = getWeekRange(date);
  return {
    fiscalYear,
    periodNumber,
    weekInPeriod,
    weekNumber,
    start,
    end,
    monthLabel: getWeekMonthLabel(date)
  };
}

/** Start/end range for a given 13-Period, 4-week Period of a fiscal year. */
export function getPeriodRange(periodNumber: number, fiscalYear: number): DateRange {
  const yearStart = getFiscalYearStart(fiscalYear);
  const periodStartWeekOffset = (periodNumber - 1) * WEEKS_PER_PERIOD;
  const start = new Date(yearStart);
  start.setDate(start.getDate() + periodStartWeekOffset * 7);

  // Every Period is a flat 4 weeks for now (see the 53-week-year note at the top of this file).
  const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + WEEKS_PER_PERIOD * 7 - 1));
  return { start, end };
}

/** Which Period (1-13) a given date falls into, plus its date range. Defaults to today. */
export function getCurrentPeriod(date: Date = new Date()): FiscalPeriod {
  const { fiscalYear, periodNumber } = getFiscalWeek(date);
  const { start, end } = getPeriodRange(periodNumber, fiscalYear);
  return { fiscalYear, periodNumber, start, end };
}

/** All 13 Periods for a fiscal year, for building a Period-selector UI. */
export function listPeriods(fiscalYear: number): FiscalPeriod[] {
  return Array.from({ length: PERIODS_PER_YEAR }, (_, i) => {
    const periodNumber = i + 1;
    const { start, end } = getPeriodRange(periodNumber, fiscalYear);
    return { fiscalYear, periodNumber, start, end };
  });
}

/** The 4 week-start Mondays that make up a given Period — useful for rollups that sum
 * per-week data (e.g. weekly cost entries) up to the Period level. */
export function getPeriodWeekStarts(periodNumber: number, fiscalYear: number): Date[] {
  const { start } = getPeriodRange(periodNumber, fiscalYear);
  return Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    return d;
  });
}

/** Every Monday whose week STARTS within the given calendar month (the same "a week belongs
 * to the month it starts in" rule used by getWeekMonthLabel). A calendar month contains 4 or
 * occasionally 5 such Mondays. `month` is 0-11. */
export function getWeeksStartingInMonth(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  // Start scanning one week before the 1st so we never miss an early-in-month Monday, then
  // walk forward — a month can never contain more than 5 Mondays, 7 is a safe scan bound.
  let cursor = getWeekStart(new Date(year, month, 1));
  cursor.setDate(cursor.getDate() - 7);
  for (let i = 0; i < 7; i++) {
    if (cursor.getFullYear() === year && cursor.getMonth() === month) {
      weeks.push(new Date(cursor));
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
  }
  return weeks;
}

/** Groups the fiscal year's 13 Periods into 4 quarters: 1-3, 4-6, 7-9, and 10-13 (the final
 * quarter gets the extra Period since 13 doesn't divide evenly by 4). `quarter` is 1-4. */
export function getQuarterPeriods(quarter: 1 | 2 | 3 | 4): number[] {
  if (quarter === 1) return [1, 2, 3];
  if (quarter === 2) return [4, 5, 6];
  if (quarter === 3) return [7, 8, 9];
  return [10, 11, 12, 13];
}

/** Every week-start Monday across all Periods in a given fiscal-year quarter. */
export function getQuarterWeekStarts(quarter: 1 | 2 | 3 | 4, fiscalYear: number): Date[] {
  return getQuarterPeriods(quarter).flatMap(p => getPeriodWeekStarts(p, fiscalYear));
}
