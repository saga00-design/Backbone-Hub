import React, { useState } from 'react';
import { Order, OrderItem, Supplier, InventoryItem } from '../types';
import { ShoppingCart, Package, Search, Filter, Plus, Minus, Check, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';

interface OrdersProps {
  cart: OrderItem[];
  orders: Order[];
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  onPlaceOrder: (supplier: string, items: OrderItem[]) => void;
  onUpdateCart: (item: InventoryItem, quantity: number) => void;
  onUpdateOrderStatus: (id: string, status: 'Draft' | 'Sent' | 'Received') => void;
}

export const Orders: React.FC<OrdersProps> = ({ 
  cart, 
  orders, 
  suppliers, 
  inventoryItems, 
  onPlaceOrder, 
  onUpdateCart,
  onUpdateOrderStatus 
}) => {
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

  // Group cart items by supplier
  const cartBySupplier = cart.reduce((acc, item) => {
    const supplier = item.supplier || 'Unknown Supplier';
    if (!acc[supplier]) acc[supplier] = [];
    acc[supplier].push(item);
    return acc;
  }, {} as Record<string, OrderItem[]>);

  const handlePlaceOrder = (supplier: string) => {
    if (cartBySupplier[supplier]) {
      onPlaceOrder(supplier, cartBySupplier[supplier]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Orders & Purchasing</h2>
        <div className="flex space-x-2 bg-white rounded-lg shadow-sm p-1">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'create' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cart')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'cart' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:text-gray-700'
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
              activeTab === 'history' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <Package className="w-4 h-4 mr-2" />
              Order History
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="relative rounded-md shadow-sm flex-1 min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
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
                  className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border bg-white"
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
                  className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border bg-white"
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
                  className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border bg-white"
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        £{item.pricePerUnit.toFixed(2)} / {item.unit}
                      </td>
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
                            className="p-1 rounded-full text-brand-600 hover:bg-brand-50"
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
                                    className="p-1 rounded-full text-brand-600 hover:bg-brand-50"
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
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                    {supplierDetails?.email && (
                      <Button 
                        onClick={() => {
                          const subject = `Order from Backbone Hub - ${new Date().toLocaleDateString()}`;
                          const body = `Please find our order below:\n\n${items.map(i => `- ${i.quantity} ${i.unit} of ${i.name}`).join('\n')}\n\nTotal: £${totalAmount.toFixed(2)}`;
                          window.open(`mailto:${supplierDetails.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                        }} 
                        variant="secondary"
                      >
                        Email Supplier
                      </Button>
                    )}
                    <Button onClick={() => handlePlaceOrder(supplier)} variant="primary">
                      Place Order with {supplier}
                    </Button>
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
                        order.status === 'Sent' ? 'bg-blue-100 text-blue-600' :
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
