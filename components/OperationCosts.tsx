import React, { useState } from 'react';
import { ReceiptPoundSterling, Calculator } from 'lucide-react';
import { ExpenseManager } from './ExpenseManager';
import { WeeklyCostEntry } from './WeeklyCostEntry';
import { PageHeader } from './PageHeader';
import { ExpenseRecord } from '../types';

interface OperationCostsProps {
  expenseRecords: ExpenseRecord[];
  onSaveExpense: (record: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
  isDarkMode?: boolean;
}

// Wrapper for the renamed "Operation Costs" nav section. The existing expense-tracking
// approval workflow (ExpenseManager) is unchanged — it just lives under the "Expense
// Tracking" tab here now. "P&L Cost Entry" is the new manual, weekly-scoped line-item form
// with Period/Monthly/Quarterly rollup views.
export const OperationCosts: React.FC<OperationCostsProps> = ({
  expenseRecords,
  onSaveExpense,
  onDeleteExpense,
  isDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<'tracking' | 'pnl_entry'>('tracking');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ReceiptPoundSterling}
        title="Operation Costs"
        subtitle="Expense approvals and weekly P&L cost entry"
      />

      <div className="flex items-center gap-2 bg-secondary-surface dark:bg-slate-900 p-1 rounded-xl w-fit border border-border-grey dark:border-slate-700">
        {[
          { id: 'tracking' as const, label: 'Expense Tracking', icon: ReceiptPoundSterling },
          { id: 'pnl_entry' as const, label: 'P&L Cost Entry', icon: Calculator }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-card-bg dark:bg-slate-800 text-accent shadow-sm border border-border-grey dark:border-slate-700'
                : 'text-text-muted hover:text-text-navy dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tracking' && (
        <ExpenseManager
          expenseRecords={expenseRecords}
          onSaveExpense={onSaveExpense}
          onDeleteExpense={onDeleteExpense}
          isDarkMode={isDarkMode}
        />
      )}

      {activeTab === 'pnl_entry' && <WeeklyCostEntry />}
    </div>
  );
};
