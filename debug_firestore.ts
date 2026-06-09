
import { db } from './firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function debugData() {
  console.log("Checking last 5 posPayments...");
  const q = query(collection(db, 'posPayments'), limit(5));
  const snap = await getDocs(q);
  console.log("Found posPayments count (unfiltered):", snap.size);
  snap.forEach(doc => {
    console.log("Doc ID:", doc.id, "Data:", JSON.stringify(doc.data(), null, 2));
  });

  console.log("Checking last 5 posOrders...");
  const q2 = query(collection(db, 'posOrders'), limit(5));
  const snap2 = await getDocs(q2);
  console.log("Found posOrders count (unfiltered):", snap2.size);
  snap2.forEach(doc => {
    console.log("Doc ID:", doc.id, "Data:", JSON.stringify(doc.data(), null, 2));
  });
}

debugData();
