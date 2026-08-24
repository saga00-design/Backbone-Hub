import { StaffMember, PayrollCentreWeekRecord } from '../types';
import { matchStaffById, matchStaffByPin, matchStaffByName, detectDuplicateIdentities, RowFlag } from './labourImportParsing';
import { StaffSecret } from '../types';
import { normalizeDepartment } from './labourImportService';
import { getWeekStart, getPeriodRange, toDateKey } from '../utils/fiscalCalendar';

// Required header row of TTP's "Payroll Centre" weekly export — a real per-employee payroll
// run, distinct from the Rota Export CSV (which is a scheduling/hours-x-rate estimate).
// "Compliance" and "Kiosk PIN" are deliberately NOT in this required list: TTP has shipped both
// an older format (Compliance present, no Kiosk PIN) and a newer one (Kiosk PIN present, no
// Compliance — confirmed real file: FY2026_W_27_07_26_payroll_export.csv), and both need to
// validate successfully. Each column is read as optional below and handled accordingly.
export const PAYROLL_CENTRE_CSV_COLUMNS = [
  'Run Type', 'Employee Name', 'Department', 'Tax Code', 'NI Number',
  'Hours Worked', 'Basic Wages (£)', 'Accrued Holiday Pay (£)', 'Tronc / Tips (£)',
  'Gross Pay (£)', 'PAYE Tax (£)', 'Employee NI (£)', 'Employee Pension (£)',
  'Employer NI (£)', 'Employer Pension (£)', 'Net Take-Home (£)'
] as const;

export interface PayrollCentreCsvRow {
  'Run Type': string;
  'Employee Name': string;
  Department: string;
  'Tax Code': string;
  'NI Number': string;
  'Hours Worked': string;
  'Basic Wages (£)': string;
  'Accrued Holiday Pay (£)': string;
  'Tronc / Tips (£)': string;
  'Gross Pay (£)': string;
  'PAYE Tax (£)': string;
  'Employee NI (£)': string;
  'Employee Pension (£)': string;
  'Employer NI (£)': string;
  'Employer Pension (£)': string;
  'Net Take-Home (£)': string;
  // Older format only — removed entirely from the newer Kiosk PIN export. Optional so both
  // formats type-check; see hasComplianceColumn in buildPayrollCentreImportPreview() for how
  // "column absent" is distinguished from "column present but blank".
  Compliance?: string;
  // Newer format only (confirmed real: FY2026_W_27_07_26_payroll_export.csv) — each employee's
  // 4-digit kiosk PIN, the same StaffMember.pin used for POS clock-in. Now the PRIMARY match key
  // for Payroll Centre imports; see matchStaffByPin() in labourImportParsing.ts.
  'Kiosk PIN'?: string;
  // Not yet exported by TTP — forward-compatible optional column. When present, Labour Import
  // matches on this instead of the (fragile) Employee Name text. See matchStaffById().
  'Staff ID'?: string;
}

export const PAYROLL_CENTRE_IMPORT_SOURCE = 'TTP Payroll Centre CSV';

// Which columns are real business cost vs. reference-only (employee deductions, already
// reflected inside Basic Wages/Gross Pay — adding them again would double-count). Kept as an
// explicit list here (rather than just in comments) so any future caller can see the
// classification at a glance instead of re-deriving it from the task history.
export const PAYROLL_CENTRE_COST_FIELDS = ['basicWages', 'accruedHolidayPay', 'employerNI', 'employerPension'] as const;
export const PAYROLL_CENTRE_REFERENCE_ONLY_FIELDS = ['troncTips', 'grossPay', 'payeTax', 'employeeNI', 'employeePension', 'netTakeHome'] as const;

export function validatePayrollCentreCsvHeaders(fields: string[]): { valid: boolean; missing: string[] } {
  const present = new Set(fields.map(f => f.trim()));
  const missing = PAYROLL_CENTRE_CSV_COLUMNS.filter(c => !present.has(c));
  return { valid: missing.length === 0, missing };
}

const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthIndexFromText(text: string): number {
  const short = (text || '').trim().slice(0, 3).toLowerCase();
  return MONTH_SHORT.indexOf(short);
}

export interface PayrollCentreCoverage {
  coverageStart: Date;
  coverageEnd: Date;
  fiscalPeriod?: { fiscalYear: number; periodNumber: number };
}

