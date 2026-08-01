import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Upload, AlertTriangle, AlertCircle, CheckCircle2, History, UserPlus, HelpCircle } from 'lucide-react';
import { Button } from './Button';
import { StaffMember, LabourShift, PayrollCentreWeekRecord } from '../types';
import {
  RotaCsvRow,
  ParsedShiftRow,
  validateRotaCsvHeaders,
  buildRotaImportPreview,
  commitRotaImport,
  PayrollCentreCsvRow,
  PayrollCentreEmployeeRow,
  PayrollCentreImportPreview,
  validatePayrollCentreCsvHeaders,
  buildPayrollCentreImportPreview,
  commitPayrollCentreImport
} from '../services/labourImportService';
import { toDateKey } from '../utils/fiscalCalendar';

interface LabourImportPanelProps {
  staff: StaffMember[];
  shifts: LabourShift[];
  payrollCentreRecords: PayrollCentreWeekRecord[];
  importLogs: any[];
  onImported?: () => void;
}

interface HeaderMismatch {
  rotaMissing: string[];
  payrollCentreMissing: string[];
}

const flagBadgeClass = (severity: 'error' | 'warning') =>
  severity === 'error'
    ? 'bg-cta/10 text-cta border-cta/20'
    : 'bg-amber-50 text-amber-700 border-amber-200';

