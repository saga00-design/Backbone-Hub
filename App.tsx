
import React, { useState, useEffect, useMemo, useRef, Component, ReactNode } from 'react';
import { initializeSystem } from './services/restaurantService';
import { Dashboard } from './components/Dashboard';
import { ConfirmationModal } from './components/ConfirmationModal';
import { InventoryList } from './components/InventoryList';
import { StockTaking } from './components/StockTaking';
import { InvoiceProcessor } from './components/InvoiceProcessor';
import { AddItemModal } from './components/AddItemModal';
import { ChatBot } from './components/ChatBot';
import { MenuRecipes } from './components/MenuRecipes';
import { TrainingCenter } from './components/TrainingCenter';
import { StockAvailabilityManager } from './components/StockAvailabilityManager';
import { SalesImport } from './components/SalesImport';
import { Reports } from './components/Reports';
import { SupplierManager } from './components/SupplierManager';
import { TableManager } from './components/TableManager';
import { Settings } from './components/Settings';
import { Orders } from './components/Orders';
import { InventoryItem, InventoryCategory, Unit, StockCountRecord, Recipe, SalesImportRecord, Supplier, Order, OrderItem, Invoice, MenuCategory, POSOrder, POSPayment, WasteRecord, ExpenseRecord, MovementType, StockMovement, InventoryType, Table, DailyClosure, ClosureType, Forecast, StaffPerformanceRecord, AppPermissions, StaffCertification, AuditLog, StaffMember, SideAddonItem, ReceivingRecord, ReceivingRecordItem, SupplierPriceHistoryEntry, LabourShift, PayrollCentreWeekRecord } from './types';
import { logAuditAction } from './services/auditService';
import { getBusinessDay, getBusinessDayFor } from './utils/businessDay';
import { getCurrentPeriod, getPeriodWeekStarts } from './utils/fiscalCalendar';
import { buildWeeklyLabourCostPenceMap, sumLabourCostForWeeks, filterShiftsForCost, mergeRealPayrollData } from './services/labourImportService';
import { LayoutDashboard, Package, ClipboardCheck, FileInput, Menu, X, ChefHat, TrendingUp, Truck, Settings as SettingsIcon, BookOpen, Sun, Moon, ShoppingCart, AlertCircle, LogIn, LogOut, Trash2, ReceiptPoundSterling, Megaphone, LayoutList, PoundSterling } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, handleFirestoreError, OperationType, User, cleanObject, signOut, increment, query, where, orderBy, limit, testConnection, LOCATION_ID, writeBatch } from './firebase';
import { DEFAULT_PERMISSIONS, ADMIN_EMAILS } from './constants';
import { calculateTotalCost, mapCategoryId, computeCategorySalesSplit } from './utils/recipeUtils';
import { CONVERSION_FACTORS, toSafeNumber, resolveInvoiceLine } from './utils/unitConversions';
import { normalizeCurrency, normalizeTimestamp, normalizeStatus } from './utils/currencyUtils';
import { OfflineBanner } from './components/OfflineBanner';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { WasteManager } from './components/WasteManager';
import { OperationCosts } from './components/OperationCosts';
import { ShiftBriefingManager } from './components/ShiftBriefingManager';
import { FinancialCommandCenter } from './components/FinancialCommandCenter';
import { LabourIntelligence } from './components/LabourIntelligence';
import { HardHat } from 'lucide-react';


// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  showConfirm?: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, showConfirm: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-main-bg flex items-center justify-center p-4">
          <div className="bg-card-bg p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-error/20 text-cta rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-text-navy mb-2">Something went wrong</h1>
            <p className="text-text-muted mb-6">
              The application encountered an error. This is likely due to browser storage limits being exceeded. 
              {this.state.error?.message.includes('quota') && " Your recipe data with high-quality images has filled the available space."}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-accent text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
              >
                Reload Application
              </button>
              <button
                onClick={() => this.setState({ showConfirm: true })}
                className="w-full bg-card-bg text-cta border border-error/30 py-3 rounded-xl font-semibold hover:bg-error/10 transition-colors"
              >
                Clear All Data (Reset)
              </button>
            </div>
          </div>
          <ConfirmationModal
            isOpen={!!this.state.showConfirm}
            title="Clear All Data"
            message="This will clear all your saved data. Are you sure?"
            onConfirm={() => {
              localStorage.clear();
              window.location.reload();
            }}
            onCancel={() => this.setState({ showConfirm: false })}
            variant="danger"
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// Mock Data
const INITIAL_ITEMS: InventoryItem[] = [
  // 20 Ingredients
  { id: 'i1', name: 'Premium Flour', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 50000, unit: 'kg', unitSize: 1000, packaging: 'bag', minStockLevel: 20000, pricePerUnit: 0.0025, lastUpdated: '2023-10-25', supplier: 'GrainMaster', isActive: true },
  { id: 'i2', name: 'Olive Oil', category: 'Ingredient', subCategory: 'Oils & Fats', department: 'Food', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 12000, unit: 'L', unitSize: 1000, packaging: 'bottle', minStockLevel: 15000, pricePerUnit: 0.018, lastUpdated: '2023-10-24', supplier: 'Mediterranean Imports', isActive: true },
  { id: 'i3', name: 'Whole Milk', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 4000, unit: 'L', unitSize: 1000, packaging: 'bottle', minStockLevel: 10000, pricePerUnit: 0.0015, lastUpdated: '2023-10-26', supplier: 'Local Dairy', isActive: true },
  { id: 'i4', name: 'Fresh Basil', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 500, unit: 'kg', unitSize: 1000, minStockLevel: 1000, pricePerUnit: 0.022, lastUpdated: '2023-10-26', supplier: 'FarmFresh', isActive: true },
  { id: 'i5', name: 'Tomato Sauce', category: 'Ingredient', subCategory: 'Canned Goods', department: 'Food', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 20000, unit: 'L', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.0035, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  { id: 'i6', name: 'Mozzarella Cheese', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 15000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.008, lastUpdated: '2023-10-25', supplier: 'Local Dairy', isActive: true },
  { id: 'i7', name: 'Chicken Breast', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 25000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.0065, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  { id: 'i8', name: 'Beef Mince', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.0075, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  { id: 'i9', name: 'Onions', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 30000, unit: 'kg', unitSize: 1000, minStockLevel: 10000, pricePerUnit: 0.0012, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  { id: 'i10', name: 'Garlic', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 2000, pricePerUnit: 0.004, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  { id: 'i11', name: 'Spaghetti', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 40000, unit: 'kg', unitSize: 1000, minStockLevel: 15000, pricePerUnit: 0.002, lastUpdated: '2023-10-25', supplier: 'GrainMaster', isActive: true },
  { id: 'i12', name: 'Eggs', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 300, unit: 'pcs', unitSize: 1, minStockLevel: 100, pricePerUnit: 0.2, lastUpdated: '2023-10-25', supplier: 'Local Dairy', isActive: true },
  { id: 'i13', name: 'Butter', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 3000, pricePerUnit: 0.0055, lastUpdated: '2023-10-25', supplier: 'Local Dairy', isActive: true },
  { id: 'i14', name: 'Sugar', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 20000, unit: 'kg', unitSize: 1000, minStockLevel: 5000, pricePerUnit: 0.0015, lastUpdated: '2023-10-25', supplier: 'GrainMaster', isActive: true },
  { id: 'i15', name: 'Salt', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 10000, unit: 'kg', unitSize: 1000, minStockLevel: 2000, pricePerUnit: 0.0008, lastUpdated: '2023-10-25', supplier: 'GrainMaster', isActive: true },
  { id: 'i16', name: 'Black Pepper', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 2000, unit: 'kg', unitSize: 1000, minStockLevel: 500, pricePerUnit: 0.015, lastUpdated: '2023-10-25', supplier: 'GrainMaster', isActive: true },
  { id: 'i17', name: 'Parmesan Cheese', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 5000, unit: 'kg', unitSize: 1000, minStockLevel: 2000, pricePerUnit: 0.018, lastUpdated: '2023-10-25', supplier: 'Local Dairy', isActive: true },
  { id: 'i18', name: 'Bacon', category: 'Ingredient', subCategory: 'Meat', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 8000, unit: 'kg', unitSize: 1000, minStockLevel: 3000, pricePerUnit: 0.009, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  { id: 'i19', name: 'Arroz', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 15000, unit: 'kg', unitSize: 1000, packaging: 'bag', minStockLevel: 5000, pricePerUnit: 0.0025, lastUpdated: '2023-10-27', supplier: 'GrainMaster', isActive: true },
  { id: 'i20', name: 'Heavy Cream', category: 'Ingredient', subCategory: 'Dairy', department: 'Food', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 10000, unit: 'L', unitSize: 1000, minStockLevel: 3000, pricePerUnit: 0.0045, lastUpdated: '2023-10-25', supplier: 'Local Dairy', isActive: true },
  { id: 'i21', name: 'Mushrooms', category: 'Ingredient', subCategory: 'Produce', department: 'Food', inventoryType: 'SOLID', baseUnit: 'g', quantity: 6000, unit: 'kg', unitSize: 1000, minStockLevel: 2000, pricePerUnit: 0.005, lastUpdated: '2023-10-25', supplier: 'FarmFresh', isActive: true },
  // Beverage Items
  { id: 'i22', name: 'Jose Cuervo Tequila', category: 'Ingredient', subCategory: 'Spirits - Tequila', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 3500, unit: 'bottles', unitSize: 700, minStockLevel: 1400, pricePerUnit: 0.0357, lastUpdated: '2023-10-25', supplier: 'BarSupply', isActive: true },
  { id: 'i23', name: 'Grey Goose Vodka', category: 'Ingredient', subCategory: 'Spirits - Vodka', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 5600, unit: 'bottles', unitSize: 700, minStockLevel: 2100, pricePerUnit: 0.05, lastUpdated: '2023-10-25', supplier: 'BarSupply', isActive: true },
  { id: 'i24', name: 'Jameson Whiskey', category: 'Ingredient', subCategory: 'Spirits - Whiskey', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 7000, unit: 'bottles', unitSize: 700, minStockLevel: 2800, pricePerUnit: 0.0428, lastUpdated: '2023-10-25', supplier: 'BarSupply', isActive: true },
  { id: 'i25', name: 'Tanqueray Gin', category: 'Ingredient', subCategory: 'Spirits - Gin', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 4200, unit: 'bottles', unitSize: 700, minStockLevel: 1400, pricePerUnit: 0.04, lastUpdated: '2023-10-25', supplier: 'BarSupply', isActive: true },
  { id: 'i26', name: 'Bacardi Rum', category: 'Ingredient', subCategory: 'Spirits - Rum', department: 'Beverage', inventoryType: 'LIQUID', baseUnit: 'ml', quantity: 8400, unit: 'bottles', unitSize: 700, minStockLevel: 3500, pricePerUnit: 0.0314, lastUpdated: '2023-10-25', supplier: 'BarSupply', isActive: true },
  // Keep existing non-ingredients
  { id: '5', name: 'Chef Knife', category: 'Utensil', subCategory: 'Knives', department: 'Food', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 8, unit: 'pcs', unitSize: 1, minStockLevel: 10, pricePerUnit: 45.0, lastUpdated: '2023-09-15', supplier: 'KitchenPro', totalOwned: 10, brokenQuantity: 2, isActive: true },
  { id: '6', name: 'Mixing Bowl (L)', category: 'Utensil', subCategory: 'Prep Tools', department: 'Food', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 15, unit: 'pcs', unitSize: 1, minStockLevel: 10, pricePerUnit: 12.0, lastUpdated: '2023-09-15', supplier: 'KitchenPro', isActive: true },
  { id: '7', name: 'Stand Mixer', category: 'Equipment', subCategory: 'Appliances', department: 'Food', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 3, unit: 'pcs', unitSize: 1, minStockLevel: 3, pricePerUnit: 350.0, lastUpdated: '2023-01-10', supplier: 'TechChef', totalOwned: 3, brokenQuantity: 0, isActive: true },
  { id: '8', name: 'Dinner Plate (10")', category: 'Crockery', subCategory: 'Plates', department: 'Restaurant', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 42, unit: 'pcs', unitSize: 1, minStockLevel: 40, pricePerUnit: 8.5, lastUpdated: '2023-09-01', supplier: 'RestoSupply', totalOwned: 50, brokenQuantity: 8, isActive: true },
  { id: '9', name: 'Soup Bowl', category: 'Crockery', subCategory: 'Bowls', department: 'Restaurant', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 28, unit: 'pcs', unitSize: 1, minStockLevel: 30, pricePerUnit: 6.0, lastUpdated: '2023-09-01', supplier: 'RestoSupply', totalOwned: 30, brokenQuantity: 2, isActive: true },
  { id: '10', name: 'Wine Glass', category: 'Crockery', subCategory: 'Glassware', department: 'Beverage', inventoryType: 'UNIT', baseUnit: 'pcs', quantity: 35, unit: 'pcs', unitSize: 1, minStockLevel: 40, pricePerUnit: 4.5, lastUpdated: '2023-09-10', supplier: 'GlassMasters', totalOwned: 48, brokenQuantity: 13, isActive: true },
];

const INITIAL_SUPPLIERS: Supplier[] = [
    { id: 's1', name: 'GrainMaster', contactName: 'Bob Miller', phone: '555-0101', email: 'orders@grainmaster.com' },
    { id: 's2', name: 'Mediterranean Imports', contactName: 'Maria Rossi', phone: '555-0202', address: '12 Olive Way, London' },
    { id: 's3', name: 'Local Dairy', contactName: 'Sarah Cows', phone: '555-0303' },
    { id: 's4', name: 'FarmFresh', contactName: 'Joe Farmer', email: 'joe@farmfresh.co.uk' },
    { id: 's5', name: 'KitchenPro', contactName: 'Sales Team', phone: '0800-KITCHEN' },
    { id: 's6', name: 'RestoSupply', contactName: 'Support', email: 'support@restosupply.com' },
];

const INITIAL_RECIPES: Recipe[] = [
  // 10 Batches (type: 'recipe')
  {
    id: 'b1', name: 'Pizza Dough Batch', description: 'Standard pizza dough', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 10, yieldUnit: 'kg', calories: 25000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 6, unit: 'kg', baseQuantity: 6000 }, { inventoryItemId: 'i2', quantity: 0.5, unit: 'L', baseQuantity: 500 }, { inventoryItemId: 'i15', quantity: 0.1, unit: 'kg', baseQuantity: 100 } ]
  },
  {
    id: 'b2', name: 'Tomato Sauce Batch', description: 'Base tomato sauce for pizza and pasta', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 20, yieldUnit: 'L', calories: 8000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i5', quantity: 18, unit: 'L', baseQuantity: 18000 }, { inventoryItemId: 'i2', quantity: 1, unit: 'L', baseQuantity: 1000 }, { inventoryItemId: 'i10', quantity: 0.5, unit: 'kg', baseQuantity: 500 }, { inventoryItemId: 'i9', quantity: 2, unit: 'kg', baseQuantity: 2000 } ]
  },
  {
    id: 'b3', name: 'Bolognese Sauce Batch', description: 'Rich meat sauce', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 15, yieldUnit: 'L', calories: 15000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i8', quantity: 5, unit: 'kg', baseQuantity: 5000 }, { inventoryItemId: 'i5', quantity: 8, unit: 'L', baseQuantity: 8000 }, { inventoryItemId: 'i9', quantity: 1, unit: 'kg', baseQuantity: 1000 }, { inventoryItemId: 'i10', quantity: 0.2, unit: 'kg', baseQuantity: 200 } ]
  },
  {
    id: 'b4', name: 'Carbonara Sauce Batch', description: 'Creamy bacon sauce', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 5, yieldUnit: 'L', calories: 12000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i19', quantity: 3, unit: 'L', baseQuantity: 3000 }, { inventoryItemId: 'i18', quantity: 1, unit: 'kg', baseQuantity: 1000 }, { inventoryItemId: 'i17', quantity: 0.5, unit: 'kg', baseQuantity: 500 }, { inventoryItemId: 'i12', quantity: 10, unit: 'pcs', baseQuantity: 10 } ]
  },
  {
    id: 'b5', name: 'Mushroom Soup Batch', description: 'Creamy mushroom soup', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 10, yieldUnit: 'L', calories: 6000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i20', quantity: 3, unit: 'kg', baseQuantity: 3000 }, { inventoryItemId: 'i19', quantity: 2, unit: 'L', baseQuantity: 2000 }, { inventoryItemId: 'i9', quantity: 1, unit: 'kg', baseQuantity: 1000 }, { inventoryItemId: 'i13', quantity: 0.5, unit: 'kg', baseQuantity: 500 } ]
  },
  {
    id: 'b6', name: 'Garlic Butter Batch', description: 'Butter mixed with garlic and herbs', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 2, yieldUnit: 'kg', calories: 14000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i13', quantity: 1.8, unit: 'kg', baseQuantity: 1800 }, { inventoryItemId: 'i10', quantity: 0.2, unit: 'kg', baseQuantity: 200 } ]
  },
  {
    id: 'b7', name: 'Chicken Marinade Batch', description: 'Herb and oil marinade for chicken', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 5, yieldUnit: 'L', calories: 40000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i2', quantity: 4, unit: 'L', baseQuantity: 4000 }, { inventoryItemId: 'i10', quantity: 0.5, unit: 'kg', baseQuantity: 500 }, { inventoryItemId: 'i15', quantity: 0.2, unit: 'kg', baseQuantity: 200 } ]
  },
  {
    id: 'b8', name: 'Pasta Dough Batch', description: 'Fresh pasta dough', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 5, yieldUnit: 'kg', calories: 15000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 3.5, unit: 'kg', baseQuantity: 3500 }, { inventoryItemId: 'i12', quantity: 30, unit: 'pcs', baseQuantity: 30 }, { inventoryItemId: 'i2', quantity: 0.1, unit: 'L', baseQuantity: 100 } ]
  },
  {
    id: 'b9', name: 'Bechamel Sauce Batch', description: 'White sauce for lasagna', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 8, yieldUnit: 'L', calories: 9000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i3', quantity: 6, unit: 'L', baseQuantity: 6000 }, { inventoryItemId: 'i13', quantity: 0.8, unit: 'kg', baseQuantity: 800 }, { inventoryItemId: 'i1', quantity: 0.8, unit: 'kg', baseQuantity: 800 } ]
  },
  {
    id: 'b10', name: 'Pancake Batter Batch', description: 'Breakfast pancake batter', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 10, yieldUnit: 'L', calories: 18000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 4, unit: 'kg', baseQuantity: 4000 }, { inventoryItemId: 'i3', quantity: 5, unit: 'L', baseQuantity: 5000 }, { inventoryItemId: 'i12', quantity: 20, unit: 'pcs', baseQuantity: 20 }, { inventoryItemId: 'i14', quantity: 0.5, unit: 'kg', baseQuantity: 500 } ]
  },

  // 10 Menu Items (type: 'menu_item')
  {
    id: 'm1', name: 'Margherita Pizza', description: 'Classic cheese and tomato pizza with fresh basil', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 12.50, calories: 800, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 0.25, unit: 'kg', baseQuantity: 250 }, { inventoryItemId: 'i5', quantity: 0.1, unit: 'L', baseQuantity: 100 }, { inventoryItemId: 'i6', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i4', quantity: 0.01, unit: 'kg', baseQuantity: 10 } ]
  },
  {
    id: 'm2', name: 'Spaghetti Bolognese', description: 'Classic Italian meat sauce with spaghetti', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 14.00, calories: 950, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i8', quantity: 0.2, unit: 'kg', baseQuantity: 200 }, { inventoryItemId: 'i5', quantity: 0.25, unit: 'L', baseQuantity: 250 }, { inventoryItemId: 'i17', quantity: 0.02, unit: 'kg', baseQuantity: 20 } ]
  },
  {
    id: 'm3', name: 'Chicken Alfredo', description: 'Creamy pasta with grilled chicken', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 16.50, calories: 1100, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i7', quantity: 0.2, unit: 'kg', baseQuantity: 200 }, { inventoryItemId: 'i19', quantity: 0.1, unit: 'L', baseQuantity: 100 }, { inventoryItemId: 'i17', quantity: 0.03, unit: 'kg', baseQuantity: 30 } ]
  },
  {
    id: 'm4', name: 'Mushroom Risotto', description: 'Creamy arborio rice with wild mushrooms', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 15.00, calories: 750, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i20', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i19', quantity: 0.05, unit: 'L', baseQuantity: 50 }, { inventoryItemId: 'i17', quantity: 0.04, unit: 'kg', baseQuantity: 40 }, { inventoryItemId: 'i9', quantity: 0.05, unit: 'kg', baseQuantity: 50 } ]
  },
  {
    id: 'm5', name: 'Spaghetti Carbonara', description: 'Pasta with bacon, egg, and cheese sauce', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 14.50, calories: 1050, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i18', quantity: 0.1, unit: 'kg', baseQuantity: 100 }, { inventoryItemId: 'i19', quantity: 0.05, unit: 'L', baseQuantity: 50 }, { inventoryItemId: 'i17', quantity: 0.03, unit: 'kg', baseQuantity: 30 }, { inventoryItemId: 'i12', quantity: 1, unit: 'pcs', baseQuantity: 1 } ]
  },
  {
    id: 'm6', name: 'Garlic Bread', description: 'Toasted bread with garlic butter', type: 'menu_item', category: 'Food', subCategory: 'Starters', sellingPrice: 5.50, calories: 450, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 0.1, unit: 'kg', baseQuantity: 100 }, { inventoryItemId: 'i13', quantity: 0.05, unit: 'kg', baseQuantity: 50 }, { inventoryItemId: 'i10', quantity: 0.01, unit: 'kg', baseQuantity: 10 } ]
  },
  {
    id: 'm7', name: 'Creamy Mushroom Soup', description: 'Bowl of rich mushroom soup', type: 'menu_item', category: 'Food', subCategory: 'Starters', sellingPrice: 7.00, calories: 350, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i20', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i19', quantity: 0.05, unit: 'L', baseQuantity: 50 }, { inventoryItemId: 'i9', quantity: 0.05, unit: 'kg', baseQuantity: 50 } ]
  },
  {
    id: 'm8', name: 'Pancakes with Syrup', description: 'Stack of 3 fluffy pancakes', type: 'menu_item', category: 'Food', subCategory: 'Desserts', sellingPrice: 9.00, calories: 600, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 0.1, unit: 'kg', baseQuantity: 100 }, { inventoryItemId: 'i3', quantity: 0.1, unit: 'L', baseQuantity: 100 }, { inventoryItemId: 'i12', quantity: 2, unit: 'pcs', baseQuantity: 2 }, { inventoryItemId: 'i14', quantity: 0.05, unit: 'kg', baseQuantity: 50 } ]
  },
  {
    id: 'm9', name: 'Grilled Chicken Salad', description: 'Fresh salad with marinated chicken', type: 'menu_item', category: 'Food', subCategory: 'Starters', sellingPrice: 13.50, calories: 550, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i7', quantity: 0.2, unit: 'kg', baseQuantity: 200 }, { inventoryItemId: 'i2', quantity: 0.02, unit: 'L', baseQuantity: 20 }, { inventoryItemId: 'i4', quantity: 0.02, unit: 'kg', baseQuantity: 20 } ]
  },
  {
    id: 'm10', name: 'Lasagna', description: 'Layered pasta with meat and cheese sauce', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 16.00, calories: 850, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.1, unit: 'kg', baseQuantity: 100 }, { inventoryItemId: 'i8', quantity: 0.15, unit: 'kg', baseQuantity: 150 }, { inventoryItemId: 'i5', quantity: 0.1, unit: 'L', baseQuantity: 100 }, { inventoryItemId: 'i6', quantity: 0.1, unit: 'kg', baseQuantity: 100 }, { inventoryItemId: 'i3', quantity: 0.1, unit: 'L', baseQuantity: 100 } ]
  },
  // 10 Cocktails (type: 'menu_item', category: 'Beverage')
  {
    id: 'c1', name: 'Classic Margarita', description: 'Tequila, lime juice, and Cointreau with a salt rim.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 12.00, calories: 200, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1568222083177-af5a3828c611?auto=format&fit=crop&q=80&w=400',
    ingredients: [], winePairing: { name: 'Pairs well with spicy Mexican dishes.' }
  },
  {
    id: 'c2', name: 'Old Fashioned', description: 'Bourbon, Angostura bitters, sugar cube, and an orange twist.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 14.00, calories: 150, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1597075687490-8f673c6c17f6?auto=format&fit=crop&q=80&w=400',
    ingredients: [], winePairing: { name: 'Excellent with steak or rich meats.' }
  },
  {
    id: 'c3', name: 'Mojito', description: 'White rum, fresh mint, lime juice, sugar, and soda water.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 11.00, calories: 160, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&q=80&w=400',
    ingredients: [], winePairing: { name: 'Refreshing with seafood or light salads.' }
  },
  {
    id: 'c4', name: 'Espresso Martini', description: 'Vodka, espresso coffee, coffee liqueur, and sugar syrup.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 13.00, calories: 220, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1620189507195-68309c04c4d0?auto=format&fit=crop&q=80&w=400',
    ingredients: [], cocktailPairing: { name: 'Perfect as an after-dinner drink or with chocolate desserts.' }
  },
  {
    id: 'c5', name: 'Negroni', description: 'Gin, Campari, and sweet vermouth garnished with orange peel.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 13.50, calories: 190, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=400',
    ingredients: [], cocktailPairing: { name: 'A classic aperitif, pairs with charcuterie.' }
  },
  {
    id: 'c6', name: 'Aperol Spritz', description: 'Aperol, Prosecco, and a splash of soda water.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 10.50, calories: 170, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&q=80&w=400',
    ingredients: [], cocktailPairing: { name: 'Great with light appetizers and olives.' }
  },
  {
    id: 'c7', name: 'Whiskey Sour', description: 'Bourbon, lemon juice, simple syrup, and an egg white.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 12.50, calories: 180, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1606567595334-d39972c85dbe?auto=format&fit=crop&q=80&w=400',
    ingredients: [], cocktailPairing: { name: 'Pairs well with roasted nuts and aged cheeses.' }
  },
  {
    id: 'c8', name: 'Cosmopolitan', description: 'Vodka, Cointreau, cranberry juice, and fresh lime juice.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 11.50, calories: 150, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1629158737890-8772274d4719?auto=format&fit=crop&q=80&w=400',
    ingredients: [], winePairing: { name: 'Pairs nicely with light chicken dishes.' }
  },
  {
    id: 'c9', name: 'Mai Tai', description: 'Rum, Curaçao, orgeat syrup, and lime juice.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 14.50, calories: 260, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=400',
    ingredients: [], winePairing: { name: 'Excellent with tropical or Asian-inspired cuisine.' }
  },
  {
    id: 'c10', name: 'Pina Colada', description: 'White rum, coconut cream, and pineapple juice blended with ice.', type: 'menu_item', category: 'Beverage', subCategory: 'Cocktails', sellingPrice: 12.00, calories: 300, lastUpdated: '2023-10-28', imageUrl: 'https://images.unsplash.com/photo-1592320937521-84c88747a68a?auto=format&fit=crop&q=80&w=400',
    ingredients: [], cocktailPairing: { name: 'A dessert in itself, or pair with spicy food.' }
  },
  // 5 Brands for each category
  { id: 'b-teq-1', name: 'Jose Cuervo Reserva', description: 'Premium Tequila', type: 'menu_item', category: 'Beverage', subCategory: 'Tequila', sellingPrice: 45, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-teq-2', name: 'Don Julio 1942', description: 'Ultra-Premium Tequila', type: 'menu_item', category: 'Beverage', subCategory: 'Tequila', sellingPrice: 120, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-teq-3', name: 'Patron Silver', description: 'Classic Silver Tequila', type: 'menu_item', category: 'Beverage', subCategory: 'Tequila', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-teq-4', name: 'Casamigos Reposado', description: 'Smooth Reposado Tequila', type: 'menu_item', category: 'Beverage', subCategory: 'Tequila', sellingPrice: 55, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-teq-5', name: 'Espolon Blanco', description: 'Versatile Blanco Tequila', type: 'menu_item', category: 'Beverage', subCategory: 'Tequila', sellingPrice: 28, lastUpdated: '2023-10-28', ingredients: [] },
  
  { id: 'b-mez-1', name: 'Del Maguey Vida', description: 'Artisanal Mezcal', type: 'menu_item', category: 'Beverage', subCategory: 'Mezcal', sellingPrice: 38, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-mez-2', name: 'Montelobos Espadin', description: 'Organic Mezcal', type: 'menu_item', category: 'Beverage', subCategory: 'Mezcal', sellingPrice: 42, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-mez-3', name: 'Casamigos Mezcal', description: 'Balanced Mezcal', type: 'menu_item', category: 'Beverage', subCategory: 'Mezcal', sellingPrice: 65, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-mez-4', name: 'Ilegal Mezcal Joven', description: 'Smooth Joven Mezcal', type: 'menu_item', category: 'Beverage', subCategory: 'Mezcal', sellingPrice: 48, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-mez-5', name: 'Bozal Ensamble', description: 'Complex Ensamble Mezcal', type: 'menu_item', category: 'Beverage', subCategory: 'Mezcal', sellingPrice: 52, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-rw-1', name: 'Robert Mondavi Cabernet', description: 'Classic Napa Red', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 55, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rw-2', name: 'Kendall-Jackson Merlot', description: 'Smooth Merlot', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 45, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rw-3', name: 'Meiomi Pinot Noir', description: 'Rich Pinot Noir', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 52, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rw-4', name: 'Yellow Tail Shiraz', description: 'Accessible Shiraz', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 25, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rw-5', name: 'Barefoot Malbec', description: 'Easy-drinking Malbec', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 22, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-ww-1', name: 'Kim Crawford Sauvignon Blanc', description: 'Zesty White', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 48, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ww-2', name: 'Oyster Bay Chardonnay', description: 'Crisp Chardonnay', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 42, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ww-3', name: 'Santa Margherita Pinot Grigio', description: 'Premium Pinot Grigio', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 58, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ww-4', name: 'Cloudy Bay Sauvignon Blanc', description: 'Iconic White', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 65, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ww-5', name: 'Chateau Ste. Michelle Riesling', description: 'Sweet Riesling', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-vod-1', name: 'Grey Goose', description: 'Premium French Vodka', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 45, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-vod-2', name: 'Belvedere', description: 'Polish Rye Vodka', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 42, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-vod-3', name: 'Absolut', description: 'Swedish Vodka', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 32, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-vod-4', name: 'Tito\'s Handmade', description: 'American Craft Vodka', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-vod-5', name: 'Ketel One', description: 'Dutch Wheat Vodka', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 38, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-whi-1', name: 'Jameson', description: 'Irish Whiskey', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-whi-2', name: 'Jack Daniel\'s', description: 'Tennessee Whiskey', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 32, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-whi-3', name: 'Johnnie Walker Black', description: 'Blended Scotch', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 48, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-whi-4', name: 'Maker\'s Mark', description: 'Bourbon Whiskey', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 42, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-whi-5', name: 'Glenfiddich 12', description: 'Single Malt Scotch', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 55, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-gin-1', name: 'Tanqueray', description: 'London Dry Gin', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 32, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-gin-2', name: 'Bombay Sapphire', description: 'Vibrant Gin', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-gin-3', name: 'Hendrick\'s', description: 'Cucumber & Rose Gin', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 45, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-gin-4', name: 'Beefeater', description: 'Classic London Dry', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 28, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-gin-5', name: 'The Botanist', description: 'Islay Dry Gin', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 48, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-ros-1', name: 'Whispering Angel', description: 'Premium Rose', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 52, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ros-2', name: 'Miraval', description: 'Elegant Rose', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 48, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ros-3', name: 'Gerard Bertrand Cote des Roses', description: 'Floral Rose', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 38, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ros-4', name: 'Hampton Water', description: 'Modern Rose', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 42, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-ros-5', name: 'Chateau d\'Esclans', description: 'Classic Provence Rose', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 45, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-spa-1', name: 'Moet & Chandon Impérial', description: 'Classic Champagne', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 85, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-spa-2', name: 'Veuve Clicquot Yellow Label', description: 'Iconic Champagne', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 95, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-spa-3', name: 'Dom Perignon', description: 'Vintage Champagne', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 250, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-spa-4', name: 'La Marca Prosecco', description: 'Crisp Prosecco', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-spa-5', name: 'Freixenet Cordon Negro', description: 'Classic Cava', type: 'menu_item', category: 'Beverage', subCategory: 'Wines', sellingPrice: 28, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-rum-1', name: 'Bacardi Superior', description: 'White Rum', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 28, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rum-2', name: 'Captain Morgan Spiced', description: 'Spiced Rum', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 32, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rum-3', name: 'Havana Club 7', description: 'Aged Cuban Rum', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 42, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rum-4', name: 'Malibu', description: 'Coconut Rum', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 25, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-rum-5', name: 'Diplomatico Reserva', description: 'Premium Aged Rum', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 55, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-bra-1', name: 'Hennessy VS', description: 'Classic Cognac', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 48, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-bra-2', name: 'Martell VSOP', description: 'Smooth Cognac', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 65, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-bra-3', name: 'Remy Martin XO', description: 'Ultra-Premium Cognac', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 180, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-bra-4', name: 'Courvoisier VS', description: 'Elegant Cognac', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 45, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-bra-5', name: 'E&J Brandy', description: 'Accessible Brandy', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 22, lastUpdated: '2023-10-28', ingredients: [] },

  { id: 'b-liq-1', name: 'Baileys Irish Cream', description: 'Cream Liqueur', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 28, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-liq-2', name: 'Kahlua', description: 'Coffee Liqueur', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 25, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-liq-3', name: 'Cointreau', description: 'Orange Liqueur', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 35, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-liq-4', name: 'Aperol', description: 'Aperitif Liqueur', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 22, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'b-liq-5', name: 'Campari', description: 'Bitter Liqueur', type: 'menu_item', category: 'Beverage', subCategory: 'Spirits', sellingPrice: 24, lastUpdated: '2023-10-28', ingredients: [] },
  // Beers
  { id: 'beer-1', name: 'Heineken', description: 'Classic Lager', type: 'menu_item', category: 'Beverage', subCategory: 'Beers', sellingPrice: 5.50, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'beer-2', name: 'Guinness', description: 'Irish Stout', type: 'menu_item', category: 'Beverage', subCategory: 'Beers', sellingPrice: 6.50, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'beer-3', name: 'Corona', description: 'Mexican Lager', type: 'menu_item', category: 'Beverage', subCategory: 'Beers', sellingPrice: 5.00, lastUpdated: '2023-10-28', ingredients: [] },
  // Coffees
  { id: 'coffee-1', name: 'Cappuccino', description: 'Espresso with steamed milk foam', type: 'menu_item', category: 'Beverage', subCategory: 'Coffees', sellingPrice: 3.50, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'coffee-2', name: 'Latte', description: 'Espresso with steamed milk', type: 'menu_item', category: 'Beverage', subCategory: 'Coffees', sellingPrice: 3.80, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'coffee-3', name: 'Flat White', description: 'Espresso with velvety microfoam', type: 'menu_item', category: 'Beverage', subCategory: 'Coffees', sellingPrice: 3.60, lastUpdated: '2023-10-28', ingredients: [] },
  // Non-alcoholic
  { id: 'na-1', name: 'Coca Cola', description: 'Classic Soda', type: 'menu_item', category: 'Beverage', subCategory: 'Non-alcoholic', sellingPrice: 2.50, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'na-2', name: 'Fresh Orange Juice', description: '100% Squeezed', type: 'menu_item', category: 'Beverage', subCategory: 'Non-alcoholic', sellingPrice: 4.00, lastUpdated: '2023-10-28', ingredients: [] },
  { id: 'na-3', name: 'Still Water', description: 'Natural Spring Water', type: 'menu_item', category: 'Beverage', subCategory: 'Non-alcoholic', sellingPrice: 2.00, lastUpdated: '2023-10-28', ingredients: [] }
];

type View = 'dashboard' | 'inventory' | 'stocktake' | 'invoices' | 'recipes' | 'sales' | 'suppliers' | 'settings' | 'training' | 'orders' | 'reports' | 'waste' | 'expenses' | 'briefing' | 'tables' | 'financial_command' | 'labour';

// Soft-hidden (not deleted): Financial Command Center's nav item and route are gated behind
// this flag rather than removed, so the component, pnlEngine.ts, and its Firestore reads all
// stay fully intact for Reports.tsx and any future re-enable — flip to true to bring it back.
const SHOW_FINANCIAL_COMMAND = false;

// Role Guard Component - hoisted to module scope (was previously defined
// inside App()'s render body, which meant it was a brand-new component
// definition on every single App render. Since a component's TYPE identity
// changing between renders makes React treat it as a different component
// entirely, that defeated any internal state (like a debounce timer) and,
// more importantly, meant its children (e.g. Settings) were liable to be
// unmounted/remounted more than the role-check logic alone would suggest.
//
// FIX: userRole is recomputed from user (Firebase Auth state) on every
// App render. If Firebase Auth ever emits a transient null for user -
// even for a single render - userRole falls through to Unlinked and this
// guard used to immediately unmount its children, silently resetting all of
// that component's local state (closed modals, active tab reset to its
// default) with no error or log line, since nothing actually failed. This
// debounces the check: a mismatch has to persist for ROLE_GRACE_MS before
// Access Denied actually shows / children actually unmount, so a one-render
// auth blip no longer kicks the user out of whatever they were doing.
const ROLE_GRACE_MS = 1500;

const RoleGuard: React.FC<{ userRole: string; allowedRoles: string[]; children: React.ReactNode }> = ({ userRole, allowedRoles, children }) => {
  const isAllowed = allowedRoles.includes(userRole);
  const [showDenied, setShowDenied] = useState(!isAllowed);

  useEffect(() => {
    if (isAllowed) {
      setShowDenied(false);
      return;
    }
    const timer = setTimeout(() => setShowDenied(true), ROLE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [isAllowed]);

  if (showDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <AlertCircle className="h-16 w-16 text-error mb-4 opacity-20" />
        <h2 className="text-2xl font-bold text-text-navy mb-2">Access Denied</h2>
        <p className="text-text-muted max-w-md">You do not have the required permissions to access this section. Please contact your administrator.</p>
      </div>
    );
  }
  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [editRecipeId, setEditRecipeId] = useState<string | null>(null);

  const onNavItemClick = (view: View) => {
    setCurrentView(view);
  };
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
const [suppliers, setSuppliers] = useState<Supplier[]>([]);
const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockHistory, setStockHistory] = useState<StockCountRecord[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesImportRecord[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [receivingRecords, setReceivingRecords] = useState<ReceivingRecord[]>([]);
  const [supplierPriceHistory, setSupplierPriceHistory] = useState<SupplierPriceHistoryEntry[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [posOrders, setPosOrders] = useState<POSOrder[]>([]);
  const [posTransactions, setPosTransactions] = useState<any[]>([]);
  // Single source of truth for connectivity across the app (OfflineBanner, the
  // reconnect toast, and the Dashboard's connectivity dot): a direct Firestore
  // server round-trip, not an approximation from listener sync state or the
  // browser's online/offline events.
  const { isOnline: isConnectionOnline, offlineDuration } = useConnectionStatus();

  // Threshold-based toast on top of the same connectivity signal driving the
  // OfflineBanner and the dashboard dot (isConnectionOnline). Brief blips that
  // recover within DISCONNECT_TOAST_DELAY_MS never show anything — only a
  // sustained outage crossing the threshold surfaces a toast, once per outage.
  const disconnectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectToastShownRef = useRef(false);

  useEffect(() => {
    const DISCONNECT_TOAST_DELAY_MS = 12000;

    if (!isConnectionOnline) {
      if (!disconnectToastTimerRef.current) {
        disconnectToastTimerRef.current = setTimeout(() => {
          toast.error('Connection lost');
          disconnectToastShownRef.current = true;
          disconnectToastTimerRef.current = null;
        }, DISCONNECT_TOAST_DELAY_MS);
      }
    } else {
      if (disconnectToastTimerRef.current) {
        clearTimeout(disconnectToastTimerRef.current);
        disconnectToastTimerRef.current = null;
      }
      if (disconnectToastShownRef.current) {
        toast.success('Connection restored');
        disconnectToastShownRef.current = false;
      }
    }

    return () => {
      if (disconnectToastTimerRef.current) {
        clearTimeout(disconnectToastTimerRef.current);
        disconnectToastTimerRef.current = null;
      }
    };
  }, [isConnectionOnline]);
  const [posPayments, setPosPayments] = useState<POSPayment[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [permissionsConfig, setPermissionsConfig] = useState<Record<string, AppPermissions>>(DEFAULT_PERMISSIONS);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformanceRecord[]>([]);
  const [staffCertifications, setStaffCertifications] = useState<StaffCertification[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [labourShifts, setLabourShifts] = useState<LabourShift[]>([]);
  const [payrollCentreRecords, setPayrollCentreRecords] = useState<PayrollCentreWeekRecord[]>([]);
  const [livePosSalesSummary, setLivePosSalesSummary] = useState({
    totalPaid: 0,
    grossSales: 0,
    netSales: 0,
    vatTotal: 0,
    serviceChargeTotal: 0,
    discountTotal: 0,
    orderCount: 0,
    salesByPaymentMethod: {} as Record<string, number>
  });
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  // Helper to safely get date portion from various formats
  const safeDateSplit = (date: any): string => {
    if (!date) return '';
    try {
      let d: Date;
      if (date && typeof date === 'object' && 'seconds' in date) {
        d = new Date(date.seconds * 1000);
      } else {
        d = new Date(date);
      }
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    } catch (e) {
      return '';
    }
  };
  
  // Real-time POS Sales Reporting Layer
    const liveSalesData = useMemo(() => {
  const now = new Date();
const londonHour = parseInt(
  now.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false })
);
const today = londonHour < 6
  ? new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  : now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

  const allPaid = posTransactions.filter((t: any) => t.status === 'paid');
  const todayTx = allPaid.filter((t: any) => t.businessDate === today);

  const sum = (arr: any[], field: string) =>
    arr.reduce((s: number, t: any) => s + normalizeCurrency(t[field] ?? 0), 0);

  const history = allPaid.map((t: any) => ({
    id:     t.orderId || t.id,
    status: 'Paid',
    total:  normalizeCurrency(t.grandTotal ?? t.totalGross ?? 0),
    items:  t.items || [],
    tips:   normalizeCurrency(t.tipsAmount ?? 0),
    financials: {
      grossSales:         normalizeCurrency(t.grandTotal         ?? t.totalGross   ?? 0),
      netSales:           normalizeCurrency(t.subtotal           ?? t.netSales     ?? 0),
      vatTotal:           normalizeCurrency(t.vatTotal           ?? 0),
      serviceChargeTotal: normalizeCurrency(t.serviceChargeTotal ?? t.serviceCharge ?? 0),
      discountTotal:      normalizeCurrency(t.discountTotal      ?? t.discountAmount ?? 0),
      totalPaid:          normalizeCurrency(t.grandTotal         ?? t.totalGross   ?? 0),
      paymentMethod:      t.paymentSummary?.primaryPaymentMethod ?? t.paymentMethod ?? 'N/A',
      paymentTimestamp:   t.paidAt ?? t.createdAt,
      reference:          t.tableName ? `Table ${t.tableName}` : `Order #${(t.orderId || t.id || '').slice(-4)}`,
    },
    payments: t.payments || []
  }));

  const salesByDay:   Record<string, number> = {};
  const salesByWeek:  Record<string, number> = {};
  const salesByMonth: Record<string, number> = {};

  const getWeekNo = (d: Date) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1;
  };

  allPaid.forEach((t: any) => {
    const day = t.businessDate || new Date(t.paidAt || t.createdAt)
      .toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    if (!day) return;
    const dateObj = new Date(day);
    const week  = `${dateObj.getFullYear()}-W${getWeekNo(dateObj).toString().padStart(2, '0')}`;
    const month = day.substring(0, 7);
    const val   = normalizeCurrency(t.grandTotal ?? t.totalGross ?? 0);
    salesByDay[day]     = (salesByDay[day]   || 0) + val;
    salesByWeek[week]   = (salesByWeek[week] || 0) + val;
    salesByMonth[month] = (salesByMonth[month] || 0) + val;
  });

  const aggregate = {
    totalGrossSales:    sum(allPaid,   'grandTotal'),
    totalNetSales:      sum(allPaid,   'subtotal'),
    totalVat:           sum(allPaid,   'vatTotal'),
    totalServiceCharge: sum(allPaid,   'serviceChargeTotal'),
    totalDiscounts:     sum(allPaid,   'discountTotal'),
    totalPaid:          sum(allPaid,   'grandTotal'),
    todayPaid:          sum(todayTx,   'grandTotal'),
    todayNet:           sum(todayTx,   'subtotal'),
    todayVat:           sum(todayTx,   'vatTotal'),
    todaySC:            sum(todayTx,   'serviceChargeTotal'),
    todayDiscount:      sum(todayTx,   'discountTotal'),
    todayCovers:        todayTx.reduce((s: number, t: any) => s + (Number(t.covers) || 0), 0),
    averageOrderValue:  todayTx.length > 0 ? sum(todayTx, 'grandTotal') / todayTx.length : 0,
    numberOfPaidOrders: todayTx.length,
    salesByPaymentMethod: allPaid.reduce((acc: any, t: any) => {
      const m = t.paymentSummary?.primaryPaymentMethod ?? t.paymentMethod ?? 'N/A';
      acc[m] = (acc[m] || 0) + normalizeCurrency(t.grandTotal ?? t.totalGross ?? 0);
      return acc;
    }, {} as Record<string, number>),
    salesByDay,
    salesByWeek,
    salesByMonth
  };

  return { history, aggregate };
}, [posTransactions]);

  React.useEffect(() => {
  if (liveSalesData.aggregate) {
    setLivePosSalesSummary({
      totalPaid:          liveSalesData.aggregate.todayPaid,
      grossSales:         liveSalesData.aggregate.todayPaid,
      netSales:           liveSalesData.aggregate.todayNet      || 0,
      vatTotal:           liveSalesData.aggregate.todayVat      || 0,
      serviceChargeTotal: liveSalesData.aggregate.todaySC       || 0,
      discountTotal:      liveSalesData.aggregate.todayDiscount || 0,
      orderCount:         liveSalesData.aggregate.numberOfPaidOrders,
      salesByPaymentMethod: liveSalesData.aggregate.salesByPaymentMethod
    });
  }
}, [liveSalesData]);

  const combinedTotalRevenue = useMemo(() => {
    // Return TODAY'S sales specifically for high-visibility dashboard cards to match POS Shift Total
    return liveSalesData.aggregate.todayPaid;
  }, [liveSalesData.aggregate.todayPaid]);

  // Live Food %/Beverage % split for the Gross Sales popover — same recipe-category bucketing
  // logic as the post-closure salesByCategory report (services/closureService.ts), applied to
  // today's Paid posOrders instead of a closed period, using the same 6am London business-day
  // cutoff as everywhere else.
  const todayCategorySalesSplit = useMemo(() => {
    const businessDay = getBusinessDay();
    const todaysOrders = posOrders.filter(o =>
      normalizeStatus(o.status) === 'Paid' && getBusinessDayFor(new Date(o.paidAt || o.createdAt)) === businessDay
    );
    return computeCategorySalesSplit(todaysOrders, recipes);
  }, [posOrders, recipes]);

  // Salaried staff's real cost is their fixed salary, not hours x rate — their shifts are
  // excluded here (and everywhere else an automated Wages/labour cost total is summed) so
  // Labour Import can keep showing their HOURS unfiltered while the $ total doesn't
  // double-count alongside their actual salary (see services/labourImportService.ts). Real
  // Payroll Centre data then wins over that estimate for any week it covers.
  const labourShiftsForCost = useMemo(
    () => mergeRealPayrollData(filterShiftsForCost(labourShifts, staffMembers), payrollCentreRecords),
    [labourShifts, staffMembers, payrollCentreRecords]
  );

  // Dashboard's Period-to-date Labour Cost card — reuses Labour Intelligence's own
  // weekly-bucket + Period rollup (services/labourImportService.ts) rather than
  // recomputing labour cost separately, so the two screens always agree.
  const labourCostPeriodToDate = useMemo(() => {
    const currentPeriod = getCurrentPeriod();
    const weeklyPenceMap = buildWeeklyLabourCostPenceMap(labourShiftsForCost);
    const weekStarts = getPeriodWeekStarts(currentPeriod.periodNumber, currentPeriod.fiscalYear);
    return { ...sumLabourCostForWeeks(weeklyPenceMap, weekStarts), periodNumber: currentPeriod.periodNumber };
  }, [labourShiftsForCost]);

  // Explicit aliases for reporting compliance
  const posPaymentsHistory = liveSalesData.history;
  const liveSalesSummary = liveSalesData.aggregate;
  const posRevenueBreakdown = liveSalesData.aggregate.salesByPaymentMethod;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);
  const [itemRecipeMappings, setItemRecipeMappings] = useState<Record<string, string>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // System Permissions Helper
  const userRole = useMemo(() => {
    const isAdminEmail = !!user?.email && (ADMIN_EMAILS as readonly string[]).includes(user.email);
    if (isAdminEmail) return 'Admin';

    const staffMember = staffMembers.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
    if (staffMember?.role) {
      const raw = staffMember.role.toLowerCase();
      if (raw === 'supervisor') return 'Manager';
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    // No matching staff profile — user must be linked by a manager before gaining access
    return 'Unlinked';
  }, [user, staffMembers]);

  const checkPermission = (module: string, action: string) => {
    // Admins always have all permissions
    if (userRole === 'Admin') return true;

    // Hard override for specific staff roles on Table Manager and Stock Orders
    if ((module === 'tables' || module === 'orders') && (userRole === 'Waiter' || userRole === 'Bartender')) {
      return false;
    }
    
    const rolePerms = permissionsConfig[userRole];
    if (!rolePerms) return false;
    
    const modulePerms = rolePerms[module as keyof AppPermissions] as any;
    return !!modulePerms?.[action];
  };

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [inventorySettings, setInventorySettings] = useState({
    allowNegativeStock: false,
    autoUpdateFromInvoices: true,
    lowStockAlertThreshold: 20
  });

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Helper for safe Firestore access
  const safeFirestoreSet = async (collectionPath: string, docId: string, data: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, collectionPath, docId), cleanObject({ ...data, locationId: LOCATION_ID }));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${collectionPath}/${docId}`);
    }
  };

  const handleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Successfully logged in!");
    } catch (e: any) {
      console.error("Login failed:", e);
      if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') {
        // User cancelled the login, no need for a scary error toast
        return;
      }
      
      if (e.code === 'auth/network-request-failed') {
        toast.error("Login failed: Network error. Please check your internet connection or disable ad-blockers.");
      } else if (e.code === 'auth/popup-blocked') {
        toast.error("Login failed: Popup blocked. Please allow popups for this site.");
      } else if (e.code === 'auth/unauthorized-domain') {
        toast.error("Login failed: Unauthorized domain. Please check your Firebase configuration.");
      } else {
        toast.error(`Login failed: ${e.message}`);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };


  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Reset state on logout
      setItems([]);
      setRecipes([]);
      setStockHistory([]);
      setSalesHistory([]);
      setSuppliers([]);
      setOrders([]);
      setInvoices([]);
      setCart([]);
      setWasteRecords([]);
      setExpenseRecords([]);
      setUser(null);
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Store locally only — avoids a Firestore write on every toggle
    try { localStorage.setItem('backbone_dark_mode', String(isDarkMode)); } catch {}
  }, [isDarkMode]);

  // Lifecycle for system initialization and migration
  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    // Initial system check/seed
    // initializeSystem disabled — was seeding fake test data on every load
// initializeSystem().catch(e => {
//   console.error("System initialization failed:", e);
// });
  }, [isAuthReady, user]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      if (u) {
        testConnection().catch(() => {});
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Migration logic
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const userId = user.uid;

    const migrateData = async () => {
      const savedItems = localStorage.getItem('inventory_items');
      const savedRecipes = localStorage.getItem('menu_recipes');
      
      if (savedItems || savedRecipes) {
        setIsMigrating(true);
        try {
          if (savedItems) {
            const items = JSON.parse(savedItems);
            for (const item of items) {
              await setDoc(doc(db, 'inventory', item.id), cleanObject({ ...item, locationId: LOCATION_ID }));
            }
          }
          if (savedRecipes) {
            const recipes = JSON.parse(savedRecipes);
            for (const recipe of recipes) {
              await setDoc(doc(db, 'recipes', recipe.id), cleanObject({ ...recipe, locationId: LOCATION_ID }));
            }
          }
          localStorage.removeItem('inventory_items');
          localStorage.removeItem('menu_recipes');
          localStorage.removeItem('stock_history');
          localStorage.removeItem('sales_import_history');
          localStorage.removeItem('total_revenue');
          localStorage.removeItem('suppliers');
          localStorage.removeItem('item_recipe_mappings');
        } catch (e) {
          console.error("Migration failed:", e);
        } finally {
          setIsMigrating(false);
        }
      }
    };

    migrateData();

    // Set up real-time listeners
    const unsubInventory = onSnapshot(query(collection(db, 'inventory'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    const unsubSettings = onSnapshot(doc(db, 'settings', `inventory_${LOCATION_ID}`), (docSnap) => {
      if (docSnap.exists()) {
        setInventorySettings(docSnap.data() as any);
      }
    });

    const unsubRecipes = onSnapshot(query(collection(db, 'recipes'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Recipe));
      setRecipes(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'recipes'));

    const unsubMenuCategories = onSnapshot(query(collection(db, 'menuCategories'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MenuCategory));
      setMenuCategories(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'menuCategories'));

    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'suppliers'));

    const unsubStockHistory = onSnapshot(query(collection(db, 'stockCounts'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as StockCountRecord));
      setStockHistory(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'stockCounts'));

    // Stock Orders were previously never read back from Firestore — only ever added to local
    // state when placed this session, so a Sent order became unreceivable after a reload.
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const unsubReceivingRecords = onSnapshot(query(collection(db, 'receivingRecords'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ReceivingRecord));
      setReceivingRecords(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'receivingRecords'));

    // Invoices, like Stock Orders before this, were never actually read back from Firestore —
    // only ever added to local state when processed this session. Needed now for real: the
    // three-way match depends on being able to review and approve a Pending invoice from an
    // earlier session, not just the one just uploaded.
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Invoice));
      setInvoices(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'invoices'));

    const unsubSupplierPriceHistory = onSnapshot(query(collection(db, 'supplierPriceHistory'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as SupplierPriceHistoryEntry));
      setSupplierPriceHistory(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'supplierPriceHistory'));

    const unsubSalesHistory = onSnapshot(query(collection(db, 'salesImports'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as SalesImportRecord));
      setSalesHistory(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'salesImports'));

    const unsubPosOrders = onSnapshot(query(collection(db, 'posOrders'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as POSOrder));
      setPosOrders(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'posOrders'));

    const unsubPosTransactions = onSnapshot(
  query(
    collection(db, 'posTransactions'),
    where('locationId', '==', LOCATION_ID)
  ),
  (snapshot: any) => {
    const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    setPosTransactions(data);
  },
  (err: any) => handleFirestoreError(err, OperationType.LIST, 'posTransactions')
);
    const unsubPosPayments = onSnapshot(query(collection(db, 'posPayments'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setPosPayments(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'posPayments'));

    const unsubPermissions = onSnapshot(doc(db, 'settings', `permissions_${LOCATION_ID}`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.roles) {
          // Deep merge with defaults to ensure all modules/actions exist
          const merged: Record<string, AppPermissions> = { ...DEFAULT_PERMISSIONS };
          Object.keys(data.roles).forEach(role => {
            if (merged[role]) {
              merged[role] = {
                ...merged[role],
                ...data.roles[role]
              };
              // Even deeper merge for modules
              Object.keys(data.roles[role]).forEach(module => {
                if (merged[role][module as keyof AppPermissions]) {
                  (merged[role] as any)[module] = {
                    ...(merged[role] as any)[module],
                    ...data.roles[role][module]
                  };
                }
              });
            } else {
              merged[role] = data.roles[role];
            }
          });
          setPermissionsConfig(merged);
        }
      } else {
        // Initialize if not exists
        safeFirestoreSet('settings', `permissions_${LOCATION_ID}`, {
          roles: DEFAULT_PERMISSIONS,
          updatedAt: new Date().toISOString()
        });
      }
    });

    const unsubTables = onSnapshot(query(collection(db, 'tables'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Table));
      setTables(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'tables'));

    const unsubWaste = onSnapshot(query(collection(db, 'waste'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as WasteRecord));
      setWasteRecords(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'waste'));

    // Date-scoped instead of a flat result-count limit() — a count cap silently truncates
    // wide date ranges (e.g. Quarterly) once a business accumulates more than that many
    // DAY+SHIFT closures. 400 days comfortably covers every period Financial Command's
    // selectors currently offer (Week/Period/Month/Quarter, all within the current year).
    const closuresCutoff = new Date();
    closuresCutoff.setDate(closuresCutoff.getDate() - 400);
    const closuresCutoffKey = closuresCutoff.toISOString().split('T')[0];
    const unsubClosures = onSnapshot(query(collection(db, 'dailyClosures'), where('locationId', '==', LOCATION_ID), where('date', '>=', closuresCutoffKey), orderBy('date', 'desc')), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as DailyClosure));
      setClosures(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'dailyClosures'));

    const unsubForecasts = onSnapshot(query(collection(db, 'predictions'), where('locationId', '==', LOCATION_ID), orderBy('createdAt', 'desc'), limit(10)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Forecast));
      setForecasts(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'predictions'));
    
    const unsubStaffPerf = onSnapshot(query(collection(db, 'staffPerformance'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc'), limit(50)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as StaffPerformanceRecord));
      setStaffPerformance(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'staffPerformance'));

    const unsubCertifications = onSnapshot(query(collection(db, 'staffCertifications'), where('locationId', '==', LOCATION_ID), orderBy('completedAt', 'desc')), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as StaffCertification));
      setStaffCertifications(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'staffCertifications'));

    const unsubQuizSubmissions = onSnapshot(query(collection(db, 'quizSubmissions'), where('locationId', '==', LOCATION_ID), orderBy('completedAt', 'desc'), limit(500)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setQuizSubmissions(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'quizSubmissions'));

    const unsubAuditLogs = onSnapshot(query(collection(db, 'auditLogs'), where('locationId', '==', LOCATION_ID), orderBy('timestamp', 'desc'), limit(100)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AuditLog));
      setAuditLogs(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));

    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ExpenseRecord));
      setExpenseRecords(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const unsubStats = onSnapshot(doc(db, 'settings', `stats_${LOCATION_ID}`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.totalRevenue !== undefined) setTotalRevenue(data.totalRevenue);
      }
    });

    const unsubMappings = onSnapshot(doc(db, 'settings', `mappings_${LOCATION_ID}`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.mappings) setItemRecipeMappings(data.mappings);
      }
    });

    const unsubUser = onSnapshot(doc(db, `users/${userId}`), (snapshot: any) => {
      const data = snapshot.data();
      if (data) {
        if (data.isDarkMode !== undefined) setIsDarkMode(data.isDarkMode);
        if (user.email && (ADMIN_EMAILS as readonly string[]).includes(user.email) && data.role !== 'Admin') {
          setDoc(doc(db, `users/${userId}`), { role: 'Admin' }, { merge: true }).catch(console.error);
        }
      } else {
        setDoc(doc(db, `users/${userId}`), cleanObject({
          uid: userId,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          isDarkMode: false,
          role: (user.email && (ADMIN_EMAILS as readonly string[]).includes(user.email)) ? 'Admin' : 'Waiter'
        })).catch((err: any) => handleFirestoreError(err, OperationType.WRITE, `users/${userId}`));
      }
    }, (err: any) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));

    // Was pointed at an orphaned 'staff' collection — nothing in the app writes to it (staff
    // are added/edited in Settings.tsx against 'staffProfiles', which is also what
    // firestore.rules' isManager() check reads). That mismatch meant newly added/edited staff
    // never appeared in Training, Labour Intelligence, or Financial Command Center, and the
    // bootstrap-admin auto-promotion below was silently promoting a document that never existed.
    const unsubStaff = onSnapshot(query(collection(db, 'staffProfiles'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaffMembers(data);

      snapshot.docs.forEach((d: any) => {
        const staffData = d.data();
        if (staffData.email && (ADMIN_EMAILS as readonly string[]).includes(staffData.email.toLowerCase())) {
          if (staffData.role !== 'Admin') {
            updateDoc(doc(db, 'staffProfiles', d.id), { role: 'Admin' }).catch(console.error);
          }
        }
      });
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'staffProfiles'));

    // Feeds the Dashboard's Period-to-date Labour Cost card — same collection and
    // locationId/date-desc query Labour Intelligence already reads from.
    const unsubLabourShifts = onSnapshot(query(collection(db, 'labourShifts'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc')), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as LabourShift));
      setLabourShifts(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'labourShifts'));

    // Real Payroll Centre weekly data — wins over the Rota-based estimate for any week it
    // covers, see filterShiftsForCost/mergeRealPayrollData in labourShiftsForCost below.
    const unsubPayrollCentre = onSnapshot(query(collection(db, 'payrollCentreWeeks'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as PayrollCentreWeekRecord));
      setPayrollCentreRecords(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'payrollCentreWeeks'));

    return () => {
      unsubPosTransactions();
      unsubInventory();
      unsubSettings();
      unsubRecipes();
      unsubSuppliers();
      unsubStockHistory();
      unsubOrders();
      unsubReceivingRecords();
      unsubInvoices();
      unsubSupplierPriceHistory();
      unsubSalesHistory();
      unsubPosOrders();
      unsubPosPayments();
      unsubTables();
      unsubWaste();
      unsubExpenses();
      unsubStats();
      unsubMappings();
      unsubMenuCategories();
      unsubUser();
      unsubStaff();
      unsubLabourShifts();
      unsubPayrollCentre();
      unsubForecasts();
      unsubStaffPerf();
      unsubCertifications();
      unsubQuizSubmissions();
      unsubAuditLogs();
      unsubPermissions();
      unsubClosures();
    };
  }, [isAuthReady, user]);

  // Automatic Inventory Depletion for Paid POS Orders
  useEffect(() => {
    if (!user || posOrders.length === 0 || recipes.length === 0 || items.length === 0) return;

    const processInventoryDepletion = async () => {
      const unprocessedOrders = posOrders.filter(o => 
        normalizeStatus(o.status) === 'Paid' && !o.isInventoryDepleted
      );

      if (unprocessedOrders.length === 0) return;

      const batchToProcess = unprocessedOrders.slice(0, 10);

      const sideAddonsSnap = await getDocs(query(collection(db, 'sidesAndAddons'), where('locationId', '==', LOCATION_ID)));
      const sideAddonDocs = sideAddonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SideAddonItem));

      for (const order of batchToProcess) {
        try {
          const batch = writeBatch(db);

          // 1. Process Inventory
          for (const item of order.items) {
            if (item.isVoided) continue;

            const recipe = recipes.find(r => r.id === item.recipeId || r.name === item.name);
            if (!recipe) {
              const sideAddon = sideAddonDocs.find(sa => sa.posMenuItemId === item.recipeId);
              if (!sideAddon) {
                console.warn(`[Inventory Sync] No recipe or side/addon found for item: ${item.name} (${item.recipeId})`);
                continue;
              }

              const totalDeduction = sideAddon.weight * (item.quantity || 0);
              if (totalDeduction > 0) {
                if (sideAddon.sourceType === 'raw_ingredient') {
                  const inventoryItem = items.find(i => i.id === sideAddon.sourceId);
                  if (inventoryItem) {
                    const invRef = doc(db, 'inventory', inventoryItem.id);
                    batch.update(invRef, {
                      quantity: increment(-totalDeduction),
                      lastUpdated: new Date().toISOString()
                    });

                    const movementId = `mov-pos-${order.id}-${inventoryItem.id}`;
                    const movementRef = doc(db, 'stockMovements', movementId);
                    batch.set(movementRef, cleanObject({
                      id: movementId,
                      productId: inventoryItem.id,
                      type: 'SALE',
                      quantityChange: -totalDeduction,
                      stockBefore: inventoryItem.quantity,
                      stockAfter: inventoryItem.quantity - totalDeduction,
                      referenceId: order.id,
                      referenceType: 'SALE',
                      createdAt: new Date().toISOString(),
                      createdBy: 'SYSTEM-POS-SYNC',
                      locationId: LOCATION_ID,
                      notes: `POS Sale (Side/Add-on): ${order.tableNumber ? 'Table ' + order.tableNumber : 'Order #' + order.id.slice(-4)}`
                    }));
                  } else {
                    console.warn(`[Inventory Sync] No inventory item found for side/addon source: ${sideAddon.sourceId}`);
                  }
                } else {
                  const sourceRecipe = recipes.find(r => r.id === sideAddon.sourceId);
                  if (sourceRecipe) {
                    const recipeRef = doc(db, 'recipes', sideAddon.sourceId);
                    batch.update(recipeRef, {
                      quantity: increment(-totalDeduction)
                    });

                    const movementId = `mov-pos-${order.id}-recipe-${sideAddon.sourceId}`;
                    const movementRef = doc(db, 'stockMovements', movementId);
                    batch.set(movementRef, cleanObject({
                      id: movementId,
                      productId: `recipe-${sideAddon.sourceId}`,
                      type: 'SALE',
                      quantityChange: -totalDeduction,
                      stockBefore: sourceRecipe.quantity || 0,
                      stockAfter: (sourceRecipe.quantity || 0) - totalDeduction,
                      referenceId: order.id,
                      referenceType: 'SALE',
                      createdAt: new Date().toISOString(),
                      createdBy: 'SYSTEM-POS-SYNC',
                      locationId: LOCATION_ID,
                      notes: `POS Sale (Side/Add-on): ${order.tableNumber ? 'Table ' + order.tableNumber : 'Order #' + order.id.slice(-4)}`
                    }));
                  } else {
                    console.warn(`[Inventory Sync] No batch recipe found for side/addon source: ${sideAddon.sourceId}`);
                  }
                }
              }
              continue;
            }

            for (const ingredient of recipe.ingredients) {
              const inventoryItem = items.find(i => i.id === ingredient.inventoryItemId);
              if (!inventoryItem) {
                console.warn(`[Inventory Sync] No inventory item found for ingredient: ${ingredient.inventoryItemId}`);
                continue;
              }

              const totalDeduction = (ingredient.baseQuantity || 0) * (item.quantity || 0);
              if (totalDeduction > 0) {
                const invRef = doc(db, 'inventory', inventoryItem.id);
                batch.update(invRef, {
                  quantity: increment(-totalDeduction),
                  lastUpdated: new Date().toISOString()
                });
                
                // Log Stock Movement
                const movementId = `mov-pos-${order.id}-${inventoryItem.id}`;
                const movementRef = doc(db, 'stockMovements', movementId);
                batch.set(movementRef, cleanObject({
                  id: movementId,
                  productId: inventoryItem.id,
                  type: 'SALE',
                  quantityChange: -totalDeduction,
                  stockBefore: inventoryItem.quantity,
                  stockAfter: inventoryItem.quantity - totalDeduction,
                  referenceId: order.id,
                  referenceType: 'SALE',
                  createdAt: new Date().toISOString(),
                  createdBy: 'SYSTEM-POS-SYNC',
                  locationId: LOCATION_ID,
                  notes: `POS Sale: ${order.tableNumber ? 'Table ' + order.tableNumber : 'Order #' + order.id.slice(-4)}`
                }));

              }
            }

            // 2. Process Shift Targets (Item-specific)
            if (recipe.id) {
              const itemTargets = await getDocs(query(
                collection(db, 'shiftTargets'), 
                where('locationId', '==', LOCATION_ID),
                where('type', '==', 'Item'),
                where('targetItemId', '==', recipe.id),
                where('status', '==', 'Active')
              ));

              itemTargets.forEach(tDoc => {
                batch.update(tDoc.ref, {
                  currentValue: increment(item.quantity || 1)
                });
              });
            }
          }

          // 3. Process Shift Targets (Revenue)
          const revenueTargets = await getDocs(query(
            collection(db, 'shiftTargets'), 
            where('locationId', '==', LOCATION_ID),
            where('type', '==', 'Revenue'),
            where('status', '==', 'Active')
          ));

          revenueTargets.forEach(tDoc => {
            batch.update(tDoc.ref, {
              currentValue: increment(order.total || 0)
            });
          });

          // Mark order as depleted
          const orderRef = doc(db, 'posOrders', order.id);
          batch.update(orderRef, { isInventoryDepleted: true });

          await batch.commit();
        } catch (error) {
          console.error(`[Inventory Sync] Error processing order ${order.id}:`, error);
        }
      }
    };

    processInventoryDepletion();
  }, [posOrders, recipes, items, user]);

  // Role-based redirection
  useEffect(() => {
    if (isAuthReady && user && currentView === 'dashboard') {
      if (userRole === 'Waiter' || userRole === 'Bartender') {
        setCurrentView('briefing');
      }
    }
  }, [isAuthReady, user, userRole, currentView]);

  // Remove the old localStorage initialization effects
  /*
  useEffect(() => {
    const savedItems = localStorage.getItem('inventory_items');
    ...
  }, []);
  */

  const handleAddSupplier = (supplier: Supplier) => {
    setSuppliers(prev => [...prev, supplier]);
    safeFirestoreSet('suppliers', supplier.id, supplier);
  };

  const logStockMovement = async (movement: Omit<StockMovement, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!user) return;
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      ...movement
    };
    safeFirestoreSet('stockMovements', newMovement.id, newMovement);
  };

  const handleUpdateStock = (updates: {id: string, quantity?: number, delta?: number, pricePerUnit?: number}[], type: MovementType = 'ADJUSTMENT', referenceId?: string) => {
    if (!user) return;
    const userId = user.uid;
    const userName = user.displayName || user.email || 'Unknown';
    const timestamp = new Date().toISOString().split('T')[0];
    
    updates.forEach(update => {
      const isRecipe = update.id.startsWith('recipe-');
      const id = isRecipe ? update.id.replace('recipe-', '') : update.id;
      const collectionName = isRecipe ? 'recipes' : 'inventory';
      
      const item = isRecipe ? recipes.find(r => r.id === id) : items.find(i => i.id === id);
      if (item) {
        const currentQty = toSafeNumber((item as any).quantity);
        let delta = 0;
        let finalNewQuantity = 0;

        if (update.delta !== undefined) {
          delta = update.delta;
          finalNewQuantity = currentQty + delta;
        } else if (update.quantity !== undefined) {
          finalNewQuantity = update.quantity;
          delta = finalNewQuantity - currentQty;
        } else {
          return; // Nothing to update
        }
        
        // Enforce negative stock rules
        if (!inventorySettings.allowNegativeStock && finalNewQuantity < 0) {
          // If we are adjusting/stockstaking to a negative value, cap at 0
          if (type === 'ADJUSTMENT' || type === 'STOCKTAKE') {
            finalNewQuantity = 0;
            delta = 0 - currentQty;
          } else {
            // For sales/receipts, we cap the deduction so it doesn't go below 0
            // but this is tricky with concurrent increments.
            // For now, keep the optimistic capping.
            finalNewQuantity = 0;
            delta = 0 - currentQty;
          }
        }
        
        if (delta !== 0 || update.pricePerUnit !== undefined) {
          logStockMovement({
            productId: update.id,
            type,
            quantityChange: delta,
            stockBefore: currentQty,
            stockAfter: finalNewQuantity,
            referenceId,
            referenceType: type as any
          });

          // Audit Log - Only for manual adjustments or significant events
          if (type === 'ADJUSTMENT' || type === 'STOCKTAKE') {
            logAuditAction(
              userId,
              userName,
              'UPDATE',
              isRecipe ? 'Recipe' : 'Inventory',
              id,
              (item as any).name,
              item,
              { ...item, quantity: finalNewQuantity }
            );
          }
          
          const docRef = doc(db, collectionName, id);
          const firestoreUpdates: any = {
            quantity: increment(delta),
            lastUpdated: timestamp
          };
          
          if (update.pricePerUnit !== undefined) {
            firestoreUpdates.pricePerUnit = update.pricePerUnit;
            // Sync recipe costs if price changed
            import('./services/inventoryService').then(({ syncRecipePrices }) => {
              syncRecipePrices(update.id, update.pricePerUnit!, recipes, items);
            });
          }
          
          setDoc(docRef, cleanObject(firestoreUpdates), { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`));
        }
      }
    });

    // Optimistic local state updates
    setItems(prev => prev.map(item => {
      const update = updates.find(u => u.id === item.id);
      if (update) {
        let newQty = toSafeNumber(item.quantity);
        if (update.delta !== undefined) {
          newQty = toSafeNumber(item.quantity) + update.delta;
        } else if (update.quantity !== undefined) {
          newQty = update.quantity;
        }

        if (!inventorySettings.allowNegativeStock && newQty < 0) {
          newQty = 0;
        }

        return { 
          ...item, 
          quantity: newQty, 
          pricePerUnit: update.pricePerUnit !== undefined ? update.pricePerUnit : item.pricePerUnit,
          lastUpdated: timestamp 
        };
      }
      return item;
    }));

    setRecipes(prev => prev.map(recipe => {
      const update = updates.find(u => u.id === `recipe-${recipe.id}`);
      if (update) {
        let newQty = recipe.quantity || 0;
        if (update.delta !== undefined) {
          newQty = (recipe.quantity || 0) + update.delta;
        } else if (update.quantity !== undefined) {
          newQty = update.quantity;
        }

        if (!inventorySettings.allowNegativeStock && newQty < 0) {
          newQty = 0;
        }
        
        return { 
          ...recipe, 
          quantity: newQty, 
          pricePerUnit: update.pricePerUnit !== undefined ? update.pricePerUnit : (recipe as any).pricePerUnit,
          lastUpdated: timestamp 
        };
      }
      return recipe;
    }));
  };

  // --- Shift Briefing & Performance Linkage ---
  useEffect(() => {
    if (!posPayments.length || !user) return;

    const processNewPayments = async () => {
      // Since POSPayment doesn't have a status field directly, we check for its existence in the paid payments collection
      // or assume it's paid if it's there. We'll use order status to be safe.
      const unprocessed = posPayments.filter(p => !p.performanceProcessed);
      if (unprocessed.length === 0) return;

      const { updateStaffPerformance } = await import('./services/performanceService');
      
      for (const payment of unprocessed) {
        const order = posOrders.find(o => o.id === payment.orderId);
        // Only process paid orders
        if (order && normalizeStatus(order.status) === 'Paid') {
          try {
            // Trigger performance update
            await updateStaffPerformance(
              order.waiterId, 
              order.customerName || 'Staff',
              order.items, 
              recipes
            );

            // 1. Automated Stock Deduction
            const { deductStockFromOrder } = await import('./services/inventoryService');
            await deductStockFromOrder(
              payment.orderId,
              order.items,
              recipes,
              items
            );

            // Mark as processed in Firestore
            await updateDoc(doc(db, 'posPayments', payment.id), {
              performanceProcessed: true
            });
          } catch (err) {
            console.error("Failed to link payment to performance:", err);
          }
        }
      }
    };

    processNewPayments();
  }, [posPayments, posOrders, recipes, user]);

  const handleSalesDeduction = (deductions: { inventoryItemId: string; quantity: number }[], revenue: number, orderId?: string) => {
    if (!user) return;
    const userId = user.uid;

    setTotalRevenue(prev => {
      const newRevenue = prev + revenue;
      setDoc(doc(db, 'settings', `stats_${LOCATION_ID}`), { totalRevenue: increment(revenue) }, { merge: true }).catch(() => {
        setDoc(doc(db, 'settings', `stats_${LOCATION_ID}`), { totalRevenue: revenue, locationId: LOCATION_ID }, { merge: true }).catch(console.error);
      });
      return newRevenue;
    });

    // Handle standard inventory items
    setItems(prev => {
      const updated = prev.map(item => {
        const itemDeductions = deductions.filter(d => d.inventoryItemId === item.id);
        if (itemDeductions.length > 0) {
          const totalDeductionQuantity = itemDeductions.reduce((sum, d) => sum + d.quantity, 0);
          
          const newQuantity = inventorySettings.allowNegativeStock 
            ? item.quantity - totalDeductionQuantity 
            : Math.max(0, item.quantity - totalDeductionQuantity);
            
          const currentRate = item.dailyUsageRate || 0;
          const newRate = (currentRate * 0.7) + (totalDeductionQuantity * 0.3);

          logStockMovement({
            productId: item.id,
            type: 'SALE',
            quantityChange: -totalDeductionQuantity,
            stockBefore: item.quantity,
            stockAfter: newQuantity,
            referenceId: orderId,
            referenceType: 'SALE'
          });

          const docRef = doc(db, 'inventory', item.id);
          setDoc(docRef, {
            quantity: increment(-totalDeductionQuantity),
            dailyUsageRate: parseFloat(newRate.toFixed(2)),
            lastUpdated: new Date().toISOString().split('T')[0]
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `inventory/${item.id}`));

          return { 
            ...item, 
            quantity: newQuantity,
            dailyUsageRate: parseFloat(newRate.toFixed(2)),
            lastUpdated: new Date().toISOString().split('T')[0] 
          };
        }
        return item;
      });
      return updated;
    });

    // Handle recipe-based items (Batches/Preps)
    setRecipes(prev => {
      const updated = prev.map(recipe => {
        const recipeInventoryId = `recipe-${recipe.id}`;
        const recipeDeductions = deductions.filter(d => d.inventoryItemId === recipeInventoryId);
        if (recipeDeductions.length > 0) {
          const totalDeductionQuantity = recipeDeductions.reduce((sum, d) => sum + d.quantity, 0);
          
          const newQuantity = inventorySettings.allowNegativeStock
            ? (recipe.quantity || 0) - totalDeductionQuantity
            : Math.max(0, (recipe.quantity || 0) - totalDeductionQuantity);

          logStockMovement({
            productId: recipeInventoryId,
            type: 'SALE',
            quantityChange: -totalDeductionQuantity,
            stockBefore: recipe.quantity || 0,
            stockAfter: newQuantity,
            referenceId: orderId,
            referenceType: 'SALE'
          });

          const docRef = doc(db, 'recipes', recipe.id);
          setDoc(docRef, {
            quantity: increment(-totalDeductionQuantity),
            lastUpdated: new Date().toISOString().split('T')[0]
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `recipes/${recipe.id}`));

          return { 
            ...recipe, 
            quantity: newQuantity,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
        }
        return recipe;
      });
      return updated;
    });

    toast.success("Stock updated and sales velocity analyzed for future predictions.");
    setCurrentView('dashboard');
  };

  const handleSaveSalesRecord = (record: SalesImportRecord) => {
    setSalesHistory(prev => [record, ...prev]);
    safeFirestoreSet('salesImports', record.id, record);
  };

  const handleSaveStockRecord = (record: StockCountRecord) => {
    setStockHistory(prev => [record, ...prev]);
    safeFirestoreSet('stockCounts', record.id, record);
  };

  // Auto-calculates a due date from the linked supplier's payment terms.
  // Only fills it in if not already set (e.g. by a manual override upstream)
  const calculateInvoiceDueDate = (invoice: Invoice): string | undefined => {
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    if (!supplier?.paymentTerms) return undefined;
    const { days, countFrom } = supplier.paymentTerms;
    let referenceDateStr = invoice.date;
    if (countFrom === 'goodsReceivedDate' && invoice.orderId) {
      const receiving = receivingRecords.find(r => r.orderId === invoice.orderId);
      if (receiving) referenceDateStr = receiving.date;
    }
    const due = new Date(referenceDateStr);
    due.setDate(due.getDate() + days);
    return due.toISOString().split('T')[0];
  };

  const handleAddFromInvoice = (invoice: Invoice) => {
    const invoiceWithDueDate = invoice.dueDate || invoice.dueDateManuallySet
      ? invoice
      : { ...invoice, dueDate: calculateInvoiceDueDate(invoice) };
    setInvoices(prev => [invoiceWithDueDate, ...prev]);
    safeFirestoreSet('invoices', invoiceWithDueDate.id, invoiceWithDueDate);
    
    if (invoice.status === 'Processed') {
      toast.success(`Processed invoice from ${invoice.vendor}.`);
    } else {
      toast.success(`Invoice from ${invoice.vendor} saved as Pending.`);
    }
    setCurrentView('invoices');
  };

  // Was previously an inline lambda duplicated at both InvoiceProcessor and SupplierManager
  // call sites that only ever updated local state — payment-status toggles, rejects, deletes,
  // and (now) order-linking never actually reached Firestore, so they were lost on reload.
  const handleUpdateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
    setDoc(doc(db, 'invoices', id), cleanObject({ ...updates, locationId: LOCATION_ID }), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, `invoices/${id}`));
  };

  const handleSaveItem = async (itemData: any) => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (editingItem) {
      if (editingItem.id.startsWith('recipe-')) {
        const recipeId = editingItem.id.replace('recipe-', '');
        // ... (recipe logic)
      } else {
        // Update existing item
        const quantityChange = itemData.quantity - editingItem.quantity;
        if (quantityChange !== 0) {
          logStockMovement({
            productId: editingItem.id,
            type: quantityChange > 0 ? 'RECEIPT' : 'ADJUSTMENT',
            quantityChange,
            stockBefore: editingItem.quantity,
            stockAfter: itemData.quantity,
            referenceType: quantityChange > 0 ? 'RECEIPT' : 'ADJUSTMENT'
          });
        }

        const updatedItem = { ...editingItem, ...itemData, lastUpdated: timestamp };
        
        // Audit Log
        if (user) {
          logAuditAction(
            user.uid,
            user.displayName || user.email || 'Unknown',
            'UPDATE',
            'Inventory',
            editingItem.id,
            editingItem.name,
            editingItem,
            updatedItem
          );
        }

        setItems(prev => prev.map(item => 
          item.id === editingItem.id ? updatedItem : item
        ));
        safeFirestoreSet('inventory', editingItem.id, updatedItem);
      }
    } else {
      // Add new item
      const newItem: InventoryItem = {
        id: Date.now().toString(),
        lastUpdated: timestamp,
        ...itemData
      };

      // Audit Log
      if (user) {
        logAuditAction(
          user.uid,
          user.displayName || user.email || 'Unknown',
          'CREATE',
          'Inventory',
          newItem.id,
          newItem.name,
          null,
          newItem
        );
      }

      logStockMovement({
        productId: newItem.id,
        type: 'RECEIPT',
        quantityChange: newItem.quantity,
        stockBefore: 0,
        stockAfter: newItem.quantity,
        referenceType: 'RECEIPT'
      });

      setItems(prev => [...prev, newItem]);
      safeFirestoreSet('inventory', newItem.id, newItem);
    }
    
    setIsAddItemModalOpen(false);
    setEditingItem(undefined);
  };

  const handleBulkAdd = (newItems: Omit<InventoryItem, 'id' | 'lastUpdated'>[]) => {
    if (!user) return;
    const timestamp = new Date().toISOString().split('T')[0];

    const itemsWithIds = newItems.map((item, index) => ({
      ...item,
      id: `bulk-${Date.now()}-${index}`,
      lastUpdated: timestamp
    }));

    setItems(prev => [...prev, ...itemsWithIds]);

    // Save to Firestore
    itemsWithIds.forEach(item => {
      safeFirestoreSet('inventory', item.id, item);
      
      logStockMovement({
        productId: item.id,
        type: 'RECEIPT',
        quantityChange: item.quantity,
        stockBefore: 0,
        stockAfter: item.quantity,
        referenceType: 'RECEIPT',
        notes: 'Bulk imported'
      });
    });
  };

  const handleEditRecipeFromReport = (id: string) => {
    setEditRecipeId(id);
    setCurrentView('recipes');
  };

  const mapStation = (recipe: Recipe | null | undefined) => {
    if (!recipe) return 'grill';
    const category = (recipe.category || '').toLowerCase();
    const station = (recipe.station || '').toLowerCase();

    if (category.includes('beverage') || category.includes('bar')) return 'beverage';
    if (station.includes('cold')) return 'cold';
    if (station.includes('dessert')) return 'dessert';
    return 'food';
  };

    const handleSaveRecipe = async (recipe: Recipe) => {
    // 0) Circular Dependency Check
    const checkCircular = (startId: string, targetId: string, visited: Set<string>): boolean => {
      if (startId === targetId) return true;
      if (visited.has(startId)) return false;
      visited.add(startId);
      
      const r = recipes.find(rec => rec.id === startId);
      if (!r || !r.ingredients) return false;
      
      return r.ingredients.some(ing => {
        if (ing.inventoryItemId === `recipe-${targetId}`) return true;
        if (ing.inventoryItemId.startsWith('recipe-')) {
          return checkCircular(ing.inventoryItemId.replace('recipe-', ''), targetId, new Set(visited));
        }
        return false;
      });
    };

    if (recipe.id) {
       const isCircular = recipe.ingredients?.some(ing => {
         if (ing.inventoryItemId === `recipe-${recipe.id}`) return true;
         if (ing.inventoryItemId.startsWith('recipe-')) {
           const depId = ing.inventoryItemId.replace('recipe-', '');
           return checkCircular(depId, recipe.id, new Set());
         }
         return false;
       });

       if (isCircular) {
         toast.error("Circular Dependency Detected! This recipe cannot depend on a batch that already depends on it.");
         return;
       }
    }

  const saveStartTime = Date.now();
  try {
    const timestamp = new Date().toISOString();
    
    // Find old recipe for audit
    const oldRecipe = recipes.find(r => r.id === recipe.id);

    // 1) Ensure we have a valid Firestore ID
    // If it's a new recipe, generate a new ID via Firestore collection ref
    const recipeRef = recipe.id ? doc(db, 'recipes', recipe.id) : doc(collection(db, 'recipes'));
    const id = recipeRef.id;

    // Use name-based slug
    const slug = recipe.name.toLowerCase().replace(/\s+/g, "_");

    const normalizedRecipe: any = {
      ...recipe,
      slug,
      lastUpdated: timestamp
    };
    // Remove internal id field as we use doc.id now
    delete normalizedRecipe.id;

    toast.info('Synchronizing with Firestore Hub & POS...');

    // 2) Prepare full recipe doc
    const recipeDoc = cleanObject({
      ...normalizedRecipe,
      locationId: LOCATION_ID,
      lastUpdated: timestamp
    });

    // Audit Log
    if (user) {
      logAuditAction(
        user.uid,
        user.displayName || user.email || 'Unknown',
        recipe.id ? 'UPDATE' : 'CREATE',
        'Recipe',
        id,
        recipe.name,
        oldRecipe,
        recipeDoc
      );
    }

    // 3) Prepare POS-ready menu item doc
    const categoryId = mapCategoryId(recipe);
    const menuItemDoc = cleanObject({
      name: recipe.name,
      slug,
      categoryId: recipe.posCategoryId || categoryId,
      // POS systems expect price in cents (integers)
      priceGross: Math.round((Number(recipe.sellingPrice) || 0) * 100),
      vatRate: Number(recipe.vatRate) || 20,
      active: true,
      locationId: LOCATION_ID,
      station: mapStation(recipe),
      isDrink: ['cat_drinks','cat_margaritas','cat_cocktails','cat_mocktails','cat_beers','cat_wines','cat_wine_white','cat_wine_red','cat_wine_rose','cat_wine_sparkling','cat_spirits','cat_tequila','cat_mezcal','cat_rum','cat_vodka','cat_whiskey','cat_gin','cat_brandy','cat_cognac','cat_liqueur','cat_soft_drinks','cat_juices','cat_jarritos','cat_aguas_frescas','cat_water','cat_sodas','cat_mixers','cat_hot_drinks'].includes(categoryId),
      recipeId: id,
      description: recipe.description || '',
      imageUrl: recipe.imageUrl || '',
      lastUpdated: timestamp
    });

    // We use the same ID for menuItems to maintain stable link, 
    // unless the item was created through a different flow.
    // This is consistent with "doc.id as ONLY identifier"
    const menuItemDocRef = doc(db, 'menuItems', id);

    // 4) Atomic Batch Write
    const batch = writeBatch(db);
    batch.set(recipeRef, recipeDoc);
    batch.set(menuItemDocRef, menuItemDoc);
    
    await batch.commit();
    
    // 5) Update local state (with id injected for the UI)
    const savedRecipe = { ...recipeDoc, id } as Recipe;
    setRecipes(prev => {
      const exists = prev.find(r => r.id === id);
      if (exists) {
        return prev.map(r => r.id === id ? savedRecipe : r);
      }
      return [...prev, savedRecipe];
    });

    toast.success('Successfully saved to Backbone + POS');
  } catch (err: any) {
    const duration = Date.now() - saveStartTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = (err as any).code || 'unknown-code';
    
    console.error(`%c[DualSave] FATAL ERROR after ${duration}ms:`, 'color: red; font-weight: bold;', err);
    toast.error(`Firestore Sync Error: ${errorCode}`, { description: errorMessage });
    
    try {
      handleFirestoreError(err, OperationType.WRITE, `batch/recipes+menuItems/${recipe.id}`);
    } catch (e) {
      // already reported
    }
    throw err;
  }
};

  // ── SYNC ALL RECIPES TO POS ──────────────────────────────────────────────
  const handleSyncAllToPos = async (): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;
    const timestamp = new Date().toISOString();
    const BATCH_SIZE = 20; // Firestore batch limit is 500 but keep it small for stability

    const allRecipes = [...recipes];
    
    for (let i = 0; i < allRecipes.length; i += BATCH_SIZE) {
      const chunk = allRecipes.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const recipe of chunk) {
        try {
          const id = recipe.id;
          if (!id) continue;

          const menuItemRef = doc(db, 'menuItems', id);
          const isBatchRecipe = recipe.type === 'recipe' || recipe.category === 'Batch' || recipe.category === 'Prep';

          if (isBatchRecipe) {
            // Batch/prep recipes are internal-only — never expose them as an orderable
            // POS item. Delete any stale doc from a previous sync; sides/addons below
            // still get synced so the batch's sellable sides/addons keep working.
            batch.delete(menuItemRef);
          } else {
            const categoryId = recipe.posCategoryId || mapCategoryId(recipe);
            const slug = recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

            const menuItemDoc = {
              name: recipe.name,
              slug,
              categoryId,
              priceGross: Math.round((Number(recipe.sellingPrice) || 0) * 100),
              vatRate: Number(recipe.vatRate) || 20,
              active: recipe.isActive !== false,
              locationId: LOCATION_ID,
              station: mapStation(recipe),
              isDrink: ['cat_drinks','cat_margaritas','cat_cocktails','cat_mocktails','cat_beers','cat_wines','cat_wine_white','cat_wine_red','cat_wine_rose','cat_wine_sparkling','cat_spirits','cat_tequila','cat_mezcal','cat_rum','cat_vodka','cat_whiskey','cat_gin','cat_brandy','cat_cognac','cat_liqueur','cat_soft_drinks','cat_juices','cat_jarritos','cat_aguas_frescas','cat_water','cat_sodas','cat_mixers','cat_hot_drinks'].includes(categoryId),
              recipeId: id,
              description: recipe.description || '',
              allergies: recipe.allergies || [],
              calories: recipe.calories || 0,
              course: recipe.course || '',
              imageUrl: recipe.imageUrl || '',
              lastUpdated: timestamp,
              locationId2: LOCATION_ID,
            };

            batch.set(menuItemRef, menuItemDoc);
          }
          success++;

          // Sync sides as separate POS menu items, assigning IDs where missing
          let sidesChanged = false;
          const updatedSides = (recipe.sides && recipe.sides.length > 0)
            ? recipe.sides.map(side => {
                const sideId = side.posMenuItemId || doc(collection(db, 'menuItems')).id;
                if (!side.posMenuItemId) sidesChanged = true;
                batch.set(doc(db, 'menuItems', sideId), {
                  name: side.name,
                  priceGross: side.price,
                  vatRate: recipe.vatRate ?? 20,
                  categoryId: 'cat_sides',
                  isSide: true,
                  isAddon: false,
                  parentRecipeId: id,
                  cost: side.cost,
                  locationId: LOCATION_ID,
                  isDrink: false,
                  station: 'kitchen'
                });
                return { ...side, posMenuItemId: sideId };
              })
            : undefined;

          // Sync addons as separate POS menu items, assigning IDs where missing
          let addonsChanged = false;
          const updatedAddons = (recipe.addons && recipe.addons.length > 0)
            ? recipe.addons.map(addon => {
                const addonId = addon.posMenuItemId || doc(collection(db, 'menuItems')).id;
                if (!addon.posMenuItemId) addonsChanged = true;
                batch.set(doc(db, 'menuItems', addonId), {
                  name: addon.name.replace(/\s*batch\s*/gi, '').trim(),
                  priceGross: addon.price,
                  vatRate: recipe.vatRate ?? 20,
                  categoryId: 'cat_addons',
                  isSide: false,
                  isAddon: true,
                  parentRecipeId: id,
                  cost: addon.cost,
                  locationId: LOCATION_ID,
                  isDrink: false,
                  station: 'kitchen'
                });
                return { ...addon, posMenuItemId: addonId };
              })
            : undefined;

          // Persist newly generated posMenuItemIds back onto the recipe doc
          if (sidesChanged || addonsChanged) {
            batch.update(doc(db, 'recipes', id), cleanObject({
              sides: updatedSides ?? recipe.sides,
              addons: updatedAddons ?? recipe.addons
            }));
          }
        } catch (e) {
          console.error('[SyncAll] Failed for recipe:', recipe.name, e);
          failed++;
        }
      }

      await batch.commit();
    }

    // Sync native sidesAndAddons collection to POS
    const sideAddonsSnap = await getDocs(query(collection(db, 'sidesAndAddons'), where('locationId', '==', LOCATION_ID)));
    const sideAddonDocs = sideAddonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SideAddonItem)).filter(item => item.isActive !== false);

    for (let i = 0; i < sideAddonDocs.length; i += BATCH_SIZE) {
      const chunk = sideAddonDocs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        try {
          const posMenuItemId = item.posMenuItemId || doc(collection(db, 'menuItems')).id;
          batch.set(doc(db, 'menuItems', posMenuItemId), {
            name: item.name,
            priceGross: item.price,
            vatRate: item.vatRate,
            categoryId: item.categoryId,
            isSide: item.type === 'side',
            isAddon: item.type === 'addon',
            sourceId: item.sourceId,
            sourceType: item.sourceType,
            cost: item.cost,
            locationId: item.locationId,
            isDrink: false,
            station: 'kitchen',
            isActive: item.isActive
          });
          success++;

          if (!item.posMenuItemId) {
            batch.update(doc(db, 'sidesAndAddons', item.id), { posMenuItemId });
          }
        } catch (e) {
          console.error('[SyncAll] Failed for side/addon:', item.name, e);
          failed++;
        }
      }

      await batch.commit();
    }

    return { success, failed };
  };

  // Invoice Processing is now purely financial reconciliation — three-way matching (quantity
  // vs the linked ReceivingRecord, price vs supplierPriceHistory for this exact item+supplier)
  // happens in InvoiceApprovalModal BEFORE this is ever called, gated behind explicit
  // acknowledgment of any flagged line. By the time this runs, that review is done; it only
  // updates price (never quantity — that's owned exclusively by Receive Goods/Phase 1) and
  // logs this invoice's prices into the supplier price history for next time.
  const handleApproveInvoice = (invoice: Invoice) => {
    if (invoice.status === 'Processed') return; // Already processed

    if (invoice.items.length > 150) {
      toast.warning("Large invoice detected. Please verify totals carefully.", { duration: 5000 });
    }

    const timestamp = Date.now();
    const priceUpdates: { id: string; pricePerUnit: number }[] = [];
    const newItems: InventoryItem[] = [];
    const priceHistoryEntries: SupplierPriceHistoryEntry[] = [];
    const lastUpdated = new Date().toISOString().split('T')[0];

    invoice.items.forEach((item, idx) => {
      const unit = (item.unit || 'pcs') as Unit;
      const { invItem, quantityInBase, pricePerBase, unitMismatch } = resolveInvoiceLine(item.name, item.quantity, unit, item.price, items);

      if (unitMismatch) {
        toast.error(`Unit Mismatch: ${item.name} is invoiced in ${unit} but stored in ${invItem!.baseUnit}. Please update its Unit Size in Inventory first.`, { duration: 6000 });
        return;
      }

      let inventoryItemId: string;
      if (invItem) {
        inventoryItemId = invItem.id;
        priceUpdates.push({ id: invItem.id, pricePerUnit: pricePerBase });
      } else {
        const inventoryType = (unit === 'L' || unit === 'ml' || unit === 'cl') ? 'LIQUID' : (unit === 'kg' || unit === 'g') ? 'SOLID' : 'UNIT';
        const baseUnit = inventoryType === 'LIQUID' ? 'ml' : inventoryType === 'SOLID' ? 'g' : 'pcs';
        const newItem: InventoryItem = {
          id: `inv-${timestamp}-${idx}`,
          name: item.name,
          // Unknown until a human confirms it — never guess Food/Ingredient for an unmatched
          // line, since it may just as easily be a cleaning product, packaging, or anything else.
          category: 'Other',
          needsCategoryReview: true,
          description: `Auto-created from invoice ${invoice.invoiceNumber || invoice.id} — category not yet confirmed.`,
          inventoryType,
          baseUnit,
          // Catalogued, not stocked — the physical delivery still has to go through Receive
          // Goods (against a Stock Order) before this item shows any real quantity on hand.
          quantity: 0,
          unit,
          unitSize: 1,
          pricePerUnit: pricePerBase,
          minStockLevel: 5,
          lastUpdated,
          supplier: invoice.vendor || 'Unknown',
          isActive: true
        };
        newItems.push(newItem);
        inventoryItemId = newItem.id;
      }

      priceHistoryEntries.push({
        id: `sph-${timestamp}-${idx}`,
        inventoryItemId,
        itemName: item.name,
        supplier: invoice.vendor,
        price: pricePerBase,
        invoiceId: invoice.id,
        locationId: LOCATION_ID,
        date: invoice.date,
        createdAt: new Date().toISOString(),
      });
    });

    if (inventorySettings.autoUpdateFromInvoices) {
      // Price only — a targeted merge, never the full-overwrite safeFirestoreSet, so nothing
      // else on the inventory document (quantity included) gets touched.
      priceUpdates.forEach(u => {
        updateDoc(doc(db, 'inventory', u.id), { pricePerUnit: u.pricePerUnit, lastUpdated })
          .catch(err => handleFirestoreError(err, OperationType.UPDATE, `inventory/${u.id}`));
        setItems(prev => prev.map(i => i.id === u.id ? { ...i, pricePerUnit: u.pricePerUnit, lastUpdated } : i));
        import('./services/inventoryService').then(({ syncRecipePrices }) => {
          syncRecipePrices(u.id, u.pricePerUnit, recipes, items);
        });
      });

      if (newItems.length > 0) {
        setItems(prev => [...prev, ...newItems]);
        newItems.forEach(item => safeFirestoreSet('inventory', item.id, item));
      }

      priceHistoryEntries.forEach(entry => safeFirestoreSet('supplierPriceHistory', entry.id, entry));
    }

    const updatedInvoice: Invoice = { ...invoice, status: 'Processed' };

    // Audit Log
    if (user) {
      logAuditAction(
        user.uid,
        user.displayName || user.email || 'Unknown',
        'UPDATE',
        'Invoice',
        invoice.id,
        invoice.invoiceNumber || invoice.id,
        invoice,
        updatedInvoice
      );
    }

    setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updatedInvoice : inv));
    safeFirestoreSet('invoices', updatedInvoice.id, updatedInvoice);

    toast.success(`Approved invoice: ${priceUpdates.length} price${priceUpdates.length !== 1 ? 's' : ''} updated, ${newItems.length} new item${newItems.length !== 1 ? 's' : ''} catalogued. Stock is unaffected — receive the delivery separately if that hasn't been done yet.`);
  };

  const handleDeleteRecipe = (id: string) => {
    const recipesUsingThis = recipes.filter(r => r.id !== id && r.ingredients?.some(i => i.inventoryItemId === `recipe-${id}`));
    
    let message = 'Are you sure you want to delete this recipe? This action cannot be undone and will remove all associated training data.';
    if (recipesUsingThis.length > 0) {
      message = `CRITICAL WARNING: This recipe is used in the following other recipes: ${recipesUsingThis.map(r => r.name).join(', ')}. Deleting it will break these dependencies. Do you still want to proceed?`;
    }

    setConfirmationModal({
      isOpen: true,
      title: 'Delete Recipe',
      message: message,
      variant: 'danger',
      onConfirm: async () => {
        const recipeToDelete = recipes.find(r => r.id === id);
        if (!user) {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        try {
          await deleteDoc(doc(db, 'recipes', id));

          // Best-effort cleanup of the linked POS menu item(s).
          // menuItems normally share the recipe's doc ID, but also match on
          // recipeId/slug in case a legacy item was created via a different flow.
          try {
            const menuItemIdsToDelete = new Set<string>([id]);
            const slug = (recipeToDelete as any)?.slug;

            const [byRecipeIdSnap, bySlugSnap] = await Promise.all([
              getDocs(query(collection(db, 'menuItems'), where('recipeId', '==', id))),
              slug
                ? getDocs(query(collection(db, 'menuItems'), where('slug', '==', slug)))
                : Promise.resolve(null),
            ]);
            byRecipeIdSnap.forEach(d => menuItemIdsToDelete.add(d.id));
            bySlugSnap?.forEach(d => menuItemIdsToDelete.add(d.id));

            await Promise.all(
              Array.from(menuItemIdsToDelete).map(menuItemId => deleteDoc(doc(db, 'menuItems', menuItemId)))
            );
          } catch (menuItemError) {
            console.error(`Failed to delete linked POS menu item(s) for recipe ${id}:`, menuItemError);
            toast.warning(`"${recipeToDelete?.name || 'Recipe'}" was deleted, but its POS menu item could not be removed.`);
          }

          setRecipes(prev => prev.filter(r => r.id !== id));

          // Audit Log
          logAuditAction(
            user.uid,
            user.displayName || user.email || 'Unknown',
            'DELETE' as any,
            'Recipe',
            id,
            recipeToDelete?.name || 'Unknown',
            recipeToDelete,
            null
          );

          toast.success(`Deleted "${recipeToDelete?.name || 'recipe'}".`);
        } catch (e) {
          console.error(`Failed to delete recipe ${id}:`, e);
          toast.error(`Failed to delete recipe: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSaveSupplier = (supplier: Supplier) => {
    const oldSupplier = suppliers.find(s => s.id === supplier.id);
    
    setSuppliers(prev => {
        const exists = prev.find(s => s.id === supplier.id);
        
        if (exists && exists.name !== supplier.name) {
            setItems(currentItems => {
              const updatedItems = currentItems.map(item => 
                item.supplier === exists.name ? { ...item, supplier: supplier.name } : item
              );
              // Update items in Firestore too if they changed
              updatedItems.forEach(item => {
                if (item.supplier === supplier.name) {
                  safeFirestoreSet('inventory', item.id, item);
                }
              });
              return updatedItems;
            });
        }

        if (exists) {
            return prev.map(s => s.id === supplier.id ? supplier : s);
        } else {
            return [...prev, supplier];
        }
    });
    if (user) {
      logAuditAction(
        user.uid,
        user.displayName || user.email || 'Unknown',
        oldSupplier ? 'UPDATE' : 'CREATE',
        'Supplier',
        supplier.id,
        supplier.name,
        oldSupplier,
        supplier
      );
    }

    safeFirestoreSet('suppliers', supplier.id, supplier);
  };

  const handleDeleteSupplier = async (id: string) => {
      const supplierToDelete = suppliers.find(s => s.id === id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      if (user) {
        try {
          await deleteDoc(doc(db, 'suppliers', id));
          // Audit Log
          logAuditAction(
            user.uid,
            user.displayName || user.email || 'Unknown',
            'DELETE' as any,
            'Supplier',
            id,
            supplierToDelete?.name || 'Unknown',
            supplierToDelete,
            null
          );
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `suppliers/${id}`);
        }
      }
  };

  const handleSaveMapping = (itemName: string, recipeId: string) => {
    const newMappings = { ...itemRecipeMappings, [itemName]: recipeId };
    setItemRecipeMappings(newMappings);
    if (user) {
      setDoc(doc(db, 'settings', `mappings_${LOCATION_ID}`), { mappings: newMappings, locationId: LOCATION_ID }).catch(console.error);
    }
  };

  const handleAddToCart = (item: InventoryItem, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.inventoryItemId === item.id);
      if (existing) {
        if (existing.quantity + quantity <= 0) {
          return prev.filter(i => i.inventoryItemId !== item.id);
        }
        return prev.map(i => i.inventoryItemId === item.id ? { ...i, quantity: i.quantity + quantity } : i);
      } else if (quantity > 0) {
        return [...prev, {
          inventoryItemId: item.id,
          name: item.name,
          quantity,
          unit: item.unit,
          pricePerUnit: item.pricePerUnit,
          supplier: item.supplier,
          category: item.category
        }];
      }
      return prev;
    });
  };

  const handlePlaceOrder = (supplier: string, items: OrderItem[], ccEmails: string[] = []) => {
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      supplier,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0),
      status: 'Draft',
      ccEmails
    };
    
    setOrders(prev => [newOrder, ...prev]);
    safeFirestoreSet('orders', newOrder.id, newOrder);
    setCart(prev => prev.filter(item => item.supplier !== supplier));
    
    // Audit Log
    if (user) {
      logAuditAction(
        user.uid,
        user.displayName || user.email || 'Unknown',
        'CREATE',
        'Order',
        newOrder.id,
        `PO from ${supplier}`,
        null,
        newOrder
      );
    }
    
    toast.success(`Order placed with ${supplier}. Total: £${newOrder.totalAmount.toFixed(2)}`);
  };

  // Phase 1 — Receive Goods. The ONLY place stock gets added from a purchase. `items` already
  // carries ordered/received quantities in base units (the receiving screen owns that
  // conversion itself, the same way Stock Take's checklist does) — this handler just records
  // the receipt and applies it, reusing handleUpdateStock's existing delta/negative-stock/
  // audit-log machinery rather than writing a second, parallel stock-update path.
  const handleReceiveDelivery = (orderId: string, items: ReceivingRecordItem[]) => {
    if (!user) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const record: ReceivingRecord = {
      id: `recv-${Date.now()}`,
      orderId,
      supplier: order.supplier,
      locationId: LOCATION_ID,
      date: getBusinessDay(),
      items,
      receivedBy: user.uid,
      receivedByName: user.displayName || user.email || 'Unknown',
      createdAt: new Date().toISOString(),
    };

    safeFirestoreSet('receivingRecords', record.id, record);

    // Stock update — delta per line; handleUpdateStock already no-ops a zero delta, so a line
    // that never arrived (receivedQuantity 0) is logged on the record above but writes nothing.
    handleUpdateStock(
      items.map(i => ({ id: i.inventoryItemId, delta: i.receivedQuantity })),
      'RECEIPT',
      record.id
    );

    // An order can now span multiple receiving sessions (split/partial deliveries), so closure
    // is decided from the CUMULATIVE received total per line across every session against this
    // order — including this one — never from a single session in isolation. Only flips to
    // Received once every line has met or exceeded what was originally ordered; otherwise the
    // order stays open as Partially Received so a later drop-off has somewhere to go.
    const priorRecords = receivingRecords.filter(r => r.orderId === orderId);
    const cumulativeByItem: Record<string, number> = {};
    for (const rec of [...priorRecords, record]) {
      for (const line of rec.items) {
        cumulativeByItem[line.inventoryItemId] = (cumulativeByItem[line.inventoryItemId] || 0) + line.receivedQuantity;
      }
    }
    const isFullyReceived = order.items.every(oi => (cumulativeByItem[oi.inventoryItemId] || 0) >= oi.quantity);

    const updatedOrder = { ...order, status: (isFullyReceived ? 'Received' : 'Partially Received') as Order['status'] };
    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    safeFirestoreSet('orders', orderId, updatedOrder);

    logAuditAction(
      user.uid,
      user.displayName || user.email || 'Unknown',
      'UPDATE',
      'Order',
      orderId,
      `Received delivery from ${order.supplier}${isFullyReceived ? ' (order complete)' : ' (partial — order still open)'}`,
      order,
      updatedOrder
    );

    const shortLines = items.filter(i => i.receivedQuantity < i.orderedQuantity);
    toast.success(
      isFullyReceived
        ? `Delivery received from ${order.supplier} — order complete.`
        : `Delivery received from ${order.supplier} — order still partially outstanding (${shortLines.length} line${shortLines.length !== 1 ? 's' : ''} not fully received yet).`
    );
  };

  // Explicit manual close-out for a Partially Received order — e.g. the supplier confirms the
  // remaining balance is cancelled/backordered separately. Only changes the order's status;
  // never touches stock (that only ever happens via a real receiving session above).
  const handleCloseOrder = (orderId: string) => {
    if (!user) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const updatedOrder = { ...order, status: 'Received' as Order['status'] };
    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    safeFirestoreSet('orders', orderId, updatedOrder);

    logAuditAction(
      user.uid,
      user.displayName || user.email || 'Unknown',
      'UPDATE',
      'Order',
      orderId,
      `Manually closed order from ${order.supplier} — outstanding balance not received`,
      order,
      updatedOrder
    );

    toast.success(`Order from ${order.supplier} closed out.`);
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!user) return;
    const userId = user.uid;
    
    // Check if any items are used in recipes
    const usedInRecipes: string[] = [];
    ids.forEach(id => {
      const used = recipes.some(r => r.ingredients.some(i => i.inventoryItemId === id));
      if (used) {
        const itemName = items.find(i => i.id === id)?.name || id;
        usedInRecipes.push(itemName);
      }
    });
    
    if (usedInRecipes.length > 0) {
      if (!window.confirm(`The following items are used in recipes: ${usedInRecipes.join(', ')}. Deleting them will break these recipes. Are you sure you want to proceed?`)) {
        return;
      }
    }
    
    try {
      const itemsToDelete = items.filter(i => ids.includes(i.id));
      const deletePromises = ids.map(id => deleteDoc(doc(db, 'inventory', id)));
      await Promise.all(deletePromises);

      // Audit Log
      if (user) {
        itemsToDelete.forEach(item => {
          logAuditAction(
            user.uid,
            user.displayName || user.email || 'Unknown',
            'DELETE' as any,
            'Inventory',
            item.id,
            item.name,
            item,
            null
          );
        });
      }

      toast.success(`Successfully deleted ${ids.length} items`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, 'inventory/bulk');
    }
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<InventoryItem>) => {
    if (!user) return;
    const userId = user.uid;
    try {
      const updatePromises = ids.map(id => setDoc(doc(db, 'inventory', id), cleanObject(updates), { merge: true }));
      await Promise.all(updatePromises);
      toast.success(`Successfully updated ${ids.length} items`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, 'inventory/bulk');
    }
  };

  const handleSaveWaste = (record: WasteRecord) => {
    setWasteRecords(prev => [record, ...prev]);
    safeFirestoreSet('waste', record.id, record);
    
    // Audit Log
    if (user) {
      logAuditAction(
        user.uid,
        user.displayName || user.email || 'Unknown',
        'CREATE',
        'WasteRecord',
        record.id,
        `Waste: ${record.itemName}`,
        null,
        record
      );
    }
    
    // Deduct from inventory (check both items and recipes)
    const item = items.find(i => i.id === record.inventoryItemId);
    const recipe = recipes.find(r => `recipe-${r.id}` === record.inventoryItemId);
    
    if (item || recipe) {
      handleUpdateStock([{ id: record.inventoryItemId, quantity: Math.max(0, (item?.quantity || recipe?.quantity || 0) - record.baseQuantity) }], 'WASTE', record.id);
    }
  };

  const handleDeleteWaste = async (id: string) => {
    const recordToDelete = wasteRecords.find(r => r.id === id);
    setWasteRecords(prev => prev.filter(r => r.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'waste', id));
        // Audit Log
        logAuditAction(
          user.uid,
          user.displayName || user.email || 'Unknown',
          'DELETE' as any,
          'WasteRecord',
          id,
          `Waste: ${recordToDelete?.itemName || 'Unknown'}`,
          recordToDelete,
          null
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `waste/${id}`);
      }
    }
  };

  const handleSaveExpense = (record: ExpenseRecord) => {
    setExpenseRecords(prev => [record, ...prev]);
    safeFirestoreSet('expenses', record.id, record);
    
    // Audit Log
    if (user) {
      logAuditAction(
        user.uid,
        user.displayName || user.email || 'Unknown',
        'CREATE',
        'ExpenseRecord',
        record.id,
        `Expense: ${record.description}`,
        null,
        record
      );
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const recordToDelete = expenseRecords.find(r => r.id === id);
    setExpenseRecords(prev => prev.filter(r => r.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        // Audit Log
        logAuditAction(
          user.uid,
          user.displayName || user.email || 'Unknown',
          'DELETE' as any,
          'ExpenseRecord',
          id,
          `Expense: ${recordToDelete?.description || 'Unknown'}`,
          recordToDelete,
          null
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `expenses/${id}`);
      }
    }
  };

  const openAddItemModal = () => {
    setEditingItem(undefined);
    setIsAddItemModalOpen(true);
  };

  const handleEditInventoryItemFromReport = (item: InventoryItem) => {
    if (item.id.startsWith('recipe-')) {
      const recipeId = item.id.replace('recipe-', '');
      setEditRecipeId(recipeId);
      setCurrentView('recipes');
    } else {
      setEditingItem(item);
      setIsAddItemModalOpen(true);
      setCurrentView('inventory');
    }
  };

  const openEditItemModal = (item: InventoryItem) => {
    if (item.id.startsWith('recipe-')) {
      const recipeId = item.id.replace('recipe-', '');
      setEditRecipeId(recipeId);
      setCurrentView('recipes');
    } else {
      setEditingItem(item);
      setIsAddItemModalOpen(true);
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: View, icon: any, label: string }) => (
    <button
      onClick={() => { onNavItemClick(view); setIsSidebarOpen(false); }}
      className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
        currentView === view 
          ? 'bg-accent text-white shadow-sm' 
          : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'
      }`}
    >
      <Icon className={`mr-3 h-5 w-5 ${currentView === view ? 'text-white' : 'text-text-muted'}`} />
      {label}
    </button>
  );

  const combinedItems = useMemo(() => {
    const recipeItems: InventoryItem[] = recipes
      .filter(r => r.type === 'recipe' || r.category === 'Batch' || r.category === 'Prep')
      .map(r => {
        let totalCost = 0;
        try {
          totalCost = calculateTotalCost(r.ingredients, items, recipes);
        } catch (e) {
          console.error(`Circular dependency cost calculation failed for ${r.name}:`, e);
          totalCost = 0;
        }
        const yieldFactor = CONVERSION_FACTORS[r.yieldUnit as Unit] || 1;
        const costPerBaseUnit = r.yieldAmount && r.yieldAmount > 0 ? totalCost / (r.yieldAmount * yieldFactor) : totalCost;
        
        return {
          id: `recipe-${r.id}`,
          name: r.name || 'Unnamed Recipe',
          category: (r.category === 'Food' || r.category === 'Prep') ? 'Prep' : 'Batch',
          inventoryType: (r.yieldUnit === 'L' || r.yieldUnit === 'ml' ? 'LIQUID' : r.yieldUnit === 'kg' || r.yieldUnit === 'g' ? 'SOLID' : 'UNIT') as InventoryType,
          baseUnit: (r.yieldUnit === 'L' || r.yieldUnit === 'ml' ? 'ml' : r.yieldUnit === 'kg' || r.yieldUnit === 'g' ? 'g' : 'pcs') as Unit,
          quantity: r.quantity || 0,
          unit: (r.yieldUnit as Unit) || 'portions' as Unit,
          unitSize: 1,
          minStockLevel: 0,
          pricePerUnit: r.pricePerUnit || costPerBaseUnit, // Using stored cost if available, else calculate
          retailPrice: r.sellingPrice || 0,
          lastUpdated: r.lastUpdated,
          imageUrl: r.imageUrl,
          vatCode: r.vatCode,
          vatRate: r.vatRate,
          isActive: true
        };
      });
    return [...items, ...recipeItems];
  }, [items, recipes]);

  // Monitor recipe availability for notifications
  useEffect(() => {
    const lowAvailabilityRecipes = recipes.filter(r => 
      r.trackAvailability && 
      r.availabilityCount !== undefined && 
      r.availabilityCount <= 5 &&
      r.availabilityCount > 0
    );

    const outOfStockRecipes = recipes.filter(r => 
      r.trackAvailability && 
      r.availabilityCount !== undefined && 
      r.availabilityCount === 0
    );

    lowAvailabilityRecipes.forEach(recipe => {
      toast.warning(`Low Stock: ${recipe.name}`, {
        description: `Only ${recipe.availabilityCount} portions remaining.`,
        id: `low-stock-${recipe.id}`
      });
    });

    outOfStockRecipes.forEach(recipe => {
      toast.error(`Out of Stock: ${recipe.name}`, {
        description: `Please update availability or check inventory.`,
        id: `out-of-stock-${recipe.id}`
      });
    });
  }, [recipes]);

  // Background Cleanup Task for Orphaned Ingredients (Fix #3)
  useEffect(() => {
    if (!isAuthReady || !user || recipes.length === 0 || items.length === 0) return;

    const cleanupOrphanedIngredients = async () => {
      let cleanedCount = 0;
      const recipesToUpdate: Recipe[] = [];

      recipes.forEach(recipe => {
        const validIngredients = recipe.ingredients.filter(ing => {
          if (ing.inventoryItemId.startsWith('recipe-')) {
            const subRecipeId = ing.inventoryItemId.replace('recipe-', '');
            return recipes.some(r => r.id === subRecipeId);
          }
          return items.some(i => i.id === ing.inventoryItemId);
        });

        if (validIngredients.length !== recipe.ingredients.length) {
          recipesToUpdate.push({ ...recipe, ingredients: validIngredients });
          cleanedCount += (recipe.ingredients.length - validIngredients.length);
        }
      });

      if (recipesToUpdate.length > 0) {
        // Use batch to update Firestore
        const batch = writeBatch(db);
        recipesToUpdate.forEach(updatedRecipe => {
          const recipeRef = doc(db, 'recipes', updatedRecipe.id);
          batch.update(recipeRef, { ingredients: updatedRecipe.ingredients });
        });

        try {
          await batch.commit();
          setRecipes(prev => prev.map(r => {
            const updated = recipesToUpdate.find(ur => ur.id === r.id);
            return updated ? updated : r;
          }));
          toast.info(`System Cleanup: Removed ${cleanedCount} orphaned ingredients from recipes.`);
        } catch (error) {
          console.error("[Cleanup] Failed to save cleaned recipes:", error);
        }
      }
    };

    // Run cleanup once on app start
    cleanupOrphanedIngredients();
  }, [isAuthReady, user, items.length, recipes.length]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-main-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-main-bg flex items-center justify-center p-4">
        <div className="bg-card-bg p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <img
              src="Backbonehub-ico.png"
              alt="Backbone Hub Logo"
              className="w-20 h-20 rounded-2xl shadow-sm object-contain"
            />
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-bold text-text-navy mb-2">Welcome to Backbone Hub</h1>
            <p className="text-text-muted mb-8">Sign in with your Google work account to continue.</p>
            <button
              onClick={handleLogin}
              disabled={isAuthenticating}
              className="w-full bg-white dark:bg-slate-800 text-text-navy dark:text-white border border-border-grey dark:border-slate-700 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                  Continue with Google
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === 'Unlinked') {
    return (
      <div className="min-h-screen bg-main-bg flex items-center justify-center p-4">
        <div className="bg-card-bg p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <img
              src="Backbonehub-ico.png"
              alt="Backbone Hub Logo"
              className="w-20 h-20 rounded-2xl shadow-sm object-contain"
            />
          </div>
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-navy mb-3">Account Not Linked</h1>
          <p className="text-text-muted mb-2">
            Your Google account is not linked to a staff profile.
          </p>
          <p className="text-sm text-text-muted mb-6">
            Please ask your manager to add <span className="font-bold text-text-navy">{user?.email}</span> to your staff record.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-accent text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (isMigrating) {
    return (
      <div className="min-h-screen bg-main-bg flex items-center justify-center p-4">
        <div className="bg-card-bg p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="animate-bounce mb-6">
            <Package className="w-12 h-12 text-accent mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-text-navy mb-2">Migrating Data...</h1>
          <p className="text-text-muted">We're moving your local data to our secure cloud storage. This will only take a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <OfflineBanner position="top" isOnline={isConnectionOnline} offlineDuration={offlineDuration} />
      <div className={`h-screen flex flex-col md:flex-row overflow-hidden transition-colors duration-200 ${isDarkMode ? 'dark' : ''} bg-main-bg text-text-navy`}>
        {/* Mobile Header */}
        <div className={`md:hidden border-b px-4 py-3 flex items-center justify-between flex-shrink-0 z-30 transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-primary-surface border-border-grey'}`}>
          <div className="flex items-center">
            <img src="Backbonehub-ico.png" alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
            <div className="ml-2 flex flex-col leading-tight">
              <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-text-navy'}`}>Backbone Hub</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Backoffice</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-md transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-text-muted hover:bg-secondary-surface'}`}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-md transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-text-muted hover:bg-secondary-surface'}`}>
              {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Sidebar Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-text-navy bg-opacity-50 z-40 md:hidden transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 transition-colors
          ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-primary-surface border-border-grey'}
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="h-full flex flex-col">
            <div className={`h-20 flex items-center px-6 border-b hidden md:flex flex-shrink-0 transition-colors ${isDarkMode ? 'border-slate-800' : 'border-border-grey'}`}>
              <img src="Backbonehub-ico.png" alt="Logo" className="h-10 w-10 rounded-lg object-contain" />
              <div className="ml-3 flex flex-col leading-tight">
                <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-text-navy'}`}>Backbone Hub</span>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Backoffice</span>
              </div>
            </div>
            
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
              {checkPermission('reports', 'viewFinancials') && <NavItem view="labour" icon={HardHat} label="Labour Import" />}
              {SHOW_FINANCIAL_COMMAND && checkPermission('reports', 'viewFinancials') && <NavItem view="financial_command" icon={PoundSterling} label="Financial Command" />}
              {checkPermission('staff', 'viewBriefing') && <NavItem view="briefing" icon={Megaphone} label="Shift Briefing" />}
              {checkPermission('inventory', 'view') && <NavItem view="inventory" icon={Package} label="Inventory" />}
              {checkPermission('orders', 'view') && <NavItem view="orders" icon={ShoppingCart} label="Stock Orders" />}
              {checkPermission('recipes', 'view') && <NavItem view="recipes" icon={ChefHat} label="Menu Recipes" />}
              {checkPermission('staff', 'viewTraining') && <NavItem view="training" icon={BookOpen} label="Training" />}
              {checkPermission('tables', 'view') && <NavItem view="tables" icon={LayoutList} label="Table Manager" />}
              {checkPermission('reports', 'viewSales') && <NavItem view="sales" icon={TrendingUp} label="Sales Import" />}
              {checkPermission('stockCount', 'view') && <NavItem view="stocktake" icon={ClipboardCheck} label="Stock Count" />}
              {checkPermission('inventory', 'edit') && <NavItem view="waste" icon={Trash2} label="Waste Records" />}
              {checkPermission('inventory', 'processInvoices') && <NavItem view="invoices" icon={FileInput} label="Invoices" />}
              {checkPermission('reports', 'viewFinancials') && <NavItem view="expenses" icon={ReceiptPoundSterling} label="Operation Costs" />}
              {checkPermission('inventory', 'manageSuppliers') && <NavItem view="suppliers" icon={Truck} label="Suppliers" />}
              {checkPermission('reports', 'viewSales') && <NavItem view="reports" icon={TrendingUp} label="Reports" />}
            </nav>

            <div className={`p-4 border-t flex-shrink-0 transition-colors ${isDarkMode ? 'border-slate-800' : 'border-border-grey'}`}>
              {checkPermission('settings', 'view') && <NavItem view="settings" icon={SettingsIcon} label="Settings" />}
              <div className="mt-4 flex items-center justify-between bg-card-bg dark:bg-slate-800 p-3 rounded-xl border border-border-grey dark:border-slate-700 shadow-sm">
                <div className="flex items-center min-w-0">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="h-8 w-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-secondary-surface dark:bg-slate-700 flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                      {user?.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="ml-3 truncate">
                    <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-text-navy'}`}>{user?.displayName || 'User'}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                      {userRole}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDarkMode ? 'text-slate-400 hover:bg-slate-700 hover:text-cta' : 'text-text-muted hover:bg-secondary-surface hover:text-cta'}`}
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative transition-colors duration-200 bg-main-bg">
          {storageError && (
            <div className="mb-4 bg-error/10 border border-error/20 p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 text-cta flex-shrink-0" />
              <p className="text-cta text-sm font-medium">
                {storageError}
              </p>
              <button 
                onClick={() => setStorageError(null)}
                className="ml-auto text-cta/50 hover:text-cta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className={`mx-auto pb-20 ${currentView === 'inventory' || currentView === 'recipes' ? 'max-w-[1920px]' : 'max-w-7xl'}`}>
            <header className="mb-6 sm:mb-8 flex justify-end items-center rounded-md">
              {/* Per-page title (icon + name + subtitle) now lives inside each page's own
                  component via the shared PageHeader — this bar no longer repeats it in
                  plain text above, which used to show the page name twice with slightly
                  different wording (e.g. "Stock Orders" here + "Orders & Purchasing" below). */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`hidden md:flex p-2.5 rounded-xl shadow-sm transition-all focus:outline-none ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white' : 'bg-card-bg text-text-muted hover:bg-secondary-surface hover:text-accent'}`}
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </header>

            {currentView === 'dashboard' && (
              <Dashboard
                  items={combinedItems}
                  totalRevenue={combinedTotalRevenue}
                  posPaymentsCount={posPayments.length}
                  isPosLive={isConnectionOnline}
                  databaseId={(db as any)._databaseId?.database}
                  orderCountToday={liveSalesData.aggregate.numberOfPaidOrders}
                  livePosSalesSummary={livePosSalesSummary}
                  todayCovers={liveSalesData.aggregate.todayCovers}
                  todaysClosure={closures.find(c => c.type === ClosureType.DAY && c.date === getBusinessDay()) || null}
                  todayCategorySalesSplit={todayCategorySalesSplit}
                  labourCostPeriodToDate={labourCostPeriodToDate}
                  invoices={invoices}
                  setCurrentView={setCurrentView}
                  onAddToCart={handleAddToCart}
                />
              )}

            {SHOW_FINANCIAL_COMMAND && currentView === 'financial_command' && (
              <FinancialCommandCenter
                closures={closures}
                orders={posOrders}
                liveSalesData={liveSalesData}
                staff={staffMembers}
                inventory={items}
                recipes={recipes}
                forecasts={forecasts}
                expenseRecords={expenseRecords}
                wasteRecords={wasteRecords}
                stockCountRecords={stockHistory}
                onOpenView={setCurrentView}
              />
            )}

            {currentView === 'inventory' && (
              <InventoryList 
                items={combinedItems} 
                recipes={recipes}
                onAddItem={openAddItemModal} 
                onEditItem={openEditItemModal}
                cart={cart}
                onAddToCart={handleAddToCart}
                onBulkDelete={handleBulkDelete}
                onBulkUpdate={handleBulkUpdate}
                onBulkAdd={handleBulkAdd}
                checkPermission={checkPermission}
              />
            )}

            {currentView === 'orders' && (
              <Orders
                cart={cart}
                orders={orders}
                receivingRecords={receivingRecords}
                posOrders={posOrders}
                suppliers={suppliers}
                inventoryItems={combinedItems}
                recipes={recipes}
                onPlaceOrder={handlePlaceOrder}
                onUpdateCart={handleAddToCart}
                onUpdateOrderStatus={(id, status) => {
                  setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
                  const order = orders.find(o => o.id === id);
                  if (order) {
                    safeFirestoreSet('orders', id, { ...order, status });
                  }
                }}
                onReceiveDelivery={handleReceiveDelivery}
                onCloseOrder={handleCloseOrder}
                checkPermission={checkPermission}
              />
            )}

            {currentView === 'recipes' && (
              <MenuRecipes
                inventoryItems={combinedItems}
                recipes={recipes}
                onSaveRecipe={handleSaveRecipe}
                onDeleteRecipe={handleDeleteRecipe}
                onUpdateInventory={handleUpdateStock}
                onAddInventoryItem={handleSaveItem}
                initialEditRecipeId={editRecipeId}
                onClearInitialEditRecipeId={() => setEditRecipeId(null)}
                checkPermission={checkPermission}
                onSyncAllToPos={handleSyncAllToPos}
                menuCategories={menuCategories}
              />
            )}

            {currentView === 'training' && (
              <TrainingCenter 
                recipes={recipes} 
                inventoryItems={combinedItems} 
                staffId={user?.uid}
                staffName={user?.displayName || user?.email || 'Unknown'}
                certifications={staffCertifications}
                quizSubmissions={quizSubmissions}
                staffMembers={staffMembers}
                isAdmin={userRole === 'Admin'}
              />
            )}

            {currentView === 'sales' && (
              <SalesImport
                recipes={recipes}
                inventoryItems={combinedItems}
                onProcessSales={handleSalesDeduction}
                history={salesHistory}
                onSaveRecord={handleSaveSalesRecord}
                itemMappings={itemRecipeMappings}
                onSaveMapping={handleSaveMapping}
              />
            )}
            
            {currentView === 'stocktake' && (
              <StockTaking 
                items={combinedItems} 
                onUpdateInventory={handleUpdateStock}
                history={stockHistory}
                onSaveRecord={handleSaveStockRecord}
                checkPermission={checkPermission}
              />
            )}

            {currentView === 'waste' && (
              <WasteManager
                inventoryItems={combinedItems}
                wasteRecords={wasteRecords}
                onSaveWaste={handleSaveWaste}
                onDeleteWaste={handleDeleteWaste}
                isDarkMode={isDarkMode}
                checkPermission={checkPermission}
              />
            )}
            
            {currentView === 'invoices' && (
              <InvoiceProcessor
                onProcessInvoice={handleAddFromInvoice}
                onApproveInvoice={handleApproveInvoice}
                suppliers={suppliers}
                invoices={invoices}
                orders={orders}
                receivingRecords={receivingRecords}
                supplierPriceHistory={supplierPriceHistory}
                inventoryItems={combinedItems}
                onUpdateInvoice={handleUpdateInvoice}
                onAddSupplier={handleAddSupplier}
              />
            )}

            {currentView === 'expenses' && (
              <OperationCosts
                expenseRecords={expenseRecords}
                onSaveExpense={handleSaveExpense}
                onDeleteExpense={handleDeleteExpense}
                isDarkMode={isDarkMode}
              />
            )}

            {currentView === 'suppliers' && (
              <SupplierManager
                suppliers={suppliers}
                inventoryItems={combinedItems}
                invoices={invoices}
                onSaveSupplier={handleSaveSupplier}
                onDeleteSupplier={handleDeleteSupplier}
                onUpdateInvoice={handleUpdateInvoice}
              />
            )}

            {currentView === 'briefing' && (
              <ShiftBriefingManager recipes={recipes} checkPermission={checkPermission} userRole={userRole} />
            )}

            {currentView === 'labour' && (
              <LabourIntelligence
                staff={staffMembers}
                orders={posOrders}
                closures={closures}
                liveSalesData={liveSalesData}
                expenseRecords={expenseRecords}
                wasteRecords={wasteRecords}
                stockCountRecords={stockHistory}
              />
            )}

            {currentView === 'tables' && (
              <TableManager
                tables={tables}
              />
            )}

            {currentView === 'reports' && (
              <Reports 
                posOrders={posOrders}
                posPayments={posPayments}
                liveSalesData={liveSalesData}
                livePosSalesSummary={livePosSalesSummary}
                inventoryItems={combinedItems}
                suppliers={suppliers}
                invoices={invoices}
                orders={orders}
                recipes={recipes}
                wasteRecords={wasteRecords}
                expenseRecords={expenseRecords}
                labourShifts={labourShiftsForCost}
                onEditRecipe={handleEditRecipeFromReport}
                onEditInventoryItem={handleEditInventoryItemFromReport}
              />
            )}

            {currentView === 'settings' && (
              <RoleGuard userRole={userRole} allowedRoles={['Admin', 'Manager']}>
                <Settings auditLogs={auditLogs} />
              </RoleGuard>
            )}

            <ConfirmationModal
              isOpen={confirmationModal.isOpen}
              title={confirmationModal.title}
              message={confirmationModal.message}
              variant={confirmationModal.variant}
              onConfirm={confirmationModal.onConfirm}
              onCancel={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
            />

            <AddItemModal 
              isOpen={isAddItemModalOpen}
              onClose={() => { setIsAddItemModalOpen(false); setEditingItem(undefined); }}
              onSave={handleSaveItem}
              itemToEdit={editingItem}
              suppliers={suppliers}
            />
          </div>
          
          {/* Chat Bot Widget */}
          <ChatBot items={items} recipes={recipes} />
        </main>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

      </div>
    </ErrorBoundary>
  );
}
