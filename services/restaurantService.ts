import { db, collection, doc, getDocs, setDoc, query, where, addDoc, LOCATION_ID } from '../firebase';

export const initializeSystem = async () => {
  const collections = [
    'staffProfiles',
    'menuCategories',
    'menuItems',
    'tables',
    'posOrders',
    'posPayments',
    'kdsTickets',
    'barKdsTickets',
    'inventory',
    'recipes',
    'suppliers',
    'orders',
    'invoices',
    'stockCounts',
    'salesImports',
    'waste',
    'liabilities',
    'cashflow'
  ];

  for (const col of collections) {
    try {
      const colRef = collection(db, col);
      const snapshot = await getDocs(query(colRef, where('locationId', '==', LOCATION_ID)));
      
      const shouldSeed = snapshot.empty || (col === 'posOrders' && !snapshot.docs.some(d => {
        const data = d.data();
        if (!data.createdAt) return false;
        const dateStr = typeof data.createdAt === 'string' 
          ? data.createdAt 
          : (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString());
        return dateStr.startsWith(new Date().toISOString().split('T')[0]);
      }));

      if (shouldSeed) {
        await seedData(col);
      }
    } catch (error) {
      console.error(`Error initializing collection ${col}:`, error);
    }
  }
};

export const savePOSOrder = async (order: any) => {
  const orderRef = doc(db, 'posOrders', order.id);
  await setDoc(orderRef, { ...order, locationId: LOCATION_ID });
};

export const createKDSTicket = async (ticket: any, isBarTicket: boolean) => {
  const collectionName = isBarTicket ? 'barKdsTickets' : 'kdsTickets';
  await addDoc(collection(db, collectionName), { ...ticket, locationId: LOCATION_ID });
};

