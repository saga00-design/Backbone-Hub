/**
 * MESTIZO BACKBONE - COMPREHENSIVE SEED DATA
 * Run this script once to populate your Firestore database with realistic
 * test data covering inventory, recipes (food + beverage), modifiers,
 * modifier groups, and menu categories.
 *
 * HOW TO USE:
 * 1. Save this file as seed.mjs in your Backbone-Hub root
 * 2. Run: node seed.mjs
 * 3. Check HUB - all data should appear immediately
 *
 * SAFE TO RE-RUN: Uses setDoc with named IDs so it will not duplicate.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, initializeFirestore } from 'firebase/firestore';

// -- Firebase config - copied from your firebase.ts ---------------------------
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "REDACTED_FIREBASE_KEY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "backbone-hub.firebaseapp.com",
  projectId: "backbone-hub",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "backbone-hub.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "253712567445",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:253712567445:web:390e304a837a7aaaf95f9c",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, 'ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403');

const LOCATION_ID = 'loc_camden';
const NOW = new Date().toISOString();

// -- Helpers -------------------------------------------------------------------
const save = async (collectionName, id, data) => {
  await setDoc(doc(db, collectionName, id), { ...data, locationId: LOCATION_ID, lastUpdated: NOW });
  console.log(`- ${collectionName}/${id}`);
};

// -----------------------------------------------------------------------------
// 1. INVENTORY ITEMS
// Base units: liquids -> ml, solids -> g, units -> pcs
// pricePerUnit = cost per BASE unit (pence)
// -----------------------------------------------------------------------------
const inventory = [
  // -- Proteins --------------------------------------------------------------
  { id: 'inv_beef_asada',       name: 'Beef Skirt (Asada)',       category: 'Protein',    subCategory: 'Beef',    inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 8000,  unitSize: 1000, unit: 'kg',  packaging: 'vacuum pack', minStockLevel: 2000, pricePerUnit: 0.00285, supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_pork_pastor',      name: 'Pork Shoulder (Pastor)',   category: 'Protein',    subCategory: 'Pork',    inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 6000,  unitSize: 1000, unit: 'kg',  packaging: 'vacuum pack', minStockLevel: 1500, pricePerUnit: 0.0018,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_chicken_tinga',    name: 'Chicken Thigh (Tinga)',    category: 'Protein',    subCategory: 'Chicken', inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 5000,  unitSize: 1000, unit: 'kg',  packaging: 'tray',        minStockLevel: 1500, pricePerUnit: 0.0014,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_beef_suadero',     name: 'Beef Brisket (Suadero)',   category: 'Protein',    subCategory: 'Beef',    inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 4000,  unitSize: 1000, unit: 'kg',  packaging: 'vacuum pack', minStockLevel: 1000, pricePerUnit: 0.0032,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_pork_pierna',      name: 'Pork Leg (Pierna)',        category: 'Protein',    subCategory: 'Pork',    inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 5000,  unitSize: 1000, unit: 'kg',  packaging: 'vacuum pack', minStockLevel: 1000, pricePerUnit: 0.0016,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_beef_mole',        name: 'Beef Chuck (Mole)',        category: 'Protein',    subCategory: 'Beef',    inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 4000,  unitSize: 1000, unit: 'kg',  packaging: 'vacuum pack', minStockLevel: 1000, pricePerUnit: 0.0022,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_chicken_ench',     name: 'Chicken Breast (Enchi)',   category: 'Protein',    subCategory: 'Chicken', inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 4000,  unitSize: 1000, unit: 'kg',  packaging: 'tray',        minStockLevel: 1000, pricePerUnit: 0.0016,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_beef_filete',      name: 'Beef Fillet (Arriero)',    category: 'Protein',    subCategory: 'Beef',    inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 3000,  unitSize: 1000, unit: 'kg',  packaging: 'vacuum pack', minStockLevel: 800,  pricePerUnit: 0.0055,  supplier: 'Premium Meats UK', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_prawn',            name: 'King Prawns',              category: 'Protein',    subCategory: 'Seafood', inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 3000,  unitSize: 1000, unit: 'kg',  packaging: 'frozen bag',  minStockLevel: 500,  pricePerUnit: 0.0038,  supplier: 'Fish Direct', allergies: ['Crustaceans'], vatCode: 'ZERO_0', isActive: true },

  // -- Fresh Produce ---------------------------------------------------------
  { id: 'inv_tortilla_corn',    name: 'Corn Tortillas (small)',   category: 'Bakery',     subCategory: 'Tortillas', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 500,   unitSize: 50,   unit: 'pcs', packaging: 'pack',        minStockLevel: 100,  pricePerUnit: 0.04,     supplier: 'La Tortilleria', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_tortilla_flour',   name: 'Flour Tortillas (large)',  category: 'Bakery',     subCategory: 'Tortillas', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 200,   unitSize: 20,   unit: 'pcs', packaging: 'pack',        minStockLevel: 50,   pricePerUnit: 0.08,     supplier: 'La Tortilleria', allergies: ['Gluten'], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_avocado',          name: 'Avocado (Hass)',           category: 'Produce',    subCategory: 'Fruit',   inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 60,    unitSize: 1,    unit: 'pcs', packaging: 'loose',       minStockLevel: 20,   pricePerUnit: 0.8,    supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_tomato',           name: 'Tomatoes (plum)',          category: 'Produce',    subCategory: 'Vegetables', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unitSize: 1000, unit: 'kg',  packaging: 'tray',        minStockLevel: 1000, pricePerUnit: 0.00035, supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_onion_white',      name: 'White Onion',              category: 'Produce',    subCategory: 'Vegetables', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unitSize: 1000, unit: 'kg',  packaging: 'bag',         minStockLevel: 1000, pricePerUnit: 0.0002,  supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_onion_red',        name: 'Red Onion',                category: 'Produce',    subCategory: 'Vegetables', inventoryType: 'SOLID', baseUnit: 'g', quantity: 3000, unitSize: 1000, unit: 'kg',  packaging: 'bag',         minStockLevel: 500,  pricePerUnit: 0.00025, supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_coriander',        name: 'Fresh Coriander',          category: 'Produce',    subCategory: 'Herbs',   inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 1000,  unitSize: 100,  unit: 'g',   packaging: 'bunch',       minStockLevel: 200,  pricePerUnit: 0.0015,  supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_lime',             name: 'Lime',                     category: 'Produce',    subCategory: 'Fruit',   inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 100,   unitSize: 1,    unit: 'pcs', packaging: 'loose',       minStockLevel: 30,   pricePerUnit: 0.25,    supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_jalapeno',         name: 'Jalapeno (fresh)',         category: 'Produce',    subCategory: 'Chillies', inventoryType: 'SOLID', baseUnit: 'g',  quantity: 2000,  unitSize: 1000, unit: 'kg',  packaging: 'bag',         minStockLevel: 300,  pricePerUnit: 0.0008,  supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_chipotle_dried',   name: 'Chipotle Chilli (dried)',  category: 'Dry Goods',  subCategory: 'Chillies', inventoryType: 'SOLID', baseUnit: 'g',  quantity: 2000,  unitSize: 500,  unit: 'g',   packaging: 'bag',         minStockLevel: 200,  pricePerUnit: 0.0012,  supplier: 'Mexgrocer', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_ancho_dried',      name: 'Ancho Chilli (dried)',     category: 'Dry Goods',  subCategory: 'Chillies', inventoryType: 'SOLID', baseUnit: 'g',  quantity: 2000,  unitSize: 500,  unit: 'g',   packaging: 'bag',         minStockLevel: 200,  pricePerUnit: 0.001,  supplier: 'Mexgrocer', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_mole_paste',       name: 'Mole Paste (Dona Maria)',  category: 'Dry Goods',  subCategory: 'Sauces',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 5000,  unitSize: 1000, unit: 'g',   packaging: 'jar',         minStockLevel: 1000, pricePerUnit: 0.00095, supplier: 'Mexgrocer', allergies: ['Sesame', 'Peanuts', 'Tree nuts'], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_cheese_oaxaca',    name: 'Oaxaca Cheese',            category: 'Dairy',      subCategory: 'Cheese',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 4000,  unitSize: 1000, unit: 'kg',  packaging: 'pack',        minStockLevel: 500,  pricePerUnit: 0.0022,  supplier: 'Mexgrocer', allergies: ['Milk'], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_cheese_cotija',    name: 'Cotija Cheese',            category: 'Dairy',      subCategory: 'Cheese',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 2000,  unitSize: 500,  unit: 'g',   packaging: 'pack',        minStockLevel: 300,  pricePerUnit: 0.0028,  supplier: 'Mexgrocer', allergies: ['Milk'], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_sour_cream',       name: 'Sour Cream / Crema',       category: 'Dairy',      subCategory: 'Cream',   inventoryType: 'SOLID', baseUnit: 'g',  quantity: 3000,  unitSize: 500,  unit: 'g',   packaging: 'tub',         minStockLevel: 500,  pricePerUnit: 0.0008,  supplier: 'Brakes', allergies: ['Milk'], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_black_beans',      name: 'Black Beans (dried)',       category: 'Dry Goods',  subCategory: 'Pulses',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 10000, unitSize: 1000, unit: 'kg',  packaging: 'bag',         minStockLevel: 2000, pricePerUnit: 0.00012, supplier: 'Mexgrocer', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_rice',             name: 'Long Grain Rice',           category: 'Dry Goods',  subCategory: 'Grains',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 10000, unitSize: 1000, unit: 'kg',  packaging: 'bag',         minStockLevel: 2000, pricePerUnit: 0.00008, supplier: 'Brakes', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_guacamole_prep',   name: 'Guacamole (batch)',        category: 'Prep',       subCategory: 'Dips',    inventoryType: 'SOLID', baseUnit: 'g',  quantity: 2000,  unitSize: 100,  unit: 'g',   packaging: 'container',   minStockLevel: 400,  pricePerUnit: 0.0018,  supplier: 'Kitchen Prep', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_salsa_roja',       name: 'Salsa Roja (batch)',       category: 'Prep',       subCategory: 'Sauces',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 3000,  unitSize: 100,  unit: 'g',   packaging: 'container',   minStockLevel: 500,  pricePerUnit: 0.0006,  supplier: 'Kitchen Prep', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_salsa_verde',      name: 'Salsa Verde (batch)',      category: 'Prep',       subCategory: 'Sauces',  inventoryType: 'SOLID', baseUnit: 'g',  quantity: 3000,  unitSize: 100,  unit: 'g',   packaging: 'container',   minStockLevel: 500,  pricePerUnit: 0.0005,  supplier: 'Kitchen Prep', allergies: [], vatCode: 'ZERO_0', isActive: true },

  // -- Spirits & Liqueurs ----------------------------------------------------
  { id: 'inv_tequila_blanco',   name: 'Tequila Blanco (Olmeca)', category: 'Spirits',    subCategory: 'Tequila', inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 14000, unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 2100, pricePerUnit: 0.00032, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_tequila_reposado', name: 'Tequila Reposado (1800)', category: 'Spirits',    subCategory: 'Tequila', inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 7000,  unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 1400, pricePerUnit: 0.00055, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_tequila_anejo',    name: 'Tequila Anejo (Patron)',  category: 'Spirits',    subCategory: 'Tequila', inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 4200,  unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 700,  pricePerUnit: 0.00085, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_mezcal_espad',     name: 'Mezcal Espadin (Del Maguey)', category: 'Spirits', subCategory: 'Mezcal', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 4200,  unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 700,  pricePerUnit: 0.00095, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_triple_sec',       name: 'Triple Sec (Cointreau)',  category: 'Spirits',    subCategory: 'Liqueur', inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 4200,  unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 700,  pricePerUnit: 0.00042, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_rum_white',        name: 'White Rum (Bacardi)',     category: 'Spirits',    subCategory: 'Rum',     inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 4200,  unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 700,  pricePerUnit: 0.00028, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_vodka',            name: 'Vodka (Absolut)',         category: 'Spirits',    subCategory: 'Vodka',   inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 4200,  unitSize: 700,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 700,  pricePerUnit: 0.00025, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },

  // -- Mixers & Juice --------------------------------------------------------
  { id: 'inv_lime_juice',       name: 'Lime Juice (fresh-pressed)', category: 'Produce', subCategory: 'Juice',   inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 5000,  unitSize: 1000, unit: 'ml',  packaging: 'bottle',      minStockLevel: 500,  pricePerUnit: 0.00008, supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_grapefruit_juice', name: 'Pink Grapefruit Juice',   category: 'Produce',    subCategory: 'Juice',   inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 5000,  unitSize: 1000, unit: 'ml',  packaging: 'carton',      minStockLevel: 500,  pricePerUnit: 0.00005, supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_agave_syrup',      name: 'Agave Syrup',             category: 'Dry Goods',  subCategory: 'Syrup',   inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 3000,  unitSize: 500,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 500,  pricePerUnit: 0.00012, supplier: 'Mexgrocer', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_soda_water',       name: 'Soda Water (Fever-Tree)', category: 'Beverages',  subCategory: 'Mixers',  inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 12000, unitSize: 500,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 2000, pricePerUnit: 0.00003, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_ginger_beer',      name: 'Ginger Beer (Fever-Tree)', category: 'Beverages', subCategory: 'Mixers',  inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 6000,  unitSize: 500,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 1000, pricePerUnit: 0.00004, supplier: 'LWC Drinks', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_hibiscus_syrup',   name: 'Hibiscus Syrup (Jamaica)', category: 'Dry Goods', subCategory: 'Syrup',   inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 3000,  unitSize: 500,  unit: 'ml',  packaging: 'bottle',      minStockLevel: 300,  pricePerUnit: 0.00014, supplier: 'Mexgrocer', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_strawberry_puree', name: 'Strawberry Puree',        category: 'Produce',    subCategory: 'Puree',   inventoryType: 'LIQUID', baseUnit: 'ml',  quantity: 3000,  unitSize: 1000, unit: 'ml',  packaging: 'bottle',      minStockLevel: 300,  pricePerUnit: 0.00009, supplier: 'Brakes', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_mint',             name: 'Fresh Mint',              category: 'Produce',    subCategory: 'Herbs',   inventoryType: 'SOLID',  baseUnit: 'g',   quantity: 500,   unitSize: 25,   unit: 'g',   packaging: 'bunch',       minStockLevel: 100,  pricePerUnit: 0.003,  supplier: 'Fresh Direct', allergies: [], vatCode: 'ZERO_0', isActive: true },
  { id: 'inv_salt_rim',         name: 'Salt (rim/chilli)',       category: 'Dry Goods',  subCategory: 'Seasoning', inventoryType: 'SOLID', baseUnit: 'g',  quantity: 2000,  unitSize: 500,  unit: 'g',   packaging: 'pack',        minStockLevel: 200,  pricePerUnit: 0.00002, supplier: 'Brakes', allergies: [], vatCode: 'ZERO_0', isActive: true },

  // -- Beer & Wine -----------------------------------------------------------
  { id: 'inv_corona',           name: 'Corona Extra (330ml)',    category: 'Beer',       subCategory: 'Lager',   inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 140,   unitSize: 1,    unit: 'pcs', packaging: 'bottle',      minStockLevel: 24,   pricePerUnit: 0.85,    supplier: 'LWC Drinks', allergies: ['Gluten'], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_modelo',           name: 'Modelo Especial (355ml)', category: 'Beer',       subCategory: 'Lager',   inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 96,    unitSize: 1,    unit: 'pcs', packaging: 'bottle',      minStockLevel: 24,   pricePerUnit: 0.9,    supplier: 'LWC Drinks', allergies: ['Gluten'], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_dos_equis',        name: 'Dos Equis (330ml)',       category: 'Beer',       subCategory: 'Lager',   inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 72,    unitSize: 1,    unit: 'pcs', packaging: 'bottle',      minStockLevel: 24,   pricePerUnit: 0.88,    supplier: 'LWC Drinks', allergies: ['Gluten'], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_wine_red',         name: 'House Red Wine (750ml)',  category: 'Wine',       subCategory: 'Red',     inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 24,    unitSize: 1,    unit: 'pcs', packaging: 'bottle',      minStockLevel: 6,    pricePerUnit: 6.5,   supplier: 'LWC Drinks', allergies: ['Sulphites'], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_wine_white',       name: 'House White Wine (750ml)', category: 'Wine',      subCategory: 'White',   inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 24,    unitSize: 1,    unit: 'pcs', packaging: 'bottle',      minStockLevel: 6,    pricePerUnit: 6.0,   supplier: 'LWC Drinks', allergies: ['Sulphites'], vatCode: 'STANDARD_20', isActive: true },

  // -- Soft Drinks -----------------------------------------------------------
  { id: 'inv_coke',             name: 'Coca-Cola (330ml can)',   category: 'Soft Drink', subCategory: 'Cola',    inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 120,   unitSize: 1,    unit: 'pcs', packaging: 'can',         minStockLevel: 24,   pricePerUnit: 0.45,    supplier: 'Brakes', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_coke_zero',        name: 'Coke Zero (330ml can)',   category: 'Soft Drink', subCategory: 'Cola',    inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 72,    unitSize: 1,    unit: 'pcs', packaging: 'can',         minStockLevel: 24,   pricePerUnit: 0.45,    supplier: 'Brakes', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_mexican_cola',     name: 'Mexican Coca-Cola (355ml)', category: 'Soft Drink', subCategory: 'Cola',  inventoryType: 'UNIT',  baseUnit: 'pcs', quantity: 72,    unitSize: 1,    unit: 'pcs', packaging: 'glass bottle', minStockLevel: 12,  pricePerUnit: 0.95,    supplier: 'Mexgrocer', allergies: [], vatCode: 'STANDARD_20', isActive: true },
  { id: 'inv_agua_fresca_base', name: 'Agua Fresca Base (batch)', category: 'Prep',      subCategory: 'Drinks',  inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 5000,  unitSize: 1000, unit: 'ml',  packaging: 'container',   minStockLevel: 1000, pricePerUnit: 0.00003, supplier: 'Kitchen Prep', allergies: [], vatCode: 'ZERO_0', isActive: true },
];

// -----------------------------------------------------------------------------
// 2. MENU CATEGORIES
// -----------------------------------------------------------------------------
const categories = [
  { id: 'cat_starters',  name: 'Starters',       path: 'Food > Starters' },
  { id: 'cat_tacos',     name: 'Tacos',          path: 'Food > Tacos' },
  { id: 'cat_mains',     name: 'Mains',          path: 'Food > Mains' },
  { id: 'cat_desserts',  name: 'Desserts',       path: 'Food > Desserts' },
  { id: 'cat_cocktails', name: 'Cocktails',      path: 'Drinks > Cocktails' },
  { id: 'cat_tequila',   name: 'Tequila',        path: 'Drinks > Tequila' },
  { id: 'cat_mezcal',    name: 'Mezcal',         path: 'Drinks > Mezcal' },
  { id: 'cat_beer',      name: 'Beer & Cider',   path: 'Drinks > Beer' },
  { id: 'cat_wine',      name: 'Wine',           path: 'Drinks > Wine' },
  { id: 'cat_softs',     name: 'Soft Drinks',    path: 'Drinks > Soft Drinks' },
];

// -----------------------------------------------------------------------------
// 3. MODIFIER GROUPS
// -----------------------------------------------------------------------------
const modifierGroups = [
  {
    id: 'modgrp_taco_protein',
    name: 'Taco Protein Choice',
    minSelection: 1, maxSelection: 1,
    modifiers: [
      { id: 'mod_asada',   name: 'Asada (Beef)',    price: 0   },
      { id: 'mod_pastor',  name: 'Pastor (Pork)',   price: 0   },
      { id: 'mod_tinga',   name: 'Tinga (Chicken)', price: 0   },
      { id: 'mod_suadero', name: 'Suadero (Brisket)', price: 0 },
      { id: 'mod_veggie',  name: 'Veggie (Beans)',  price: -100 },
    ]
  },
  {
    id: 'modgrp_taco_extras',
    name: 'Taco Extras',
    minSelection: 0, maxSelection: 4,
    modifiers: [
      { id: 'mod_extra_guac',    name: 'Extra Guacamole',   price: 150 },
      { id: 'mod_extra_cheese',  name: 'Extra Cheese',      price: 100 },
      { id: 'mod_extra_cream',   name: 'Extra Crema',       price: 75  },
      { id: 'mod_no_onion',      name: 'No Onion',          price: 0   },
      { id: 'mod_no_coriander',  name: 'No Coriander',      price: 0   },
      { id: 'mod_extra_salsa_r', name: 'Extra Salsa Roja',  price: 50  },
      { id: 'mod_extra_salsa_v', name: 'Extra Salsa Verde', price: 50  },
      { id: 'mod_spicy',         name: 'Make it Spicy',     price: 0   },
    ]
  },
  {
    id: 'modgrp_enchilada_sauce',
    name: 'Enchilada Sauce',
    minSelection: 1, maxSelection: 1,
    modifiers: [
      { id: 'mod_roja',    name: 'Salsa Roja',    price: 0 },
      { id: 'mod_verde',   name: 'Salsa Verde',   price: 0 },
      { id: 'mod_mole_s',  name: 'Mole',          price: 0 },
    ]
  },
  {
    id: 'modgrp_tequila_serve',
    name: 'Tequila Serve',
    minSelection: 1, maxSelection: 1,
    modifiers: [
      { id: 'mod_neat',       name: 'Neat',           price: 0   },
      { id: 'mod_rocks',      name: 'On the Rocks',   price: 0   },
      { id: 'mod_salt_lime',  name: 'With Salt & Lime', price: 0 },
    ]
  },
  {
    id: 'modgrp_cocktail_extras',
    name: 'Cocktail Customise',
    minSelection: 0, maxSelection: 3,
    modifiers: [
      { id: 'mod_no_salt_rim',  name: 'No Salt Rim',     price: 0   },
      { id: 'mod_extra_spicy_c', name: 'Spicy (Jalapeno)', price: 50 },
      { id: 'mod_double',       name: 'Double Spirit',   price: 350 },
      { id: 'mod_no_ice',       name: 'No Ice',          price: 0   },
    ]
  },
  {
    id: 'modgrp_sides',
    name: 'Side Options',
    minSelection: 0, maxSelection: 2,
    modifiers: [
      { id: 'mod_side_rice',   name: 'Mexican Rice',    price: 300 },
      { id: 'mod_side_beans',  name: 'Black Beans',     price: 250 },
      { id: 'mod_side_salad',  name: 'House Salad',     price: 350 },
      { id: 'mod_side_chips',  name: 'Tortilla Chips',  price: 200 },
    ]
  },
];

// -----------------------------------------------------------------------------
// 4. RECIPES / MENU ITEMS
// sellingPrice = pence NET of VAT
// pricePerUnit = ingredient cost per base unit in pence
// -----------------------------------------------------------------------------
const recipes = [

  // -- STARTERS ------------------------------------------------------------

  {
    id: 'recipe_guacamole',
    name: 'Guacamole',
    type: 'menu_item',
    category: 'Starters',
    menuPath: 'Food > Starters',
    description: 'Freshly made guacamole with Hass avocados, white onion, coriander, jalapeno and lime. Served with handmade tortilla chips.',
    sellingPrice: 7.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 320,
    station: 'Cold',
    course: 'Starters',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 85,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Locally sourced avocados when in season', 'Zero waste - offcuts used in salsa'],
    ingredients: [
      { inventoryItemId: 'inv_avocado',     quantity: 2,   unit: 'pcs', baseQuantity: 2,   costAtCreation: 80  },
      { inventoryItemId: 'inv_onion_white', quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.02 },
      { inventoryItemId: 'inv_coriander',   quantity: 10,  unit: 'g',   baseQuantity: 10,  costAtCreation: 0.15 },
      { inventoryItemId: 'inv_jalapeno',    quantity: 20,  unit: 'g',   baseQuantity: 20,  costAtCreation: 0.08 },
      { inventoryItemId: 'inv_lime',        quantity: 1,   unit: 'pcs', baseQuantity: 1,   costAtCreation: 25  },
    ],
    allowedModifiers: ['modgrp_sides'],
    trainingSteps: [
      { title: 'Select avocados', description: 'Use ripe Hass avocados - they should give slightly when pressed. Never use under-ripe fruit.' },
      { title: 'Prepare the base', description: 'Halve and stone avocados. Scoop flesh into molcajete (stone mortar). Add pinch of salt and mash to desired texture - keep chunky.' },
      { title: 'Add aromatics', description: 'Fold in finely diced white onion, chopped coriander, jalapeno (seeds in for heat, seeds out for mild), and fresh lime juice.' },
      { title: 'Taste and season', description: 'Taste before serving. Adjust salt and lime. Guacamole should be fresh, bright and creamy - not brown or bland.' },
      { title: 'Serve immediately', description: 'Serve in molcajete with fresh tortilla chips. Press cling film directly onto surface to prevent browning if batch.' },
    ],
    winePairing: { name: 'Sauvignon Blanc', nose: 'Citrus and herbaceous', palate: 'Crisp acidity complements the lime', finish: 'Clean and refreshing' },
    tequilaPairing: { name: 'Olmeca Blanco', nose: 'Agave and citrus', palate: 'Clean spirit lifts the avocado', finish: 'Light and fresh' },
  },

  {
    id: 'recipe_esquites',
    name: 'Esquites (Street Corn)',
    type: 'menu_item',
    category: 'Starters',
    menuPath: 'Food > Starters',
    description: 'Roasted sweetcorn kernels tossed in chipotle mayo, topped with cotija cheese, fresh lime and tajin. A Mexican street food classic.',
    sellingPrice: 7.00,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 380,
    station: 'Cold',
    course: 'Starters',
    isActive: true,
    trackAvailability: true,
    allergies: ['Milk', 'Eggs'],
    allergyIngredients: { Milk: ['cotija cheese'], Eggs: ['chipotle mayo'] },
    autoDetectAllergies: true,
    sustainabilityScore: 80,
    carbonFootprint: 'Low',
    sustainabilityTips: ['UK-grown sweetcorn in season', 'Batch prep reduces waste'],
    ingredients: [
      { inventoryItemId: 'inv_cheese_cotija', quantity: 30, unit: 'g', baseQuantity: 30, costAtCreation: 0.28 },
      { inventoryItemId: 'inv_lime',          quantity: 1,  unit: 'pcs', baseQuantity: 1, costAtCreation: 25  },
      { inventoryItemId: 'inv_chipotle_dried',quantity: 5,  unit: 'g',  baseQuantity: 5,  costAtCreation: 0.12 },
    ],
    allowedModifiers: [],
    trainingSteps: [
      { title: 'Char the corn', description: 'Roast sweetcorn directly on grill or cast iron until char marks appear. Allow to cool slightly then cut kernels from cob.' },
      { title: 'Make chipotle mayo', description: 'Blend mayo with chipotle paste - ratio 4:1. Should be smoky with gentle heat.' },
      { title: 'Dress and serve', description: 'Toss warm corn in chipotle mayo. Plate in small bowl or cup. Top with cotija, lime zest, squeeze of lime, and shake of tajin.' },
    ],
    tequilaPairing: { name: 'Reposado (1800)', nose: 'Vanilla and oak', palate: 'Caramel notes complement the chipotle', finish: 'Warm and lingering' },
  },

  // -- TACOS ----------------------------------------------------------------

  {
    id: 'recipe_tacos_asada',
    name: 'Tacos de Asada',
    type: 'menu_item',
    category: 'Tacos',
    menuPath: 'Food > Tacos',
    description: 'Grilled beef skirt marinated in citrus and herbs, served in two handmade corn tortillas with white onion, fresh coriander, salsa roja and lime.',
    sellingPrice: 9.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 520,
    station: 'Grill',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 55,
    carbonFootprint: 'Medium',
    sustainabilityTips: ['UK-sourced beef reduces food miles', 'Batch marinade reduces energy use'],
    ingredients: [
      { inventoryItemId: 'inv_beef_asada',   quantity: 120, unit: 'g',   baseQuantity: 120, costAtCreation: 0.285 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 2,  unit: 'pcs', baseQuantity: 2,   costAtCreation: 4 },
      { inventoryItemId: 'inv_onion_white',  quantity: 20,  unit: 'g',   baseQuantity: 20,  costAtCreation: 0.02 },
      { inventoryItemId: 'inv_coriander',    quantity: 5,   unit: 'g',   baseQuantity: 5,   costAtCreation: 0.15 },
      { inventoryItemId: 'inv_salsa_roja',   quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.06 },
      { inventoryItemId: 'inv_lime',         quantity: 1,   unit: 'pcs', baseQuantity: 1,   costAtCreation: 25  },
    ],
    allowedModifiers: ['modgrp_taco_extras', 'modgrp_sides'],
    trainingSteps: [
      { title: 'Marinade', description: 'Beef skirt marinates for minimum 4 hours in citrus (orange + lime), garlic, cumin and oregano. This is prepped by kitchen AM.' },
      { title: 'Grill temperature', description: 'Grill must be at 220C minimum. Hot grill = good char, juicy interior. Do not cook on low heat.' },
      { title: 'Cook the beef', description: 'Grill 2-3 minutes per side for medium. Rest 2 minutes then slice against the grain into small pieces.' },
      { title: 'Warm tortillas', description: 'Place corn tortillas directly on grill for 20 seconds per side. They should be pliable and slightly charred.' },
      { title: 'Build and serve', description: 'Two tortillas per taco portion. Beef, onion, coriander, salsa. Serve with lime wedge. Never plate cold.' },
    ],
    tequilaPairing: { name: 'Olmeca Blanco', nose: 'Clean agave and citrus', palate: 'Cuts through the richness of the beef', finish: 'Fresh and clean' },
    mezcalPairing: { name: 'Del Maguey Espadin', nose: 'Smoke and tropical fruit', palate: 'Smoky notes complement charred beef', finish: 'Long and complex' },
  },

  {
    id: 'recipe_tacos_pastor',
    name: 'Tacos de Pastor',
    type: 'menu_item',
    category: 'Tacos',
    menuPath: 'Food > Tacos',
    description: 'Slow-marinated pork shoulder with dried chillies and pineapple, cooked al pastor style. Two corn tortillas, pineapple, coriander, onion.',
    sellingPrice: 9.00,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 490,
    station: 'Grill',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 60,
    carbonFootprint: 'Medium',
    sustainabilityTips: ['Batch marinade maximises yield from one prep session'],
    ingredients: [
      { inventoryItemId: 'inv_pork_pastor',  quantity: 110, unit: 'g',   baseQuantity: 110, costAtCreation: 0.18 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 2,  unit: 'pcs', baseQuantity: 2,   costAtCreation: 4 },
      { inventoryItemId: 'inv_ancho_dried',  quantity: 8,   unit: 'g',   baseQuantity: 8,   costAtCreation: 0.10 },
      { inventoryItemId: 'inv_onion_white',  quantity: 20,  unit: 'g',   baseQuantity: 20,  costAtCreation: 0.02 },
      { inventoryItemId: 'inv_coriander',    quantity: 5,   unit: 'g',   baseQuantity: 5,   costAtCreation: 0.15 },
      { inventoryItemId: 'inv_salsa_roja',   quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.06 },
    ],
    allowedModifiers: ['modgrp_taco_extras', 'modgrp_sides'],
    trainingSteps: [
      { title: 'Prep note', description: 'Pastor pork marinates overnight in ancho/chipotle paste, pineapple juice, achiote and vinegar. This is chef AM responsibility.' },
      { title: 'Cooking method', description: 'Traditionally cooked on trompo (vertical spit). In service, sliced portions are cooked on the plancha until caramelised.' },
      { title: 'Build', description: 'Two corn tortillas, pastor pork, fresh pineapple pieces, onion, coriander. Serve with salsa roja and lime.' },
    ],
    tequilaPairing: { name: 'Reposado (1800)', nose: 'Vanilla oak with citrus', palate: 'Sweetness matches the pineapple marinade', finish: 'Warm and smooth' },
  },

  {
    id: 'recipe_tacos_suadero',
    name: 'Tacos de Suadero',
    type: 'menu_item',
    category: 'Tacos',
    menuPath: 'Food > Tacos',
    description: 'Slow-braised beef brisket, tender and rich. Two corn tortillas, salsa verde, onion, coriander. A Mexico City classic.',
    sellingPrice: 9.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 540,
    station: 'Grill',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 50,
    carbonFootprint: 'High',
    sustainabilityTips: ['Low and slow cooking extracts maximum yield from cheaper cut'],
    ingredients: [
      { inventoryItemId: 'inv_beef_suadero', quantity: 120, unit: 'g',   baseQuantity: 120, costAtCreation: 0.32 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 2,  unit: 'pcs', baseQuantity: 2,   costAtCreation: 4 },
      { inventoryItemId: 'inv_salsa_verde',  quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.05 },
      { inventoryItemId: 'inv_onion_white',  quantity: 20,  unit: 'g',   baseQuantity: 20,  costAtCreation: 0.02 },
      { inventoryItemId: 'inv_coriander',    quantity: 5,   unit: 'g',   baseQuantity: 5,   costAtCreation: 0.15 },
    ],
    allowedModifiers: ['modgrp_taco_extras', 'modgrp_sides'],
    trainingSteps: [
      { title: 'Braise', description: 'Brisket braised low and slow (160C, 4-5 hours) in beef stock, bay, garlic, onion. Shredded once tender.' },
      { title: 'Finish on plancha', description: 'Portion of braised suadero goes on hot plancha to caramelise the edges before plating.' },
      { title: 'Build', description: 'Two warm tortillas, suadero, onion, coriander, salsa verde. Lime on the side.' },
    ],
    mezcalPairing: { name: 'Del Maguey Espadin', nose: 'Earthy and smoky', palate: 'Smoke and brisket are natural partners', finish: 'Long and savoury' },
  },

  {
    id: 'recipe_tacos_pierna',
    name: 'Tacos de Pierna',
    type: 'menu_item',
    category: 'Tacos',
    menuPath: 'Food > Tacos',
    description: 'Slow-roasted pork leg, juicy and golden. Two corn tortillas with salsa roja, pickled red onion, crema and cotija.',
    sellingPrice: 9.00,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 510,
    station: 'Grill',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: ['Milk'],
    allergyIngredients: { Milk: ['crema'] },
    autoDetectAllergies: true,
    sustainabilityScore: 60,
    carbonFootprint: 'Medium',
    sustainabilityTips: ['Full leg roasted ensures maximum yield'],
    ingredients: [
      { inventoryItemId: 'inv_pork_pierna',  quantity: 110, unit: 'g',   baseQuantity: 110, costAtCreation: 0.16 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 2,  unit: 'pcs', baseQuantity: 2,   costAtCreation: 4 },
      { inventoryItemId: 'inv_salsa_roja',   quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.06 },
      { inventoryItemId: 'inv_onion_red',    quantity: 20,  unit: 'g',   baseQuantity: 20,  costAtCreation: 0.025 },
      { inventoryItemId: 'inv_sour_cream',   quantity: 20,  unit: 'g',   baseQuantity: 20,  costAtCreation: 0.08 },
      { inventoryItemId: 'inv_cheese_cotija', quantity: 15, unit: 'g',   baseQuantity: 15,  costAtCreation: 0.28 },
    ],
    allowedModifiers: ['modgrp_taco_extras', 'modgrp_sides'],
    trainingSteps: [
      { title: 'Roast', description: 'Pork leg seasoned with garlic, cumin, achiote and orange. Slow-roasted 180C for 3.5 hours. Rest 30 min before slicing.' },
      { title: 'Build', description: 'Sliced pork, pickled red onion, crema drizzle, cotija crumble, salsa roja. Two corn tortillas.' },
    ],
  },

  // -- MAINS ----------------------------------------------------------------

  {
    id: 'recipe_mole_poblano',
    name: 'Mole Poblano',
    type: 'menu_item',
    category: 'Mains',
    menuPath: 'Food > Mains',
    description: 'Classic Puebla mole - over 30 ingredients including dried chillies, dark chocolate, sesame and spices. Served with braised beef, Mexican rice and black beans.',
    sellingPrice: 16.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 780,
    station: 'Saute',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: ['Sesame', 'Peanuts', 'Tree nuts'],
    allergyIngredients: { Sesame: ['mole paste'], Peanuts: ['mole paste'], 'Tree nuts': ['mole paste'] },
    autoDetectAllergies: true,
    sustainabilityScore: 65,
    carbonFootprint: 'Medium',
    sustainabilityTips: ['Mole freezes well - batch production reduces waste', 'Dried chilli sourcing from small Mexican farms when possible'],
    ingredients: [
      { inventoryItemId: 'inv_beef_mole',    quantity: 180, unit: 'g',   baseQuantity: 180, costAtCreation: 0.22 },
      { inventoryItemId: 'inv_mole_paste',   quantity: 80,  unit: 'g',   baseQuantity: 80,  costAtCreation: 0.095 },
      { inventoryItemId: 'inv_rice',         quantity: 100, unit: 'g',   baseQuantity: 100, costAtCreation: 0.008 },
      { inventoryItemId: 'inv_black_beans',  quantity: 80,  unit: 'g',   baseQuantity: 80,  costAtCreation: 0.012 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 2,  unit: 'pcs', baseQuantity: 2,   costAtCreation: 4 },
      { inventoryItemId: 'inv_sesame_seeds', quantity: 5,   unit: 'g',   baseQuantity: 5,   costAtCreation: 0.05 },
    ],
    allowedModifiers: ['modgrp_sides'],
    trainingSteps: [
      { title: 'Allergen alert', description: 'WARNING: CRITICAL: Mole Poblano contains SESAME, PEANUTS, and TREE NUTS from the mole paste. Always flag to guests before ordering. Never serve without allergen declaration.' },
      { title: 'Prepare the mole', description: 'Dilute mole paste in hot beef stock (ratio 1:3). Simmer 15 minutes stirring constantly. Should coat the back of a spoon.' },
      { title: 'Braise beef', description: 'Beef chuck slow-braised until tender. Shred and fold into mole sauce to absorb flavour.' },
      { title: 'Plate', description: 'Mole and beef in centre, rice and beans on either side. Sesame seed garnish. Warm tortillas on the side. Plate should be hot.' },
      { title: 'Upsell tip', description: 'Pair with a Reposado tequila - the vanilla and oak complement the complexity of the mole. This is a premium pairing opportunity.' },
    ],
    winePairing: { name: 'Malbec', nose: 'Dark fruit and chocolate', palate: 'Tannins complement the mole depth', finish: 'Rich and lingering' },
    tequilaPairing: { name: '1800 Reposado', nose: 'Vanilla, caramel and oak', palate: 'Sweet notes match the mole complexity', finish: 'Warm and satisfying' },
  },

  {
    id: 'recipe_enchiladas',
    name: 'Enchiladas',
    type: 'menu_item',
    category: 'Mains',
    menuPath: 'Food > Mains',
    description: 'Three corn tortillas filled with chicken, bathed in your choice of salsa roja, verde or mole. Topped with Oaxaca cheese, crema and cotija.',
    sellingPrice: 14.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 650,
    station: 'Saute',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: ['Milk'],
    allergyIngredients: { Milk: ['Oaxaca cheese', 'crema', 'cotija'] },
    autoDetectAllergies: true,
    sustainabilityScore: 70,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Chicken thighs - more flavour, less waste than breast', 'Sauces batch-made daily from fresh produce'],
    ingredients: [
      { inventoryItemId: 'inv_chicken_ench', quantity: 150, unit: 'g',   baseQuantity: 150, costAtCreation: 0.16 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 3,  unit: 'pcs', baseQuantity: 3,   costAtCreation: 4 },
      { inventoryItemId: 'inv_cheese_oaxaca', quantity: 50, unit: 'g',   baseQuantity: 50,  costAtCreation: 0.22 },
      { inventoryItemId: 'inv_sour_cream',   quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.08 },
      { inventoryItemId: 'inv_cheese_cotija', quantity: 20, unit: 'g',   baseQuantity: 20,  costAtCreation: 0.28 },
      { inventoryItemId: 'inv_salsa_roja',   quantity: 80,  unit: 'g',   baseQuantity: 80,  costAtCreation: 0.06 },
    ],
    allowedModifiers: ['modgrp_enchilada_sauce', 'modgrp_sides'],
    trainingSteps: [
      { title: 'Dairy allergen', description: 'WARNING: Contains MILK from Oaxaca cheese, crema and cotija. Ask about dairy allergies before taking order.' },
      { title: 'Fill tortillas', description: 'Briefly fry each tortilla in oil to soften (5 seconds each side). Fill with shredded chicken, roll tightly, lay seam-down in oven dish.' },
      { title: 'Sauce and cheese', description: 'Pour chosen sauce generously over rolled enchiladas. Layer Oaxaca cheese on top.' },
      { title: 'Bake', description: 'Bake at 200C for 10-12 minutes until cheese is melted and bubbling at edges.' },
      { title: 'Finish', description: 'Drizzle crema, crumble cotija, garnish with coriander. Serve immediately - enchiladas do not hold well.' },
    ],
    tequilaPairing: { name: 'Olmeca Blanco', nose: 'Fresh agave and citrus', palate: 'Cuts through the cheese richness', finish: 'Clean and refreshing' },
  },

  {
    id: 'recipe_enchiladas_verdes',
    name: 'Enchiladas Verdes',
    type: 'menu_item',
    category: 'Mains',
    menuPath: 'Food > Mains',
    description: 'Three corn tortillas filled with chicken in tomatillo salsa verde. Topped with Oaxaca cheese, crema, pickled jalapenos and cotija.',
    sellingPrice: 14.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 620,
    station: 'Saute',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: ['Milk'],
    allergyIngredients: { Milk: ['Oaxaca cheese', 'crema', 'cotija'] },
    autoDetectAllergies: true,
    sustainabilityScore: 72,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Tomatillo grown in UK polytunnels during summer'],
    ingredients: [
      { inventoryItemId: 'inv_chicken_ench', quantity: 150, unit: 'g',   baseQuantity: 150, costAtCreation: 0.16 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 3,  unit: 'pcs', baseQuantity: 3,   costAtCreation: 4 },
      { inventoryItemId: 'inv_cheese_oaxaca', quantity: 50, unit: 'g',   baseQuantity: 50,  costAtCreation: 0.22 },
      { inventoryItemId: 'inv_sour_cream',   quantity: 30,  unit: 'g',   baseQuantity: 30,  costAtCreation: 0.08 },
      { inventoryItemId: 'inv_salsa_verde',  quantity: 80,  unit: 'g',   baseQuantity: 80,  costAtCreation: 0.05 },
      { inventoryItemId: 'inv_jalapeno',     quantity: 15,  unit: 'g',   baseQuantity: 15,  costAtCreation: 0.08 },
    ],
    allowedModifiers: ['modgrp_sides'],
    trainingSteps: [
      { title: 'Same as Enchiladas', description: 'Follow the same build process as Enchiladas Rojas. Key difference is salsa verde is lighter and tangier - ensure sauce is at serving temperature before plating.' },
    ],
  },

  {
    id: 'recipe_filete_arriero',
    name: 'Filete Arriero',
    type: 'menu_item',
    category: 'Mains',
    menuPath: 'Food > Mains',
    description: 'Premium beef fillet cooked to order. Served with chipotle butter, roasted vegetables, Mexican rice and handmade tortillas.',
    sellingPrice: 26.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 720,
    station: 'Grill',
    course: 'Mains',
    isActive: true,
    trackAvailability: true,
    allergies: ['Milk'],
    allergyIngredients: { Milk: ['chipotle butter'] },
    autoDetectAllergies: true,
    sustainabilityScore: 40,
    carbonFootprint: 'High',
    sustainabilityTips: ['Source from British farms with RSPCA Assured certification', 'Fillet offcuts used in staff meal'],
    ingredients: [
      { inventoryItemId: 'inv_beef_filete',  quantity: 220, unit: 'g',   baseQuantity: 220, costAtCreation: 0.55 },
      { inventoryItemId: 'inv_rice',         quantity: 80,  unit: 'g',   baseQuantity: 80,  costAtCreation: 0.008 },
      { inventoryItemId: 'inv_tortilla_corn', quantity: 2,  unit: 'pcs', baseQuantity: 2,   costAtCreation: 4 },
      { inventoryItemId: 'inv_chipotle_dried', quantity: 5, unit: 'g',   baseQuantity: 5,   costAtCreation: 0.12 },
    ],
    allowedModifiers: ['modgrp_sides'],
    trainingSteps: [
      { title: 'Check cook preference', description: 'Always ask: Rare / Medium Rare / Medium / Well Done. Default is Medium Rare. Never assume.' },
      { title: 'Grill technique', description: 'Season generously with salt. Grill on highest heat. Rare: 2 min per side. MR: 3 min. Medium: 4 min. Always rest 3 min before plating.' },
      { title: 'Chipotle butter', description: 'Place knob of chipotle compound butter on fillet immediately after grill so it melts into the meat while resting.' },
      { title: 'This is a premium dish', description: 'At 26.50 GBP this is our most expensive main. Presentation must be perfect. Double check plate temperature, garnish, and cook before leaving the pass.' },
    ],
    winePairing: { name: 'Malbec or Cabernet', nose: 'Dark fruit and tobacco', palate: 'Tannins cut through the butter', finish: 'Long and complex' },
    tequilaPairing: { name: 'Patron Anejo', nose: 'Caramel, vanilla and dried fruit', palate: 'Aged tequila matches the fillet elegance', finish: 'Warm and luxurious' },
  },

  // -- COCKTAILS ------------------------------------------------------------

  {
    id: 'recipe_paloma',
    name: 'Paloma',
    type: 'menu_item',
    category: 'Cocktails',
    menuPath: 'Drinks > Cocktails',
    description: 'Tequila blanco, fresh pink grapefruit juice, lime juice, agave syrup, topped with Fever-Tree soda. Served in a chilli-salt rimmed glass over ice.',
    sellingPrice: 9.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 195,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 75,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Use fresh-squeezed grapefruit, not carton', 'Citrus offcuts used for rim and garnish'],
    ingredients: [
      { inventoryItemId: 'inv_tequila_blanco',   quantity: 50,  unit: 'ml', baseQuantity: 50,  costAtCreation: 0.032 },
      { inventoryItemId: 'inv_grapefruit_juice',  quantity: 80,  unit: 'ml', baseQuantity: 80,  costAtCreation: 0.005 },
      { inventoryItemId: 'inv_lime_juice',        quantity: 20,  unit: 'ml', baseQuantity: 20,  costAtCreation: 0.008 },
      { inventoryItemId: 'inv_agave_syrup',       quantity: 15,  unit: 'ml', baseQuantity: 15,  costAtCreation: 0.012 },
      { inventoryItemId: 'inv_soda_water',        quantity: 60,  unit: 'ml', baseQuantity: 60,  costAtCreation: 0.003 },
      { inventoryItemId: 'inv_salt_rim',          quantity: 2,   unit: 'g',  baseQuantity: 2,   costAtCreation: 0.002 },
    ],
    allowedModifiers: ['modgrp_cocktail_extras'],
    trainingSteps: [
      { title: 'Prep the glass', description: 'Take a highball glass. Run a lime wedge around the rim then dip in chilli-salt mix. Fill with ice.' },
      { title: 'Build in shaker', description: '50ml Olmeca Blanco, 80ml fresh grapefruit juice, 20ml lime juice, 15ml agave syrup. Add ice and shake hard 10 seconds.' },
      { title: 'Pour and top', description: 'Strain over fresh ice in rimmed glass. Top with Fever-Tree soda. Do not over-stir - preserve the bubbles.' },
      { title: 'Garnish', description: 'Grapefruit wedge or half-wheel on the rim. The chilli-salt rim is signature - never skip it.' },
      { title: 'This is our bestseller', description: 'Paloma is consistently our top cocktail. Speed and consistency matter. Prep grapefruit juice in batches per service.' },
    ],
    tequilaPairing: { name: 'Olmeca Blanco', nose: 'Agave, citrus and mineral', palate: 'Clean and fresh base for the cocktail', finish: 'Bright and refreshing' },
  },

  {
    id: 'recipe_margarita_clasica',
    name: 'Margarita Clasica',
    type: 'menu_item',
    category: 'Cocktails',
    menuPath: 'Drinks > Cocktails',
    description: 'The classic. Olmeca Blanco tequila, Cointreau, fresh lime juice, agave syrup. Salt rim. On the rocks or straight up.',
    sellingPrice: 10.00,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 210,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 78,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Fresh lime only - never from a bottle'],
    ingredients: [
      { inventoryItemId: 'inv_tequila_blanco', quantity: 50, unit: 'ml', baseQuantity: 50, costAtCreation: 0.032 },
      { inventoryItemId: 'inv_triple_sec',     quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.042 },
      { inventoryItemId: 'inv_lime_juice',     quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.008 },
      { inventoryItemId: 'inv_agave_syrup',    quantity: 10, unit: 'ml', baseQuantity: 10, costAtCreation: 0.012 },
      { inventoryItemId: 'inv_salt_rim',       quantity: 2,  unit: 'g',  baseQuantity: 2,  costAtCreation: 0.002 },
    ],
    allowedModifiers: ['modgrp_cocktail_extras'],
    trainingSteps: [
      { title: 'Classic ratio', description: '2:1:1 - 50ml tequila, 25ml Cointreau, 25ml lime. This ratio never changes. Do not free pour.' },
      { title: 'Always ask', description: 'Salt rim or no salt? Rocks or straight up? These are the only two questions. Ask every time.' },
      { title: 'Shake technique', description: 'Shake hard with ice for 12 seconds. Margarita should be cold and slightly diluted. Strain properly - no ice chips.' },
      { title: 'Lime juice', description: 'Fresh squeezed only. Bottled lime juice is not acceptable under any circumstances.' },
    ],
    tequilaPairing: { name: 'Olmeca Blanco', nose: 'Pure agave expression', palate: 'The tequila is the star - clean and crisp', finish: 'Lime zest and agave' },
  },

  {
    id: 'recipe_mojito_fresa',
    name: 'Mojito Fresa',
    type: 'menu_item',
    category: 'Cocktails',
    menuPath: 'Drinks > Cocktails',
    description: 'White rum, fresh strawberry puree, mint, lime juice, agave syrup, topped with Fever-Tree soda. A tropical twist on the classic mojito.',
    sellingPrice: 10.00,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 185,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 72,
    carbonFootprint: 'Low',
    sustainabilityTips: ['UK strawberries in season (June-Sept)', 'Mint grown in kitchen herb garden'],
    ingredients: [
      { inventoryItemId: 'inv_rum_white',        quantity: 50, unit: 'ml', baseQuantity: 50, costAtCreation: 0.028 },
      { inventoryItemId: 'inv_strawberry_puree', quantity: 40, unit: 'ml', baseQuantity: 40, costAtCreation: 0.009 },
      { inventoryItemId: 'inv_mint',             quantity: 10, unit: 'g',  baseQuantity: 10, costAtCreation: 0.30 },
      { inventoryItemId: 'inv_lime_juice',       quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.008 },
      { inventoryItemId: 'inv_agave_syrup',      quantity: 15, unit: 'ml', baseQuantity: 15, costAtCreation: 0.012 },
      { inventoryItemId: 'inv_soda_water',       quantity: 60, unit: 'ml', baseQuantity: 60, costAtCreation: 0.003 },
    ],
    allowedModifiers: ['modgrp_cocktail_extras'],
    trainingSteps: [
      { title: 'Muddle mint', description: 'Place 8-10 mint leaves in the bottom of a highball glass. Add lime juice and agave. Muddle gently - you want aroma, not bitterness. Do not shred the leaves.' },
      { title: 'Add rum and puree', description: 'Add strawberry puree and white rum. Fill glass with crushed ice.' },
      { title: 'Top and garnish', description: 'Top with Fever-Tree soda. Garnish with mint sprig and fresh strawberry on rim. Serve with a straw.' },
    ],
  },

  // -- TEQUILA (POUR) -------------------------------------------------------

  {
    id: 'recipe_olmeca_blanco',
    name: 'Olmeca Blanco (25ml)',
    type: 'menu_item',
    category: 'Tequila',
    menuPath: 'Drinks > Tequila',
    description: 'Crisp and clean 100% agave blanco tequila. Unaged, silver. Notes of fresh agave, citrus and black pepper.',
    sellingPrice: 4.75,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 58,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    sustainabilityScore: 70,
    carbonFootprint: 'Medium',
    ingredients: [
      { inventoryItemId: 'inv_tequila_blanco', quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.032 },
    ],
    allowedModifiers: ['modgrp_tequila_serve'],
    trainingSteps: [
      { title: 'Profile', description: 'Olmeca Blanco is our house blanco. Unaged, fresh and herbaceous. Made in Jalisco from 100% blue agave.' },
      { title: 'Serve', description: 'Neat in a caballito (shot) glass, or on rocks in a rocks glass. Always with lime wedge and salt on the side unless specified otherwise.' },
      { title: 'Pairing', description: 'Pairs with lighter dishes - guacamole, ceviche, fish tacos. The citrus notes complement seafood and vegetable dishes.' },
    ],
    tequilaPairing: { name: 'Olmeca Blanco', nose: 'Fresh agave, citrus peel, green herbs', palate: 'Crisp and lively with mineral finish', finish: 'Clean and sharp' },
  },

  {
    id: 'recipe_1800_reposado',
    name: '1800 Reposado (25ml)',
    type: 'menu_item',
    category: 'Tequila',
    menuPath: 'Drinks > Tequila',
    description: 'Aged 8 months in American and French oak barrels. Smooth with vanilla, caramel and subtle spice.',
    sellingPrice: 6.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 58,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    sustainabilityScore: 65,
    carbonFootprint: 'Medium',
    ingredients: [
      { inventoryItemId: 'inv_tequila_reposado', quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.055 },
    ],
    allowedModifiers: ['modgrp_tequila_serve'],
    trainingSteps: [
      { title: 'Profile', description: '1800 Reposado - aged 8 months in American and French oak. Colour: light gold. The oak gives vanilla and slight spice.' },
      { title: 'Best serve', description: 'Recommend neat or on rocks to appreciate the oak influence. No salt and lime - this is a sipping tequila.' },
      { title: 'Upsell', description: 'Customer ordering Margarita? Ask if they would like to upgrade to Reposado for 2 GBP extra. Richer, more complex cocktail - most say yes.' },
    ],
    tequilaPairing: { name: '1800 Reposado', nose: 'Vanilla, caramel, agave and baking spice', palate: 'Smooth with oak and dried fruit', finish: 'Warm and long' },
  },

  {
    id: 'recipe_patron_anejo',
    name: 'Patron Anejo (25ml)',
    type: 'menu_item',
    category: 'Tequila',
    menuPath: 'Drinks > Tequila',
    description: 'Aged over a year in small oak barrels. Rich, complex and premium. Perfect for sipping.',
    sellingPrice: 9.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 58,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    sustainabilityScore: 65,
    carbonFootprint: 'Medium',
    ingredients: [
      { inventoryItemId: 'inv_tequila_anejo', quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.085 },
    ],
    allowedModifiers: ['modgrp_tequila_serve'],
    trainingSteps: [
      { title: 'Profile', description: 'Patron Anejo aged 12+ months in small oak barrels. Deep amber. Complex with dried fruit, chocolate, leather and long oak finish.' },
      { title: 'This is a premium serve', description: 'At 9.50 GBP this must be served perfectly. Crystal rocks glass, large ice cube, or neat in a snifter. Never in a plastic cup.' },
      { title: 'Food pairing', description: 'Pairs with our Filete Arriero - the only dish that matches its complexity. Suggest this pairing to guests ordering the fillet.' },
    ],
    tequilaPairing: { name: 'Patron Anejo', nose: 'Dark caramel, dried fruit, leather, chocolate', palate: 'Rich and full-bodied with layered complexity', finish: 'Exceptionally long and warm' },
  },

  // -- MEZCAL ---------------------------------------------------------------

  {
    id: 'recipe_del_maguey',
    name: 'Del Maguey Espadin (25ml)',
    type: 'menu_item',
    category: 'Mezcal',
    menuPath: 'Drinks > Mezcal',
    description: 'Artisan Oaxacan mezcal. Hand-crafted using traditional pit-roasting methods. Smoky, earthy and complex with tropical fruit notes.',
    sellingPrice: 8.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 60,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    sustainabilityScore: 90,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Del Maguey works directly with indigenous Zapotec communities', 'Traditional production supports sustainable agave harvesting'],
    ingredients: [
      { inventoryItemId: 'inv_mezcal_espad', quantity: 25, unit: 'ml', baseQuantity: 25, costAtCreation: 0.095 },
    ],
    allowedModifiers: ['modgrp_tequila_serve'],
    trainingSteps: [
      { title: 'Mezcal vs Tequila', description: 'All tequila is mezcal but not all mezcal is tequila. Mezcal can be made from many agave varieties. Del Maguey uses Espadin agave, pit-roasted for up to 5 days - this creates the smoky character.' },
      { title: 'How to serve', description: 'Always neat, never with salt and lime (that is tequila tradition). Serve in a copita or rocks glass. Orange slice and chilli worm salt on the side is traditional.' },
      { title: 'Story sell', description: 'This is a sustainability story - handmade by Zapotec farmers in Oaxaca using methods unchanged for 400 years. That story justifies the premium price.' },
      { title: 'Pairing', description: 'Smoke pairs with char - Tacos de Asada, Suadero, or the Filete Arriero. Any grilled protein benefits from the contrast.' },
    ],
    mezcalPairing: { name: 'Del Maguey Espadin', nose: 'Bonfire smoke, tropical fruit, roasted agave and earth', palate: 'Complex smoke with mango, pineapple and spice', finish: 'Long, warm and deeply smoky' },
  },

  // -- BEER -----------------------------------------------------------------

  {
    id: 'recipe_corona',
    name: 'Corona Extra',
    type: 'menu_item',
    category: 'Beer & Cider',
    menuPath: 'Drinks > Beer',
    description: 'Mexican pale lager. Light and crisp with a slice of lime. The quintessential Mexican beer.',
    sellingPrice: 4.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 148,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    availabilityCount: 140,
    allergies: ['Gluten'],
    allergyIngredients: { Gluten: ['beer'] },
    autoDetectAllergies: true,
    sustainabilityScore: 55,
    carbonFootprint: 'Medium',
    ingredients: [
      { inventoryItemId: 'inv_corona', quantity: 1, unit: 'pcs', baseQuantity: 1, costAtCreation: 85 },
      { inventoryItemId: 'inv_lime',   quantity: 1, unit: 'pcs', baseQuantity: 1, costAtCreation: 25 },
    ],
    allowedModifiers: [],
    trainingSteps: [
      { title: 'Allergen', description: 'WARNING: Contains GLUTEN. Not suitable for coeliac customers or those with gluten intolerance.' },
      { title: 'Serve', description: 'Always serve ice cold with a lime wedge inserted into the neck of the bottle. Do not pre-open bottles - open at the table or bar where possible.' },
    ],
  },

  {
    id: 'recipe_modelo',
    name: 'Modelo Especial',
    type: 'menu_item',
    category: 'Beer & Cider',
    menuPath: 'Drinks > Beer',
    description: 'Full-flavoured Mexican lager with a hint of orange blossom honey and malt. Richer than Corona.',
    sellingPrice: 4.75,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 152,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: ['Gluten'],
    allergyIngredients: { Gluten: ['beer'] },
    autoDetectAllergies: true,
    sustainabilityScore: 55,
    carbonFootprint: 'Medium',
    ingredients: [
      { inventoryItemId: 'inv_modelo', quantity: 1, unit: 'pcs', baseQuantity: 1, costAtCreation: 90 },
    ],
    allowedModifiers: [],
    trainingSteps: [
      { title: 'Allergen', description: 'WARNING: Contains GLUTEN.' },
      { title: 'Upsell', description: 'Modelo is a step up from Corona in flavour. If a customer is deciding between the two, suggest Modelo for something with a bit more character.' },
    ],
  },

  // -- SOFT DRINKS ----------------------------------------------------------

  {
    id: 'recipe_mexican_cola',
    name: 'Mexican Coca-Cola',
    type: 'menu_item',
    category: 'Soft Drinks',
    menuPath: 'Drinks > Soft Drinks',
    description: 'The original Coca-Cola recipe made with cane sugar instead of corn syrup. Glass bottle. A noticeably different taste - smoother and more complex.',
    sellingPrice: 3.50,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 150,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 50,
    carbonFootprint: 'Medium',
    ingredients: [
      { inventoryItemId: 'inv_mexican_cola', quantity: 1, unit: 'pcs', baseQuantity: 1, costAtCreation: 95 },
    ],
    allowedModifiers: [],
    trainingSteps: [
      { title: 'Story', description: 'Mexican Coke is made with pure cane sugar, unlike regular Coke which uses high-fructose corn syrup. Many guests notice and prefer the taste. Mention this when recommending.' },
      { title: 'Serve', description: 'Serve in the glass bottle with a straw. This is part of the aesthetic - never pour into a cup.' },
    ],
  },

  {
    id: 'recipe_agua_jamaica',
    name: 'Agua de Jamaica',
    type: 'menu_item',
    category: 'Soft Drinks',
    menuPath: 'Drinks > Soft Drinks',
    description: 'House-made hibiscus agua fresca. Sweet, tart and deeply refreshing. Non-alcoholic. Perfect with any dish.',
    sellingPrice: 3.25,
    vatRate: 20, vatCode: 'STANDARD_20',
    serviceChargeRate: 12.5,
    calories: 85,
    station: 'Beverage',
    course: 'Drinks',
    isActive: true,
    trackAvailability: true,
    allergies: [],
    allergyIngredients: {},
    autoDetectAllergies: true,
    sustainabilityScore: 95,
    carbonFootprint: 'Low',
    sustainabilityTips: ['Hibiscus flowers sourced from ethical suppliers in Mexico', 'Zero waste - dried flowers composted after brewing'],
    ingredients: [
      { inventoryItemId: 'inv_hibiscus_syrup',   quantity: 40,  unit: 'ml', baseQuantity: 40,  costAtCreation: 0.014 },
      { inventoryItemId: 'inv_lime_juice',        quantity: 15,  unit: 'ml', baseQuantity: 15,  costAtCreation: 0.008 },
      { inventoryItemId: 'inv_agave_syrup',       quantity: 10,  unit: 'ml', baseQuantity: 10,  costAtCreation: 0.012 },
      { inventoryItemId: 'inv_agua_fresca_base',  quantity: 200, unit: 'ml', baseQuantity: 200, costAtCreation: 0.003 },
    ],
    allowedModifiers: [],
    trainingSteps: [
      { title: 'What is it', description: 'Jamaica (ha-MY-kah) is hibiscus water - a traditional Mexican soft drink. Deep red colour, similar to elderflower in concept but tart and refreshing. Completely non-alcoholic.' },
      { title: 'Perfect pairing', description: 'Works with everything on the menu. Especially good with spicy dishes as the tartness cools the palate. Recommend to guests who do not drink alcohol or want something different.' },
    ],
  },
];

// -----------------------------------------------------------------------------
// 5. WRITE TO FIRESTORE
// -----------------------------------------------------------------------------
const seed = async () => {
  console.log('\n MESTIZO BACKBONE SEED SCRIPT\n');
  console.log(`Target database: ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403`);
  console.log(`Location: ${LOCATION_ID}\n`);

  console.log('-- Inventory items --');
  for (const item of inventory) {
    await save('inventory', item.id, item);
  }

  console.log('\n-- Menu categories --');
  for (const cat of categories) {
    await save('menuCategories', cat.id, { ...cat, locationId: LOCATION_ID, lastUpdated: NOW });
  }

  console.log('\n-- Modifier groups --');
  for (const group of modifierGroups) {
    const { id, ...rest } = group;
    await save('modifierGroups', id, { ...rest, locationId: LOCATION_ID, lastUpdated: NOW });
  }

  console.log('\n-- Recipes / Menu items --');
  for (const recipe of recipes) {
    const { id, ...rest } = recipe;
    await save('recipes', id, { ...rest, locationId: LOCATION_ID, lastUpdated: NOW });
  }

  console.log(`\nDONE SEED COMPLETE`);
  console.log(`   ${inventory.length} inventory items`);
  console.log(`   ${categories.length} menu categories`);
  console.log(`   ${modifierGroups.length} modifier groups`);
  console.log(`   ${recipes.length} recipes / menu items`);
  console.log('\nRefresh Backbone HUB to see the data.\n');
  process.exit(0);
};

seed().catch(err => {
  console.error('\nFAILED Seed failed:', err.message);
  process.exit(1);
});
