import { db, cleanObject, LOCATION_ID } from '../firebase';
import { doc, collection, writeBatch, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { InventoryItem, POSOrder, Recipe, MenuEngineeringRecord } from '../types';
import { calculateTotalCost } from '../utils/recipeUtils';

/**
 * Menu Engineering Service
 * Classifies menu items into Stars, Plowhorses, Puzzles, and Dogs.
 */

export async function runMenuEngineering(days = 30) {
  try {
    const batch = writeBatch(db);
    
    // 1. Fetch Sales Data (Handle both String and Timestamp formats)
    const ordersSnap = await getDocs(query(
      collection(db, 'posOrders'),
      where('locationId', '==', LOCATION_ID)
    ));
    let allOrders = ordersSnap.docs.map(d => ({ ...d.data(), id: d.id } as POSOrder));
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let orders = allOrders.filter(o => {
      if (!o.createdAt) return false;
      const date = new Date(o.createdAt);
      return date >= cutoffDate;
    });

    if (orders.length === 0 && allOrders.length > 0) {
      console.log(`No sales found in the last ${days} days. Broadening to all historical data.`);
      orders = allOrders;
    }

    console.log(`Fetched ${allOrders.length} total orders, matching ${orders.length} for the ${days}-day analysis.`);

    // 2. Fetch Inventory, Recipes & Menu Items
    const [invSnap, recSnap, menuSnap] = await Promise.all([
      getDocs(collection(db, 'inventoryItems')),
      getDocs(collection(db, 'recipes')),
      getDocs(collection(db, 'menuItems'))
    ]);
    const inventory = invSnap.docs.map(d => d.data() as InventoryItem);
    const recipes = recSnap.docs.map(d => d.data() as Recipe);
    const menuItems = menuSnap.docs.map(d => {
      const data = d.data();
      return { ...data, id: d.id } as any; 
    });

    console.log(`Fetched ${menuItems.length} menu items, ${recipes.length} recipes, and ${inventory.length} inventory items.`);

    // 3. Aggregate sales by name and ID for matching
    const salesStats: Record<string, { qty: number; revenue: number }> = {};
    const salesByName: Record<string, { qty: number; revenue: number }> = {};
    let totalQty = 0;

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const rev = price * qty;

        // By ID (recipeId, itemId, or id)
        const targetId = item.itemId || item.recipeId || item.id;
        if (targetId) {
          if (!salesStats[targetId]) salesStats[targetId] = { qty: 0, revenue: 0 };
          salesStats[targetId].qty += qty;
          salesStats[targetId].revenue += rev;
        }

        // By Name (fallback) - aggressive cleaning
        if (item.name) {
          const nameKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
          if (!salesByName[nameKey]) salesByName[nameKey] = { qty: 0, revenue: 0 };
          salesByName[nameKey].qty += qty;
          salesByName[nameKey].revenue += rev;
        }

        totalQty += qty;
      });
    });

    console.log(`[MenuAnalysis] Total Orders: ${orders.length}, Total Qty: ${totalQty}`);

    if (totalQty === 0) {
      console.log('No sales found in the last 30 days. Proceeding with menu metadata only.');
    }

    // 5. Build list of items to analyze
    // Start with menuItems, but fallback to items in recipes or inventory if menuItems is empty
    let itemsToProcess = [...menuItems];
    if (itemsToProcess.length === 0) {
      console.log('No menuItems found. Falling back to recipes and inventory for analysis.');
      const recipeItems = recipes.map(r => ({ id: r.id, name: r.name, category: r.category || 'Menu', recipeId: r.id }));
      const inventoryMenuItems = inventory.filter(i => (i as any).type === 'menu_item').map(i => ({ id: i.id, name: i.name, category: i.category, price: i.retailPrice }));
      itemsToProcess = [...recipeItems, ...inventoryMenuItems];
      
      // Deduplicate by ID
      const seenIds = new Set();
      itemsToProcess = itemsToProcess.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });
    }

    const analysedItems: MenuEngineeringRecord[] = [];
    
    let recipeMatchCount = 0;
    let fallbackCostCount = 0;

    itemsToProcess.forEach(menuItem => {
      let price = 0;
      if (menuItem.priceGross !== undefined) {
        price = menuItem.priceGross / 100;
      } else {
        price = menuItem.price || (menuItem as any).sellingPrice || (menuItem as any).retailPrice || 0;
      }

      const recipeId = menuItem.recipeId || menuItem.modifierGroupIds?.recipeId || null;
      const recipe = recipeId ? recipes.find(r => r.id === recipeId) : recipes.find(r => r.id === menuItem.id || r.name === menuItem.name);

      let unitCost = 0;
      try {
        if (recipe) {
          unitCost = calculateTotalCost(recipe.ingredients, inventory, recipes);
          recipeMatchCount++;
        } else {
          unitCost = (menuItem as any).pricePerUnit || (price * 0.3); 
          fallbackCostCount++;
        }
      } catch (e) {
        console.error(`Error calculating cost for ${menuItem.name}:`, e);
        unitCost = price * 0.3;
        fallbackCostCount++;
      }

      let stats = salesStats[menuItem.id];
      if (!stats && menuItem.slug) {
        // Match by slug if present in stats (unlikely but safe)
        stats = salesStats[menuItem.slug];
      }
      if (!stats && menuItem.name) {
        const nameKey = menuItem.name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
        stats = salesByName[nameKey];
      }

      const qtySold = stats?.qty || 0;
      const revenue = stats?.revenue || 0;
      const profit = revenue - (unitCost * qtySold);
      const avgPrice = qtySold > 0 ? revenue / qtySold : price;
      
      const margin = avgPrice - unitCost;
      const marginPercent = avgPrice > 0 ? (margin / avgPrice) * 100 : 0;
      const popularityIndex = totalQty > 0 ? (qtySold / totalQty) * 100 : 0;

      analysedItems.push({
        id: `eng_${menuItem.id}`,
        locationId: LOCATION_ID,
        itemId: menuItem.id,
        name: menuItem.name || 'Unknown',
        category: menuItem.category || 'Menu',
        metrics: {
          quantitySold: qtySold,
          revenue: revenue,
          profit,
          avgPrice,
          unitCost,
          margin,
          marginPercent,
          popularityIndex
        },
        classification: 'dog',
        action: '',
        insights: {},
        lastUpdated: new Date().toISOString()
      });
    });

    // 4. Calculate averages for classification
    const avgPopularity = analysedItems.length > 0 
      ? analysedItems.reduce((acc, curr) => acc + curr.metrics.popularityIndex, 0) / analysedItems.length 
      : 0;
    
    const avgMarginPercent = analysedItems.length > 0
      ? analysedItems.reduce((acc, curr) => acc + curr.metrics.marginPercent, 0) / analysedItems.length
      : 0;

    // 5. Classify and determine actions
    analysedItems.forEach(item => {
      // Classification: Use > to ensure item is actually better than average
      // Items with 0 sales/margin will correctly be Dogs/Puzzles
      const isHighPop = item.metrics.popularityIndex > avgPopularity;
      const isHighMargin = item.metrics.marginPercent > avgMarginPercent;

      if (isHighPop && isHighMargin) {
        item.classification = 'star';
        item.action = 'Promote heavily; maintain high standard and consistent portioning.';
        
        // Stars: Slight 5-10% increase to maximize profit on volume
        const suggested = item.metrics.avgPrice * 1.05;
        const impact = (suggested - item.metrics.avgPrice) * item.metrics.quantitySold;
        
        item.optimization = {
          currentPrice: item.metrics.avgPrice,
          suggestedPrice: suggested,
          priceChangePercent: 5,
          estimatedProfitImpact: impact,
          priority: 'medium'
        };

        item.insights = {
          promotion: 'Feature on specials board or social media to maximize volume.',
          pricing: 'Test price elasticity with a subtle 5% increase.',
          optimization: 'Watch for waste or over-portioning as this drives the most profit.'
        };
      } else if (isHighPop && !isHighMargin) {
        item.classification = 'plowhorse';
        item.action = 'Increase price carefully or reduce cost through recipe engineering.';
        
        // Plowhorses: Target 65% margin
        const targetMargin = 0.65;
        let suggested = item.metrics.unitCost / (1 - targetMargin);
        
        // Sanity check: cap increase at 30%
        const maxPrice = item.metrics.avgPrice * 1.3;
        if (suggested > maxPrice) suggested = maxPrice;
        
        const impact = (suggested - item.metrics.avgPrice) * item.metrics.quantitySold;
        
        item.optimization = {
          currentPrice: item.metrics.avgPrice,
          suggestedPrice: suggested,
          priceChangePercent: ((suggested / item.metrics.avgPrice) - 1) * 100,
          estimatedProfitImpact: impact,
          priority: 'high'
        };

        item.insights = {
          pricing: `Current margin is low (${item.metrics.marginPercent.toFixed(1)}%). Suggested price £${suggested.toFixed(2)} to reach target margin.`,
          optimization: 'Substitute high-cost ingredients or reduce portion sizes.',
          promotion: 'Reduce active promotion; let it sell naturally due to popularity.'
        };
      } else if (!isHighPop && isHighMargin) {
        item.classification = 'puzzle';
        item.action = 'Improve menu visibility, push through staff recommendations.';
        
        item.optimization = {
          currentPrice: item.metrics.avgPrice,
          suggestedPrice: item.metrics.avgPrice,
          priceChangePercent: 0,
          estimatedProfitImpact: 0,
          priority: 'medium'
        };

        item.insights = {
          promotion: 'Run a "Staff Choice" recommendation program to drive volume.',
          pricing: 'Consider bundle deals instead of price changes to drive trial.',
          optimization: 'Focus on shelf-life as low volume items risk high wastage.'
        };
      } else {
        item.classification = 'dog';
        item.action = 'Consider shelfing, redesigning for lower cost, or replacing.';
        
        item.optimization = {
          currentPrice: item.metrics.avgPrice,
          suggestedPrice: item.metrics.avgPrice,
          priceChangePercent: 0,
          estimatedProfitImpact: 0,
          priority: 'low'
        };

        item.insights = {
          pricing: 'Requires dramatic redesign or removal.',
          optimization: 'Simplify ingredients to reduce prep time and inventory holding cost.',
          promotion: 'Phase out if these metrics persist next month.'
        };
      }

      const ref = doc(db, 'menuEngineering', item.id);
      batch.set(ref, cleanObject(item));
    });

    await batch.commit();
    console.log('Classification working: yes');
    console.log('Menu engineering analysis complete.');
  } catch (error) {
    console.error('Failed to run menu engineering:', error);
  }
}
