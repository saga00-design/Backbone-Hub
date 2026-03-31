import { InventoryItem, RecipeIngredient } from '../types';

// Helper to convert units
export const convertQuantity = (quantity: number, fromUnit: string, toUnit: string): number => {
  if (!fromUnit || !toUnit) return quantity;
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();
  if (from === to) return quantity;

  // Weight
  if ((from === 'kg' || from === 'kilogram') && (to === 'g' || to === 'gram' || to === 'gr')) return quantity * 1000;
  if ((from === 'g' || from === 'gram' || from === 'gr') && (to === 'kg' || to === 'kilogram')) return quantity / 1000;

  // Volume
  if ((from === 'l' || from === 'liter' || from === 'litre' || from === 'lt') && (to === 'ml' || to === 'milliliter')) return quantity * 1000;
  if ((from === 'ml' || from === 'milliliter') && (to === 'l' || to === 'liter' || to === 'litre' || to === 'lt')) return quantity / 1000;

  // Fallback
  return quantity;
};

// Helper to get ingredient details
export const getIngredientDetails = (ing: RecipeIngredient, inventoryItems: InventoryItem[]) => {
  const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
  let cost = 0;
  if (item) {
    const quantityInBaseUnit = ing.unit ? convertQuantity(ing.quantity, ing.unit, item.unit) : ing.quantity;
    cost = item.pricePerUnit * quantityInBaseUnit;
  }
  return { item, cost };
};

// Calculate total cost of a recipe
export const calculateTotalCost = (recipeIngredients: RecipeIngredient[] | undefined, inventoryItems: InventoryItem[]) => {
  if (!recipeIngredients) return 0;
  return recipeIngredients.reduce((total, ing) => {
    const { cost } = getIngredientDetails(ing, inventoryItems);
    return total + cost;
  }, 0);
};