export const LabourImportPanel: React.FC<LabourImportPanelProps> = ({ staff, shifts, payrollCentreRecords, importLogs, onImported }) => {
  // One upload box, one file input — the uploaded file's headers decide which of the two
  // known formats it is (see handleFileUpload below). Each format still has its own preview/
  // commit state below so neither flow can clobber the other's in-progress preview; only the
  // upload ENTRY POINT and its error messaging are unified.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [headerError, setHeaderError] = useState<HeaderMismatch | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<ParsedShiftRow[]>([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());
  const [staffOverrides, setStaffOverrides] = useState<Map<number, string | null>>(new Map());
  const [committing, setCommitting] = useState(false);

  const [pcPreview, setPcPreview] = useState<PayrollCentreImportPreview | null>(null);
  const [pcSelectedKeys, setPcSelectedKeys] = useState<Set<string>>(new Set());
  const [pcStaffOverrides, setPcStaffOverrides] = useState<Map<string, string | null>>(new Map());
  const [pcCommitting, setPcCommitting] = useState(false);

  const resetToUpload = () => {
    setStep('upload');
    setHeaderError(null);
    setParseError(null);
    setPreviewRows([]);
    setSelectedRowIndexes(new Set());
    setStaffOverrides(new Map());
    setPcPreview(null);
    setPcSelectedKeys(new Set());
    setPcStaffOverrides(new Map());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // A bad/empty/malformed CSV must never throw uncaught to the app-wide error boundary — every
  // stage (starting the parse, the parse callback, and the row-building step it drives) is
  // wrapped so any failure degrades to a friendly inline message instead. Same defensive
  // pattern as the fetchSettings/onSnapshot crash fixes elsewhere this session.
  //
  // Format detection: try Rota's exact header set first, then Payroll Centre's — whichever
  // matches ALL of its expected columns wins. The two sets share only "Employee Name"/
  // "Department", so a false-positive match between them isn't realistically possible.
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeaderError(null);
    setParseError(null);

    try {
      Papa.parse<any>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const fields = results.meta.fields || [];
            const rota = validateRotaCsvHeaders(fields);
            const payrollCentre = validatePayrollCentreCsvHeaders(fields);

            if (rota.valid) {
              if (!results.data || results.data.length === 0) {
                setParseError('No valid rows found in this file.');
                return;
              }
              const rows = buildRotaImportPreview(results.data as RotaCsvRow[], staff, shifts);
              setPreviewRows(rows);
              setSelectedRowIndexes(new Set(rows.filter(r => r.includeByDefault).map(r => r.rowIndex)));
              setStep('preview');
              return;
            }

            if (payrollCentre.valid) {
              if (!results.data || results.data.length === 0) {
                setParseError('No valid rows found in this file.');
                return;
              }
              const preview = buildPayrollCentreImportPreview(results.data as PayrollCentreCsvRow[], staff, payrollCentreRecords);
              if (preview.weekParseError) {
                setParseError(preview.weekParseError);
                return;
              }
              setPcPreview(preview);
              setPcSelectedKeys(new Set(preview.employeeRows.filter(r => r.includeByDefault).map(r => r.employeeNameRaw)));
              setStep('preview');
              return;
            }

            // Neither format matched — describe both accepted formats, not just one.
            setHeaderError({ rotaMissing: rota.missing, payrollCentreMissing: payrollCentre.missing });
          } catch (err) {
            console.error('[LabourImportPanel] Failed to process parsed CSV rows:', err);
            setParseError("This file doesn't match either expected format.");
          }
        },
        error: (err) => {
          console.error('[LabourImportPanel] CSV parse error:', err);
          setParseError('Could not read this file. Please check it is a valid CSV.');
        }
      });
    } catch (err) {
      console.error('[LabourImportPanel] Unexpected error starting CSV parse:', err);
      setParseError("This file doesn't match either expected format.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleRow = (idx: number) => {
    setSelectedRowIndexes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const setOverride = (idx: number, staffId: string) => {
    setStaffOverrides(prev => {
      const next = new Map(prev);
      next.set(idx, staffId || null);
      return next;
    });
  };

  const resolvedStaffId = (row: ParsedShiftRow) =>
    staffOverrides.has(row.rowIndex) ? staffOverrides.get(row.rowIndex) ?? null : row.matchedStaffId;

  const handleConfirmImport = async () => {
    setCommitting(true);
    try {
      const { importedCount, skippedCount } = await commitRotaImport(previewRows, selectedRowIndexes, staffOverrides, staff);
      toast.success(`Import complete: ${importedCount} shifts added.${skippedCount > 0 ? ` ${skippedCount} rows skipped.` : ''}`);
      resetToUpload();
      onImported?.();
    } catch (err) {
      console.error(err);
      toast.error('Import failed. Please try again.');
    } finally {
      setCommitting(false);
    }
  };

  const errorRowCount = previewRows.filter(r => r.flags.some(f => f.severity === 'error')).length;
  const duplicateIdentityCount = previewRows.filter(r => r.flags.some(f => f.code === 'POSSIBLE_DUPLICATE_IDENTITY')).length;
  const alreadyImportedCount = previewRows.filter(r => r.flags.some(f => f.code === 'DUPLICATE_ALREADY_IMPORTED')).length;
  const unmatchedCount = previewRows.filter(r => r.flags.some(f => f.code === 'UNMATCHED_STAFF')).length;

  const togglePcRow = (key: string) => {
    setPcSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const setPcOverride = (key: string, staffId: string) => {
    setPcStaffOverrides(prev => {
      const next = new Map(prev);
      next.set(key, staffId || null);
      return next;
    });
  };

  const resolvedPcStaffId = (row: PayrollCentreEmployeeRow) =>
    pcStaffOverrides.has(row.employeeNameRaw) ? pcStaffOverrides.get(row.employeeNameRaw) ?? null : row.matchedStaffId;

  const handleConfirmPcImport = async () => {
    if (!pcPreview || !pcPreview.weekStart || !pcPreview.weekEnd) return;
    setPcCommitting(true);
    try {
      const { importedCount, skippedCount } = await commitPayrollCentreImport(
        pcPreview.employeeRows,
        pcSelectedKeys,
        pcStaffOverrides,
        toDateKey(pcPreview.weekStart),
        toDateKey(pcPreview.weekEnd)
      );
      toast.success(`Import complete: ${importedCount} employees added.${skippedCount > 0 ? ` ${skippedCount} rows skipped.` : ''}`);
      resetToUpload();
      onImported?.();
    } catch (err) {
      console.error(err);
      toast.error('Import failed. Please try again.');
    } finally {
      setPcCommitting(false);
    }
  };

  const pcErrorRowCount = pcPreview?.employeeRows.filter(r => r.flags.some(f => f.severity === 'error')).length || 0;
  const pcDuplicateIdentityCount = pcPreview?.employeeRows.filter(r => r.flags.some(f => f.code === 'POSSIBLE_DUPLICATE_IDENTITY')).length || 0;
  const pcAlreadyImportedCount = pcPreview?.employeeRows.filter(r => r.flags.some(f => f.code === 'DUPLICATE_ALREADY_IMPORTED')).length || 0;
  const pcUnmatchedCount = pcPreview?.employeeRows.filter(r => r.flags.some(f => f.code === 'UNMATCHED_STAFF')).length || 0;

  if (step === 'preview' && pcPreview) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">
              Review Payroll Centre Import — {pcPreview.weekStart && pcPreview.weekEnd
                ? (toDateKey(pcPreview.weekStart) === toDateKey(pcPreview.weekEnd)
                    ? `Day ${toDateKey(pcPreview.weekStart)}`
                    : `${toDateKey(pcPreview.weekStart)} to ${toDateKey(pcPreview.weekEnd)}`)
                : '?'}
            </h3>
            {pcPreview.constituentWeeks.length === 1 && pcPreview.weekStart && toDateKey(pcPreview.weekStart) !== toDateKey(pcPreview.constituentWeeks[0]) && (
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                Rolls up into fiscal week {toDateKey(pcPreview.constituentWeeks[0])} — other days in this week can be imported separately and will accumulate.
              </p>
            )}
            {pcPreview.constituentWeeks.length > 1 && (
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                Spans {pcPreview.constituentWeeks.length} fiscal weeks (starting {toDateKey(pcPreview.constituentWeeks[0])}) — each employee's figures are split evenly across these weeks, so partial imports for individual weeks/days will accumulate correctly rather than double-count.
              </p>
            )}
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
              {pcSelectedKeys.size} selected to import
              {pcErrorRowCount > 0 && <span className="text-cta"> · {pcErrorRowCount} with errors</span>}
              {pcDuplicateIdentityCount > 0 && <span className="text-amber-600"> · {pcDuplicateIdentityCount} possible duplicate identity</span>}
              {pcAlreadyImportedCount > 0 && <span className="text-amber-600"> · {pcAlreadyImportedCount} already imported</span>}
              {pcUnmatchedCount > 0 && <span className="text-amber-600"> · {pcUnmatchedCount} unmatched staff</span>}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={resetToUpload} className="h-10 px-4 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
            <Button
              onClick={handleConfirmPcImport}
              disabled={pcCommitting || pcSelectedKeys.size === 0}
              className="h-10 px-6 text-[10px] font-black uppercase tracking-widest"
            >
              {pcCommitting ? 'Importing...' : `Confirm Import (${pcSelectedKeys.size})`}
            </Button>
          </div>
        </div>

        {pcPreview.weekAlignmentWarning && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800">{pcPreview.weekAlignmentWarning}</p>
          </div>
        )}

        {!pcPreview.totalsRowFound && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800">No TOTALS row found in this file — skipping the sanity-check comparison.</p>
          </div>
        )}

        {pcPreview.sanityCheck && pcPreview.sanityCheck.some(c => !c.matches) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs font-bold text-amber-800">
              <p className="mb-1">This file's own TOTALS row doesn't match what Hub computed from the individual rows — import isn't blocked, but worth checking:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {pcPreview.sanityCheck.filter(c => !c.matches).map(c => (
                  <li key={c.field}>{c.field}: Hub computed {c.computed.toFixed(2)}, file's TOTALS says {c.reported.toFixed(2)}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {pcDuplicateIdentityCount > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <UserPlus className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800">
              Possible duplicate identity detected — these rows are unchecked by default. Review the "Matched Staff" column below:
              pick the same existing profile for both names if they're the same person, or leave separate if they genuinely aren't,
              then tick the row(s) to include them.
            </p>
          </div>
        )}

        {pcAlreadyImportedCount > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <History className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800">
              {pcAlreadyImportedCount} employee{pcAlreadyImportedCount !== 1 ? 's' : ''} already have real Payroll Centre data imported
              for this week — unchecked by default. Only tick a flagged row if you're intentionally correcting that week's real figures.
            </p>
          </div>
        )}

        <div className="overflow-x-auto border border-border-grey rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary-surface">
              <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3">Employee (source)</th>
                <th className="px-3 py-3">Matched Staff</th>
                <th className="px-3 py-3">Compliance</th>
                <th className="px-3 py-3">Hours</th>
                <th className="px-3 py-3">Basic Wages</th>
                <th className="px-3 py-3">Holiday Accrual</th>
                <th className="px-3 py-3">Employer NI</th>
                <th className="px-3 py-3">Employer Pension</th>
                <th className="px-3 py-3">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-grey">
              {pcPreview.employeeRows.map(row => (
                <tr key={row.employeeNameRaw} className={row.flags.some(f => f.severity === 'error') ? 'bg-cta/5' : row.flags.length > 0 ? 'bg-amber-50/40' : ''}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={pcSelectedKeys.has(row.employeeNameRaw)}
                      onChange={() => togglePcRow(row.employeeNameRaw)}
                      className="h-3.5 w-3.5 rounded border-border-grey accent-accent cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-black text-text-navy">{row.employeeNameRaw}</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase">{row.department}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={resolvedPcStaffId(row) || ''}
                      onChange={(e) => setPcOverride(row.employeeNameRaw, e.target.value)}
                      className={`text-[10px] font-bold rounded-lg border px-2 py-1.5 min-w-[160px] ${
                        row.flags.some(f => f.code === 'POSSIBLE_DUPLICATE_IDENTITY') ? 'border-amber-300 bg-amber-50' : 'border-border-grey bg-white'
                      }`}
                    >
                      <option value="">— Unmatched (import unlinked) —</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.complianceStatus !== null && (
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border w-fit ${
                        row.complianceStatus.toLowerCase() === 'compliant' ? 'bg-success/10 text-success border-success/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {row.complianceStatus || 'Unknown'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-text-navy whitespace-nowrap">{row.hoursWorked.toFixed(2)}h</td>
                  <td className="px-3 py-2.5 font-bold text-text-navy whitespace-nowrap">£{row.basicWages.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">£{row.accruedHolidayPay.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">£{row.employerNI.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">£{row.employerPension.toFixed(2)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      {row.flags.length === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                      {row.flags.map((f, i) => (
                        <span key={i} title={f.message} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border w-fit ${flagBadgeClass(f.severity)}`}>
                          {f.code.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div
          className="w-full max-w-xl border-2 border-dashed border-border-grey rounded-3xl p-8 text-center hover:border-accent transition-all cursor-pointer bg-secondary-surface group"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-border-grey">
            <Upload className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-lg font-black text-text-navy uppercase tracking-tight">Upload Shift Data CSV</h3>
          <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-2 px-4 leading-relaxed flex items-center justify-center gap-1.5">
            Rota and Payroll Centre formats both auto-detected
            <span
              onClick={(e) => e.stopPropagation()}
              className="relative inline-flex group/tip"
            >
              <HelpCircle className="h-3.5 w-3.5 text-text-muted/60 hover:text-accent transition-colors cursor-help" />
              <span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-80 -translate-x-1/2 rounded-xl bg-text-navy text-white p-4 opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip:opacity-100 normal-case text-left">
                <span className="block space-y-2 text-[11px] leading-snug">
                  <span className="block">
                    <strong className="text-white block mb-0.5">Rota Export</strong>
                    Date, Day, Employee Name, Role, Department, Start/End Time, Break, Hours, Wage, Cost
                  </span>
                  <span className="block">
                    <strong className="text-white block mb-0.5">Payroll Centre</strong>
                    Run Type, Employee Name, Department, Hours Worked, Basic Wages, Holiday Pay, Tronc, Gross Pay, Tax/NI/Pension, Net Take-Home — plus Kiosk PIN and/or Compliance when the export includes them
                  </span>
                  <span className="block text-white/60">Payroll Centre (real payroll) replaces the Rota estimate for any week it covers.</span>
                </span>
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-text-navy" />
              </span>
            </span>
          </p>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
            onChange={handleFileUpload}
          />
        </div>

        {headerError && (
          <div className="mt-8 p-4 bg-cta/5 border border-cta/20 rounded-2xl w-full max-w-xl">
            <p className="text-[10px] font-black text-cta uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> Unrecognized file format
            </p>
            <p className="text-xs text-text-muted font-bold mb-2">
              This file doesn't match either accepted format:
            </p>
            <p className="text-xs text-text-muted font-bold mb-1">
              <span className="font-black text-text-navy">Rota Export</span> — missing: {headerError.rotaMissing.join(', ')}
            </p>
            <p className="text-xs text-text-muted font-bold">
              <span className="font-black text-text-navy">Payroll Centre</span> — missing: {headerError.payrollCentreMissing.join(', ')}
            </p>
          </div>
        )}

        {parseError && (
          <div className="mt-8 p-4 bg-cta/5 border border-cta/20 rounded-2xl w-full max-w-xl">
            <p className="text-[10px] font-black text-cta uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> Couldn't import this file
            </p>
            <p className="text-xs text-text-muted font-bold">{parseError}</p>
          </div>
        )}

        {importLogs.length > 0 && (
          <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-center justify-between w-full max-w-xl">
            <div className="flex items-center gap-3">
              <History className="w-4 h-4 text-accent" />
              <div>
                <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Last Successful Import</p>
                <p className="text-xs font-bold text-text-muted italic">{importLogs[0].dateRange} ({importLogs[0].count} shifts)</p>
              </div>
            </div>
            <span className="text-[9px] font-black text-text-muted uppercase bg-white px-2 py-1 rounded border border-border-grey shadow-sm">
              {new Date(importLogs[0].timestamp).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Review Import — {previewRows.length} Rows</h3>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
            {selectedRowIndexes.size} selected to import
            {errorRowCount > 0 && <span className="text-cta"> · {errorRowCount} with errors</span>}
            {duplicateIdentityCount > 0 && <span className="text-amber-600"> · {duplicateIdentityCount} possible duplicate identity</span>}
            {alreadyImportedCount > 0 && <span className="text-amber-600"> · {alreadyImportedCount} already imported</span>}
            {unmatchedCount > 0 && <span className="text-amber-600"> · {unmatchedCount} unmatched staff</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={resetToUpload} className="h-10 px-4 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
          <Button
            onClick={handleConfirmImport}
            disabled={committing || selectedRowIndexes.size === 0}
            className="h-10 px-6 text-[10px] font-black uppercase tracking-widest"
          >
            {committing ? 'Importing...' : `Confirm Import (${selectedRowIndexes.size})`}
          </Button>
        </div>
      </div>

      {duplicateIdentityCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <UserPlus className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-800">
            Possible duplicate identity detected — these rows are unchecked by default. Review the "Matched Staff" column below:
            pick the same existing profile for both names if they're the same person, or leave separate if they genuinely aren't,
            then tick the row(s) to include them.
          </p>
        </div>
      )}

      {alreadyImportedCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <History className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-800">
            {alreadyImportedCount} row{alreadyImportedCount !== 1 ? 's' : ''} match a shift already imported for that employee and date —
            unchecked by default so re-importing this file doesn't silently double their hours and cost. Only tick a flagged row
            if you're intentionally correcting or replacing an earlier import.
          </p>
        </div>
      )}

      <div className="overflow-x-auto border border-border-grey rounded-2xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary-surface">
            <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
              <th className="px-3 py-3 w-8"></th>
              <th className="px-3 py-3">Employee (source)</th>
              <th className="px-3 py-3">Matched Staff</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Window</th>
              <th className="px-3 py-3">Hours</th>
              <th className="px-3 py-3">Rate</th>
              <th className="px-3 py-3">Cost</th>
              <th className="px-3 py-3">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-grey">
            {previewRows.map(row => (
              <tr key={row.rowIndex} className={row.flags.some(f => f.severity === 'error') ? 'bg-cta/5' : row.flags.length > 0 ? 'bg-amber-50/40' : ''}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedRowIndexes.has(row.rowIndex)}
                    onChange={() => toggleRow(row.rowIndex)}
                    className="h-3.5 w-3.5 rounded border-border-grey accent-accent cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-black text-text-navy">{row.employeeNameRaw}</p>
                  <p className="text-[9px] font-bold text-text-muted uppercase">{row.role} · {row.department}</p>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={resolvedStaffId(row) || ''}
                    onChange={(e) => setOverride(row.rowIndex, e.target.value)}
                    className={`text-[10px] font-bold rounded-lg border px-2 py-1.5 min-w-[160px] ${
                      row.flags.some(f => f.code === 'POSSIBLE_DUPLICATE_IDENTITY') ? 'border-amber-300 bg-amber-50' : 'border-border-grey bg-white'
                    }`}
                  >
                    <option value="">— Unmatched (import unlinked) —</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5 font-bold text-text-navy whitespace-nowrap">{row.businessDate || '—'}</td>
                <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">{row.shiftWindow}</td>
                <td className="px-3 py-2.5 font-bold text-text-navy whitespace-nowrap">{row.hoursScheduled.toFixed(2)}h</td>
                <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">£{row.hourlyWage.toFixed(2)}</td>
                <td className="px-3 py-2.5 font-bold text-text-navy whitespace-nowrap">£{row.computedCost.toFixed(2)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    {row.flags.length === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                    {row.flags.map((f, i) => (
                      <span key={i} title={f.message} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border w-fit ${flagBadgeClass(f.severity)}`}>
                        {f.code.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
