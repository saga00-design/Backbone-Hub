
import React, { useMemo, useState } from 'react';
import { InventoryItem, SalesImportRecord } from '../types';
import { TrendingUp, AlertTriangle, PoundSterling, Brain, RefreshCw, ArrowRight, Banknote, ShoppingCart, Calendar, Clock, BarChart3, Bot, BookOpen } from 'lucide-react';
import { Button } from './Button';
import { GoogleGenAI, Type } from '@google/genai';
import { handleAiError } from '../services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface DashboardProps {
  items: InventoryItem[];
  salesHistory: SalesImportRecord[];
  totalRevenue: number;
  setCurrentView?: (view: any) => void;
  onAddToCart?: (item: InventoryItem, quantity: number) => void;
}

interface Alert {
  id: string;
  type: 'REORDER' | 'EXPIRY';
  priority: 'high' | 'medium';
  title: string;
  message: string;
  action: string;
  targetView?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ items, salesHistory, totalRevenue, setCurrentView, onAddToCart }) => {
  const [forecast, setForecast] = useState<string | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  const handleForecast = async () => {
    setIsForecasting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Analyze the following sales history and current inventory levels to forecast future stock needs.
      Sales History: ${JSON.stringify(salesHistory.slice(0, 20))}
      Inventory: ${JSON.stringify(items.map(i => ({ name: i.name, quantity: i.quantity, minStockLevel: i.minStockLevel })))}
      Provide a concise forecast and recommendations for stock needs.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setForecast(response.text || 'No forecast available.');
    } catch (error) {
      const message = handleAiError(error);
      setForecast(message);
    } finally {
      setIsForecasting(false);
    }
  };
  
  const totalValue = items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.pricePerUnit) || 0;
    return acc + (q * p);
  }, 0);

  const lowStockItems = items.filter(item => item.quantity <= item.minStockLevel);
  const totalItems = items.length;
  
  const triggerAIChat = (message: string) => {
    window.dispatchEvent(new CustomEvent('inventory-ai-chat', { detail: { message } }));
  };

  const [subCategoryFilter, setSubCategoryFilter] = React.useState<string>('All');

  // Calculate Value per Sub Category
  const subCategoryValueMap = items.reduce((acc: Record<string, number>, item) => {
    const key = item.subCategory || item.category || 'Uncategorized';
    const currentValue = acc[key] || 0;
    
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.pricePerUnit) || 0;
    const itemValue = quantity * price;
    
    acc[key] = currentValue + itemValue;
    return acc;
  }, {} as Record<string, number>);

  const subCategoryBreakdown = Object.entries(subCategoryValueMap)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  const subCategories = useMemo(() => {
    const subs = new Set(items.map(item => item.subCategory || item.category || 'Uncategorized'));
    return ['All', ...Array.from(subs)].sort();
  }, [items]);

  const displayedBreakdown = useMemo(() => {
    if (subCategoryFilter === 'All') return subCategoryBreakdown;
    return subCategoryBreakdown.filter(cat => cat.name === subCategoryFilter);
  }, [subCategoryBreakdown, subCategoryFilter]);

  // Generate Alerts Locally (Instant)
  const alerts = useMemo(() => {
    const generatedAlerts: Alert[] = [];
    const today = new Date();

    items.forEach(item => {
        // 1. Expiry Check
        if (item.expiryDate) {
            const expiry = new Date(item.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                generatedAlerts.push({
                    id: `exp-${item.id}`,
                    type: 'EXPIRY',
                    priority: 'high',
                    title: item.name,
                    message: `Item expired on ${item.expiryDate}.`,
                    action: `Dispose and replace stock from ${item.supplier || 'supplier'}`,
                    targetView: 'orders'
                });
            } else if (diffDays <= 7) {
                generatedAlerts.push({
                    id: `exp-${item.id}`,
                    type: 'EXPIRY',
                    priority: 'medium',
                    title: item.name,
                    message: `Expires in ${diffDays} days (${item.expiryDate}).`,
                    action: `Use priority or discount`,
                    targetView: 'inventory'
                });
            }
        }

        // 2. Stock Level Check
        let isLowStock = false;
        let reorderQty = 0;
        let message = '';

        if (item.dailyUsageRate && item.dailyUsageRate > 0) {
            const daysRemaining = item.quantity / item.dailyUsageRate;
            if (daysRemaining < 3) {
                isLowStock = true;
                // Target 14 days coverage
                reorderQty = Math.ceil((item.dailyUsageRate * 14) - item.quantity);
                message = `Projected to run out in ${daysRemaining.toFixed(1)} days (Usage: ${item.dailyUsageRate} ${item.unit}/day).`;
            }
        } else if (item.quantity <= item.minStockLevel) {
            isLowStock = true;
            // Target 2x Min Stock if no usage data
            reorderQty = Math.ceil((item.minStockLevel * 2) - item.quantity);
            message = `Stock level (${item.quantity} ${item.unit}) below minimum (${item.minStockLevel} ${item.unit}).`;
        }

        if (isLowStock && reorderQty > 0) {
             generatedAlerts.push({
                id: `stock-${item.id}`,
                type: 'REORDER',
                priority: 'high',
                title: item.name,
                message: message,
                action: `Order ${reorderQty} ${item.unit} from ${item.supplier || 'supplier'}`,
                targetView: 'orders'
            });
        }
    });

    return generatedAlerts.sort((a, b) => {
        if (a.type === 'EXPIRY' && b.type !== 'EXPIRY') return -1;
        if (a.type !== 'EXPIRY' && b.type === 'EXPIRY') return 1;
        return 0;
    });
  }, [items]);

  // Forecasting Logic
  const forecastingData = useMemo(() => {
    return items
      .filter(item => item.dailyUsageRate && item.dailyUsageRate > 0)
      .map(item => {
        const daysRemaining = Math.floor(item.quantity / item.dailyUsageRate!);
        const status = daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'safe';
        return {
          ...item,
          daysRemaining,
          status
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8); // Show top 8 items at risk
  }, [items]);

  const COLORS = ['#F27D26', '#141414', '#5A5A40', '#E4E3E0', '#8E9299', '#4a4a4a'];

  return (
    <div className="space-y-6">
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button 
          onClick={() => setCurrentView?.('recipes')}
          className="flex items-center p-5 bg-card-bg rounded-2xl shadow-sm border border-border-grey hover:border-accent hover:shadow-lg transition-all group relative overflow-hidden"
        >
          <div className="p-3 bg-primary-surface rounded-xl group-hover:bg-secondary-surface transition-colors border border-border-grey/50 group-hover:border-accent/20">
            <BookOpen className="h-5 w-5 text-accent" />
          </div>
          <div className="ml-4 text-left relative z-10">
            <p className="text-sm font-black text-text-navy uppercase tracking-tight">Recipe Book</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Manage & Download</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-text-muted/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </button>

        <button 
          onClick={() => setCurrentView?.('inventory')}
          className="flex items-center p-5 bg-card-bg rounded-2xl shadow-sm border border-border-grey hover:border-accent hover:shadow-lg transition-all group relative overflow-hidden"
        >
          <div className="p-3 bg-success/10 rounded-xl group-hover:bg-success/20 transition-colors border border-success/20">
            <ShoppingCart className="h-5 w-5 text-success" />
          </div>
          <div className="ml-4 text-left relative z-10">
            <p className="text-sm font-black text-text-navy uppercase tracking-tight">Inventory</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Levels & Orders</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-text-muted/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </button>

        <button 
          onClick={() => setCurrentView?.('pos')}
          className="flex items-center p-5 bg-card-bg rounded-2xl shadow-sm border border-border-grey hover:border-accent hover:shadow-lg transition-all group relative overflow-hidden"
        >
          <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors border border-accent/20">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <div className="ml-4 text-left relative z-10">
            <p className="text-sm font-black text-text-navy uppercase tracking-tight">Backbone POS</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Active Sales</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-text-muted/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </button>

        <button 
          onClick={() => triggerAIChat("Give me a summary of my business performance")}
          className="flex items-center p-5 bg-card-bg rounded-2xl shadow-sm border border-border-grey hover:border-accent hover:shadow-lg transition-all group relative overflow-hidden"
        >
          <div className="p-3 bg-secondary-surface rounded-xl group-hover:bg-primary-surface transition-colors border border-border-grey/50 group-hover:border-accent/20">
            <Brain className="h-5 w-5 text-accent" />
          </div>
          <div className="ml-4 text-left relative z-10">
            <p className="text-sm font-black text-text-navy uppercase tracking-tight">AI Insights</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Strategy & Tips</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-text-muted/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </button>
      </div>

      {/* Smart Alerts Section */}
      <div className="bg-primary-surface border border-border-grey rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center">
            <div className="p-2.5 bg-accent/10 rounded-xl mr-3 border border-accent/20">
              <Brain className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-navy uppercase tracking-tight">AI Inventory Intelligence</h2>
              <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Real-time critical actions</p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            className="text-[10px] font-black uppercase tracking-widest h-10 px-5 bg-card-bg border-border-grey text-text-navy hover:border-accent hover:text-accent transition-all rounded-xl shadow-sm flex-shrink-0 w-full sm:w-auto flex items-center justify-center" 
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            <span>Refresh System</span>
          </Button>
        </div>

        {alerts.length === 0 ? (
            <div className="text-center py-12 text-text-muted bg-card-bg rounded-2xl border border-dashed border-border-grey text-sm">
                <p className="font-bold uppercase tracking-widest text-xs opacity-50">System Status: Optimal</p>
                <p className="mt-2">No critical stock or expiry issues detected.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`bg-card-bg p-5 rounded-2xl border border-border-grey shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-xl hover:border-accent/40 transition-all group relative overflow-hidden ${
                    alert.type === 'EXPIRY' ? 'border-l-4 border-l-cta' : 'border-l-4 border-l-warning'
                  }`}
                  onClick={() => {
                    if (setCurrentView && alert.targetView) {
                      setCurrentView(alert.targetView);
                    }
                  }}
                >
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <h4 className="font-black text-text-navy text-sm leading-tight group-hover:text-accent transition-colors uppercase tracking-tight">{alert.title}</h4>
                        <span className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-lg flex-shrink-0 tracking-widest border ${
                           alert.type === 'EXPIRY' ? 'bg-error/10 text-cta border-cta/20' : 'bg-warning/10 text-text-navy border-warning/20'
                        }`}>
                          {alert.type}
                        </span>
                    </div>
                    <p className="text-[11px] text-text-muted mb-4 leading-relaxed line-clamp-2 font-medium">{alert.message}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border-grey/50 relative z-10">
                    <div className={`flex items-center text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl flex-1 mr-2 truncate ${
                      alert.type === 'EXPIRY' ? 'text-cta bg-error/5' : 'text-accent bg-accent/5'
                    }`}>
                      <ArrowRight className="h-3 w-3 mr-2 flex-shrink-0" />
                      <span className="truncate" title={alert.action}>{alert.action}</span>
                    </div>
                    {alert.type === 'REORDER' && onAddToCart && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const item = items.find(i => i.id === alert.id.replace('stock-', ''));
                          if (item) {
                            const match = alert.action.match(/Order (\d+)/);
                            const qty = match ? parseInt(match[1]) : 1;
                            onAddToCart(item, qty);
                          }
                        }}
                        className="p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex-shrink-0"
                        title="Add to Cart"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Subtle background decoration */}
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                    {alert.type === 'EXPIRY' ? <Clock className="h-24 w-24" /> : <AlertTriangle className="h-24 w-24" />}
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-success/10 rounded-xl">
                <Banknote className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Total Sales</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">£{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-text-muted/10 rounded-xl">
                <PoundSterling className="h-5 w-5 sm:h-6 sm:w-6 text-text-muted" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Holding Value</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">£{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                </dl>
                <button 
                  onClick={() => triggerAIChat("tell me how can we improve this")}
                  className="mt-4 px-3 py-1.5 bg-accent/5 text-accent text-[9px] font-black uppercase tracking-widest rounded-xl border border-accent/20 hover:bg-accent hover:text-white transition-all shadow-sm inline-flex items-center group/btn"
                >
                  <Brain className="h-3 w-3 mr-2 group-hover/btn:scale-110 transition-transform" />
                  Improve
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-cta/10 rounded-xl">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-cta" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Low Stock</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">{lowStockItems.length}</dd>
                </dl>
                <button 
                  onClick={() => triggerAIChat("tell me which items are low in stock")}
                  className="mt-4 px-3 py-1.5 bg-cta/5 text-cta text-[9px] font-black uppercase tracking-widest rounded-xl border border-cta/20 hover:bg-cta hover:text-white transition-all shadow-sm inline-flex items-center group/btn"
                >
                  <AlertTriangle className="h-3 w-3 mr-2 group-hover/btn:scale-110 transition-transform" />
                  Check
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg overflow-hidden shadow-sm rounded-2xl border border-border-grey hover:border-accent/30 hover:shadow-md transition-all duration-300">
          <div className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-accent/10 rounded-xl">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-[10px] sm:text-xs font-black text-text-muted uppercase tracking-widest truncate">Health</dt>
                  <dd className="text-base sm:text-xl font-black text-text-navy mt-1">
                    {totalItems > 0 ? Math.round(((totalItems - lowStockItems.length) / totalItems) * 100) : 0}%
                  </dd>
                </dl>
                <button 
                  onClick={() => triggerAIChat("tell me how can we improve")}
                  className="mt-4 px-3 py-1.5 bg-accent/5 text-accent text-[9px] font-black uppercase tracking-widest rounded-xl border border-accent/20 hover:bg-accent hover:text-white transition-all shadow-sm inline-flex items-center group/btn"
                >
                  <TrendingUp className="h-3 w-3 mr-2 group-hover/btn:scale-110 transition-transform" />
                  Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Categories Breakdown */}
      <div className="bg-card-bg shadow rounded-lg p-6 border border-border-grey">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg leading-6 font-medium text-text-navy">Total Value by Sub Category</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Narrow down:</span>
            <select 
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              className="text-sm border border-border-grey rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer bg-card-bg shadow-sm min-w-[180px] text-text-navy"
            >
              {subCategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subCategoryBreakdown.slice(0, 6)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subCategoryBreakdown.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`£${value.toFixed(2)}`, 'Value']}
                  contentStyle={{ backgroundColor: '#151619', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {displayedBreakdown.map((cat) => (
                <div 
                  key={cat.name} 
                  className="bg-main-bg p-2 rounded border border-border-grey flex flex-col justify-between h-16 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => triggerAIChat(`filter by sub category ${cat.name}`)}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider truncate" title={cat.name}>{cat.name}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-sm font-bold text-text-navy">£{cat.value.toFixed(0)}</span>
                  </div>
                </div>
              ))}
              {displayedBreakdown.length === 0 && (
                 <p className="text-text-muted text-sm col-span-full">No inventory data to display.</p>
              )}
            </div>
            
            {subCategoryFilter !== 'All' && (
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => setSubCategoryFilter('All')}
                  className="text-xs text-text-muted hover:text-text-navy font-medium underline"
                >
                  Show all sub categories
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Run-out Forecast */}
      <div className="bg-card-bg shadow-sm rounded-2xl p-6 border border-border-grey">
        <div className="flex items-center mb-8">
          <div className="p-2.5 bg-accent/10 rounded-xl mr-3 border border-accent/20">
            <Clock className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-black text-text-navy uppercase tracking-tight">Stock Run-out Forecast</h3>
            <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Projected depletion timeline</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={forecastingData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e5e5" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fontSize: 10, fill: '#141414', fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(242, 125, 38, 0.05)' }}
                  formatter={(value: number) => [`${value} days`, 'Remaining']}
                  contentStyle={{ backgroundColor: '#151619', border: 'none', borderRadius: '12px', color: '#fff', padding: '12px' }}
                />
                <Bar 
                  dataKey="daysRemaining" 
                  radius={[0, 6, 6, 0]}
                  barSize={24}
                >
                  {forecastingData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.status === 'critical' ? '#FF4444' : entry.status === 'warning' ? '#F27D26' : '#5A5A40'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {forecastingData.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-primary-surface rounded-xl border border-border-grey hover:border-accent/30 transition-all group cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-text-navy uppercase tracking-tight group-hover:text-accent transition-colors">{item.name}</span>
                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-0.5">{item.subCategory || item.category}</span>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-black uppercase tracking-widest ${
                    item.status === 'critical' ? 'text-cta' : item.status === 'warning' ? 'text-warning' : 'text-success'
                  }`}>
                    {item.daysRemaining} days left
                  </div>
                  <div className="text-[10px] text-text-muted font-medium mt-1">
                    Usage: <span className="font-bold text-text-navy">{item.dailyUsageRate}</span> {item.unit}/day
                  </div>
                </div>
              </div>
            ))}
            {forecastingData.length === 0 && (
              <div className="text-center py-12 text-text-muted bg-primary-surface rounded-xl border border-dashed border-border-grey">
                <p className="text-sm font-medium">No usage data available for forecasting.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Forecasting Section */}
      <div className="bg-card-bg shadow-2xl rounded-2xl p-6 sm:p-10 border border-border-grey relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
          <Bot className="h-48 w-48" />
        </div>
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-10 gap-8 relative z-10">
          <div className="flex items-center">
            <div className="p-4 bg-accent/10 rounded-2xl mr-5 border border-accent/20">
              <Bot className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-text-navy uppercase tracking-tight">AI Sales Forecasting</h3>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1.5 max-w-md">Predict stock needs based on historical sales velocity and seasonal trends</p>
            </div>
          </div>
          <Button 
            onClick={handleForecast} 
            disabled={isForecasting} 
            className="bg-accent hover:bg-accent/90 text-white shadow-xl shadow-accent/20 font-black uppercase tracking-widest text-xs px-10 py-4 rounded-xl w-full lg:w-auto flex items-center justify-center transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isForecasting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-3 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-3" />
                Generate Forecast
              </>
            )}
          </Button>
        </div>
        {forecast && (
          <div className="bg-primary-surface p-8 rounded-2xl text-sm text-text-navy border border-border-grey whitespace-pre-wrap leading-relaxed shadow-inner relative z-10 font-medium">
            <div className="flex items-center mb-4 text-accent">
              <Brain className="h-4 w-4 mr-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">Intelligence Output</span>
            </div>
            {forecast}
          </div>
        )}
      </div>
    </div>
  );
};
