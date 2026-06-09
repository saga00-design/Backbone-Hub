
import { collection, query, where, getDocs, db, LOCATION_ID, cleanObject, doc, setDoc } from '../firebase';
import { DailyClosure, Forecast, ForecastType } from '../types';

/**
 * Prediction Engine
 * Generates forecasts based on historical closure data.
 */

export async function generateForecast(type: ForecastType): Promise<Forecast> {
  try {
    const closuresRef = collection(db, 'dailyClosures');
    const q = query(
      closuresRef,
      where('locationId', '==', LOCATION_ID),
      where('type', '==', 'day')
    );
    const snap = await getDocs(q);
    const closures = snap.docs.map(d => d.data() as DailyClosure)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (closures.length === 0) {
      throw new Error("Insufficient data for forecasting. Please perform more daily closures.");
    }

    let forecast: Forecast;

    switch (type) {
      case 'day':
        forecast = calculateDailyForecast(closures);
        break;
      case 'week':
        forecast = calculateWeeklyForecast(closures);
        break;
      case 'month':
        forecast = calculateMonthlyForecast(closures);
        break;
      case 'quarter':
        forecast = calculateQuarterlyForecast(closures);
        break;
      default:
        throw new Error(`Unsupported forecast type: ${type}`);
    }

    // Save to Firestore
    const forecastRef = doc(db, 'predictions', forecast.id);
    await setDoc(forecastRef, cleanObject(forecast));

    return forecast;
  } catch (err) {
    console.error("Forecast generation failed:", err);
    throw err;
  }
}

function calculateDailyForecast(closures: DailyClosure[]): Forecast {
  const last7 = closures.slice(-7);
  const avgRevenue = last7.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0) / (last7.length || 1);
  const avgOrders = last7.reduce((sum, c) => sum + (c.totals?.orderCount || 0), 0) / (last7.length || 1);
  const avgCOGS = last7.reduce((sum, c) => sum + (c.totals?.cogs || 0), 0) / (last7.length || 1);
  const avgProfit = last7.reduce((sum, c) => sum + (c.totals?.profit || 0), 0) / (last7.length || 1);
  
  // Growth calculation
  const current = last7.length > 0 ? (last7[last7.length - 1].totals?.netSales || 0) : 0;
  const previous = last7.length > 1 ? (last7[last7.length - 2].totals?.netSales || 0) : current;
  const growthRate = previous > 0 ? (current - previous) / previous : 0;

  return {
    id: `forecast_day_${Date.now()}`,
    locationId: LOCATION_ID,
    type: 'day',
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 86400000).toISOString(),
    forecast: {
      revenue: avgRevenue,
      orders: Math.round(avgOrders),
      cogs: avgCOGS,
      profit: avgProfit,
      margin: avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0
    },
    trends: {
      growthRate,
      avgDailySales: avgRevenue,
      bestDay: last7.length > 0 ? [...last7].sort((a,b) => b.totals.netSales - a.totals.netSales)[0].date : undefined,
      worstDay: last7.length > 0 ? [...last7].sort((a,b) => a.totals.netSales - b.totals.netSales)[0].date : undefined
    },
    createdAt: new Date().toISOString()
  };
}

function calculateWeeklyForecast(closures: DailyClosure[]): Forecast {
  // Use last 28 days for weekly (approx 4 weeks)
  const last28 = closures.slice(-28);
  const weeklyRevenue = last28.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0) / (last28.length / 7 || 1);
  const weeklyOrders = last28.reduce((sum, c) => sum + (c.totals?.orderCount || 0), 0) / (last28.length / 7 || 1);
  const weeklyCOGS = last28.reduce((sum, c) => sum + (c.totals?.cogs || 0), 0) / (last28.length / 7 || 1);
  const weeklyProfit = last28.reduce((sum, c) => sum + (c.totals?.profit || 0), 0) / (last28.length / 7 || 1);

  // Growth: Last 7 days vs previous 7 days
  const last7 = last28.slice(-7);
  const prev7 = last28.slice(-14, -7);
  const currentRev = last7.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0);
  const prevRev = prev7.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0);
  const growthRate = prevRev > 0 ? (currentRev - prevRev) / prevRev : 0;

  return {
    id: `forecast_week_${Date.now()}`,
    locationId: LOCATION_ID,
    type: 'week',
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 86400000 * 7).toISOString(),
    forecast: {
      revenue: weeklyRevenue,
      orders: Math.round(weeklyOrders),
      cogs: weeklyCOGS,
      profit: weeklyProfit,
      margin: weeklyRevenue > 0 ? (weeklyProfit / weeklyRevenue) * 100 : 0
    },
    trends: {
      growthRate,
      avgDailySales: last28.reduce((sum, c) => sum + c.totals.netSales, 0) / (last28.length || 1),
      bestDay: last28.length > 0 ? [...last28].sort((a,b) => b.totals.netSales - a.totals.netSales)[0].date : undefined,
      worstDay: last28.length > 0 ? [...last28].sort((a,b) => a.totals.netSales - b.totals.netSales)[0].date : undefined
    },
    createdAt: new Date().toISOString()
  };
}

