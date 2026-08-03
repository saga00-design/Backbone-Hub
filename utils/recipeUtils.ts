import { InventoryItem, RecipeIngredient, Unit, Recipe, POSOrder } from '../types';
import { CONVERSION_FACTORS, convertToBaseUnit } from './unitConversions';

// Helper to get ingredient details
export const getIngredientDetails = (
  ing: RecipeIngredient, 
  inventoryItems: InventoryItem[], 
  recipes: Recipe[] = []
) => {
  // Try to find in standard inventory first
  let item = inventoryItems.find(i => i.id === ing.inventoryItemId);
  let cost = 0;
  
  if (item) {
    const baseQty = convertToBaseUnit(ing.quantity, ing.unit as Unit, item.unitSize);
    cost = (item.pricePerUnit || 0) * baseQty;
  } else if (ing.inventoryItemId.startsWith('recipe-')) {
    // If not in items, it might be a recipe/batch
    const recipeId = ing.inventoryItemId.replace('recipe-', '');
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      const baseQty = convertToBaseUnit(ing.quantity, ing.unit as Unit, 1);
      
      // Use the stored pricePerUnit of the recipe (should be per base unit)
      cost = (recipe.pricePerUnit || 0) * baseQty;
      
      // Create a mock InventoryItem for the UI
      const recipeBaseUnit = (recipe.yieldUnit === 'L' || recipe.yieldUnit === 'ml' ? 'ml' : recipe.yieldUnit === 'kg' || recipe.yieldUnit === 'g' ? 'g' : 'pcs') as Unit;
      const yieldFactor = CONVERSION_FACTORS[recipe.yieldUnit as Unit] || 1;
      
      item = {
        id: ing.inventoryItemId,
        name: recipe.name,
        category: 'Prep',
        department: 'Food',
        inventoryType: (recipe.yieldUnit === 'L' || recipe.yieldUnit === 'ml' ? 'LIQUID' : 'SOLID') as any,
        baseUnit: recipeBaseUnit,
        quantity: recipe.quantity || 0,
        unit: (recipe.yieldUnit as Unit) || 'portions' as Unit,
        unitSize: 1,
        pricePerUnit: recipe.pricePerUnit || 0,
        minStockLevel: 0,
        lastUpdated: recipe.lastUpdated || '',
        isActive: true
      };
    }
  }
  
  return { item, cost };
};

// Precision rounding helper
export const roundTo = (num: number, decimals: number = 6): number => {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};

// Calculate total cost of a recipe
export const calculateTotalCost = (
  recipeIngredients: RecipeIngredient[] | undefined, 
  inventoryItems: InventoryItem[],
  recipes: Recipe[] = [],
  visitedIds: string[] = [],
  warnings?: string[]
): number => {
  if (!recipeIngredients) return 0;
  
  const totalRaw = recipeIngredients.reduce((total, ing) => {
    // Check for circular dependency
    if (visitedIds.includes(ing.inventoryItemId)) {
      throw new Error(`Circular dependency detected: ${ing.inventoryItemId} is already in the dependency chain.`);
    }

    let cost = 0;
    const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
    
    if (item) {
      if ((item.pricePerUnit || 0) === 0 && warnings) {
        const warning = `Ingredient "${item.name}" has zero price.`;
        if (!warnings.includes(warning)) warnings.push(warning);
      }
      const baseQty = convertToBaseUnit(ing.quantity, ing.unit as Unit, item.unitSize);
      cost = (item.pricePerUnit || 0) * baseQty;
    } else if (ing.inventoryItemId.startsWith('recipe-')) {
      const recipeId = ing.inventoryItemId.replace('recipe-', '');
      const recipe = recipes.find(r => r.id === recipeId);
      
      if (recipe) {
        if ((recipe.pricePerUnit || 0) === 0 && warnings) {
          const warning = `Sub-recipe "${recipe.name}" has zero price.`;
          if (!warnings.includes(warning)) warnings.push(warning);
        }
        const baseQty = convertToBaseUnit(ing.quantity, ing.unit as Unit, 1);
        
        // Recursively calculate the cost of the sub-recipe to ensure accuracy
        const subRecipeCost = calculateTotalCost(
          recipe.ingredients, 
          inventoryItems, 
          recipes, 
          [...visitedIds, ing.inventoryItemId],
          warnings
        );
        
        // If the sub-recipe has a yield, calculate cost per yield unit
        const yieldAmount = recipe.yieldAmount || 1;
        const yieldFactor = CONVERSION_FACTORS[recipe.yieldUnit as Unit] || 1;
        const costPerBaseUnit = subRecipeCost / (yieldAmount * yieldFactor);
        
        cost = costPerBaseUnit * baseQty;
      }
    }
    
    return total + cost;
  }, 0);

  return roundTo(totalRaw, 4);
};

