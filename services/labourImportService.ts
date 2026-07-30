import { collection, addDoc } from 'firebase/firestore';
import { db, LOCATION_ID } from '../firebase';
import { StaffMember, LabourShift } from '../types';
import { ROTA_IMPORT_SOURCE } from './labourImportParsing';
import type { ParsedShiftRow } from './labourImportParsing';
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
