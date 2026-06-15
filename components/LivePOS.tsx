
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Table as TableIcon, 
  Users, 
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  Sparkles,
  Zap,
  Megaphone,
  Target
} from 'lucide-react';
import { POSOrder, POSOrderItem, Table, Recipe, InventoryItem, OrderStatus, OrderItemStatus, Station, Course, ShiftBriefingNote } from '../types';
import { db, auth, collection, doc, setDoc, handleFirestoreError, OperationType, cleanObject, LOCATION_ID, onSnapshot, query, where } from '../firebase';
import { toast } from 'sonner';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { OfflineBanner } from './OfflineBanner';
import { PaymentConfirmation } from './PaymentConfirmation';

interface LivePOSProps {
  table: Table;
  recipes: Recipe[];
  onClose: () => void;
  existingOrder?: POSOrder;
}

export const LivePOS: React.FC<LivePOSProps> = ({ table, recipes, onClose, existingOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<POSOrderItem[]>(existingOrder?.items || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [category, setCategory] = useState<string>('all');
  const [activeBriefing, setActiveBriefing] = useState<ShiftBriefingNote | null>(null);
  const [showBriefingDetail, setShowBriefingDetail] = useState(false);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [confirmedPaymentId, setConfirmedPaymentId] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState('');
  const [confirmedPaymentMethod, setConfirmedPaymentMethod] = useState('Card');
  const { isOnline } = useConnectionStatus();

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'shiftBriefings'), 
        where('locationId', '==', LOCATION_ID),
        where('isActiveOnPOS', '==', true)
      ), 
      (snapshot) => {
        if (!snapshot.empty) {
          setActiveBriefing({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ShiftBriefingNote);
        } else {
          setActiveBriefing(null);
        }
      }
    );
    return () => unsub();
  }, []);

  const menuItems = useMemo(() => {
    // CRITICAL: Filter out 86'd items (isActive: false)
    return recipes.filter(r => 
      r.type === 'menu_item' && 
      r.isActive !== false && // Strictly filter out 86'd
      (category === 'all' || r.category === category) &&
      (r.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [recipes, searchTerm, category]);

  const categories = useMemo(() => {
    const cats = new Set(recipes.filter(r => r.type === 'menu_item' && r.category).map(r => r.category as string));
    return ['all', ...Array.from(cats)].filter((c): c is string => !!c);
  }, [recipes]);

  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const addToCart = (recipe: Recipe) => {
    setCart(prev => {
      const existing = prev.find(i => i.recipeId === recipe.id);
      if (existing) {
        return prev.map(i => i.recipeId === recipe.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      const newItem: POSOrderItem = {
        id: `poi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        recipeId: recipe.id,
        name: recipe.name,
        quantity: 1,
        price: recipe.sellingPrice || 0,
        modifiers: [],
        status: 'Pending',
        station: recipe.station || 'Cold',
        course: recipe.course || 'Mains'
      };
      return [...prev, newItem];
    });
  };

  const removeFromCart = (recipeId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.recipeId === recipeId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.recipeId === recipeId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.recipeId !== recipeId);
    });
  };

  const handlePlaceOrder = async (orderStatus: OrderStatus) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (orderStatus === 'Paid' && !isOnline) {
      toast.error('You are offline — cannot process payments. Please reconnect first.');
      return;
    }

    setIsProcessing(true);
    const orderId = existingOrder?.id || `order-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const orderData: Partial<POSOrder> = {
      id: orderId,
      locationId: LOCATION_ID,
      tableNumber: table.number || table.name,
      tableName: table.name,
      waiterId: auth.currentUser?.uid || 'staff-1',
      waiterName: auth.currentUser?.displayName || 'Staff',
      items: cart,
      status: orderStatus,
      total,
      subtotal: total / 1.2,
      vat: total - (total / 1.2),
      serviceCharge: 0,
      tips: 0,
      type: 'Dine-In',
      createdAt: existingOrder?.createdAt || timestamp,
      updatedAt: timestamp,
      paidAt: orderStatus === 'Paid' ? timestamp : undefined
    };

    try {
      await setDoc(doc(db, 'posOrders', orderId), cleanObject(orderData), { merge: true });

      if (orderStatus === 'Paid') {
        const paymentId = `pay-${Date.now()}`;
        const method = 'Card';
        await setDoc(doc(db, 'posPayments', paymentId), cleanObject({
          id: paymentId,
          orderId,
          locationId: LOCATION_ID,
          amount: total,
          method,
          timestamp,
          performanceProcessed: false
        }));
        setConfirmedPaymentId(paymentId);
        setConfirmedOrderId(orderId);
        setConfirmedPaymentMethod(method);
        setShowPaymentConfirmation(true);
      } else {
        toast.success('Order sent to kitchen');
      }

      // Update table status
      await setDoc(doc(db, 'tables', table.id), {
        status: orderStatus === 'Paid' ? 'available' : 'occupied',
        lastUpdated: timestamp
      }, { merge: true });

      if (orderStatus !== 'Paid') {
        onClose();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${orderId}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-0 md:p-4">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-card-bg w-full h-full md:h-[90vh] max-w-6xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        {activeBriefing && (
          <div className="bg-accent/10 border-b border-accent/20 px-6 py-2 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-4 overflow-hidden flex-1">
              <Zap className="w-4 h-4 text-accent animate-pulse shrink-0" />
              <div className="flex items-center gap-6 overflow-hidden">
                 {activeBriefing.focusOfDay && (
                   <span className="text-xs font-black text-text-navy truncate flex items-center gap-1.5">
                     <Target className="w-3.5 h-3.5 text-accent" /> {activeBriefing.focusOfDay}
                   </span>
                 )}
                 {activeBriefing.managerAlerts?.[0] && (
                   <span className="text-xs font-black text-error animate-pulse truncate flex items-center gap-1.5">
                     <AlertCircle className="w-3.5 h-3.5" /> {activeBriefing.managerAlerts[0]}
                   </span>
                 )}
              </div>
            </div>
            <button 
              onClick={() => setShowBriefingDetail(true)}
              className="ml-4 shrink-0 text-[10px] font-black uppercase text-accent hover:underline flex items-center gap-1.5 bg-accent/10 px-3 py-1.5 rounded-xl transition-all hover:bg-accent/20"
            >
              Briefing <Megaphone className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="p-6 border-b border-border-grey flex justify-between items-center bg-secondary-surface/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-2xl">
              <TableIcon className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-text-navy tracking-tighter">Table {table.number || table.name}</h2>
              <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {table.seats} Seats</span>
                <span className="w-1 h-1 bg-border-grey rounded-full" />
                <span className="text-accent">{existingOrder ? 'Active Session' : 'New Session'}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-secondary-surface rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Menu Section */}
          <div className="flex-[1.5] flex flex-col border-r border-border-grey bg-main-bg/30">
            {/* Search & Categories */}
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-card-bg border border-border-grey rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      category === cat 
                        ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                        : 'bg-card-bg border border-border-grey text-text-muted hover:border-accent/40'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 pt-0">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map(item => (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToCart(item)}
                    className="group bg-card-bg border border-border-grey rounded-2xl p-4 text-left hover:border-accent hover:shadow-xl transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-5 w-5 text-accent" />
                    </div>
                    <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">{item.category}</p>
                    <h3 className="text-sm font-bold text-text-navy mb-2 line-clamp-2 leading-tight">{item.name}</h3>
                    <p className="text-lg font-black text-text-navy">£{item.sellingPrice?.toFixed(2)}</p>
                  </motion.button>
                ))}
                {menuItems.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <UtensilsCrossed className="h-12 w-12 text-border-grey mx-auto mb-4 opacity-20" />
                    <p className="text-text-muted font-bold uppercase tracking-widest text-sm">No items found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cart Section */}
          <div className="flex-1 flex flex-col bg-card-bg">
            <div className="p-6 border-b border-border-grey flex items-center justify-between">
              <h3 className="text-lg font-black text-text-navy flex items-center gap-2 uppercase tracking-tighter">
                <ShoppingCart className="h-5 w-5 text-accent" /> Order Items
              </h3>
              <span className="px-2 py-1 bg-secondary-surface rounded-lg text-[10px] font-black text-text-muted">
                {cart.reduce((a, b) => a + b.quantity, 0)} ITEMS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {cart.map(item => (
                  <motion.div
                    key={item.recipeId}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center justify-between p-4 bg-secondary-surface rounded-2xl group"
                  >
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-text-navy line-clamp-1">{item.name}</h4>
                      <p className="text-[10px] font-black text-accent">£{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-card-bg border border-border-grey rounded-xl p-1">
                      <button 
                        onClick={() => removeFromCart(item.recipeId)}
                        className="p-1.5 hover:bg-secondary-surface rounded-lg text-text-muted transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => {
                          const recipe = recipes.find(r => r.id === item.recipeId);
                          if (recipe) addToCart(recipe);
                        }}
                        className="p-1.5 hover:bg-secondary-surface rounded-lg text-accent transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 grayscale opacity-30">
                  <ShoppingCart className="h-16 w-16 mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest text-text-muted">Cart is empty</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border-grey space-y-6 bg-secondary-surface/10">
              <div className="space-y-2">
                <div className="flex justify-between text-text-muted font-bold text-[10px] uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>£{(total / 1.2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-muted font-bold text-[10px] uppercase tracking-widest">
                  <span>VAT (20%)</span>
                  <span>£{(total - (total / 1.2)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-navy font-black text-2xl tracking-tighter pt-2 border-t border-border-grey/50">
                  <span>TOTAL</span>
                  <span>£{total.toFixed(2)}</span>
                </div>
              </div>

              <OfflineBanner position="inline" />

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={isProcessing || cart.length === 0}
                    onClick={() => handlePlaceOrder('Sent')}
                    className="py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <UtensilsCrossed className="h-4 w-4" /> Save & Send
                  </button>
                  <button
                    disabled={isProcessing || cart.length === 0 || !isOnline}
                    onClick={() => handlePlaceOrder('Paid')}
                    className="py-4 bg-accent text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:opacity-90 shadow-lg shadow-accent/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" /> Pay Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <PaymentConfirmation
        isOpen={showPaymentConfirmation}
        paymentId={confirmedPaymentId}
        orderId={confirmedOrderId}
        amount={total}
        method={confirmedPaymentMethod}
        tableName={table.name}
        onClose={() => {
          setShowPaymentConfirmation(false);
          onClose();
        }}
      />

      {/* Briefing Modal */}
      <AnimatePresence>
        {showBriefingDetail && activeBriefing && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg rounded-[32px] border border-border-grey w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-border-grey flex justify-between items-center bg-primary-surface flex-shrink-0">
                <div>
                  <h2 className="text-xl font-black text-text-navy font-serif">Shift Briefing</h2>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{activeBriefing.shift} - {activeBriefing.date}</p>
                </div>
                <button onClick={() => setShowBriefingDetail(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto scrollbar-hide">
                <div className="bg-error/5 border-l-4 border-error p-4 rounded-r-2xl">
                  <span className="text-[10px] font-black uppercase text-error block mb-1 tracking-widest">Manager's Message</span>
                  <p className="text-sm font-bold text-text-navy leading-relaxed">{activeBriefing.message}</p>
                </div>

                {activeBriefing.focusOfDay && (
                  <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                    <span className="text-[10px] font-black uppercase text-accent block mb-1 tracking-widest">Focus of the Day</span>
                    <p className="text-lg font-black text-accent italic">"{activeBriefing.focusOfDay}"</p>
                  </div>
                )}

                {activeBriefing.targets?.floor?.totalSalesTarget && (
                  <div className="bg-cta p-4 rounded-2xl text-white shadow-lg shadow-cta/20">
                    <span className="text-[10px] font-black uppercase text-white/70 block mb-1 tracking-widest">Total Sales Target</span>
                    <p className="text-xl font-black">{activeBriefing.targets.floor.totalSalesTarget}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                   {activeBriefing.managerAlerts?.some(a => a) && (
                     <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                       <span className="text-[10px] font-black uppercase text-red-600 block mb-2 tracking-widest">Alerts</span>
                       {activeBriefing.managerAlerts.map((a, i) => a && <p key={i} className="text-[11px] font-black text-red-800 mb-1 leading-tight last:mb-0">! {a}</p>)}
                     </div>
                   )}
                   {activeBriefing.specials?.some(s => s) && (
                     <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                       <span className="text-[10px] font-black uppercase text-amber-600 block mb-2 tracking-widest">Specials</span>
                       {activeBriefing.specials.map((s, i) => s && <p key={i} className="text-[11px] font-bold text-amber-900 mb-1 leading-tight last:mb-0">✨ {s}</p>)}
                     </div>
                   )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                   {activeBriefing.targets?.floor?.dessertTarget && (
                     <div className="bg-gray-50 p-3 rounded-xl border border-border-grey text-center">
                       <span className="text-[8px] font-black uppercase text-text-muted block mb-1">Floor Target</span>
                       <p className="text-[10px] font-bold text-text-navy">{activeBriefing.targets.floor.dessertTarget}</p>
                     </div>
                   )}
                   {activeBriefing.targets?.bar?.cocktailTarget && (
                     <div className="bg-gray-50 p-3 rounded-xl border border-border-grey text-center">
                       <span className="text-[8px] font-black uppercase text-text-muted block mb-1">Bar Target</span>
                       <p className="text-[10px] font-bold text-text-navy">{activeBriefing.targets.bar.cocktailTarget}</p>
                     </div>
                   )}
                   {activeBriefing.targets?.kitchen?.avgPrepTimeTarget && (
                     <div className="bg-gray-50 p-3 rounded-xl border border-border-grey text-center">
                       <span className="text-[8px] font-black uppercase text-text-muted block mb-1">Kitchen</span>
                       <p className="text-[10px] font-bold text-text-navy">{activeBriefing.targets.kitchen.avgPrepTimeTarget}</p>
                     </div>
                   )}
                </div>

                {activeBriefing.targets?.individual && (
                  <div className="bg-primary-surface/50 p-4 rounded-2xl border border-border-grey/30">
                    <span className="text-[10px] font-black uppercase text-text-muted block mb-4 text-center tracking-[0.2em]">Daily Sales Challenges</span>
                    <div className="grid grid-cols-3 gap-4 text-center uppercase tracking-tighter">
                       <div><p className="text-[9px] font-bold text-text-muted mb-1">Desserts</p><p className="text-sm font-black text-text-navy">{activeBriefing.targets.individual.dessertTarget || '-'}</p></div>
                       <div><p className="text-[9px] font-bold text-text-muted mb-1">Cocktails</p><p className="text-sm font-black text-text-navy">{activeBriefing.targets.individual.cocktailTarget || '-'}</p></div>
                       <div><p className="text-[9px] font-bold text-text-muted mb-1">Sales</p><p className="text-sm font-black text-text-navy">{activeBriefing.targets.individual.salesTarget || '-'}</p></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 bg-gray-50 border-t border-border-grey flex-shrink-0">
                <button 
                  onClick={() => setShowBriefingDetail(false)}
                  className="w-full bg-accent text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-accent/20 active:scale-95"
                >
                  Confirm & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
