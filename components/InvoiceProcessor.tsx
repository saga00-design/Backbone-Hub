
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { Upload, FileText, Check, AlertCircle, History, Clock, CheckCircle, Search, Filter, Plus, X, AlertTriangle, Trash2, FileInput } from 'lucide-react';
import { parseInvoiceImage, handleAiError } from '../services/geminiService';
import { InventoryItem, Supplier, Invoice, Unit, Order, ReceivingRecord, SupplierPriceHistoryEntry } from '../types';
import { PACKAGING_TO_UNIT } from '../utils/unitConversions';
import { InvoiceApprovalModal } from './InvoiceApprovalModal';

interface InvoiceProcessorProps {
  onProcessInvoice: (invoice: Invoice) => void;
  onApproveInvoice: (invoice: Invoice) => void;
  suppliers: Supplier[];
  invoices: Invoice[];
  orders: Order[];
  receivingRecords: ReceivingRecord[];
  supplierPriceHistory: SupplierPriceHistoryEntry[];
  inventoryItems: InventoryItem[];
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void;
  onAddSupplier: (supplier: Supplier) => void;
}

// Full packaging vocabulary items are actually bought in, as selectable invoice units.
const PACKAGING_UNITS: Unit[] = ['packs', 'box', 'cases', 'sack', 'bottles', 'vacuum pack', 'bags', 'tray', 'tin', 'jar', 'tub', 'sachet', 'loose', 'pcs'];
const METRIC_UNITS: Unit[] = ['kg', 'g', 'L', 'ml'];

