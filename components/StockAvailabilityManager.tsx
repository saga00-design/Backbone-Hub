import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, XCircle, CheckCircle2, Search, RefreshCw, Minus, Plus, Bell, ChefHat, Utensils } from 'lucide-react';
import {
  db,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  LOCATION_ID,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { toast } from 'sonner';
import { Recipe, UnavailableItem, UnavailableStatus } from '../types';

interface StockAvailabilityManagerProps {
  recipes: Recipe[];
  checkPermission: (module: string, action: string) => boolean;
}

const STATUS_CONFIG: Record<UnavailableStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'Active': {
    label: 'Available',
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  'Low Stock': {
    label: 'Low Stock',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  'Unavailable (86)': {
    label: "86'd",
    color: 'text-error',
    bg: 'bg-error/10 border-error/20',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const LOW_STOCK_THRESHOLD = 5;

export const StockAvailabilityManager: React.FC<StockAvailabilityManagerProps> = ({ recipes, checkPermission }) => {
  const [unavailableItems, setUnavailableItems] = useState<UnavailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | UnavailableStatus>('All');
  const [savingId, setSavingId] = useState<string | null>(null);
  const isManager = checkPermission('inventory', 'edit');

  // Live listener on unavailableItems collection
  useEffect(() => {
    const q = query(
      collection(db, 'unavailableItems'),
      where('locationId', '==', LOCATION_ID)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUnavailableItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UnavailableItem)));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'unavailableItems');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Build a unified list: every recipe merged with its unavailableItem doc (if any)
  const menuItems = useMemo(() => {
    const activeRecipes = recipes.filter(
      (r) => r.isActive !== false && (r.type === 'menu_item' || !r.type)
    );
    return activeRecipes.map((recipe) => {
      const unavail = unavailableItems.find((u) => u.menuItemId === recipe.id);
      return { recipe, unavail };
    });
  }, [recipes, unavailableItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter(({ recipe, unavail }) => {
      const status: UnavailableStatus = unavail?.status ?? 'Active';
      if (filterStatus !== 'All' && status !== filterStatus) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        return recipe.name.toLowerCase().includes(s) || (recipe.category || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [menuItems, filterStatus, searchTerm]);

  const stats = useMemo(() => ({
    active: menuItems.filter(({ unavail }) => !unavail || unavail.status === 'Active').length,
    lowStock: menuItems.filter(({ unavail }) => unavail?.status === 'Low Stock').length,
    eightySixed: menuItems.filter(({ unavail }) => unavail?.status === 'Unavailable (86)').length,
  }), [menuItems]);

  const getUnavailDoc = (recipeId: string) =>
    unavailableItems.find((u) => u.menuItemId === recipeId);

  const deriveStatus = (qty: number): UnavailableStatus => {
    if (qty <= 0) return 'Unavailable (86)';
    if (qty <= LOW_STOCK_THRESHOLD) return 'Low Stock';
    return 'Active';
  };

  const setStatus = async (recipe: Recipe, newStatus: UnavailableStatus, qty?: number) => {
    setSavingId(recipe.id);
    try {
      const existing = getUnavailDoc(recipe.id);
      const now = new Date().toISOString();

      if (newStatus === 'Active' && !existing) {
        setSavingId(null);
        return; // Nothing to do — no doc means already available
      }

      if (newStatus === 'Active' && existing) {
        await deleteDoc(doc(db, 'unavailableItems', existing.id));
        toast.success(`${recipe.name} marked as available.`);
      } else {
        const payload: Omit<UnavailableItem, 'id'> = {
          menuItemId: recipe.id,
          name: recipe.name,
          status: newStatus,
          quantityRemaining: qty ?? (newStatus === 'Unavailable (86)' ? 0 : LOW_STOCK_THRESHOLD),
          locationId: LOCATION_ID,
          updatedAt: now,
        };
        if (existing) {
          await updateDoc(doc(db, 'unavailableItems', existing.id), payload);
        } else {
          await addDoc(collection(db, 'unavailableItems'), payload);
        }

        if (newStatus === 'Unavailable (86)') {
          toast.error(`${recipe.name} has been 86'd.`);
          await pushToActiveBriefing(recipe.name);
        } else if (newStatus === 'Low Stock') {
          toast.warning(`${recipe.name} marked as low stock.`);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'unavailableItems');
      toast.error('Failed to update availability.');
    } finally {
      setSavingId(null);
    }
  };

  const adjustCount = async (recipe: Recipe, delta: number) => {
    const existing = getUnavailDoc(recipe.id);
    const currentQty = existing?.quantityRemaining ?? 10;
    const newQty = Math.max(0, currentQty + delta);
    const newStatus = deriveStatus(newQty);
    await setStatus(recipe, newStatus, newQty);
  };

  const pushToActiveBriefing = async (itemName: string) => {
    try {
      // ShiftBriefingManager guarantees at most one note has isActiveOnPOS: true at a time
      // (it deactivates all others in the same batch that sets this one), so no orderBy is
      // needed here — and skipping it avoids requiring a composite index for a field
      // ('createdAt') that shiftBriefings documents don't even have.
      const snap = await getDocs(
        query(
          collection(db, 'shiftBriefings'),
          where('locationId', '==', LOCATION_ID),
          where('isActiveOnPOS', '==', true)
        )
      );
      if (snap.empty) return;
      const briefingDoc = snap.docs[0];
      const existing86s: string[] = briefingDoc.data().items86 || [];
      if (!existing86s.includes(itemName)) {
        await updateDoc(doc(db, 'shiftBriefings', briefingDoc.id), {
          items86: [...existing86s, itemName],
        });
        toast.info(`Added "${itemName}" to today's active briefing 86 list.`);
      }
    } catch (err) {
      // Non-critical — don't block the main 86 action if this fails, but log it so a
      // real failure here is visible instead of silently vanishing.
      console.error('Failed to push 86 item to active briefing:', err);
    }
  };

  const markAllAvailable = async () => {
    if (!isManager) return;
    try {
      const batch = unavailableItems.filter((u) => u.locationId === LOCATION_ID);
      await Promise.all(batch.map((u) => deleteDoc(doc(db, 'unavailableItems', u.id))));
      toast.success('All items marked as available.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'unavailableItems');
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Available', value: stats.active, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Low Stock', value: stats.lowStock, color: 'text-warning', bg: 'bg-warning/10' },
          { label: "86'd", value: stats.eightySixed, color: 'text-error', bg: 'bg-error/10' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-white/5`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-50 dark:bg-slate-800 rounded-xl p-1 border border-gray-200 dark:border-slate-700">
            {(['All', 'Active', 'Low Stock', 'Unavailable (86)'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterStatus(opt)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  filterStatus === opt
                    ? 'bg-white dark:bg-slate-900 text-accent shadow-sm'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                {opt === 'Unavailable (86)' ? "86'd" : opt}
              </button>
            ))}
          </div>
          {isManager && stats.eightySixed > 0 && (
            <button
              onClick={markAllAvailable}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset All
            </button>
          )}
        </div>
      </div>

      {/* Item List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading menu items...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
          <Utensils className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No items match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredItems.map(({ recipe, unavail }) => {
              const status: UnavailableStatus = unavail?.status ?? 'Active';
              const qty = unavail?.quantityRemaining ?? null;
              const cfg = STATUS_CONFIG[status];
              const isSaving = savingId === recipe.id;

              return (
                <motion.div
                  key={recipe.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    status === 'Unavailable (86)'
                      ? 'border-error/30 opacity-70'
                      : status === 'Low Stock'
                      ? 'border-warning/30'
                      : 'border-gray-100 dark:border-slate-800'
                  }`}
                >
                  {/* Left: item info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.name} className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <ChefHat className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-text-navy dark:text-white truncate">{recipe.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-gray-400 uppercase tracking-widest">{recipe.category}</span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${cfg.color} ${cfg.bg}`}>
                          {cfg.icon} {cfg.label}
                          {qty !== null && status !== 'Active' && ` · ${qty} left`}
                        </span>
                        {status === 'Low Stock' && qty !== null && (
                          <span className="flex items-center gap-1 text-[9px] text-warning font-bold">
                            <Bell className="h-3 w-3" /> Low stock alert active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: controls */}
                  {isManager && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Quantity counter — shown when tracking count */}
                      {status !== 'Active' && qty !== null && (
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-1">
                          <button
                            onClick={() => adjustCount(recipe, -1)}
                            disabled={isSaving}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white dark:hover:bg-slate-700 transition-all disabled:opacity-40"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-sm font-black text-text-navy dark:text-white w-8 text-center">{qty}</span>
                          <button
                            onClick={() => adjustCount(recipe, +1)}
                            disabled={isSaving}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white dark:hover:bg-slate-700 transition-all disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Status quick-set buttons */}
                      <div className="flex items-center gap-1">
                        {status !== 'Active' && (
                          <button
                            onClick={() => setStatus(recipe, 'Active')}
                            disabled={isSaving}
                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-success bg-success/10 hover:bg-success/20 transition-all disabled:opacity-40"
                          >
                            {isSaving ? '...' : 'Available'}
                          </button>
                        )}
                        {status !== 'Low Stock' && (
                          <button
                            onClick={() => setStatus(recipe, 'Low Stock', LOW_STOCK_THRESHOLD)}
                            disabled={isSaving}
                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-warning bg-warning/10 hover:bg-warning/20 transition-all disabled:opacity-40"
                          >
                            {isSaving ? '...' : 'Low Stock'}
                          </button>
                        )}
                        {status !== 'Unavailable (86)' && (
                          <button
                            onClick={() => setStatus(recipe, 'Unavailable (86)', 0)}
                            disabled={isSaving}
                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-error bg-error/10 hover:bg-error/20 transition-all disabled:opacity-40"
                          >
                            {isSaving ? '...' : '86 Item'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
