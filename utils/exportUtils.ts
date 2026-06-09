import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { DailyClosure } from '../types';

// Extend jsPDF with autotable types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const generateClosurePDF = (closure: DailyClosure) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Header
  doc.setFontSize(22);
  doc.setTextColor(20, 40, 80);
  doc.text('Closure Report', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

  // Info Grid
  doc.setDrawColor(230);
  doc.line(14, 35, pageWidth - 14, 35);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 14, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(closure.date, 40, 45);

  doc.setFont('helvetica', 'bold');
  doc.text('Shift:', 14, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(closure.shiftName || 'Daily Full', 40, 52);

  doc.setFont('helvetica', 'bold');
  doc.text('Location:', 100, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(closure.locationId || 'Main Location', 125, 45);

  doc.setFont('helvetica', 'bold');
  doc.text('Closed By:', 100, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(closure.closedBy?.name || 'Unknown', 125, 52);

  // 2. Financial Summary
  doc.setFontSize(14);
  doc.setTextColor(20, 40, 80);
  doc.text('Financial Summary', 14, 65);

  const summaryData = [
    ['Total Paid', `£${(closure.totals?.totalPaid || 0).toFixed(2)}`],
    ['Gross Sales', `£${(closure.totals?.grossSales || 0).toFixed(2)}`],
    ['Tips', `£${((closure.totals as any).tips || 0).toFixed(2)}`],
    ['Net Sales', `£${(closure.totals?.netSales || 0).toFixed(2)}`],
    ['VAT (Tax)', `£${(closure.totals?.vatTotal || 0).toFixed(2)}`],
    ['Service Charge', `£${(closure.totals?.serviceChargeTotal || 0).toFixed(2)}`],
    ['Discounts', `£${(closure.totals?.discountTotal || 0).toFixed(2)}`],
  ];

  if ((closure.totals as any).profit !== undefined) {
    summaryData.push(['Profit (Take Home)', `£${((closure.totals as any).profit || 0).toFixed(2)}`]);
  }

  if (closure.profitReport) {
    summaryData.push(['COGS (Stock Cost)', `£${(closure.profitReport.cogs || 0).toFixed(2)}`]);
    summaryData.push(['Gross Profit', `£${(closure.profitReport.grossProfit || 0).toFixed(2)}`]);
    summaryData.push(['Gross Margin', `${(closure.profitReport.grossMargin || 0).toFixed(1)}%`]);
  }

  doc.autoTable({
    startY: 70,
    head: [['Description', 'Amount']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillStyle: 'f3f4f6', textColor: [20, 40, 80], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' }
    }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // 3. Payment Breakdown
  doc.setFontSize(14);
  doc.setTextColor(20, 40, 80);
  doc.text('Payment Breakdown', 14, currentY);

  const paymentData = Object.entries(closure.breakdowns?.byPaymentMethod || {}).map(([method, amount]) => [
    method.charAt(0).toUpperCase() + method.slice(1),
    `£${(amount || 0).toFixed(2)}`
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['Method', 'Amount']],
    body: paymentData,
    theme: 'grid',
    headStyles: { fillStyle: 'f3f4f6', textColor: [20, 40, 80], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // 4. Staff Breakdown
  if (closure.breakdowns?.byStaff?.length > 0) {
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(14);
    doc.setTextColor(20, 40, 80);
    doc.text('Staff Performance', 14, currentY);

    const staffData = closure.breakdowns.byStaff.map(s => [
      s.staffName,
      s.orders,
      `£${(s.grossSales || 0).toFixed(2)}`,
      `£${(s.serviceCharge || 0).toFixed(2)}`,
      `£${(s.averageOrderValue || 0).toFixed(2)}`
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['Name', 'Orders', 'Sales', 'Service', 'Avg Order']],
      body: staffData,
      theme: 'striped',
      headStyles: { fillStyle: 'f3f4f6', textColor: [20, 40, 80], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 5. Hourly Breakdown
  if (closure.breakdowns?.byHour?.length > 0) {
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    doc.setFontSize(14);
    doc.setTextColor(20, 40, 80);
    doc.text('Hourly Sales', 14, currentY);

    const hourlyData = closure.breakdowns.byHour.map(h => [
      `${h.hour}:00`,
      `£${(h.grossSales || 0).toFixed(2)}`,
      h.orderCount
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['Hour', 'Sales', 'Orders']],
      body: hourlyData,
      theme: 'striped',
      headStyles: { fillStyle: 'f3f4f6', textColor: [20, 40, 80], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' }
      }
    });
  }

  doc.save(`closure_${closure.date}_${closure.type}.pdf`);
};

export const generateClosureCSV = (closure: DailyClosure) => {
  const headers = ['date', 'time', 'orderId', 'staffName', 'paymentMethod', 'totalPaid', 'netSales', 'vat', 'serviceCharge', 'discount'];
  let rows: any[] = [];

  const auditOrders = (closure as any).audit?.orders;

  if (auditOrders && Array.isArray(auditOrders)) {
    rows = auditOrders.map(o => [
      closure.date,
      o.time || '',
      o.orderId || o.id || '',
      o.staffName || '',
      o.paymentMethod || '',
      (o.totalPaid || 0).toFixed(2),
      (o.netSales || 0).toFixed(2),
      (o.vat || 0).toFixed(2),
      (o.serviceCharge || 0).toFixed(2),
      (o.discount || 0).toFixed(2)
    ]);
  } else {
    // Fallback: generate from breakdown safely
    // Since we don't have per-order data, we'll generate summary rows for the audit
    // per staff member to provide some level of drill-down for the accountant
    rows = closure.breakdowns.byStaff.map(s => [
      closure.date,
      '00:00', // Time unknown
      'SUMMARY_STAFF',
      s.staffName,
      'Multiple',
      (s.grossSales || 0).toFixed(2),
      (s.netSales || 0).toFixed(2),
      (s.vat || 0).toFixed(2),
      (s.serviceCharge || 0).toFixed(2),
      (s.discounts || 0).toFixed(2)
    ]);
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map((cell: any) => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `closure_${closure.date}_${closure.type}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