// Calculate Gross Profit percentage
export const calculateGP = (priceExcVat: number, cost: number): number => {
  if (priceExcVat <= 0) return 0;
  return roundTo(((priceExcVat - cost) / priceExcVat) * 100, 2);
};

// Resolve a recipe's POS menu category ID (used for POS sync + Food tab filtering)
export const mapCategoryId = (recipe: Recipe | null | undefined): string => {
  if (!recipe) return 'cat_mains';

  // 1. If recipe has a posCategoryId set directly — use it (most accurate)
  if (recipe.posCategoryId) return recipe.posCategoryId;

  // 2. subCategory already stores a resolved cat_ id (set by the POS Category picker) — trust it
  if (recipe.subCategory?.startsWith('cat_')) return recipe.subCategory;

  const category = (recipe.category || '').toLowerCase();
  const menuPath = (recipe.menuPath || '').toLowerCase();
  const course = (recipe.course || '').toLowerCase();

  // 3. Drinks — specific subcategories first
  if (menuPath.includes('margarita')) return 'cat_margaritas';
  if (menuPath.includes('beer cocktail')) return 'cat_beers';
  if (menuPath.includes('mezcal cocktail') || menuPath.includes('mezcal')) return 'cat_cocktails';
  if (menuPath.includes('mexican classic') || menuPath.includes('cocktail')) return 'cat_cocktails';
  if (menuPath.includes('mocktail') || menuPath.includes('alcohol free')) return 'cat_mocktails';
  if (menuPath.includes('beer')) return 'cat_beers';
  if (menuPath.includes('wine')) return 'cat_wines';
  if (menuPath.includes('tequila') || menuPath.includes('mezcal')) return 'cat_spirits';
  if (menuPath.includes('liqueur coffee') || menuPath.includes('hot drink')) return 'cat_hot_drinks';
  if (menuPath.includes('spirit')) return 'cat_spirits';
  if (menuPath.includes('soft drink') || menuPath.includes('jarritos')) return 'cat_soft_drinks';
  if (category.includes('beverage') || menuPath.includes('drink')) return 'cat_drinks';

  // 4. Food categories
  if (menuPath.includes('tacos') || menuPath.includes('taco')) return 'cat_tacos';
  if (menuPath.includes('starter') || menuPath.includes('antojito') || menuPath.includes('ceviche') || menuPath.includes('soup')) return 'cat_starters';
  if (menuPath.includes('dessert')) return 'cat_desserts';
  if (menuPath.includes('side')) return 'cat_sides';
  if (menuPath.includes('sharing') || menuPath.includes('main')) return 'cat_mains';

  // 5. Course fallback
  if (course.includes('starter') || course.includes('1st')) return 'cat_starters';
  if (course.includes('dessert')) return 'cat_desserts';
  if (course.includes('side')) return 'cat_sides';

  return 'cat_mains';
};

export interface CategorySalesSplit {
  byCategory: Record<string, number>; // revenue per recipe.category value (or 'Uncategorized')
  percentByCategory: Record<string, number>; // 0-100, of totalGross
  totalGross: number;
}

export interface RecipeIndexes {
  byId: Map<string, Recipe>;
  byName: Map<string, Recipe>;
}

export interface ResolvedOrderItem {
  recipe: Recipe | null;
  matchedBy: 'id' | 'prefixedId' | 'name' | 'snapshot' | 'none';
  category: string; // recipe.category/type, POS snapshot Food/Beverage, or 'Uncategorized'
  name: string; // best available display name (recipe name, snapshot name, or item name)
  quantity: number;
  revenue: number;
  // Stable grouping key for per-item aggregation (e.g. Menu Performance): the recipe id when
  // resolved, otherwise a cleaned name — so the same real-world item still aggregates together
  // across order-item shapes even without a recipe link.
  key: string;
}

