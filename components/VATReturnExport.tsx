import React, { useState, useMemo } from 'react';
import { 
  Calculator, Download, FileText, Calendar, 
  ArrowRight, CheckCircle2, AlertTriangle, RefreshCw,
  TrendingUp, PoundSterling, Building, Search
} from 'lucide-react';
import { Button } from './Button';
import { VATTracker, VATReturn } from '../types';
import { normalizeCurrency } from '../utils/currencyUtils';
import { db, LOCATION_ID } from '../firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { toast } from 'sonner';

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

interface VATReturnExportProps {
  vatTrackers: VATTracker[];
  existingReturns: VATReturn[];
  netSalesTotal: number;
  netPurchasesTotal: number;
}

export const VATReturnExport: React.FC<VATReturnExportProps> = ({ 
  vatTrackers, 
  existingReturns,
  netSalesTotal,
  netPurchasesTotal
}) => {
  const [period, setPeriod] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate Boxes
  const currentReturn = useMemo(() => {
    const filteredTrackers = vatTrackers.filter(t => t.date >= period.start && t.date <= period.end);
    
    const box1 = filteredTrackers.reduce((acc, t) => acc + (t.vatCollected || 0), 0);
    const box2 = 0; // standard for most UK hospitality unless importing from EU
    const box3 = box1 + box2;
    const box4 = filteredTrackers.reduce((acc, t) => acc + (t.vatOnExpenses || 0), 0);
    const box5 = Math.abs(box3 - box4);
    
    // Net values (estimated from trackers if not passed directly, but better to use props)
    // Box 6: Total value of sales and all other outputs excluding any VAT
    // Box 7: Total value of purchases and all other inputs excluding any VAT
    const box6 = netSalesTotal || filteredTrackers.reduce((acc, t) => acc + ((t.vatCollected || 0) * 5), 0); // Reverse 20% if estimation needed
    const box7 = netPurchasesTotal || filteredTrackers.reduce((acc, t) => acc + ((t.vatOnExpenses || 0) * 5), 0);
    
    const box8 = 0;
    const box9 = 0;

    return {
      box1, box2, box3, box4, box5, box6, box7, box8, box9,
      isLiability: box3 > box4
    };
  }, [vatTrackers, period, netSalesTotal, netPurchasesTotal]);

  const handleSave = async () => {
    setIsGenerating(true);
    try {
      const returnId = `VAT-${period.start}-${period.end}`;
      const returnData: VATReturn = {
        id: returnId,
        locationId: LOCATION_ID,
        periodStart: period.start,
        periodEnd: period.end,
        status: 'Draft',
        ...currentReturn,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'vatReturns', returnId), returnData);
      toast.success('VAT Return draft saved successfully');
    } catch (error) {
      console.error('Error saving VAT return:', error);
      toast.error('Failed to save VAT return');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ['UK VAT Return Export', `Period: ${period.start} to ${period.end}`],
      ['Box', 'Description', 'Amount (£)'],
      ['Box 1', 'VAT due in this period on sales and other outputs', currentReturn.box1.toFixed(2)],
      ['Box 2', 'VAT due in this period on acquisitions from other EC Member States', currentReturn.box2.toFixed(2)],
      ['Box 3', 'Total VAT due (Box 1 + Box 2)', currentReturn.box3.toFixed(2)],
      ['Box 4', 'VAT reclaimed in this period on purchases and other inputs', currentReturn.box4.toFixed(2)],
      ['Box 5', 'Net VAT to be paid to HMRC or reclaimed by you (Difference between Box 3 and Box 4)', currentReturn.box5.toFixed(2)],
      ['Box 6', 'Total value of sales and all other outputs excluding any VAT', currentReturn.box6.toFixed(2)],
      ['Box 7', 'Total value of all purchases and all other inputs excluding any VAT', currentReturn.box7.toFixed(2)],
      ['Box 8', 'Total value of all supplies of goods and related costs, excluding any VAT, to other EC Member States', currentReturn.box8.toFixed(2)],
      ['Box 9', 'Total value of all acquisitions of goods and related costs, excluding any VAT, from other EC Member States', currentReturn.box9.toFixed(2)]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VAT_Return_${period.start}_${period.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('UK VAT Return (VAT100 Format)', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Location ID: ${LOCATION_ID}`, 14, 30);
    doc.text(`Period: ${period.start} to ${period.end}`, 14, 35);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

    const tableData = [
      ['Box 1', 'VAT due on sales', `£${currentReturn.box1.toFixed(2)}`],
      ['Box 2', 'VAT due on acquisitions from EU', `£${currentReturn.box2.toFixed(2)}`],
      ['Box 3', 'Total VAT due (Box 1 + Box 2)', `£${currentReturn.box3.toFixed(2)}`],
      ['Box 4', 'VAT reclaimed on purchases', `£${currentReturn.box4.toFixed(2)}`],
      ['Box 5', 'Net VAT to pay/reclaim', `£${currentReturn.box5.toFixed(2)}`],
      ['Box 6', 'Total sales ex VAT', `£${currentReturn.box6.toFixed(2)}`],
      ['Box 7', 'Total purchases ex VAT', `£${currentReturn.box7.toFixed(2)}`],
      ['Box 8', 'Total EU sales ex VAT', `£${currentReturn.box8.toFixed(2)}`],
      ['Box 9', 'Total EU purchases ex VAT', `£${currentReturn.box9.toFixed(2)}`]
    ];

    autoTable(doc, {
      startY: 50,
      head: [['Box', 'Description', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [72, 101, 129] },
      styles: { fontSize: 10, cellPadding: 5 }
    });

    doc.save(`VAT_Return_${period.start}_${period.end}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* PERIOD SELECTION */}
      <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-xl">
            <Calendar className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-black text-text-navy tracking-tight uppercase">VAT Return Period</h2>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Select reporting dates for HMRC submission</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Start Date</p>
            <input 
              type="date" 
              value={period.start}
              onChange={(e) => setPeriod(prev => ({ ...prev, start: e.target.value }))}
              className="bg-secondary-surface border border-border-grey rounded-xl px-4 py-2 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
            />
          </div>
          <ArrowRight className="w-4 h-4 text-text-muted mt-4" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">End Date</p>
            <input 
              type="date" 
              value={period.end}
              onChange={(e) => setPeriod(prev => ({ ...prev, end: e.target.value }))}
              className="bg-secondary-surface border border-border-grey rounded-xl px-4 py-2 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* BOX CALCULATIONS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card-bg rounded-2xl border border-border-grey shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border-grey bg-secondary-surface/30">
              <h3 className="text-xs font-black text-text-navy uppercase tracking-widest flex items-center gap-2">
                <Calculator className="w-4 h-4" /> HMRC VAT 100 Form Preview
              </h3>
            </div>
            
            <div className="p-0 divide-y divide-border-grey">
              {/* Box 1-5: The Financials */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center group">
                  <div className="max-w-md">
                    <p className="text-[10px] font-black text-text-navy uppercase tracking-tighter">Box 1</p>
                    <p className="text-xs font-medium text-text-muted leading-tight">VAT due in this period on sales and other outputs</p>
                  </div>
                  <p className="text-xl font-black text-text-navy">£{currentReturn.box1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="flex justify-between items-center group opacity-50">
                  <div className="max-w-md">
                    <p className="text-[10px] font-black text-text-navy uppercase tracking-tighter">Box 2</p>
                    <p className="text-xs font-medium text-text-muted leading-tight">VAT due on acquisitions from other EC Member States</p>
                  </div>
                  <p className="text-xl font-black text-text-navy">£{currentReturn.box2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="flex justify-between items-center p-4 bg-accent/5 rounded-xl border border-accent/10">
                  <div className="max-w-md">
                    <p className="text-[10px] font-black text-accent uppercase tracking-tighter">Box 3</p>
                    <p className="text-xs font-bold text-accent">Total VAT due (Box 1 + Box 2)</p>
                  </div>
                  <p className="text-2xl font-black text-accent">£{currentReturn.box3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="max-w-md">
                    <p className="text-[10px] font-black text-text-navy uppercase tracking-tighter">Box 4</p>
                    <p className="text-xs font-medium text-text-muted leading-tight">VAT reclaimed in this period on purchases and other inputs</p>
                  </div>
                  <p className="text-xl font-black text-text-navy">£{currentReturn.box4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>

                <div className={`flex justify-between items-center p-6 rounded-xl border-2 ${currentReturn.isLiability ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="max-w-md">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${currentReturn.isLiability ? 'text-red-800' : 'text-emerald-800'}`}>Box 5</p>
                    <p className={`text-sm font-black ${currentReturn.isLiability ? 'text-red-900' : 'text-emerald-900'}`}>
                      {currentReturn.isLiability ? 'Net VAT to pay to HMRC' : 'Net VAT to be reclaimed'}
                    </p>
                  </div>
                  <p className={`text-3xl font-black ${currentReturn.isLiability ? 'text-red-600' : 'text-emerald-600'}`}>
                    £{currentReturn.box5.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Box 6-9: Transaction Values */}
              <div className="p-6 bg-secondary-surface/10 space-y-4">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Box 6</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase leading-tight mb-2">Total sales ex. VAT</p>
                    <p className="text-lg font-black text-text-navy">£{currentReturn.box6.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Box 7</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase leading-tight mb-2">Total purchases ex. VAT</p>
                    <p className="text-lg font-black text-text-navy">£{currentReturn.box7.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 opacity-40">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Box 8</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase leading-tight mb-2">EU Sales ex. VAT</p>
                    <p className="text-lg font-black text-text-navy">£{currentReturn.box8.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Box 9</p>
                    <p className="text-[9px] font-bold text-text-muted uppercase leading-tight mb-2">EU Purchases ex. VAT</p>
                    <p className="text-lg font-black text-text-navy">£{currentReturn.box9.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR: ACTIONS & HISTORY */}
        <div className="space-y-6">
          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest">Compliance Actions</h4>
            <div className="space-y-2">
              <Button 
                onClick={handleSave}
                disabled={isGenerating}
                className="w-full justify-center gap-2 bg-text-navy hover:bg-slate-800"
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Save Draft Return
              </Button>
              <Button 
                variant="secondary"
                onClick={handleExportCSV}
                className="w-full justify-center gap-2 border-border-grey"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button 
                variant="secondary"
                onClick={handleExportPDF}
                className="w-full justify-center gap-2 border-border-grey"
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
            
            <div className="pt-4 border-t border-border-grey">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold text-amber-800 leading-normal">
                  Values are calculated based on your daily closures and tracked expenses. Always reconcile with your bank before submitting to HMRC.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-text-navy uppercase tracking-widest">Recent Returns</h4>
            <div className="space-y-3">
              {existingReturns.length === 0 ? (
                <p className="text-center py-4 text-[10px] font-bold text-text-muted uppercase italic">No previous returns found</p>
              ) : (
                existingReturns.map(ret => (
                  <div key={ret.id} className="p-3 bg-secondary-surface rounded-xl border border-border-grey flex items-center justify-between group hover:border-accent transition-colors">
                    <div>
                      <p className="text-[10px] font-black text-text-navy">Period ending {ret.periodEnd}</p>
                      <p className="text-[9px] font-bold text-text-muted">£{ret.box5.toLocaleString()} • {ret.status}</p>
                    </div>
                    <CheckCircle2 className={`w-4 h-4 ${ret.status === 'Submitted' ? 'text-success' : 'text-text-muted'}`} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
