/**
 * MESTIZO CHELSEA — CATEGORY SEED
 * Single source of truth for HUB + POS categories
 * Run: node seed_categories.mjs
 * Requires open Firestore rules first
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDocs, collection, deleteDoc, query, where } from 'firebase/firestore';

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
const LOC = 'loc_camden';
const NOW = new Date().toISOString();

const categories = [
  // ── FOOD ──────────────────────────────────────────────────────────────────
  { id:'cat_starters',     name:'Starters',        parentId:null,           order:10,  isDrink:false, allowSubcategories:true  },
  { id:'cat_tacos',        name:'Tacos',            parentId:null,           order:20,  isDrink:false, allowSubcategories:true  },
  { id:'cat_mains',        name:'Mains',            parentId:null,           order:30,  isDrink:false, allowSubcategories:true  },
  { id:'cat_desserts',     name:'Desserts',         parentId:null,           order:40,  isDrink:false, allowSubcategories:true  },
  { id:'cat_extras',       name:'Extras',           parentId:null,           order:50,  isDrink:false, allowSubcategories:true  },
  { id:'cat_sides',        name:'Sides',            parentId:null,           order:61,  isDrink:false, allowSubcategories:false },
  { id:'cat_addons',       name:'Add-ons',          parentId:null,           order:62,  isDrink:false, allowSubcategories:false },

  // ── DRINKS (parent) ───────────────────────────────────────────────────────
  { id:'cat_drinks',       name:'Drinks',           parentId:null,           order:60,  isDrink:true,  allowSubcategories:true  },

  // ── MARGARITAS ────────────────────────────────────────────────────────────
  { id:'cat_margaritas',   name:'Margaritas',       parentId:'cat_drinks',   order:61,  isDrink:true,  allowSubcategories:false },

  // ── COCKTAILS ─────────────────────────────────────────────────────────────
  { id:'cat_cocktails',    name:'Cocktails',        parentId:'cat_drinks',   order:62,  isDrink:true,  allowSubcategories:false },

  // ── MOCKTAILS ─────────────────────────────────────────────────────────────
  { id:'cat_mocktails',    name:'Mocktails',        parentId:'cat_drinks',   order:63,  isDrink:true,  allowSubcategories:false },

  // ── BEERS ─────────────────────────────────────────────────────────────────
  { id:'cat_beers',        name:'Beers',            parentId:'cat_drinks',   order:64,  isDrink:true,  allowSubcategories:false },

  // ── WINES ─────────────────────────────────────────────────────────────────
  { id:'cat_wines',        name:'Wines',            parentId:'cat_drinks',   order:65,  isDrink:true,  allowSubcategories:true  },
  { id:'cat_wine_white',   name:'White',            parentId:'cat_wines',    order:651, isDrink:true,  allowSubcategories:false },
  { id:'cat_wine_red',     name:'Red',              parentId:'cat_wines',    order:652, isDrink:true,  allowSubcategories:false },
  { id:'cat_wine_rose',    name:'Rosé',             parentId:'cat_wines',    order:653, isDrink:true,  allowSubcategories:false },
  { id:'cat_wine_sparkling',name:'Sparkling',       parentId:'cat_wines',    order:654, isDrink:true,  allowSubcategories:false },

  // ── SPIRITS ───────────────────────────────────────────────────────────────
  { id:'cat_spirits',      name:'Spirits',          parentId:'cat_drinks',   order:66,  isDrink:true,  allowSubcategories:true  },
  { id:'cat_tequila',      name:'Tequila',          parentId:'cat_spirits',  order:661, isDrink:true,  allowSubcategories:false },
  { id:'cat_mezcal',       name:'Mezcal',           parentId:'cat_spirits',  order:662, isDrink:true,  allowSubcategories:false },
  { id:'cat_rum',          name:'Rum',              parentId:'cat_spirits',  order:663, isDrink:true,  allowSubcategories:false },
  { id:'cat_vodka',        name:'Vodka',            parentId:'cat_spirits',  order:664, isDrink:true,  allowSubcategories:false },
  { id:'cat_whiskey',      name:'Whiskey',          parentId:'cat_spirits',  order:665, isDrink:true,  allowSubcategories:false },
  { id:'cat_gin',          name:'Gin',              parentId:'cat_spirits',  order:666, isDrink:true,  allowSubcategories:false },
  { id:'cat_brandy',       name:'Brandy',           parentId:'cat_spirits',  order:667, isDrink:true,  allowSubcategories:false },
  { id:'cat_cognac',       name:'Cognac',           parentId:'cat_spirits',  order:668, isDrink:true,  allowSubcategories:false },
  { id:'cat_liqueur',      name:'Liqueur',          parentId:'cat_spirits',  order:669, isDrink:true,  allowSubcategories:false },

  // ── SOFT DRINKS ───────────────────────────────────────────────────────────
  { id:'cat_soft_drinks',  name:'Soft Drinks',      parentId:'cat_drinks',   order:67,  isDrink:true,  allowSubcategories:true  },
  { id:'cat_juices',       name:'Juices',           parentId:'cat_soft_drinks', order:671, isDrink:true, allowSubcategories:false },
  { id:'cat_jarritos',     name:'Jarritos',         parentId:'cat_soft_drinks', order:672, isDrink:true, allowSubcategories:false },
  { id:'cat_aguas_frescas',name:'Aguas Frescas',    parentId:'cat_soft_drinks', order:673, isDrink:true, allowSubcategories:false },
  { id:'cat_water',        name:'Water',            parentId:'cat_soft_drinks', order:674, isDrink:true, allowSubcategories:false },
  { id:'cat_sodas',        name:'Sodas',            parentId:'cat_soft_drinks', order:675, isDrink:true, allowSubcategories:false },

  // ── MIXERS ────────────────────────────────────────────────────────────────
  { id:'cat_mixers',       name:'Mixers',           parentId:'cat_drinks',   order:68,  isDrink:true,  allowSubcategories:true  },

  // ── HOT DRINKS ────────────────────────────────────────────────────────────
  { id:'cat_hot_drinks',   name:'Hot Drinks',       parentId:'cat_drinks',   order:69,  isDrink:true,  allowSubcategories:true  },
];

const seed = async () => {
  console.log('\nMESTIZO CHELSEA — CATEGORY SEED\n');

  // 1. Delete all existing
  console.log('Deleting existing categories...');
  const existing = await getDocs(query(collection(db, 'menuCategories'), where('locationId', '==', LOC)));
  for (const d of existing.docs) {
    await deleteDoc(doc(db, 'menuCategories', d.id));
    process.stdout.write('x');
  }
  console.log(`\nDeleted ${existing.docs.length} existing categories`);

  // 2. Write new - sorted by order so parents exist before children
  console.log('\nWriting new categories...');
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  for (const cat of sorted) {
    await setDoc(doc(db, 'menuCategories', cat.id), {
      ...cat,
      locationId: LOC,
      lastUpdated: NOW,
    });
    process.stdout.write('.');
  }

  console.log('\n\nCATEGORY SEED COMPLETE');
  console.log(`  ${categories.length} categories written\n`);

  // Print tree
  const roots = categories.filter(c => !c.parentId);
  roots.sort((a,b) => a.order - b.order);
  roots.forEach(r => {
    console.log(`  ${r.name}`);
    const l1 = categories.filter(c => c.parentId === r.id).sort((a,b) => a.order - b.order);
    l1.forEach(c1 => {
      console.log(`    └─ ${c1.name}`);
      const l2 = categories.filter(c => c.parentId === c1.id).sort((a,b) => a.order - b.order);
      l2.forEach(c2 => console.log(`       └─ ${c2.name}`));
    });
  });

  console.log('\nRestore your Firestore rules now.\n');
  process.exit(0);
};

seed().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
