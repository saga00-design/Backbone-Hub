import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db, LOCATION_ID } from '../firebase';
import { StaffMember, LabourShift, PayrollCentreWeekRecord } from '../types';
import { ROTA_IMPORT_SOURCE } from './labourImportParsing';
import type { ParsedShiftRow } from './labourImportParsing';
import {
  PAYROLL_CENTRE_IMPORT_SOURCE,
  payrollCentreRecordId,
  constituentWeekStarts
} from './payrollCentreParsing';
import type { PayrollCentreEmployeeRow } from './payrollCentreParsing';
import { getWeekStart, toDateKey, parseDateKey } from '../utils/fiscalCalendar';

export type { RotaCsvRow, RowFlag, ParsedShiftRow } from './labourImportParsing';
export {
  ROTA_CSV_COLUMNS,
  ROTA_IMPORT_SOURCE,
  validateRotaCsvHeaders,
  matchStaffByName,
  detectDuplicateIdentities,
  buildRotaImportPreview
} from './labourImportParsing';
export type {
  PayrollCentreCsvRow,
  PayrollCentreEmployeeRow,
  PayrollCentreImportPreview,
  SanityCheckField
} from './payrollCentreParsing';
export {
  PAYROLL_CENTRE_CSV_COLUMNS,
  PAYROLL_CENTRE_IMPORT_SOURCE,
  PAYROLL_CENTRE_COST_FIELDS,
  PAYROLL_CENTRE_REFERENCE_ONLY_FIELDS,
  validatePayrollCentreCsvHeaders,
  parsePayrollCentreRunType,
  constituentWeekStarts,
  buildPayrollCentreImportPreview
} from './payrollCentreParsing';

/**
 * Commits selected preview rows to the SAME collections the rest of Labour Intelligence
 * already reads from (labourShifts + importLogs) — no parallel/duplicate collection.
 * `staffIdOverrides` lets the caller apply manual staff-match confirmations (e.g. resolving
 * a flagged duplicate-identity by pointing both rows at one staffProfile) without ever
 * auto-creating a new profile.
 */
export async function commitRotaImport(
  rows: ParsedShiftRow[],
  selectedRowIndexes: Set<number>,
  staffIdOverrides: Map<number, string | null>,
  staff: StaffMember[]
): Promise<{ importedCount: number; skippedCount: number }> {
  let importedCount = 0;
  const skippedCount = rows.length - selectedRowIndexes.size;

  for (const row of rows) {
    if (!selectedRowIndexes.has(row.rowIndex)) continue;

    const staffId = staffIdOverrides.has(row.rowIndex) ? staffIdOverrides.get(row.rowIndex) ?? null : row.matchedStaffId;
    const matched = staffId ? staff.find(s => s.id === staffId) || null : null;

    const newShift: Omit<LabourShift, 'id'> = {
      employeeName: row.employeeNameRaw,
      staffId: staffId,
      role: row.role || matched?.role || 'Staff',
      department: row.department || matched?.department || null,
      date: row.businessDate,
      clockIn: row.startTime,
      clockOut: row.endTime,
      breakMinutes: row.breakMinutes,
      durationHours: row.hoursScheduled,
      wageRate: row.hourlyWage,
      totalCost: row.computedCost,
      locationId: LOCATION_ID,
      importedAt: new Date().toISOString(),
      source: ROTA_IMPORT_SOURCE,
      shiftWindow: row.shiftWindow
    };

    await addDoc(collection(db, 'labourShifts'), newShift);
    importedCount++;
  }

  const importedDates = Array.from(new Set(
    rows.filter(r => selectedRowIndexes.has(r.rowIndex)).map(r => r.businessDate).filter(Boolean)
  )).sort();

  // Real count of imported rows that were flagged as matching an already-imported shift
  // (see buildRotaImportPreview's DUPLICATE_ALREADY_IMPORTED check) — not a hardcoded 0.
  // A non-zero value here means the user explicitly overrode the warning and re-imported
  // rows the preview told them were already in the database.
  const duplicatesCount = rows.filter(
    r => selectedRowIndexes.has(r.rowIndex) && r.flags.some(f => f.code === 'DUPLICATE_ALREADY_IMPORTED')
  ).length;

  await addDoc(collection(db, 'importLogs'), {
    locationId: LOCATION_ID,
    type: 'Labour Shift Import',
    importedBy: 'Manager',
    count: importedCount,
    duplicates: duplicatesCount,
    skipped: skippedCount,
    source: ROTA_IMPORT_SOURCE,
    dateRange: importedDates.length > 0 ? `${importedDates[0]} to ${importedDates[importedDates.length - 1]}` : 'N/A',
    dates: importedDates,
    timestamp: new Date().toISOString()
  });

  return { importedCount, skippedCount };
}

