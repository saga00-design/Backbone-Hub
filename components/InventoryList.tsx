
import React, { useState, useEffect, useRef } from 'react';
import { InventoryItem, InventoryCategory, OrderItem, Unit, InventoryType, Recipe } from '../types';
import {
  Search, Filter, Plus, Calendar, AlertTriangle, Pencil, Clock, Tag,
  HeartCrack, TrendingUp, AlertCircle, Minus, Building, Settings2, Check, X, Receipt,
  Download, Upload, FileText, Trash2, Package, Sparkles, Loader2, PackageX, CalendarClock
} from 'lucide-react';
import Papa from 'papaparse';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { SearchInput } from './SearchInput';
import { toast } from 'sonner';
import { DEFAULT_DEPARTMENTS } from '../constants';
import { formatPricePerUnit, convertToBaseUnit, formatPacksLabel, formatPackSize, formatPriceItem, formatCaseBoxSackLabel, toSafeNumber } from '../utils/unitConversions';
import { ItemSpecsTooltip } from './ItemSpecsTooltip';
import { generateInventoryInsights } from '../services/geminiService';
import { AiInsight } from '../types';

interface InventoryListProps {
  items: InventoryItem[];
  recipes: Recipe[];
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  cart: OrderItem[];
  onAddToCart: (item: InventoryItem, quantity: number) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<InventoryItem>) => void;
  onBulkAdd?: (items: Omit<InventoryItem, 'id' | 'lastUpdated'>[]) => void;
  checkPermission: (module: string, action: string) => boolean;
}

