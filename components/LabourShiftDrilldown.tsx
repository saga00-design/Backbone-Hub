import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LabourShift, PayrollCentreWeekRecord } from '../types';
import { getWeekStart, toDateKey, parseDateKey } from '../utils/fiscalCalendar';

interface LabourShiftDrilldownProps {
  label: string;
  shifts: LabourShift[]; // already filtered to the drilled-into date range
  payrollCentreRecords: PayrollCentreWeekRecord[];
  onBack: () => void;
}

const money = (v: number) => `£${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dayName = (date: string): string => {
  try {
    return parseDateKey(date).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short' });
  } catch {
    return '';
  }
};

// Real NI/Pension/Holiday Accrual only exists at staff+week granularity (one Payroll Centre
// row per employee per week — see PayrollCentreWeekRecord). Pulling it "down" to shift level
// means showing that employee's real week figure on each of their shifts that week, not
// dividing it — there's no per-shift breakdown in the source data to divide from.
function findWeekRecord(
  records: PayrollCentreWeekRecord[],
  staffId: string | null | undefined,
  date: string
): PayrollCentreWeekRecord | null {
  if (!staffId) return null;
  const weekKey = toDateKey(getWeekStart(parseDateKey(date)));
  return records.find(r => r.staffId === staffId && r.weekStartDate === weekKey) || null;
}

export const LabourShiftDrilldown: React.FC<LabourShiftDrilldownProps> = ({ label, shifts, payrollCentreRecords, onBack }) => {
  const hasAnyRealData = shifts.some(s => findWeekRecord(payrollCentreRecords, s.staffId, s.date));

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] font-black text-text-muted hover:text-text-navy uppercase tracking-widest mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Summary
      </button>
      <h4 className="text-sm font-black text-text-navy uppercase tracking-wide mb-1">{label} — Individual Shifts</h4>
      {hasAnyRealData && (
        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-3 normal-case">
          NI/Pension/Holiday Accrual show that employee's real Payroll Centre total for the whole week — repeated on each of
          their shifts that week, not split per shift. Shifts only covered by the Rota estimate show "Not yet available".
        </p>
      )}
      <div className="border border-border-grey rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-secondary-surface z-10">
              <tr className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Hours Scheduled</th>
                <th className="px-4 py-3">Hourly Rate</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3">Holiday Accrual</th>
                <th className="px-4 py-3">Employer NI</th>
                <th className="px-4 py-3">Employer Pension</th>
                <th className="px-4 py-3">Employee NI</th>
                <th className="px-4 py-3">Employee Pension</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-grey">
              {shifts.map(s => {
                const real = findWeekRecord(payrollCentreRecords, s.staffId, s.date);
                const notYet = <span className="text-text-muted/50 italic normal-case">Not yet available</span>;
                return (
                  <tr key={s.id} className="hover:bg-secondary-surface/50 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">
                      {s.employeeName}
                      {!s.staffId && <span className="ml-2 text-[9px] font-bold text-amber-600 uppercase">Unmatched</span>}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{dayName(s.date)}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{s.role}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{s.durationHours.toFixed(2)}h</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{money(s.wageRate)}</td>
                    <td className="px-4 py-2.5 font-bold text-text-navy whitespace-nowrap">{money(s.totalCost)}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{real ? money(real.accruedHolidayPay) : notYet}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{real ? money(real.employerNI) : notYet}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{real ? money(real.employerPension) : notYet}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{real ? money(real.employeeNI) : notYet}</td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{real ? money(real.employeePension) : notYet}</td>
                  </tr>
                );
              })}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-text-muted font-bold text-xs">
                    No shifts in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