/**
 * Commits a Payroll Centre import preview's per-employee rows to `payrollCentreWeeks`.
 *
 * A Payroll Centre import can cover MORE than one fiscal week in a single row per employee —
 * confirmed real example: "FY2026 Period 4 (29 Jun - 26 Jul 2026)" is one row per employee
 * covering 4 whole weeks. Storing that as a single record keyed to (or rolled up into) just
 * one week would leave the Period's other 3 weeks showing no real data at all, silently
 * falling back to the hours x rate estimate ON TOP OF the real Period total already counted —
 * exactly the double-counting bug class this whole feature exists to prevent. So instead, this
 * splits every employee's Period-level figures EVENLY across every fiscal week the import's
 * coverage actually touches (constituentWeekStarts()), writing one record per employee PER
 * WEEK, each keyed by that week's own (day-clipped) coverage range via payrollCentreRecordId()
 * — so a multi-week Period, a single Weekly import, and a single-day Daily import all reduce
 * to the same one-record-per-employee-per-week shape (a Weekly/Daily import simply has exactly
 * one constituent week, so nothing changes for them: dividing by 1 is a no-op). Re-importing
 * the exact same range still overwrites the same records; a Daily import for a different day
 * within an already-imported Period's week creates its own additional record and accumulates
 * with the Period's even share for that week, same as it would for a Weekly import.
 *
 * Only Basic Wages / Accrued Holiday Pay / Employer NI / Employer Pension are ever treated as
 * labour cost elsewhere — the deduction fields (Employee NI/Pension, PAYE Tax) and
 * Tronc/Gross/Net are stored for reference only, split the same even way for consistency.
 */
