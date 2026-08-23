import { 
  Timestamp
} from 'firebase/firestore';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  writeBatch,
  getDocs,
  query,
  where,
  db,
  LOCATION_ID,
  cleanObject,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { normalizeCurrency } from '../utils/currencyUtils';
import { 
  POSOrder, 
  POSPayment, 
  DailyClosure, 
  ClosureType 
} from '../types';
import { generateForecast } from './predictionService';
import { processStaffPerformance } from './staffPerformanceService';
import { runMenuEngineering } from './menuEngineeringService';
import { Recipe, InventoryItem } from '../types';
import { handleAiError } from './geminiService';
import { callGemini } from '../firebase';
import { buildRecipeIndexes, resolveOrderItem } from '../utils/recipeUtils';

/**
 * Calculates and saves a daily or shift closure.
 */
export async function performClosure(params: {
  type: ClosureType;
  date: string;
  periodStart: Date;
  periodEnd: Date;
  staff: { id: string; name: string };
  shiftName?: string;
  lockRecords?: boolean;
}): Promise<DailyClosure> {
  const { type, date, periodStart, periodEnd, staff, shiftName, lockRecords = true } = params;

  try {
    // 1. Fetch POS Payments for the location
    const paymentsRef = collection(db, 'posPayments');
    const paymentsQuery = query(
      paymentsRef, 
      where('locationId', '==', LOCATION_ID)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    
    // Filter by date range in memory for robustness across different date formats/fields
    const targetStartStr = periodStart.toISOString();
    const targetEndStr = periodEnd.toISOString();

    const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(p => {
        // POS systems might use 'timestamp', 'paidAt', or 'createdAt'
        const rawTs = p.paidAt || p.timestamp || p.createdAt;
        if (!rawTs) return false;

        let ts: string;
        if (typeof rawTs === 'object' && 'seconds' in rawTs) {
          ts = new Date(rawTs.seconds * 1000).toISOString();
        } else {
          ts = new Date(rawTs).toISOString();
        }

        return ts >= targetStartStr && ts <= targetEndStr;
      });

    console.log(`[Close Day] payments loaded (filtered in memory): ${payments.length}`);

    // Fetch Staff Profiles for enrichment
    const staffSnap = await getDocs(collection(db, 'staffProfiles'));
    const staffDocs = staffSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    // Fetch Expenses for the period
    const expensesSnap = await getDocs(query(collection(db, 'expenses'), where('locationId', '==', LOCATION_ID)));
    const expenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
      .filter(e => {
        const ts = new Date(e.date).toISOString();
        return ts >= targetStartStr && ts <= targetEndStr;
      });

    // Fetch ClockInRecords for labour cost
    const labourSnap = await getDocs(query(collection(db, 'clockInRecords'), where('locationId', '==', LOCATION_ID)));
    const clockRecords = labourSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
      .filter(c => {
        const ts = new Date(c.clockIn).toISOString();
        return ts >= targetStartStr && ts <= targetEndStr;
      });

    // Fetch Recipes and Inventory for COGS calculation
    const [recipesSnap, inventorySnap] = await Promise.all([
      getDocs(collection(db, 'recipes')),
      getDocs(collection(db, 'inventory'))
    ]);
    const recipesForMatching = recipesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
    const recipeIndexes = buildRecipeIndexes(recipesForMatching);
    const inventoryMap = new Map(inventorySnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as any]));
    
    const staffById = Object.fromEntries(staffDocs.map(s => [s.id, s]));
    const staffByPin = Object.fromEntries(staffDocs.map(s => [s.pin, s]));
    const staffByName = Object.fromEntries(staffDocs.map(s => [s.name?.toLowerCase() || `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase(), s]));

    const cardMethods = ['card', 'credit card', 'debit card', 'visa', 'mastercard', 'amex', 'sumup', 'zettle', 'square', 'stripe', 'pdq', 'terminal'];
    const cashMethods = ['cash'];

    // 3. Perform Calculations (Strict V1)
    const totals = {
      grossSales: 0,
      netSales: 0,
      vat: {
        collected: 0,
        payable: 0,
      },
      serviceCharge: {
        collected: 0,
        pending: 0,
      },
      cogs: 0,
      labour: 0,
      expenses: 0,
      profitBeforeVAT: 0,
      vatLiability: 0,
      realProfitAfterVAT: 0,
      
      vatTotal: 0,
      serviceChargeTotal: 0,
      discountTotal: 0,
      totalPaid: 0,
      cardTotal: 0,
      cashTotal: 0,
      otherTotal: 0,
      orderCount: 0,
      averageOrderValue: 0,
      tips: 0,
      profit: 0,
      salesByCategory: {} as Record<string, number>,
      cogsByCategory: {} as Record<string, number>
    };

    const uniqueOrderIds = new Set<string>();
    const hourlyMap: Record<number, { totalPaid: number; orderIds: Set<string> }> = {};
    let paymentGrossTotal = 0;

    // Staff tracking specifically for fallback if orders aren't found
    const staffPaymentMap: Record<string, {
      staffId: string;
      orders: number;
      grossSales: number;
    }> = {};

    payments.forEach(p => {
      const totalAmt = normalizeCurrency(p.totalPaid || p.amountPaid || p.amount || p.total || 0);
      const tipsAmt = normalizeCurrency(p.tips || 0);
      const grossAmt = p.grossSales !== undefined ? normalizeCurrency(p.grossSales) : (totalAmt - tipsAmt);
      
      const method = (p.method || p.paymentMethod || 'other').toLowerCase();
      
      totals.totalPaid += totalAmt;
      totals.tips += tipsAmt;
      paymentGrossTotal += grossAmt;
      
      if (cardMethods.some(m => method.includes(m))) {
        totals.cardTotal += totalAmt;
      } else if (cashMethods.some(m => method.includes(m))) {
        totals.cashTotal += totalAmt;
      } else {
        totals.otherTotal += totalAmt;
      }

      if (p.orderId) uniqueOrderIds.add(p.orderId);

      // Staff tracking for fallback
      const rawStaffId = (p as any).staffId || (p as any).waiterId || (p as any).userId || (p as any).createdBy || 'Unknown';
      const profile = staffById[rawStaffId] || 
                     staffByPin[rawStaffId] || 
                     staffByName[rawStaffId.toString().toLowerCase()] || 
                     staffDocs.find(s => s.firstName?.toLowerCase() === rawStaffId.toString().toLowerCase());
      
      const sId = profile ? profile.id : rawStaffId;
      if (!staffPaymentMap[sId]) {
        staffPaymentMap[sId] = { staffId: sId, orders: 0, grossSales: 0 };
      }
      staffPaymentMap[sId].grossSales += grossAmt;
      staffPaymentMap[sId].orders += (p.orderId ? 1 : 0);

      // Hourly grouping
      const hour = new Date(p.paidAt || p.timestamp).getHours();
      if (!hourlyMap[hour]) hourlyMap[hour] = { totalPaid: 0, orderIds: new Set() };
      hourlyMap[hour].totalPaid += totalAmt;
      if (p.orderId) hourlyMap[hour].orderIds.add(p.orderId);
    });

    // 3.5 Fetch and analyze associated Orders for financial breakdown
    let serviceChargeTotal = 0;
    let discountTotal = 0;
    let orderGrossSales = 0;
    let orderVatTotal = 0;
    let orderNetSales = 0;
    let totalCOGS = 0;

    const itemAnalysis: Record<string, { name: string; revenue: number; cogs: number; volume: number }> = {};
    const salesByCategory: Record<string, number> = {};
    const cogsByCategory: Record<string, number> = {};

    const staffMap: Record<string, {
      staffId: string;
      orders: number;
      grossSales: number;
      serviceCharge: number;
      discounts: number;
    }> = {};

    if (uniqueOrderIds.size > 0) {
      const orderIds = Array.from(uniqueOrderIds);
      const chunkSize = 30; // Firestore 'in' limit
      
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        
        // Robust lookup: try by document name AND by id field
        const posOrdersRef = collection(db, 'posOrders');
        
        // Primary lookup by Document ID
        const ordersSnapshot = await getDocs(query(
          posOrdersRef,
          where('locationId', '==', LOCATION_ID),
          where('__name__', 'in', chunk)
        ));
        
        // Secondary lookup by 'id' field if not all found (some POS systems store ID as field but have random doc IDs)
        let foundDocs = [...ordersSnapshot.docs];
        if (foundDocs.length < chunk.length) {
          const missingIds = chunk.filter(id => !foundDocs.some(d => d.id === id));
          if (missingIds.length > 0) {
            const secondarySnapshot = await getDocs(query(
              posOrdersRef,
              where('locationId', '==', LOCATION_ID),
              where('id', 'in', missingIds)
            ));
            foundDocs = [...foundDocs, ...secondarySnapshot.docs];
          }
        }
        
        foundDocs.forEach(doc => {
          const order = doc.data() as POSOrder;
          const fin = order.financials || {};
          
          const rawGross = normalizeCurrency(fin.grossSales || (order as any).grossSales || order.total || order.subtotal || 0);
          
          let rawSC = fin.serviceChargeTotal ?? 
                      (order as any).serviceCharge ?? 
                      (order as any).service_charge ?? 
                      (order as any).serviceChargeAmount ?? 
                      (order as any).service_charge_amount ?? 
                      (order as any).service_total ?? 0;
          
          if (Number(rawSC) === 0 && order.total && (order.subtotal || (order as any).net_total)) {
            const st = order.subtotal || (order as any).net_total || 0;
            const vt = normalizeCurrency(fin.vatTotal || (order as any).vat || (order as any).vatTotal || 0);
            rawSC = order.total - st - vt;
            if (rawSC < 0) rawSC = 0;
          }
          const sCharge = normalizeCurrency(rawSC);
          const disc = normalizeCurrency(fin.discountTotal || (order as any).discountTotal || (order as any).discount || 0);
          let vat = normalizeCurrency(fin.vatTotal || (order as any).vat || (order as any).vatTotal || (order as any).tax || (rawGross - (rawGross / 1.2)));

          let finalVat = vat;
          let finalSCharge = sCharge;
          if (finalVat > rawGross && finalVat > 0 && rawGross < 10000) finalVat /= 100;
          if (finalSCharge > rawGross && finalSCharge > 0 && rawGross < 10000) finalSCharge /= 100;

          const net = normalizeCurrency((order as any).netSales || (order as any).net_total || (rawGross - finalVat - finalSCharge));

          // CALCULATE COGS FOR THIS ORDER — recipe resolution goes through the shared resolver
          // (utils/recipeUtils.ts) since real order items come in multiple shapes and a plain
          // item.recipeId lookup only ever matched one of them, leaving COGS at 0 on every
          // historical closure regardless of real sales volume.
          let orderCOGS = 0;
          order.items?.forEach(item => {
            const resolved = resolveOrderItem(item, recipeIndexes);
            const recipe = resolved.recipe;
            if (recipe) {
              let itemUnitCost = 0;
              recipe.ingredients?.forEach((ing: any) => {
                const invItem = inventoryMap.get(ing.inventoryItemId);
                if (invItem) {
                  itemUnitCost += (invItem.pricePerUnit || 0) * (ing.baseQuantity || 0);
                }
              });

              // Modifiers cost
              item.modifiers?.forEach((mod: any) => {
                if (mod.inventoryItemId) {
                  const invItem = inventoryMap.get(mod.inventoryItemId);
                  if (invItem) {
                    itemUnitCost += (invItem.pricePerUnit || 0) * (mod.quantity || 1);
                  }
                }
              });

              orderCOGS += itemUnitCost * resolved.quantity;

              const cat = resolved.category;
              salesByCategory[cat] = (salesByCategory[cat] || 0) + resolved.revenue;
              cogsByCategory[cat] = (cogsByCategory[cat] || 0) + (itemUnitCost * resolved.quantity);

              // track for insights
              const itemKey = resolved.name;
              if (!itemAnalysis[itemKey]) {
                itemAnalysis[itemKey] = { name: itemKey, revenue: 0, cogs: 0, volume: 0 };
              }
              itemAnalysis[itemKey].revenue += resolved.revenue;
              itemAnalysis[itemKey].cogs += itemUnitCost * resolved.quantity;
              itemAnalysis[itemKey].volume += resolved.quantity;
            }
          });
          totalCOGS += orderCOGS;

          serviceChargeTotal += finalSCharge;
          discountTotal += disc;
          orderGrossSales += rawGross;
          orderVatTotal += finalVat;
          orderNetSales += net;

          const rawStaffId = (order as any).staffId || order.waiterId || (order as any).userId || (order as any).createdBy || 'Unknown';
          const profile = staffById[rawStaffId] || 
                         staffByPin[rawStaffId] || 
                         staffByName[rawStaffId.toString().toLowerCase()] || 
                         staffDocs.find(s => s.firstName?.toLowerCase() === rawStaffId.toString().toLowerCase());
          
          const sId = profile ? profile.id : rawStaffId;

          if (!staffMap[sId]) {
            staffMap[sId] = { staffId: sId, orders: 0, grossSales: 0, serviceCharge: 0, discounts: 0 };
          }
          staffMap[sId].orders += 1;
          staffMap[sId].grossSales += rawGross;
          staffMap[sId].serviceCharge += finalSCharge;
          staffMap[sId].discounts += disc;
        });
      }
    }

    // 5. Finalize Totals (V4 Rule - Dashboard Sync)
    // Formula verified from user dashboard: 
    // Gross Sales = Total Paid - Tips
    // VAT = (Gross Sales - Service Charge) / 6
    // Net Sales = Gross Sales - VAT
    // Profit = Net Sales - Service Charge
    
    totals.grossSales = Math.max(0, totals.totalPaid - (totals.tips || 0));
    
    // Choose the best staff breakdown available
    const finalStaffMap = orderGrossSales > 0 ? staffMap : staffPaymentMap;
    const finalServiceChargeTotal = orderGrossSales > 0 ? serviceChargeTotal : 0;
    
    // VAT Sync Calculation
    const vatBaseAmount = Math.max(0, totals.grossSales - finalServiceChargeTotal);
    const calculatedVat = normalizeCurrency(vatBaseAmount - (vatBaseAmount / 1.2));
    
    const vCollected = (orderVatTotal > 0 && orderGrossSales > 0) ? orderVatTotal : calculatedVat;
    
    // Expenses & Labour
    const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const vatOnExpenses = expenses.reduce((acc, e) => acc + (Number(e.vatAmount) || 0), 0);
    const totalLabour = clockRecords.reduce((acc, c) => acc + (Number(c.totalCost) || 0), 0);

    totals.vat = {
      collected: vCollected,
      payable: vCollected - vatOnExpenses
    };
    totals.serviceCharge = {
      collected: finalServiceChargeTotal,
      pending: finalServiceChargeTotal // Default to pending until distributed logic implemented
    };

    totals.vatTotal = vCollected;
    totals.serviceChargeTotal = finalServiceChargeTotal;
    totals.netSales = normalizeCurrency(totals.grossSales - totals.vat.collected - totals.serviceCharge.collected);
    
    totals.cogs = normalizeCurrency(totalCOGS);
    totals.labour = normalizeCurrency(totalLabour);
    totals.expenses = normalizeCurrency(totalExpenses);

    totals.profitBeforeVAT = normalizeCurrency(totals.netSales - totals.cogs - totals.labour - totals.expenses);
    totals.vatLiability = totals.vat.payable;
    totals.realProfitAfterVAT = normalizeCurrency(totals.profitBeforeVAT - totals.vatLiability);

    totals.profit = totals.realProfitAfterVAT; // Use real profit for legacy consistency
    totals.salesByCategory = salesByCategory;
    totals.cogsByCategory = cogsByCategory;
    
    // Profit Report
    const revenue = totals.grossSales; // Base revenue on gross sales now
    const profitReport = {
      revenue: revenue,
      cogs: totals.cogs,
      grossProfit: normalizeCurrency(revenue - totals.cogs),
      grossMargin: revenue > 0 ? normalizeCurrency(((revenue - totals.cogs) / revenue) * 100) : 0
    };

    totals.discountTotal = discountTotal;
    totals.orderCount = uniqueOrderIds.size;
    totals.averageOrderValue = totals.orderCount > 0 ? totals.grossSales / totals.orderCount : 0;

    const byStaff = Object.values(finalStaffMap).map(s => {
      const profile = staffById[s.staffId] || staffByPin[s.staffId] || {};
      const gross = s.grossSales;
      const sCharge = (s as any).serviceCharge || 0;
      
      const vBase = gross - sCharge;
      const vat = Math.max(0, vBase - (vBase / 1.2));
      const net = gross - vat;

      return {
        staffId: s.staffId,
        staffName: profile.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : (profile.name || s.staffId),
        role: profile.role || 'Waiter',
        orders: s.orders,
        grossSales: gross,
        netSales: net,
        vat: vat,
        serviceCharge: sCharge,
        discounts: (s as any).discounts || 0,
        averageOrderValue: s.orders > 0 ? gross / s.orders : 0
      };
    });

    const byHour = Object.entries(hourlyMap).map(([hour, data]) => {
      const totalPaid = data.totalPaid;
      // Pro-rata mapping factor (Gross / TotalPaid)
      const grossRatio = totals.totalPaid > 0 ? totals.grossSales / totals.totalPaid : 1;
      const hourlyGross = totalPaid * grossRatio;
      
      const overallVatRatio = totals.grossSales > 0 ? totals.vatTotal / totals.grossSales : (1 / 6);
      const vat = hourlyGross * overallVatRatio;
      const net = hourlyGross - vat;
      
      return {
        hour: parseInt(hour),
        totalPaid: totalPaid,
        orderCount: data.orderIds.size,
        grossSales: hourlyGross,
        netSales: net,
        vat: vat
      };
    }).sort((a, b) => a.hour - b.hour);

    console.log('[Staff Breakdown] total staff found:', byStaff.length);
    console.log('[Hourly Breakdown] hours:', byHour.length);

    // Detailed VAT Report
    const serviceChargeGross = serviceChargeTotal;
    const serviceChargeNet = serviceChargeGross; 
    const serviceChargeVAT = 0; 

    const discountGross = discountTotal;
    const discountNet = discountGross / 1.2;
    const discountVATImpact = discountGross - discountNet;

    const vatReport = {
      grossSales: totals.grossSales,
      netSales: totals.netSales,
      vatTotal: totals.vatTotal,
      serviceChargeGross,
      serviceChargeNet,
      serviceChargeVAT,
      discountGross,
      discountNet,
      discountVATImpact
    };

    const breakdowns = {
      byPaymentMethod: Object.fromEntries(
        (Object.entries(totals).filter(([k]) => k.includes('Total') && !['vatTotal', 'serviceChargeTotal', 'discountTotal', 'orderCount', 'totalPaid'].includes(k)) as [string, number][])
        .map(([k, v]) => [k.replace('Total', ''), v])
      ) as Record<string, number>,
      byStaff,
      byHour
    };

    // 4. Generate Insights
    const lowMarginItems = Object.values(itemAnalysis)
      .map(item => {
        const margin = item.revenue > 0 ? ((item.revenue - item.cogs) / item.revenue) * 100 : 0;
        return { name: item.name, margin, volume: item.volume };
      })
      .filter(item => item.margin < 60 && item.volume > 0)
      .sort((a, b) => a.margin - b.margin);

    const topItems = Object.values(itemAnalysis)
      .map(item => ({ name: item.name, revenue: item.revenue, profit: item.revenue - item.cogs }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topStaff = [];
    if (byStaff.length > 0) {
      const topSeller = [...byStaff].sort((a, b) => b.grossSales - a.grossSales)[0];
      const topAov = [...byStaff].sort((a, b) => b.averageOrderValue - a.averageOrderValue)[0];
      topStaff.push({ name: topSeller.staffName, metric: 'Highest Sales', value: `£${topSeller.grossSales.toFixed(2)}` });
      topStaff.push({ name: topAov.staffName, metric: 'Highest AOV', value: `£${topAov.averageOrderValue.toFixed(2)}` });
    }

    const slowHours = byHour
      .filter(h => h.totalPaid > 0)
      .sort((a, b) => a.totalPaid - b.totalPaid)
      .slice(0, 2)
      .map(h => ({ hour: `${h.hour}:00`, revenue: h.totalPaid }));

    const discountAlerts = byStaff
      .map(s => ({ staffName: s.staffName, ratio: (s.discounts / s.grossSales) * 100, amount: s.discounts }))
      .filter(s => s.ratio > 10)
      .sort((a, b) => b.ratio - a.ratio);

    const profitWarnings = [];
    if (totals.totalPaid > 500 && profitReport.grossMargin < 65) {
      profitWarnings.push(`High volume (${totals.totalPaid.toFixed(2)}) but lower than ideal margin (${profitReport.grossMargin.toFixed(1)}%). Review COGS.`);
    }

    const insights = {
      lowMarginItems: lowMarginItems.slice(0, 10),
      topItems,
      topStaff,
      slowHours,
      discountAlerts,
      profitWarnings
    };

    // 5. Generate Auto-Actions
    const pricingActions = Object.values(itemAnalysis)
      .filter(item => {
        const margin = item.revenue > 0 ? ((item.revenue - item.cogs) / item.revenue) * 100 : 0;
        return margin < 60 && item.volume > 0;
      })
      .map(item => {
        const margin = ((item.revenue - item.cogs) / item.revenue) * 100;
        const currentPrice = item.revenue / item.volume;
        const unitCost = item.cogs / item.volume;
        // Target 70% margin: (Price - Cost) / Price = 0.7 => Price - Cost = 0.7Price => 0.3Price = Cost => Price = Cost / 0.3
        const suggestedPrice = normalizeCurrency(unitCost / 0.3);
        return {
          itemName: item.name,
          currentMargin: margin,
          currentPrice: currentPrice,
          suggestedPrice: suggestedPrice,
          suggestion: `Increase price from £${currentPrice.toFixed(2)} to £${suggestedPrice.toFixed(2)} to reach 70% margin.`
        };
      })
      .sort((a, b) => a.currentMargin - b.currentMargin)
      .slice(0, 5);

    const staffingActions: { hour: string; action: 'increase' | 'decrease'; suggestion: string }[] = [];
    const sortedHours = [...byHour].sort((a, b) => b.totalPaid - a.totalPaid);
    
    // Top 2 hours -> increase staff
    sortedHours.slice(0, 2).forEach(h => {
      if (h.totalPaid > 100) {
        staffingActions.push({
          hour: `${h.hour}:00`,
          action: 'increase',
          suggestion: `Peak traffic detected (£${h.hour.toFixed(2)}). Consider adding floor support during this window.`
        });
      }
    });

    // Bottom 2 active hours -> decrease staff
    const activeHours = byHour.filter(h => h.totalPaid > 0).sort((a, b) => a.totalPaid - b.totalPaid);
    activeHours.slice(0, 2).forEach(h => {
      staffingActions.push({
        hour: `${h.hour}:00`,
        action: 'decrease',
        suggestion: `Low traffic window detected (£${h.totalPaid.toFixed(2)}). Suggest reducing staff or scheduled breaks.`
      });
    });

    const promotionActions = activeHours.slice(0, 2).map(h => ({
      hour: `${h.hour}:00`,
      suggestion: `Schedule 'Happy Hour' or bundle promos to boost revenue during this quiet period.`
    }));

    const riskAlerts: { type: string; message: string; severity: 'high' | 'medium' }[] = [];
    if (profitReport.grossMargin < 65) {
      riskAlerts.push({
        type: 'Margin Risk',
        message: `Overall margin is ${profitReport.grossMargin.toFixed(1)}% (Target: 70%+). High risk of overheads exceeding profit.`,
        severity: 'high'
      });
    }
    discountAlerts.forEach(alert => {
      riskAlerts.push({
        type: 'Revenue Leakage',
        message: `Staff ${alert.staffName} issued ${alert.ratio.toFixed(1)}% discounts. Verify against policy.`,
        severity: alert.ratio > 20 ? 'high' : 'medium'
      });
    });

    const actions = {
      pricing: pricingActions,
      staffing: staffingActions,
      promotions: promotionActions,
      riskAlerts
    };

    // 6. Construct Closure Document (Strict V1 Structure)
    const closureId = `cls_${type}_${Date.now()}`;
    const closure: DailyClosure = {
      id: closureId,
      locationId: LOCATION_ID,
      type,
      date,
      shiftName,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      closedBy: {
        staffId: staff.id,
        name: staff.name
      },
      totals,
      insights,
      actions,
      profitReport,
      vatReport,
      breakdowns,
      meta: {
        totalOrders: uniqueOrderIds.size,
        totalPayments: payments.length,
        createdAt: new Date().toISOString()
      }
    };

    // 5. Save Closure and Lock Records (Atomic Batch)
    const batch = writeBatch(db);
    const closureRef = doc(db, 'dailyClosures', closureId);
    batch.set(closureRef, cleanObject(closure));

    // Persist specialize trackers for VAT and Service Charge
    const vatTrackerRef = doc(db, 'vatTracker', date);
    batch.set(vatTrackerRef, {
      id: date,
      locationId: LOCATION_ID,
      date,
      vatCollected: totals.vat.collected,
      vatOnExpenses: totalExpenses > 0 ? (totalExpenses - (totalExpenses / 1.2)) : 0, // Fallback if vatOnExpenses not tracked per item
      vatPayable: totals.vat.payable,
      lastUpdated: new Date().toISOString()
    });

    const scTrackerRef = doc(db, 'serviceChargeTracker', date);
    batch.set(scTrackerRef, {
      id: date,
      locationId: LOCATION_ID,
      date,
      totalServiceCharge: totals.serviceCharge.collected,
      distributed: 0, // Will be updated by distribution logic
      pending: totals.serviceCharge.collected,
      lastUpdated: new Date().toISOString()
    });

    if (lockRecords && payments.length > 0) {
      // Create a map of docs that were included in the filtered set
      const docMap = new Map(paymentsSnapshot.docs.map(doc => [doc.id, doc]));
      
      payments.forEach(p => {
        const docSnap = docMap.get(p.id);
        if (docSnap) {
          batch.update(docSnap.ref, { closed: true, closureId });
        }
      });
    }

    await batch.commit();
    console.log('[Close Day] saved:', closureId);

    // Distribute Service Charge to Staff
    try {
      await distributeServiceCharge(closure);
    } catch (scErr) {
      console.warn("Service charge distribution failed:", scErr);
    }

    // 6. Trigger Forecasting Engine Refresh & Staff Performance
    if (type === ClosureType.DAY) {
      try {
        await generateForecast('day');
        await generateForecast('week');
        await generateForecast('month');
        await generateForecast('quarter');
        await processStaffPerformance(closure);
        await runMenuEngineering();
      } catch (fErr) {
        console.warn("Auto-background tasks failed after closure:", fErr);
      }

      // Generate the day's AI insight exactly once, at closure time, and cache it on the
      // closure document. The Dashboard only ever reads this cached field — it never
      // triggers a live AI call itself, no matter how many times it's viewed.
      try {
        const lowStockForInsight = Array.from(inventoryMap.values())
          .filter((i: any) => (Number(i.quantity) || 0) <= (Number(i.minStockLevel) || 0))
          .slice(0, 15)
          .map((i: any) => ({ name: i.name, qty: i.quantity, min: i.minStockLevel, supplier: i.supplier }));

        const aiInsight = await generateDailyAiInsight(closure, lowStockForInsight);
        if (aiInsight) {
          await updateDoc(closureRef, { aiInsight });
        }
      } catch (aiErr) {
        console.warn("Daily AI insight generation failed:", aiErr);
      }
    }

    return closure;

  } catch (error) {
    console.error("Closure failed:", error);
    handleFirestoreError(error, OperationType.WRITE, 'dailyClosures (performClosure)');
    throw error;
  }
}

/**
 * Generates one strategic insight summary for the closed business day.
 * Called exactly once per DAY closure from performClosure — never from the Dashboard,
 * so viewing the dashboard (any number of times, by any number of staff) never spends tokens.
 */
async function generateDailyAiInsight(
  closure: DailyClosure,
  lowStockItems: { name: string; qty: number; min: number; supplier?: string }[]
): Promise<string> {
  try {
    const { totals, insights, date } = closure;

    const prompt = `Act as an expert Restaurant Operations & Supply Chain Manager.
    Analyze this business day's closing figures (${date}) and provide a strategic summary for tomorrow's shift.

    TODAY'S RESULTS:
    Gross Sales: £${totals.grossSales.toFixed(2)}, Net Sales: £${totals.netSales.toFixed(2)}, Orders: ${totals.orderCount}, Average Order Value: £${totals.averageOrderValue.toFixed(2)}

    TOP ITEMS: ${JSON.stringify(insights?.topItems || [])}
    LOW MARGIN ITEMS: ${JSON.stringify(insights?.lowMarginItems || [])}
    SLOW HOURS: ${JSON.stringify(insights?.slowHours || [])}
    PROFIT WARNINGS: ${JSON.stringify(insights?.profitWarnings || [])}

    LOW / OUT OF STOCK ITEMS: ${JSON.stringify(lowStockItems)}

    Please provide:
    1. URGENT ACTIONS: 3 immediate steps to prevent out-of-stock or waste tomorrow.
    2. FORECAST: Predict demand for the next 7 days based on today's trends.
    3. MARGIN PROTECTION: Recommendations on where to cut waste or negotiate better pricing.
    4. TEAM BRIEFING NOTE: A short one-liner for the staff about tomorrow's focus.

    Format with bold headers and clear bullet points. Be ruthless about operational efficiency.`;

    // Routed through the callGemini Cloud Function (functions/index.js) so the
    // Gemini API key stays server-side instead of exposed in the browser bundle.
    const result = await callGemini({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    const data = result.data as { text: string; images: any[] };

    return data.text || '';
  } catch (error) {
    console.warn("[Closure] AI insight generation failed:", handleAiError(error));
    return '';
  }
}

/**
 * Distributes collected service charge among staff active during the period.
 */
async function distributeServiceCharge(closure: DailyClosure) {
  const { breakdowns, date, locationId } = closure;
  const staffByOrders = breakdowns.byStaff;
  if (!staffByOrders || staffByOrders.length === 0) return;

  const totalSC = closure.totals.serviceCharge.collected;
  if (totalSC <= 0) return;

  const batch = writeBatch(db);
  const scPerStaff = normalizeCurrency(totalSC / staffByOrders.length);

  staffByOrders.forEach(s => {
    const earningsId = `${s.staffId}_${date.replace(/-/g, '')}`;
    const earningsRef = doc(db, 'staffEarnings', earningsId);
    
    batch.set(earningsRef, {
      id: earningsId,
      staffId: s.staffId,
      date,
      locationId,
      basePay: 0, // Placeholder
      serviceChargeShare: scPerStaff,
      totalEarnings: scPerStaff,
      timestamp: new Date().toISOString()
    });
  });

  await batch.commit();
}