export const InventoryList: React.FC<InventoryListProps> = ({ 
  items, 
  recipes,
  onAddItem, 
  onEditItem, 
  cart, 
  onAddToCart,
  onBulkDelete,
  onBulkUpdate,
  onBulkAdd,
  checkPermission
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Initialize from localStorage or default
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('inv_search') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => localStorage.getItem('inv_filter') || 'All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [subCategoryFilter, setSubCategoryFilter] = useState(() => localStorage.getItem('inv_subfilter') || 'All');
  const [expiryFilter, setExpiryFilter] = useState('All');
  const [stockLevelFilter, setStockLevelFilter] = useState<'All' | 'Low Stock' | 'Out of Stock' | 'Healthy'>('All');
  const [vatFilter, setVatFilter] = useState<'All' | 'Has VAT' | 'No VAT' | 'Missing'>('All');
  const [activeTab, setActiveTab] = useState<'List' | 'Restock' | 'Insights'>('List');
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [hasRunInsights, setHasRunInsights] = useState(false);

  const handleRunAiInsights = async () => {
    setIsLoadingInsights(true);
    setInsightsError('');
    try {
      const insights = await generateInventoryInsights(items);
      setAiInsights(insights);
      setHasRunInsights(true);
    } catch (error) {
      setInsightsError('Could not generate insights. Please try again.');
    } finally {
      setIsLoadingInsights(false);
    }
  };
  const [sortField, setSortField] = useState<string>('Item');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('inv_columns');
    return saved ? JSON.parse(saved) : ['Status', 'Item', 'Category', 'Size', 'Unit', 'Price/Unit', 'Stock Quantity', 'Total Cost', 'Price/Item', 'Case/Box/Sack', 'Retail Price', 'VAT', 'Order'];
  });

  const allColumns = ['Status', 'Item', 'Category', 'Size', 'Unit',
    ...(checkPermission('inventory', 'viewCosts') ? ['Price/Unit'] : []),
    'Stock Quantity',
    ...(checkPermission('inventory', 'viewCosts') ? ['Total Cost', 'Price/Item'] : []),
    'Case/Box/Sack',
    ...(checkPermission('inventory', 'viewCosts') ? ['Retail Price', 'VAT'] : []),
    'Supplier', 'Storage Location', 'Expiry Status', 'Order'
  ];

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => {
      const next = prev.includes(col) 
        ? prev.filter(c => c !== col) 
        : [...prev, col];
      localStorage.setItem('inv_columns', JSON.stringify(next));
      return next;
    });
  };

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('inv_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('inv_filter', categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    localStorage.setItem('inv_subfilter', subCategoryFilter);
  }, [subCategoryFilter]);

  // Reset sub-category when category changes (skip the initial mount so a
  // deep-linked sub-category filter, e.g. from the Dashboard, survives first render)
  const isFirstCategoryRender = useRef(true);
  useEffect(() => {
    if (isFirstCategoryRender.current) {
      isFirstCategoryRender.current = false;
      return;
    }
    setSubCategoryFilter('All');
  }, [categoryFilter]);

  // Dynamically extract all unique categories from items
  const availableCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort();
  const defaultCategories = ['Food', 'Beverage', 'Non-F&B', 'Ingredient', 'Crockery', 'Utensil', 'Equipment', 'Prep', 'Batch'];
  // Combine defaults with available, ensure uniqueness
  const filterOptions = Array.from(new Set([...defaultCategories, ...availableCategories]));

  // Dynamically extract sub-categories based on selected category
  const availableSubCategories = Array.from(new Set(
    items
      .filter(i => categoryFilter === 'All' || i.category === categoryFilter)
      .map(i => i.subCategory)
      .filter((s): s is string => !!s)
  )).sort();

  const getDaysUntilExpiry = (dateStr?: string) => {
    if (!dateStr) return null;
    const today = new Date();
    const expiry = new Date(dateStr);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredItems = items.filter(item => {
    // Tab Filter
    if (activeTab === 'Restock') {
      const isLow = item.quantity <= (item.minStockLevel || 0);
      if (!isLow) return false;
    }
    
    const matchesSearch = (item.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSubCategory = subCategoryFilter === 'All' || item.subCategory === subCategoryFilter;
    const matchesDepartment = departmentFilter === 'All' || item.department === departmentFilter;
    
    let matchesExpiry = true;
    if (expiryFilter !== 'All') {
      const days = getDaysUntilExpiry(item.expiryDate);
      if (days === null) {
        matchesExpiry = false; // Filter out items with no expiry if a filter is active
      } else {
        if (expiryFilter === 'Expired') matchesExpiry = days < 0;
        else if (expiryFilter === 'Expiring Soon') matchesExpiry = days >= 0 && days <= 3;
        else if (expiryFilter === 'Expiring 1 Week') matchesExpiry = days >= 0 && days <= 7;
      }
    }

    let matchesVat = true;
    if (vatFilter !== 'All') {
      if (vatFilter === 'Has VAT') matchesVat = item.vatCode === 'STANDARD_20' || item.vatCode === 'REDUCED_5';
      else if (vatFilter === 'No VAT') matchesVat = item.vatCode === 'ZERO_0' || item.vatCode === 'EXEMPT';
      else if (vatFilter === 'Missing') matchesVat = !item.vatCode;
    }

    let matchesStockLevel = true;
    if (stockLevelFilter !== 'All') {
      const isOut = item.quantity <= 0;
      const isLow = !isOut && item.quantity <= (item.minStockLevel || 0);
      const isHealthy = !isOut && !isLow;
      
      if (stockLevelFilter === 'Out of Stock') matchesStockLevel = isOut;
      else if (stockLevelFilter === 'Low Stock') matchesStockLevel = isLow;
      else if (stockLevelFilter === 'Healthy') matchesStockLevel = isHealthy;
    }

    return matchesSearch && matchesCategory && matchesSubCategory && matchesExpiry && matchesDepartment && matchesVat && matchesStockLevel;
  }).sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'Status':
        const getStatusRank = (qty: number, min: number) => {
          if (qty <= 0) return 3;
          if (qty <= min) return 2;
          return 1;
        };
        comparison = getStatusRank(a.quantity, a.minStockLevel || 0) - getStatusRank(b.quantity, b.minStockLevel || 0);
        break;
      case 'Item':
        comparison = (a.name || '').localeCompare(b.name || '');
        break;
      case 'Category':
        comparison = (a.category || '').localeCompare(b.category || '');
        break;
      case 'Stock Quantity':
        comparison = (a.quantity || 0) - (b.quantity || 0);
        break;
      case 'Size':
        comparison = (a.unitSize || 0) - (b.unitSize || 0);
        break;
      case 'Unit':
        comparison = (a.unit || '').localeCompare(b.unit || '');
        break;
      case 'Price/Unit':
        comparison = (a.pricePerUnit || 0) - (b.pricePerUnit || 0);
        break;
      case 'Total Cost':
        comparison = ((a.quantity || 0) * (a.pricePerUnit || 0)) - ((b.quantity || 0) * (b.pricePerUnit || 0));
        break;
      case 'Supplier':
        comparison = (a.supplier || '').localeCompare(b.supplier || '');
        break;
      case 'Storage Location':
        comparison = (a.storageLocation || '').localeCompare(b.storageLocation || '');
        break;
      case 'Expiry Status':
        const daysA = getDaysUntilExpiry(a.expiryDate) ?? 9999;
        const daysB = getDaysUntilExpiry(b.expiryDate) ?? 9999;
        comparison = daysA - daysB;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  const getExpiryStatus = (dateStr?: string) => {
    const diffDays = getDaysUntilExpiry(dateStr);
    if (diffDays === null) return null;

    if (diffDays < 0) return { 
      label: 'Expired', 
      className: 'bg-error/20 text-cta border-error/30' 
    };
    if (diffDays <= 3) return { 
      label: 'Expiring Soon', 
      className: 'bg-warning/20 text-warning border-warning/30' 
    };
    if (diffDays <= 7) return { 
      label: 'Expires 1 Week', 
      className: 'bg-warning/10 text-warning border-warning/20' 
    };
    return { 
      label: dateStr, 
      className: 'bg-secondary-surface text-text-muted border-border-grey' 
    };
  };

  const formatStockQuantity = (item: InventoryItem) => formatPacksLabel(item.quantity, item);

  const formatPricePerPack = (item: InventoryItem) => {
    const factor = convertToBaseUnit(1, item.unit);
    const pricePerPack = toSafeNumber(item.pricePerUnit) * factor;
    
    // Format with at least 2 decimals, up to 4 if needed
    const formattedPrice = pricePerPack.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
    
    return `£${formattedPrice}`;
  };

  const calculateTotalCost = (item: InventoryItem) => {
    return toSafeNumber(item.quantity) * toSafeNumber(item.pricePerUnit);
  };

  const handleExport = () => {
    const exportData = items.map(item => {
      const factor = convertToBaseUnit(1, item.unit);
      const stockPacks = item.unitSize > 0 ? item.quantity / item.unitSize : 0;
      const sizeInUnit = item.unitSize / factor;
      const priceInUnit = item.pricePerUnit * factor;

      return {
        'Name': item.name,
        'Category': item.category,
        'SubCategory': item.subCategory || '',
        'Department': item.department || '',
        'InventoryType': item.inventoryType,
        'StockQuantity': stockPacks.toFixed(2),
        'Packaging': item.packaging || '',
        'BaseSize': sizeInUnit.toFixed(3),
        'BaseUnit': item.unit,
        'PricePerUnit': priceInUnit.toFixed(4),
        'MinStockLevel': item.minStockLevel,
        'Supplier': item.supplier || '',
        'StorageLocation': item.storageLocation || '',
        'Barcode': item.barcode || '',
        'ExpiryDate': item.expiryDate || ''
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const importedItems: Omit<InventoryItem, 'id' | 'lastUpdated'>[] = [];
        let errors = 0;

        results.data.forEach((row: any) => {
          try {
            const name = row['Name'];
            const category = row['Category'];
            const inventoryType = (row['InventoryType'] || 'SOLID').toUpperCase();
            const stockPacks = parseFloat(row['StockQuantity']) || 0;
            const packaging = row['Packaging'] || 'pcs';
            const baseSize = parseFloat(row['BaseSize']) || 1;
            const baseUnit = (row['BaseUnit'] || 'kg') as Unit;
            const pricePerUnit = parseFloat(row['PricePerUnit']) || 0;

            if (!name || !category) {
              errors++;
              return;
            }

            const baseQtyPerPack = convertToBaseUnit(baseSize, baseUnit);
            const totalBaseQty = stockPacks * baseQtyPerPack;
            const unitFactor = convertToBaseUnit(1, baseUnit);
            const pPerBaseUnit = unitFactor > 0 ? pricePerUnit / unitFactor : 0;

            importedItems.push({
              name,
              category,
              subCategory: row['SubCategory'],
              department: row['Department'],
              inventoryType,
              baseUnit: inventoryType === 'LIQUID' ? 'ml' : (inventoryType === 'SOLID' ? 'g' : 'pcs'),
              quantity: totalBaseQty,
              unit: baseUnit,
              unitSize: baseQtyPerPack,
              packaging,
              pricePerUnit: pPerBaseUnit,
              minStockLevel: parseFloat(row['MinStockLevel']) || 0,
              supplier: row['Supplier'],
              storageLocation: row['StorageLocation'],
              barcode: row['Barcode'],
              expiryDate: row['ExpiryDate'],
              isActive: true
            });
          } catch (err) {
            errors++;
          }
        });

        if (importedItems.length > 0) {
          onBulkAdd?.(importedItems);
          toast.success(`Successfully imported ${importedItems.length} items.${errors > 0 ? ` (${errors} errors)` : ''}`);
        } else {
          toast.error("No valid items found in CSV.");
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const downloadTemplate = () => {
    const templateData = [{
      'Name': 'Example Item',
      'Category': 'Ingredient',
      'SubCategory': 'Dry Goods',
      'Department': 'Food',
      'InventoryType': 'SOLID',
      'StockQuantity': '10',
      'Packaging': 'bag',
      'BaseSize': '1.0',
      'BaseUnit': 'kg',
      'PricePerUnit': '2.50',
      'MinStockLevel': '5',
      'Supplier': 'Supplier Name',
      'StorageLocation': 'Main Store',
      'Barcode': '123456789',
      'ExpiryDate': '2024-12-31'
    }];

    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-card-bg shadow-2xl rounded-3xl flex flex-col h-full border border-border-grey overflow-hidden">
      <div className="px-8 py-6 border-b border-border-grey bg-primary-surface">
        <PageHeader
          bare
          icon={Package}
          title="Inventory"
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <span>Manage your stock and supplies</span>
              <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap normal-case tracking-normal">
                {items.length} Total Items
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 border border-success/20 rounded-lg shadow-sm normal-case tracking-normal">
                <Check className="h-3 w-3 text-success font-black" />
                <span className="text-[10px] font-black text-success uppercase tracking-widest">Cloud Protected</span>
              </span>
            </span>
          }
          actions={
            <>
              {checkPermission('inventory', 'edit') && (
                <>
                  <Button
                    onClick={downloadTemplate}
                    className="bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl flex items-center shadow-sm transition-all font-bold uppercase tracking-widest text-[10px]"
                    title="Download CSV Template"
                  >
                    <FileText className="-ml-1 mr-2 h-4 w-4" />
                    Template
                  </Button>
                  <Button
                    onClick={handleExport}
                    className="bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl flex items-center shadow-sm transition-all font-bold uppercase tracking-widest text-[10px]"
                  >
                    <Download className="-ml-1 mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl flex items-center shadow-sm transition-all font-bold uppercase tracking-widest text-[10px]"
                  >
                    <Upload className="-ml-1 mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleImport}
                  />
                </>
              )}
              {checkPermission('inventory', 'create') && (
                <Button
                  onClick={onAddItem}
                  className="bg-accent hover:opacity-90 text-white px-6 py-2 rounded-xl flex items-center shadow-lg shadow-accent/20 transition-all font-bold uppercase tracking-widest text-[10px]"
                >
                  <Plus className="-ml-1 mr-2 h-4 w-4" />
                  Add Item
                </Button>
              )}
            </>
          }
        />
      </div>
      
      <div className="px-8 py-4 border-b border-border-grey bg-white/50 flex gap-4">
        <button 
          onClick={() => setActiveTab('List')}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'List' ? 'bg-text-navy text-white shadow-lg' : 'text-text-muted hover:bg-gray-100'}`}
        >
          Full Inventory
        </button>
        <button 
          onClick={() => setActiveTab('Restock')}
          className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'Restock' ? 'bg-cta text-white shadow-lg' : 'text-text-muted hover:bg-gray-100'}`}
        >
          <AlertCircle className="w-3 h-3" />
          Restock Needed
          {items.filter(i => i.quantity <= (i.minStockLevel || 0)).length > 0 && (
            <span className="ml-1 bg-white text-cta px-1.5 py-0.5 rounded-full text-[8px]">
              {items.filter(i => i.quantity <= (i.minStockLevel || 0)).length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('Insights')}
          className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'Insights' ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:bg-gray-100'}`}
        >
          <Sparkles className="w-3 h-3" />
          AI Insights
        </button>
        {activeTab === 'Restock' && filteredItems.length > 0 && (
          <Button 
            onClick={() => {
              filteredItems.forEach(item => {
                // minStockLevel and quantity are both already stored in base units — no
                // metric conversion is needed here. Only convert the base-unit shortfall
                // into a pack count via unitSize (previously this was ALSO multiplied by
                // convertToBaseUnit(1, item.unit), which for a metric unit like 'kg'
                // re-applied the same factor a second time and inflated packsToOrder by
                // that factor, e.g. ~1000x for a kg-labeled item).
                const missing = (item.minStockLevel || 0) - item.quantity;
                if (missing > 0) {
                  const packsToOrder = Math.ceil(missing / (item.unitSize || 1));
                  // Cart quantity is stored in base units, so the pack count must be converted
                  // back before adding — passing packsToOrder directly would add e.g. "3" grams
                  // to the cart instead of 3 packs' worth.
                  onAddToCart(item, packsToOrder * (item.unitSize || 1));
                }
              });
              toast.success(`added missing stock for ${filteredItems.length} items to order`);
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg"
          >
            <TrendingUp className="w-3 h-3 rotate-45" />
            Order All Missing
          </Button>
        )}
      </div>

      {activeTab === 'Insights' ? (
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-text-navy flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> AI Inventory Insights</h3>
              <p className="text-xs text-text-muted mt-1">AI review of stock levels, reorder needs, slow movers, and upcoming expiries.</p>
            </div>
            <Button
              onClick={handleRunAiInsights}
              isLoading={isLoadingInsights}
              className="bg-accent hover:opacity-90 text-white rounded-xl px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" /> {hasRunInsights ? "Refresh Insights" : "Run AI Insights"}
            </Button>
          </div>

          {insightsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{insightsError}</div>
          )}

          {isLoadingInsights && (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyzing inventory...
            </div>
          )}

          {!isLoadingInsights && hasRunInsights && aiInsights.length === 0 && !insightsError && (
            <div className="text-center py-16">
              <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-text-navy">All clear — nothing needs attention right now.</p>
            </div>
          )}

          {!isLoadingInsights && !hasRunInsights && (
            <div className="text-center py-16">
              <Sparkles className="w-10 h-10 text-accent/30 mx-auto mb-3" />
              <p className="text-sm text-text-muted">Click "Run AI Insights" to analyze your current stock.</p>
            </div>
          )}

          {!isLoadingInsights && aiInsights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiInsights.map((insight, idx) => {
                const iconMap = { reorder: AlertCircle, expiry: CalendarClock, slow_moving: PackageX, anomaly: AlertTriangle };
                const colorMap = { high: "border-red-300 bg-red-50", medium: "border-amber-300 bg-amber-50", low: "border-border-grey bg-main-bg" };
                const Icon = iconMap[insight.type] || AlertCircle;
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${colorMap[insight.priority] || colorMap.low}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-text-navy" />
                      <div>
                        <p className="text-sm font-bold text-text-navy">{insight.item}</p>
                        <p className="text-xs text-text-muted mt-1">{insight.message}</p>
                        {insight.action && (
                          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-2">{insight.action}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <>
      <div className="p-6 border-b border-border-grey bg-secondary-surface flex flex-col lg:flex-row gap-6">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search items..."
          className="flex-1 lg:flex-1 lg:min-w-[240px]"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-row lg:flex-wrap gap-1.5">
            <div className="relative rounded-xl shadow-sm w-full lg:w-[100px] lg:flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-8 pr-2 text-xs rounded-xl py-2.5 border appearance-none"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                    <option value="All">All Depts</option>
                    {DEFAULT_DEPARTMENTS.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm w-full lg:w-[100px] lg:flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-8 pr-2 text-xs rounded-xl py-2.5 border appearance-none"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <option value="All">All Categories</option>
                    {filterOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm w-full lg:w-[100px] lg:flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-8 pr-2 text-xs rounded-xl py-2.5 border appearance-none disabled:opacity-50"
                    value={subCategoryFilter}
                    onChange={(e) => setSubCategoryFilter(e.target.value)}
                    disabled={availableSubCategories.length === 0}
                >
                    <option value="All">All SubCats</option>
                    {availableSubCategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                    ))}
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm w-full lg:w-[100px] lg:flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <AlertTriangle className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-8 pr-2 text-xs rounded-xl py-2.5 border appearance-none"
                    value={stockLevelFilter}
                    onChange={(e) => setStockLevelFilter(e.target.value as any)}
                >
                    <option value="All">All Stock Levels</option>
                    <option value="Healthy">Healthy Stock</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm w-full lg:w-[100px] lg:flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Clock className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-8 pr-2 text-xs rounded-xl py-2.5 border appearance-none"
                    value={expiryFilter}
                    onChange={(e) => setExpiryFilter(e.target.value)}
                >
                    <option value="All">All Expiry</option>
                    <option value="Expired">Expired</option>
                    <option value="Expiring Soon">Soon (3d)</option>
                    <option value="Expiring 1 Week">1 Week</option>
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm w-full lg:w-[100px] lg:flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Receipt className="h-3.5 w-3.5 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-8 pr-2 text-xs rounded-xl py-2.5 border appearance-none"
                    value={vatFilter}
                    onChange={(e) => setVatFilter(e.target.value as any)}
                >
                    <option value="All">All VAT</option>
                    <option value="Has VAT">Has VAT</option>
                    <option value="No VAT">No VAT</option>
                    <option value="Missing">Missing VAT</option>
                </select>
            </div>

            <div className="relative lg:flex-shrink-0">
                <Button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="h-full w-full lg:w-auto bg-card-bg border-border-grey text-text-navy hover:bg-primary-surface font-bold uppercase tracking-widest text-[10px] px-3 py-2.5 rounded-xl"
                >
                    <Settings2 className="h-3.5 w-3.5 mr-1" />
                    Columns
                </Button>

                {showColumnSelector && (
                    <div className="absolute right-0 mt-3 w-56 bg-card-bg rounded-2xl shadow-2xl z-50 border border-border-grey p-3 max-h-[350px] overflow-y-auto custom-scrollbar">
                        <div className="text-[10px] font-bold text-text-muted px-3 py-2 uppercase tracking-widest border-b border-border-grey mb-2 sticky top-0 bg-card-bg z-10">Show/Hide Columns</div>
                        <div className="space-y-1">
                          {allColumns.map(col => (
                              <label key={col} className="flex items-center px-3 py-2 hover:bg-primary-surface rounded-xl cursor-pointer transition-colors group">
                                  <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer h-5 w-5 bg-card-bg border-border-grey text-accent focus:ring-accent rounded-lg transition-all"
                                        checked={visibleColumns.includes(col)}
                                        onChange={() => toggleColumn(col)}
                                    />
                                    <Check className="absolute h-3 w-3 text-white left-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                  </div>
                                  <span className="ml-3 text-sm text-text-navy group-hover:text-accent transition-colors">{col === 'Value' ? 'Total Value' : col}</span>
                              </label>
                          ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-card-bg">
        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <div className="bg-accent/10 border-b border-accent/20 px-8 py-3 flex items-center justify-between animate-in slide-in-from-top duration-200">
            <div className="flex items-center space-x-4">
              <span className="text-xs font-bold text-accent uppercase tracking-widest">
                {selectedItems.size} Items Selected
              </span>
              <div className="h-4 w-px bg-accent/20" />
              <button 
                onClick={toggleSelectAll}
                className="text-[10px] font-bold text-text-navy hover:text-accent uppercase tracking-widest transition-colors"
              >
                {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="secondary"
                className="bg-transparent border border-border-grey text-text-navy hover:bg-secondary-surface px-4 py-1.5 rounded-lg font-bold uppercase tracking-widest text-[9px]"
                onClick={() => {
                  const supplier = prompt('Enter new supplier name:');
                  if (supplier && onBulkUpdate) {
                    onBulkUpdate(Array.from(selectedItems), { supplier });
                    setSelectedItems(new Set());
                  } else if (supplier) {
                    toast.info(`Bulk update supplier to "${supplier}" for ${selectedItems.size} items`);
                  }
                }}
              >
                Update Supplier
              </Button>
              <Button 
                variant="secondary"
                className="bg-transparent border border-cta/30 text-cta hover:bg-error/10 px-4 py-1.5 rounded-lg font-bold uppercase tracking-widest text-[9px]"
                onClick={() => {
                  const ids = Array.from(selectedItems);
                  const usedInRecipes: string[] = [];
                  ids.forEach(id => {
                    const itemName = items.find(i => i.id === id)?.name || id;
                    const rList = recipes.filter(r => r.ingredients?.some(ing => ing.inventoryItemId === id));
                    if (rList.length > 0) {
                      usedInRecipes.push(`${itemName} (in ${rList.map(r => r.name).join(', ')})`);
                    }
                  });

                  let confirmMsg = `Are you sure you want to delete ${selectedItems.size} items?`;
                  if (usedInRecipes.length > 0) {
                    confirmMsg = `CRITICAL WARNING: The following items are used in active recipes:\n\n${usedInRecipes.join('\n')}\n\nDeleting them will break these recipes. Proceed anyway?`;
                  }

                  if (confirm(confirmMsg)) {
                    if (onBulkDelete) {
                      onBulkDelete(ids);
                    } else {
                      toast.error(`Bulk deleted ${selectedItems.size} items`);
                    }
                    setSelectedItems(new Set());
                  }
                }}
              >
                Delete Selected
              </Button>
              <button onClick={() => setSelectedItems(new Set())} className="p-1.5 text-text-muted hover:text-text-navy transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block">
          {/* Bounded height + overflow on BOTH axes here (not just x) so the horizontal
              scrollbar sits at the bottom of this visible box instead of below every row —
              previously it only lived at the bottom of the full unbounded table, unreachable
              without scrolling past the whole list first. Same pattern as LabourIntelligence's
              and Dashboard's scrollable tables. The column-visibility picker above already lets
              users trim down to what fits their screen if they'd rather avoid scrolling at all;
              with every optional column (Supplier, Storage Location, Expiry Status, etc.) on,
              no fixed-width squeeze fits reliably across screen sizes, so scroll is the honest
              choice here rather than the default-fit table. */}
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh] custom-scrollbar">
            <table className="min-w-full divide-y divide-border-grey table-fixed lg:table-auto">
              <thead className="bg-secondary-surface sticky top-0 z-10 backdrop-blur-md bg-white/90">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest w-10">#</th>
                  <th scope="col" className="px-3 py-2 text-left">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="peer h-5 w-5 bg-card-bg border-border-grey text-accent focus:ring-accent rounded-lg transition-all"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <Check className="absolute h-3 w-3 text-white left-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                </th>
                {visibleColumns.includes('Status') && (
                  <th 
                    scope="col" 
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Status')}
                  >
                    <div className="flex items-center">
                      Status
                      {sortField === 'Status' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Item') && (
                  <th 
                    scope="col" 
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Item')}
                  >
                    <div className="flex items-center">
                      Item
                      {sortField === 'Item' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Category') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Category')}
                  >
                    <div className="flex items-center">
                      Category
                      {sortField === 'Category' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Size') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Size')}
                  >
                    <div className="flex items-center">
                      Size
                      {sortField === 'Size' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Unit') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Unit')}
                  >
                    <div className="flex items-center">
                      Unit
                      {sortField === 'Unit' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Price/Unit') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Price/Unit')}
                  >
                    <div className="flex items-center">
                      Price/Unit
                      {sortField === 'Price/Unit' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Stock Quantity') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Stock Quantity')}
                  >
                    <div className="flex items-center">
                      Stock Quantity
                      {sortField === 'Stock Quantity' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Total Cost') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Total Cost')}
                  >
                    <div className="flex items-center">
                      Total Cost
                      {sortField === 'Total Cost' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Price/Item') && (
                  <th scope="col" className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest">
                    Price/Item
                  </th>
                )}
                {visibleColumns.includes('Case/Box/Sack') && (
                  <th scope="col" className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest">
                    Case/Box/Sack
                  </th>
                )}
                {visibleColumns.includes('Retail Price') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Retail Price')}
                  >
                    <div className="flex items-center">
                      Retail Price
                      {sortField === 'Retail Price' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('VAT') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('VAT')}
                  >
                    <div className="flex items-center">
                      VAT
                      {sortField === 'VAT' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Supplier') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Supplier')}
                  >
                    <div className="flex items-center">
                      Supplier
                      {sortField === 'Supplier' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Storage Location') && (
                   <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Storage Location')}
                  >
                    <div className="flex items-center">
                      Location
                      {sortField === 'Storage Location' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Expiry Status') && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[9px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Expiry Status')}
                  >
                    <div className="flex items-center">
                      Expiry
                      {sortField === 'Expiry Status' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Order') && <th scope="col" className="px-3 py-2 text-center text-[9px] font-bold text-text-muted uppercase tracking-widest">Order</th>}
                <th scope="col" className="px-3 py-2 text-right text-[9px] font-bold text-text-muted uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="bg-card-bg divide-y divide-border-grey">
              {filteredItems.map((item, index) => {
                const expiryStatus = getExpiryStatus(item.expiryDate);
                const hasTotalOwned = item.totalOwned !== undefined && item.totalOwned > 0;
                const cartItem = cart.find(c => c.inventoryItemId === item.id);
                const cartQuantity = cartItem ? cartItem.quantity : 0;
                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-primary-surface group transition-colors cursor-pointer ${
                      selectedItems.has(item.id) ? 'bg-accent/5' : 
                      item.quantity <= 0 ? 'bg-cta/5 hover:bg-cta/10' :
                      item.quantity <= (item.minStockLevel || 0) ? 'bg-warning/5 hover:bg-warning/10' : 
                      ''
                    }`}
                    onClick={() => onEditItem(item)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-[10px] font-bold text-text-muted w-10">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          className="peer h-5 w-5 bg-card-bg border-border-grey text-accent focus:ring-accent rounded-lg transition-all"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                        />
                        <Check className="absolute h-3 w-3 text-white left-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                    </td>
                    {visibleColumns.includes('Status') && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        {item.quantity <= 0 ? (
                           <span className="px-2 py-0.5 inline-flex text-[9px] font-bold uppercase tracking-widest rounded-md bg-cta/10 text-cta border border-cta/30">
                            Out of Stock
                          </span>
                        ) : item.quantity <= (item.minStockLevel || 0) ? (
                          <span className="px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg bg-warning/10 text-warning border border-warning/30">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg bg-success/10 text-success border border-success/30">
                            Healthy
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('Item') && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.imageUrl && (
                            <div className="flex-shrink-0 h-8 w-8 mr-3">
                              <img className="h-8 w-8 rounded-lg object-cover shadow-sm border border-border-grey" src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-text-navy group-hover:text-accent transition-colors">{item.name}</div>
                                {item.yieldFactor && item.yieldFactor < 1 && (
                                    <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-[8px] font-black rounded uppercase tracking-tighter" title="Product usable yield">
                                        {Math.round(item.yieldFactor * 100)}% Yield
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">ID: {item.id.slice(0,6)}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('Category') && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex flex-col">
                            <span className={`px-2 py-0.5 inline-flex text-[9px] font-bold uppercase tracking-widest rounded-md w-fit border ${
                            item.category === 'Ingredient' ? 'bg-success/20 text-success border-success/30' :
                            item.category === 'Crockery' ? 'bg-warning/20 text-warning border-warning/30' :
                            item.category === 'Utensil' ? 'bg-accent/20 text-accent border-accent/30' :
                            item.category === 'Equipment' ? 'bg-secondary-surface text-text-navy border-border-grey' :
                            item.category === 'Batch' ? 'bg-primary-surface text-accent border-accent/30' :
                            item.category === 'Prep' ? 'bg-error/20 text-cta border-error/30' :
                            'bg-secondary-surface text-text-muted border-border-grey'
                            }`}>
                            {item.category}
                            </span>
                            {item.subCategory && (
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-1">{item.subCategory}</span>
                            )}
                            {item.needsCategoryReview && (
                                <div className="flex items-center text-[10px] font-bold text-warning uppercase tracking-widest mt-2 ml-1" title="Auto-created from an unmatched invoice line — confirm the real category">
                                    <Receipt className="h-3 w-3 mr-1" />
                                    Needs Review
                                </div>
                            )}
                            {item.allergies && item.allergies.length > 0 && (
                                <div className="flex items-center text-[10px] font-bold text-cta uppercase tracking-widest mt-2 ml-1" title={item.allergies.join(', ')}>
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {item.allergies.length} Allergens
                                </div>
                            )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('Size') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-text-navy font-bold">
                        {formatPackSize(item)}
                      </td>
                    )}
                    {visibleColumns.includes('Unit') && (
                      <td className="px-3 py-2 whitespace-nowrap text-[9px] font-bold text-text-muted uppercase tracking-widest">
                        {item.unit}
                      </td>
                    )}
                    {visibleColumns.includes('Price/Unit') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-text-navy">
                        {formatPricePerPack(item)}
                      </td>
                    )}
                    {visibleColumns.includes('Stock Quantity') && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs text-text-navy font-bold">{formatStockQuantity(item)}</span>
                          {item.minStockLevel !== undefined && item.minStockLevel > 0 && (
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Par: {formatPacksLabel(item.minStockLevel, item)}</span>
                          )}
                          {item.dailyUsageRate && item.dailyUsageRate > 0 && item.quantity > 0 && (
                            <span className="text-[9px] font-bold text-accent uppercase tracking-widest mt-0.5">
                                Est. {Math.round(item.quantity / item.dailyUsageRate)} days left
                            </span>
                          )}
                          {activeTab === 'Restock' && item.quantity < (item.minStockLevel || 0) && (
                            <span className="text-[9px] font-black text-cta uppercase tracking-widest mt-0.5">Deficit: {formatPacksLabel((item.minStockLevel || 0) - item.quantity, item)}</span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('Total Cost') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-accent">
                        £{calculateTotalCost(item).toFixed(2)}
                      </td>
                    )}
                    {visibleColumns.includes('Price/Item') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-text-navy">
                        <span className="inline-flex items-center gap-1.5">
                          {formatPriceItem(item)}
                          <ItemSpecsTooltip item={item} />
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('Case/Box/Sack') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {(() => {
                          const caseInfo = formatCaseBoxSackLabel(item);
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              {caseInfo.isSet ? (
                                <span className="font-bold text-text-navy">{caseInfo.label}</span>
                              ) : (
                                <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{caseInfo.label}</span>
                              )}
                              <ItemSpecsTooltip item={item} />
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    {visibleColumns.includes('Retail Price') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-text-navy">
                        {item.retailPrice !== undefined ? `£${toSafeNumber(item.retailPrice).toFixed(2)}` : '-'}
                      </td>
                    )}
                    {visibleColumns.includes('VAT') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {item.vatCode ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-text-navy">{item.vatCode.replace('_', ' ')}</span>
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-0.5">{item.vatRate}%</span>
                          </div>
                        ) : (
                          <span className="text-[9px] font-bold text-cta uppercase tracking-widest">Missing</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('Supplier') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-text-muted">
                        <div className="font-bold text-text-navy">{item.supplier || '-'}</div>
                        {item.supplierContact && <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-0.5">{item.supplierContact}</div>}
                      </td>
                    )}
                    {visibleColumns.includes('Storage Location') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-text-muted">
                        <div className="font-bold text-text-navy">{item.storageLocation || '-'}</div>
                      </td>
                    )}
                    {visibleColumns.includes('Expiry Status') && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {expiryStatus ? (
                          <span className={`px-2 py-0.5 inline-flex text-[9px] font-bold uppercase tracking-widest rounded-md border ${expiryStatus.className}`}>
                            {item.category === 'Ingredient' && <Calendar className="w-2.5 h-2.5 mr-1 self-center"/>}
                            {expiryStatus.label}
                          </span>
                        ) : (
                          <span className="text-text-muted text-[9px] font-bold uppercase tracking-widest">-</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('Order') && (
                      <td className="px-3 py-2 whitespace-nowrap text-center text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => onAddToCart(item, -1)}
                            className="p-1 rounded-lg text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all disabled:opacity-50"
                            disabled={cartQuantity <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-text-navy text-sm">{cartQuantity}</span>
                          <button 
                            onClick={() => onAddToCart(item, 1)}
                            className="p-1 rounded-lg text-accent hover:bg-accent/10 transition-all"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium space-x-2" onClick={(e) => e.stopPropagation()}>
                      {checkPermission('inventory', 'edit') && (
                        <button onClick={(e) => { e.stopPropagation(); onEditItem(item); }} className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-all" title="Edit Item">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {checkPermission('inventory', 'edit') && onBulkDelete && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            const rList = recipes.filter(r => r.ingredients?.some(ing => ing.inventoryItemId === item.id));
                            let msg = `Are you sure you want to delete ${item.name}?`;
                            if (rList.length > 0) {
                              msg = `CRITICAL WARNING: ${item.name} is used in: ${rList.map(r => r.name).join(', ')}. Deleting it will break these recipes. Proceed?`;
                            }
                            if (confirm(msg)) {
                              onBulkDelete([item.id]);
                            }
                          }} 
                          className="p-1.5 text-cta hover:bg-error/10 rounded-lg transition-all"
                          title="Delete Item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
            </tbody>
          </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border-grey">
          {filteredItems.map((item, index) => {
            const expiryStatus = getExpiryStatus(item.expiryDate);
            const cartItem = cart.find(c => c.inventoryItemId === item.id);
            const cartQuantity = cartItem ? cartItem.quantity : 0;
            return (
                <div 
                  key={item.id} 
                  className="p-6 bg-card-bg space-y-4 cursor-pointer hover:bg-primary-surface transition-colors"
                  onClick={() => checkPermission('inventory', 'edit') && onEditItem(item)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="text-[10px] font-bold text-text-muted mr-3">#{index + 1}</div>
                      {item.imageUrl && (
                        <img className="h-14 w-14 rounded-xl object-cover mr-4 shadow-lg border border-border-grey" src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-text-navy">{item.name}</h4>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{item.category} • {item.subCategory || 'No Subcat'}</p>
                      </div>
                    </div>
                    {checkPermission('inventory', 'edit') && (
                      <button onClick={(e) => { e.stopPropagation(); onEditItem(item); }} className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                <div className="grid grid-cols-2 gap-6 text-[10px] font-bold uppercase tracking-widest">
                    <div>
                      <p className="text-text-muted mb-1.5">Stock Quantity</p>
                      <p className="text-sm font-bold text-text-navy">{toSafeNumber(item.quantity)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-1.5">Size</p>
                      <p className="text-sm font-bold text-text-navy">{item.unitSize || 1} {item.unit}</p>
                    </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Expiry Status</p>
                    {expiryStatus ? (
                      <span className={`px-2 py-0.5 inline-flex text-[9px] font-bold uppercase tracking-widest rounded-lg border ${expiryStatus.className}`}>
                        {expiryStatus.label}
                      </span>
                    ) : (
                      <p className="text-sm font-bold text-text-muted/50">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Price/Unit</p>
                    <p className="text-sm font-bold text-text-navy">£{(item.pricePerUnit || 0).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Total Cost</p>
                    <p className="text-sm font-bold text-accent">£{calculateTotalCost(item).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Retail Price</p>
                    <p className="text-sm font-bold text-text-navy">{item.retailPrice !== undefined ? `£${toSafeNumber(item.retailPrice).toFixed(2)}` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">VAT</p>
                    {item.vatCode ? (
                      <p className="text-sm font-bold text-text-navy">{item.vatCode.replace('_', ' ')} ({item.vatRate}%)</p>
                    ) : (
                      <p className="text-sm font-bold text-cta">Missing</p>
                    )}
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Supplier</p>
                    <p className="text-sm font-bold text-text-navy truncate">{item.supplier || '-'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Location</p>
                    <p className="text-sm font-bold text-text-navy truncate">{item.storageLocation || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border-grey">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Quick Order</span>
                  <div className="flex items-center space-x-4" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => onAddToCart(item, -1)}
                      className="p-2 rounded-xl border border-border-grey text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all disabled:opacity-50"
                      disabled={cartQuantity <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-lg font-bold w-8 text-center text-text-navy">{cartQuantity}</span>
                    <button 
                      onClick={() => onAddToCart(item, 1)}
                      className="p-2 rounded-xl border border-accent/30 text-accent hover:bg-accent/10 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="px-8 py-16 text-center">
            <Search className="h-12 w-12 text-accent mx-auto mb-4 opacity-20" />
            <p className="text-sm text-text-muted font-bold uppercase tracking-widest">
              No items found.
            </p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};
