
import { BriefingItem, ShiftTarget, ShiftChallenge, StaffShiftPerformance, POSOrderItem, Recipe, ChallengeType } from '../types';
import { db, collection, doc, getDoc, setDoc, updateDoc, increment, query, where, getDocs, LOCATION_ID, cleanObject } from '../firebase';

export async function updateStaffPerformance(staffId: string | undefined, staffName: string, items: POSOrderItem[], recipeList: Recipe[]) {
  if (!staffId) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const currentShift = hour < 16 ? 'Lunch' : 'Dinner';
    const perfId = `${staffId}-${today}-${currentShift}`;
    
    // 1. Get/Create Performance Record
    const perfRef = doc(db, 'staffShiftPerformance', perfId);
    const perfSnap = await getDoc(perfRef);
    
    let currentPoints = 0;
    if (perfSnap.exists()) {
      currentPoints = perfSnap.data().points || 0;
    } else {
      await setDoc(perfRef, {
        id: perfId,
        locationId: LOCATION_ID,
        staffId,
        staffName,
        shiftDate: today,
        shift: currentShift,
        points: 0,
        salesCount: 0,
        totalRevenue: 0,
        upsellCount: 0,
        rank: 0,
        lastUpdated: new Date().toISOString()
      });
    }

    // 2. Fetch Active Challenges to determine point logic
    const challengesQuery = query(
      collection(db, 'shiftChallenges'),
      where('locationId', '==', LOCATION_ID),
      where('isActive', '==', true)
    );
    const challengesSnap = await getDocs(challengesQuery);
    const activeChallenges = challengesSnap.docs.map(d => d.data() as ShiftChallenge);

    let pointsEarned = 0;
    let upsells = 0;
    let revenue = 0;

    // 3. Process Items for Points
    for (const item of items) {
      if (item.isVoided) continue;
      
      const recipe = recipeList.find(r => r.id === item.recipeId);
      revenue += (item.price * item.quantity);

      // Rule: Every item sale gives baseline points
      pointsEarned += item.quantity * 2; 

      // Rule: Challenge Logic
      for (const challenge of activeChallenges) {
        if (challenge.type === 'Product Push' && challenge.rules.targetItemIds?.includes(item.recipeId)) {
          pointsEarned += item.quantity * 20; // Big bonus for product push
        }
        
        if (challenge.type === ('Upsell Warrior' as ChallengeType) && (item.modifiers && item.modifiers.length > 0)) {
           pointsEarned += item.modifiers.length * 10;
           upsells += item.modifiers.length;
        }
      }
      
      // Bonus: High value items (above 20)
      if (item.price > 20) pointsEarned += 5;
    }

    // 4. Process Shift Targets Progress
    const targetsQuery = query(
      collection(db, 'shiftTargets'),
      where('locationId', '==', LOCATION_ID),
      where('status', '==', 'Active')
    );
    const targetsSnap = await getDocs(targetsQuery);
    
    for (const targetDoc of targetsSnap.docs) {
      const target = targetDoc.data() as ShiftTarget;
      
      if (target.type === 'Revenue') {
        await updateDoc(doc(db, 'shiftTargets', targetDoc.id), {
          currentValue: increment(revenue)
        });
      } else if (target.type === 'Item' && target.targetItemId) {
         const matchingItems = items.filter(i => i.recipeId === target.targetItemId && !i.isVoided);
         const count = matchingItems.reduce((acc, i) => acc + i.quantity, 0);
         if (count > 0) {
            await updateDoc(doc(db, 'shiftTargets', targetDoc.id), {
              currentValue: increment(count)
            });
         }
      }
    }

    // 5. Update itemsSold in Staff Performance & Overall Stats
    const itemsSoldUpdates: Record<string, any> = {};
    for (const item of items) {
      if (item.isVoided) continue;
      itemsSoldUpdates[`itemsSold.${item.recipeId}`] = increment(item.quantity);
    }

    await updateDoc(perfRef, {
      ...itemsSoldUpdates,
      points: increment(pointsEarned),
      totalRevenue: increment(revenue),
      salesCount: increment(items.reduce((acc, i) => acc + (i.isVoided ? 0 : i.quantity), 0)),
      upsellCount: increment(upsells),
      lastUpdated: new Date().toISOString()
    });

    // 6. Recalculate Ranks
    await recalculateRanks(today, currentShift);

  } catch (err) {
    console.error("Error updating staff performance:", err);
  }
}

async function recalculateRanks(date: string, shift: string) {
  const perfQuery = query(
    collection(db, 'staffShiftPerformance'),
    where('locationId', '==', LOCATION_ID),
    where('shiftDate', '==', date),
    where('shift', '==', shift)
  );
  
  const snap = await getDocs(perfQuery);
  const perfs = snap.docs.map(d => ({ id: d.id, points: d.data().points || 0 }));
  
  // Sort by points descending
  perfs.sort((a, b) => b.points - a.points);
  
  // Update ranks
  for (let i = 0; i < perfs.length; i++) {
    await updateDoc(doc(db, 'staffShiftPerformance', perfs[i].id), {
      rank: i + 1
    });
  }
}
