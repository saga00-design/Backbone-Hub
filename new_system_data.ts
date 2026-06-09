
import { InventoryItem, Recipe, Supplier } from './types';

export const NEW_SUPPLIERS: Supplier[] = [
  { id: 'sup-produce', name: 'Fresh Valley Produce', contactName: 'Carlos', email: 'carlos@freshvalley.com' },
  { id: 'sup-meat', name: 'Prime Cuts Butchery', contactName: 'Sarah', phone: '555-MEAT' },
  { id: 'sup-bar', name: 'Global Spirits & Wine', contactName: 'James', email: 'orders@globalspirits.com' },
  { id: 'sup-dry', name: 'Authentic Mexican Imports', contactName: 'Elena', phone: '555-MEXI' }
];

export const NEW_INVENTORY: InventoryItem[] = [
  // Produce
  { id: 'inv-avocado', name: 'Hass Avocado', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.005, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-lime', name: 'Lime', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 5000, unit: 'L', unitSize: 1000, minStockLevel: 2000, pricePerUnit: 0.003, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-onion-red', name: 'Red Onion', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 20000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.001, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-tomato-plum', name: 'Plum Tomato', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 15000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.002, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-coriander', name: 'Coriander', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 2000, unit: 'kg', unitSize: 1000, minStockLevel: 500, pricePerUnit: 0.01, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-jalapeno', name: 'Jalapeño', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 3000, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.004, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-garlic', name: 'Garlic', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.006, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-pineapple', name: 'Fresh Pineapple', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.002, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  { id: 'inv-mango', name: 'Fresh Mango', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 3000, unit: 'kg', unitSize: 1000, minStockLevel: 500, pricePerUnit: 0.004, lastUpdated: new Date().toISOString(), supplier: 'Fresh Valley Produce', isActive: true },
  
  // Italian Specialties
  { id: 'inv-flour-00', name: 'Tipo 00 Flour', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 50000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.0012, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-yeast', name: 'Dry Yeast', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 1000, unit: 'kg', unitSize: 1000, minStockLevel: 200, pricePerUnit: 0.015, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-olive-oil-ev', name: 'EV Olive Oil', category: 'Ingredient', subCategory: 'Oils', department: 'Food', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 20000, unit: 'L', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.018, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-tomato-canned', name: 'San Marzano Tomatoes', category: 'Ingredient', subCategory: 'Canned', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 48000, unit: 'kg', unitSize: 1000, minStockLevel: 12000, pricePerUnit: 0.0025, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-mozzarella', name: 'Mozzarella di Bufala', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 3000, pricePerUnit: 0.012, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },
  { id: 'inv-beef-ground', name: 'Ground Beef 80/20', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 25000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.0085, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },
  { id: 'inv-spaghetti', name: 'Bronze Die Spaghetti', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 20000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.0022, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },

  // Proteins
  { id: 'inv-beef-short-rib', name: 'Beef Short Rib', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 50000, unit: 'kg', unitSize: 1000, minStockLevel: 15000, pricePerUnit: 0.015, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },
  { id: 'inv-chicken-thigh', name: 'Chicken Thigh', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 40000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.008, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },
  { id: 'inv-pork-shoulder', name: 'Pork Shoulder', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 30000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.007, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },
  { id: 'inv-shrimp', name: 'Shrimp (16/20)', category: 'Ingredient', subCategory: 'Seafood', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 3000, pricePerUnit: 0.018, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },
  { id: 'inv-white-fish', name: 'White Fish (Ceviche)', category: 'Ingredient', subCategory: 'Seafood', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.022, lastUpdated: new Date().toISOString(), supplier: 'Prime Cuts Butchery', isActive: true },

  // Bar
  { id: 'inv-tequila-blanco', name: 'Tequila Blanco', category: 'Ingredient', subCategory: 'Spirits', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 10500, unit: 'bottles', unitSize: 700, minStockLevel: 3500, pricePerUnit: 0.04, lastUpdated: new Date().toISOString(), supplier: 'Global Spirits & Wine', isActive: true },
  { id: 'inv-triple-sec', name: 'Triple Sec', category: 'Ingredient', subCategory: 'Liqueurs', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 3500, unit: 'bottles', unitSize: 700, minStockLevel: 700, pricePerUnit: 0.02, lastUpdated: new Date().toISOString(), supplier: 'Global Spirits & Wine', isActive: true },
  { id: 'inv-agave-nectar', name: 'Agave Nectar', category: 'Ingredient', subCategory: 'Syrups', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 5000, unit: 'L', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.01, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },

  // Dry Goods
  { id: 'inv-tortilla-corn', name: 'Corn Tortilla (15cm)', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 1000, unit: 'pcs', unitSize: 1, minStockLevel: 200, pricePerUnit: 0.10, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-sugar-white', name: 'White Sugar', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 2000, pricePerUnit: 0.001, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-salt-sea', name: 'Sea Salt', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.0008, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-black-beans', name: 'Black Beans', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 20000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.0015, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-rice-long', name: 'Long Grain Rice', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 30000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.001, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-cinnamon', name: 'Ground Cinnamon', category: 'Ingredient', subCategory: 'Spices', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 1000, unit: 'kg', unitSize: 1000, minStockLevel: 200, pricePerUnit: 0.008, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
  { id: 'inv-chocolate', name: 'Mexican Chocolate', category: 'Ingredient', subCategory: 'Baking', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.012, lastUpdated: new Date().toISOString(), supplier: 'Authentic Mexican Imports', isActive: true },
];

export const NEW_RECIPES: Recipe[] = [
  // LAYER 2: BATCHES / PREP
  {
    id: 'batch-pizza-dough', name: 'Pizza Dough Batch', description: 'Slow-fermented dough', type: 'recipe', category: 'Prep',
    yieldAmount: 10000, yieldUnit: 'g', lastUpdated: new Date().toISOString(), sellingPrice: 0,
    imageUrl: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-flour-00', quantity: 6000, unit: 'g', baseQuantity: 6000 },
      { inventoryItemId: 'inv-yeast', quantity: 20, unit: 'g', baseQuantity: 20 },
      { inventoryItemId: 'inv-olive-oil-ev', quantity: 200, unit: 'ml', baseQuantity: 200 },
      { inventoryItemId: 'inv-salt-sea', quantity: 120, unit: 'g', baseQuantity: 120 }
    ]
  },
  {
    id: 'batch-tomato-sauce', name: 'Pizza Tomato Sauce', description: 'San Marzano base sauce', type: 'recipe', category: 'Prep',
    yieldAmount: 5000, yieldUnit: 'ml', lastUpdated: new Date().toISOString(), sellingPrice: 0,
    imageUrl: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-tomato-canned', quantity: 5000, unit: 'g', baseQuantity: 5000 },
      { inventoryItemId: 'inv-olive-oil-ev', quantity: 100, unit: 'ml', baseQuantity: 100 },
      { inventoryItemId: 'inv-garlic', quantity: 30, unit: 'g', baseQuantity: 30 },
      { inventoryItemId: 'inv-salt-sea', quantity: 25, unit: 'g', baseQuantity: 25 }
    ]
  },
  {
    id: 'batch-bolognese', name: 'Bolognese Sauce Batch', description: 'Slow-cooked meat sauce', type: 'recipe', category: 'Prep',
    yieldAmount: 8000, yieldUnit: 'ml', lastUpdated: new Date().toISOString(), sellingPrice: 0,
    imageUrl: 'https://images.unsplash.com/photo-1622973536968-3ead9e780960?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-beef-ground', quantity: 4000, unit: 'g', baseQuantity: 4000 },
      { inventoryItemId: 'inv-tomato-canned', quantity: 3000, unit: 'g', baseQuantity: 3000 },
      { inventoryItemId: 'inv-onion-red', quantity: 500, unit: 'g', baseQuantity: 500 },
      { inventoryItemId: 'inv-olive-oil-ev', quantity: 200, unit: 'ml', baseQuantity: 200 }
    ]
  },
  {
    id: 'batch-guacamole', name: 'Guacamole Batch', description: 'Fresh house-made guacamole', type: 'recipe', category: 'Prep',
    yieldAmount: 1000, yieldUnit: 'g', lastUpdated: new Date().toISOString(), sellingPrice: 0,
    imageUrl: 'https://images.unsplash.com/photo-1547050605-2f2683030282?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-avocado', quantity: 800, unit: 'g', baseQuantity: 800 },
      { inventoryItemId: 'inv-lime', quantity: 50, unit: 'ml', baseQuantity: 50 },
      { inventoryItemId: 'inv-onion-red', quantity: 50, unit: 'g', baseQuantity: 50 },
      { inventoryItemId: 'inv-coriander', quantity: 20, unit: 'g', baseQuantity: 20 }
    ]
  },
  {
    id: 'batch-margarita-mix', name: 'House Margarita Mix', description: 'Balanced lime and agave mix', type: 'recipe', category: 'Prep',
    yieldAmount: 1000, yieldUnit: 'ml', lastUpdated: new Date().toISOString(), sellingPrice: 0,
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-lime', quantity: 500, unit: 'ml', baseQuantity: 500 },
      { inventoryItemId: 'inv-agave-nectar', quantity: 300, unit: 'ml', baseQuantity: 300 }
    ]
  },
  {
    id: 'batch-refried-beans', name: 'Refried Beans Batch', description: 'Slow-cooked and mashed black beans', type: 'recipe', category: 'Prep',
    yieldAmount: 2000, yieldUnit: 'g', lastUpdated: new Date().toISOString(), sellingPrice: 0,
    imageUrl: 'https://images.unsplash.com/photo-1599307734170-659349870022?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-black-beans', quantity: 1500, unit: 'g', baseQuantity: 1500 },
      { inventoryItemId: 'inv-garlic', quantity: 50, unit: 'g', baseQuantity: 50 },
      { inventoryItemId: 'inv-onion-red', quantity: 200, unit: 'g', baseQuantity: 200 }
    ]
  },

  // LAYER 3: FINAL MENU ITEMS
  {
    id: 'menu-margherita', name: 'Margherita Pizza', description: 'Classic Neapolitan pizza with fresh basil and mozzarella', type: 'menu_item', category: 'Food', subCategory: 'Mains',
    sellingPrice: 14.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Pizza', course: 'Mains',
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbad80ad38?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'recipe-batch-pizza-dough', quantity: 250, unit: 'g', baseQuantity: 250 },
      { inventoryItemId: 'recipe-batch-tomato-sauce', quantity: 80, unit: 'ml', baseQuantity: 80 },
      { inventoryItemId: 'inv-mozzarella', quantity: 100, unit: 'g', baseQuantity: 100 }
    ]
  },
  {
    id: 'menu-spaghetti-bolognese', name: 'Spaghetti Bolognese', description: 'Rich meat sauce with bronze-die pasta', type: 'menu_item', category: 'Food', subCategory: 'Mains',
    sellingPrice: 16.00, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Pasta', course: 'Mains',
    imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-spaghetti', quantity: 150, unit: 'g', baseQuantity: 150 },
      { inventoryItemId: 'recipe-batch-bolognese', quantity: 250, unit: 'ml', baseQuantity: 250 }
    ]
  },
  {
    id: 'menu-taco-short-rib', name: 'Short Rib Taco', description: 'Slow-cooked beef short rib with pickled onions', type: 'menu_item', category: 'Food', subCategory: 'Tacos',
    sellingPrice: 4.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-beef-short-rib', quantity: 60, unit: 'g', baseQuantity: 60 },
      { inventoryItemId: 'inv-tortilla-corn', quantity: 1, unit: 'pcs', baseQuantity: 1 }
    ]
  },
  {
    id: 'menu-taco-chicken-tinga', name: 'Chicken Tinga Taco', description: 'Shredded chicken in a smoky chipotle sauce', type: 'menu_item', category: 'Food', subCategory: 'Tacos',
    sellingPrice: 4.00, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-chicken-thigh', quantity: 60, unit: 'g', baseQuantity: 60 },
      { inventoryItemId: 'inv-tortilla-corn', quantity: 1, unit: 'pcs', baseQuantity: 1 }
    ]
  },
  {
    id: 'menu-taco-al-pastor', name: 'Al Pastor Taco', description: 'Marinated pork with pineapple and cilantro', type: 'menu_item', category: 'Food', subCategory: 'Tacos',
    sellingPrice: 4.25, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-pork-shoulder', quantity: 60, unit: 'g', baseQuantity: 60 },
      { inventoryItemId: 'inv-pineapple', quantity: 15, unit: 'g', baseQuantity: 15 },
      { inventoryItemId: 'inv-tortilla-corn', quantity: 1, unit: 'pcs', baseQuantity: 1 }
    ]
  },
  {
    id: 'menu-taco-shrimp', name: 'Shrimp Taco', description: 'Grilled shrimp with mango salsa and cabbage', type: 'menu_item', category: 'Food', subCategory: 'Tacos',
    sellingPrice: 5.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1512838243191-e81e8f66f1fd?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-shrimp', quantity: 50, unit: 'g', baseQuantity: 50 },
      { inventoryItemId: 'inv-mango', quantity: 20, unit: 'g', baseQuantity: 20 },
      { inventoryItemId: 'inv-tortilla-corn', quantity: 1, unit: 'pcs', baseQuantity: 1 }
    ]
  },
  {
    id: 'menu-enchiladas-verdes', name: 'Enchiladas Verdes', description: 'Chicken enchiladas with tangy green sauce', type: 'menu_item', category: 'Food', subCategory: 'Mains',
    sellingPrice: 15.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Mains',
    imageUrl: 'https://images.unsplash.com/photo-1534353875273-b5887cc1abf5?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-chicken-thigh', quantity: 150, unit: 'g', baseQuantity: 150 },
      { inventoryItemId: 'inv-tortilla-corn', quantity: 3, unit: 'pcs', baseQuantity: 3 }
    ]
  },
  {
    id: 'menu-beef-fajitas', name: 'Sizzling Beef Fajitas', description: 'Marinated beef with peppers and onions', type: 'menu_item', category: 'Food', subCategory: 'Mains',
    sellingPrice: 19.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Mains',
    imageUrl: 'https://images.unsplash.com/photo-1534353875273-b5887cc1abf5?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-beef-short-rib', quantity: 200, unit: 'g', baseQuantity: 200 },
      { inventoryItemId: 'inv-onion-red', quantity: 50, unit: 'g', baseQuantity: 50 }
    ]
  },
  {
    id: 'menu-mexican-rice', name: 'Mexican Rice', description: 'Savory tomato-infused long grain rice', type: 'menu_item', category: 'Food', subCategory: 'Sides',
    sellingPrice: 4.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-rice-long', quantity: 150, unit: 'g', baseQuantity: 150 }
    ]
  },
  {
    id: 'menu-refried-beans-side', name: 'Refried Beans Side', description: 'Creamy slow-cooked black beans', type: 'menu_item', category: 'Food', subCategory: 'Sides',
    sellingPrice: 4.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1599307734170-659349870022?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'recipe-batch-refried-beans', quantity: 150, unit: 'g', baseQuantity: 150 }
    ]
  },
  {
    id: 'menu-churros', name: 'Churros con Chocolate', description: 'Fried dough with cinnamon sugar and chocolate dip', type: 'menu_item', category: 'Food', subCategory: 'Desserts',
    sellingPrice: 7.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Dessert', course: 'Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1571115177098-24ec42ed2bb4?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-sugar-white', quantity: 30, unit: 'g', baseQuantity: 30 },
      { inventoryItemId: 'inv-cinnamon', quantity: 5, unit: 'g', baseQuantity: 5 },
      { inventoryItemId: 'inv-chocolate', quantity: 40, unit: 'g', baseQuantity: 40 }
    ]
  },
  {
    id: 'menu-ceviche', name: 'Fresh Fish Ceviche', description: 'White fish cured in lime with red onion and cilantro', type: 'menu_item', category: 'Food', subCategory: 'Starters',
    sellingPrice: 12.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Cold', course: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db06?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-white-fish', quantity: 120, unit: 'g', baseQuantity: 120 },
      { inventoryItemId: 'inv-lime', quantity: 40, unit: 'ml', baseQuantity: 40 },
      { inventoryItemId: 'inv-onion-red', quantity: 20, unit: 'g', baseQuantity: 20 },
      { inventoryItemId: 'inv-coriander', quantity: 5, unit: 'g', baseQuantity: 5 }
    ]
  },
  {
    id: 'menu-quesadilla', name: 'Cheese Quesadilla', description: 'Griddled tortilla with melted mozzarella', type: 'menu_item', category: 'Food', subCategory: 'Starters',
    sellingPrice: 8.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Grill', course: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-mozzarella', quantity: 120, unit: 'g', baseQuantity: 120 },
      { inventoryItemId: 'inv-tortilla-corn', quantity: 2, unit: 'pcs', baseQuantity: 2 }
    ]
  },
  {
    id: 'menu-chicken-alfredo', name: 'Chicken Alfredo', description: 'Creamy pasta with grilled chicken and parmesan', type: 'menu_item', category: 'Food', subCategory: 'Mains',
    sellingPrice: 16.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Pasta', course: 'Mains',
    imageUrl: 'https://images.unsplash.com/photo-1645112481338-351070703278?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-spaghetti', quantity: 150, unit: 'g', baseQuantity: 150 },
      { inventoryItemId: 'inv-chicken-thigh', quantity: 120, unit: 'g', baseQuantity: 120 },
      { inventoryItemId: 'inv-mozzarella', quantity: 50, unit: 'g', baseQuantity: 50 }
    ]
  },
  {
    id: 'menu-old-fashioned', name: 'Old Fashioned', description: 'Classic bourbon cocktail with bitters and orange', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails',
    sellingPrice: 12.00, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Beverage', course: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1594448054130-460663943ad8?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-tequila-blanco', quantity: 50, unit: 'ml', baseQuantity: 50 }, // Using tequila as placeholder for bourbon if not in inv
      { inventoryItemId: 'inv-sugar-white', quantity: 5, unit: 'g', baseQuantity: 5 }
    ]
  },
  {
    id: 'menu-mojito', name: 'Classic Mojito', description: 'Refreshing mint and lime cocktail', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails',
    sellingPrice: 11.00, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Beverage', course: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-lime', quantity: 30, unit: 'ml', baseQuantity: 30 },
      { inventoryItemId: 'inv-sugar-white', quantity: 10, unit: 'g', baseQuantity: 10 },
      { inventoryItemId: 'inv-coriander', quantity: 5, unit: 'g', baseQuantity: 5 } // Using coriander as mint placeholder
    ]
  },
  {
    id: 'menu-margarita-house', name: 'House Margarita', description: 'Classic lime margarita', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails',
    sellingPrice: 10.50, vatRate: 20, lastUpdated: new Date().toISOString(), station: 'Beverage', course: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1556855810-ac404aa91e85?auto=format&fit=crop&q=80&w=800',
    ingredients: [
      { inventoryItemId: 'inv-tequila-blanco', quantity: 50, unit: 'ml', baseQuantity: 50 },
      { inventoryItemId: 'inv-triple-sec', quantity: 25, unit: 'ml', baseQuantity: 25 },
      { inventoryItemId: 'recipe-batch-margarita-mix', quantity: 50, unit: 'ml', baseQuantity: 50 }
    ]
  }
];
