
import React, { useState, useRef } from 'react';
import { Button } from './Button';
import { Upload, FileText, Check, AlertCircle, ArrowRight, AlertTriangle, TrendingUp, Clock, History, Search, Edit2, Save, X, RotateCcw } from 'lucide-react';
import { InventoryItem, Recipe, SalesImportRecord } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface SalesImportProps {
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  onProcessSales: (deductions: { inventoryItemId: string; quantity: number }[], revenue: number) => void;
  history: SalesImportRecord[];
  onSaveRecord: (record: SalesImportRecord) => void;
  itemMappings: Record<string, string>;
  onSaveMapping: (itemName: string, recipeId: string) => void;
}

interface SalesItem {
  itemName: string;
  quantity: number;
  totalAmount?: number;
  matchedRecipe?: Recipe;
}

interface IngredientImpact {
  inventoryItemId: string;
  inventoryItemName: string;
  currentStock: number;
  deduction: number;
  unit: string;
}

export const SalesImport: React.FC<SalesImportProps> = ({ recipes, inventoryItems, onProcessSales, history, onSaveRecord, itemMappings, onSaveMapping }) => {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [file, setFile] = useState<File | null>(null);
  const [salesData, setSalesData] = useState<SalesItem[]>([]);
  const [impactAnalysis, setImpactAnalysis] = useState<IngredientImpact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit State
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editRecipeId, setEditRecipeId] = useState<string>("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setSalesData([]);
      setImpactAnalysis([]);
      setError(null);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          setError("Empty or invalid file structure.");
          return;
        }

        const parsed: SalesItem[] = [];
        
        // Helper to split CSV line respecting quotes
        const splitCSVLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuote = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result.map(s => s.trim().replace(/^"|"$/g, ''));
        };

        // Header Detection Logic
        const firstLineParts = splitCSVLine(lines[0]);
        let itemIdx = -1;
        let qtyIdx = -1;
        let amountIdx = -1;

        // Common header names across different POS systems (Square, Clover, Toast, Lightspeed, Zettle)
        const itemAliases = ['item', 'name', 'product', 'item name', 'description', 'title'];
        const qtyAliases = ['qty', 'quantity', 'count', 'total quantity', 'units', 'volume'];
        const amountAliases = ['amount', 'price', 'total', 'gross', 'sales', 'value', 'net sales', 'total amount'];

        firstLineParts.forEach((header, idx) => {
            const h = header.toLowerCase().trim();
            if (itemIdx === -1 && itemAliases.some(a => h.includes(a))) itemIdx = idx;
            if (qtyIdx === -1 && qtyAliases.some(a => h.includes(a)) && !h.includes('price')) qtyIdx = idx;
            if (amountIdx === -1 && amountAliases.some(a => h.includes(a)) && h !== 'item') amountIdx = idx;
        });

        // Fallback for strict order-based parsing if no headers matched or headers missing
        if (itemIdx === -1) itemIdx = 0;
        if (qtyIdx === -1) qtyIdx = 2; // Column C fallback
        if (amountIdx === -1) amountIdx = 3; // Column D fallback

        console.log(`[SalesImport] Header detection: Item=${itemIdx}, Qty=${qtyIdx}, Amount=${amountIdx}`);

        for (let i = 1; i < lines.length; i++) {
          const parts = splitCSVLine(lines[i]);
          if (parts.length <= Math.max(itemIdx, qtyIdx)) continue;
          
          const name = parts[itemIdx];
          const qtyStr = parts[qtyIdx];
          const amountStr = amountIdx !== -1 && parts[amountIdx] ? parts[amountIdx] : '0';
          
          if (!name || name.toLowerCase() === 'total' || name.toLowerCase() === 'sum') continue;

          const qty = parseFloat(qtyStr.replace(/[^0-9.-]/g, ''));
          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
          
          if (!isNaN(qty)) {
            let recipe: Recipe | undefined;

            if (itemMappings[name]) {
                recipe = recipes.find(r => r.id === itemMappings[name]);
            }
            
            if (!recipe) {
                recipe = recipes.find(r => (r.name || '').toLowerCase() === (name || '').toLowerCase());
            }
            
            parsed.push({
              itemName: name,
              quantity: qty,
              totalAmount: isNaN(amount) ? 0 : amount,
              matchedRecipe: recipe
            });
          }
        }
        
        if (parsed.length === 0) {
            setError("No valid sales data found. Ensure your CSV has Item Name, Quantity, and Sales columns.");
        } else {
            setSalesData(parsed);
            calculateImpact(parsed);
        }
      } catch (err) {
        setError("Failed to parse CSV. Please ensure the file is a valid CSV.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const calculateImpact = (sales: SalesItem[]) => {
    const impactMap = new Map<string, number>();

    sales.forEach(sale => {
      if (sale.matchedRecipe) {
        sale.matchedRecipe.ingredients.forEach(ing => {
            const totalDeduction = ing.quantity * sale.quantity;
            const current = impactMap.get(ing.inventoryItemId) || 0;
            impactMap.set(ing.inventoryItemId, current + totalDeduction);
        });
      }
    });

    const analysis: IngredientImpact[] = [];
    impactMap.forEach((deduction, itemId) => {
        const item = inventoryItems.find(i => i.id === itemId);
        if (item) {
            analysis.push({
                inventoryItemId: itemId,
                inventoryItemName: item.name,
                currentStock: item.quantity,
                deduction: deduction,
                unit: item.unit
            });
        }
    });

    setImpactAnalysis(analysis);
  };

  const handleStartEdit = (index: number, currentId?: string) => {
    setEditingRow(index);
    setEditRecipeId(currentId || "");
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditRecipeId("");
  };

  const handleSaveEdit = (index: number) => {
    const recipe = recipes.find(r => r.id === editRecipeId);
    const newData = [...salesData];
    newData[index].matchedRecipe = recipe;
    setSalesData(newData);
    
    calculateImpact(newData);

    // Persist mapping
    if (recipe && newData[index].itemName) {
        onSaveMapping(newData[index].itemName, editRecipeId);
    }
    setEditingRow(null);
  };

  const handleConfirm = () => {
    setIsConfirmOpen(true);
  };

  const executeConfirm = () => {
    const deductions = impactAnalysis.map(i => ({
        inventoryItemId: i.inventoryItemId,
        quantity: i.deduction
    }));
    
    // 1. Process Update
    onProcessSales(deductions, totalSales);

    // 2. Save History Record
    const record: SalesImportRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      fileName: file?.name || 'Unknown CSV',
      totalSales: totalSales,
      foodSales: foodSales,
      beverageSales: beverageSales,
      nonFbSales: nonFbSales,
      itemsCount: salesData.length,
      matchedCount: salesData.filter(s => s.matchedRecipe).length,
      ingredientsAffected: impactAnalysis.length
    };
    onSaveRecord(record);
    
    // 3. Reset
    setFile(null);
    setSalesData([]);
    setImpactAnalysis([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 4. Switch to history tab to show confirmation/new record
    setActiveTab('history');
    setIsConfirmOpen(false);
  };

  const matchedCount = salesData.filter(s => s.matchedRecipe).length;
  const unmatchedCount = salesData.length - matchedCount;
  const totalSales = salesData.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

  const foodSales = salesData.reduce((sum, item) => {
    if (item.matchedRecipe && item.matchedRecipe.category === 'Food') {
      return sum + (item.totalAmount || 0);
    }
    return sum;
  }, 0);

  const beverageSales = salesData.reduce((sum, item) => {
    if (item.matchedRecipe && item.matchedRecipe.category === 'Beverage') {
      return sum + (item.totalAmount || 0);
    }
    return sum;
  }, 0);

  const nonFbSales = salesData.reduce((sum, item) => {
    if (item.matchedRecipe && item.matchedRecipe.category === 'Non-F&B') {
      return sum + (item.totalAmount || 0);
    }
    return sum;
  }, 0);

  const foodPercent = totalSales > 0 ? (foodSales / totalSales) * 100 : 0;
  const beveragePercent = totalSales > 0 ? (beverageSales / totalSales) * 100 : 0;
  const nonFbPercent = totalSales > 0 ? (nonFbSales / totalSales) * 100 : 0;
  const otherPercent = totalSales > 0 ? ((totalSales - foodSales - beverageSales - nonFbSales) / totalSales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-1 inline-flex border border-gray-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'new' 
              ? 'bg-accent/10 text-accent shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          New Import
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'history' 
              ? 'bg-accent/10 text-accent shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'new' ? (
        <>
          <ConfirmationModal
            isOpen={isConfirmOpen}
            title="Confirm Sales Import"
            message={`This will update stock levels for ${impactAnalysis.length} ingredients and add £${totalSales.toFixed(2)} to revenue. Continue?`}
            onConfirm={executeConfirm}
            onCancel={() => setIsConfirmOpen(false)}
            variant="info"
          />
          <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center mb-8">
                <div className="bg-accent/10 p-4 rounded-2xl mr-5">
                    <TrendingUp className="h-7 w-7 text-accent" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Import & Stock Deduction</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Upload your sales report (CSV) to automatically deduct ingredients from stock based on recipes.</p>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Requires Column A: Item Name, Column C: Total Quantity, Column D: Total Amount</p>
                </div>
            </div>

            {/* Upload Area */}
            {!file ? (
                <div 
                    className="border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-16 text-center hover:border-accent transition-all cursor-pointer bg-gray-50/50 dark:bg-slate-800/50 group"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="bg-white dark:bg-slate-900 w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-accent" />
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Upload Sales CSV</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">Format: CSV with Item Name (Col A), Quantity (Col C), Amount (Col D)</p>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".csv,.txt"
                        onChange={handleFileChange}
                    />
                </div>
            ) : (
                <div className="flex items-center justify-between bg-accent/10 p-5 rounded-xl border border-accent/20 mb-8">
                    <div className="flex items-center">
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg shadow-sm mr-3">
                            <FileText className="h-5 w-5 text-accent" />
                        </div>
                        <span className="font-bold text-accent">{file.name}</span>
                    </div>
                    <Button variant="ghost" onClick={() => { setFile(null); setSalesData([]); setImpactAnalysis([]); }} className="text-[10px] font-bold uppercase tracking-widest">Change File</Button>
                </div>
            )}

            {error && (
                <div className="mt-6 bg-red-50 dark:bg-red-900/20 p-5 rounded-xl flex items-start border border-red-100 dark:border-red-900/30 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}
          </div>

          {salesData.length > 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                {/* Sales Split Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Food Sales</span>
                      <span className="text-[10px] font-bold text-accent">{foodPercent.toFixed(1)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">£{foodSales.toFixed(2)}</div>
                    <div className="mt-4 w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full transition-all duration-1000" style={{ width: `${foodPercent}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Beverage Sales</span>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{beveragePercent.toFixed(1)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">£{beverageSales.toFixed(2)}</div>
                    <div className="mt-4 w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${beveragePercent}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Non-F&B Sales</span>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{nonFbPercent.toFixed(1)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">£{nonFbSales.toFixed(2)}</div>
                    <div className="mt-4 w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-gray-300 dark:bg-slate-700 h-2 rounded-full transition-all duration-1000" style={{ width: `${nonFbPercent}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sales Preview */}
                <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800 flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-widest">Parsed Sales Data</h3>
                        <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm">
                            Total: £{totalSales.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex space-x-6 mb-6 text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">{matchedCount} Matched</span>
                        <span className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">{unmatchedCount} Unmatched</span>
                    </div>
                    <div className="flex-1 overflow-auto border border-gray-100 dark:border-slate-800 rounded-xl no-scrollbar">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                            <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest w-1/3">Item Name</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Qty</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Sales</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest w-1/2">Recipe Match</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {salesData.map((item, idx) => (
                                    <tr key={idx} className={`${!item.matchedRecipe && editingRow !== idx ? 'bg-red-50/50 dark:bg-red-900/10' : ''} hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors`}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-[150px] truncate" title={item.itemName}>{item.itemName}</td>
                                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-slate-400 text-right">{item.quantity}</td>
                                        <td className="px-4 py-4 text-sm font-bold text-gray-900 dark:text-white text-right">
                                            {item.totalAmount !== undefined ? `£${item.totalAmount.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {editingRow === idx ? (
                                                <div className="flex items-center space-x-2">
                                                    <select 
                                                        className="flex-1 text-sm border-gray-200 dark:border-slate-700 rounded-lg focus:ring-accent focus:border-accent p-2 border bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                                        value={editRecipeId}
                                                        onChange={(e) => setEditRecipeId(e.target.value)}
                                                        autoFocus
                                                    >
                                                        <option value="">Select Recipe...</option>
                                                        {recipes.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => handleSaveEdit(idx)} className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Save">
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Cancel">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center group">
                                                    <span className={`text-sm font-medium ${item.matchedRecipe ? 'text-gray-900 dark:text-white' : 'text-red-500 italic'}`}>
                                                        {item.matchedRecipe ? item.matchedRecipe.name : 'No Match'}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleStartEdit(idx, item.matchedRecipe?.id)}
                                                        className="text-gray-400 hover:text-accent p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-accent/10"
                                                        title="Edit Mapping"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {unmatchedCount > 0 && (
                        <div className="mt-6 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start">
                            <AlertTriangle className="h-4 w-4 mr-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span>
                                <strong className="uppercase tracking-wider">Action Required:</strong> Click the edit icon (<Edit2 className="h-3 w-3 inline" />) on unmatched items to select the correct recipe. 
                                <br/><span className="opacity-75">Your mapping will be saved for future imports.</span>
                            </span>
                        </div>
                    )}
                </div>

                {/* Impact Analysis */}
                <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 border border-gray-100 dark:border-slate-800 flex flex-col h-[600px]">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6">Stock Deduction Impact</h3>
                    <div className="flex-1 overflow-auto border border-gray-100 dark:border-slate-800 rounded-xl no-scrollbar mb-6">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                            <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Ingredient</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">In Stock</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Deduction</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Forecast</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {impactAnalysis.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-gray-500 dark:text-slate-400">
                                            <div className="flex flex-col items-center">
                                                <Search className="h-10 w-10 mb-3 opacity-20" />
                                                <p className="font-medium">Match items to recipes to see impact.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    impactAnalysis.map((item, idx) => {
                                        const forecast = item.currentStock - item.deduction;
                                        const isNegative = forecast < 0;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.inventoryItemName}</td>
                                                <td className="px-4 py-4 text-sm text-gray-500 dark:text-slate-400 text-right">{item.currentStock} {item.unit}</td>
                                                <td className="px-4 py-4 text-sm text-red-600 dark:text-red-400 text-right font-bold">-{item.deduction.toFixed(2)}</td>
                                                <td className={`px-6 py-4 text-sm text-right font-black ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {forecast.toFixed(2)}
                                                    {isNegative && <AlertTriangle className="h-4 w-4 inline ml-2 text-red-500" />}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 mt-auto">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Total Ingredients Affected</span>
                            <span className="text-xl font-black text-gray-900 dark:text-white">{impactAnalysis.length}</span>
                        </div>
                        <Button 
                            onClick={handleConfirm} 
                            className="w-full py-4 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-accent/20" 
                            disabled={impactAnalysis.length === 0}
                        >
                            Confirm & Deduct Stock
                        </Button>
                    </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800">
           <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">Import History</h3>
             <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Record of past sales imports and stock adjustments.</p>
           </div>
           {history.length === 0 ? (
             <div className="p-20 text-center text-gray-500 dark:text-slate-400">
               <History className="h-16 w-16 mx-auto text-gray-200 dark:text-slate-800 mb-4" />
               <p className="font-medium">No import history found.</p>
             </div>
           ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">File Name</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Total Sales</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Split (F / B / N)</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Items / Matched</th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Stock Updates</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 dark:text-slate-500 mr-3" />
                          {new Date(record.date).toLocaleDateString()} <span className="text-gray-400 dark:text-slate-500 ml-2 font-normal">{new Date(record.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{record.fileName}</td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-black text-gray-900 dark:text-white">£{record.totalSales.toFixed(2)}</td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-right text-gray-500">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">F: {((record.foodSales / record.totalSales) * 100 || 0).toFixed(0)}%</span>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">B: {((record.beverageSales / record.totalSales) * 100 || 0).toFixed(0)}%</span>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">N: {((record.nonFbSales / record.totalSales) * 100 || 0).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">
                        {record.matchedCount} <span className="text-gray-400 dark:text-slate-500 font-normal">/ {record.itemsCount}</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm text-right text-gray-500 dark:text-slate-400">
                        <span className="bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">{record.ingredientsAffected} ingredients</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           )}
        </div>
      )}
    </div>
  );
};
