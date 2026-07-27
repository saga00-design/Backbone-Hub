import React, { useState, useMemo, useRef } from 'react';
import { Receipt, Plus, Search, Calendar, User, FileText, Download, Filter, ArrowUpDown, Trash, Camera, Upload, X, Image as ImageIcon, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ExpenseRecord } from '../types';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpenseManagerProps {
  expenseRecords: ExpenseRecord[];
  onSaveExpense: (record: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
  isDarkMode?: boolean;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  expenseRecords,
  onSaveExpense,
  onDeleteExpense,
  isDarkMode
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [vatAmount, setVatAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [staffName, setStaffName] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    return expenseRecords
      .filter(record => {
        const matchesSearch = record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || record.category === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenseRecords, searchTerm, filterCategory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for Firestore base64
        toast.error('Image too large. Please use a smaller image (max 500KB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || amount === '' || !description || !vendor) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newRecord: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString(),
      category,
      amount: Number(amount),
      vatAmount: vatAmount === '' ? undefined : Number(vatAmount),
      description,
      vendor,
      receiptImageUrl: receiptImage || undefined,
      paymentMethod,
      staffId: 'current-user',
      staffName: staffName || 'System',
      status: 'Approved' // Default to approved for this version
    };

    onSaveExpense(newRecord);
    toast.success('Expense record saved');
    resetForm();
  };

  const resetForm = () => {
    setCategory('');
    setAmount('');
    setVatAmount('');
    setDescription('');
    setVendor('');
    setPaymentMethod('Card');
    setStaffName('');
    setReceiptImage(null);
    setIsFormOpen(false);
  };

  const generatePDF = (record?: ExpenseRecord) => {
    const doc = new jsPDF() as any;
    const recordsToPrint = record ? [record] : filteredRecords;
    
    doc.setFontSize(20);
    doc.text('Expense Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableData = recordsToPrint.map(r => [
      new Date(r.date).toLocaleDateString(),
      r.vendor,
      r.category,
      r.description,
      `£${r.amount.toFixed(2)}`,
      r.paymentMethod
    ]);

    doc.autoTable({
      startY: 40,
      head: [['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Method']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: [79, 70, 229] },
    });

    const totalAmount = recordsToPrint.reduce((sum, r) => sum + r.amount, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 40;
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Expenses: £${totalAmount.toFixed(2)}`, 14, finalY + 10);

    doc.save(`expense-report-${Date.now()}.pdf`);
  };

  const categories = ['Maintenance', 'Utilities', 'Marketing', 'Supplies', 'Rent', 'Rates', 'Insurance', 'Software', 'Legal & Professional Fees', 'Other'];
  const paymentMethods = ['Card', 'Cash', 'Bank Transfer', 'Direct Debit'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-text-navy'}`}>Expense Tracking</h2>
          <p className="text-sm text-text-muted">Manage business expenses and receipt history</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Total Expenses (MTD)</p>
          <p className="text-2xl font-bold text-cta">£{expenseRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</p>
        </div>
        <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Pending Approval</p>
          <p className="text-2xl font-bold text-warning-text">£{expenseRecords.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</p>
        </div>
        <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Top Category</p>
          <p className="text-2xl font-bold text-accent">
            {categories.map(c => ({
              cat: c,
              amount: expenseRecords.filter(rec => rec.category === c).reduce((sum, r) => sum + r.amount, 0)
            })).sort((a, b) => b.amount - a.amount)[0]?.cat || 'N/A'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-bg dark:bg-slate-800 p-4 rounded-2xl border border-border-grey dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all min-w-[150px]"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
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
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Vendor & Description</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">Status</th>
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
                      <div className="text-sm font-bold text-text-navy dark:text-white">{record.vendor}</div>
                      <div className="text-xs text-text-muted truncate max-w-xs">{record.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-secondary-surface dark:bg-slate-900 rounded-lg text-[10px] font-bold uppercase tracking-wider text-text-muted">
                        {record.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-text-navy dark:text-white">£{record.amount.toFixed(2)}</div>
                      {record.vatAmount && (
                        <div className="text-[10px] text-text-muted">Incl. £{record.vatAmount.toFixed(2)} VAT</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {record.status === 'Approved' ? (
                          <CheckCircle2 className="w-4 h-4 text-accent" />
                        ) : record.status === 'Pending' ? (
                          <Clock className="w-4 h-4 text-warning-text" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-cta" />
                        )}
                        <span className={`text-xs font-bold ${
                          record.status === 'Approved' ? 'text-accent' :
                          record.status === 'Pending' ? 'text-warning-text' :
                          'text-cta'
                        }`}>
                          {record.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {record.receiptImageUrl && (
                          <button
                            onClick={() => {
                              const win = window.open();
                              win?.document.write(`<img src="${record.receiptImageUrl}" style="max-width: 100%;" />`);
                            }}
                            className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => generatePDF(record)}
                          className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteExpense(record.id)}
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
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="w-8 h-8 opacity-20" />
                      <p>No expense records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-navy/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card-bg dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border-grey dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-text-navy dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-accent" />
                  Record Expense
                </h3>
                <button onClick={resetForm} className="p-2 hover:bg-secondary-surface dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Details */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Vendor / Supplier</label>
                      <input
                        type="text"
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                        placeholder="e.g. Amazon, Local Store"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Amount (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">VAT Amount (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={vatAmount}
                          onChange={(e) => setVatAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all"
                        required
                      >
                        <option value="">Select category...</option>
                        {categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-4 py-3 bg-secondary-surface dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent transition-all min-h-[80px]"
                        placeholder="What was this for?"
                        required
                      />
                    </div>
                  </div>

                  {/* Right Column: Receipt & More */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Receipt Image</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                          relative h-[200px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                          ${receiptImage ? 'border-accent bg-accent/5' : 'border-border-grey dark:border-slate-700 hover:border-accent hover:bg-accent/5'}
                        `}
                      >
                        {receiptImage ? (
                          <>
                            <img src={receiptImage} alt="Receipt" className="absolute inset-0 w-full h-full object-contain p-2" />
                            <div className="absolute inset-0 bg-text-navy/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                              <p className="text-white text-xs font-bold">Change Image</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-secondary-surface dark:bg-slate-900 rounded-full flex items-center justify-center">
                              <Camera className="w-6 h-6 text-text-muted" />
                            </div>
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Click to upload receipt</p>
                            <p className="text-[10px] text-text-muted">Max size: 500KB</p>
                          </>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Payment Method</label>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentMethods.map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                              paymentMethod === m 
                                ? 'bg-accent text-white border-accent' 
                                : 'bg-secondary-surface dark:bg-slate-900 text-text-muted border-transparent hover:border-accent/30'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
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
                          placeholder="Who recorded this?"
                        />
                      </div>
                    </div>
                  </div>
                </div>

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
                    className="flex-1 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-accent/20"
                  >
                    Save Expense
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
