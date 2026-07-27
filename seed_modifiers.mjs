/**
 * MESTIZO BACKBONE — MODIFIERS SEED
 * Writes flat individual modifiers to the 'modifiers' collection
 * which is what HUB's Modifier Management tab reads from.
 *
 * HOW TO USE:
 * 1. Temporarily open Firestore rules to allow read/write: if true
 * 2. node seed_modifiers.mjs
 * 3. Restore your real Firestore rules immediately after
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "REDACTED_FIREBASE_KEY",
  authDomain: "backbone-hub.firebaseapp.com",
  projectId: "backbone-hub",
  storageBucket: "backbone-hub.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "253712567445",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:253712567445:web:390e304a837a7aaaf95f9c",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, 'ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403');

const LOCATION_ID = 'loc_camden';
const NOW = new Date().toISOString();

// ── FLAT MODIFIERS ────────────────────────────────────────────────────────────
// HUB stores individual modifiers in the 'modifiers' collection.
// Each modifier has: name, price (in GBP), category, locationId
// Price = additional charge in pounds (0 = free, 1.50 = +£1.50)
// ─────────────────────────────────────────────────────────────────────────────
const modifiers = [

  // ── Taco Protein Options ─────────────────────────────────────────────────
  { id: 'mod_protein_asada',    name: 'Asada (Beef Skirt)',       price: 0,    category: 'Taco Protein',    inventoryItemId: 'inv_beef_asada' },
  { id: 'mod_protein_pastor',   name: 'Pastor (Pork)',            price: 0,    category: 'Taco Protein',    inventoryItemId: 'inv_pork_pastor' },
  { id: 'mod_protein_tinga',    name: 'Tinga (Chicken)',          price: 0,    category: 'Taco Protein',    inventoryItemId: 'inv_chicken_tinga' },
  { id: 'mod_protein_suadero',  name: 'Suadero (Brisket)',        price: 0,    category: 'Taco Protein',    inventoryItemId: 'inv_beef_suadero' },
  { id: 'mod_protein_veggie',   name: 'Veggie (Black Beans)',     price: -1.00, category: 'Taco Protein',   inventoryItemId: 'inv_black_beans' },

  // ── Taco Extras ───────────────────────────────────────────────────────────
  { id: 'mod_extra_guac',       name: 'Extra Guacamole',          price: 1.50, category: 'Taco Extras',     inventoryItemId: 'inv_guacamole_prep' },
  { id: 'mod_extra_cheese',     name: 'Extra Oaxaca Cheese',      price: 1.00, category: 'Taco Extras',     inventoryItemId: 'inv_cheese_oaxaca' },
  { id: 'mod_extra_crema',      name: 'Extra Crema',              price: 0.75, category: 'Taco Extras',     inventoryItemId: 'inv_sour_cream' },
  { id: 'mod_extra_salsa_roja', name: 'Extra Salsa Roja',         price: 0.50, category: 'Taco Extras',     inventoryItemId: 'inv_salsa_roja' },
  { id: 'mod_extra_salsa_verd', name: 'Extra Salsa Verde',        price: 0.50, category: 'Taco Extras',     inventoryItemId: 'inv_salsa_verde' },
  { id: 'mod_no_onion',         name: 'No Onion',                 price: 0,    category: 'Taco Extras',     inventoryItemId: '' },
  { id: 'mod_no_coriander',     name: 'No Coriander',             price: 0,    category: 'Taco Extras',     inventoryItemId: '' },
  { id: 'mod_make_spicy',       name: 'Make it Spicy',            price: 0,    category: 'Taco Extras',     inventoryItemId: 'inv_jalapeno' },

  // ── Enchilada Sauce ───────────────────────────────────────────────────────
  { id: 'mod_sauce_roja',       name: 'Sauce: Salsa Roja',        price: 0,    category: 'Enchilada Sauce', inventoryItemId: 'inv_salsa_roja' },
  { id: 'mod_sauce_verde',      name: 'Sauce: Salsa Verde',       price: 0,    category: 'Enchilada Sauce', inventoryItemId: 'inv_salsa_verde' },
  { id: 'mod_sauce_mole',       name: 'Sauce: Mole',              price: 0,    category: 'Enchilada Sauce', inventoryItemId: 'inv_mole_paste' },

  // ── Tequila Serve ─────────────────────────────────────────────────────────
  { id: 'mod_tequila_neat',     name: 'Serve: Neat',              price: 0,    category: 'Tequila Serve',   inventoryItemId: '' },
  { id: 'mod_tequila_rocks',    name: 'Serve: On the Rocks',      price: 0,    category: 'Tequila Serve',   inventoryItemId: '' },
  { id: 'mod_tequila_salt',     name: 'Serve: Salt and Lime',     price: 0,    category: 'Tequila Serve',   inventoryItemId: '' },

  // ── Cocktail Customise ────────────────────────────────────────────────────
  { id: 'mod_no_salt_rim',      name: 'No Salt Rim',              price: 0,    category: 'Cocktail',        inventoryItemId: '' },
  { id: 'mod_spicy_jalapeno',   name: 'Spicy (Jalapeno)',         price: 0.50, category: 'Cocktail',        inventoryItemId: 'inv_jalapeno' },
  { id: 'mod_double_spirit',    name: 'Double Spirit',            price: 3.50, category: 'Cocktail',        inventoryItemId: '' },
  { id: 'mod_no_ice',           name: 'No Ice',                   price: 0,    category: 'Cocktail',        inventoryItemId: '' },

  // ── Side Options ──────────────────────────────────────────────────────────
  { id: 'mod_side_rice',        name: 'Side: Mexican Rice',       price: 3.00, category: 'Sides',           inventoryItemId: 'inv_rice' },
  { id: 'mod_side_beans',       name: 'Side: Black Beans',        price: 2.50, category: 'Sides',           inventoryItemId: 'inv_black_beans' },
  { id: 'mod_side_salad',       name: 'Side: House Salad',        price: 3.50, category: 'Sides',           inventoryItemId: '' },
  { id: 'mod_side_chips',       name: 'Side: Tortilla Chips',     price: 2.00, category: 'Sides',           inventoryItemId: '' },
  { id: 'mod_side_guac',        name: 'Side: Guacamole Portion',  price: 4.00, category: 'Sides',           inventoryItemId: 'inv_guacamole_prep' },

  // ── Steak Cook Preference ─────────────────────────────────────────────────
  { id: 'mod_steak_rare',       name: 'Cook: Rare',               price: 0,    category: 'Steak',           inventoryItemId: '' },
  { id: 'mod_steak_med_rare',   name: 'Cook: Medium Rare',        price: 0,    category: 'Steak',           inventoryItemId: '' },
  { id: 'mod_steak_medium',     name: 'Cook: Medium',             price: 0,    category: 'Steak',           inventoryItemId: '' },
  { id: 'mod_steak_well',       name: 'Cook: Well Done',          price: 0,    category: 'Steak',           inventoryItemId: '' },

  // ── Beer & Drinks ─────────────────────────────────────────────────────────
  { id: 'mod_beer_lime',        name: 'With Lime Wedge',          price: 0,    category: 'Beer',            inventoryItemId: 'inv_lime' },
  { id: 'mod_beer_no_lime',     name: 'No Lime',                  price: 0,    category: 'Beer',            inventoryItemId: '' },
];

// ── Write to Firestore ────────────────────────────────────────────────────────
const seed = async () => {
  console.log('\nMESTIZO — MODIFIERS SEED\n');
  console.log('Writing', modifiers.length, 'modifiers to modifiers collection...\n');

  for (const mod of modifiers) {
    const { id, ...data } = mod;
    await setDoc(doc(db, 'modifiers', id), {
      ...data,
      locationId: LOCATION_ID,
      lastUpdated: NOW,
    });
    console.log('+ modifier/' + id + ' (' + mod.name + ')');
  }

  console.log('\nDONE - ' + modifiers.length + ' modifiers written.');
  console.log('Refresh HUB Menu Recipes -> Modifiers tab to see them.\n');
  process.exit(0);
};

seed().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
