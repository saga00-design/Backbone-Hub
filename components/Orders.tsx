import React, { useState } from 'react';
import { Order, OrderItem, Supplier, InventoryItem, Recipe, POSOrder, ReceivingRecordItem, ReceivingRecord } from '../types';
import { ShoppingCart, Package, Search, Filter, Plus, Minus, Check, Clock, ChevronDown, ChevronUp, Zap, AlertTriangle, Mail } from 'lucide-react';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { SearchInput } from './SearchInput';
import { formatPacksLabel, formatCaseBoxSackLabel } from '../utils/unitConversions';
import { getOrderShortfalls, buildShortageEmailUrl } from '../utils/shortageEmail';
import { ItemSpecsTooltip } from './ItemSpecsTooltip';
import { ReceiveGoodsModal } from './ReceiveGoodsModal';

interface OrdersProps {
  cart: OrderItem[];
  orders: Order[];
  receivingRecords: ReceivingRecord[];
  posOrders: POSOrder[];
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  recipes: Recipe[];
  onPlaceOrder: (supplier: string, items: OrderItem[], ccEmails: string[]) => void;
  onUpdateCart: (item: InventoryItem, quantity: number) => void;
  onUpdateOrderStatus: (id: string, status: 'Draft' | 'Sent' | 'Received') => void;
  onReceiveDelivery: (orderId: string, items: ReceivingRecordItem[]) => void;
  onCloseOrder: (orderId: string) => void;
  checkPermission: (module: string, action: string) => boolean;
}

