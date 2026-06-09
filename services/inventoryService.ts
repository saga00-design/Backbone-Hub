
import { db, doc, updateDoc, increment, collection, setDoc, query, where, getDocs, LOCATION_ID } from '../firebase';
import { Recipe, InventoryItem, POSOrderItem, RecipeIngredient, StockMovement } from '../types';
import { convertToBaseUnit } from '../utils/unitConversions';

/**
 * Deducts stock based on a POS order.
 * Iterates through order items, finds their recipes, and deducts ingredients.
 */
export async function deductStockFromOrder(orderId: string, items: POSOrderItem[], recipes: Recipe[], inventoryItems: InventoryItem[]) {
  const timestamp = new Date().toISOString();
  
  for (const orderItem of items) {
    if (orderItem.isVoided) continue;
    
    const recipe = recipes.find(r => r.id === orderItem.recipeId);
    if (!recipe) continue;
    
    // Deduct each ingredient
    for (const ingredient of (recipe.ingredients || [])) {
      const isRecipeIngredient = ingredient.inventoryItemId.startsWith('recipe-');
      const actualId = isRecipeIngredient 
        ? ingredient.inventoryItemId.replace('recipe-', '') 
        : ingredient.inventoryItemId;
        
      const collectionName = isRecipeIngredient ? 'recipes' : 'inventory';
      const qtyToDeduct = ingredient.baseQuantity * orderItem.quantity;
      
      const docRef = doc(db, collectionName, actualId);
      
      try {
        await updateDoc(docRef, {
          quantity: increment(-qtyToDeduct),
          lastUpdated: timestamp
        });
        
        // Log movement
        const movId = `sale-${orderId}-${actualId}-${Date.now()}`;
        await setDoc(doc(db, 'stockMovements', movId), {
          id: movId,
          productId: ingredient.inventoryItemId,
          type: 'SALE',
          quantityChange: -qtyToDeduct,
          referenceId: orderId,
          referenceType: 'SALE',
          locationId: LOCATION_ID,
          createdAt: timestamp
        });
      } catch (err) {
        console.error(`Failed to deduct stock for ${ingredient.inventoryItemId}:`, err);
      }
    }

    // Deduct each modifier
    for (const modifier of (orderItem.modifiers || [])) {
      if (!modifier.inventoryItemId || !modifier.quantity) continue;

      const qtyToDeduct = modifier.quantity * orderItem.quantity;
      const docRef = doc(db, 'inventory', modifier.inventoryItemId);

      try {
        await updateDoc(docRef, {
          quantity: increment(-qtyToDeduct),
          lastUpdated: timestamp
        });

        // Log movement
        const movId = `sale-mod-${orderId}-${modifier.inventoryItemId}-${Date.now()}`;
        await setDoc(doc(db, 'stockMovements', movId), {
          id: movId,
          productId: modifier.inventoryItemId,
          type: 'SALE',
          quantityChange: -qtyToDeduct,
          referenceId: orderId,
          referenceType: 'SALE',
          locationId: LOCATION_ID,
          createdAt: timestamp
        });
      } catch (err) {
        console.error(`Failed to deduct stock for modifier ${modifier.name}:`, err);
      }
    }
  }
}

/**
 * Recalculates costs for all recipes when an inventory item price changes.
 */
export async function syncRecipePrices(updatedInventoryItemId: string, newPrice: number, recipes: Recipe[], inventoryItems: InventoryItem[]) {
  const needsUpdate = recipes.filter(r => 
    r.ingredients?.some(ing => ing.inventoryItemId === updatedInventoryItemId)
  );
  
  if (needsUpdate.length === 0) return;
  
  const timestamp = new Date().toISOString();
  
  for (const recipe of needsUpdate) {
    // Recalculate cost
    let totalCost = 0;
    const updatedIngredients = recipe.ingredients.map(ing => {
      const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
      const price = ing.inventoryItemId === updatedInventoryItemId ? newPrice : (item?.pricePerUnit || 0);
      totalCost += price * (ing.baseQuantity || 0);
      return ing;
    });
    
    const yieldAmount = recipe.yieldAmount || 1;
    const pricePerUnit = totalCost / yieldAmount;
    
    try {
      await updateDoc(doc(db, 'recipes', recipe.id), {
        pricePerUnit,
        lastCostUpdate: timestamp,
        lastUpdated: timestamp
      });
    } catch (err) {
      console.error(`Failed to sync cost for recipe ${recipe.id}:`, err);
    }
  }
}
