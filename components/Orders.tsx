import React, { useState } from 'react';
import { Order, OrderItem, Supplier, InventoryItem, Recipe, POSOrder } from '../types';
import { ShoppingCart, Package, Search, Filter, Plus, Minus, Check, Clock, ChevronDown, ChevronUp, Users, PoundSterling, Zap } from 'lucide-react';
import { Button } from './Button';

interface OrdersProps {
  cart: OrderItem[];
  orders: Order[];
  posOrders: POSOrder[];
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  recipes: Recipe[];
  onPlaceOrder: (supplier: string, items: OrderItem[], ccEmails: string[]) => void;
  onUpdateCart: (item: InventoryItem, quantity: number) => void;
  onUpdateOrderStatus: (id: string, status: 'Draft' | 'Sent' | 'Received') => void;
  checkPermission: (module: string, action: string) => boolean;
}

export const Orders: React.FC<OrdersProps> = ({ 
  cart, 
  orders, 
  posOrders = [],
  suppliers, 
  inventoryItems, 
  recipes = [],
  onPlaceOrder, 
  onUpdateCart,
  onUpdateOrderStatus,
  checkPermission
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'cart' | 'history' | 'pos'>('create');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Group active POS orders
  const activePosOrders = posOrders.filter(o => o.status === 'Open' || o.status === 'Sent');
  const totalLiveRevenue = activePosOrders.reduce((sum, o) => {
    const orderTotal = o.items.reduce((itemSum, item) => {
      const itemPrice = item.price + (item.modifiers || []).reduce((mSum, m) => mSum + (m.price || 0), 0);
      return itemSum + (itemPrice * item.quantity);
    }, 0);
    return sum + orderTotal;
  }, 0);

  // Filters for Create Order tab
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subCategoryFilter, setSubCategoryFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');

  const categories = ['All', ...new Set(inventoryItems.map(i => i.category))];
  const subCategories = ['All', ...new Set(inventoryItems.filter(i => i.subCategory).map(i => i.subCategory))];
  const supplierNames = ['All', ...new Set(inventoryItems.filter(i => i.supplier).map(i => i.supplier))];

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = (item.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSubCategory = subCategoryFilter === 'All' || item.subCategory === subCategoryFilter;
    const matchesSupplier = supplierFilter === 'All' || item.supplier === supplierFilter;
    return matchesSearch && matchesCategory && matchesSubCategory && matchesSupplier;
  });

  // Group cart items by supplier
  const cartBySupplier = cart.reduce((acc, item) => {
    const supplier = item.supplier || 'Unknown Supplier';
    if (!acc[supplier]) acc[supplier] = [];
    acc[supplier].push(item);
    return acc;
  }, {} as Record<string, OrderItem[]>);

  const [ccEmails, setCcEmails] = useState<Record<string, string>>({});
  const [copiedSupplier, setCopiedSupplier] = useState<string | null>(null);

  const copyToClipboard = (supplier: string, items: OrderItem[], totalAmount: number) => {
    const text = `Order from Backbone Hub - ${new Date().toLocaleDateString()}\n\nSupplier: ${supplier}\n\nItems:\n${items.map(i => `- ${i.quantity} ${i.unit} of ${i.name} (ID: ${i.inventoryItemId})`).join('\n')}\n\nTotal: £${totalAmount.toFixed(2)}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSupplier(supplier);
      setTimeout(() => setCopiedSupplier(null), 2000);
    });
  };

  const handlePlaceOrder = (supplier: string) => {
    if (cartBySupplier[supplier]) {
      const emailList = ccEmails[supplier] 
        ? ccEmails[supplier].split(',').map(e => e.trim()).filter(e => e.length > 0)
        : [];
      onPlaceOrder(supplier, cartBySupplier[supplier], emailList);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Orders & Purchasing</h2>
        <div className="flex space-x-2 bg-white rounded-lg shadow-sm p-1">
          {checkPermission('orders', 'create') && (
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'create' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                Create Order
              </div>
            </button>
          )}
          <button
            onClick={() => setActiveTab('cart')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'cart' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Current Cart ({cart.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <Package className="w-4 h-4 mr-2" />
              History
            </div>
          </button>
          {checkPermission('orders', 'managePOS') && (
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'pos' ? 'bg-cta/10 text-cta' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Live POS ({activePosOrders.length})
              </div>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'pos' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-border-grey relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                   <Users className="w-12 h-12 text-text-navy" />
                </div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Active Tables</p>
                <p className="text-3xl font-black text-text-navy">{activePosOrders.length}</p>
                <div className="mt-2 flex items-center gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] font-bold text-emerald-600 uppercase">Live Monitor</span>
                </div>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-border-grey relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                   <PoundSterling className="w-12 h-12 text-accent" />
                </div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Unpaid Bill Total</p>
                <p className="text-3xl font-black text-accent">£{totalLiveRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="mt-2 text-[9px] font-bold text-text-muted uppercase">Accrued Revenue</p>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-border-grey relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                   <Clock className="w-12 h-12 text-cta" />
                </div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Avg. Table Age</p>
                <p className="text-3xl font-black text-text-navy">
                  {activePosOrders.length > 0 
                    ? Math.round(activePosOrders.reduce((sum, o) => sum + (Date.now() - new Date(o.createdAt).getTime()), 0) / (activePosOrders.length * 60000))
                    : 0}m
                </p>
                <p className="mt-2 text-[9px] font-bold text-text-muted uppercase">Minutes since open</p>
             </div>
             <div className="bg-text-navy p-6 rounded-2xl shadow-xl border border-white/10 relative overflow-hidden group text-white">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                   <Zap className="w-12 h-12 text-accent" />
                </div>
                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">POS Efficiency</p>
                <p className="text-3xl font-black font-serif italic">94%</p>
                <p className="mt-2 text-[9px] font-bold text-white/40 uppercase">Operational Score</p>
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-border-grey overflow-hidden">
            <div className="p-4 border-b border-border-grey bg-secondary-surface flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <h3 className="text-xs font-black text-text-navy uppercase tracking-widest">Active Operations</h3>
                  <span className="bg-text-navy/5 text-text-navy px-2 py-0.5 rounded text-[10px] font-black">{activePosOrders.length} ORDERS</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search table or waiter..." 
                      className="pl-9 pr-4 py-1.5 bg-white border border-border-grey rounded-lg text-xs focus:ring-1 focus:ring-accent outline-none"
                    />
                  </div>
                  <Button variant="ghost" className="p-1.5 h-auto">
                    <Filter className="w-4 h-4" />
                  </Button>
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-grey">
                <thead className="bg-secondary-surface/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[9px] font-black text-text-muted uppercase tracking-widest">Table / Order</th>
                    <th className="px-6 py-3 text-left text-[9px] font-black text-text-muted uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-left text-[9px] font-black text-text-muted uppercase tracking-widest">Waiter</th>
                    <th className="px-6 py-3 text-left text-[9px] font-black text-text-muted uppercase tracking-widest">Items</th>
                    <th className="px-6 py-3 text-left text-[9px] font-black text-text-muted uppercase tracking-widest">Time</th>
                    <th className="px-6 py-3 text-right text-[9px] font-black text-text-muted uppercase tracking-widest">Running Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey bg-white">
                  {activePosOrders.length > 0 ? activePosOrders.map(order => (
                    <React.Fragment key={order.id}>
                      <tr className="hover:bg-primary-surface transition-colors cursor-pointer group" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary-surface flex items-center justify-center font-black text-xs text-text-navy border border-border-grey group-hover:bg-white group-hover:border-accent group-hover:text-accent transition-colors">
                               {order.tableNumber || '#'}
                            </div>
                            <span className="text-xs font-bold text-text-navy">{order.tableName || order.tableNumber || `Order #${order.id.slice(-4)}`}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black">
                         <span className={`px-2 py-0.5 rounded-lg border ${
                           order.status === 'Open' ? 'bg-accent/5 text-accent border-accent/20' : 'bg-warning/5 text-warning-text border-warning/20'
                         }`}>
                           {order.status}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-text-muted">
                         {order.waiterName || 'Staff'}
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-[10px] font-black bg-secondary-surface px-2 py-0.5 rounded border border-border-grey">{order.items.reduce((sum, i) => sum + i.quantity, 0)} Items</span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-text-muted" />
                            <span className="text-xs text-text-muted font-medium">
                              {Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)}m
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-3">
                            <span className="text-sm font-black text-text-navy">
                              £{(order.items.reduce((sum, item) => {
                                const itemPrice = item.price + (item.modifiers || []).reduce((mSum, m) => mSum + (m.price || 0), 0);
                                return sum + (itemPrice * item.quantity);
                              }, 0)).toFixed(2)}
                            </span>
                            {expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                         </div>
                      </td>
                    </tr>
                    {expandedOrder === order.id && (
                      <tr className="bg-secondary-surface/30">
                        <td colSpan={6} className="px-12 py-6">
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-300">
                              <div>
                                 <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package className="w-3 h-3" />
                                    Ordered Items
                                 </h4>
                                 <div className="space-y-2">
                                    {order.items.map((item, idx) => (
                                       <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border-grey shadow-sm">
                                          <div className="flex items-center gap-3">
                                             <div className="w-6 h-6 rounded bg-text-navy/5 flex items-center justify-center text-[10px] font-black text-text-navy">
                                                {item.quantity}x
                                             </div>
                                             <div>
                                                <p className="text-xs font-bold text-text-navy">{item.name}</p>
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                   <p className="text-[9px] text-text-muted italic">{item.modifiers.map(m => m.name).join(', ')}</p>
                                                )}
                                             </div>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-xs font-black text-text-navy">£{((item.price + (item.modifiers || []).reduce((sum, mod) => sum + (mod.price || 0), 0)) * item.quantity).toFixed(2)}</p>
                                             <span className="text-[8px] font-black uppercase text-accent">{item.status}</span>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                              <div className="border-l border-border-grey/50 pl-8">
                                 <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Zap className="w-3 h-3" />
                                    Inventory Impact
                                 </h4>
                                 <div className="p-4 bg-white rounded-2xl border border-border-grey/60 border-dashed">
                                    {order.isInventoryDepleted ? (
                                       <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-success">
                                             <Check className="w-4 h-4" />
                                             <span className="text-[10px] font-bold uppercase">Stock Successfully Deducted</span>
                                          </div>
                                          <p className="text-[10px] text-text-muted">HUB automatically updated your inventory based on the recipes for these items.</p>
                                       </div>
                                    ) : (
                                       <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-warning-text opacity-70">
                                             <Clock className="w-4 h-4" />
                                             <span className="text-[10px] font-bold uppercase">Awaiting Finalization</span>
                                          </div>
                                          <p className="text-[10px] text-text-muted">Stock will be auto-deducted the moment this order status changes to "Paid".</p>
                                       </div>
                                    )}
                                 </div>
                                 <div className="mt-6 flex justify-end gap-2">
                                    <Button variant="secondary" size="sm" className="text-[9px] h-8 font-black uppercase tracking-widest">
                                       Print Bill
                                    </Button>
                                    {order.status === 'Open' && (
                                       <Button className="text-[9px] h-8 bg-cta text-white font-black uppercase tracking-widest px-4">
                                          Send to Kitchen
                                       </Button>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                         <div className="flex flex-col items-center gap-2 opacity-30">
                            <Zap className="w-8 h-8 mb-2" />
                            <p className="text-xs font-black uppercase tracking-widest">No active orders found</p>
                            <p className="text-[10px] uppercase font-bold italic">POS is currently idle</p>
                         </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="relative rounded-md shadow-sm flex-1 min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-4 flex-wrap">
              <div className="relative rounded-md shadow-sm min-w-[150px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border bg-white"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                  ))}
                </select>
              </div>
              <div className="relative rounded-md shadow-sm min-w-[150px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border bg-white"
                  value={subCategoryFilter}
                  onChange={(e) => setSubCategoryFilter(e.target.value)}
                >
                  {subCategories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'All Sub Categories' : cat}</option>
                  ))}
                </select>
              </div>
              <div className="relative rounded-md shadow-sm min-w-[150px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Package className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border bg-white"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  {supplierNames.map(sup => (
                    <option key={sup} value={sup}>{sup === 'All' ? 'All Suppliers' : sup}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  {checkPermission('inventory', 'viewCosts') && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  )}
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map(item => {
                  const cartItem = cart.find(c => c.inventoryItemId === item.id);
                  const orderQuantity = cartItem ? cartItem.quantity : 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.imageUrl ? (
                            <img className="h-10 w-10 rounded-full object-cover mr-3" src={item.imageUrl} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                              <Package className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.supplier || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.quantity} {item.unit}</div>
                        <div className="text-xs text-gray-500">Min: {item.minStockLevel}</div>
                      </td>
                      {checkPermission('inventory', 'viewCosts') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          £{item.pricePerUnit.toFixed(2)} / {item.unit}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => onUpdateCart(item, -1)}
                            className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                            disabled={orderQuantity === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{orderQuantity}</span>
                          <button 
                            onClick={() => onUpdateCart(item, 1)}
                            className="p-1 rounded-full text-accent hover:bg-accent/10"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cart' && (
        <div className="space-y-6">
          {Object.keys(cartBySupplier).length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Cart is empty</h3>
              <p className="mt-1 text-sm text-gray-500">
                Go to the Inventory section to add items to your cart.
              </p>
            </div>
          ) : (
            Object.entries(cartBySupplier).map(([supplier, items]) => {
              const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);
              const supplierDetails = suppliers.find(s => s.name === supplier);

              return (
                <div key={supplier} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{supplier}</h3>
                      {supplierDetails?.email && (
                        <p className="text-sm text-gray-500">{supplierDetails.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-xl font-bold text-gray-900">£{totalAmount.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Item</th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Category</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Price</th>
                          <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Quantity</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map(item => {
                          const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
                          return (
                            <tr key={item.inventoryItemId}>
                              <td className="py-3 text-sm font-medium text-gray-900">{item.name}</td>
                              <td className="py-3 text-sm text-gray-500">{item.category}</td>
                              <td className="py-3 text-sm text-gray-500 text-right">£{item.pricePerUnit.toFixed(2)} / {item.unit}</td>
                              <td className="py-3 text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button 
                                    onClick={() => invItem && onUpdateCart(invItem, -1)}
                                    className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                                  <button 
                                    onClick={() => invItem && onUpdateCart(invItem, 1)}
                                    className="p-1 rounded-full text-accent hover:bg-accent/10"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 text-sm font-medium text-gray-900 text-right">
                                £{(item.quantity * item.pricePerUnit).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-5 bg-gray-50 border-t border-gray-200 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                       <div className="flex flex-col gap-2 w-full sm:flex-1 max-w-md">
                          <div className="flex items-center justify-between">
                             <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Recipient Email</label>
                             {!supplierDetails?.email && <span className="text-[9px] font-bold text-cta animate-pulse">Email Missing in Records</span>}
                          </div>
                          <input 
                            type="email"
                            placeholder={supplierDetails?.email || "Enter supplier email..."}
                            className={`text-sm px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-accent transition-all ${!supplierDetails?.email ? 'border-cta/50 bg-cta/5 shadow-sm' : 'border-border-grey bg-white'}`}
                            value={ccEmails[`${supplier}_to`] || supplierDetails?.email || ''}
                            onChange={(e) => setCcEmails(prev => ({ ...prev, [`${supplier}_to`]: e.target.value }))}
                          />
                       </div>
                       <div className="flex flex-col gap-2 w-full sm:flex-1 max-w-md">
                          <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">CC Notifications</label>
                          <input 
                            type="email"
                            multiple
                            placeholder="colleague@email.com, manager@email.com"
                            className="text-sm px-4 py-2 border border-border-grey rounded-xl outline-none focus:ring-2 focus:ring-accent bg-white"
                            value={ccEmails[supplier] || ''}
                            onChange={(e) => setCcEmails(prev => ({ ...prev, [supplier]: e.target.value }))}
                            title="Comma separated emails"
                          />
                       </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border-grey/30">
                      <Button 
                        onClick={() => copyToClipboard(supplier, items, totalAmount)}
                        variant="secondary"
                        className="flex items-center gap-2 h-11 px-6 rounded-xl border-border-grey hover:bg-white"
                      >
                        {copiedSupplier === supplier ? (
                          <>
                            <Check className="w-5 h-5 text-emerald-500" />
                            <span className="font-bold">Order Copied!</span>
                          </>
                        ) : (
                          <>
                            <Package className="w-5 h-5" />
                            <span className="font-bold">Copy Order Details</span>
                          </>
                        )}
                      </Button>

                      <Button 
                        onClick={() => {
                          const targetEmail = ccEmails[`${supplier}_to`] || supplierDetails?.email;
                          if (!targetEmail) {
                            alert('Please enter a recipient email address.');
                            return;
                          }
                          const subject = `Order from Backbone Hub - ${new Date().toLocaleDateString()}`;
                          const body = `Please find our order below:\n\n${items.map(i => `- ${i.quantity} ${i.unit} of ${i.name}`).join('\n')}\n\nTotal: £${totalAmount.toFixed(2)}`;
                          const cc = ccEmails[supplier] ? `&cc=${encodeURIComponent(ccEmails[supplier])}` : '';
                          const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc}`;
                          
                          // Robust mailto method
                          const link = document.createElement('a');
                          link.href = mailtoUrl;
                          link.target = '_blank';
                          link.click();
                        }} 
                        variant="accent"
                        className="font-black h-11 px-8 rounded-xl shadow-lg shadow-accent/20 flex items-center gap-2"
                      >
                        <Zap className="w-5 h-5 fill-current" />
                        Email Supplier
                      </Button>

                      <Button 
                        onClick={() => handlePlaceOrder(supplier)} 
                        variant="primary" 
                        className="font-black h-11 px-8 rounded-xl shadow-lg shadow-text-navy/20"
                      >
                        Confirm & Save
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders yet</h3>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {orders.map(order => (
                <div key={order.id} className="p-6">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${
                        order.status === 'Received' ? 'bg-green-100 text-green-600' :
                        order.status === 'Sent' ? 'bg-accent/10 text-accent' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status === 'Received' ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{order.supplier}</h4>
                        <p className="text-sm text-gray-500">{order.date} • {order.items.length} items</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">£{order.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{order.status}</p>
                      </div>
                      {expandedOrder === order.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                  
                  {expandedOrder === order.id && (
                    <div className="mt-6 pl-14 pr-6">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Item</th>
                            <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2">Qty</th>
                            <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2">Price</th>
                            <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {order.items.map(item => (
                            <tr key={item.inventoryItemId}>
                              <td className="py-2 text-sm text-gray-900">{item.name}</td>
                              <td className="py-2 text-sm text-gray-500 text-right">{item.quantity} {item.unit}</td>
                              <td className="py-2 text-sm text-gray-500 text-right">£{item.pricePerUnit.toFixed(2)}</td>
                              <td className="py-2 text-sm font-medium text-gray-900 text-right">£{(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {order.ccEmails && order.ccEmails.length > 0 && (
                        <div className="mt-4 flex items-center gap-2">
                           <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Notified:</span>
                           <div className="flex flex-wrap gap-1">
                              {order.ccEmails.map(email => (
                                <span key={email} className="text-[10px] bg-secondary-surface px-2 py-0.5 rounded border border-border-grey text-text-muted">{email}</span>
                              ))}
                           </div>
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-end space-x-3">
                        {order.status === 'Draft' && (
                          <Button onClick={() => onUpdateOrderStatus(order.id, 'Sent')} variant="primary">
                            Mark as Sent
                          </Button>
                        )}
                        {order.status === 'Sent' && (
                          <Button onClick={() => onUpdateOrderStatus(order.id, 'Received')} variant="primary">
                            Mark as Received
                          </Button>
                        )}
                        {suppliers.find(s => s.name === order.supplier)?.email && (
                          <Button 
                            onClick={() => {
                              const supplierDetails = suppliers.find(s => s.name === order.supplier);
                              if (!supplierDetails?.email) return;
                              const subject = `Order from Backbone Hub - ${new Date(order.date).toLocaleDateString()}`;
                              const body = `Please find our order below:\n\n${order.items.map(i => `- ${i.quantity} ${i.unit} of ${i.name}`).join('\n')}\n\nTotal: £${order.totalAmount.toFixed(2)}`;
                              window.open(`mailto:${supplierDetails.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                            }} 
                            variant="secondary"
                          >
                            Email Supplier
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
