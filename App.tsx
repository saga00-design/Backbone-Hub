
import React, { useState, useEffect, useMemo, Component, ReactNode } from 'react';
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
import ManagerMode from './components/ManagerMode';
import { SupplierManager } from './components/SupplierManager';
import { TableManager } from './components/TableManager';
import { Settings } from './components/Settings';
import { Orders } from './components/Orders';
import { InventoryItem, InventoryCategory, Unit, StockCountRecord, Recipe, SalesImportRecord, Supplier, Order, OrderItem, Invoice, MenuCategory, POSOrder, POSPayment, WasteRecord, ExpenseRecord, MovementType, StockMovement, InventoryType, Table, DailyClosure, Forecast, StaffPerformanceRecord, AppPermissions, StaffCertification, AuditLog, StaffMember, MonthlyTarget, LabourShift } from './types';
import { logAuditAction } from './services/auditService';
import { LayoutDashboard, Package, ClipboardCheck, FileInput, Menu, X, ChefHat, TrendingUp, Truck, Settings as SettingsIcon, BookOpen, Sun, Moon, ShoppingCart, AlertCircle, LogIn, LogOut, Trash2, Receipt, Megaphone, LayoutList, Zap, PoundSterling, Users } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, handleFirestoreError, OperationType, User, cleanObject, signOut, increment, query, where, orderBy, limit, testConnection, LOCATION_ID, writeBatch } from './firebase';
import { DEFAULT_PERMISSIONS } from './constants';
import { calculateTotalCost } from './utils/recipeUtils';
import { convertToBaseUnit, CONVERSION_FACTORS } from './utils/unitConversions';
import { normalizeCurrency, normalizeTimestamp, normalizeStatus } from './utils/currencyUtils';
import { OfflineBanner } from './components/OfflineBanner';
import { WasteManager } from './components/WasteManager';
import { ExpenseManager } from './components/ExpenseManager';
import { ShiftBriefingManager } from './components/ShiftBriefingManager';
import { POSDashboard } from './components/POSDashboard';
import { FinancialCommandCenter } from './components/FinancialCommandCenter';
import { LabourIntelligence } from './components/LabourIntelligence';
import { StaffingRotaHub } from './components/StaffingRotaHub';
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