// TTP's Payroll Centre now exports several Run Type shapes in the SAME "Run Type" column
// (confirmed real examples, all seen across different exports of the same underlying data):
//   "Week: 13 Jul - 19 Jul 2026"              <label>: <range>
//   "Daily: 30 Jul 2026"                       <label>: <single date>
//   "FY2026 Period 4 (29 Jun - 26 Jul 2026)"   FY<year> Period <n> (<range>) — no colon at all
// The colon-based shapes intentionally don't require the label to be "Week" or "Daily"
// specifically, so any other colon-prefixed range- or single-date-shaped label TTP produces
// (Quarterly/Custom Range, say) is handled the same way without a code change per new label.
// The Period shape is parsed separately since it has no colon and its own "FY<year> Period
// <n>" prefix. A label whose date portion doesn't match any of these (e.g. a bare "Monthly:
// July 2026" with no day number) isn't guessed at — see the caller's weekParseError, which
// names the exact unrecognized text.
const RANGE_PATTERN = /^[A-Za-z][A-Za-z ]*?:\s*(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/;
const SINGLE_DATE_PATTERN = /^[A-Za-z][A-Za-z ]*?:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/;
const FISCAL_PERIOD_PATTERN = /^FY(\d{4})\s+Period\s+(\d{1,2})\s*\(\s*(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*\)$/;

function rangeFromParts(startDayStr: string, startMonthText: string, endDayStr: string, endMonthText: string, yearStr: string): PayrollCentreCoverage | null {
  const startMonth = monthIndexFromText(startMonthText);
  const endMonth = monthIndexFromText(endMonthText);
  if (startMonth === -1 || endMonth === -1) return null;
  const year = parseInt(yearStr, 10);
  // Assumes the year given applies to the END date — handles a range spanning a year
  // boundary (e.g. "29 Dec - 4 Jan 2027") by rolling the start date back a year when its
  // month is after the end month.
  const startYear = startMonth > endMonth ? year - 1 : year;
  const coverageStart = new Date(startYear, startMonth, parseInt(startDayStr, 10));
  const coverageEnd = new Date(year, endMonth, parseInt(endDayStr, 10));
  if (isNaN(coverageStart.getTime()) || isNaN(coverageEnd.getTime())) return null;
  return { coverageStart, coverageEnd };
}

/**
 * Parses a Payroll Centre Run Type string into the actual date range it covers — a multi-day
 * range ("Week: ..."), a single day ("Daily: ...", where coverageStart === coverageEnd), or a
 * fiscal Period ("FY2026 Period 4 (...)").
 */
export function parsePayrollCentreRunType(runType: string): PayrollCentreCoverage | null {
  const trimmed = (runType || '').trim();

  const periodMatch = trimmed.match(FISCAL_PERIOD_PATTERN);
  if (periodMatch) {
    const [, fiscalYearStr, periodNumberStr, startDayStr, startMonthText, endDayStr, endMonthText, yearStr] = periodMatch;
    const range = rangeFromParts(startDayStr, startMonthText, endDayStr, endMonthText, yearStr);
    if (!range) return null;
    return { ...range, fiscalPeriod: { fiscalYear: parseInt(fiscalYearStr, 10), periodNumber: parseInt(periodNumberStr, 10) } };
  }

  const rangeMatch = trimmed.match(RANGE_PATTERN);
  if (rangeMatch) {
    const [, startDayStr, startMonthText, endDayStr, endMonthText, yearStr] = rangeMatch;
    return rangeFromParts(startDayStr, startMonthText, endDayStr, endMonthText, yearStr);
  }

  const singleMatch = trimmed.match(SINGLE_DATE_PATTERN);
  if (singleMatch) {
    const [, dayStr, monthText, yearStr] = singleMatch;
    const month = monthIndexFromText(monthText);
    if (month === -1) return null;
    const date = new Date(parseInt(yearStr, 10), month, parseInt(dayStr, 10));
    if (isNaN(date.getTime())) return null;
    return { coverageStart: date, coverageEnd: date };
  }

  return null;
}

/**
 * Every distinct Monday-Sunday week touched (even partially) by [start, end], in order. A
 * single day or an already Mon-Sun-aligned week both naturally collapse to exactly one week —
 * a multi-week Period (or any other range spanning several weeks) correctly expands to
 * several. This is what lets a Period-level import be decomposed into one real-data record
 * PER WEEK (see splitAcrossConstituentWeeks() in labourImportService.ts) instead of having its
 * whole multi-week total misattributed to a single week — which would leave the Period's other
 * weeks showing no real data and silently falling back to the hours x rate estimate on top of
 * the real figure already counted, double-counting exactly the class of bug this feature exists
 * to prevent.
 */
export function constituentWeekStarts(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  const seen = new Set<string>();
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endKey = toDateKey(end);
  // Safety bound: even a full year would be ~53 iterations: this loop is never unbounded.
  while (toDateKey(cursor) <= endKey) {
    const weekStart = getWeekStart(cursor);
    const key = toDateKey(weekStart);
    if (!seen.has(key)) {
      seen.add(key);
      weeks.push(weekStart);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return weeks;
}

function parseMoney(v: string): number {
  const n = parseFloat((v || '').toString().replace(/[£,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function normalizeName(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Deterministic per-employee-per-COVERAGE-RANGE doc id (not per-week) — so re-importing the
 * SAME range (e.g. correcting one day's file) overwrites that record, while a DIFFERENT day's
 * import within the same fiscal week gets its own record instead of overwriting the first
 * day's data. Multiple such records sharing a week then naturally accumulate wherever they're
 * summed by weekStartDate (mergeRealPayrollData, sumPayrollCentreForPeriod).
 */
export function payrollCentreRecordId(locationId: string, coverageStartKey: string, coverageEndKey: string, staffId: string | null, employeeName: string): string {
  const range = coverageStartKey === coverageEndKey ? coverageStartKey : `${coverageStartKey}_${coverageEndKey}`;
  return `${locationId}-${staffId || normalizeName(employeeName)}-${range}`;
}

export interface PayrollCentreEmployeeRow {
  employeeNameRaw: string;
  staffIdRaw: string;
  kioskPinRaw: string;
  matchedStaffId: string | null;
  autoMatchedStaffId: string | null;
  department: string; // normalized via the shared normalizeDepartment()
  departmentRaw: string;
  // "Excluded" wins if any aggregated row says Excluded. null when this file's format has no
  // Compliance column at all (see hasComplianceColumn below) — the UI omits the badge entirely
  // in that case rather than showing a confusing blank/"Unknown" state.
  complianceStatus: string | null;
  hoursWorked: number;
  basicWages: number;
  accruedHolidayPay: number;
  troncTips: number;
  grossPay: number;
  payeTax: number;
  employeeNI: number;
  employeePension: number;
  employerNI: number;
  employerPension: number;
  netTakeHome: number;
  rowCount: number; // how many raw CSV rows aggregated into this one (TTP sometimes splits
                     // one employee's week across two rows — see the real sample file)
  flags: RowFlag[];
  includeByDefault: boolean;
}

export interface SanityCheckField {
  field: string;
  computed: number;
  reported: number;
  matches: boolean;
}

export interface PayrollCentreImportPreview {
  weekStart: Date | null; // exact coverage start of this file (a single day for "Daily: ...")
  weekEnd: Date | null;   // exact coverage end of this file
  constituentWeeks: Date[]; // every Monday-Sunday week this coverage touches — 1 for Daily/Weekly, several for a Period (or any other multi-week range)
  weekLabel: string; // the raw Run Type text used, for display
  weekParseError: string | null;
  weekAlignmentWarning: string | null; // set when a Week claims a range that isn't really Mon-Sun, or a Period's dates don't match Hub's own fiscal calendar
  employeeRows: PayrollCentreEmployeeRow[];
  totalsRowFound: boolean;
  sanityCheck: SanityCheckField[] | null; // null if no TOTALS row to compare against
}

const TOLERANCE = 0.02; // pence-level rounding across many summed rows

export function buildPayrollCentreImportPreview(
  csvRows: PayrollCentreCsvRow[],
  staff: StaffMember[],
  existingRecords: PayrollCentreWeekRecord[] = [],
  staffSecretsByStaffId: Record<string, Partial<StaffSecret>> = {}
): PayrollCentreImportPreview {
  const totalsRow = csvRows.find(r => !((r['Employee Name'] || '').trim()) || (r['Run Type'] || '').trim().toUpperCase() === 'TOTALS');
  const employeeCsvRows = csvRows.filter(r => (r['Employee Name'] || '').trim() && (r['Run Type'] || '').trim().toUpperCase() !== 'TOTALS');

  const firstRunType = employeeCsvRows.find(r => r['Run Type'])?.['Run Type'] || '';
  const parsedCoverage = parsePayrollCentreRunType(firstRunType);
  const weekParseError = parsedCoverage
    ? null
    : `Unrecognized Run Type "${firstRunType}" — this app currently understands "Week: 13 Jul - 19 Jul 2026", "Daily: 30 Jul 2026", "FY2026 Period 4 (29 Jun - 26 Jul 2026)", and other "<label>: <start> - <end> <year>" range formats. If TTP has added a new report type, this exact text is what needs a parser update.`;

  const constituentWeeks = parsedCoverage ? constituentWeekStarts(parsedCoverage.coverageStart, parsedCoverage.coverageEnd) : [];

  // Alignment is checked against whichever Hub fiscal concept this Run Type actually claims:
  // a fiscal Period is checked against Hub's own getPeriodRange() (the two are expected to
  // agree exactly, as confirmed against a real Period export); a plain 7-day span is checked
  // against the Monday-Sunday week rule. Anything else (Daily, or an unrecognized multi-week
  // span with no matching Hub concept) has nothing meaningful to validate against, so it's
  // left unchecked rather than guessed at.
  let weekAlignmentWarning: string | null = null;
  if (parsedCoverage?.fiscalPeriod) {
    const { fiscalYear, periodNumber } = parsedCoverage.fiscalPeriod;
    const hubPeriod = getPeriodRange(periodNumber, fiscalYear);
    if (toDateKey(hubPeriod.start) !== toDateKey(parsedCoverage.coverageStart) || toDateKey(hubPeriod.end) !== toDateKey(parsedCoverage.coverageEnd)) {
      weekAlignmentWarning = `TTP says FY${fiscalYear} Period ${periodNumber} runs ${toDateKey(parsedCoverage.coverageStart)} to ${toDateKey(parsedCoverage.coverageEnd)}, but Hub computes that Period as ${toDateKey(hubPeriod.start)} to ${toDateKey(hubPeriod.end)} — check the fiscal calendars agree before relying on this for Period rollups.`;
    }
  } else if (parsedCoverage) {
    const spanDays = Math.round((parsedCoverage.coverageEnd.getTime() - parsedCoverage.coverageStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (spanDays === 7) {
      const realWeekStart = getWeekStart(parsedCoverage.coverageStart);
      const expectedEnd = new Date(realWeekStart);
      expectedEnd.setDate(expectedEnd.getDate() + 6);
      if (toDateKey(realWeekStart) !== toDateKey(parsedCoverage.coverageStart) || toDateKey(expectedEnd) !== toDateKey(parsedCoverage.coverageEnd)) {
        weekAlignmentWarning = `This range (${toDateKey(parsedCoverage.coverageStart)} to ${toDateKey(parsedCoverage.coverageEnd)}) doesn't line up with Hub's Monday-Sunday fiscal week — check this file's date range before relying on it for Period rollups.`;
      }
    }
  }

  // TTP's newer Kiosk PIN export format drops the Compliance column entirely (confirmed real
  // file: FY2026_W_27_07_26_payroll_export.csv) — distinguish "column absent from this file"
  // from "column present but blank" so the UI can omit the badge instead of showing "Unknown".
  const hasComplianceColumn = employeeCsvRows.length > 0 && Object.prototype.hasOwnProperty.call(employeeCsvRows[0], 'Compliance');

  // Aggregate duplicate employee rows within this file (same employee can appear on more than
  // one row for the same week — confirmed in the real sample) into one record per employee.
  const byName = new Map<string, PayrollCentreEmployeeRow>();
  const orderedNames: string[] = [];
  employeeCsvRows.forEach(raw => {
    const employeeNameRaw = (raw['Employee Name'] || '').trim();
    const staffIdRaw = (raw['Staff ID'] || '').trim();
    const kioskPinRaw = (raw['Kiosk PIN'] || '').trim();
    const key = normalizeName(employeeNameRaw);
    if (!key) return;
    const departmentRaw = (raw.Department || '').trim();
    const compliance = (raw.Compliance || '').trim();
    const existing = byName.get(key);
    if (existing) {
      existing.hoursWorked += parseFloat(raw['Hours Worked']) || 0;
      existing.basicWages += parseMoney(raw['Basic Wages (£)']);
      existing.accruedHolidayPay += parseMoney(raw['Accrued Holiday Pay (£)']);
      existing.troncTips += parseMoney(raw['Tronc / Tips (£)']);
      existing.grossPay += parseMoney(raw['Gross Pay (£)']);
      existing.payeTax += parseMoney(raw['PAYE Tax (£)']);
      existing.employeeNI += parseMoney(raw['Employee NI (£)']);
      existing.employeePension += parseMoney(raw['Employee Pension (£)']);
      existing.employerNI += parseMoney(raw['Employer NI (£)']);
      existing.employerPension += parseMoney(raw['Employer Pension (£)']);
      existing.netTakeHome += parseMoney(raw['Net Take-Home (£)']);
      existing.rowCount += 1;
      // "Excluded" wins over "Compliant" if the aggregated rows disagree — conservative, never
      // hides a genuine onboarding-incomplete flag. Only applies when this file has the column.
      if (hasComplianceColumn && compliance.toLowerCase() === 'excluded') existing.complianceStatus = compliance;
    } else {
      orderedNames.push(key);
      byName.set(key, {
        employeeNameRaw,
        staffIdRaw,
        kioskPinRaw,
        matchedStaffId: null,
        autoMatchedStaffId: null,
        department: normalizeDepartment(departmentRaw),
        departmentRaw,
        complianceStatus: hasComplianceColumn ? compliance : null,
        hoursWorked: parseFloat(raw['Hours Worked']) || 0,
        basicWages: parseMoney(raw['Basic Wages (£)']),
        accruedHolidayPay: parseMoney(raw['Accrued Holiday Pay (£)']),
        troncTips: parseMoney(raw['Tronc / Tips (£)']),
        grossPay: parseMoney(raw['Gross Pay (£)']),
        payeTax: parseMoney(raw['PAYE Tax (£)']),
        employeeNI: parseMoney(raw['Employee NI (£)']),
        employeePension: parseMoney(raw['Employee Pension (£)']),
        employerNI: parseMoney(raw['Employer NI (£)']),
        employerPension: parseMoney(raw['Employer Pension (£)']),
        netTakeHome: parseMoney(raw['Net Take-Home (£)']),
        rowCount: 1,
        flags: [],
        includeByDefault: true
      });
    }
  });

  const distinctRawNames = orderedNames.map(k => byName.get(k)!.employeeNameRaw);
  const duplicateIdentities = detectDuplicateIdentities(distinctRawNames);
  // Keyed by the EXACT coverage range (not just the containing week) — so importing Tuesday
  // after Monday's data already exists is correctly treated as new data, not a duplicate of
  // Monday's record. Re-importing the SAME range (e.g. a corrected re-upload of the same day)
  // still correctly flags as already imported.
  const coverageStartKey = parsedCoverage ? toDateKey(parsedCoverage.coverageStart) : '';
  const coverageEndKey = parsedCoverage ? toDateKey(parsedCoverage.coverageEnd) : '';
  const existingKeys = new Set(
    existingRecords.map(r => `${r.coverageStartDate}::${r.coverageEndDate}::${r.staffId || normalizeName(r.employeeName)}`)
  );

  const employeeRows: PayrollCentreEmployeeRow[] = orderedNames.map(key => {
    const row = byName.get(key)!;
    // Match priority: Staff ID (forward-compatible field, not yet exported by TTP) > Kiosk PIN
    // (TTP's real, confirmed primary key as of the Kiosk PIN export format — matches
    // StaffMember.pin, the same field used for POS clock-in) > Employee Name (fallback for
    // exports with neither field, or a PIN that doesn't match any existing staff record).
    const matchedStaff = row.staffIdRaw
      ? matchStaffById(row.staffIdRaw, staff)
      : row.kioskPinRaw
        ? (matchStaffByPin(row.kioskPinRaw, staff, staffSecretsByStaffId) || matchStaffByName(row.employeeNameRaw, staff))
        : matchStaffByName(row.employeeNameRaw, staff);
    row.matchedStaffId = matchedStaff?.id || null;
    row.autoMatchedStaffId = matchedStaff?.id || null;

    if (!matchedStaff) {
      row.flags.push({
        code: 'UNMATCHED_STAFF',
        severity: 'warning',
        message: row.staffIdRaw
          ? `Staff ID "${row.staffIdRaw}" doesn't match an existing staff profile. Will import unlinked — no profile will be auto-created.`
          : row.kioskPinRaw
            ? `Kiosk PIN "${row.kioskPinRaw}" doesn't match an existing staff profile, and "${row.employeeNameRaw}" doesn't match by name either. Will import unlinked — no profile will be auto-created.`
            : `"${row.employeeNameRaw}" doesn't match an existing staff profile. Will import unlinked — no profile will be auto-created.`
      });
    }

    const dupes = duplicateIdentities.get(row.employeeNameRaw);
    if (dupes && dupes.length > 0) {
      row.flags.push({
        code: 'POSSIBLE_DUPLICATE_IDENTITY',
        severity: 'warning',
        message: `"${row.employeeNameRaw}" looks like it may be the same person as: ${dupes.join(', ')}. Confirm before import.`
      });
    }

    if (row.rowCount > 1) {
      row.flags.push({
        code: 'MULTIPLE_ROWS_MERGED',
        severity: 'warning',
        message: `${row.rowCount} rows for "${row.employeeNameRaw}" in this file were summed into one weekly figure.`
      });
    }

    if (coverageStartKey) {
      const identity = matchedStaff?.id || normalizeName(row.employeeNameRaw);
      if (existingKeys.has(`${coverageStartKey}::${coverageEndKey}::${identity}`)) {
        const rangeLabel = coverageStartKey === coverageEndKey ? coverageStartKey : `${coverageStartKey} to ${coverageEndKey}`;
        row.flags.push({
          code: 'DUPLICATE_ALREADY_IMPORTED',
          severity: 'warning',
          message: `Payroll Centre data for "${row.employeeNameRaw}" for ${rangeLabel} has already been imported. Re-importing will overwrite the existing real figures for that range.`
        });
      }
    }

    if (row.troncTips !== 0) {
      row.flags.push({
        code: 'TRONC_NONZERO',
        severity: 'warning',
        message: `Tronc/Tips is £${row.troncTips.toFixed(2)} for "${row.employeeNameRaw}" — this app doesn't yet have confirmed handling for non-zero Tronc. Stored for reference only, not included in labour cost. Confirm with Elliott how this should be treated.`
      });
    }

    const hasError = row.flags.some(f => f.severity === 'error');
    const hasDuplicateFlag = row.flags.some(f => f.code === 'POSSIBLE_DUPLICATE_IDENTITY' || f.code === 'DUPLICATE_ALREADY_IMPORTED');
    row.includeByDefault = !hasError && !hasDuplicateFlag;
    return row;
  });

  // Sanity check against the TOTALS row — informational only, never blocks import.
  let sanityCheck: SanityCheckField[] | null = null;
  if (totalsRow) {
    const computedTotals = {
      hoursWorked: employeeRows.reduce((a, r) => a + r.hoursWorked, 0),
      basicWages: employeeRows.reduce((a, r) => a + r.basicWages, 0),
      accruedHolidayPay: employeeRows.reduce((a, r) => a + r.accruedHolidayPay, 0),
      employerNI: employeeRows.reduce((a, r) => a + r.employerNI, 0),
      employerPension: employeeRows.reduce((a, r) => a + r.employerPension, 0),
    };
    const reportedTotals = {
      hoursWorked: parseFloat(totalsRow['Hours Worked']) || 0,
      basicWages: parseMoney(totalsRow['Basic Wages (£)']),
      accruedHolidayPay: parseMoney(totalsRow['Accrued Holiday Pay (£)']),
      employerNI: parseMoney(totalsRow['Employer NI (£)']),
      employerPension: parseMoney(totalsRow['Employer Pension (£)']),
    };
    sanityCheck = (Object.keys(computedTotals) as (keyof typeof computedTotals)[]).map(field => ({
      field,
      computed: computedTotals[field],
      reported: reportedTotals[field],
      matches: Math.abs(computedTotals[field] - reportedTotals[field]) <= TOLERANCE
    }));
  }

  return {
    weekStart: parsedCoverage?.coverageStart || null,
    weekEnd: parsedCoverage?.coverageEnd || null,
    constituentWeeks,
    weekLabel: firstRunType,
    weekParseError,
    weekAlignmentWarning,
    employeeRows,
    totalsRowFound: !!totalsRow,
    sanityCheck
  };
}
