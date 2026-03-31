import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, PoundSterling, FileText, Package, ArrowUpRight, ArrowDownRight, Database } from 'lucide-react';
import { POSOrder, InventoryItem } from '../../types';

interface ReportingProps {
  orders: POSOrder[];
  inventoryItems: InventoryItem[];
}

const COLORS = ['#486581', '#627d98', '#829ab1', '#9fb3c8', '#bcccdc'];

export const Reporting: React.FC<ReportingProps> = ({ orders, inventoryItems }) => {
  const {
    grossSales,
    netSales,
    vatCollected,
    itemsSold,
    salesByDay,
    categorySales,
    bestSeller,
    worstSeller,
    inventoryValue
  } = useMemo(() => {
    let gross = 0;
    let net = 0;
    let vat = 0;
    let items = 0;
    const dailySales: Record<string, number> = {};
    const catSales: Record<string, number> = {};
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    orders.forEach(order => {
      if (order.status === 'Paid') {
        gross += order.total || 0;
        net += order.subtotal || 0;
        vat += order.vat || 0;
        
        const date = new Date(order.createdAt).toLocaleDateString('en-GB', { weekday: 'short' });
        dailySales[date] = (dailySales[date] || 0) + (order.total || 0);

        order.items.forEach(item => {
          if (!item.isVoided) {
            items += item.quantity;
            
            // Category approximation (assuming course or station maps to category for simplicity if not available)
            const cat = item.course || 'Other';
            catSales[cat] = (catSales[cat] || 0) + (item.price * item.quantity);

            if (!itemSales[item.recipeId]) {
              itemSales[item.recipeId] = { name: item.name, quantity: 0, revenue: 0 };
            }
            itemSales[item.recipeId].quantity += item.quantity;
            itemSales[item.recipeId].revenue += (item.price * item.quantity);
          }
        });
      }
    });

    const salesByDayArray = Object.entries(dailySales).map(([name, sales]) => ({
      name,
      sales,
      budget: 1000 // Mock budget for now
    }));

    const categorySalesArray = Object.entries(catSales).map(([name, value]) => ({
      name,
      value
    }));

    const sortedItems = Object.values(itemSales).sort((a, b) => b.quantity - a.quantity);
    const best = sortedItems.length > 0 ? sortedItems[0] : null;
    const worst = sortedItems.length > 0 ? sortedItems[sortedItems.length - 1] : null;

    const invValue = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);

    return {
      grossSales: gross,
      netSales: net,
      vatCollected: vat,
      itemsSold: items,
      salesByDay: salesByDayArray.length > 0 ? salesByDayArray : [
        { name: 'Mon', sales: 0, budget: 1000 },
        { name: 'Tue', sales: 0, budget: 1000 },
        { name: 'Wed', sales: 0, budget: 1000 },
        { name: 'Thu', sales: 0, budget: 1000 },
        { name: 'Fri', sales: 0, budget: 1200 },
        { name: 'Sat', sales: 0, budget: 1500 },
        { name: 'Sun', sales: 0, budget: 1500 },
      ],
      categorySales: categorySalesArray.length > 0 ? categorySalesArray : [{ name: 'No Data', value: 1 }],
      bestSeller: best,
      worstSeller: worst,
      inventoryValue: invValue
    };
  }, [orders, inventoryItems]);

  return (
    <div className="h-full p-8 space-y-8 overflow-y-auto bg-[#0f0f0f]">
      <header>
        <h1 className="text-4xl font-serif font-bold text-[#d9e2ec] tracking-tight">Reporting</h1>
        <p className="text-[#666] mt-1 italic font-serif">Performance & Financial Overview</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Gross Sales</p>
            <PoundSterling className="w-5 h-5 text-[#486581]" />
          </div>
          <p className="text-2xl font-serif text-[#d9e2ec]">£{grossSales.toFixed(2)}</p>
        </div>
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Net Sales</p>
            <PoundSterling className="w-5 h-5 text-[#627d98]" />
          </div>
          <p className="text-2xl font-serif text-[#d9e2ec]">£{netSales.toFixed(2)}</p>
        </div>
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">VAT (HMRC)</p>
            <FileText className="w-5 h-5 text-[#2d5a27]" />
          </div>
          <p className="text-2xl font-serif text-[#d9e2ec]">£{vatCollected.toFixed(2)}</p>
          <p className="text-xs text-[#666] mt-2">Amount owed to HMRC</p>
        </div>
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Items Sold</p>
            <Package className="w-5 h-5 text-[#4a4a4a]" />
          </div>
          <p className="text-2xl font-serif text-[#d9e2ec]">{itemsSold}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Best Seller</p>
            <ArrowUpRight className="w-5 h-5 text-green-500" />
          </div>
          {bestSeller ? (
            <>
              <p className="text-xl font-serif text-[#d9e2ec] truncate">{bestSeller.name}</p>
              <p className="text-sm text-[#666] mt-1">{bestSeller.quantity} sold (£{bestSeller.revenue.toFixed(2)})</p>
            </>
          ) : (
            <p className="text-[#666]">No data yet</p>
          )}
        </div>
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Worst Seller</p>
            <ArrowDownRight className="w-5 h-5 text-red-500" />
          </div>
          {worstSeller ? (
            <>
              <p className="text-xl font-serif text-[#d9e2ec] truncate">{worstSeller.name}</p>
              <p className="text-sm text-[#666] mt-1">{worstSeller.quantity} sold (£{worstSeller.revenue.toFixed(2)})</p>
            </>
          ) : (
            <p className="text-[#666]">No data yet</p>
          )}
        </div>
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#666]">Inventory Value</p>
            <Database className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-serif text-[#d9e2ec]">£{inventoryValue.toFixed(2)}</p>
          <p className="text-xs text-[#666] mt-2">Total cost of current stock</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <h3 className="text-lg font-bold text-[#d9e2ec] mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#486581]" />
            Sales vs Budget
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', color: '#d9e2ec' }} />
                <Legend />
                <Bar dataKey="sales" fill="#486581" name="Actual Sales" />
                <Bar dataKey="budget" fill="#666" name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl">
          <h3 className="text-lg font-bold text-[#d9e2ec] mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#486581]" />
            Category Sales Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categorySales} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" nameKey="name">
                  {categorySales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', color: '#d9e2ec' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