type View = 'dashboard' | 'manager' | 'inventory' | 'stocktake' | 'invoices' | 'recipes' | 'sales' | 'suppliers' | 'settings' | 'training' | 'orders' | 'reports' | 'waste' | 'expenses' | 'briefing' | 'tables' | 'pos_dashboard' | 'financial_command' | 'labour' | 'staffing_rota';

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
  const [tables, setTables] = useState<Table[]>([]);
  const [posOrders, setPosOrders] = useState<POSOrder[]>([]);
  const [posTransactions, setPosTransactions] = useState<any[]>([]);
  const [posPayments, setPosPayments] = useState<POSPayment[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [permissionsConfig, setPermissionsConfig] = useState<Record<string, AppPermissions>>(DEFAULT_PERMISSIONS);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformanceRecord[]>([]);
  const [staffCertifications, setStaffCertifications] = useState<StaffCertification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [labourShifts, setLabourShifts] = useState<LabourShift[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
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
const getBusinessDay = (): string => {
  const now = new Date();
  const londonHour = parseInt(
    now.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false })
  );
  if (londonHour < 6) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  }
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
};
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
    const isAdminEmail = user?.email === 'saga00@gmail.com' || user?.email === 'saga00@live.com' || user?.email === 'famrokha@gmail.com';
    if (isAdminEmail) return 'Admin';

    const staffMember = staffMembers.find(s => s.email.toLowerCase() === user?.email?.toLowerCase());
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

  // Role Guard Component
  const RoleGuard: React.FC<{ allowedRoles: string[]; children: React.ReactNode }> = ({ allowedRoles, children }) => {
    if (!allowedRoles.includes(userRole)) {
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

    const unsubClosures = onSnapshot(query(collection(db, 'dailyClosures'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc'), limit(30)), (snapshot: any) => {
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

    const unsubLabour = onSnapshot(query(collection(db, 'labourShifts'), where('locationId', '==', LOCATION_ID), orderBy('date', 'desc'), limit(1000)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as LabourShift));
      setLabourShifts(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'labourShifts'));

    const unsubUser = onSnapshot(doc(db, `users/${userId}`), (snapshot: any) => {
      const data = snapshot.data();
      if (data) {
        if (data.isDarkMode !== undefined) setIsDarkMode(data.isDarkMode);
        if ((user.email === 'saga00@gmail.com' || user.email === 'famrokha@gmail.com') && data.role !== 'Admin') {
          setDoc(doc(db, `users/${userId}`), { role: 'Admin' }, { merge: true }).catch(console.error);
        }
      } else {
        setDoc(doc(db, `users/${userId}`), cleanObject({
          uid: userId,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          isDarkMode: false,
          role: (user.email === 'saga00@gmail.com' || user.email === 'famrokha@gmail.com') ? 'Admin' : 'Waiter'
        })).catch((err: any) => handleFirestoreError(err, OperationType.WRITE, `users/${userId}`));
      }
    }, (err: any) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));

    const unsubStaff = onSnapshot(query(collection(db, 'staff'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaffMembers(data);

      snapshot.docs.forEach((d: any) => {
        const staffData = d.data();
        if (staffData.email && (staffData.email.toLowerCase() === 'saga00@gmail.com' || staffData.email.toLowerCase() === 'saga00@live.com' || staffData.email.toLowerCase() === 'famrokha@gmail.com')) {
          if (staffData.role !== 'Admin') {
            updateDoc(doc(db, 'staff', d.id), { role: 'Admin' }).catch(console.error);
          }
        }
      });
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'staff'));

    const unsubMonthlyTargets = onSnapshot(query(collection(db, 'monthlyTargets'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MonthlyTarget));
      setMonthlyTargets(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, 'monthlyTargets'));

    return () => {
      unsubPosTransactions();
      unsubInventory();
      unsubSettings();
      unsubRecipes();
      unsubSuppliers();
      unsubStockHistory();
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
      unsubForecasts();
      unsubStaffPerf();
      unsubCertifications();
      unsubAuditLogs();
      unsubLabour();
      unsubMonthlyTargets();
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

      for (const order of batchToProcess) {
        try {
          const batch = writeBatch(db);

          // 1. Process Inventory
          for (const item of order.items) {
            if (item.isVoided) continue;

            const recipe = recipes.find(r => r.id === item.recipeId || r.name === item.name);
            if (!recipe) {
              console.warn(`[Inventory Sync] No recipe found for item: ${item.name} (${item.recipeId})`);
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
        const currentQty = (item as any).quantity || 0;
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
        let newQty = item.quantity;
        if (update.delta !== undefined) {
          newQty = item.quantity + update.delta;
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

  const handleAddFromInvoice = (invoice: Invoice) => {
    setInvoices(prev => [invoice, ...prev]);
    safeFirestoreSet('invoices', invoice.id, invoice);
    
    if (invoice.status === 'Processed') {
      toast.success(`Processed invoice from ${invoice.vendor}.`);
    } else {
      toast.success(`Invoice from ${invoice.vendor} saved as Pending.`);
    }
    setCurrentView('invoices');
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

  const mapCategoryId = (recipe: Recipe | null | undefined) => {
    if (!recipe) return 'mains';
    const category = (recipe.category || '').toLowerCase();
    const subCategory = (recipe.subCategory || '').toLowerCase();
    const course = (recipe.course || '').toLowerCase();

    if (category.includes('beverage') || category.includes('bar')) return 'drinks';
    if (subCategory.includes('tacos') || category.includes('tacos')) return 'tacos';
    if (subCategory.includes('starter') || course.includes('1st course') || course.includes('starter')) return 'starters';
    if (subCategory.includes('dessert') || course.includes('dessert')) return 'desserts';
    if (subCategory.includes('main') || course.includes('main')) return 'mains';

    return 'mains';
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
      categoryId: categoryId,
      // POS systems expect price in cents (integers)
      priceGross: Math.round((Number(recipe.sellingPrice) || 0) * 100),
      vatRate: Number(recipe.vatRate) || 20,
      active: true,
      locationId: LOCATION_ID,
      station: mapStation(recipe),
      isDrink: categoryId === 'drinks',
      modifierGroupIds: [],
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

  const handleApproveInvoice = (invoice: Invoice) => {
    if (invoice.status === 'Processed') return; // Already processed

    if (invoice.items.length > 150) {
      toast.warning("Large invoice detected. Please verify totals carefully.", { duration: 5000 });
    }

    const timestamp = Date.now();
    const updates: { id: string; quantity: number; pricePerUnit: number }[] = [];
    const newItems: InventoryItem[] = [];

    invoice.items.forEach((item, idx) => {
      const unit = item.unit || 'pcs';
      const inventoryType = (unit === 'L' || unit === 'ml' || unit === 'cl') ? 'LIQUID' : (unit === 'kg' || unit === 'g') ? 'SOLID' : 'UNIT';
      const baseUnit = inventoryType === 'LIQUID' ? 'ml' : inventoryType === 'SOLID' ? 'g' : 'pcs';
      
      const existingItem = items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      const unitSize = existingItem?.unitSize || 1;
      
      // Safety Check: Mandatory Unit Size for complex conversions
      const itemUnit = (unit || 'pcs') as Unit;
      if (existingItem && itemUnit !== existingItem.baseUnit && unitSize === 1) {
        toast.error(`Unit Mismatch: ${item.name} is received in ${itemUnit} but stored in ${existingItem.baseUnit}. Please update its Unit Size in Inventory first.`, { duration: 6000 });
        return;
      }

      const quantityInBase = convertToBaseUnit(item.quantity, itemUnit, unitSize);
      const pricePerBase = item.price ? (item.price / quantityInBase) : 0;
      
      if (existingItem) {
        // Price variation warning (>50%)
        if (existingItem.pricePerUnit > 0) {
          const variation = Math.abs(pricePerBase - existingItem.pricePerUnit) / existingItem.pricePerUnit;
          if (variation > 0.5) {
            toast.warning(`Abnormal price variation for ${item.name}: £${pricePerBase.toFixed(4)}/unit (Previously £${existingItem.pricePerUnit.toFixed(4)})`, { duration: 8000 });
          }
        }

        updates.push({
          id: existingItem.id,
          quantity: existingItem.quantity + quantityInBase,
          pricePerUnit: pricePerBase
        });
      } else {
        newItems.push({
          id: `inv-${timestamp}-${idx}`,
          name: item.name,
          category: 'Ingredient',
          department: 'Food',
          inventoryType,
          baseUnit,
          quantity: quantityInBase,
          unit: unit,
          unitSize: 1,
          pricePerUnit: pricePerBase,
          minStockLevel: 5,
          lastUpdated: new Date().toISOString().split('T')[0],
          supplier: invoice.vendor || 'Unknown',
          isActive: true
        });
      }
    });

    // Apply updates
    if (inventorySettings.autoUpdateFromInvoices) {
      if (updates.length > 0) {
        handleUpdateStock(updates, 'RECEIPT', invoice.id);
      }
      
      if (newItems.length > 0) {
        setItems(prev => [...prev, ...newItems]);
        newItems.forEach(item => {
          safeFirestoreSet('inventory', item.id, item);
          logStockMovement({
            productId: item.id,
            type: 'RECEIPT',
            quantityChange: item.quantity,
            stockBefore: 0,
            stockAfter: item.quantity,
            referenceId: invoice.id,
            referenceType: 'RECEIPT'
          });
        });
      }
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
    
    toast.success(`Approved invoice: ${updates.length} updated, ${newItems.length} new items.`);
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
        setRecipes(prev => prev.filter(r => r.id !== id));
        if (user) {
          try {
            await deleteDoc(doc(db, 'recipes', id));
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
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `recipes/${id}`);
          }
        }
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
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
      <OfflineBanner position="top" />
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
              {checkPermission('staffingRota', 'view') && <NavItem view="staffing_rota" icon={Users} label="Staffing & Rota" />}
              {checkPermission('reports', 'viewFinancials') && <NavItem view="financial_command" icon={PoundSterling} label="Financial Command" />}
              {checkPermission('reports', 'viewSales') && <NavItem view="pos_dashboard" icon={Zap} label="POS Dashboard" />}
              {checkPermission('reports', 'viewSales') && <NavItem view="manager" icon={Zap} label="Manager Mode" />}
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
              {checkPermission('reports', 'viewFinancials') && <NavItem view="expenses" icon={Receipt} label="Expenses" />}
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
          <div className="max-w-7xl mx-auto pb-20">
            <header className="mb-6 sm:mb-8 flex justify-between items-center rounded-md">
              <div className={`flex flex-col text-text-navy`}>
                <h1 className="text-xl sm:text-2xl font-bold leading-none">
                  {currentView === 'dashboard' && 'Backbone Hub'}
                  {currentView === 'financial_command' && 'Financial Command Center'}
                  {currentView === 'manager' && 'Manager Workflow'}
                  {currentView === 'inventory' && 'Inventory Management'}
                  {currentView === 'orders' && 'Stock Orders'}
                  {currentView === 'recipes' && 'Menu & Recipes'}
                  {currentView === 'training' && 'Staff Training'}
                  {currentView === 'sales' && 'Sales Import'}
                  {currentView === 'stocktake' && 'Stock Count'}
                  {currentView === 'waste' && 'Waste Management'}
                  {currentView === 'invoices' && 'Invoice Processing'}
                  {currentView === 'expenses' && 'Expense Tracking'}
                  {currentView === 'suppliers' && 'Supplier Management'}
                  {currentView === 'briefing' && 'Shift Briefing & Performance'}
                  {currentView === 'reports' && 'Business Reports'}
                  {currentView === 'staffing_rota' && 'Staffing & Rota Intelligence'}
                  {currentView === 'settings' && 'System Settings'}
                </h1>
                {currentView === 'dashboard' && (
                  <span className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider mt-1 text-text-muted`}>
                    Backoffice
                  </span>
                )}
              </div>
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
                  salesHistory={salesHistory} 
                  totalRevenue={combinedTotalRevenue} 
                  posPaymentsCount={posPayments.length}
                  databaseId={(db as any)._databaseId?.database}
                  orderCountToday={liveSalesData.aggregate.numberOfPaidOrders}
                  setCurrentView={setCurrentView} 
                  onAddToCart={handleAddToCart} 
                />
              )}

            {currentView === 'financial_command' && (
              <FinancialCommandCenter
                closures={closures}
                orders={posOrders}
                payments={posPayments}
                staff={staffMembers}
                monthlyTargets={monthlyTargets}
                inventory={items}
                recipes={recipes}
                forecasts={forecasts}
                onOpenView={setCurrentView}
              />
            )}

            {currentView === 'manager' && (
              <ManagerMode 
                inventory={items}
                payments={posPayments}
                orders={posOrders}
                closures={closures}
                forecasts={forecasts}
                staffPerformance={staffPerformance}
                onNavigate={(tab) => setCurrentView(tab as any)}
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
              />
            )}

            {currentView === 'training' && (
              <TrainingCenter 
                recipes={recipes} 
                inventoryItems={combinedItems} 
                staffId={user?.uid}
                staffName={user?.displayName || user?.email || 'Unknown'}
                certifications={staffCertifications}
                isAdmin={userRole === 'Admin'}
              />
            )}

            {currentView === 'pos_dashboard' && (
              <POSDashboard 
                orders={posOrders} 
                payments={posPayments}
                tables={tables} 
                forecasts={forecasts} 
                staff={staffMembers}
                recipes={recipes}
                inventory={items}
                locationId={LOCATION_ID}
                onNotifyStaff={(m) => toast.info(`Broadcast: ${m}`)}
                onPushSuggestion={(m) => toast.success(`Pushed to staff: ${m}`)}
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
                onUpdateInvoice={(id, updates) => setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))}
                onAddSupplier={handleAddSupplier}
              />
            )}

            {currentView === 'expenses' && (
              <ExpenseManager
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
                onUpdateInvoice={(id, updates) => setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))}
              />
            )}

            {currentView === 'briefing' && (
              <ShiftBriefingManager recipes={recipes} checkPermission={checkPermission} userRole={userRole} />
            )}

            {currentView === 'staffing_rota' && (
              <StaffingRotaHub 
                staff={staffMembers} 
                orders={posOrders} 
                closures={closures} 
                shifts={labourShifts}
                onSetCurrentView={setCurrentView}
              />
            )}

            {currentView === 'labour' && (
              <LabourIntelligence staff={staffMembers} orders={posOrders} closures={closures} />
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
                onEditRecipe={handleEditRecipeFromReport}
                onEditInventoryItem={handleEditInventoryItemFromReport}
              />
            )}

            {currentView === 'settings' && (
              <RoleGuard allowedRoles={['Admin', 'Manager']}>
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