export async function commitPayrollCentreImport(
  employeeRows: PayrollCentreEmployeeRow[],
  selectedKeys: Set<string>, // employeeNameRaw values selected for import
  staffIdOverrides: Map<string, string | null>,
  coverageStartDate: string,
  coverageEndDate: string
): Promise<{ importedCount: number; skippedCount: number }> {
  let importedCount = 0;
  const skippedCount = employeeRows.length - selectedKeys.size;

  const weeks = constituentWeekStarts(parseDateKey(coverageStartDate), parseDateKey(coverageEndDate));
  const numWeeks = weeks.length || 1;
  const overallStartKey = coverageStartDate;
  const overallEndKey = coverageEndDate;

  for (const row of employeeRows) {
    if (!selectedKeys.has(row.employeeNameRaw)) continue;

    const staffId = staffIdOverrides.has(row.employeeNameRaw)
      ? staffIdOverrides.get(row.employeeNameRaw) ?? null
      : row.matchedStaffId;

    for (const weekStart of weeks) {
      const weekStartKey = toDateKey(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndKey = toDateKey(weekEnd);

      // Clip this week's slice to the days actually covered by the import (matters only at
      // the first/last constituent week if the import's range isn't itself Mon-Sun-aligned).
      const sliceStartKey = weekStartKey > overallStartKey ? weekStartKey : overallStartKey;
      const sliceEndKey = weekEndKey < overallEndKey ? weekEndKey : overallEndKey;

      const id = payrollCentreRecordId(LOCATION_ID, sliceStartKey, sliceEndKey, staffId, row.employeeNameRaw);
      const record: PayrollCentreWeekRecord = {
        id,
        locationId: LOCATION_ID,
        staffId,
        employeeName: row.employeeNameRaw,
        department: row.department,
        weekStartDate: weekStartKey,
        weekEndDate: weekEndKey,
        coverageStartDate: sliceStartKey,
        coverageEndDate: sliceEndKey,
        complianceStatus: row.complianceStatus,
        hoursWorked: row.hoursWorked / numWeeks,
        basicWages: row.basicWages / numWeeks,
        accruedHolidayPay: row.accruedHolidayPay / numWeeks,
        employerNI: row.employerNI / numWeeks,
        employerPension: row.employerPension / numWeeks,
        troncTips: row.troncTips / numWeeks,
        grossPay: row.grossPay / numWeeks,
        payeTax: row.payeTax / numWeeks,
        employeeNI: row.employeeNI / numWeeks,
        employeePension: row.employeePension / numWeeks,
        netTakeHome: row.netTakeHome / numWeeks,
        source: PAYROLL_CENTRE_IMPORT_SOURCE,
        importedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'payrollCentreWeeks', id), record);
    }
    importedCount++;
  }

  const duplicatesCount = employeeRows.filter(
    r => selectedKeys.has(r.employeeNameRaw) && r.flags.some(f => f.code === 'DUPLICATE_ALREADY_IMPORTED')
  ).length;

  await addDoc(collection(db, 'importLogs'), {
    locationId: LOCATION_ID,
    type: 'Payroll Centre Import',
    importedBy: 'Manager',
    count: importedCount,
    duplicates: duplicatesCount,
    skipped: skippedCount,
    source: PAYROLL_CENTRE_IMPORT_SOURCE,
    dateRange: `${coverageStartDate} to ${coverageEndDate}`,
    dates: [coverageStartDate],
    timestamp: new Date().toISOString()
  });

  return { importedCount, skippedCount };
}

/**
 * Buckets already-imported LabourShift docs into Monday-Sunday weeks and sums each week's
 * cost in whole pence (avoids float summation drift). Same bucketing Labour Intelligence's
 * Weekly/Period/Monthly/Quarterly views use, so any caller summing a set of weeks from this
 * map agrees exactly with what Labour Intelligence itself shows for those weeks.
 */
export function buildWeeklyLabourCostPenceMap(shifts: LabourShift[]): Map<string, number> {
  const map = new Map<string, number>();
  shifts.forEach(s => {
    if (!s.date) return;
    const weekStartKey = toDateKey(getWeekStart(parseDateKey(s.date)));
    const pence = Math.round((s.totalCost || 0) * 100);
    map.set(weekStartKey, (map.get(weekStartKey) || 0) + pence);
  });
  return map;
}

/**
 * True if this shift belongs to a Salaried staff member — their real cost is a fixed salary,
 * not hours x rate, so their shifts must be excluded from any automated Wages/labour cost
 * total (that total would otherwise double-count alongside their actual salary). Unmatched
 * shifts (no staffId, or staffId not found in `staff`) are treated as Hourly/cost-eligible —
 * the safe default, since we can't confirm they're Salaried and existing behavior for anyone
 * not explicitly marked Salaried must not change.
 */
export function isSalariedShift(shift: LabourShift, staff: StaffMember[]): boolean {
  if (!shift.staffId) return false;
  const matched = staff.find(s => s.id === shift.staffId);
  return matched?.employmentType === 'Salaried';
}

/**
 * Filters a shift list down to only the shifts that should count toward an automated Wages/
 * labour cost total — i.e. excludes Salaried staff's shifts (see isSalariedShift()). Hours/
 * attendance tracking is unaffected by this filter; it is ONLY applied before summing cost
 * (buildWeeklyLabourCostPenceMap, computePnl's labourShifts input, etc.) — never applied to
 * the raw shift list used for hour totals or shift-level display.
 */
