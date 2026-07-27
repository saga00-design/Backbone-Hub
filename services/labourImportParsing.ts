import { StaffMember } from '../types';
import { getShiftWindowForHour } from '../constants';
import { getBusinessDayFor } from '../utils/businessDay';

// Exact header row of the real external rota/clocking app export.
export const ROTA_CSV_COLUMNS = [
  'Date', 'Day', 'Employee Name', 'Role', 'Department',
  'Start Time', 'End Time', 'Break (Mins)', 'Hours Scheduled',
  'Hourly Wage', 'Estimated Labor Cost'
] as const;

export interface RotaCsvRow {
  Date: string;
  Day: string;
  'Employee Name': string;
  Role: string;
  Department: string;
  'Start Time': string;
  'End Time': string;
  'Break (Mins)': string;
  'Hours Scheduled': string;
  'Hourly Wage': string;
  'Estimated Labor Cost': string;
}

export interface RowFlag {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ParsedShiftRow {
  rowIndex: number;
  raw: RotaCsvRow;
  employeeNameRaw: string;
  matchedStaffId: string | null; // user-confirmable; starts as the auto-match result
  autoMatchedStaffId: string | null;
  role: string;
  department: string;
  businessDate: string; // YYYY-MM-DD, from Date + Start Time via the shared 6am London cutoff
  dayColumnMatches: boolean;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hoursScheduled: number;
  computedHours: number;
  hoursMismatch: boolean;
  hourlyWage: number;
  estimatedLaborCost: number;
  computedCost: number;
  costMismatch: boolean;
  existingProfileRate: number | null;
  rateDiffersFromProfile: boolean;
  shiftWindow: string;
  flags: RowFlag[];
  includeByDefault: boolean;
}

const TOLERANCE_HOURS = 0.05; // ~3 minutes
const TOLERANCE_COST = 0.05; // pence-level rounding

export function validateRotaCsvHeaders(fields: string[]): { valid: boolean; missing: string[] } {
  const present = new Set(fields.map(f => f.trim()));
  const missing = ROTA_CSV_COLUMNS.filter(c => !present.has(c));
  return { valid: missing.length === 0, missing };
}

function normalizeName(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function firstToken(name: string): string {
  return normalizeName(name).split(' ')[0] || '';
}

export function matchStaffByName(name: string, staff: StaffMember[]): StaffMember | null {
  const target = normalizeName(name);
  if (!target) return null;
  const targetTokens = target.split(' ').sort().join(' ');

  for (const s of staff) {
    const full = normalizeName(`${s.firstName} ${s.lastName}`);
    if (full === target) return s;
  }
  // Order-agnostic exact token match (e.g. "Rodriguez Elliott" vs "Elliott Rodriguez")
  for (const s of staff) {
    const full = normalizeName(`${s.firstName} ${s.lastName}`);
    const fullTokens = full.split(' ').sort().join(' ');
    if (fullTokens === targetTokens) return s;
  }
  return null;
}

/**
 * Cross-row check for near-duplicate identities (e.g. "ELLIOTT FRIAS" vs "Elliott Rodriguez").
 * Deliberately conservative: flags for human confirmation, never auto-merges or auto-separates.
 * Two buckets:
 *  - exact-duplicate-formatting: same name once normalized, different raw casing/spacing/trailing text
 *  - shared-first-name: same first token, different surname — the real risk case
 */
export function detectDuplicateIdentities(names: string[]): Map<string, string[]> {
  const distinctRaw = Array.from(new Set(names.map(n => (n || '').trim()).filter(Boolean)));
  const result = new Map<string, string[]>();

  for (const name of distinctRaw) {
    const others: string[] = [];
    const normA = normalizeName(name);
    const firstA = firstToken(name);

    for (const other of distinctRaw) {
      if (other === name) continue;
      const normB = normalizeName(other);
      const firstB = firstToken(other);

      if (normA === normB) {
        // identical once normalized (casing/whitespace variant) — same person, different formatting
        others.push(other);
        continue;
      }
      if (firstA && firstA === firstB) {
        // same first name, different overall name — possible duplicate identity, needs confirmation
        others.push(other);
      }
    }
    if (others.length > 0) result.set(name, others);
  }
  return result;
}

function parseTimeToHourFraction(t: string): number {
  const trimmed = (t || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return NaN;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h + m / 60;
}

function computeDurationHours(startTime: string, endTime: string, breakMinutes: number): number {
  const start = parseTimeToHourFraction(startTime);
  const end = parseTimeToHourFraction(endTime);
  if (isNaN(start) || isNaN(end)) return NaN;
  let duration = end - start;
  if (duration < 0) duration += 24; // shift wraps past midnight
  return duration - (breakMinutes / 60);
}

function parseMoney(v: string): number {
  const n = parseFloat((v || '').toString().replace(/[£,]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Parses "Date" (assumed YYYY-MM-DD or DD/MM/YYYY) + "Start Time" into a JS Date. */
function parseRowTimestamp(dateStr: string, startTime: string): Date | null {
  const d = (dateStr || '').trim();
  let iso = d;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    iso = `${yyyy}-${mm}-${dd}`;
  }
  const startFraction = parseTimeToHourFraction(startTime);
  const hh = isNaN(startFraction) ? 0 : Math.floor(startFraction);
  const mm2 = isNaN(startFraction) ? 0 : Math.round((startFraction - hh) * 60);
  const composed = new Date(`${iso}T${String(hh).padStart(2, '0')}:${String(mm2).padStart(2, '0')}:00`);
  return isNaN(composed.getTime()) ? null : composed;
}

function weekdayName(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long' });
}

export function buildRotaImportPreview(csvRows: RotaCsvRow[], staff: StaffMember[]): ParsedShiftRow[] {
  const duplicateIdentities = detectDuplicateIdentities(csvRows.map(r => r['Employee Name']));

  return csvRows.map((raw, rowIndex): ParsedShiftRow => {
    const flags: RowFlag[] = [];
    const employeeNameRaw = (raw['Employee Name'] || '').trim();
    const role = (raw.Role || '').trim();
    const department = (raw.Department || '').trim();

    if (!employeeNameRaw) {
      flags.push({ code: 'MISSING_NAME', severity: 'error', message: 'Missing employee name.' });
    }
    if (!raw.Date) {
      flags.push({ code: 'MISSING_DATE', severity: 'error', message: 'Missing date.' });
    }

    const timestamp = parseRowTimestamp(raw.Date, raw['Start Time']);
    const businessDate = timestamp ? getBusinessDayFor(timestamp) : '';
    if (!timestamp) {
      flags.push({ code: 'INVALID_DATE_TIME', severity: 'error', message: 'Could not parse Date/Start Time.' });
    }

    // Day column is a sanity check only — Date is the source of truth
    let dayColumnMatches = true;
    if (timestamp && raw.Day) {
      const expected = weekdayName(timestamp);
      dayColumnMatches = expected.toLowerCase() === raw.Day.trim().toLowerCase();
      if (!dayColumnMatches) {
        flags.push({
          code: 'DAY_MISMATCH',
          severity: 'warning',
          message: `Day column says "${raw.Day.trim()}" but Date (${raw.Date}) is a ${expected}.`
        });
      }
    }

    const breakMinutes = parseFloat(raw['Break (Mins)']) || 0;
    const hoursScheduled = parseFloat(raw['Hours Scheduled']) || 0;
    const computedHours = computeDurationHours(raw['Start Time'], raw['End Time'], breakMinutes);
    const hoursMismatch = !isNaN(computedHours) && Math.abs(computedHours - hoursScheduled) > TOLERANCE_HOURS;
    if (hoursMismatch) {
      flags.push({
        code: 'HOURS_MISMATCH',
        severity: 'warning',
        message: `Hours Scheduled (${hoursScheduled}h) doesn't match (End − Start − Break) = ${computedHours.toFixed(2)}h.`
      });
    }

    const hourlyWage = parseMoney(raw['Hourly Wage']);
    const estimatedLaborCost = parseMoney(raw['Estimated Labor Cost']);
    const computedCost = Math.round(hoursScheduled * hourlyWage * 100) / 100;
    const costMismatch = Math.abs(computedCost - estimatedLaborCost) > TOLERANCE_COST;
    if (costMismatch) {
      flags.push({
        code: 'COST_MISMATCH',
        severity: 'warning',
        message: `Estimated Labor Cost (£${estimatedLaborCost.toFixed(2)}) doesn't match Hours × Wage (£${computedCost.toFixed(2)}).`
      });
    }

    const matchedStaff = matchStaffByName(employeeNameRaw, staff);
    if (!matchedStaff && employeeNameRaw) {
      flags.push({
        code: 'UNMATCHED_STAFF',
        severity: 'warning',
        message: `"${employeeNameRaw}" doesn't match an existing staff profile. Will import unlinked — no profile will be auto-created.`
      });
    }

    const existingProfileRate = matchedStaff ? matchedStaff.hourlyRate : null;
    const rateDiffersFromProfile = matchedStaff != null && Math.abs((matchedStaff.hourlyRate || 0) - hourlyWage) > TOLERANCE_COST;
    if (rateDiffersFromProfile) {
      flags.push({
        code: 'RATE_DIFFERS_FROM_PROFILE',
        severity: 'warning',
        message: `This row's rate (£${hourlyWage.toFixed(2)}/hr) differs from ${matchedStaff!.firstName}'s profile rate (£${(matchedStaff!.hourlyRate || 0).toFixed(2)}/hr). Could be a legitimate different-role rate — confirm before import.`
      });
    }

    const dupes = duplicateIdentities.get(employeeNameRaw);
    if (dupes && dupes.length > 0) {
      flags.push({
        code: 'POSSIBLE_DUPLICATE_IDENTITY',
        severity: 'warning',
        message: `"${employeeNameRaw}" looks like it may be the same person as: ${dupes.join(', ')}. Confirm before import.`
      });
    }

    const startHour = Math.floor(parseTimeToHourFraction(raw['Start Time']) || 0);
    const shiftWindow = getShiftWindowForHour(startHour).name;

    const hasError = flags.some(f => f.severity === 'error');
    const hasDuplicateFlag = flags.some(f => f.code === 'POSSIBLE_DUPLICATE_IDENTITY');

    return {
      rowIndex,
      raw,
      employeeNameRaw,
      matchedStaffId: matchedStaff?.id || null,
      autoMatchedStaffId: matchedStaff?.id || null,
      role,
      department,
      businessDate,
      dayColumnMatches,
      startTime: raw['Start Time'],
      endTime: raw['End Time'],
      breakMinutes,
      hoursScheduled,
      computedHours,
      hoursMismatch,
      hourlyWage,
      estimatedLaborCost,
      computedCost,
      costMismatch,
      existingProfileRate,
      rateDiffersFromProfile,
      shiftWindow,
      flags,
      includeByDefault: !hasError && !hasDuplicateFlag
    };
  });
}
