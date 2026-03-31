
import React, { useState, useMemo, useEffect } from 'react';
import { Table, Recipe, InventoryItem, POSOrder, POSOrderItem, OrderItemStatus, Station, Course, Modifier, TableShape, ALLERGIES_LIST, StaffMember, MenuCategory } from '../../types';
import { Search, Plus, Minus, Trash2, Send, CreditCard, Banknote, Receipt, X, ChevronRight, Info, AlertCircle, Clock, Users, ChevronLeft, Utensils, ClipboardList, CheckCircle2, Square, Circle, RectangleHorizontal, Layout, StickyNote, Ban, Percent, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, collection, addDoc, doc, setDoc, handleFirestoreError, OperationType, cleanObject, onSnapshot } from '../../firebase';
import { toast } from 'sonner';

interface OrderEntryProps {
  table: Table;
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  menuCategories: MenuCategory[];
  onClose: () => void;
  orders: POSOrder[];
  onProcessSales: (deductions: { inventoryItemId: string; quantity: number }[], revenue: number) => void;
  staff: StaffMember[];
}

export const OrderEntry: React.FC<OrderEntryProps> = ({ table, recipes, inventoryItems, menuCategories, onClose, orders, onProcessSales, staff }) => {
  const [activeParentCategory, setActiveParentCategory] = useState<'Food' | 'Drinks'>('Food');
  const [activeSubCategory, setActiveSubCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentOrderItems, setCurrentOrderItems] = useState<POSOrderItem[]>([]);
  const [selectedItemForAction, setSelectedItemForAction] = useState<POSOrderItem | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<'modifiers' | 'notes' | 'allergies' | 'discount' | 'void' | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Card');
  const [customerName, setCustomerName] = useState('');
  const [modifiers, setModifiers] = useState<Modifier[]>([]);

  // Admin PIN for discounts/voids
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const unsub = onSnapshot(collection(db, `users/${userId}/modifiers`), (snapshot) => {
      setModifiers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Modifier)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'modifiers'));
    return unsub;
  }, []);

  const menuStructure = useMemo(() => {
    return {
      Food: ['Starters', 'Mains', 'Desserts'],
      Drinks: ['Cocktails', 'Beers', 'Wines', 'Coffees', 'Non-alcoholic', 'Spirits', 'Tequila', 'Mezcal']
    };
  }, []);

  const categories = useMemo(() => {
    const allCats = recipes.map(r => r.category);
    return Array.from(new Set(allCats));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      // Map 'Beverage' to 'Drinks' for internal consistency with user request
      const recipeParent = r.category === 'Beverage' ? 'Drinks' : r.category;
      
      if (recipeParent !== activeParentCategory) return false;

      if (activeSubCategory !== 'All') {
        const recipeSub = r.subCategory || (r.menuPath ? r.menuPath.split(' > ')[1] : '');
        
        // Strict matching for subcategories to prevent empty subcategories from matching everything
        if (recipeSub.toLowerCase() !== activeSubCategory.toLowerCase()) return false;
      }

      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch && r.type === 'menu_item';
    });
  }, [recipes, activeParentCategory, activeSubCategory, searchQuery]);

  const existingOrder = useMemo(() => {
    const order = orders.find(o => o.tableId === table.id && o.status === 'Open');
    if (order && !customerName && order.customerName) {
      setCustomerName(order.customerName);
    }
    return order;
  }, [orders, table.id]);

  const addToOrder = (recipe: Recipe) => {
    if (recipe.trackAvailability && recipe.availabilityCount !== undefined && recipe.availabilityCount <= 0) {
      toast.error(`OUT OF STOCK: ${recipe.name} is currently unavailable.`);
      return;
    }

    const newItem: POSOrderItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      recipeId: recipe.id,
      name: recipe.name,
      price: recipe.sellingPrice,
      quantity: 1,
      modifiers: [],
      status: 'Pending',
      station: (recipe.station || (recipe.category === 'Beverage' ? 'Bar' : 'Grill')) as Station,
      course: (recipe.course || (recipe.category === 'Beverage' ? 'Drinks' : 'Mains')) as Course,
      vatCode: recipe.vatCode || 'STANDARD_20',
      vatRate: recipe.vatRate || 20,
    };
    setCurrentOrderItems([...currentOrderItems, newItem]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCurrentOrderItems(items => items.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCurrentOrderItems(items => items.filter(item => item.id !== id));
  };

  const subtotal = useMemo(() => {
    const calculateItemsTotal = (items: POSOrderItem[]) => 
      items.reduce((sum, item) => {
        if (item.isVoided) return sum;
        const modifiersTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
        const itemTotal = (item.price + modifiersTotal) * item.quantity;
        return sum + itemTotal - (item.discount || 0);
      }, 0);

    const currentTotal = calculateItemsTotal(currentOrderItems);
    const existingTotal = calculateItemsTotal(existingOrder?.items || []);
    return Math.max(0, currentTotal + existingTotal);
  }, [currentOrderItems, existingOrder]);

  const vat = subtotal * 0.20;
  const serviceCharge = subtotal * 0.125;
  const total = subtotal + vat + serviceCharge;

  const sendToKitchen = async () => {
    if (currentOrderItems.length === 0) return;

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      if (existingOrder) {
        // Update existing order
        const updatedItems = [...existingOrder.items, ...currentOrderItems];
        await setDoc(doc(db, `users/${userId}/posOrders/${existingOrder.id}`), cleanObject({
          items: updatedItems,
          customerName,
          subtotal,
          serviceCharge,
          vat,
          total,
          updatedAt: new Date().toISOString()
        }), { merge: true });
      } else {
        // Create new order
        const newOrder: Omit<POSOrder, 'id'> = {
          tableId: table.id,
          tableNumber: table.number,
          customerName,
          type: 'Dine-In',
          status: 'Open',
          items: currentOrderItems,
          subtotal,
          serviceCharge,
          vat,
          total,
          tips: 0,
          waiterId: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payments: []
        };
        const orderRef = await addDoc(collection(db, `users/${userId}/posOrders`), cleanObject(newOrder));
        
        // Update table status
        await setDoc(doc(db, `users/${userId}/tables/${table.id}`), cleanObject({
          status: 'Ordered',
          currentOrderId: orderRef.id
        }), { merge: true });
      }

      // Update availability counts for recipes
      for (const item of currentOrderItems) {
        if (item.isVoided) continue;

        const recipe = recipes.find(r => r.id === item.recipeId);
        if (recipe && recipe.trackAvailability && recipe.availabilityCount !== undefined) {
          const newCount = Math.max(0, recipe.availabilityCount - item.quantity);
          await setDoc(doc(db, `users/${userId}/recipes/${recipe.id}`), {
            availabilityCount: newCount
          }, { merge: true });
        }
      }

      setCurrentOrderItems([]);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'posOrders');
    }
  };

  const finalizePayment = async () => {
    if (!existingOrder && currentOrderItems.length === 0) return;

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const allItems = [...(existingOrder?.items || []), ...currentOrderItems];
      const finalTotal = total;

      // Calculate deductions for inventory
      const deductions: { inventoryItemId: string; quantity: number }[] = [];
      
      allItems.forEach(item => {
        if (item.isVoided) return;

        const recipe = recipes.find(r => r.id === item.recipeId);
        if (recipe) {
          // If it's a batch/prep item, deduct the recipe itself
          if (recipe.category === 'Batch' || recipe.category === 'Prep') {
            deductions.push({
              inventoryItemId: `recipe-${recipe.id}`,
              quantity: item.quantity
            });
          } 
          // If it's a menu item, deduct its ingredients
          if (recipe.ingredients && recipe.ingredients.length > 0) {
            recipe.ingredients.forEach(ing => {
              deductions.push({
                inventoryItemId: ing.inventoryItemId,
                quantity: ing.quantity * item.quantity
              });
            });
          }
        }

        // Deduct modifiers
        item.modifiers.forEach(mod => {
          if (mod.inventoryItemId && mod.quantity) {
            deductions.push({
              inventoryItemId: mod.inventoryItemId,
              quantity: mod.quantity * item.quantity
            });
          }
        });
      });

      // Update availability counts for new items
      for (const item of currentOrderItems) {
        if (item.isVoided) continue;

        const recipe = recipes.find(r => r.id === item.recipeId);
        if (recipe && recipe.trackAvailability && recipe.availabilityCount !== undefined) {
          const newCount = Math.max(0, recipe.availabilityCount - item.quantity);
          await setDoc(doc(db, `users/${userId}/recipes/${recipe.id}`), {
            availabilityCount: newCount
          }, { merge: true });
        }
      }

      // Update revenue and inventory in App state
      onProcessSales(deductions, finalTotal);

      if (existingOrder) {
        // Update existing order status to Paid and include any new items
        await setDoc(doc(db, `users/${userId}/posOrders/${existingOrder.id}`), cleanObject({
          items: allItems,
          customerName,
          status: 'Paid',
          paymentMethod,
          subtotal,
          serviceCharge,
          vat,
          total: finalTotal,
          updatedAt: new Date().toISOString()
        }), { merge: true });
      } else {
        // Create a new order directly as Paid
        await addDoc(collection(db, `users/${userId}/posOrders`), cleanObject({
          tableId: table.id,
          tableNumber: table.number,
          customerName,
          items: allItems,
          status: 'Paid',
          paymentMethod,
          subtotal,
          serviceCharge,
          vat,
          total: finalTotal,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      }

      // Update table status to Available
      await setDoc(doc(db, `users/${userId}/tables/${table.id}`), cleanObject({
        status: 'Available',
        currentOrderId: null
      }), { merge: true });

      setIsProcessingPayment(false);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'posOrders');
    }
  };

  const getShapeIcon = (shape?: TableShape) => {
    switch (shape) {
      case 'Round': return <Circle className="w-5 h-5" />;
      case 'Rectangle': return <RectangleHorizontal className="w-5 h-5" />;
      case 'Booth': return <Layout className="w-5 h-5" />;
      default: return <Square className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-main-bg overflow-hidden">
      {/* Top Header Section */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-border-grey bg-card-bg/50">
        <div>
          <h1 className="text-2xl font-bold text-text-navy tracking-tight">Point of Sale (POS)</h1>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
            <span>Dashboard</span>
            <span className="w-1 h-1 rounded-full bg-text-muted/30" />
            <span className="text-accent">Pos</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-accent/20 hover:opacity-90 transition-all">
            <Plus className="w-4 h-4" />
            <span>New</span>
          </button>
          <button className="px-4 py-2 bg-card-bg border border-border-grey rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-text-navy transition-all">
            QR Menu Orders
          </button>
          <button className="px-4 py-2 bg-card-bg border border-border-grey rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-text-navy transition-all">
            Draft List
          </button>
          <button className="px-4 py-2 bg-card-bg border border-border-grey rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-text-navy transition-all">
            Table Order
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Product Selection */}
        <div className="flex-[2] flex flex-col p-8 overflow-hidden border-r border-border-grey">
          {/* Search and Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search in products"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-card-bg border border-border-grey rounded-xl text-sm text-text-navy focus:outline-none focus:border-accent transition-all placeholder:text-text-muted/50"
                />
              </div>
              <select 
                value={activeSubCategory}
                onChange={(e) => setActiveSubCategory(e.target.value)}
                className="px-4 py-3 bg-card-bg border border-border-grey rounded-xl text-xs font-bold text-text-navy focus:outline-none focus:border-accent"
              >
                <option value="All">All Sub-Categories</option>
                {menuStructure[activeParentCategory].map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Showing {filteredRecipes.length} Results
            </div>
          </div>

          {/* Parent Category Tabs */}
          <div className="flex space-x-6 mb-4 border-b border-border-grey pb-2">
            {(['Food', 'Drinks'] as const).map(parent => (
              <button
                key={parent}
                onClick={() => {
                  setActiveParentCategory(parent);
                  setActiveSubCategory('All');
                }}
                className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeParentCategory === parent ? 'text-accent' : 'text-text-muted hover:text-text-navy'}`}
              >
                {parent}
                {activeParentCategory === parent && (
                  <motion.div layoutId="activeParent" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            ))}
          </div>

          {/* Sub Category Tabs */}
          <div className="flex space-x-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveSubCategory('All')}
              className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubCategory === 'All' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-card-bg border border-border-grey text-text-muted hover:border-accent hover:text-text-navy'}`}
            >
              Show All
            </button>
            {menuStructure[activeParentCategory].map(sub => (
              <button
                key={sub}
                onClick={() => setActiveSubCategory(sub)}
                className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubCategory === sub ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-card-bg border border-border-grey text-text-muted hover:border-accent hover:text-text-navy'}`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-5 gap-4 content-start scrollbar-thin scrollbar-thumb-border-grey">
            {filteredRecipes.map(recipe => (
              <motion.div
                key={recipe.id}
                whileHover={{ y: -4 }}
                onClick={() => addToOrder(recipe)}
                className="group relative bg-card-bg border border-border-grey rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="aspect-square overflow-hidden bg-secondary-surface relative">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Utensils className="w-8 h-8 text-border-grey" />
                    </div>
                  )}
                  {recipe.trackAvailability && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${recipe.availabilityCount && recipe.availabilityCount > 5 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {recipe.availabilityCount || 0} left
                    </div>
                  )}
                </div>
                
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-xs font-bold text-text-navy line-clamp-2 mb-2 h-8">{recipe.name}</h3>
                  <div className="mt-auto flex items-center justify-between">
                    <p className="text-accent text-sm font-bold">£{recipe.sellingPrice.toFixed(2)}</p>
                    <div className="p-1.5 bg-accent/10 text-accent rounded-lg group-hover:bg-accent group-hover:text-white transition-all">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {recipe.allergies && recipe.allergies.length > 0 && (
                  <div className="absolute top-2 left-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="flex-[1] flex flex-col bg-card-bg border-l border-border-grey overflow-hidden">
          {/* Order Header */}
          <div className="p-6 space-y-4 border-b border-border-grey bg-primary-surface/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold text-text-navy">Order #{existingOrder?.id.slice(-4) || '12345'}</h2>
              </div>
              <span className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest rounded-full">
                Dine In
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search in Existing"
                className="w-full pl-12 pr-4 py-2 bg-card-bg border border-border-grey rounded-lg text-xs text-text-navy focus:outline-none focus:border-accent transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button className="px-4 py-2 bg-card-bg border border-border-grey rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-accent hover:border-accent transition-all">
                Split Equal
              </button>
              <button className="px-4 py-2 bg-card-bg border border-border-grey rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-accent hover:border-accent transition-all">
                By Item
              </button>
            </div>
          </div>

          {/* Order List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {[...(existingOrder?.items || []), ...currentOrderItems].map((item) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={item.id} 
                  className="relative p-3 bg-main-bg/30 border border-border-grey rounded-xl group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs font-bold text-text-navy pr-8 line-clamp-1">{item.name}</h3>
                    <p className="text-xs font-bold text-text-navy">£{(item.price * item.quantity).toFixed(2)}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-card-bg border border-border-grey rounded-lg overflow-hidden">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/5 transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-[10px] font-bold text-text-navy">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/5 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => { setSelectedItemForAction(item); setActiveActionModal('notes'); }}
                        className="p-1.5 text-text-muted hover:text-accent transition-all"
                        title="Add Notes"
                      >
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-text-muted hover:text-error transition-all"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.notes && (
                    <div className="mt-2 p-1.5 bg-accent/5 rounded-lg border border-accent/10">
                      <p className="text-[9px] text-accent italic flex items-center space-x-1">
                        <Info className="w-2.5 h-2.5" />
                        <span>{item.notes}</span>
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {currentOrderItems.length === 0 && !existingOrder && (
              <div className="h-full flex flex-col items-center justify-center text-text-muted/20 py-12">
                <Utensils className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest">Empty Order</p>
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-6 bg-primary-surface/30 border-t border-border-grey space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-text-muted text-xs font-bold">
                <span>Sub total :</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted text-xs font-bold">
                <span>Product Discount :</span>
                <span>£0.00</span>
              </div>
              <div className="flex justify-between text-text-muted text-xs font-bold">
                <span>Extra Discount :</span>
                <div className="flex items-center space-x-1 text-accent cursor-pointer">
                  <StickyNote className="w-3 h-3" />
                  <span>£0.00</span>
                </div>
              </div>
              <div className="flex justify-between text-text-muted text-xs font-bold">
                <span>Coupon discount :</span>
                <div className="flex items-center space-x-1 text-accent cursor-pointer">
                  <StickyNote className="w-3 h-3" />
                  <span>£0.00</span>
                </div>
              </div>
              <div className="flex justify-between text-text-navy text-xl font-bold pt-4 border-t border-border-grey">
                <span>Total :</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={sendToKitchen}
                  disabled={currentOrderItems.length === 0}
                  className="col-span-3 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  KOT & Print
                </button>
                <button className="py-3 bg-card-bg border border-border-grey rounded-xl text-text-muted hover:text-text-navy transition-all flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                  <span className="ml-1 text-[8px] font-bold uppercase">Draft</span>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsProcessingPayment(true)}
                  className="py-4 bg-accent text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-accent/20 hover:opacity-90 transition-all"
                >
                  Bill & Payment
                </button>
                <button className="py-4 bg-success text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-success/20 hover:opacity-90 transition-all">
                  Bill & Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <AnimatePresence>
        {activeActionModal && selectedItemForAction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg bg-[#1a1a1a] border border-[#2a2a2a] rounded-3xl overflow-hidden shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#e0d7c6]">
                    {activeActionModal === 'modifiers' && 'Add Modifiers'}
                    {activeActionModal === 'notes' && 'Item Notes'}
                    {activeActionModal === 'allergies' && 'Allergy Alert'}
                    {activeActionModal === 'discount' && 'Apply Discount'}
                    {activeActionModal === 'void' && 'Void Item'}
                  </h3>
                  <p className="text-[#666] text-xs font-bold uppercase tracking-widest mt-1">{selectedItemForAction.name}</p>
                </div>
                <button onClick={() => { setActiveActionModal(null); setSelectedItemForAction(null); setIsAdminAuthenticated(false); setAdminPin(''); }} className="p-2 text-[#666] hover:text-[#e0d7c6]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modifiers UI */}
              {activeActionModal === 'modifiers' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Modifiers</p>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                      {modifiers.map(mod => (
                        <button 
                          key={mod.id}
                          onClick={() => {
                            setCurrentOrderItems(items => items.map(it => 
                              it.id === selectedItemForAction.id 
                                ? { ...it, modifiers: [...it.modifiers, mod] } 
                                : it
                            ));
                            setSelectedItemForAction(prev => prev ? { ...prev, modifiers: [...prev.modifiers, mod] } : null);
                          }}
                          className="p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-xs font-bold text-[#666] hover:text-[#e0d7c6] hover:border-[#c25e3a] transition-all text-left"
                        >
                          + {mod.name} (£{mod.price.toFixed(2)})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Existing Ingredients</p>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                      {inventoryItems.filter(i => i.category === 'Ingredient').map(inv => (
                        <button 
                          key={inv.id}
                          onClick={() => {
                            const newMod: Modifier = {
                              id: `${Date.now()}-${Math.random()}`,
                              name: inv.name,
                              price: 1.50, // Default price for extra ingredient
                              inventoryItemId: inv.id,
                              quantity: 1
                            };
                            setCurrentOrderItems(items => items.map(it => 
                              it.id === selectedItemForAction.id 
                                ? { ...it, modifiers: [...it.modifiers, newMod] } 
                                : it
                            ));
                            setSelectedItemForAction(prev => prev ? { ...prev, modifiers: [...prev.modifiers, newMod] } : null);
                          }}
                          className="p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-xs font-bold text-[#666] hover:text-[#e0d7c6] hover:border-[#c25e3a] transition-all text-left"
                        >
                          + {inv.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Custom Modifier</p>
                    <div className="flex space-x-3">
                      <input 
                        type="text" 
                        placeholder="Modifier Name"
                        id="custom-mod-name"
                        className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-[#e0d7c6] focus:outline-none focus:border-[#c25e3a]"
                      />
                      <input 
                        type="number" 
                        placeholder="Price"
                        id="custom-mod-price"
                        className="w-24 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-[#e0d7c6] focus:outline-none focus:border-[#c25e3a]"
                      />
                      <button 
                        onClick={() => {
                          const nameInput = document.getElementById('custom-mod-name') as HTMLInputElement;
                          const priceInput = document.getElementById('custom-mod-price') as HTMLInputElement;
                          if (nameInput.value) {
                            const newMod: Modifier = {
                              id: `${Date.now()}-${Math.random()}`,
                              name: nameInput.value,
                              price: parseFloat(priceInput.value) || 0
                            };
                            setCurrentOrderItems(items => items.map(it => 
                              it.id === selectedItemForAction.id 
                                ? { ...it, modifiers: [...it.modifiers, newMod] } 
                                : it
                            ));
                            setSelectedItemForAction(prev => prev ? { ...prev, modifiers: [...prev.modifiers, newMod] } : null);
                            nameInput.value = '';
                            priceInput.value = '';
                          }
                        }}
                        className="bg-[#c25e3a] text-white px-6 rounded-xl font-bold uppercase tracking-widest text-xs"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes UI */}
              {activeActionModal === 'notes' && (
                <div className="space-y-4">
                  <textarea 
                    placeholder="Add special instructions..."
                    value={selectedItemForAction.notes || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentOrderItems(items => items.map(it => 
                        it.id === selectedItemForAction.id ? { ...it, notes: val } : it
                      ));
                      setSelectedItemForAction(prev => prev ? { ...prev, notes: val } : null);
                    }}
                    className="w-full h-32 bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl p-4 text-sm text-[#e0d7c6] focus:outline-none focus:border-[#c25e3a] resize-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {['No Onion', 'Extra Hot', 'Well Done', 'Rare', 'No Salt', 'Gluten Free'].map(preset => (
                      <button 
                        key={preset}
                        onClick={() => {
                          const newNotes = selectedItemForAction.notes ? `${selectedItemForAction.notes}, ${preset}` : preset;
                          setCurrentOrderItems(items => items.map(it => 
                            it.id === selectedItemForAction.id ? { ...it, notes: newNotes } : it
                          ));
                          setSelectedItemForAction(prev => prev ? { ...prev, notes: newNotes } : null);
                        }}
                        className="p-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-[10px] font-bold text-[#666] hover:text-[#e0d7c6]"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergies UI */}
              {activeActionModal === 'allergies' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    {ALLERGIES_LIST.map(allergy => (
                      <button 
                        key={allergy}
                        onClick={() => {
                          const currentAllergies = selectedItemForAction.allergies || [];
                          const newAllergies = currentAllergies.includes(allergy)
                            ? currentAllergies.filter(a => a !== allergy)
                            : [...currentAllergies, allergy];
                          
                          setCurrentOrderItems(items => items.map(it => 
                            it.id === selectedItemForAction.id ? { ...it, allergies: newAllergies } : it
                          ));
                          setSelectedItemForAction(prev => prev ? { ...prev, allergies: newAllergies } : null);
                        }}
                        className={`p-3 border rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          (selectedItemForAction.allergies || []).includes(allergy)
                            ? 'bg-[#d4af37] border-[#d4af37] text-black'
                            : 'bg-[#0f0f0f] border-[#2a2a2a] text-[#666] hover:text-[#e0d7c6]'
                        }`}
                      >
                        {allergy}
                      </button>
                    ))}
                  </div>
                  <div className="flex space-x-3">
                    <input 
                      type="text" 
                      placeholder="Custom Allergy"
                      id="custom-allergy"
                      className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-[#e0d7c6] focus:outline-none focus:border-[#c25e3a]"
                    />
                    <button 
                      onClick={() => {
                        const input = document.getElementById('custom-allergy') as HTMLInputElement;
                        if (input.value) {
                          const currentAllergies = selectedItemForAction.allergies || [];
                          const newAllergies = [...currentAllergies, input.value];
                          setCurrentOrderItems(items => items.map(it => 
                            it.id === selectedItemForAction.id ? { ...it, allergies: newAllergies } : it
                          ));
                          setSelectedItemForAction(prev => prev ? { ...prev, allergies: newAllergies } : null);
                          input.value = '';
                        }
                      }}
                      className="bg-[#d4af37] text-black px-6 rounded-xl font-bold uppercase tracking-widest text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Discount UI */}
              {activeActionModal === 'discount' && (
                <div className="space-y-6">
                  {!isAdminAuthenticated ? (
                    <div className="space-y-4">
                      <p className="text-center text-[#666] text-sm">Admin authorization required</p>
                      <input 
                        type="password" 
                        placeholder="Enter Admin PIN"
                        value={adminPin}
                        onChange={(e) => {
                          const pin = e.target.value;
                          setAdminPin(pin);
                          const admin = staff.find(s => s.pin === pin && (s.role === 'Manager' || s.role === 'Chef'));
                          if (admin) {
                            setIsAdminAuthenticated(true);
                          }
                        }}
                        className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center text-2xl tracking-[1em] text-[#d9e2ec] focus:outline-none focus:border-[#486581]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: '10% Off', value: selectedItemForAction.price * 0.1 },
                          { label: '25% Off', value: selectedItemForAction.price * 0.25 },
                          { label: '50% Off', value: selectedItemForAction.price * 0.5 },
                          { label: '100% Off', value: selectedItemForAction.price },
                          { label: 'Staff Meal', value: selectedItemForAction.price * 0.75 },
                          { label: 'Manager Comp', value: selectedItemForAction.price }
                        ].map(disc => (
                          <button 
                            key={disc.label}
                            onClick={() => {
                              setCurrentOrderItems(items => items.map(it => 
                                it.id === selectedItemForAction.id ? { ...it, discount: disc.value, discountReason: disc.label } : it
                              ));
                              setActiveActionModal(null);
                              setSelectedItemForAction(null);
                              setIsAdminAuthenticated(false);
                            }}
                            className="p-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-xs font-bold uppercase tracking-widest text-[#666] hover:text-[#d9e2ec] hover:border-[#486581]"
                          >
                            {disc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Void UI */}
              {activeActionModal === 'void' && (
                <div className="space-y-6">
                  {!isAdminAuthenticated ? (
                    <div className="space-y-4">
                      <p className="text-center text-[#666] text-sm">Admin authorization required to void</p>
                      <input 
                        type="password" 
                        placeholder="Enter Admin PIN"
                        value={adminPin}
                        onChange={(e) => {
                          const pin = e.target.value;
                          setAdminPin(pin);
                          const admin = staff.find(s => s.pin === pin && (s.role === 'Manager' || s.role === 'Chef'));
                          if (admin) {
                            setIsAdminAuthenticated(true);
                          }
                        }}
                        className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center text-2xl tracking-[1em] text-[#d9e2ec] focus:outline-none focus:border-[#486581]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[#666] text-sm">Select reason for voiding:</p>
                      <div className="grid grid-cols-1 gap-2">
                        {['Mistake', 'Customer Changed Mind', 'Out of Stock', 'Quality Issue', 'Training'].map(reason => (
                          <button 
                            key={reason}
                            onClick={() => {
                              setCurrentOrderItems(items => items.map(it => 
                                it.id === selectedItemForAction.id ? { ...it, isVoided: true, voidReason: reason, status: 'Void' } : it
                              ));
                              setActiveActionModal(null);
                              setSelectedItemForAction(null);
                              setIsAdminAuthenticated(false);
                            }}
                            className="p-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-xs font-bold uppercase tracking-widest text-[#666] hover:text-red-500 hover:border-red-500/50"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal Overlay */}
      <AnimatePresence>
        {isProcessingPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-[#1a1a1a] border border-[#2a2a2a] rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[#2a2a2a] flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-[#d9e2ec]">Settlement</h2>
                  <p className="text-[#666] text-xs font-bold uppercase tracking-widest mt-1">Table {table.number} • Ticket #{existingOrder?.id.slice(-4)}</p>
                </div>
                <button onClick={() => setIsProcessingPayment(false)} className="p-2 text-[#666] hover:text-[#d9e2ec]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 grid grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="p-6 bg-[#0f0f0f] rounded-2xl border border-[#2a2a2a]">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666] mb-2">Amount Due</p>
                    <p className="text-5xl font-serif font-bold text-[#486581]">£{total.toFixed(2)}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Payment Method</p>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => setPaymentMethod('Card')}
                        className={`flex items-center justify-between p-4 rounded-xl font-bold transition-all ${paymentMethod === 'Card' ? 'bg-[#486581] text-white border-[#486581]' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] hover:text-[#d9e2ec]'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <CreditCard className="w-5 h-5" />
                          <span>Card / Contactless</span>
                        </div>
                        {paymentMethod === 'Card' && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('Cash')}
                        className={`flex items-center justify-between p-4 rounded-xl font-bold transition-all ${paymentMethod === 'Cash' ? 'bg-[#486581] text-white border-[#486581]' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] hover:text-[#d9e2ec]'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Banknote className="w-5 h-5" />
                          <span>Cash</span>
                        </div>
                        {paymentMethod === 'Cash' && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Split Options</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs font-bold uppercase tracking-widest text-[#666] hover:text-[#d9e2ec]">Split Equal</button>
                      <button className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs font-bold uppercase tracking-widest text-[#666] hover:text-[#d9e2ec]">By Item</button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Gratuity</p>
                    <div className="grid grid-cols-3 gap-3">
                      {['10%', '15%', '20%'].map(tip => (
                        <button key={tip} className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs font-bold text-[#666] hover:text-[#d9e2ec]">{tip}</button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={finalizePayment}
                    className="w-full py-6 bg-[#486581] text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl shadow-[#486581]/20 hover:bg-[#5a7a9a] transition-all mt-6"
                  >
                    Finalize Payment
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
