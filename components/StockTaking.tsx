
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { InventoryItem, StockCountItem, Unit, StockCountRecord } from '../types';
import { Button } from './Button';
import { analyzeDiscrepancies } from '../services/geminiService';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Save, FileText, CheckCircle, Clock, History as HistoryIcon, ChevronDown, ChevronUp, Search, ScanBarcode, Camera } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { toast } from 'sonner';

interface StockTakingProps {
  items: InventoryItem[];
  onUpdateInventory: (updates: {id: string, quantity: number}[]) => void;
  history: StockCountRecord[];
  onSaveRecord: (record: StockCountRecord) => void;
}

export const StockTaking: React.FC<StockTakingProps> = ({ items, onUpdateInventory, history, onSaveRecord }) => {
  const [activeTab, setActiveTab] = useState<'new' | 'review' | 'history'>('new');
  
  // Initialize count state with current theoretical stock
  const [counts, setCounts] = useState<StockCountItem[]>([]);
  
  // Sync counts when items change, but only if we haven't started counting
  React.useEffect(() => {
    setCounts(prevCounts => {
      const newCounts = items.map(item => {
        const existing = prevCounts.find(c => c.itemId === item.id);
        if (existing) {
          return {
            ...existing,
            expectedQuantity: item.quantity,
            expectedValue: item.quantity * item.pricePerUnit,
            // Recalculate discrepancy if actualQuantity is already set
            discrepancy: existing.actualQuantity === '' ? 0 : (Number(existing.actualQuantity) - item.quantity),
            varianceValue: existing.actualQuantity === '' ? 0 : ((Number(existing.actualQuantity) - item.quantity) * item.pricePerUnit)
          };
        }
        return {
          itemId: item.id,
          itemName: item.name,
          expectedQuantity: item.quantity,
          actualQuantity: '' as number | '',
          discrepancy: 0,
          unit: item.unit,
          expectedValue: item.quantity * item.pricePerUnit,
          actualValue: item.quantity * item.pricePerUnit,
          varianceValue: 0
        };
      });
      return newCounts;
    });
  }, [items]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [historySortOrder, setHistorySortOrder] = useState<'newest' | 'oldest'>('newest');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleQuantityChange = (itemId: string, val: string) => {
    const newVal = val === '' ? '' : (parseFloat(val) || 0);
    setCounts(prev => prev.map(c => {
      if (c.itemId === itemId) {
        const item = items.find(i => i.id === itemId);
        const price = item ? item.pricePerUnit : 0;
        const actualNum = newVal === '' ? c.expectedQuantity : newVal;
        return {
          ...c,
          actualQuantity: newVal,
          discrepancy: newVal === '' ? 0 : (newVal - c.expectedQuantity),
          actualValue: actualNum * price,
          varianceValue: newVal === '' ? 0 : ((newVal - c.expectedQuantity) * price)
        };
      }
      return c;
    }));
  };

  const handleUnitChange = (itemId: string, newUnit: Unit) => {
    setCounts(prev => prev.map(c => {
      if (c.itemId === itemId) {
        return {
          ...c,
          unit: newUnit
        };
      }
      return c;
    }));
  };

  const handleFinishStockTake = async () => {
    setIsSubmitting(true);
    
    // If actualQuantity is empty string, default to expectedQuantity
    const countedItems = counts.map(c => {
      if (c.actualQuantity === '') {
        return {
          ...c,
          actualQuantity: c.expectedQuantity,
          discrepancy: 0,
          actualValue: c.expectedValue,
          varianceValue: 0
        };
      }
      return c;
    });
    
    if (countedItems.length === 0) {
      toast.error("Please enter actual counts for at least one item before completing the stock take.");
      setIsSubmitting(false);
      return;
    }
    
    // 1. Identify discrepancies
    const discrepancies = countedItems.filter(c => Math.abs(c.discrepancy) > 0).map(c => ({
      name: c.itemName,
      expected: c.expectedQuantity,
      actual: c.actualQuantity as number,
      unit: c.unit,
      variance: c.discrepancy,
      expectedValue: c.expectedValue,
      actualValue: c.actualValue,
      varianceValue: c.varianceValue
    }));

    // 2. Get AI Analysis if there are discrepancies
    let analysis = "No significant discrepancies found.";
    if (discrepancies.length > 0) {
      try {
        analysis = await analyzeDiscrepancies(discrepancies);
      } catch (error) {
        analysis = "AI analysis is currently unavailable due to quota limits. Please review the discrepancies manually.";
      }
    }
    setReport(analysis);

    // 3. Generate PDF
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Stock Count Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Add table
    const tableData = countedItems.map(row => [
      row.itemName,
      `${row.expectedQuantity} ${row.unit}`,
      `${row.actualQuantity} ${row.unit}`,
      row.discrepancy > 0 ? `+${row.discrepancy} ${row.unit}` : `${row.discrepancy} ${row.unit}`,
      `£${row.expectedValue.toFixed(2)}`,
      `£${row.actualValue.toFixed(2)}`,
      `£${row.varianceValue.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Item', 'Expected Qty', 'Actual Qty', 'Variance Qty', 'Expected £', 'Actual £', 'Variance £']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    // Add Analysis
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Discrepancy Analysis", 14, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const lines = analysis.split('\n');
    lines.forEach(line => {
      let text = line.trim();
      if (!text) {
        currentY += 4;
        return;
      }
      
      let isBullet = false;
      let isHeader = false;
      
      if (text.startsWith('###') || text.startsWith('##') || text.startsWith('#')) {
        isHeader = true;
        text = text.replace(/^#+\s*/, '').replace(/\*\*/g, '');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        currentY += 4;
      } else if (text.startsWith('* ') || text.startsWith('- ')) {
        isBullet = true;
        text = text.substring(2).replace(/\*\*/g, '');
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      } else {
        text = text.replace(/\*\*/g, '');
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      }
      
      const splitText = doc.splitTextToSize(text, isBullet ? 170 : 180);
      
      if (isBullet) {
        doc.circle(16, currentY - 1, 0.8, 'F');
        doc.text(splitText, 20, currentY);
      } else {
        doc.text(splitText, 14, currentY);
      }
      
      currentY += splitText.length * 5;
      
      // Add page if needed
      if (currentY > 280) {
        doc.addPage();
        currentY = 20;
      }
    });

    doc.save(`stock-report-${new Date().toISOString().split('T')[0]}.pdf`);

    // 4. Update Global Inventory State (only for counted items)
    onUpdateInventory(countedItems.map(c => ({ id: c.itemId, quantity: c.actualQuantity as number })));

    // 5. Save History Record (save all counted items)
    const newRecord: StockCountRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      aiAnalysis: analysis,
      items: countedItems.map(c => ({
        name: c.itemName,
        expected: c.expectedQuantity,
        actual: c.actualQuantity as number,
        unit: c.unit,
        variance: c.discrepancy,
        expectedValue: c.expectedValue,
        actualValue: c.actualValue,
        varianceValue: c.varianceValue
      }))
    };
    onSaveRecord(newRecord);
    
    setIsSubmitting(false);
    setShowReport(true);
  };

  const toggleHistoryItem = (id: string) => {
    setExpandedHistoryId(expandedHistoryId === id ? null : id);
  };

  const filteredCounts = counts.filter(c => {
    const term = (searchTerm || '').toLowerCase();
    const item = items.find(i => i.id === c.itemId);
    const matchesName = (c.itemName || '').toLowerCase().includes(term);
    const matchesBarcode = item?.barcode?.toLowerCase().includes(term);
    const matchesCategory = selectedCategory === 'All' || item?.category === selectedCategory;
    const matchesDepartment = selectedDepartment === 'All' || item?.department === selectedDepartment;
    return (matchesName || matchesBarcode) && matchesCategory && matchesDepartment;
  });

  const categories = ['All', ...new Set(items.map(i => i.category))];

  if (showReport) {
    return (
      <div className="bg-card-bg shadow-2xl rounded-2xl p-12 text-center border border-border-grey">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success/10 border border-success/20">
          <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <h3 className="mt-6 text-2xl font-bold text-text-navy">Stock Take Completed</h3>
        <p className="mt-2 text-sm font-medium text-text-muted uppercase tracking-wider">Inventory levels have been updated and the report has been downloaded.</p>
        
        <div className="mt-10 text-left bg-main-bg p-8 rounded-2xl border border-border-grey shadow-inner">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6 flex items-center">
            <HistoryIcon className="h-4 w-4 mr-2 text-accent" />
            Manager's Feedback & Notes
          </h4>
          <div className="markdown-body text-sm text-text-navy leading-relaxed">
            <ReactMarkdown>{report || ''}</ReactMarkdown>
          </div>
        </div>

        <div className="mt-10">
          <Button className="px-10 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-accent text-white hover:opacity-90" onClick={() => {
              setShowReport(false);
              // Reset counts for next time
              setCounts(items.map(item => ({
                itemId: item.id,
                itemName: item.name,
                expectedQuantity: item.quantity,
                actualQuantity: '',
                discrepancy: 0,
                unit: item.unit,
                expectedValue: item.quantity * item.pricePerUnit,
                actualValue: 0,
                varianceValue: 0
              })));
              setActiveTab('history');
          }}>View History</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-card-bg rounded-xl p-1 inline-flex border border-border-grey shadow-lg">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 ${
            activeTab === 'new' 
              ? 'bg-accent text-white shadow-lg shadow-accent/20' 
              : 'text-text-muted hover:text-text-navy hover:bg-main-bg'
          }`}
        >
          New Stock Take
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 ${
            activeTab === 'history' 
              ? 'bg-accent text-white shadow-lg shadow-accent/20' 
              : 'text-text-muted hover:text-text-navy hover:bg-main-bg'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="bg-card-bg shadow-2xl rounded-2xl overflow-hidden border border-border-grey">
          <div className="px-8 py-6 border-b border-border-grey flex flex-col lg:flex-row justify-between items-center bg-card-bg gap-6">
            <div>
              <h3 className="text-xl font-bold text-text-navy tracking-tight">Stock Taking</h3>
              <p className="mt-1 text-xs font-medium text-text-muted uppercase tracking-wider">Enter actual counts. Discrepancies will be calculated automatically.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
               <select
                 className="block w-full sm:w-auto bg-main-bg border-border-grey text-text-navy text-[10px] font-bold uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none cursor-pointer"
                 value={selectedDepartment}
                 onChange={(e) => setSelectedDepartment(e.target.value)}
               >
                 <option value="All">All Departments</option>
                 <option value="Kitchen">Kitchen</option>
                 <option value="Bar">Bar</option>
               </select>
               <select
                 className="block w-full sm:w-auto bg-main-bg border-border-grey text-text-navy text-[10px] font-bold uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none cursor-pointer"
                 value={selectedCategory}
                 onChange={(e) => setSelectedCategory(e.target.value)}
               >
                 {categories.map(cat => (
                   <option key={cat} value={cat}>{cat}</option>
                 ))}
               </select>
               <div className="relative rounded-xl shadow-sm w-full sm:w-64 flex group">
                    <div className="relative flex-grow">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-text-muted/50 group-focus-within:text-accent transition-colors" />
                      </div>
                      <input
                          type="text"
                          className="bg-main-bg border-border-grey text-text-navy block w-full pl-11 py-2.5 text-sm rounded-l-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder-text-muted/30"
                          placeholder="Search item or barcode..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScanning(true)}
                      className="bg-main-bg border-y border-r border-border-grey text-text-muted hover:text-text-navy hover:bg-card-bg px-4 py-2.5 rounded-r-xl transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
               </div>
               <Button onClick={() => setActiveTab('review')} variant="primary" className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-accent text-white hover:opacity-90">
                Review Stock
               </Button>
            </div>
          </div>

          <div className="overflow-x-auto hidden sm:block">
            <table className="min-w-full divide-y divide-border-grey">
              <thead className="bg-main-bg">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Item</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Actual</th>
                </tr>
              </thead>
              <tbody className="bg-card-bg divide-y divide-border-grey">
                {filteredCounts.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-8 py-12 text-center text-text-muted italic">
                       No items found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredCounts.map((item) => {
                    const invItem = items.find(i => i.id === item.itemId);
                    return (
                        <tr key={item.itemId} className="hover:bg-main-bg transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap">
                            <div className="text-sm font-bold text-text-navy group-hover:text-accent transition-colors">{item.itemName}</div>
                            {invItem?.barcode && (
                                <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center mt-1">
                                    <ScanBarcode className="h-3 w-3 mr-1.5 text-accent" />
                                    {invItem.barcode}
                                </div>
                            )}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap flex items-center">
                            <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-28 bg-main-bg border-border-grey rounded-xl px-4 py-2 text-sm text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder-text-muted/30"
                            value={item.actualQuantity}
                            onChange={(e) => handleQuantityChange(item.itemId, e.target.value)}
                            placeholder="0.00"
                            /> 
                            <select
                              className="ml-3 bg-main-bg border-border-grey rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none cursor-pointer"
                              value={item.unit}
                              onChange={(e) => handleUnitChange(item.itemId, e.target.value as Unit)}
                            >
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="L">L</option>
                              <option value="ml">ml</option>
                              <option value="pcs">pcs</option>
                              <option value="box">box</option>
                              <option value="portions">portions</option>
                              <option value="servings">servings</option>
                              <option value="bottles">bottles</option>
                              <option value="cans">cans</option>
                              <option value="kegs">kegs</option>
                            </select>
                        </td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-border-grey">
            {filteredCounts.length === 0 ? (
              <div className="px-8 py-12 text-center text-text-muted italic">
                No items found matching your search.
              </div>
            ) : (
              filteredCounts.map((item) => {
                const invItem = items.find(i => i.id === item.itemId);
                return (
                  <div key={item.itemId} className="p-6 space-y-4 bg-card-bg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-text-navy">{item.itemName}</div>
                        {invItem?.barcode && (
                          <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center mt-1">
                            <ScanBarcode className="h-3 w-3 mr-1.5 text-accent" />
                            {invItem.barcode}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-main-bg px-2 py-1 rounded-lg border border-border-grey">
                        Exp: {item.expectedQuantity} {item.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Count"
                        className="flex-1 bg-main-bg border-border-grey rounded-xl px-4 py-3 text-sm text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        value={item.actualQuantity}
                        onChange={(e) => handleQuantityChange(item.itemId, e.target.value)}
                      />
                      <select
                        className="w-28 bg-main-bg border-border-grey rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-muted appearance-none"
                        value={item.unit}
                        onChange={(e) => handleUnitChange(item.itemId, e.target.value as Unit)}
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                        <option value="box">box</option>
                        <option value="portions">portions</option>
                        <option value="servings">servings</option>
                        <option value="bottles">bottles</option>
                        <option value="cans">cans</option>
                        <option value="kegs">kegs</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'review' ? (
        <div className="bg-card-bg shadow-2xl rounded-2xl overflow-hidden border border-border-grey">
          <div className="px-8 py-6 border-b border-border-grey flex flex-col lg:flex-row justify-between items-center bg-card-bg gap-6">
            <div>
              <h3 className="text-xl font-bold text-text-navy tracking-tight">Review Stock Discrepancies</h3>
              <p className="mt-1 text-xs font-medium text-text-muted uppercase tracking-wider">Review all items with variances before completing the stock take.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto">
               <Button onClick={() => setActiveTab('new')} variant="secondary" className="px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-transparent border border-border-grey text-text-navy hover:bg-main-bg">
                Back to Edit
               </Button>
               <Button onClick={handleFinishStockTake} isLoading={isSubmitting} variant="primary" className="px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-accent text-white hover:opacity-90">
                <FileText className="mr-2 h-4 w-4" />
                Stock Completed
               </Button>
            </div>
          </div>

          <div className="overflow-x-auto hidden sm:block">
            <table className="min-w-full divide-y divide-border-grey">
              <thead className="bg-main-bg">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Item</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Expected Qty</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Actual Qty</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Variance Qty</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Expected £</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Actual £</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Variance £</th>
                </tr>
              </thead>
              <tbody className="bg-card-bg divide-y divide-border-grey">
                {counts.filter(c => Math.abs(c.discrepancy) > 0).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center text-text-muted italic">
                       No discrepancies found. All stock matches expected levels.
                    </td>
                  </tr>
                ) : (
                  counts.filter(c => Math.abs(c.discrepancy) > 0).map((item) => {
                    return (
                        <tr key={item.itemId} className="hover:bg-main-bg transition-colors">
                        <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-text-navy">
                            {item.itemName}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-text-muted">
                            {item.expectedQuantity} {item.unit}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-text-navy">
                            {item.actualQuantity} {item.unit}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm">
                            <span className={`font-bold ${item.discrepancy < 0 ? 'text-cta' : item.discrepancy > 0 ? 'text-success' : 'text-text-muted'}`}>
                            {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                            </span>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-text-muted">
                            £{item.expectedValue.toFixed(2)}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-text-navy">
                            £{item.actualValue.toFixed(2)}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm">
                            <span className={`font-bold ${item.varianceValue < 0 ? 'text-cta' : item.varianceValue > 0 ? 'text-success' : 'text-text-muted'}`}>
                            {item.varianceValue > 0 ? `+£${item.varianceValue.toFixed(2)}` : `-£${Math.abs(item.varianceValue).toFixed(2)}`}
                            </span>
                        </td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Review View */}
          <div className="sm:hidden divide-y divide-border-grey">
            {counts.filter(c => Math.abs(c.discrepancy) > 0).length === 0 ? (
              <div className="px-8 py-12 text-center text-text-muted italic">
                No discrepancies found.
              </div>
            ) : (
              counts.filter(c => Math.abs(c.discrepancy) > 0).map((item) => (
                <div key={item.itemId} className="p-6 space-y-3 bg-card-bg">
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-bold text-text-navy">{item.itemName}</div>
                    <div className={`text-xs font-bold ${item.varianceValue < 0 ? 'text-cta' : 'text-success'}`}>
                      {item.varianceValue > 0 ? `+£${item.varianceValue.toFixed(2)}` : `-£${Math.abs(item.varianceValue).toFixed(2)}`}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <div>Expected: {item.expectedQuantity} {item.unit}</div>
                    <div>Actual: {item.actualQuantity} {item.unit}</div>
                    <div className="col-span-2 bg-main-bg p-2 rounded-lg border border-border-grey">
                      Variance: <span className={item.discrepancy < 0 ? 'text-cta' : 'text-success'}>
                        {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card-bg shadow-2xl rounded-2xl overflow-hidden border border-border-grey">
          <div className="px-8 py-6 border-b border-border-grey flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h3 className="text-xl font-bold text-text-navy tracking-tight">History</h3>
              <p className="mt-1 text-xs font-medium text-text-muted uppercase tracking-wider">Past stock counts and AI reports.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative rounded-xl shadow-sm w-full sm:w-64 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-text-muted/50 group-focus-within:text-accent transition-colors" />
                </div>
                <input
                  type="text"
                  className="bg-main-bg border-border-grey text-text-navy block w-full pl-11 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder-text-muted/30"
                  placeholder="Search date or items..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                />
              </div>
              <select
                className="block w-full sm:w-auto bg-main-bg border-border-grey text-text-navy text-[10px] font-bold uppercase tracking-widest rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none cursor-pointer"
                value={historySortOrder}
                onChange={(e) => setHistorySortOrder(e.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
          {(() => {
            let filteredHistory = history.filter(record => {
              const term = (historySearchTerm || '').toLowerCase();
              const dateStr = new Date(record.date).toLocaleDateString().toLowerCase();
              const matchesDate = dateStr.includes(term);
              const matchesItems = record.items.some(item => (item.name || '').toLowerCase().includes(term));
              return matchesDate || matchesItems;
            });

            filteredHistory.sort((a, b) => {
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              return historySortOrder === 'newest' ? dateB - dateA : dateA - dateB;
            });

            if (filteredHistory.length === 0) {
              return (
                <div className="p-12 text-center text-text-muted">
                  <HistoryIcon className="h-16 w-16 mx-auto text-border-grey mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No stock take history found.</p>
                </div>
              );
            }

            return (
              <div className="divide-y divide-border-grey">
                {filteredHistory.map(record => (
                  <div key={record.id} className="bg-card-bg">
                    <div 
                      className="px-8 py-5 flex items-center justify-between cursor-pointer hover:bg-main-bg transition-colors group"
                      onClick={() => toggleHistoryItem(record.id)}
                    >
                      <div className="flex items-center space-x-6">
                        <div className="flex-shrink-0 bg-main-bg p-3 rounded-xl border border-border-grey group-hover:border-accent transition-colors">
                          <Clock className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-navy group-hover:text-accent transition-colors">
                            {new Date(record.date).toLocaleDateString()} {new Date(record.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                            {record.items.filter(i => Math.abs(i.variance) > 0).length} discrepancies recorded ({record.items.length} items counted)
                          </p>
                        </div>
                      </div>
                      <div>
                        {expandedHistoryId === record.id ? (
                          <ChevronUp className="h-5 w-5 text-accent" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-text-muted group-hover:text-accent" />
                        )}
                      </div>
                    </div>
                    
                    {expandedHistoryId === record.id && (
                      <div className="px-8 pb-8 bg-main-bg border-t border-border-grey animate-in slide-in-from-top-2 duration-200">
                         <div className="mt-6 bg-card-bg p-8 rounded-2xl border border-border-grey shadow-inner">
                           <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center">
                             <HistoryIcon className="h-3 w-3 mr-2 text-accent" />
                             Manager's Feedback
                           </h5>
                           <div className="markdown-body text-sm text-text-navy leading-relaxed">
                             <ReactMarkdown>{record.aiAnalysis}</ReactMarkdown>
                           </div>
                         </div>
                         
                         {record.items.length > 0 && (
                           <div className="mt-8">
                             <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Counted Items</h5>
                             <div className="overflow-x-auto border border-border-grey rounded-2xl">
                               <table className="min-w-full divide-y divide-border-grey bg-card-bg">
                                 <thead className="bg-main-bg">
                                   <tr>
                                     <th className="px-6 py-3 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Item</th>
                                     <th className="px-6 py-3 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Expected</th>
                                     <th className="px-6 py-3 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Actual</th>
                                     <th className="px-6 py-3 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Variance</th>
                                   </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border-grey">
                                   {record.items.map((item, idx) => (
                                     <tr key={idx} className={Math.abs(item.variance) > 0 ? 'bg-accent/5' : ''}>
                                       <td className="px-6 py-3 text-sm font-bold text-text-navy">{item.name}</td>
                                       <td className="px-6 py-3 text-sm text-text-muted">{item.expected} {item.unit}</td>
                                       <td className="px-6 py-3 text-sm text-text-navy">{item.actual} {item.unit}</td>
                                       <td className={`px-6 py-3 text-sm font-bold ${item.variance < 0 ? 'text-cta' : item.variance > 0 ? 'text-success' : 'text-text-muted'}`}>
                                         {item.variance > 0 ? `+${item.variance}` : item.variance}
                                       </td>
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      {isScanning && (
        <BarcodeScanner
          onScan={(decodedText) => {
            setSearchTerm(decodedText);
            setIsScanning(false);
          }}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  );
};
