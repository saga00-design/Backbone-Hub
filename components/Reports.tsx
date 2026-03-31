import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, PoundSterling, FileText, Package, ArrowUpRight, ArrowDownRight, 
  Database, Filter, Calendar, Download, Building, Tag, Truck, Calculator,
  ChevronDown, Search, Info
} from 'lucide-react';
import { POSOrder, InventoryItem, Supplier, Invoice, Order, VatCode, Recipe } from '../types';
import { Button } from './Button';

interface ReportsProps {
  posOrders: POSOrder[];
  inventoryItems: InventoryItem[];
  suppliers: Supplier[];
  invoices: Invoice[];
  orders: Order[];
  recipes: Recipe[];
  onEditRecipe?: (id: string) => void;
  onEditInventoryItem?: (item: InventoryItem) => void;
}

const VAT_CODES: VatCode[] = ['STANDARD_20', 'REDUCED_5', 'ZERO_0', 'EXEMPT'];

export const Reports: React.FC<ReportsProps> = ({ posOrders, inventoryItems, suppliers, invoices, orders, recipes, onEditRecipe, onEditInventoryItem }) => {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [typeFilter, setTypeFilter] = useState<'All' | 'Dine-In' | 'Takeaway' | 'Delivery'>('All');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [vatCodeFilter, setVatCodeFilter] = useState<'All' | VatCode>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [vatTableFilter, setVatTableFilter] = useState<'All' | 'Has VAT' | 'No VAT' | 'Missing'>('All');
  const [vatTableSearch, setVatTableSearch] = useState('');

  const filteredOrders = useMemo(() => {
    return posOrders.filter(order => {
      const orderDate = order.createdAt.split('T')[0];
      const matchesDate = orderDate >= dateRange.start && orderDate <= dateRange.end;
      const matchesType = typeFilter === 'All' || order.type === typeFilter;
      
      // For VAT code filter, we check if any item in the order matches the VAT code
      // This is a bit complex because an order can have multiple VAT codes
      // But if the filter is set, we might want to filter the items themselves or the whole order
      // For simplicity, if any item matches, we include the order, but we'll filter items in the breakdown
      const matchesVat = vatCodeFilter === 'All' || order.items.some(item => item.vatCode === vatCodeFilter);
      const matchesPlatform = platformFilter === 'All' || order.platform === platformFilter;
      
      return matchesDate && matchesType && matchesVat && matchesPlatform;
    });
  }, [posOrders, dateRange, typeFilter, vatCodeFilter, platformFilter]);

  const platforms = useMemo(() => {
    const p = new Set<string>();
    posOrders.forEach(o => {
      if (o.platform) p.add(o.platform);
    });
    return ['All', ...Array.from(p)];
  }, [posOrders]);

  const salesReport = useMemo(() => {
    const totals = {
      grossSalesAll: 0,
      grossSalesVatable: 0,
      netSalesExVat: 0,
      outputVat: 0,
      zeroRatedSales: 0,
      exemptSales: 0,
      outOfScopeSales: 0,
      serviceCharge: 0,
      tips: 0,
      giftCardSales: 0,
      deliveryFees: 0,
      refunds: 0,
      discounts: 0,
      netSalesExVatPlusService: 0,
      serviceChargeByType: {
        'Dine-In': 0,
        'Takeaway': 0,
        'Delivery': 0,
        'Other': 0
      }
    };

    filteredOrders.forEach(order => {
      if (order.status === 'Paid') {
        totals.grossSalesAll += order.total;
        const sc = order.serviceCharge || 0;
        totals.serviceCharge += sc;
        
        if (order.type === 'Dine-In') totals.serviceChargeByType['Dine-In'] += sc;
        else if (order.type === 'Takeaway') totals.serviceChargeByType['Takeaway'] += sc;
        else if (order.type === 'Delivery') totals.serviceChargeByType['Delivery'] += sc;
        else totals.serviceChargeByType['Other'] += sc;

        totals.tips += order.tips || 0;
        totals.outputVat += order.vat || 0;

        // Gift card sales check (assuming payment method or specific item)
        order.payments?.forEach(p => {
          if (p.method === 'Card' && p.amount > 0) {
            // This is just a placeholder logic, usually gift cards are a specific method
          }
        });

        order.items.forEach(item => {
          if (!item.isVoided) {
            const itemGross = item.price * item.quantity;
            const itemDiscount = item.discount || 0;
            const itemNet = itemGross - itemDiscount;
            
            totals.discounts += itemDiscount;

            // VAT breakdown
            const vatRate = item.vatRate || 0;
            const itemVat = itemNet * (vatRate / (100 + vatRate));
            const itemNetExVat = itemNet - itemVat;

            if (item.vatCode === 'STANDARD_20' || item.vatCode === 'REDUCED_5') {
              totals.grossSalesVatable += itemNet;
            } else if (item.vatCode === 'ZERO_0') {
              totals.zeroRatedSales += itemNet;
            } else if (item.vatCode === 'EXEMPT') {
              totals.exemptSales += itemNet;
            }

            totals.netSalesExVat += itemNetExVat;
          }
        });

        if (order.type === 'Delivery') {
          // Placeholder for delivery fees
          // totals.deliveryFees += 2.50; 
        }
      } else if (order.status === 'Refunded') {
        totals.refunds += order.total;
      }
    });

    totals.netSalesExVatPlusService = totals.netSalesExVat + totals.serviceCharge;

    return totals;
  }, [filteredOrders]);

  const itemsReport = useMemo(() => {
    const itemStats: Record<string, { name: string; quantity: number; revenue: number; vatCode?: string }> = {};
    
    filteredOrders.forEach(order => {
      if (order.status === 'Paid') {
        order.items.forEach(item => {
          if (!item.isVoided) {
            if (!itemStats[item.recipeId]) {
              itemStats[item.recipeId] = { name: item.name, quantity: 0, revenue: 0, vatCode: item.vatCode };
            }
            itemStats[item.recipeId].quantity += item.quantity;
            itemStats[item.recipeId].revenue += (item.price * item.quantity);
          }
        });
      }
    });

    const sorted = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity);
    const bestSellers = sorted.slice(0, 5);
    const worstSellers = sorted.filter(i => i.quantity > 0).slice(-5).reverse();
    const inventoryValue = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);

    return { bestSellers, worstSellers, inventoryValue, itemStats: Object.values(itemStats) };
  }, [filteredOrders, inventoryItems]);

  const supplierReport = useMemo(() => {
    const stats: Record<string, { name: string; ordered: number; used: number; owed: number }> = {};

    suppliers.forEach(s => {
      stats[s.id] = { name: s.name, ordered: 0, used: 0, owed: 0 };
    });

    // How much we ordered
    orders.forEach(o => {
      const sId = suppliers.find(s => s.name === o.supplier)?.id;
      if (sId && stats[sId]) {
        stats[sId].ordered += o.totalAmount;
      }
    });

    // How much we owe (Unpaid invoices)
    invoices.forEach(inv => {
      if (inv.paymentStatus === 'Unpaid' && inv.supplierId && stats[inv.supplierId]) {
        stats[inv.supplierId].owed += inv.totalAmount;
      }
    });

    return Object.values(stats);
  }, [suppliers, orders, invoices]);

  const combinedVatItems = useMemo(() => {
    const combined = [
      ...recipes.map(r => ({ ...r, itemType: 'recipe' as const })),
      ...inventoryItems.map(i => ({ ...i, itemType: 'inventory' as const }))
    ];
    return combined;
  }, [recipes, inventoryItems]);

  const filteredVatItems = useMemo(() => {
    return combinedVatItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(vatTableSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (vatTableFilter === 'All') return true;
      if (vatTableFilter === 'Has VAT') return item.vatCode === 'STANDARD_20' || item.vatCode === 'REDUCED_5';
      if (vatTableFilter === 'No VAT') return item.vatCode === 'ZERO_0' || item.vatCode === 'EXEMPT';
      if (vatTableFilter === 'Missing') return !item.vatCode;
      return true;
    });
  }, [combinedVatItems, vatTableFilter, vatTableSearch]);

  const salesByDay = useMemo(() => {
    const days: Record<string, number> = {};
    filteredOrders.forEach(order => {
      if (order.status === 'Paid') {
        const date = order.createdAt.split('T')[0];
        days[date] = (days[date] || 0) + order.total;
      }
    });
    return Object.entries(days).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  return (
    <div className="p-8 space-y-8 bg-main-bg min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-text-navy tracking-tight">Reports & Analytics</h1>
          <p className="text-text-muted mt-1 italic font-serif">Deep dive into your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-secondary-surface text-text-navy border border-border-grey hover:bg-white flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button className="bg-accent text-white hover:opacity-90 flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-accent/20">
            <TrendingUp className="w-4 h-4" /> Generate PDF
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-text-navy font-bold uppercase tracking-widest text-xs mb-4">
          <Filter className="w-4 h-4 text-accent" /> Reporting Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
              />
              <span className="text-text-muted text-xs">to</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Order Type</label>
            <div className="relative">
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
              >
                <option value="All">All Types</option>
                <option value="Dine-In">Dine-In</option>
                <option value="Takeaway">Takeaway</option>
                <option value="Delivery">Delivery</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Platform</label>
            <div className="relative">
              <select 
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
              >
                {platforms.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">VAT Code</label>
            <div className="relative">
              <select 
                value={vatCodeFilter}
                onChange={(e) => setVatCodeFilter(e.target.value as any)}
                className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
              >
                <option value="All">All VAT Codes</option>
                {VAT_CODES.map(code => (
                  <option key={code} value={code}>{code.replace('_', ' ')}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Revenue Category</label>
            <div className="relative">
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
              >
                <option value="All">All Categories</option>
                <option value="Food">Food</option>
                <option value="Beverage">Beverage</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Sales Breakdown */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <PoundSterling className="w-6 h-6 text-accent" />
          <h2 className="text-2xl font-serif font-bold text-text-navy">Sales Performance Breakdown</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Gross Sales (Total)</p>
            <p className="text-3xl font-serif font-bold text-text-navy">£{salesReport.grossSalesAll.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-border-grey flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-text-muted">VATable</span>
              <span className="text-text-navy">£{salesReport.grossSalesVatable.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Net Sales (Excl. VAT)</p>
            <p className="text-3xl font-serif font-bold text-text-navy">£{salesReport.netSalesExVat.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-border-grey flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-text-muted">Incl. Service</span>
              <span className="text-text-navy">£{salesReport.netSalesExVatPlusService.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">VAT to Return (HMRC)</p>
            <p className="text-3xl font-serif font-bold text-accent">£{salesReport.outputVat.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-border-grey flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-text-muted">Total Service</span>
              <span className="text-text-navy">£{salesReport.serviceCharge.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-6 bg-card-bg border border-border-grey rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Total Discounts</p>
            <p className="text-3xl font-serif font-bold text-cta">£{salesReport.discounts.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-border-grey flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-text-muted">Refunds</span>
              <span className="text-cta">£{salesReport.refunds.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
            <h3 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Sales Trend (Daily)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#486581" strokeWidth={3} dot={{ r: 4, fill: '#486581' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
            <h3 className="text-lg font-bold text-text-navy mb-6 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-accent" />
              Service Charge Breakdown
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Dine-In</p>
                  <p className="text-xl font-serif font-bold text-text-navy">£{salesReport.serviceChargeByType['Dine-In'].toFixed(2)}</p>
                </div>
                <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Takeaway</p>
                  <p className="text-xl font-serif font-bold text-text-navy">£{salesReport.serviceChargeByType['Takeaway'].toFixed(2)}</p>
                </div>
                <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Delivery</p>
                  <p className="text-xl font-serif font-bold text-text-navy">£{salesReport.serviceChargeByType['Delivery'].toFixed(2)}</p>
                </div>
                <div className="p-4 bg-secondary-surface rounded-xl border border-border-grey">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Other</p>
                  <p className="text-xl font-serif font-bold text-text-navy">£{salesReport.serviceChargeByType['Other'].toFixed(2)}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border-grey flex items-center justify-between">
                <span className="text-xs font-bold text-text-navy uppercase tracking-widest">Total Service Charge</span>
                <span className="text-2xl font-serif font-bold text-accent">£{salesReport.serviceCharge.toFixed(2)}</span>
              </div>
              
              <p className="text-[10px] text-text-muted italic">
                * Service charge is typically applied to Dine-In orders at a standard rate (e.g. 12.5%).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tax Compliance & Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-serif font-bold text-text-navy">Tax Compliance & Items</h2>
          </div>
          <div className="bg-card-bg rounded-2xl border border-border-grey shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-border-grey flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-navy uppercase tracking-widest">HMRC Compliance Check</h3>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${combinedVatItems.some(item => !item.vatCode) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {combinedVatItems.some(item => !item.vatCode) ? 'Review Needed' : 'Compliant'}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search items..." 
                    value={vatTableSearch}
                    onChange={(e) => setVatTableSearch(e.target.value)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 pl-9 pr-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div className="relative w-36">
                  <select 
                    value={vatTableFilter}
                    onChange={(e) => setVatTableFilter(e.target.value as any)}
                    className="w-full bg-secondary-surface border border-border-grey rounded-xl py-2 px-3 text-xs text-text-navy focus:ring-2 focus:ring-accent outline-none appearance-none"
                  >
                    <option value="All">All Items</option>
                    <option value="Has VAT">Has VAT</option>
                    <option value="No VAT">No VAT</option>
                    <option value="Missing">Missing VAT</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-secondary-surface text-[10px] font-bold text-text-muted uppercase tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">VAT Code</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey">
                  {filteredVatItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-xs text-text-muted italic">
                        No items found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredVatItems.map((item) => (
                      <tr 
                        key={`${item.itemType}-${item.id}`} 
                        className="hover:bg-secondary-surface transition-colors cursor-pointer"
                        onClick={() => {
                          if (item.itemType === 'recipe') {
                            onEditRecipe && onEditRecipe(item.id);
                          } else {
                            onEditInventoryItem && onEditInventoryItem(item as any);
                          }
                        }}
                      >
                        <td className="px-6 py-4 text-xs font-bold text-text-navy">{item.name}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{item.itemType === 'recipe' ? 'Recipe' : 'Inventory'}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{item.vatCode || 'MISSING'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.vatCode ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-[10px] font-bold text-text-navy uppercase tracking-widest">{item.vatCode ? 'Verified' : 'Review'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-serif font-bold text-text-navy">Inventory & Best Sellers</h2>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Best Sellers</p>
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              </div>
              <div className="space-y-4">
                {itemsReport.bestSellers.map((item, idx) => {
                  const fullItem = inventoryItems.find(i => i.name === item.name);
                  return (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between cursor-pointer hover:bg-secondary-surface p-2 -mx-2 rounded-lg transition-colors"
                      onClick={() => fullItem && onEditInventoryItem && onEditInventoryItem(fullItem)}
                    >
                      <span className="text-xs font-bold text-text-navy truncate max-w-[120px]">{item.name}</span>
                      <span className="text-[10px] font-bold text-text-muted">{item.quantity} units</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Worst Sellers</p>
                <ArrowDownRight className="w-4 h-4 text-cta" />
              </div>
              <div className="space-y-4">
                {itemsReport.worstSellers.map((item, idx) => {
                  const fullItem = inventoryItems.find(i => i.name === item.name);
                  return (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between cursor-pointer hover:bg-secondary-surface p-2 -mx-2 rounded-lg transition-colors"
                      onClick={() => fullItem && onEditInventoryItem && onEditInventoryItem(fullItem)}
                    >
                      <span className="text-xs font-bold text-text-navy truncate max-w-[120px]">{item.name}</span>
                      <span className="text-[10px] font-bold text-text-muted">{item.quantity} units</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="bg-card-bg p-6 rounded-2xl border border-border-grey shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Total Inventory Value</p>
              <p className="text-3xl font-serif font-bold text-text-navy">£{itemsReport.inventoryValue.toFixed(2)}</p>
            </div>
            <Database className="w-10 h-10 text-accent/20" />
          </div>
        </section>
      </div>

      {/* Supplier Report */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Truck className="w-6 h-6 text-accent" />
          <h2 className="text-2xl font-serif font-bold text-text-navy">Supplier Performance & Owed</h2>
        </div>
        <div className="bg-card-bg rounded-2xl border border-border-grey shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary-surface text-[10px] font-bold text-text-muted uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Total Ordered</th>
                  <th className="px-6 py-4">Amount Owed</th>
                  <th className="px-6 py-4">Usage Efficiency</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grey">
                {supplierReport.map((s, idx) => (
                  <tr key={idx} className="hover:bg-secondary-surface transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-text-navy">{s.name}</td>
                    <td className="px-6 py-4 text-xs font-serif text-text-navy">£{s.ordered.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs font-serif text-cta font-bold">£{s.owed.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-border-grey h-1.5 rounded-full overflow-hidden">
                        <div className="bg-accent h-full" style={{ width: '75%' }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${s.owed > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {s.owed > 0 ? 'Payment Due' : 'Up to Date'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