export function filterShiftsForCost(shifts: LabourShift[], staff: StaffMember[]): LabourShift[] {
  return shifts.filter(s => !isSalariedShift(s, staff));
}

/**
 * Real Payroll Centre data always wins over the estimate, for any week it covers: this
 * replaces ALL of that week's shifts (both the Hourly-rate estimate and whatever would have
 * been excluded as Salaried) with one synthetic entry PER EMPLOYEE in that week's real
 * import — real payroll doesn't distinguish Hourly/Salaried, it IS the real cost, so the
 * estimate no longer applies once real figures exist for that week. One synthetic shift per
 * employee (not one blob per week) so per-department Wages breakdowns stay accurate for
 * real-data weeks too — each carries the employee's real staffId/department straight through.
 * Weeks with no Payroll Centre data pass through unchanged, so the existing hours x rate /
 * Salaried-exclusion ESTIMATE stays live for them (e.g. the current week, before payroll runs).
 *
 * Pass this the output of filterShiftsForCost() as `estimateShifts` — this function only
 * decides which WEEKS get overridden by real data, not which shifts count within a week that
 * still has no real data.
 */
export function mergeRealPayrollData(
  estimateShifts: LabourShift[],
  payrollCentreRecords: PayrollCentreWeekRecord[]
): LabourShift[] {
  if (payrollCentreRecords.length === 0) return estimateShifts;

  const realWeeks = new Set(payrollCentreRecords.map(r => r.weekStartDate).filter(Boolean));

  const keptEstimateShifts = estimateShifts.filter(s => {
    if (!s.date) return true;
    const weekStartKey = toDateKey(getWeekStart(parseDateKey(s.date)));
    return !realWeeks.has(weekStartKey);
  });

  const syntheticShifts: LabourShift[] = payrollCentreRecords
    .filter(r => !!r.weekStartDate)
    .map(r => ({
      id: `real-payroll-${r.id}`,
      staffId: r.staffId,
      employeeName: r.employeeName,
      role: 'Payroll',
      department: r.department,
      date: r.weekStartDate,
      clockIn: '',
      clockOut: '',
      breakMinutes: 0,
      durationHours: r.hoursWorked || 0,
      wageRate: 0,
      totalCost: r.basicWages || 0,
      locationId: LOCATION_ID,
      importedAt: r.importedAt,
      source: PAYROLL_CENTRE_IMPORT_SOURCE
    }));

  return [...keptEstimateShifts, ...syntheticShifts];
}

// Settings' canonical staff department dropdown (confirmed live options — NOT the separate
// inventory-item DEFAULT_DEPARTMENTS in constants.ts, which is a different value space).
export const CANONICAL_DEPARTMENTS = [
  'Front of the house',
  'Back of the house',
  'Administration',
  'Management',
  'Bar',
  'Not Chosen'
] as const;
export type CanonicalDepartment = typeof CANONICAL_DEPARTMENTS[number];

// Real TTP rota exports mix abbreviated and fully-spelled department text for different roles
// within the SAME file (confirmed: a single export containing both "Foh" and
// "Front of the house", plus "Kitchen" and "Administration" — see rota_export_2026-05-25.csv).
// Meanwhile Settings' StaffMember.department is picked from the canonical dropdown directly.
// Neither side is rewritten — this mapping is applied only where Wages (shift-level) and
// Salaries (StaffMember-level) department figures are grouped together for display, so the
// same real department merges into one row instead of two differently-spelled ones.
const DEPARTMENT_VARIANTS: Record<string, CanonicalDepartment> = {
  'front of the house': 'Front of the house',
  'front of house': 'Front of the house',
  'foh': 'Front of the house',
  'fnb': 'Front of the house',
  'f&b': 'Front of the house',

  'back of the house': 'Back of the house',
  'back of house': 'Back of the house',
  'boh': 'Back of the house',
  'kitchen': 'Back of the house',

  'administration': 'Administration',
  'admin': 'Administration',

  'management': 'Management',
  'manager': 'Management',

  'bar': 'Bar',

  'not chosen': 'Not Chosen',
};

