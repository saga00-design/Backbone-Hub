import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { DailyClosure } from '../types';

export const generateFinancialPackPDF = (
  metrics: any,
  closures: DailyClosure[],
  liabilities: any[],
  investorMode: boolean
) => {
  const doc = new jsPDF() as any;
  const today = new Date().toLocaleDateString();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // Navy
  doc.text(investorMode ? 'INVESTOR FINANCIAL REPORT' : 'FINANCIAL COMMAND CENTER REPORT', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${today}`, 14, 30);
  doc.text(`Location: BACKBONE HUB MAIN`, 14, 35);

  // KPI Summary
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Performance Indicators', 14, 45);

  const kpiData = [
    ['Metric', 'Value'],
    ['Gross Sales', `£${metrics.grossSales.toLocaleString()}`],
    ['Net Revenue', `£${metrics.netRevenue.toLocaleString()}`],
    ['Real Profit', `£${metrics.realProfit.toLocaleString()}`],
    ['Labour %', `${metrics.labourPercent.toFixed(1)}%`],
    ['COGS %', `${metrics.cogsPercent.toFixed(1)}%`],
    ['Safe Cash', `£${metrics.safeCash.toLocaleString()}`],
    ['POS vs HUB Variance', `£${metrics.variance.toFixed(2)}`]
  ];

  doc.autoTable({
    startY: 50,
    head: [kpiData[0]],
    body: kpiData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] } // Accent
  });

  // Recent Closures
  const lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Recent Daily Closures', 14, lastY);

  const closureData = closures.slice(0, 7).map(c => [
    c.date,
    `£${(c.totals?.grossSales || 0).toLocaleString()}`,
    `£${(c.totals?.netSales || 0).toLocaleString()}`,
    `${((c.totals?.labour || 0) / (c.totals?.netSales || 1) * 100).toFixed(1)}%`
  ]);

  doc.autoTable({
    startY: lastY + 5,
    head: [['Date', 'Gross Sales', 'Net Revenue', 'Labour %']],
    body: closureData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount} - Confidential Financial Data - Backbone Hub`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`Backbone_Financial_Pack_${today.replace(/\//g, '-')}.pdf`);
};
