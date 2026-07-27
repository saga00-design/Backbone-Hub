/**
 * MESTIZO SEED RUNNER
 * 1. Paste your data into seed_data.json (next message)
 * 2. Fill in your Firebase config below
 * 3. Open Firestore rules: allow read, write: if true;
 * 4. Run: node seed_runner.mjs
 * 5. Restore Firestore rules immediately after
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = {
  apiKey: "REDACTED_FIREBASE_KEY",
  authDomain: "backbone-hub.firebaseapp.com",
  projectId: "backbone-hub",
  storageBucket: "backbone-hub.appspot.com",
  messagingSenderId: "253712567445",
  appId: "1:253712567445:web:390e304a837a7aaaf95f9c",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, 'ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403');
const LOC = 'loc_camden';
const NOW = new Date().toISOString();

const save = async (col, id, data) => {
  await setDoc(doc(db, col, id), { ...data, locationId: LOC, lastUpdated: NOW });
  process.stdout.write('.');
};

const { inventory, recipes } = JSON.parse(readFileSync('./seed_data.json', 'utf8'));

const seed = async () => {
  console.log('\nMESTIZO CHELSEA — SEED RUNNER');
  console.log(`Inventory: ${inventory.length} items | Recipes: ${recipes.length} items\n`);

  process.stdout.write('Writing inventory ');
  for (const item of inventory) {
    const { id, ...data } = item;
    await save('inventory', id, data);
  }

  process.stdout.write('\nWriting recipes ');
  for (const recipe of recipes) {
    const { id, ...data } = recipe;
    await save('recipes', id, data);
  }

  console.log('\n\nDONE. Restore your Firestore rules now.\n');
  process.exit(0);
};

seed().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});