// Logged once per distinct unrecognized value (not per call) so a busy import doesn't spam
// the console with the same warning for every shift row of an unmapped department.
const loggedUnrecognizedDepartments = new Set<string>();

/**
 * Maps raw department text (TTP CSV free text, or a Settings dropdown value) to Settings'
 * canonical department list, case-insensitively. Unrecognized values fall back to "Not
 * Chosen" (matching Settings' own fallback option) rather than being dropped or crashing —
 * and are logged once so real-world variants can be reviewed and added to
 * DEPARTMENT_VARIANTS above.
 */
export function normalizeDepartment(raw: string | null | undefined): CanonicalDepartment {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'Not Chosen';
  const match = DEPARTMENT_VARIANTS[trimmed.toLowerCase()];
  if (match) return match;
  if (!loggedUnrecognizedDepartments.has(trimmed)) {
    loggedUnrecognizedDepartments.add(trimmed);
    console.warn(`[labourImportService] Unrecognized department value "${trimmed}" — showing as "Not Chosen" in Labour Import's Review breakdown. Add a mapping in normalizeDepartment() if this is a real department variant.`);
  }
  return 'Not Chosen';
}

export interface LabourWeeksRollup {
  totalCost: number;
  weeksWithData: number;
  expectedCount: number;
}

/**
 * Sums a weekly-pence map (see buildWeeklyLabourCostPenceMap) over a given set of expected
 * week-start Mondays — e.g. the 4 weeks of a fiscal Period. Only weeks that actually have
 * imported data are counted, so a partially-imported Period returns its true-so-far total
 * rather than treating missing weeks as zero-cost.
 */
export function sumLabourCostForWeeks(weeklyPenceMap: Map<string, number>, weekStarts: Date[]): LabourWeeksRollup {
  let pence = 0;
  let weeksWithData = 0;
  weekStarts.forEach(weekStart => {
    const key = toDateKey(weekStart);
    const weekPence = weeklyPenceMap.get(key);
    if (weekPence !== undefined) {
      pence += weekPence;
      weeksWithData += 1;
    }
  });
  return { totalCost: pence / 100, weeksWithData, expectedCount: weekStarts.length };
}

export interface PayrollCentreAccrualSum {
  ni: number;
  pension: number;
  holidayAccrual: number;
  weeksCovered: number;
}

/**
 * Sums one employee's real Employer NI / Employer Pension / Accrued Holiday Pay across
 * whichever of a fiscal Period's 4 weeks have real Payroll Centre data — feeds
 * payrollAccruals' NI/Pension/Holiday Accrual fields with real figures instead of requiring
 * manual entry. Returns null if this employee has NO real data for any of the Period's weeks,
 * so the caller knows to fall back to whatever's already manually saved.
 */
export function sumPayrollCentreForPeriod(
  records: PayrollCentreWeekRecord[],
  staffId: string,
  periodWeekStartKeys: string[]
): PayrollCentreAccrualSum | null {
  const weekKeySet = new Set(periodWeekStartKeys);
  const matching = records.filter(r => r.staffId === staffId && weekKeySet.has(r.weekStartDate));
  if (matching.length === 0) return null;

  const sum = matching.reduce((acc, r) => ({
    ni: acc.ni + (r.employerNI || 0),
    pension: acc.pension + (r.employerPension || 0),
    holidayAccrual: acc.holidayAccrual + (r.accruedHolidayPay || 0)
  }), { ni: 0, pension: 0, holidayAccrual: 0 });

  return { ...sum, weeksCovered: matching.length };
}
