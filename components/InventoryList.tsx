
import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryCategory, OrderItem } from '../types';
import { 
  Search, Filter, Plus, Calendar, AlertTriangle, Pencil, Clock, Tag, 
  HeartCrack, TrendingUp, AlertCircle, Minus, Building, Settings2, Check, X, Receipt 
} from 'lucide-react';
import { Button } from './Button';
import { toast } from 'sonner';
import { DEFAULT_DEPARTMENTS } from '../constants';

interface InventoryListProps {
  items: InventoryItem[];
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  cart: OrderItem[];
  onAddToCart: (item: InventoryItem, quantity: number) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<InventoryItem>) => void;
}

export const InventoryList: React.FC<InventoryListProps> = ({ 
  items, 
  onAddItem, 
  onEditItem, 
  cart, 
  onAddToCart,
  onBulkDelete,
  onBulkUpdate
}) => {
  // Initialize from localStorage or default
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('inv_search') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => localStorage.getItem('inv_filter') || 'All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [subCategoryFilter, setSubCategoryFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState('All');
  const [vatFilter, setVatFilter] = useState<'All' | 'Has VAT' | 'No VAT' | 'Missing'>('All');
  const [sortField, setSortField] = useState<string>('Item');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('inv_columns');
    return saved ? JSON.parse(saved) : ['Item', 'Category', 'Stock Level', 'COGS', 'Retail Price', 'VAT', 'Value', 'Order'];
  });

  const allColumns = ['Item', 'Category', 'Stock Level', 'Supplier', 'Expiry Status', 'COGS', 'Retail Price', 'VAT', 'Value', 'Order'];

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
  
  // Reset sub-category when category changes
  useEffect(() => {
    setSubCategoryFilter('All');
  }, [categoryFilter]);

  // Dynamically extract all unique categories from items
  const availableCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort();
  const defaultCategories = ['Ingredient', 'Crockery', 'Utensil', 'Equipment', 'Prep', 'Batch'];
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

    return matchesSearch && matchesCategory && matchesSubCategory && matchesExpiry && matchesDepartment && matchesVat;
  }).sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'Item':
        comparison = (a.name || '').localeCompare(b.name || '');
        break;
      case 'Category':
        comparison = (a.category || '').localeCompare(b.category || '');
        break;
      case 'Stock Level':
        comparison = (a.quantity || 0) - (b.quantity || 0);
        break;
      case 'COGS':
        comparison = (a.pricePerUnit || 0) - (b.pricePerUnit || 0);
        break;
      case 'Retail Price':
        comparison = (a.retailPrice || 0) - (b.retailPrice || 0);
        break;
      case 'VAT':
        comparison = (a.vatCode || '').localeCompare(b.vatCode || '');
        break;
      case 'Value':
        comparison = ((a.quantity || 0) * (a.pricePerUnit || 0)) - ((b.quantity || 0) * (b.pricePerUnit || 0));
        break;
      case 'Supplier':
        comparison = (a.supplier || '').localeCompare(b.supplier || '');
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

  const formatQuantity = (qty: number) => {
    return parseFloat(qty.toFixed(3));
  };

  return (
    <div className="bg-card-bg shadow-2xl rounded-3xl flex flex-col h-full border border-border-grey overflow-hidden">
      <div className="px-8 py-6 border-b border-border-grey bg-primary-surface sm:flex sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-text-navy tracking-tight">Current Inventory</h3>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Manage your stock and supplies</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-4">
          <Button 
            onClick={onAddItem} 
            className="bg-accent hover:opacity-90 text-white px-6 py-2 rounded-xl flex items-center shadow-lg shadow-accent/20 transition-all font-bold uppercase tracking-widest text-[10px]"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>
      
      <div className="p-6 border-b border-border-grey bg-secondary-surface flex flex-col lg:flex-row gap-6">
        <div className="relative rounded-xl shadow-sm flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-text-muted" />
          </div>
          <input
            type="text"
            className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-12 sm:text-sm rounded-xl p-3 border placeholder-text-muted/50"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-row gap-4">
            <div className="relative rounded-xl shadow-sm min-w-[160px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building className="h-4 w-4 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-10 text-sm rounded-xl py-3 border appearance-none"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                    <option value="All">All Depts</option>
                    {DEFAULT_DEPARTMENTS.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm min-w-[160px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Filter className="h-4 w-4 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-10 text-sm rounded-xl py-3 border appearance-none"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <option value="All">All Categories</option>
                    {filterOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm min-w-[160px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Tag className="h-4 w-4 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-10 text-sm rounded-xl py-3 border appearance-none disabled:opacity-50"
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

            <div className="relative rounded-xl shadow-sm min-w-[160px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Clock className="h-4 w-4 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-10 text-sm rounded-xl py-3 border appearance-none"
                    value={expiryFilter}
                    onChange={(e) => setExpiryFilter(e.target.value)}
                >
                    <option value="All">All Expiry</option>
                    <option value="Expired">Expired</option>
                    <option value="Expiring Soon">Soon (3d)</option>
                    <option value="Expiring 1 Week">1 Week</option>
                </select>
            </div>

            <div className="relative rounded-xl shadow-sm min-w-[160px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Receipt className="h-4 w-4 text-text-muted" />
                </div>
                <select
                    className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full pl-10 text-sm rounded-xl py-3 border appearance-none"
                    value={vatFilter}
                    onChange={(e) => setVatFilter(e.target.value as any)}
                >
                    <option value="All">All VAT</option>
                    <option value="Has VAT">Has VAT</option>
                    <option value="No VAT">No VAT</option>
                    <option value="Missing">Missing VAT</option>
                </select>
            </div>

            <div className="relative">
                <Button 
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="h-full w-full lg:w-auto bg-card-bg border-border-grey text-text-navy hover:bg-primary-surface font-bold uppercase tracking-widest text-[10px] py-3 rounded-xl"
                >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Columns
                </Button>
                
                {showColumnSelector && (
                    <div className="absolute right-0 mt-3 w-56 bg-card-bg rounded-2xl shadow-2xl z-50 border border-border-grey p-3 overflow-hidden">
                        <div className="text-[10px] font-bold text-text-muted px-3 py-2 uppercase tracking-widest border-b border-border-grey mb-2">Show/Hide Columns</div>
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
                                  <span className="ml-3 text-sm text-text-navy group-hover:text-accent transition-colors">{col}</span>
                              </label>
                          ))}
                        </div>
                    </div>
                )}
            </div>

            <Button 
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('All');
                setSubCategoryFilter('All');
                setDepartmentFilter('All');
                setExpiryFilter('All');
                setVatFilter('All');
              }}
              className="h-full w-full lg:w-auto bg-transparent border border-cta/30 text-cta hover:bg-error/10 font-bold uppercase tracking-widest text-[10px] py-3 rounded-xl"
              title="Clear all filters"
            >
                <X className="h-4 w-4 mr-2" />
                Clear
            </Button>
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
                  if (confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) {
                    if (onBulkDelete) {
                      onBulkDelete(Array.from(selectedItems));
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
          <table className="min-w-full divide-y divide-border-grey">
            <thead className="bg-secondary-surface">
              <tr>
                <th scope="col" className="px-8 py-4 text-left">
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
                {visibleColumns.includes('Item') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
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
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
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
                {visibleColumns.includes('Stock Level') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Stock Level')}
                  >
                    <div className="flex items-center">
                      Stock Level
                      {sortField === 'Stock Level' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Supplier') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
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
                {visibleColumns.includes('Expiry Status') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Expiry Status')}
                  >
                    <div className="flex items-center">
                      Expiry Status
                      {sortField === 'Expiry Status' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('COGS') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('COGS')}
                  >
                    <div className="flex items-center">
                      COGS
                      {sortField === 'COGS' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Retail Price') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
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
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
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
                {visibleColumns.includes('Value') && (
                  <th 
                    scope="col" 
                    className="px-8 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group"
                    onClick={() => toggleSort('Value')}
                  >
                    <div className="flex items-center">
                      Value
                      {sortField === 'Value' && (
                        <TrendingUp className={`ml-1.5 h-3 w-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('Order') && <th scope="col" className="px-8 py-4 text-center text-[10px] font-bold text-text-muted uppercase tracking-widest">Order</th>}
                <th scope="col" className="px-8 py-4 text-right text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="bg-card-bg divide-y divide-border-grey">
              {filteredItems.map((item) => {
                const expiryStatus = getExpiryStatus(item.expiryDate);
                const hasTotalOwned = item.totalOwned !== undefined && item.totalOwned > 0;
                const cartItem = cart.find(c => c.inventoryItemId === item.id);
                const cartQuantity = cartItem ? cartItem.quantity : 0;
                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-primary-surface group transition-colors cursor-pointer ${selectedItems.has(item.id) ? 'bg-accent/5' : ''}`}
                    onClick={() => onEditItem(item)}
                  >
                    <td className="px-8 py-6 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                    {visibleColumns.includes('Item') && (
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.imageUrl && (
                            <div className="flex-shrink-0 h-12 w-12 mr-4">
                              <img className="h-12 w-12 rounded-xl object-cover shadow-lg border border-border-grey" src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-text-navy group-hover:text-accent transition-colors">{item.name}</div>
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">ID: {item.id.slice(0,6)}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('Category') && (
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex flex-col">
                            <span className={`px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg w-fit border ${
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
                            {item.allergies && item.allergies.length > 0 && (
                                <div className="flex items-center text-[10px] font-bold text-cta uppercase tracking-widest mt-2 ml-1" title={item.allergies.join(', ')}>
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {item.allergies.length} Allergens
                                </div>
                            )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('Stock Level') && (
                      <td className="px-8 py-6 whitespace-nowrap text-sm text-text-muted">
                        <div className="flex flex-col">
                            <div className="flex items-center">
                            <span className={`text-sm font-bold ${item.quantity <= item.minStockLevel ? 'text-cta' : 'text-text-navy'}`}>
                                {formatQuantity(item.quantity)} {item.unit}
                            </span>
                            {item.quantity <= item.minStockLevel && (
                                <AlertTriangle className="ml-2 h-4 w-4 text-cta" />
                            )}
                            </div>
                            {item.dailyUsageRate && item.dailyUsageRate > 0 && (
                                <div className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center mt-1">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    {formatQuantity(item.dailyUsageRate || 0)} {item.unit}/day
                                </div>
                            )}
                            {hasTotalOwned && (
                                   <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">of {item.totalOwned} Owned</span>
                            )}
                        </div>
                        {item.brokenQuantity !== undefined && item.brokenQuantity > 0 && (
                            <div className="flex items-center text-[10px] font-bold text-cta uppercase tracking-widest mt-2">
                                <HeartCrack className="h-3 w-3 mr-1" />
                                {item.brokenQuantity} Broken/Missing
                            </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('Supplier') && (
                      <td className="px-8 py-6 whitespace-nowrap text-sm text-text-muted">
                        <div className="font-bold text-text-navy">{item.supplier || '-'}</div>
                        {item.supplierContact && <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{item.supplierContact}</div>}
                      </td>
                    )}
                    {visibleColumns.includes('Expiry Status') && (
                      <td className="px-8 py-6 whitespace-nowrap text-sm">
                        {expiryStatus ? (
                          <span className={`px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg border ${expiryStatus.className}`}>
                            {item.category === 'Ingredient' && <Calendar className="w-3 h-3 mr-1.5 self-center"/>}
                            {expiryStatus.label}
                          </span>
                        ) : (
                          <span className="text-text-muted text-[10px] font-bold uppercase tracking-widest">-</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('COGS') && (
                      <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-text-navy">
                        £{item.pricePerUnit.toFixed(2)}
                      </td>
                    )}
                    {visibleColumns.includes('Retail Price') && (
                      <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-text-navy">
                        {item.retailPrice !== undefined ? `£${item.retailPrice.toFixed(2)}` : '-'}
                      </td>
                    )}
                    {visibleColumns.includes('VAT') && (
                      <td className="px-8 py-6 whitespace-nowrap text-sm">
                        {item.vatCode ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-text-navy">{item.vatCode.replace('_', ' ')}</span>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{item.vatRate}%</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-cta uppercase tracking-widest">Missing</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('Value') && <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-accent">£{(item.quantity * item.pricePerUnit).toFixed(2)}</td>}
                    {visibleColumns.includes('Order') && (
                      <td className="px-8 py-6 whitespace-nowrap text-center text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-3">
                          <button 
                            onClick={() => onAddToCart(item, -1)}
                            className="p-2 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all disabled:opacity-50"
                            disabled={cartQuantity <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-10 text-center font-bold text-text-navy text-lg">{cartQuantity}</span>
                          <button 
                            onClick={() => onAddToCart(item, 1)}
                            className="p-2 rounded-xl text-accent hover:bg-accent/10 transition-all"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); onEditItem(item); }} className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )})}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border-grey">
          {filteredItems.map((item) => {
            const expiryStatus = getExpiryStatus(item.expiryDate);
            const cartItem = cart.find(c => c.inventoryItemId === item.id);
            const cartQuantity = cartItem ? cartItem.quantity : 0;
            return (
              <div 
                key={item.id} 
                className="p-6 bg-card-bg space-y-4 cursor-pointer hover:bg-primary-surface transition-colors"
                onClick={() => onEditItem(item)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    {item.imageUrl && (
                      <img className="h-14 w-14 rounded-xl object-cover mr-4 shadow-lg border border-border-grey" src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-text-navy">{item.name}</h4>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{item.category} • {item.subCategory || 'No Subcat'}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onEditItem(item); }} className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 text-[10px] font-bold uppercase tracking-widest">
                    <div>
                      <p className="text-text-muted mb-1.5">Stock Level</p>
                      <div className="flex items-center">
                        <span className={`text-sm font-bold ${item.quantity <= item.minStockLevel ? 'text-cta' : 'text-text-navy'}`}>
                          {formatQuantity(item.quantity)} {item.unit}
                        </span>
                        {item.quantity <= item.minStockLevel && (
                          <AlertTriangle className="ml-1.5 h-3.5 w-3.5 text-cta" />
                        )}
                      </div>
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
                    <p className="text-text-muted mb-1.5">COGS</p>
                    <p className="text-sm font-bold text-text-navy">£{item.pricePerUnit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Retail Price</p>
                    <p className="text-sm font-bold text-text-navy">{item.retailPrice !== undefined ? `£${item.retailPrice.toFixed(2)}` : '-'}</p>
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
                    <p className="text-text-muted mb-1.5">Value</p>
                    <p className="text-sm font-bold text-accent">£{(item.quantity * item.pricePerUnit).toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-text-muted mb-1.5">Supplier</p>
                    <p className="text-sm font-bold text-text-navy truncate">{item.supplier || '-'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1.5">Expiry</p>
                    {expiryStatus ? (
                      <span className={`px-2 py-0.5 rounded-lg border font-bold ${expiryStatus.className}`}>
                        {expiryStatus.label}
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
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
    </div>
  );
};
