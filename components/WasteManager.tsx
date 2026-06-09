import React, { useState, useMemo } from 'react';
import { Trash2, Plus, Search, Calendar, User, FileText, Download, Filter, ArrowUpDown, Trash, X } from 'lucide-react';
import { InventoryItem, WasteRecord, Unit } from '../types';
import { toast } from 'sonner';
import { convertToBaseUnit } from '../utils/unitConversions';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';

interface WasteManagerProps {
  inventoryItems: InventoryItem[];
  wasteRecords: WasteRecord[];
  onSaveWaste: (record: WasteRecord) => void;
  onDeleteWaste: (id: string) => void;
  isDarkMode?: boolean;
  checkPermission: (module: string, action: string) => boolean;
}

export const WasteManager: React.FC<WasteManagerProps> = ({
  inventoryItems,
  wasteRecords,
  onSaveWaste,
  onDeleteWaste,
  isDarkMode,
  checkPermission
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReason, setFilterReason] = useState('all');
  
  // Form state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [staffName, setStaffName] = useState('');

  const selectedItem = useMemo(() => 
    inventoryItems.find(item => item.id === selectedItemId),
    [inventoryItems, selectedItemId]
  );

  const filteredRecords = useMemo(() => {
    return wasteRecords
      .filter(record => {
        const matchesSearch = record.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (record.staffName?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesReason = filterReason === 'all' || record.reason === filterReason;
        return matchesSearch && matchesReason;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wasteRecords, searchTerm, filterReason]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || quantity === '' || !reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const baseQty = convertToBaseUnit(Number(quantity), selectedItem.unit as Unit, selectedItem.unitSize);
    
    const newRecord: WasteRecord = {
      id: `waste-${Date.now()}`,
      inventoryItemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity: Number(quantity),
      baseQuantity: baseQty,
      unit: selectedItem.unit,
      reason,
      cost: selectedItem.pricePerUnit * baseQty,
      date: new Date().toISOString(),
      staffId: 'current-user', // In a real app, this would be the actual user ID
      staffName: staffName || 'System'
    };

    onSaveWaste(newRecord);
    toast.success('Waste record saved');
    resetForm();
  };

  const resetForm = () => {
    setSelectedItemId('');
    setQuantity('');
    setReason('');
    setStaffName('');
    setIsFormOpen(false);
  };

  const generatePDF = (record?: WasteRecord) => {
    const doc = new jsPDF() as any;
    const recordsToPrint = record ? [record] : filteredRecords;
    
    doc.setFontSize(20);
    doc.text('Waste Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableData = recordsToPrint.map(r => [
      new Date(r.date).toLocaleDateString(),
      r.itemName,
      `${r.quantity} ${r.unit}`,
      r.reason,
      `£${r.cost.toFixed(2)}`,
      r.staffName || 'N/A'
    ]);

    doc.autoTable({
      startY: 40,
      head: [['Date', 'Item', 'Quantity', 'Reason', 'Cost', 'Staff']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: [79, 70, 229] }, // Indigo-600
    });

    const totalCost = recordsToPrint.reduce((sum, r) => sum + r.cost, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 40;
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Waste Cost: £${totalCost.toFixed(2)}`, 14, finalY + 10);

    doc.save(`waste-report-${Date.now()}.pdf`);
  };

  const reasons = ['Expired', 'Damaged', 'Spilled', 'Quality Issue', 'Incorrect Prep', 'Other'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-text-navy'}`}>Waste Records</h2>
          <p className="text-sm text-text-muted">Track and analyze inventory waste to improve margins</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generatePDF()}
            className="flex items-center gap-2 px-4 py-2 bg-card-bg dark:bg-slate-800 border border-border-grey dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-secondary-surface dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cta text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Waste
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Total Waste Cost</p>
          <p className="text-2xl font-bold text-cta">£{wasteRecords.reduce((sum, r) => sum + r.cost, 0).toFixed(2)}</p>
        </div>
        <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Total Items Wasted</p>
          <p className="text-2xl font-bold text-text-navy dark:text-white">{wasteRecords.length}</p>
        </div>
        <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Most Common Reason</p>
          <p className="text-2xl font-bold text-accent">
            {reasons.map(r => ({
              reason: r,
              count: wasteRecords.filter(rec => rec.reason === r).length
            })).sort((a, b) => b.count - a.count)[0]?.reason || 'N/A'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search waste records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            className="px-4 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all min-w-[150px]"
          >
            <option value="all">All Reasons</option>
            {reasons.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-card-bg dark:bg-slate-800 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-grey dark:border-slate-700 bg-secondary-surface/50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Item</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Reason</th>
                {checkPermission('inventory', 'viewCosts') && (
                  <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Cost</th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Staff</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-grey dark:divide-slate-700">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-secondary-surface dark:hover:bg-slate-700/50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-text-navy dark:text-slate-300">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-text-navy dark:text-white">{record.itemName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-navy dark:text-slate-300">
                      {record.quantity} {record.unit}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        record.reason === 'Expired' ? 'bg-error/10 text-cta' :
                        record.reason === 'Damaged' ? 'bg-warning/10 text-warning-text' :
                        'bg-accent/10 text-accent'
                      }`}>
                        {record.reason}
                      </span>
                    </td>
                    {checkPermission('inventory', 'viewCosts') && (
                      <td className="px-6 py-4 text-sm font-bold text-cta">
                        £{record.cost.toFixed(2)}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {record.staffName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => generatePDF(record)}
                          className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteWaste(record.id)}
                          className="p-2 text-text-muted hover:text-cta hover:bg-error/10 rounded-lg transition-colors"
                          title="Delete Record"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <Trash2 className="w-8 h-8 opacity-20" />
                      <p>No waste records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Waste Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-navy/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border-grey dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-text-navy dark:text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-cta" />
                  Record Waste
                </h3>
                <button onClick={resetForm} className="p-2 hover:bg-secondary-surface dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Inventory Item</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                    required
                  >
                    <option value="">Select an item...</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Quantity</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                        placeholder="0.00"
                        required
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted uppercase">
                        {selectedItem?.unit || 'unit'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Reason</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                      required
                    >
                      <option value="">Select reason...</option>
                      {reasons.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Staff Member (Optional)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                      placeholder="Enter staff name"
                    />
                  </div>
                </div>

                {selectedItem && quantity !== '' && (
                  <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-muted">Estimated Waste Cost:</span>
                      <span className="text-lg font-bold text-cta">
                        £{(selectedItem.pricePerUnit * convertToBaseUnit(Number(quantity), selectedItem.unit as Unit, selectedItem.unitSize)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-6 py-3 bg-secondary-surface dark:bg-slate-700 text-text-navy dark:text-white rounded-xl font-bold hover:bg-border-grey dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-cta text-white rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-cta/20"
                  >
                    Save Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
