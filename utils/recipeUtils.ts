import { InventoryItem, RecipeIngredient, Unit, Recipe } from '../types';
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
