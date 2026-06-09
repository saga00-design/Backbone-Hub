import { db, cleanObject, LOCATION_ID } from '../firebase';
import { doc, getDoc, collection, writeBatch } from 'firebase/firestore';
import { DailyClosure, StaffPerformanceRecord, StaffIncentiveConfig } from '../types';

/**
 * Staff Incentive & Performance Service
 * Tracks and scores staff based on closure data.
 */

export async function processStaffPerformance(closure: DailyClosure) {
  try {
    const batch = writeBatch(db);
    const staffData = closure.breakdowns.byStaff;
    
    if (!staffData || staffData.length === 0) return;

    // Fetch config for threshold logic
    const configSnap = await getDoc(doc(db, 'settings', `incentive_${LOCATION_ID}`));
    const config = configSnap.exists() ? configSnap.data() as StaffIncentiveConfig : null;

    // Calculate baseline for normalization
    const maxSales = Math.max(...staffData.map(s => s.netSales), 1);
    const maxAOV = Math.max(...staffData.map(s => s.averageOrderValue), 1);
    
    // For margin contribution, we'll estimate based on net sales since we don't have per-staff COGS in the breakdown currently
    // We'll use the overall closure margin if per-staff is unavailable
    const overallMargin = closure.totals.profit / (closure.totals.netSales || 1);

    for (const staff of staffData) {
      const salesScore = (staff.netSales / maxSales) * 100;
      const aovScore = (staff.averageOrderValue / maxAOV) * 100;
      
      // Margin score: based on how much they contributed to overall net sales (normalized)
      const marginScore = (staff.netSales / maxSales) * 100; // Simplified proxy

      // Discount control: 100 if 0 discounts, decreasing as discount ratio increases
      const discountRatio = staff.discounts / (staff.netSales || 1);
      const discountControlScore = Math.max(0, 100 - (discountRatio * 500)); // Steep penalty for discounts

      const score = Math.round(
        (0.4 * salesScore) + 
        (0.3 * aovScore) + 
        (0.2 * marginScore) + 
        (0.1 * discountControlScore)
      );

      let tier: StaffPerformanceRecord['tier'] = 'training';
      
      const platinumMin = config?.tiers.platinum.minScore ?? 90;
      const goldMin = config?.tiers.gold.minScore ?? 80;
      const silverMin = config?.tiers.silver.minScore ?? 70;

      if (score >= platinumMin) tier = 'platinum';
      else if (score >= goldMin) tier = 'gold';
      else if (score >= silverMin) tier = 'silver';

      const perfRecord: StaffPerformanceRecord = {
        id: `perf_${staff.staffId}_${closure.date}`,
        locationId: LOCATION_ID,
        staffId: staff.staffId,
        staffName: staff.staffName,
        date: closure.date,
        metrics: {
          totalSales: staff.netSales,
          orders: staff.orders,
          avgOrderValue: staff.averageOrderValue,
          discounts: staff.discounts,
          discountRatio: discountRatio,
          marginContribution: staff.netSales * overallMargin
        },
        score,
        tier,
        createdAt: new Date().toISOString()
      };

      const ref = doc(db, 'staffPerformance', perfRecord.id);
      batch.set(ref, cleanObject(perfRecord));
    }

    await batch.commit();
    console.log(`Staff performance processed for ${closure.date}`);
  } catch (err) {
    console.error("Failed to process staff performance:", err);
  }
}
