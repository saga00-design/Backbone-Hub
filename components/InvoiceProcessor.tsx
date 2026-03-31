
import React, { useState, useRef } from 'react';
import { Button } from './Button';
import { Upload, FileText, Check, AlertCircle, History, Clock, CheckCircle, Search, Filter, Plus, X, AlertTriangle } from 'lucide-react';
import { parseInvoiceImage, handleAiError } from '../services/geminiService';
import { InventoryItem, Supplier, Invoice, Unit } from '../types';

interface InvoiceProcessorProps {
  onProcessInvoice: (invoice: Invoice) => void;
  suppliers: Supplier[];
  invoices: Invoice[];
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void;
  onAddSupplier: (supplier: Supplier) => void;
}

export const InvoiceProcessor: React.FC<InvoiceProcessorProps> = ({ 
  onProcessInvoice, 
  suppliers, 
  invoices, 
  onUpdateInvoice,
  onAddSupplier
}) => {
  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
  const [supplierFilter, setSupplierFilter] = useState<string>('All');
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setParsedData(null);
      setError(null);
    }
  };

  const processInvoice = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        try {
          const result = await parseInvoiceImage(base64String, mimeType);
          setParsedData(result);
        } catch (err) {
          const message = handleAiError(err);
          setError(message);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error reading file.");
      setIsProcessing(false);
    }
  };

  const handleAddNewSupplier = () => {
    if (!parsedData?.vendor) return;
    
    const newSupplier: Supplier = {
      id: `sup-${Date.now()}`,
      name: parsedData.vendor,
      notes: 'Added from invoice processor'
    };
    
    onAddSupplier(newSupplier);
    setSelectedSupplierId(newSupplier.id);
    setIsAddingNewSupplier(false);
  };

  const handleConfirm = () => {
    if (parsedData && parsedData.items) {
      const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
      
      const invoice: Invoice = {
        id: `inv-${Date.now()}`,
        date: parsedData.date || new Date().toISOString().split('T')[0],
        vendor: selectedSupplier ? selectedSupplier.name : (parsedData.vendor || 'Unknown'),
        supplierId: selectedSupplierId || undefined,
        items: parsedData.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit as Unit,
          price: item.price
        })),
        totalAmount: parsedData.items.reduce((sum: number, item: any) => sum + (item.price || 0), 0),
        status: 'Processed',
        paymentStatus: paymentStatus
      };
      
      onProcessInvoice(invoice);
      setFile(null);
      setPreview(null);
      setParsedData(null);
      setSelectedSupplierId('');
      setPaymentStatus('Unpaid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-1 inline-flex border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
        <button
          onClick={() => setActiveTab('process')}
          className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
            activeTab === 'process' 
              ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Process New
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
            activeTab === 'history' 
              ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Invoice History
        </button>
      </div>

      {activeTab === 'process' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800 transition-colors">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 tracking-tight uppercase">Upload Invoice</h3>
            <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center hover:border-blue-500 transition-all bg-gray-50/50 dark:bg-slate-800/30 group">
                {preview ? (
                    <div className="relative">
                        <img src={preview} alt="Invoice preview" className="max-h-64 mx-auto rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700" />
                        <button 
                            onClick={() => { setFile(null); setPreview(null); setParsedData(null); }}
                            className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-2 hover:bg-rose-600 shadow-xl transition-transform hover:scale-110"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center py-8"
                    >
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                          <Upload className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-xs font-black text-gray-900 dark:text-slate-200 uppercase tracking-widest">Click to upload or drag and drop</p>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-2">PNG, JPG up to 5MB</p>
                    </div>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>

            <div className="mt-8">
                <Button 
                    onClick={processInvoice} 
                    disabled={!file} 
                    isLoading={isProcessing}
                    className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Analyze Invoice with AI
                </Button>
            </div>
            
            {error && (
                <div className="mt-6 bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 flex items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 mr-3 flex-shrink-0" />
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{error}</p>
                </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800 transition-colors flex flex-col">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 tracking-tight uppercase">Extracted Data</h3>
            {parsedData ? (
                <div className="flex-1 flex flex-col">
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl mb-6 border border-gray-100 dark:border-slate-700 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Vendor</span>
                              <span className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{parsedData.vendor || 'Unknown'}</span>
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Date: {parsedData.date || 'Unknown'}</span>
                            </div>
                            
                            {parsedData.vendor && !suppliers.find(s => s.name.toLowerCase() === parsedData.vendor.toLowerCase()) && (
                                <button 
                                    onClick={() => setIsAddingNewSupplier(true)}
                                    className="text-[9px] font-black uppercase tracking-widest bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-lg shadow-blue-500/20 flex items-center"
                                >
                                    <Plus className="h-3 w-3 mr-2" /> Add Supplier
                                </button>
                            )}
                        </div>

                        {isAddingNewSupplier && (
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800 shadow-xl animate-in fade-in slide-in-from-top-2">
                                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Add "{parsedData.vendor}" to your supplier list?</p>
                                <div className="flex gap-3">
                                    <Button onClick={handleAddNewSupplier} className="bg-blue-600 dark:bg-blue-500 text-white text-[9px] px-4 py-2 rounded-lg font-black uppercase tracking-widest">Add</Button>
                                    <Button variant="secondary" onClick={() => setIsAddingNewSupplier(false)} className="text-[9px] px-4 py-2 rounded-lg font-black uppercase tracking-widest border-gray-200 dark:border-slate-700">Cancel</Button>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Link to Supplier</label>
                                <select 
                                    className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                                    value={selectedSupplierId}
                                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                                >
                                    <option value="">Select a supplier...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Payment Status</label>
                                <select 
                                    className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                                    value={paymentStatus}
                                    onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Unpaid')}
                                >
                                    <option value="Unpaid">Unpaid</option>
                                    <option value="Paid">Paid</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden border border-gray-100 dark:border-slate-800 rounded-2xl mb-6 flex flex-col">
                        <div className="overflow-y-auto max-h-80 no-scrollbar">
                          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
                              <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                                  <tr>
                                      <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Item</th>
                                      <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Qty</th>
                                      <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Price</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                  {parsedData.items?.map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                          <td className="px-6 py-4 text-xs font-bold text-gray-900 dark:text-slate-200">{item.name}</td>
                                          <td className="px-6 py-4 text-xs font-medium text-gray-500 dark:text-slate-400">{item.quantity} {item.unit}</td>
                                          <td className="px-6 py-4 text-xs font-black text-gray-900 dark:text-slate-200 uppercase">£{item.price?.toFixed(2)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-6 border border-amber-100 dark:border-amber-900/30 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-3" />
                        Review extracted data carefully before confirming.
                    </div>

                    <Button onClick={handleConfirm} className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
                        <Check className="mr-2 h-4 w-4" />
                        Confirm & Update Stock
                    </Button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 bg-gray-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 py-20">
                    <FileText className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No data extracted yet.</p>
                </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 transition-colors">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Invoice History</h3>
              <p className="mt-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Track all processed invoices and payment statuses.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative rounded-xl shadow-sm w-full sm:w-64 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full pl-11 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400 dark:placeholder-slate-600"
                  placeholder="Search vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <select
                  className="block w-full sm:w-auto bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  <option value="All">All Suppliers</option>
                  {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  className="block w-full sm:w-auto bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="All">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto hidden sm:block">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Vendor</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Total</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                {invoices
                  .filter(inv => {
                    const matchesSearch = inv.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                         inv.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchesStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter;
                    const matchesSupplier = supplierFilter === 'All' || inv.supplierId === supplierFilter;
                    return matchesSearch && matchesStatus && matchesSupplier;
                  })
                  .map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-slate-400">
                        {inv.date}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-gray-900 dark:text-slate-200 uppercase tracking-tight">
                        {inv.vendor}
                        {inv.supplierId && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                            Linked
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-gray-900 dark:text-white uppercase">
                        £{inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => onUpdateInvoice(inv.id, { paymentStatus: inv.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid' })}
                          className={`flex items-center px-4 py-1.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all ${
                              inv.paymentStatus === 'Paid' 
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' 
                                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                          }`}
                        >
                            {inv.paymentStatus === 'Paid' ? (
                                <CheckCircle className="h-4 w-4 mr-2" />
                            ) : (
                                <Clock className="h-4 w-4 mr-2" />
                            )}
                            {inv.paymentStatus}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile History View */}
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-slate-800">
            {invoices
              .filter(inv => {
                const matchesSearch = inv.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                     inv.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
                const matchesStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter;
                const matchesSupplier = supplierFilter === 'All' || inv.supplierId === supplierFilter;
                return matchesSearch && matchesStatus && matchesSupplier;
              })
              .map((inv) => (
                <div key={inv.id} className="p-6 space-y-3 bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{inv.vendor}</div>
                      <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{inv.date}</div>
                    </div>
                    <div className="text-sm font-black text-gray-900 dark:text-white uppercase">£{inv.totalAmount.toFixed(2)}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-slate-400 truncate max-w-[150px]">
                      {inv.items.map(i => i.name).join(', ')}
                    </div>
                    <button 
                      onClick={() => onUpdateInvoice(inv.id, { paymentStatus: inv.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid' })}
                      className={`flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          inv.paymentStatus === 'Paid' 
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' 
                              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                      }`}
                    >
                        {inv.paymentStatus}
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {invoices.length === 0 && (
            <div className="px-8 py-16 text-center text-gray-400 dark:text-slate-600">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">No invoices processed yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