export const Orders: React.FC<OrdersProps> = ({
  cart,
  orders,
  receivingRecords,
  posOrders = [],
  suppliers,
  inventoryItems,
  recipes = [],
  onPlaceOrder,
  onUpdateCart,
  onUpdateOrderStatus,
  onReceiveDelivery,
  onCloseOrder,
  checkPermission
}) => {
  const [receivingOrder, setReceivingOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'cart' | 'history'>('create');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

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

  // Looks up the source inventory item for an OrderItem/cart line so quantities can be shown
  // the way people actually buy things (packs/cases) instead of raw base units (g/ml/pcs).
  const getInvItem = (inventoryItemId: string) => inventoryItems.find(i => i.id === inventoryItemId);

  const formatOrderQty = (item: OrderItem) => {
    const invItem = getInvItem(item.inventoryItemId);
    if (!invItem) return `${item.quantity} ${item.unit}`;
    return formatPacksLabel(item.quantity, invItem);
  };

  const getCasesCount = (invItem: InventoryItem, baseQty: number) =>
    invItem.caseSize && invItem.unitSize ? baseQty / (invItem.unitSize * invItem.caseSize) : 0;

  // Opens a mailto: draft for review in the user's own email client — never sends anything itself.
  const openShortageEmail = (order: Order) => {
    const supplierEmail = suppliers.find(s => s.name === order.supplier)?.email;
    if (!supplierEmail) {
      alert('No email address on file for this supplier. Add one in Supplier Management first.');
      return;
    }
    const shortfalls = getOrderShortfalls(order, receivingRecords);
    if (shortfalls.length === 0) return;
    const mailtoUrl = buildShortageEmailUrl(order, shortfalls, supplierEmail, inventoryItems);
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    link.click();
  };

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
    const text = `Order from Backbone Hub - ${new Date().toLocaleDateString()}\n\nSupplier: ${supplier}\n\nItems:\n${items.map(i => `- ${formatOrderQty(i)} of ${i.name} (ID: ${i.inventoryItemId})`).join('\n')}\n\nTotal: £${totalAmount.toFixed(2)}`;
    
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
      <PageHeader
        icon={ShoppingCart}
        title="Stock Orders"
        subtitle="Create purchase orders and manage supplier deliveries"
        actions={
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
          </div>
        }
      />

      {activeTab === 'create' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-4 flex-wrap">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search items..."
              className="flex-1 min-w-[200px]"
            />
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case/Box/Sack</th>
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
                  const unitSize = item.unitSize || 1;
                  const packsValue = Number((orderQuantity / unitSize).toFixed(2));
                  const casesValue = getCasesCount(item, orderQuantity);
                  const pricePerPack = item.pricePerUnit * unitSize;

                  // Cart quantity is stored in base units, so any pack/case count the user
                  // types is converted to a delta in base units before being handed to onUpdateCart.
                  const setPacks = (newPacksStr: string) => {
                    const newPacks = parseFloat(newPacksStr);
                    if (isNaN(newPacks) || newPacks < 0) return;
                    onUpdateCart(item, (newPacks * unitSize) - orderQuantity);
                  };
                  const setCases = (newCasesStr: string) => {
                    const newCases = parseFloat(newCasesStr);
                    if (isNaN(newCases) || newCases < 0 || !item.caseSize) return;
                    onUpdateCart(item, (newCases * unitSize * item.caseSize) - orderQuantity);
                  };

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
                        <div className="text-sm text-gray-900">{formatPacksLabel(item.quantity, item)}</div>
                        <div className="text-xs text-gray-500">Min: {formatPacksLabel(item.minStockLevel || 0, item)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const caseInfo = formatCaseBoxSackLabel(item);
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              {caseInfo.isSet ? (
                                <span className="text-gray-900">{caseInfo.label}</span>
                              ) : (
                                <span className="text-xs text-gray-400 uppercase tracking-wide">{caseInfo.label}</span>
                              )}
                              <ItemSpecsTooltip item={item} />
                            </span>
                          );
                        })()}
                      </td>
                      {checkPermission('inventory', 'viewCosts') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          £{pricePerPack.toFixed(2)} / {item.packaging || item.unit}
                          {item.caseSize && (
                            <div className="text-xs text-gray-400">£{(pricePerPack * item.caseSize).toFixed(2)} / {item.casePackaging || 'case'}</div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {/* Two fixed-width blocks side by side, each individually centered, so
                            both the pack and case inputs sit at the same horizontal position on
                            every row regardless of label length ("PACKS" vs "VACUUM PACKS" vs
                            "Not set"). */}
                        <div className="flex items-start justify-center gap-3 mx-auto">
                          <div className="flex flex-col items-center gap-1 w-28">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => onUpdateCart(item, -unitSize)}
                                className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                                disabled={orderQuantity === 0}
                                title={`Remove 1 ${item.packaging || item.unit}`}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="w-16 text-center font-medium border border-gray-200 rounded-md py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                value={packsValue}
                                onChange={(e) => setPacks(e.target.value)}
                                title={`Quantity in ${item.packaging || item.unit}s`}
                              />
                              <button
                                onClick={() => onUpdateCart(item, unitSize)}
                                className="p-1 rounded-full text-accent hover:bg-accent/10"
                                title={`Add 1 ${item.packaging || item.unit}`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide text-center truncate max-w-full">
                              {item.packaging || item.unit}{packsValue !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex flex-col items-center gap-1 w-20">
                            {item.caseSize ? (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="w-16 text-center font-medium border border-gray-200 rounded-md py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                  value={Number(casesValue.toFixed(2))}
                                  onChange={(e) => setCases(e.target.value)}
                                  title={`Quantity in ${item.casePackaging || 'case'}s`}
                                />
                                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide text-center truncate max-w-full">
                                  {item.casePackaging || 'case'}{casesValue !== 1 ? 's' : ''}
                                </span>
                              </>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value="—"
                                  disabled
                                  readOnly
                                  className="w-16 text-center font-medium border border-gray-100 rounded-md py-1 text-sm bg-gray-50 text-gray-300 cursor-not-allowed"
                                  title="No Case/Box/Sack size configured for this item"
                                />
                                <span className="text-[9px] font-medium text-gray-300 uppercase tracking-wide text-center">
                                  Not set
                                </span>
                              </>
                            )}
                          </div>
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
                          const unitSize = invItem?.unitSize || 1;
                          const packsValue = Number((item.quantity / unitSize).toFixed(2));
                          const pricePerPack = item.pricePerUnit * unitSize;

                          const setPacks = (newPacksStr: string) => {
                            const newPacks = parseFloat(newPacksStr);
                            if (isNaN(newPacks) || newPacks < 0 || !invItem) return;
                            onUpdateCart(invItem, (newPacks * unitSize) - item.quantity);
                          };

                          return (
                            <tr key={item.inventoryItemId}>
                              <td className="py-3 text-sm font-medium text-gray-900">{item.name}</td>
                              <td className="py-3 text-sm text-gray-500">{item.category}</td>
                              <td className="py-3 text-sm text-gray-500 text-right">£{pricePerPack.toFixed(2)} / {invItem?.packaging || item.unit}</td>
                              <td className="py-3 text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => invItem && onUpdateCart(invItem, -unitSize)}
                                    className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="w-16 text-center font-medium border border-gray-200 rounded-md py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                    value={packsValue}
                                    onChange={(e) => setPacks(e.target.value)}
                                    disabled={!invItem}
                                  />
                                  <button
                                    onClick={() => invItem && onUpdateCart(invItem, unitSize)}
                                    className="p-1 rounded-full text-accent hover:bg-accent/10"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mt-1">
                                  {invItem?.packaging || item.unit}{packsValue !== 1 ? 's' : ''}
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
                          const body = `Please find our order below:\n\n${items.map(i => `- ${formatOrderQty(i)} of ${i.name}`).join('\n')}\n\nTotal: £${totalAmount.toFixed(2)}`;
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
                        order.status === 'Partially Received' ? 'bg-amber-100 text-amber-600' :
                        order.status === 'Sent' ? 'bg-accent/10 text-accent' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status === 'Received' ? <Check className="w-5 h-5" /> :
                         order.status === 'Partially Received' ? <AlertTriangle className="w-5 h-5" /> :
                         <Clock className="w-5 h-5" />}
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
                              <td className="py-2 text-sm text-gray-500 text-right">{formatOrderQty(item)}</td>
                              <td className="py-2 text-sm text-gray-500 text-right">£{item.pricePerUnit.toFixed(2)}</td>
                              <td className="py-2 text-sm font-medium text-gray-900 text-right">£{(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {(() => {
                        const shortfalls = getOrderShortfalls(order, receivingRecords);
                        if (shortfalls.length === 0) return null;
                        return (
                          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Shortage — {shortfalls.length} item{shortfalls.length !== 1 ? 's' : ''} short</span>
                            </div>
                            <table className="min-w-full">
                              <thead>
                                <tr>
                                  <th className="text-left text-[10px] font-medium text-amber-700 uppercase pb-1">Item</th>
                                  <th className="text-right text-[10px] font-medium text-amber-700 uppercase pb-1">Ordered</th>
                                  <th className="text-right text-[10px] font-medium text-amber-700 uppercase pb-1">Received</th>
                                  <th className="text-right text-[10px] font-medium text-amber-700 uppercase pb-1">Missing</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-200/60">
                                {shortfalls.map(s => {
                                  const invItem = getInvItem(s.inventoryItemId);
                                  const fmt = (qty: number) => invItem ? formatPacksLabel(qty, invItem) : `${qty}`;
                                  return (
                                    <tr key={s.inventoryItemId}>
                                      <td className="py-1.5 text-sm text-amber-900">{s.name}</td>
                                      <td className="py-1.5 text-sm text-amber-900 text-right">{fmt(s.orderedQuantity)}</td>
                                      <td className="py-1.5 text-sm text-amber-900 text-right">{fmt(s.receivedQuantity)}</td>
                                      <td className="py-1.5 text-sm font-bold text-amber-900 text-right">{fmt(s.shortfallQuantity)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="mt-3 flex justify-end">
                              <Button
                                onClick={() => openShortageEmail(order)}
                                variant="secondary"
                                className="text-xs flex items-center gap-2 border-amber-300 bg-white hover:bg-amber-100"
                              >
                                <Mail className="w-4 h-4" />
                                Draft Shortage Email
                              </Button>
                            </div>
                          </div>
                        );
                      })()}

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
                        {(order.status === 'Sent' || order.status === 'Partially Received') && (
                          <Button onClick={() => setReceivingOrder(order)} variant="primary">
                            {order.status === 'Partially Received' ? 'Receive Remaining' : 'Receive Delivery'}
                          </Button>
                        )}
                        {order.status === 'Partially Received' && (
                          <Button
                            onClick={() => {
                              if (window.confirm(`Close this order from ${order.supplier} as complete? The remaining outstanding quantity will NOT be added to stock — only use this if the rest is confirmed cancelled or backordered separately.`)) {
                                onCloseOrder(order.id);
                                const shortfalls = getOrderShortfalls(order, receivingRecords);
                                if (shortfalls.length > 0 && window.confirm(`This order is closing with ${shortfalls.length} item${shortfalls.length !== 1 ? 's' : ''} still short. Draft a shortage email to ${order.supplier} now?`)) {
                                  openShortageEmail(order);
                                }
                              }
                            }}
                            variant="secondary"
                          >
                            Close Order (Rest Not Coming)
                          </Button>
                        )}
                        {suppliers.find(s => s.name === order.supplier)?.email && (
                          <Button 
                            onClick={() => {
                              const supplierDetails = suppliers.find(s => s.name === order.supplier);
                              if (!supplierDetails?.email) return;
                              const subject = `Order from Backbone Hub - ${new Date(order.date).toLocaleDateString()}`;
                              const body = `Please find our order below:\n\n${order.items.map(i => `- ${formatOrderQty(i)} of ${i.name}`).join('\n')}\n\nTotal: £${order.totalAmount.toFixed(2)}`;
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

      <ReceiveGoodsModal
        order={receivingOrder}
        inventoryItems={inventoryItems}
        receivingRecords={receivingRecords}
        onClose={() => setReceivingOrder(null)}
        onConfirm={onReceiveDelivery}
      />
    </div>
  );
};