function calculateMonthlyForecast(closures: DailyClosure[]): Forecast {
  const last90 = closures.slice(-90);
  const monthlyRevenue = last90.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0) / (last90.length / 30 || 1);
  const monthlyOrders = last90.reduce((sum, c) => sum + (c.totals?.orderCount || 0), 0) / (last90.length / 30 || 1);
  const monthlyCOGS = last90.reduce((sum, c) => sum + (c.totals?.cogs || 0), 0) / (last90.length / 30 || 1);
  const monthlyProfit = last90.reduce((sum, c) => sum + (c.totals?.profit || 0), 0) / (last90.length / 30 || 1);

  // Growth: Last 30 days vs previous 30 days
  const last30 = last90.slice(-30);
  const prev30 = last90.slice(-60, -30);
  const currentRev = last30.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0);
  const prevRev = prev30.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0);
  const growthRate = prevRev > 0 ? (currentRev - prevRev) / prevRev : 0;

  return {
    id: `forecast_month_${Date.now()}`,
    locationId: LOCATION_ID,
    type: 'month',
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
    forecast: {
      revenue: monthlyRevenue,
      orders: Math.round(monthlyOrders),
      cogs: monthlyCOGS,
      profit: monthlyProfit,
      margin: monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0
    },
    trends: {
      growthRate,
      avgDailySales: last90.reduce((sum, c) => sum + c.totals.netSales, 0) / (last90.length || 1),
      bestDay: last90.length > 0 ? [...last90].sort((a,b) => b.totals.netSales - a.totals.netSales)[0].date : undefined,
      worstDay: last90.length > 0 ? [...last90].sort((a,b) => a.totals.netSales - b.totals.netSales)[0].date : undefined
    },
    createdAt: new Date().toISOString()
  };
}

function calculateQuarterlyForecast(closures: DailyClosure[]): Forecast {
  const last365 = closures.slice(-365);
  const quarterlyRevenue = last365.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0) / (last365.length / 90 || 1);
  const quarterlyOrders = last365.reduce((sum, c) => sum + (c.totals?.orderCount || 0), 0) / (last365.length / 90 || 1);
  const quarterlyCOGS = last365.reduce((sum, c) => sum + (c.totals?.cogs || 0), 0) / (last365.length / 90 || 1);
  const quarterlyProfit = last365.reduce((sum, c) => sum + (c.totals?.profit || 0), 0) / (last365.length / 90 || 1);

  // Growth: Last 90 days vs previous 90 days
  const last90 = last365.slice(-90);
  const prev90 = last365.slice(-180, -90);
  const currentRev = last90.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0);
  const prevRev = prev90.reduce((sum, c) => sum + (c.totals?.netSales || 0), 0);
  const growthRate = prevRev > 0 ? (currentRev - prevRev) / prevRev : 0;

  return {
    id: `forecast_quarter_${Date.now()}`,
    locationId: LOCATION_ID,
    type: 'quarter',
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 86400000 * 90).toISOString(),
    forecast: {
      revenue: quarterlyRevenue,
      orders: Math.round(quarterlyOrders),
      cogs: quarterlyCOGS,
      profit: quarterlyProfit,
      margin: quarterlyRevenue > 0 ? (quarterlyProfit / quarterlyRevenue) * 100 : 0
    },
    trends: {
      growthRate,
      avgDailySales: last365.reduce((sum, c) => sum + c.totals.netSales, 0) / (last365.length || 1),
      bestDay: last365.length > 0 ? [...last365].sort((a,b) => b.totals.netSales - a.totals.netSales)[0].date : undefined,
      worstDay: last365.length > 0 ? [...last365].sort((a,b) => a.totals.netSales - b.totals.netSales)[0].date : undefined
    },
    createdAt: new Date().toISOString()
  };
}
