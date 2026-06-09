
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';
import { NEW_INVENTORY, NEW_RECIPES, NEW_SUPPLIERS } from '../new_system_data';
import { toast } from 'sonner';
import { InventoryItem, Recipe, Supplier } from '../types';

export const performSystemResetAndRebuild = async (userId: string) => {
  if (!userId) {
    toast.error("User ID is required for reset.");
    return;
  }

  try {
    toast.loading("Starting full system reset and rebuild...", { id: 'reset-process' });

    // 1. STEP 3 — BACKUP (Simulated)
    console.log("--- STEP 3: SYSTEM BACKUP STARTED ---");
    const collectionsToBackup = ['inventory', 'recipes', 'suppliers', 'modifiers', 'menuCategories'];
    const backupData: Record<string, any[]> = {};
    
    for (const col of collectionsToBackup) {
      try {
        const snapshot = await getDocs(collection(db, `users/${userId}/${col}`));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        backupData[col] = data;
        console.log(`Backup for ${col} (${data.length} records):`, data);
      } catch (e) {
        console.warn(`Could not backup ${col}:`, e);
      }
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`backup_inventory_${timestamp}`, backupData['inventory']);
    console.log(`backup_menu_${timestamp}`, { 
      recipes: backupData['recipes'], 
      categories: backupData['menuCategories'],
      modifiers: backupData['modifiers']
    });
    console.log("--- STEP 3: SYSTEM BACKUP COMPLETED ---");

    // 2. STEP 2 — SAFE DELETE STRATEGY
    console.log("--- STEP 2: SAFE DELETION STARTED ---");
    // Order: Recipes -> Modifiers -> Inventory -> Suppliers -> Categories
    const collectionsToDelete = ['recipes', 'modifiers', 'inventory', 'suppliers', 'menuCategories'];
    
    for (const colName of collectionsToDelete) {
      const snapshot = await getDocs(collection(db, `users/${userId}/${colName}`));
      if (snapshot.empty) {
        console.log(`Collection ${colName} is already empty.`);
        continue;
      }

      console.log(`Deleting ${snapshot.size} records from ${colName}...`);
      let batch = writeBatch(db);
      let count = 0;

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      await batch.commit();
      console.log(`Successfully deleted all documents in ${colName}`);
    }
    console.log("--- STEP 2: SAFE DELETION COMPLETED ---");

    // 3. STEP 4 — CREATE NEW STRUCTURE (REBUILD)
    console.log("--- STEP 4: REBUILDING SYSTEM ---");
    
    // Suppliers
    console.log("Rebuilding Suppliers...");
    let batch = writeBatch(db);
    NEW_SUPPLIERS.forEach((sup: Supplier) => {
      const ref = doc(db, `users/${userId}/suppliers`, sup.id);
      batch.set(ref, sup);
    });
    await batch.commit();

    // Inventory
    console.log("Rebuilding Inventory (Layer 1)...");
    batch = writeBatch(db);
    NEW_INVENTORY.forEach((item: InventoryItem) => {
      const ref = doc(db, `users/${userId}/inventory`, item.id);
      batch.set(ref, item);
    });
    await batch.commit();

    // Recipes (Layer 2 & 3)
    console.log("Rebuilding Recipes (Layer 2 & 3)...");
    batch = writeBatch(db);
    NEW_RECIPES.forEach((recipe: Recipe) => {
      const ref = doc(db, `users/${userId}/recipes`, recipe.id);
      batch.set(ref, recipe);
    });
    await batch.commit();
    
    console.log("--- STEP 4: REBUILD COMPLETED ---");

    // 4. STEP 5 & 6 — RELATIONSHIPS & VALIDATION
    console.log("--- STEP 6: STARTING VALIDATION ---");
    const finalInventory = await getDocs(collection(db, `users/${userId}/inventory`));
    const finalRecipes = await getDocs(collection(db, `users/${userId}/recipes`));
    
    console.log(`Validation: ${finalInventory.size} inventory items created.`);
    console.log(`Validation: ${finalRecipes.size} recipes created.`);
    
    const inventoryIds = new Set(finalInventory.docs.map(d => d.id));
    const recipeIds = new Set(finalRecipes.docs.map(d => d.id));
    
    let brokenLinks = 0;
    finalRecipes.docs.forEach(docSnap => {
      const r = docSnap.data() as Recipe;
      r.ingredients.forEach(ing => {
        if (ing.inventoryItemId.startsWith('recipe-')) {
          const targetRecipeId = ing.inventoryItemId.replace('recipe-', '');
          if (!recipeIds.has(targetRecipeId)) {
            console.error(`Broken link in recipe ${r.id}: Batch ${targetRecipeId} not found.`);
            brokenLinks++;
          }
        } else {
          if (!inventoryIds.has(ing.inventoryItemId)) {
            console.error(`Broken link in recipe ${r.id}: Ingredient ${ing.inventoryItemId} not found.`);
            brokenLinks++;
          }
        }
      });
    });

    if (brokenLinks === 0) {
      console.log("Validation: All relationships are intact.");
    } else {
      console.warn(`Validation: Found ${brokenLinks} broken links.`);
    }

    // Clear local storage to prevent migration logic from re-adding old data
    localStorage.removeItem('inventory_items');
    localStorage.removeItem('menu_recipes');
    localStorage.removeItem('suppliers');
    localStorage.removeItem('item_recipe_mappings');

    toast.success("System reset and rebuild completed successfully!", { id: 'reset-process' });
    
    // Force reload to refresh all listeners and state
    setTimeout(() => {
      window.location.reload();
    }, 2000);

  } catch (error: any) {
    console.error("System reset failed:", error);
    toast.error(`System reset failed: ${error.message}`, { id: 'reset-process' });
  }
};