export const fetchPOSOrders = async () => {
  const q = query(collection(db, 'posOrders'), where('locationId', '==', LOCATION_ID));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const fetchMenuItems = async () => {
  const q = query(collection(db, 'menuItems'), where('locationId', '==', LOCATION_ID));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const seedData = async (collectionName: string) => {
  console.log(`Seeding ${collectionName}...`);
  
  switch (collectionName) {
    case 'staffProfiles':
      await setDoc(doc(db, 'staffProfiles', 'staff-1'), {
        name: 'Test Waiter',
        pin: '1234',
        role: 'waiter',
        locationId: LOCATION_ID,
        active: true
      });
      break;
    case 'menuCategories':
      await setDoc(doc(db, 'menuCategories', 'cat-mains'), { name: 'Mains', locationId: LOCATION_ID });
      await setDoc(doc(db, 'menuCategories', 'cat-starters'), { name: 'Starters', locationId: LOCATION_ID });
      await setDoc(doc(db, 'menuCategories', 'cat-tacos'), { name: 'Tacos', locationId: LOCATION_ID });
      await setDoc(doc(db, 'menuCategories', 'cat-drinks'), { name: 'Drinks', locationId: LOCATION_ID });
      await setDoc(doc(db, 'menuCategories', 'cat-desserts'), { name: 'Desserts', locationId: LOCATION_ID });
      break;
    case 'menuItems':
      const items = [
        { name: 'Mole Poblano', category: 'Mains', priceGross: 2100, description: 'Traditional mole with chicken.' },
        { name: 'Enchiladas', category: 'Mains', priceGross: 1560, description: 'Cheese filled corn tortillas.' },
        { name: 'Enchiladas Verdes', category: 'Mains', priceGross: 1600, description: 'Tangy green salsa enchiladas.' },
        { name: 'Sushi Bowls', category: 'Fusion', priceGross: 1900, description: 'Fresh salmon with avocado.' },
        { name: 'Tacos de Asada', category: 'Tacos', priceGross: 2500, description: 'Grilled steak tacos.' },
        { name: 'Tacos de Pastor', category: 'Tacos', priceGross: 1700, description: 'Marinated pork with pineapple.' },
        { name: 'Tacos de Suadero', category: 'Tacos', priceGross: 1900, description: 'Beef brisket tacos.' },
        { name: 'Tacos de Pierna', category: 'Tacos', priceGross: 1200, description: 'Roasted pork leg tacos.' },
        { name: 'Mojito Fresa', category: 'Drinks', priceGross: 1900, description: 'Strawberry mojito.' }
      ];
      for (const item of items) {
        const id = item.name.toLowerCase().replace(/\s+/g, '-');
        await setDoc(doc(db, 'menuItems', id), { 
          ...item, 
          locationId: LOCATION_ID,
          id: id 
        });
      }
      break;
    case 'tables':
      ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].forEach(async (tableNumber) => {
        await setDoc(doc(db, 'tables', `table-${tableNumber}`), { tableNumber, locationId: LOCATION_ID });
      });
      break;
    case 'posOrders':
      const menuSnap = await getDocs(query(collection(db, 'menuItems'), where('locationId', '==', LOCATION_ID)));
      const menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      if (menuItems.length > 0) {
        for (let i = 0; i < 40; i++) { // Generate 40 sample orders
          const item = menuItems[Math.floor(Math.random() * menuItems.length)];
          const qty = Math.floor(Math.random() * 6) + 1;
          const orderId = `order-${Date.now()}-${i}`;
          const itemPrice = (item.priceGross || 1500) / 100;
          const subtotal = itemPrice * qty;
          const serviceCharge = subtotal * 0.125; // 12.5% service charge
          const vat = subtotal - (subtotal / 1.2); // 20% VAT included

          await setDoc(doc(db, 'posOrders', orderId), {
            id: orderId,
            status: 'Paid',
            type: 'Dine-In',
            items: [{
              id: `${orderId}-1`,
              itemId: item.id,
              recipeId: item.recipeId || item.id,
              name: item.name,
              price: itemPrice,
              quantity: qty,
              status: 'Served'
            }],
            total: subtotal + serviceCharge,
            vat: vat,
            serviceCharge: serviceCharge,
            locationId: LOCATION_ID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Seed corresponding payment to posPayments to ensure Hub aggregates current sales fully
          const paymentId = `pay-seed-${orderId}`;
          await setDoc(doc(db, 'posPayments', paymentId), {
            id: paymentId,
            orderId: orderId,
            locationId: LOCATION_ID,
            amount: subtotal + serviceCharge,
            method: 'Card',
            timestamp: new Date().toISOString(),
            performanceProcessed: false
          });
        }
      }
      break;
    case 'liabilities':
      const sampleLiabilities = [
        { key: 'monthly-rent', name: 'Monthly Rent', amount: 4500, dueDate: '2026-05-15', type: 'Rent', status: 'Pending' },
        { key: 'electricity-bill', name: 'Electricity Bill', amount: 800, dueDate: '2026-05-10', type: 'Utility', status: 'Pending' },
        { key: 'supplier-fresh-veg', name: 'Supplier Payment: Fresh Veg', amount: 1200, dueDate: '2026-05-08', type: 'Supplier', status: 'Pending' },
        { key: 'staff-insurance', name: 'Staff Insurance', amount: 600, dueDate: '2026-05-25', type: 'Insurance', status: 'Pending' }
      ];
      for (const { key, ...l } of sampleLiabilities) {
        // Deterministic ID (not Date.now()/Math.random()) so re-running this seed — e.g. two
        // overlapping calls racing past the `snapshot.empty` check before either write lands —
        // overwrites the same document instead of creating a duplicate.
        const id = `lib-seed-${LOCATION_ID}-${key}`;
        await setDoc(doc(db, 'liabilities', id), {
          ...l,
          id,
          locationId: LOCATION_ID,
          createdAt: new Date().toISOString()
        });
      }
      break;
    case 'posPayments':
      // Seeding for posPayments is handled inside 'posOrders' to keep orders and payments paired
      break;
    case 'cashflow':
      const nowTs = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(nowTs);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const id = `cf-${dateStr}`;
        await setDoc(doc(db, 'cashflow', id), {
          id,
          date: dateStr,
          locationId: LOCATION_ID,
          cashIn: 3000 + Math.random() * 1000,
          cashOut: 1500 + Math.random() * 500,
          netFlow: 1500,
          balance: 25000 + (i * 1000),
          liabilitiesDue: Math.random() * 2000,
          safeCash: 12000 + Math.random() * 5000,
          updatedAt: nowTs.toISOString()
        });
      }
      break;
  }
};