export const InvoiceProcessor: React.FC<InvoiceProcessorProps> = ({
  onProcessInvoice,
  onApproveInvoice,
  suppliers,
  invoices,
  orders,
  receivingRecords,
  supplierPriceHistory,
  inventoryItems,
  onUpdateInvoice,
  onAddSupplier
}) => {
  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  // Held by id, not the object itself, so the modal always sees fresh data (e.g. right after
  // linking an order) instead of a stale snapshot captured at the moment it was opened.
  const [reviewingInvoiceId, setReviewingInvoiceId] = useState<string | null>(null);
  const reviewingInvoice = invoices.find(inv => inv.id === reviewingInvoiceId) || null;
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
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualInvoice, setManualInvoice] = useState<{
    vendor: string;
    date: string;
    items: { name: string; quantity: number; unit: Unit; price: number }[];
  }>({
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    items: [{ name: '', quantity: 1, unit: 'pcs', price: 0 }]
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File is too large. Please upload an image smaller than 5MB.");
        return;
      }

      if (selectedFile.size > 3 * 1024 * 1024) {
        toast.warning("Large image detected. Processing might take longer.");
      }

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
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mimeType = file.type;
      
      const result = await parseInvoiceImage(base64String, mimeType);
      
      if (result.items && result.items.length > 50) {
        toast.warning(`Large invoice detected (${result.items.length} items). Please review carefully for accuracy.`);
      }
      
      setParsedData(result);
    } catch (err) {
      const message = handleAiError(err);
      setError(message);
    } finally {
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
        status: 'Pending', // Default to Pending for approval
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

  const handleManualConfirm = () => {
    if (!manualInvoice.vendor) {
      setError("Please enter a vendor name.");
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      date: manualInvoice.date,
      vendor: selectedSupplier ? selectedSupplier.name : manualInvoice.vendor,
      supplierId: selectedSupplierId || undefined,
      items: manualInvoice.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price
      })),
      totalAmount: manualInvoice.items.reduce((sum, item) => sum + (item.price || 0), 0),
      status: 'Pending',
      paymentStatus: paymentStatus
    };

    onProcessInvoice(invoice);
    setIsManualEntry(false);
    setManualInvoice({
      vendor: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ name: '', quantity: 1, unit: 'pcs', price: 0 }]
    });
    setSelectedSupplierId('');
    setPaymentStatus('Unpaid');
  };

  const addManualItem = () => {
    setManualInvoice(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, unit: 'pcs', price: 0 }]
    }));
  };

  const removeManualItem = (index: number) => {
    setManualInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateManualItem = (index: number, field: string, value: any) => {
    setManualInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        // When the item name matches a known inventory item, default the unit to how that
        // item is actually packaged (bottle/bag/tray/vacuum pack/etc) instead of leaving it
        // on the generic 'pcs' default — the user can still override it after.
        if (field === 'name') {
          const match = inventoryItems.find(inv => inv.name.toLowerCase() === String(value).toLowerCase());
          if (match?.packaging) {
            updated.unit = PACKAGING_TO_UNIT[match.packaging] || updated.unit;
          }
        }
        return updated;
      })
    }));
  };

  const matchedInventoryItem = (name: string) =>
    inventoryItems.find(inv => inv.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileInput}
        title="Invoices"
        subtitle="Process and reconcile supplier invoices"
      />

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-1 inline-flex border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
          <button
            onClick={() => setActiveTab('process')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
              activeTab === 'process' 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            Process New
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
              activeTab === 'history' 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            Invoice History
          </button>
        </div>

        {activeTab === 'process' && (
          <button
            onClick={() => setIsManualEntry(!isManualEntry)}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 border ${
              isManualEntry 
                ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' 
                : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            {isManualEntry ? 'Switch to AI Mode' : 'Switch to Manual Mode'}
          </button>
        )}
      </div>

      {activeTab === 'process' ? (
        isManualEntry ? (
          <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800 transition-colors">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Manual Invoice Entry</h3>
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <label className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Invoice Date</label>
                  <input 
                    type="date"
                    className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                    value={manualInvoice.date}
                    onChange={(e) => setManualInvoice(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Vendor Name</label>
                  <input 
                    type="text"
                    placeholder="Enter vendor name..."
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                    value={manualInvoice.vendor}
                    onChange={(e) => setManualInvoice(prev => ({ ...prev, vendor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Link to Existing Supplier</label>
                  <select 
                    className="w-full text-xs font-bold bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-3 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="">Select a supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Payment Status</label>
                  <select 
                    className="w-full text-xs font-bold bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-3 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Unpaid')}
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Manual entries will be saved as "Pending" for approval.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden mb-8">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Item Name</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Quantity</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Unit</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Price (£)</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {manualInvoice.items.map((item, idx) => {
                    const match = matchedInventoryItem(item.name);
                    const packUnit = match?.packaging ? PACKAGING_TO_UNIT[match.packaging] : undefined;
                    const caseUnit = match?.caseSize ? (PACKAGING_TO_UNIT[match.casePackaging || 'case'] || 'cases') : undefined;
                    return (
                    <tr key={idx}>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          list="invoice-inventory-items"
                          placeholder="Item name..."
                          className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-900 dark:text-white"
                          value={item.name}
                          onChange={(e) => updateManualItem(idx, 'name', e.target.value)}
                        />
                        {match && (
                          <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5">
                            Matched: bought by {match.packaging}{match.caseSize ? ` or ${match.casePackaging || 'case'} (${match.caseSize} ${match.packaging}s)` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          className="w-20 bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-900 dark:text-white"
                          value={item.quantity}
                          onChange={(e) => updateManualItem(idx, 'quantity', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                          value={item.unit}
                          onChange={(e) => updateManualItem(idx, 'unit', e.target.value)}
                        >
                          {packUnit && <option value={packUnit}>{packUnit} (pack)</option>}
                          {caseUnit && caseUnit !== packUnit && <option value={caseUnit}>{caseUnit} (case)</option>}
                          <optgroup label="Packaging">
                            {PACKAGING_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </optgroup>
                          <optgroup label="Weight / Volume">
                            {METRIC_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          className="w-24 bg-transparent border-none focus:ring-0 text-xs font-black text-gray-900 dark:text-white"
                          value={item.price}
                          onChange={(e) => updateManualItem(idx, 'price', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => removeManualItem(idx)}
                          disabled={manualInvoice.items.length === 1}
                          className="text-rose-500 hover:text-rose-600 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
              <datalist id="invoice-inventory-items">
                {inventoryItems.map(inv => <option key={inv.id} value={inv.name} />)}
              </datalist>
              <button
                onClick={addManualItem}
                className="w-full py-4 bg-gray-50 dark:bg-slate-800/50 text-[10px] font-black text-accent uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Another Item
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Total: £{manualInvoice.items.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}
              </div>
              <div className="flex gap-4">
                <Button variant="secondary" onClick={() => setIsManualEntry(false)} className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Cancel</Button>
                <Button onClick={handleManualConfirm} className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">
                  Save Invoice
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800 transition-colors">
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 tracking-tight uppercase">Upload Invoice</h3>
              <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center hover:border-accent transition-all bg-gray-50/50 dark:bg-slate-800/30 group">
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
                          <div className="bg-accent/10 p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="h-10 w-10 text-accent" />
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
                      className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 disabled:opacity-50"
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
                                <span className="text-[10px] font-black text-accent uppercase tracking-widest mt-1">Date: {parsedData.date || 'Unknown'}</span>
                              </div>
                              
                              {parsedData.vendor && !suppliers.find(s => s.name.toLowerCase() === parsedData.vendor.toLowerCase()) && (
                                  <button 
                                      onClick={() => setIsAddingNewSupplier(true)}
                                      className="text-[9px] font-black uppercase tracking-widest bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-lg shadow-accent/20 flex items-center"
                                  >
                                      <Plus className="h-3 w-3 mr-2" /> Add Supplier
                                  </button>
                              )}
                          </div>

                          {isAddingNewSupplier && (
                              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-accent/20 shadow-xl animate-in fade-in slide-in-from-top-2">
                                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Add "{parsedData.vendor}" to your supplier list?</p>
                                  <div className="flex gap-3">
                                      <Button onClick={handleAddNewSupplier} className="bg-accent text-white text-[9px] px-4 py-2 rounded-lg font-black uppercase tracking-widest">Add</Button>
                                      <Button variant="secondary" onClick={() => setIsAddingNewSupplier(false)} className="text-[9px] px-4 py-2 rounded-lg font-black uppercase tracking-widest border-gray-200 dark:border-slate-700">Cancel</Button>
                                  </div>
                              </div>
                          )}
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                              <div>
                                  <label className="block text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Link to Supplier</label>
                                  <select 
                                      className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
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
                                      className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
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
                          Review extracted data carefully. Invoices will be saved as "Pending" for approval.
                      </div>

                      <Button onClick={handleConfirm} className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">
                          <Check className="mr-2 h-4 w-4" />
                          Save Invoice
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
        )
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
                  <Search className="h-4 w-4 text-gray-400 group-focus-within:text-accent transition-colors" />
                </div>
                <input
                  type="text"
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full pl-11 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600"
                  placeholder="Search vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <select
                  className="block w-full sm:w-auto bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  <option value="All">All Suppliers</option>
                  {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  className="block w-full sm:w-auto bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
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
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Payment</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                {invoices
                  .filter(inv => {
                    if (inv.status === 'Deleted' as any) return false;
                    const matchesSearch = inv.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                         inv.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchesStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter;
                    const matchesSupplier = supplierFilter === 'All' || inv.supplierId === supplierFilter;
                    return matchesSearch && matchesStatus && matchesSupplier;
                  })
                  .map((inv) => (
                    <React.Fragment key={inv.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-slate-400">
                        {inv.date}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-gray-900 dark:text-slate-200 uppercase tracking-tight">
                        {inv.vendor}
                        {inv.supplierId && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-accent/10 text-accent border border-accent/20">
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
                      <td className="px-8 py-5 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          inv.status === 'Processed' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                            title="View Items"
                          >
                            <FileText className="h-5 w-5" />
                          </button>
                          {inv.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => setReviewingInvoiceId(inv.id)}
                                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                                title="Review & Approve"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to reject this invoice?')) {
                                    onUpdateInvoice(inv.id, { status: 'Rejected' as any });
                                  }
                                }}
                                className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                                title="Reject"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this invoice record?')) {
                                onUpdateInvoice(inv.id, { status: 'Deleted' as any }); // We'll handle actual deletion in App.tsx if needed, or just filter it out
                              }
                            }}
                            className="text-gray-400 hover:text-error dark:text-slate-500 dark:hover:text-error transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedInvoiceId === inv.id && (
                      <tr className="bg-gray-50/50 dark:bg-slate-800/50">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="space-y-2">
                            <div className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Invoice Items</div>
                            <div className="grid grid-cols-4 gap-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 pb-2">
                              <div>Item Name</div>
                              <div className="text-center">Qty</div>
                              <div className="text-center">Unit</div>
                              <div className="text-right">Price</div>
                            </div>
                            {inv.items.map((item, i) => (
                              <div key={i} className="grid grid-cols-4 gap-4 text-xs font-medium text-gray-600 dark:text-slate-300 py-1">
                                <div className="font-bold">{item.name}</div>
                                <div className="text-center">{item.quantity}</div>
                                <div className="text-center uppercase">{item.unit}</div>
                                <div className="text-right">£{item.price?.toFixed(2) || '0.00'}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
            </tbody>
            </table>
          </div>

          {/* Mobile History View */}
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-slate-800">
            {invoices
              .filter(inv => {
                if (inv.status === 'Deleted' as any) return false;
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
                    <div className="text-[10px] font-medium text-gray-500 dark:text-slate-400 truncate max-w-[120px]">
                      {inv.items.map(i => i.name).join(', ')}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        inv.status === 'Processed' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {inv.status}
                      </span>
                      {inv.status === 'Pending' && (
                        <button
                          onClick={() => setReviewingInvoiceId(inv.id)}
                          className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-lg transition-colors"
                          title="Review & Approve"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
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

      <InvoiceApprovalModal
        invoice={reviewingInvoice}
        orders={orders}
        receivingRecords={receivingRecords}
        inventoryItems={inventoryItems}
        supplierPriceHistory={supplierPriceHistory}
        onClose={() => setReviewingInvoiceId(null)}
        onUpdateInvoice={onUpdateInvoice}
        onApprove={onApproveInvoice}
      />
    </div>
  );
};
