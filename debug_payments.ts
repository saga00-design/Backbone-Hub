
import { db, collection, getDocs, limit, query } from './firebase';

async function debugPayments() {
  const q = query(collection(db, 'posPayments'), limit(5));
  const snap = await getDocs(q);
  console.log("Found", snap.size, "payments");
  snap.forEach(doc => {
    console.log("Doc ID:", doc.id);
    console.log("Data:", JSON.stringify(doc.data(), null, 2));
  });
}

debugPayments().catch(console.error);
