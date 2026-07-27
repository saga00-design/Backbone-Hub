/**
 * MESTIZO CHELSEA — BATCH RECIPE SEED
 * Seeds standard prep/batch recipes into the 'recipes' collection
 * Run: node seed_batches.mjs
 * Requires open Firestore rules first
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "backbone-hub.firebaseapp.com",
  projectId: "backbone-hub",
  storageBucket: "backbone-hub.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, 'ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403');

// All costs NET of VAT. All weights in grams or ml. Prices in pence.
const batches = [
  {
    id: 'batch_mole_sauce',
    name: 'Mole Sauce Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 2000,
    yieldUnit: 'ml',
    totalBatchCost: 850,        // £8.50 NET
    pricePerUnit: 0.425,        // pence per ml
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'House mole negro sauce. Rich, complex, smoky.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_mexican_rice',
    name: 'Mexican Rice Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 3000,
    yieldUnit: 'g',
    totalBatchCost: 320,        // £3.20 NET
    pricePerUnit: 0.107,        // pence per g
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Tomato-based Mexican red rice.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_whole_black_beans',
    name: 'Whole Black Beans Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 2500,
    yieldUnit: 'g',
    totalBatchCost: 280,        // £2.80 NET
    pricePerUnit: 0.112,        // pence per g
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Slow cooked whole black beans with epazote.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_refried_beans',
    name: 'Refried Beans Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 2000,
    yieldUnit: 'g',
    totalBatchCost: 300,        // £3.00 NET
    pricePerUnit: 0.15,         // pence per g
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Smooth refried black beans with lard and garlic.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_chicken_broth',
    name: 'Chicken Broth Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 4000,
    yieldUnit: 'ml',
    totalBatchCost: 450,        // £4.50 NET
    pricePerUnit: 0.1125,       // pence per ml
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'House chicken broth for consomé and birria.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_guacamole',
    name: 'Guacamole Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 1500,
    yieldUnit: 'g',
    totalBatchCost: 600,        // £6.00 NET
    pricePerUnit: 0.4,          // pence per g
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Fresh guacamole with lime, coriander, white onion, serrano.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_pico_de_gallo',
    name: 'Pico de Gallo Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 2000,
    yieldUnit: 'g',
    totalBatchCost: 250,        // £2.50 NET
    pricePerUnit: 0.125,        // pence per g
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Fresh tomato, white onion, coriander, lime, serrano salsa.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_chipotle_sauce',
    name: 'Chipotle Sauce Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 1500,
    yieldUnit: 'ml',
    totalBatchCost: 380,        // £3.80 NET
    pricePerUnit: 0.253,        // pence per ml
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Smoky chipotle in adobo blended sauce.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_tomatillo_sauce',
    name: 'Tomatillo Sauce Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 1500,
    yieldUnit: 'ml',
    totalBatchCost: 320,        // £3.20 NET
    pricePerUnit: 0.213,        // pence per ml
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'Roasted tomatillo and serrano salsa verde.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'batch_chipotle_mayo',
    name: 'Chipotle Mayo Batch',
    type: 'recipe',
    category: 'prep',
    yieldAmount: 1000,
    yieldUnit: 'ml',
    totalBatchCost: 280,        // £2.80 NET
    pricePerUnit: 0.28,         // pence per ml
    sellingPrice: 0,
    vatRate: 20,
    station: 'kitchen',
    description: 'House chipotle mayo for tacos and sides.',
    ingredients: [],
    sides: [],
    addons: [],
    locationId: 'loc_camden',
    isActive: true,
    lastUpdated: new Date().toISOString()
  }
];

const seed = async () => {
  console.log('\nMESTIZO CHELSEA — BATCH RECIPE SEED\n');
  console.log(`Writing ${batches.length} batch recipes...`);

  for (const batch of batches) {
    // doc.id (below) is the only identifier — don't also store id inside the document body
    const { id, ...data } = batch;
    await setDoc(doc(db, 'recipes', id), data);
    process.stdout.write('.');
  }

  console.log(`\n\nBATCH SEED COMPLETE — ${batches.length} recipes written\n`);
  console.log('Restore your Firestore rules now.\n');
  process.exit(0);
};

seed().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