// Order items in this database are not uniform — at least two live shapes exist side by side:
// { recipeId, name, price, quantity } (per-unit price in pounds, matches the POSOrderItem type)
// and { menuItemId, totalPrice, snapshot: { name, categoryId, isDrink, priceGross } } (POS-native
// shape, values in pence, totalPrice already = priceGross * quantity). Recipe ids also don't
// always match menuItemId directly — real recipe docs are frequently id-prefixed ("r_paloma"
// for menuItemId "paloma"), so id matching tries both forms before falling back to a
// cleaned-name match against recipes. This is the one shared resolver — services/
// menuEngineeringService.ts (per-item sales matching) and the live Food/Beverage split both
// go through it, so a fix to real-data matching only has to happen in one place.
export const cleanNameKey = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

export function buildRecipeIndexes(recipes: Recipe[]): RecipeIndexes {
  return {
    byId: new Map(recipes.map(r => [r.id, r])),
    byName: new Map(recipes.map(r => [cleanNameKey(r.name), r]))
  };
}

function resolveItemRevenue(item: any): number {
  if (item.totalPrice !== undefined) return (Number(item.totalPrice) || 0) / 100;
  if (item.snapshot?.priceGross !== undefined) {
    return ((Number(item.snapshot.priceGross) || 0) * (Number(item.quantity) || 1)) / 100;
  }
  return (Number(item.price) || 0) * (Number(item.quantity) || 1);
}

// Resolves a single real order item (any of the known live shapes) to its recipe, category,
// revenue, and quantity. Never throws and never silently drops an item — anything that can't be
// matched to a recipe or a POS snapshot classification comes back as category 'Uncategorized'
// with matchedBy 'none', still carrying its real revenue/quantity for the caller to aggregate.
export function resolveOrderItem(item: any, indexes: RecipeIndexes): ResolvedOrderItem {
  const quantity = Number(item.quantity) || 1;
  const revenue = resolveItemRevenue(item);
  const id = item.recipeId || item.menuItemId || item.itemId;
  const displayName = item.snapshot?.name || item.name || '';
  const nameKey = cleanNameKey(displayName);

  let recipe: Recipe | null = null;
  let matchedBy: ResolvedOrderItem['matchedBy'] = 'none';
  if (id && indexes.byId.has(id)) {
    recipe = indexes.byId.get(id)!;
    matchedBy = 'id';
  } else if (id && indexes.byId.has(`r_${id}`)) {
    recipe = indexes.byId.get(`r_${id}`)!;
    matchedBy = 'prefixedId';
  } else if (nameKey && indexes.byName.has(nameKey)) {
    recipe = indexes.byName.get(nameKey)!;
    matchedBy = 'name';
  }

  let category: string;
  if (recipe) {
    category = recipe.category || recipe.type || 'Uncategorized';
  } else if (item.snapshot && typeof item.snapshot.isDrink === 'boolean') {
    // No recipe link at all — fall back to the POS's own snapshot classification rather than
    // leaving a resolvable item Uncategorized just because it was never linked to a recipe.
    category = item.snapshot.isDrink ? 'Beverage' : 'Food';
    matchedBy = 'snapshot';
  } else {
    category = 'Uncategorized';
  }

  return {
    recipe,
    matchedBy,
    category,
    name: recipe?.name || displayName || 'Unknown',
    quantity,
    revenue,
    key: recipe ? recipe.id : (nameKey || id || 'unknown')
  };
}

// Buckets order-item revenue by category (Food/Beverage/etc) for an arbitrary set of orders.
// Same underlying goal as the post-closure salesByCategory calculation in
// services/closureService.ts, generalized so it can run against today's live orders as well as
// a closed period. Items that can't be resolved to a category by any strategy go to
// 'Uncategorized' rather than being silently dropped or guessed at.
export function computeCategorySalesSplit(
  orders: Pick<POSOrder, 'items'>[],
  recipes: Recipe[]
): CategorySalesSplit {
  const indexes = buildRecipeIndexes(recipes);
  const byCategory: Record<string, number> = {};
  let totalGross = 0;

  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const resolved = resolveOrderItem(item, indexes);
      const { revenue, category: cat } = resolved;
      byCategory[cat] = (byCategory[cat] || 0) + revenue;
      totalGross += revenue;
    });
  });

  const percentByCategory: Record<string, number> = {};
  Object.keys(byCategory).forEach(cat => {
    percentByCategory[cat] = totalGross > 0 ? roundTo((byCategory[cat] / totalGross) * 100, 1) : 0;
  });

  return { byCategory, percentByCategory, totalGross: roundTo(totalGross, 2) };
}
