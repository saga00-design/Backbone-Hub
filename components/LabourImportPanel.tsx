import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Upload, AlertTriangle, AlertCircle, CheckCircle2, History, Shield, UserPlus } from 'lucide-react';
import { Button } from './Button';
import { StaffMember } from '../types';
import {
  RotaCsvRow,
  ParsedShiftRow,
  validateRotaCsvHeaders,
  buildRotaImportPreview,
  commitRotaImport
} from '../services/labourImportService';

interface LabourImportPanelProps {
  staff: StaffMember[];
  importLogs: any[];
  onImported?: () => void;
}

const flagBadgeClass = (severity: 'error' | 'warning') =>
  severity === 'error'
    ? 'bg-cta/10 text-cta border-cta/20'
    : 'bg-amber-50 text-amber-700 border-amber-200';

export const LabourImportPanel: React.FC<LabourImportPanelProps> = ({ staff, importLogs, onImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [headerError, setHeaderError] = useState<string[] | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedShiftRow[]>([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());
  const [staffOverrides, setStaffOverrides] = useState<Map<number, string | null>>(new Map());
  const [committing, setCommitting] = useState(false);

  const resetToUpload = () => {
    setStep('upload');
    setHeaderError(null);
    setPreviewRows([]);
    setSelectedRowIndexes(new Set());
    setStaffOverrides(new Map());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<RotaCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { valid, missing } = validateRotaCsvHeaders(results.meta.fields || []);
        if (!valid) {
          setHeaderError(missing);
          return;
        }
        setHeaderError(null);
        const rows = buildRotaImportPreview(results.data, staff);
        setPreviewRows(rows);
        setSelectedRowIndexes(new Set(rows.filter(r => r.includeByDefault).map(r => r.rowIndex)));
        setStep('preview');
      },
      error: () => {
        toast.error('Could not read this file. Please check it is a valid CSV.');
      }
    });
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
  const unmatchedCount = previewRows.filter(r => r.flags.some(f => f.code === 'UNMATCHED_STAFF')).length;

  if (step === 'upload') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div
          className="w-full max-w-xl border-2 border-dashed border-border-grey rounded-3xl p-16 text-center hover:border-accent transition-all cursor-pointer bg-secondary-surface group"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform border border-border-grey">
            <Upload className="w-10 h-10 text-accent" />
          </div>
          <h3 className="text-xl font-black text-text-navy uppercase tracking-tight">Upload Rota Export CSV</h3>
          <p className="text-sm text-text-muted font-bold uppercase tracking-widest mt-2 px-8 leading-relaxed">
            Date, Day, Employee Name, Role, Department, Start/End Time, Break, Hours, Wage, Cost
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
            <p className="text-xs text-text-muted font-bold">
              This file is missing expected column{headerError.length !== 1 ? 's' : ''}: {headerError.join(', ')}
            </p>
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

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
          <div className="p-6 bg-secondary-surface rounded-2xl border border-border-grey text-center">
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Nothing Saves on Upload</p>
            <p className="text-[10px] text-text-muted mt-2 font-bold leading-relaxed">You review and confirm every row before anything is written.</p>
          </div>
          <div className="p-6 bg-secondary-surface rounded-2xl border border-border-grey text-center">
            <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Staff Matching</p>
            <p className="text-[10px] text-text-muted mt-2 font-bold leading-relaxed">Matched by name against existing profiles — never auto-created.</p>
          </div>
          <div className="p-6 bg-secondary-surface rounded-2xl border border-border-grey text-center">
            <div className="w-10 h-10 bg-cta/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5 text-cta" />
            </div>
            <p className="text-[10px] font-black text-text-navy uppercase tracking-widest">Mismatches Flagged</p>
            <p className="text-[10px] text-text-muted mt-2 font-bold leading-relaxed">Hours, cost, rate and possible duplicate identities are surfaced per row.</p>
          </div>
        </div>
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
