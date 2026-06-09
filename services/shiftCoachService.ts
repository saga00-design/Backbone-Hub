import { POSOrder, Table, StaffMember, Recipe, InventoryItem, ShiftInsight, MovementType } from '../types';

export function generateShiftInsights(
  orders: POSOrder[],
  tables: Table[],
  staff: StaffMember[],
  recipes: Recipe[],
  inventory: InventoryItem[],
  locationId: string
): ShiftInsight[] {
  const insights: ShiftInsight[] = [];
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const parseDate = (d: any) => {
    if (!d) return new Date(0);
    if (d.toDate && typeof d.toDate === 'function') return d.toDate();
    return new Date(d);
  };

  const todayOrders = orders.filter(o => parseDate(o.createdAt) >= startOfToday);

  // 1. TIMING & DELAYS (High Priority)
  const delayedOrders = todayOrders.filter(o => 
    (o.status === 'Open' || o.status === 'Sent') && 
    (Date.now() - parseDate(o.createdAt).getTime()) / 60000 > 20
  );

  if (delayedOrders.length >= 3) {
    insights.push({
      id: 'delay-critical',
      type: 'timing',
      priority: 'high',
      message: 'Kitchen Bottleneck Detected',
      reason: `${delayedOrders.length} orders are currently exceeding 20 minutes wait time.`,
      action: 'Check with Kitchen Lead / Deploy extra prep runner.',
      timestamp: new Date().toISOString(),
      locationId
    });
  }

  // 1b. FLOOR STAGNATION (High Priority)
  const activeTables = tables.filter(t => t.status === 'occupied' || t.status === 'Seated' || t.status === 'Ordered');
  const stalledTables = activeTables.filter(t => {
    const lastAction = t.lastActionAt || t.seatedAt;
    if (!lastAction) return false;
    return (Date.now() - parseDate(lastAction).getTime()) / 60000 > 30;
  });

  if (stalledTables.length >= 2) {
    insights.push({
      id: 'table-stalled',
      type: 'timing',
      priority: 'high',
      message: 'Floor Stagnation',
      reason: `${stalledTables.length} tables have not been served or updated in over 30 minutes.`,
      action: 'Check tables: ' + stalledTables.map(t => t.number).join(', '),
      timestamp: new Date().toISOString(),
      locationId
    });
  }

  // 2. SALES & UPSELLING (Medium Priority)
  const longOccupancyTables = activeTables.filter(t => {
    const lastAction = t.lastActionAt || t.seatedAt;
    if (!lastAction) return false;
    return (Date.now() - parseDate(lastAction).getTime()) / 60000 > 45;
  });

  if (longOccupancyTables.length >= 2) {
    insights.push({
      id: 'upsell-opportunity',
      type: 'sales',
      priority: 'medium',
      message: 'Upsell Potential: Idle Tables',
      reason: `${longOccupancyTables.length} tables have been idle for over 45 minutes.`,
      action: 'Offer coffee, digestifs, or additional drinks to T' + longOccupancyTables.map(t => t.number).join(', '),
      timestamp: new Date().toISOString(),
      locationId
    });
  }

  // 3. STAFF PERFORMANCE (Medium Priority)
  const staffStats = staff.map(s => {
    const sOrders = todayOrders.filter(o => o.waiterId === s.id);
    const totalSales = sOrders.reduce((acc, o) => acc + o.total, 0);
    const avg = sOrders.length > 0 ? totalSales / sOrders.length : 0;
    return { id: s.id, name: `${s.firstName} ${s.lastName}`, avg, count: sOrders.length };
  }).filter(s => s.count >= 3);

  if (staffStats.length >= 2) {
    const sorted = [...staffStats].sort((a, b) => a.avg - b.avg);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    
    if (highest.avg > lowest.avg * 1.5) {
      insights.push({
        id: 'staff-coaching',
        type: 'staff',
        priority: 'medium',
        message: `Coaching: ${lowest.name}`,
        reason: `Average check (£${lowest.avg.toFixed(2)}) is significantly lower than average (£${(staffStats.reduce((acc, s) => acc + s.avg, 0) / staffStats.length).toFixed(2)}).`,
        action: `Shadow ${lowest.name} on their next 2 tables to boost upselling.`,
        timestamp: new Date().toISOString(),
        locationId
      });
    }
  }

  // 4. LOW STOCK (Medium/High)
  const lowStock = inventory.filter(i => i.isActive && i.quantity <= i.minStockLevel);
  if (lowStock.length > 0) {
    // Only pick the most important/popular low stock item if possible, or just the first few
    const urgentItems = lowStock.slice(0, 2);
    insights.push({
      id: 'inventory-alert',
      type: 'inventory',
      priority: lowStock.length > 5 ? 'high' : 'medium',
      message: 'Critical Stock Alert',
      reason: `${lowStock.length} key ingredients are running below minimum levels.`,
      action: `Check availability for: ${urgentItems.map(i => i.name).join(', ')}.`,
      timestamp: new Date().toISOString(),
      locationId
    });
  }

  // 5. MENU ENGINEERING (Low/Medium Priority)
  const highMarginRecipes = recipes.filter(r => r.type === 'menu_item' && r.marginTarget && r.marginTarget >= 75);
  if (highMarginRecipes.length > 0) {
    const todaySalesItems = todayOrders.flatMap(o => o.items);
    const highMarginUnsold = highMarginRecipes.filter(r => 
      !todaySalesItems.some(i => i.recipeId === r.id)
    ).slice(0, 1);

    if (highMarginUnsold.length > 0) {
      insights.push({
        id: 'menu-push',
        type: 'menu',
        priority: 'low',
        message: 'Profit Booster',
        reason: `${highMarginUnsold[0].name} has high margins but 0 sales today.`,
        action: `Encourage staff to highlight ${highMarginUnsold[0].name} as a special recommendation.`,
        timestamp: new Date().toISOString(),
        locationId
      });
    }
  }

  // 6. FINANCIAL INSIGHTS (VAT & Service Charge)
  const totalSalesToday = todayOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalVATToday = todayOrders.reduce((acc, o) => acc + (Number(o.vat || o.financials?.vatTotal) || 0), 0);
  const totalServiceCharge = todayOrders.reduce((acc, o) => acc + (Number(o.serviceCharge || o.financials?.serviceChargeTotal) || 0), 0);

  if (totalSalesToday > 500 && totalVATToday > totalSalesToday * 0.15) {
    insights.push({
      id: 'vat-liability-high',
      type: 'sales',
      priority: 'medium',
      message: 'High VAT Liability',
      reason: `VAT liability is growing (£${Math.round(totalVATToday)}). Profit is lower relative to tax obligations.`,
      action: 'Promote higher margin items or fixed-price bundles to offset liability.',
      timestamp: new Date().toISOString(),
      locationId
    });
  }

  const scRatio = totalSalesToday > 0 ? (totalServiceCharge / (totalSalesToday - totalServiceCharge)) * 100 : 0;
  if (totalSalesToday > 300 && scRatio < 10) {
    insights.push({
      id: 'service-charge-low',
      type: 'staff',
      priority: 'high',
      message: 'Low Service Charge detected',
      reason: `Service charge yield is only ${scRatio.toFixed(1)}%. This indicates weak upselling or service gaps.`,
      action: 'Brief team on service standards. Ensure service charge is being clearly presented.',
      timestamp: new Date().toISOString(),
      locationId
    });
  }

  return insights.slice(0, 5); // Max 5 active
}
