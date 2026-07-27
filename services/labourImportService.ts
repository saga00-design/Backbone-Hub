import { collection, addDoc } from 'firebase/firestore';
import { db, LOCATION_ID } from '../firebase';
import { StaffMember, LabourShift } from '../types';
import type { ParsedShiftRow } from './labourImportParsing';

export type { RotaCsvRow, RowFlag, ParsedShiftRow } from './labourImportParsing';
export {
  ROTA_CSV_COLUMNS,
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
      source: 'Rota Export CSV',
      shiftWindow: row.shiftWindow
    };

    await addDoc(collection(db, 'labourShifts'), newShift);
    importedCount++;
  }

  const importedDates = Array.from(new Set(
    rows.filter(r => selectedRowIndexes.has(r.rowIndex)).map(r => r.businessDate).filter(Boolean)
  )).sort();

  await addDoc(collection(db, 'importLogs'), {
    locationId: LOCATION_ID,
    type: 'Labour Shift Import',
    importedBy: 'Manager',
    count: importedCount,
    duplicates: 0,
    skipped: skippedCount,
    source: 'Rota Export CSV',
    dateRange: importedDates.length > 0 ? `${importedDates[0]} to ${importedDates[importedDates.length - 1]}` : 'N/A',
    dates: importedDates,
    timestamp: new Date().toISOString()
  });

  return { importedCount, skippedCount };
}
