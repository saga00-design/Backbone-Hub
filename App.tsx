
import React, { useState, useEffect, useMemo, Component, ReactNode } from 'react';
import { Dashboard } from './components/Dashboard';
import { ConfirmationModal } from './components/ConfirmationModal';
import { InventoryList } from './components/InventoryList';
import { StockTaking } from './components/StockTaking';
import { InvoiceProcessor } from './components/InvoiceProcessor';
import { AddItemModal } from './components/AddItemModal';
import { ChatBot } from './components/ChatBot';
import { MenuRecipes } from './components/MenuRecipes';
import { TrainingCenter } from './components/TrainingCenter';
import { SalesImport } from './components/SalesImport';
import { Reports } from './components/Reports';
import { SupplierManager } from './components/SupplierManager';
import { POSLayout } from './components/POS/POSLayout';
import { Settings } from './components/Settings';
import { Orders } from './components/Orders';
import { InventoryItem, InventoryCategory, Unit, StockCountRecord, Recipe, SalesImportRecord, Supplier, Order, OrderItem, Invoice, MenuCategory, POSOrder, WasteRecord, ExpenseRecord } from './types';
import { LayoutDashboard, Package, ClipboardCheck, FileInput, Menu, X, ChefHat, TrendingUp, Truck, Settings as SettingsIcon, BookOpen, Sun, Moon, ShoppingCart, AlertCircle, LogIn, LogOut, Monitor, Trash2, Receipt } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, handleFirestoreError, OperationType, User, cleanObject } from './firebase';
import { calculateTotalCost } from './utils/recipeUtils';

import { WasteManager } from './components/WasteManager';
import { ExpenseManager } from './components/ExpenseManager';

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
  { id: 'i1', name: 'Premium Flour', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Kitchen', quantity: 50, unit: 'kg', minStockLevel: 20, pricePerUnit: 2.5, lastUpdated: '2023-10-25', supplier: 'GrainMaster' },
  { id: 'i2', name: 'Olive Oil', category: 'Ingredient', subCategory: 'Oils & Fats', department: 'Kitchen', quantity: 12, unit: 'L', minStockLevel: 15, pricePerUnit: 18.0, lastUpdated: '2023-10-24', supplier: 'Mediterranean Imports' },
  { id: 'i3', name: 'Whole Milk', category: 'Ingredient', subCategory: 'Dairy', department: 'Kitchen', quantity: 4, unit: 'L', minStockLevel: 10, pricePerUnit: 1.5, lastUpdated: '2023-10-26', supplier: 'Local Dairy' },
  { id: 'i4', name: 'Fresh Basil', category: 'Ingredient', subCategory: 'Produce', department: 'Kitchen', quantity: 0.5, unit: 'kg', minStockLevel: 1, pricePerUnit: 22.0, lastUpdated: '2023-10-26', supplier: 'FarmFresh' },
  { id: 'i5', name: 'Tomato Sauce', category: 'Ingredient', subCategory: 'Canned Goods', department: 'Kitchen', quantity: 20, unit: 'L', minStockLevel: 10, pricePerUnit: 3.5, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  { id: 'i6', name: 'Mozzarella Cheese', category: 'Ingredient', subCategory: 'Dairy', department: 'Kitchen', quantity: 15, unit: 'kg', minStockLevel: 5, pricePerUnit: 8.0, lastUpdated: '2023-10-25', supplier: 'Local Dairy' },
  { id: 'i7', name: 'Chicken Breast', category: 'Ingredient', subCategory: 'Meat', department: 'Kitchen', quantity: 25, unit: 'kg', minStockLevel: 10, pricePerUnit: 6.5, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  { id: 'i8', name: 'Beef Mince', category: 'Ingredient', subCategory: 'Meat', department: 'Kitchen', quantity: 10, unit: 'kg', minStockLevel: 5, pricePerUnit: 7.5, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  { id: 'i9', name: 'Onions', category: 'Ingredient', subCategory: 'Produce', department: 'Kitchen', quantity: 30, unit: 'kg', minStockLevel: 10, pricePerUnit: 1.2, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  { id: 'i10', name: 'Garlic', category: 'Ingredient', subCategory: 'Produce', department: 'Kitchen', quantity: 5, unit: 'kg', minStockLevel: 2, pricePerUnit: 4.0, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  { id: 'i11', name: 'Spaghetti', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Kitchen', quantity: 40, unit: 'kg', minStockLevel: 15, pricePerUnit: 2.0, lastUpdated: '2023-10-25', supplier: 'GrainMaster' },
  { id: 'i12', name: 'Eggs', category: 'Ingredient', subCategory: 'Dairy', department: 'Kitchen', quantity: 300, unit: 'pcs', minStockLevel: 100, pricePerUnit: 0.2, lastUpdated: '2023-10-25', supplier: 'Local Dairy' },
  { id: 'i13', name: 'Butter', category: 'Ingredient', subCategory: 'Dairy', department: 'Kitchen', quantity: 10, unit: 'kg', minStockLevel: 3, pricePerUnit: 5.5, lastUpdated: '2023-10-25', supplier: 'Local Dairy' },
  { id: 'i14', name: 'Sugar', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Kitchen', quantity: 20, unit: 'kg', minStockLevel: 5, pricePerUnit: 1.5, lastUpdated: '2023-10-25', supplier: 'GrainMaster' },
  { id: 'i15', name: 'Salt', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Kitchen', quantity: 10, unit: 'kg', minStockLevel: 2, pricePerUnit: 0.8, lastUpdated: '2023-10-25', supplier: 'GrainMaster' },
  { id: 'i16', name: 'Black Pepper', category: 'Ingredient', subCategory: 'Dry Goods', department: 'Kitchen', quantity: 2, unit: 'kg', minStockLevel: 0.5, pricePerUnit: 15.0, lastUpdated: '2023-10-25', supplier: 'GrainMaster' },
  { id: 'i17', name: 'Parmesan Cheese', category: 'Ingredient', subCategory: 'Dairy', department: 'Kitchen', quantity: 5, unit: 'kg', minStockLevel: 2, pricePerUnit: 18.0, lastUpdated: '2023-10-25', supplier: 'Local Dairy' },
  { id: 'i18', name: 'Bacon', category: 'Ingredient', subCategory: 'Meat', department: 'Kitchen', quantity: 8, unit: 'kg', minStockLevel: 3, pricePerUnit: 9.0, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  { id: 'i19', name: 'Heavy Cream', category: 'Ingredient', subCategory: 'Dairy', department: 'Kitchen', quantity: 10, unit: 'L', minStockLevel: 3, pricePerUnit: 4.5, lastUpdated: '2023-10-25', supplier: 'Local Dairy' },
  { id: 'i20', name: 'Mushrooms', category: 'Ingredient', subCategory: 'Produce', department: 'Kitchen', quantity: 6, unit: 'kg', minStockLevel: 2, pricePerUnit: 5.0, lastUpdated: '2023-10-25', supplier: 'FarmFresh' },
  // Bar Items
  { id: 'i21', name: 'Jose Cuervo Tequila', category: 'Ingredient', subCategory: 'Spirits - Tequila', department: 'Bar', quantity: 5, unit: 'bottles', minStockLevel: 2, pricePerUnit: 25.0, lastUpdated: '2023-10-25', supplier: 'BarSupply' },
  { id: 'i22', name: 'Grey Goose Vodka', category: 'Ingredient', subCategory: 'Spirits - Vodka', department: 'Bar', quantity: 8, unit: 'bottles', minStockLevel: 3, pricePerUnit: 35.0, lastUpdated: '2023-10-25', supplier: 'BarSupply' },
  { id: 'i23', name: 'Jameson Whiskey', category: 'Ingredient', subCategory: 'Spirits - Whiskey', department: 'Bar', quantity: 10, unit: 'bottles', minStockLevel: 4, pricePerUnit: 30.0, lastUpdated: '2023-10-25', supplier: 'BarSupply' },
  { id: 'i24', name: 'Tanqueray Gin', category: 'Ingredient', subCategory: 'Spirits - Gin', department: 'Bar', quantity: 6, unit: 'bottles', minStockLevel: 2, pricePerUnit: 28.0, lastUpdated: '2023-10-25', supplier: 'BarSupply' },
  { id: 'i25', name: 'Bacardi Rum', category: 'Ingredient', subCategory: 'Spirits - Rum', department: 'Bar', quantity: 12, unit: 'bottles', minStockLevel: 5, pricePerUnit: 22.0, lastUpdated: '2023-10-25', supplier: 'BarSupply' },
  // Keep existing non-ingredients
  { id: '5', name: 'Chef Knife', category: 'Utensil', subCategory: 'Knives', department: 'Kitchen', quantity: 8, unit: 'pcs', minStockLevel: 10, pricePerUnit: 45.0, lastUpdated: '2023-09-15', supplier: 'KitchenPro', totalOwned: 10, brokenQuantity: 2 },
  { id: '6', name: 'Mixing Bowl (L)', category: 'Utensil', subCategory: 'Prep Tools', department: 'Kitchen', quantity: 15, unit: 'pcs', minStockLevel: 10, pricePerUnit: 12.0, lastUpdated: '2023-09-15', supplier: 'KitchenPro' },
  { id: '7', name: 'Stand Mixer', category: 'Equipment', subCategory: 'Appliances', department: 'Kitchen', quantity: 3, unit: 'pcs', minStockLevel: 3, pricePerUnit: 350.0, lastUpdated: '2023-01-10', supplier: 'TechChef', totalOwned: 3, brokenQuantity: 0 },
  { id: '8', name: 'Dinner Plate (10")', category: 'Crockery', subCategory: 'Plates', department: 'Restaurant', quantity: 42, unit: 'pcs', minStockLevel: 40, pricePerUnit: 8.5, lastUpdated: '2023-09-01', supplier: 'RestoSupply', totalOwned: 50, brokenQuantity: 8 },
  { id: '9', name: 'Soup Bowl', category: 'Crockery', subCategory: 'Bowls', department: 'Restaurant', quantity: 28, unit: 'pcs', minStockLevel: 30, pricePerUnit: 6.0, lastUpdated: '2023-09-01', supplier: 'RestoSupply', totalOwned: 30, brokenQuantity: 2 },
  { id: '10', name: 'Wine Glass', category: 'Crockery', subCategory: 'Glassware', department: 'Bar', quantity: 35, unit: 'pcs', minStockLevel: 40, pricePerUnit: 4.5, lastUpdated: '2023-09-10', supplier: 'GlassMasters', totalOwned: 48, brokenQuantity: 13 },
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
    ingredients: [ { inventoryItemId: 'i1', quantity: 6, unit: 'kg' }, { inventoryItemId: 'i2', quantity: 0.5, unit: 'L' }, { inventoryItemId: 'i15', quantity: 0.1, unit: 'kg' } ]
  },
  {
    id: 'b2', name: 'Tomato Sauce Batch', description: 'Base tomato sauce for pizza and pasta', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 20, yieldUnit: 'L', calories: 8000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i5', quantity: 18, unit: 'L' }, { inventoryItemId: 'i2', quantity: 1, unit: 'L' }, { inventoryItemId: 'i10', quantity: 0.5, unit: 'kg' }, { inventoryItemId: 'i9', quantity: 2, unit: 'kg' } ]
  },
  {
    id: 'b3', name: 'Bolognese Sauce Batch', description: 'Rich meat sauce', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 15, yieldUnit: 'L', calories: 15000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i8', quantity: 5, unit: 'kg' }, { inventoryItemId: 'i5', quantity: 8, unit: 'L' }, { inventoryItemId: 'i9', quantity: 1, unit: 'kg' }, { inventoryItemId: 'i10', quantity: 0.2, unit: 'kg' } ]
  },
  {
    id: 'b4', name: 'Carbonara Sauce Batch', description: 'Creamy bacon sauce', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 5, yieldUnit: 'L', calories: 12000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i19', quantity: 3, unit: 'L' }, { inventoryItemId: 'i18', quantity: 1, unit: 'kg' }, { inventoryItemId: 'i17', quantity: 0.5, unit: 'kg' }, { inventoryItemId: 'i12', quantity: 10, unit: 'pcs' } ]
  },
  {
    id: 'b5', name: 'Mushroom Soup Batch', description: 'Creamy mushroom soup', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 10, yieldUnit: 'L', calories: 6000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i20', quantity: 3, unit: 'kg' }, { inventoryItemId: 'i19', quantity: 2, unit: 'L' }, { inventoryItemId: 'i9', quantity: 1, unit: 'kg' }, { inventoryItemId: 'i13', quantity: 0.5, unit: 'kg' } ]
  },
  {
    id: 'b6', name: 'Garlic Butter Batch', description: 'Butter mixed with garlic and herbs', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 2, yieldUnit: 'kg', calories: 14000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i13', quantity: 1.8, unit: 'kg' }, { inventoryItemId: 'i10', quantity: 0.2, unit: 'kg' } ]
  },
  {
    id: 'b7', name: 'Chicken Marinade Batch', description: 'Herb and oil marinade for chicken', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 5, yieldUnit: 'L', calories: 40000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i2', quantity: 4, unit: 'L' }, { inventoryItemId: 'i10', quantity: 0.5, unit: 'kg' }, { inventoryItemId: 'i15', quantity: 0.2, unit: 'kg' } ]
  },
  {
    id: 'b8', name: 'Pasta Dough Batch', description: 'Fresh pasta dough', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 5, yieldUnit: 'kg', calories: 15000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 3.5, unit: 'kg' }, { inventoryItemId: 'i12', quantity: 30, unit: 'pcs' }, { inventoryItemId: 'i2', quantity: 0.1, unit: 'L' } ]
  },
  {
    id: 'b9', name: 'Bechamel Sauce Batch', description: 'White sauce for lasagna', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 8, yieldUnit: 'L', calories: 9000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i3', quantity: 6, unit: 'L' }, { inventoryItemId: 'i13', quantity: 0.8, unit: 'kg' }, { inventoryItemId: 'i1', quantity: 0.8, unit: 'kg' } ]
  },
  {
    id: 'b10', name: 'Pancake Batter Batch', description: 'Breakfast pancake batter', type: 'recipe', category: 'Food', sellingPrice: 0,
    yieldAmount: 10, yieldUnit: 'L', calories: 18000, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 4, unit: 'kg' }, { inventoryItemId: 'i3', quantity: 5, unit: 'L' }, { inventoryItemId: 'i12', quantity: 20, unit: 'pcs' }, { inventoryItemId: 'i14', quantity: 0.5, unit: 'kg' } ]
  },

  // 10 Menu Items (type: 'menu_item')
  {
    id: 'm1', name: 'Margherita Pizza', description: 'Classic cheese and tomato pizza with fresh basil', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 12.50, calories: 800, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 0.25, unit: 'kg' }, { inventoryItemId: 'i5', quantity: 0.1, unit: 'L' }, { inventoryItemId: 'i6', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i4', quantity: 0.01, unit: 'kg' } ]
  },
  {
    id: 'm2', name: 'Spaghetti Bolognese', description: 'Classic Italian meat sauce with spaghetti', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 14.00, calories: 950, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i8', quantity: 0.2, unit: 'kg' }, { inventoryItemId: 'i5', quantity: 0.25, unit: 'L' }, { inventoryItemId: 'i17', quantity: 0.02, unit: 'kg' } ]
  },
  {
    id: 'm3', name: 'Chicken Alfredo', description: 'Creamy pasta with grilled chicken', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 16.50, calories: 1100, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i7', quantity: 0.2, unit: 'kg' }, { inventoryItemId: 'i19', quantity: 0.1, unit: 'L' }, { inventoryItemId: 'i17', quantity: 0.03, unit: 'kg' } ]
  },
  {
    id: 'm4', name: 'Mushroom Risotto', description: 'Creamy arborio rice with wild mushrooms', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 15.00, calories: 750, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i20', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i19', quantity: 0.05, unit: 'L' }, { inventoryItemId: 'i17', quantity: 0.04, unit: 'kg' }, { inventoryItemId: 'i9', quantity: 0.05, unit: 'kg' } ]
  },
  {
    id: 'm5', name: 'Spaghetti Carbonara', description: 'Pasta with bacon, egg, and cheese sauce', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 14.50, calories: 1050, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i18', quantity: 0.1, unit: 'kg' }, { inventoryItemId: 'i19', quantity: 0.05, unit: 'L' }, { inventoryItemId: 'i17', quantity: 0.03, unit: 'kg' }, { inventoryItemId: 'i12', quantity: 1, unit: 'pcs' } ]
  },
  {
    id: 'm6', name: 'Garlic Bread', description: 'Toasted bread with garlic butter', type: 'menu_item', category: 'Food', subCategory: 'Starters', sellingPrice: 5.50, calories: 450, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 0.1, unit: 'kg' }, { inventoryItemId: 'i13', quantity: 0.05, unit: 'kg' }, { inventoryItemId: 'i10', quantity: 0.01, unit: 'kg' } ]
  },
  {
    id: 'm7', name: 'Creamy Mushroom Soup', description: 'Bowl of rich mushroom soup', type: 'menu_item', category: 'Food', subCategory: 'Starters', sellingPrice: 7.00, calories: 350, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i20', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i19', quantity: 0.05, unit: 'L' }, { inventoryItemId: 'i9', quantity: 0.05, unit: 'kg' } ]
  },
  {
    id: 'm8', name: 'Pancakes with Syrup', description: 'Stack of 3 fluffy pancakes', type: 'menu_item', category: 'Food', subCategory: 'Desserts', sellingPrice: 9.00, calories: 600, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i1', quantity: 0.1, unit: 'kg' }, { inventoryItemId: 'i3', quantity: 0.1, unit: 'L' }, { inventoryItemId: 'i12', quantity: 2, unit: 'pcs' }, { inventoryItemId: 'i14', quantity: 0.05, unit: 'kg' } ]
  },
  {
    id: 'm9', name: 'Grilled Chicken Salad', description: 'Fresh salad with marinated chicken', type: 'menu_item', category: 'Food', subCategory: 'Starters', sellingPrice: 13.50, calories: 550, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i7', quantity: 0.2, unit: 'kg' }, { inventoryItemId: 'i2', quantity: 0.02, unit: 'L' }, { inventoryItemId: 'i4', quantity: 0.02, unit: 'kg' } ]
  },
  {
    id: 'm10', name: 'Lasagna', description: 'Layered pasta with meat and cheese sauce', type: 'menu_item', category: 'Food', subCategory: 'Mains', sellingPrice: 16.00, calories: 850, lastUpdated: '2023-10-28',
    ingredients: [ { inventoryItemId: 'i11', quantity: 0.1, unit: 'kg' }, { inventoryItemId: 'i8', quantity: 0.15, unit: 'kg' }, { inventoryItemId: 'i5', quantity: 0.1, unit: 'L' }, { inventoryItemId: 'i6', quantity: 0.1, unit: 'kg' }, { inventoryItemId: 'i3', quantity: 0.1, unit: 'L' } ]
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

type View = 'dashboard' | 'inventory' | 'stocktake' | 'invoices' | 'recipes' | 'sales' | 'suppliers' | 'settings' | 'training' | 'orders' | 'pos' | 'reports' | 'waste' | 'expenses';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [editRecipeId, setEditRecipeId] = useState<string | null>(null);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<InventoryItem[]>(() => INITIAL_ITEMS.map(item => ({ ...item, vatCode: 'STANDARD_20', vatRate: 20 })));
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [recipes, setRecipes] = useState<Recipe[]>(() => INITIAL_RECIPES.map(recipe => ({ ...recipe, vatCode: 'STANDARD_20', vatRate: 20 })));
  const [stockHistory, setStockHistory] = useState<StockCountRecord[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesImportRecord[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [posOrders, setPosOrders] = useState<POSOrder[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Helper for safe Firestore access
  const safeFirestoreSet = async (collectionPath: string, docId: string, data: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/${collectionPath}`, docId), cleanObject(data));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/${collectionPath}/${docId}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Successfully logged in!");
    } catch (e: any) {
      console.error("Login failed:", e);
      if (e.code === 'auth/network-request-failed') {
        toast.error("Login failed: Network error. Please check your internet connection or disable ad-blockers.");
      } else if (e.code === 'auth/popup-blocked') {
        toast.error("Login failed: Popup blocked. Please allow popups for this site.");
      } else if (e.code === 'auth/unauthorized-domain') {
        toast.error("Login failed: Unauthorized domain. Please check your Firebase configuration.");
      } else {
        toast.error(`Login failed: ${e.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
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
    // Sync dark mode to Firestore
    if (user) {
      updateDoc(doc(db, `users/${user.uid}`), cleanObject({ isDarkMode })).catch(() => {});
    }
  }, [isDarkMode, user]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Migration and Data Fetching
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const userId = user.uid;

    // Check for migration
    const migrateData = async () => {
      const savedItems = localStorage.getItem('inventory_items');
      const savedRecipes = localStorage.getItem('menu_recipes');
      
      if (savedItems || savedRecipes) {
        setIsMigrating(true);
        try {
          if (savedItems) {
            const items = JSON.parse(savedItems);
            for (const item of items) {
              await setDoc(doc(db, `users/${userId}/inventory`, item.id), cleanObject(item));
            }
          }
          if (savedRecipes) {
            const recipes = JSON.parse(savedRecipes);
            for (const recipe of recipes) {
              await setDoc(doc(db, `users/${userId}/recipes`, recipe.id), cleanObject(recipe));
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
    const unsubInventory = onSnapshot(collection(db, `users/${userId}/inventory`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as InventoryItem);
      if (data.length > 0) setItems(data);
      else if (!isMigrating) setItems(INITIAL_ITEMS);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/inventory`));

    const unsubRecipes = onSnapshot(collection(db, `users/${userId}/recipes`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as Recipe);
      if (data.length > 0) setRecipes(data);
      else if (!isMigrating) setRecipes(INITIAL_RECIPES);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/recipes`));

    const unsubMenuCategories = onSnapshot(collection(db, `users/${userId}/menuCategories`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MenuCategory));
      setMenuCategories(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/menuCategories`));

    const unsubSuppliers = onSnapshot(collection(db, `users/${userId}/suppliers`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as Supplier);
      setSuppliers(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/suppliers`));

    const unsubStockHistory = onSnapshot(collection(db, `users/${userId}/stockCounts`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as StockCountRecord);
      setStockHistory(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/stockCounts`));

    const unsubSalesHistory = onSnapshot(collection(db, `users/${userId}/salesImports`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as SalesImportRecord);
      setSalesHistory(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/salesImports`));

    const unsubPosOrders = onSnapshot(collection(db, `users/${userId}/posOrders`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as POSOrder));
      setPosOrders(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/posOrders`));

    const unsubWaste = onSnapshot(collection(db, `users/${userId}/waste`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as WasteRecord);
      setWasteRecords(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/waste`));

    const unsubExpenses = onSnapshot(collection(db, `users/${userId}/expenses`), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => doc.data() as ExpenseRecord);
      setExpenseRecords(data);
    }, (err: any) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/expenses`));

    const unsubUser = onSnapshot(doc(db, `users/${userId}`), (snapshot: any) => {
      const data = snapshot.data();
      if (data) {
        if (data.isDarkMode !== undefined) setIsDarkMode(data.isDarkMode);
        if (user.email === 'saga00@gmail.com' && data.role !== 'admin') {
          updateDoc(doc(db, `users/${userId}`), { role: 'admin' }).catch(console.error);
        }
      } else {
        setDoc(doc(db, `users/${userId}`), cleanObject({
          uid: userId,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          isDarkMode: false,
          role: user.email === 'saga00@gmail.com' ? 'admin' : 'user'
        })).catch((err: any) => handleFirestoreError(err, OperationType.WRITE, `users/${userId}`));
      }
    }, (err: any) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));

    return () => {
      unsubInventory();
      unsubRecipes();
      unsubSuppliers();
      unsubStockHistory();
      unsubSalesHistory();
      unsubPosOrders();
      unsubWaste();
      unsubExpenses();
      unsubMenuCategories();
      unsubUser();
    };
  }, [isAuthReady, user]);

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

  const handleUpdateStock = (updates: {id: string, quantity: number}[]) => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    setItems(prev => {
      const updated = prev.map(item => {
        const update = updates.find(u => u.id === item.id);
        if (update) {
          const updatedItem = { ...item, quantity: update.quantity, lastUpdated: timestamp };
          safeFirestoreSet('inventory', item.id, updatedItem);
          return updatedItem;
        }
        return item;
      });
      return updated;
    });

    setRecipes(prev => {
      const updated = prev.map(recipe => {
        const update = updates.find(u => u.id === `recipe-${recipe.id}`);
        if (update) {
          const updatedRecipe = { ...recipe, quantity: update.quantity, lastUpdated: timestamp };
          safeFirestoreSet('recipes', recipe.id, updatedRecipe);
          return updatedRecipe;
        }
        return recipe;
      });
      return updated;
    });
  };

  const handleSalesDeduction = (deductions: { inventoryItemId: string; quantity: number }[], revenue: number) => {
    setTotalRevenue(prev => {
      const newRevenue = prev + revenue;
      if (user) updateDoc(doc(db, `users/${user.uid}`), cleanObject({ totalRevenue: newRevenue })).catch(() => {});
      return newRevenue;
    });

    // Handle standard inventory items
    setItems(prev => {
      const updated = prev.map(item => {
        const itemDeductions = deductions.filter(d => d.inventoryItemId === item.id);
        if (itemDeductions.length > 0) {
          const totalDeductionQuantity = itemDeductions.reduce((sum, d) => sum + d.quantity, 0);
          const newQuantity = Math.max(0, item.quantity - totalDeductionQuantity);
          const currentRate = item.dailyUsageRate || 0;
          const newRate = (currentRate * 0.7) + (totalDeductionQuantity * 0.3);

          const updatedItem = { 
            ...item, 
            quantity: newQuantity,
            dailyUsageRate: parseFloat(newRate.toFixed(2)),
            lastUpdated: new Date().toISOString().split('T')[0] 
          };
          safeFirestoreSet('inventory', item.id, updatedItem);
          return updatedItem;
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
          const newQuantity = Math.max(0, (recipe.quantity || 0) - totalDeductionQuantity);
          const updatedRecipe: Recipe = { 
            ...recipe, 
            quantity: newQuantity,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          safeFirestoreSet('recipes', recipe.id, updatedRecipe);
          return updatedRecipe;
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
    const timestamp = Date.now();
    const convertedItems: InventoryItem[] = invoice.items.map((item: any, idx: number) => ({
      id: `inv-${timestamp}-${idx}`,
      name: item.name,
      category: 'Ingredient',
      department: 'Kitchen',
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      pricePerUnit: item.price ? (item.price / item.quantity) : 0,
      minStockLevel: 5,
      lastUpdated: new Date().toISOString().split('T')[0],
      supplier: invoice.vendor || 'Unknown'
    }));

    setItems(prev => [...prev, ...convertedItems]);
    convertedItems.forEach(item => safeFirestoreSet('inventory', item.id, item));
    
    setInvoices(prev => [invoice, ...prev]);
    safeFirestoreSet('invoices', invoice.id, invoice);
    
    toast.success(`Successfully added ${convertedItems.length} items from invoice.`);
    setCurrentView('inventory');
  };

  const handleSaveItem = (itemData: any) => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (editingItem) {
      if (editingItem.id.startsWith('recipe-')) {
        const recipeId = editingItem.id.replace('recipe-', '');
        setRecipes(prev => {
          const updated = prev.map(r => 
            r.id === recipeId 
              ? { ...r, quantity: itemData.quantity, lastUpdated: timestamp } 
              : r
          );
          const updatedRecipe = updated.find(r => r.id === recipeId);
          if (updatedRecipe) safeFirestoreSet('recipes', recipeId, updatedRecipe);
          return updated;
        });
      } else {
        // Update existing item
        const updatedItem = { ...editingItem, ...itemData, lastUpdated: timestamp };
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
      setItems(prev => [...prev, newItem]);
      safeFirestoreSet('inventory', newItem.id, newItem);
    }
    
    setIsAddItemModalOpen(false);
    setEditingItem(undefined);
  };

  const handleEditRecipeFromReport = (id: string) => {
    setEditRecipeId(id);
    setCurrentView('recipes');
  };

  const handleSaveRecipe = (recipe: Recipe) => {
    setRecipes(prev => {
      const exists = prev.find(r => r.id === recipe.id);
      if (exists) {
        return prev.map(r => r.id === recipe.id ? recipe : r);
      } else {
        return [...prev, recipe];
      }
    });
    safeFirestoreSet('recipes', recipe.id, recipe);
  };

  const handleDeleteRecipe = async (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Recipe',
      message: 'Are you sure you want to delete this recipe? This action cannot be undone and will remove all associated training data.',
      variant: 'danger',
      onConfirm: async () => {
        setRecipes(prev => prev.filter(r => r.id !== id));
        if (user) {
          try {
            await deleteDoc(doc(db, `users/${user.uid}/recipes`, id));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/recipes/${id}`);
          }
        }
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveSupplier = (supplier: Supplier) => {
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
    safeFirestoreSet('suppliers', supplier.id, supplier);
  };

  const handleDeleteSupplier = async (id: string) => {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      if (user) {
        try {
          await deleteDoc(doc(db, `users/${user.uid}/suppliers`, id));
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/suppliers/${id}`);
        }
      }
  };

  const handleSaveMapping = (itemName: string, recipeId: string) => {
    const newMappings = { ...itemRecipeMappings, [itemName]: recipeId };
    setItemRecipeMappings(newMappings);
    // Mappings could be stored in user profile or a separate doc
    if (user) {
      updateDoc(doc(db, `users/${user.uid}`), cleanObject({ itemRecipeMappings: newMappings })).catch(() => {});
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

  const handlePlaceOrder = (supplier: string, items: OrderItem[]) => {
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      supplier,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0),
      status: 'Draft'
    };
    setOrders(prev => [newOrder, ...prev]);
    safeFirestoreSet('orders', newOrder.id, newOrder);
    setCart(prev => prev.filter(item => item.supplier !== supplier));
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!user) return;
    const userId = user.uid;
    try {
      const deletePromises = ids.map(id => deleteDoc(doc(db, `users/${userId}/inventory`, id)));
      await Promise.all(deletePromises);
      toast.success(`Successfully deleted ${ids.length} items`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `users/${userId}/inventory/bulk`);
    }
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<InventoryItem>) => {
    if (!user) return;
    const userId = user.uid;
    try {
      const updatePromises = ids.map(id => updateDoc(doc(db, `users/${userId}/inventory`, id), cleanObject(updates)));
      await Promise.all(updatePromises);
      toast.success(`Successfully updated ${ids.length} items`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userId}/inventory/bulk`);
    }
  };

  const handleSaveWaste = (record: WasteRecord) => {
    setWasteRecords(prev => [record, ...prev]);
    safeFirestoreSet('waste', record.id, record);
    
    // Deduct from inventory
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === record.inventoryItemId) {
          const updatedItem = { ...item, quantity: Math.max(0, item.quantity - record.quantity), lastUpdated: new Date().toISOString() };
          safeFirestoreSet('inventory', item.id, updatedItem);
          return updatedItem;
        }
        return item;
      });
      return updated;
    });
  };

  const handleDeleteWaste = async (id: string) => {
    setWasteRecords(prev => prev.filter(r => r.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/waste`, id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/waste/${id}`);
      }
    }
  };

  const handleSaveExpense = (record: ExpenseRecord) => {
    setExpenseRecords(prev => [record, ...prev]);
    safeFirestoreSet('expenses', record.id, record);
  };

  const handleDeleteExpense = async (id: string) => {
    setExpenseRecords(prev => prev.filter(r => r.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/expenses`, id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/expenses/${id}`);
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
      onClick={() => { setCurrentView(view); setIsSidebarOpen(false); }}
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
        const totalCost = calculateTotalCost(r.ingredients, items);
        const costPerUnit = r.yieldAmount && r.yieldAmount > 0 ? totalCost / r.yieldAmount : totalCost;
        
        return {
          id: `recipe-${r.id}`,
          name: r.name || 'Unnamed Recipe',
          category: (r.category === 'Food' || r.category === 'Prep') ? 'Prep' : 'Batch',
          quantity: r.quantity || 0,
          unit: (r.yieldUnit as Unit) || 'portions',
          minStockLevel: 0,
          pricePerUnit: costPerUnit, // Using COGS as pricePerUnit for batches/preps
          retailPrice: r.sellingPrice || 0,
          lastUpdated: r.lastUpdated,
          imageUrl: r.imageUrl,
          vatCode: r.vatCode,
          vatRate: r.vatRate
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
              src="https://picsum.photos/seed/backbone/200/200" 
              alt="Backbone Hub Logo" 
              className="w-20 h-20 rounded-2xl shadow-sm"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold text-text-navy mb-2">Welcome to Backbone Hub</h1>
          <p className="text-text-muted mb-8">Please sign in to manage your inventory and recipes securely in the cloud.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-cta text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
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
      <div className={`h-screen flex flex-col md:flex-row overflow-hidden transition-colors duration-200 ${isDarkMode ? 'dark' : ''} bg-main-bg text-text-navy`}>
        {/* Mobile Header */}
        <div className={`md:hidden border-b px-4 py-3 flex items-center justify-between flex-shrink-0 z-30 transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-primary-surface border-border-grey'}`}>
          <div className="flex items-center">
            <img src="https://picsum.photos/seed/backbone/100/100" alt="Logo" className="h-8 w-8 rounded-lg" />
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
              <img src="https://picsum.photos/seed/backbone/100/100" alt="Logo" className="h-10 w-10 rounded-lg" />
              <div className="ml-3 flex flex-col leading-tight">
                <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-text-navy'}`}>Backbone Hub</span>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Backoffice</span>
              </div>
            </div>
            
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem view="inventory" icon={Package} label="Inventory" />
              <NavItem view="orders" icon={ShoppingCart} label="Orders" />
              <NavItem view="recipes" icon={ChefHat} label="Menu Recipes" />
              <NavItem view="training" icon={BookOpen} label="Training" />
              <NavItem view="sales" icon={TrendingUp} label="Sales Import" />
              <NavItem view="stocktake" icon={ClipboardCheck} label="Stock Count" />
              <NavItem view="waste" icon={Trash2} label="Waste Records" />
              <NavItem view="invoices" icon={FileInput} label="Invoices" />
              <NavItem view="expenses" icon={Receipt} label="Expenses" />
              <NavItem view="suppliers" icon={Truck} label="Suppliers" />
              <NavItem view="reports" icon={TrendingUp} label="Reports" />
              <NavItem view="pos" icon={Monitor} label="Backbone POS" />
            </nav>

            <div className={`p-4 border-t flex-shrink-0 transition-colors ${isDarkMode ? 'border-slate-800' : 'border-border-grey'}`}>
              <NavItem view="settings" icon={SettingsIcon} label="Settings" />
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
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Manager</p>
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
                  {currentView === 'reports' && 'Business Reports'}
                  {currentView === 'pos' && 'Backbone POS'}
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

            {currentView === 'dashboard' && <Dashboard items={combinedItems} salesHistory={salesHistory} totalRevenue={totalRevenue} setCurrentView={setCurrentView} onAddToCart={handleAddToCart} />}
            
            {currentView === 'inventory' && (
              <InventoryList 
                items={combinedItems} 
                onAddItem={openAddItemModal} 
                onEditItem={openEditItemModal}
                cart={cart}
                onAddToCart={handleAddToCart}
                onBulkDelete={handleBulkDelete}
                onBulkUpdate={handleBulkUpdate}
              />
            )}

            {currentView === 'orders' && (
              <Orders 
                cart={cart}
                orders={orders}
                suppliers={suppliers}
                inventoryItems={combinedItems}
                onPlaceOrder={handlePlaceOrder}
                onUpdateCart={handleAddToCart}
                onUpdateOrderStatus={(id, status) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))}
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
              />
            )}

            {currentView === 'training' && (
              <TrainingCenter recipes={recipes} inventoryItems={combinedItems} />
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
              />
            )}

            {currentView === 'waste' && (
              <WasteManager
                inventoryItems={combinedItems}
                wasteRecords={wasteRecords}
                onSaveWaste={handleSaveWaste}
                onDeleteWaste={handleDeleteWaste}
                isDarkMode={isDarkMode}
              />
            )}
            
            {currentView === 'invoices' && (
              <InvoiceProcessor 
                onProcessInvoice={handleAddFromInvoice} 
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

            {currentView === 'pos' && (
              <POSLayout 
                recipes={recipes} 
                inventoryItems={combinedItems} 
                menuCategories={menuCategories}
                onProcessSales={handleSalesDeduction}
              />
            )}

            {currentView === 'reports' && (
              <Reports 
                posOrders={posOrders}
                inventoryItems={combinedItems}
                suppliers={suppliers}
                invoices={invoices}
                orders={orders}
                recipes={recipes}
                onEditRecipe={handleEditRecipeFromReport}
                onEditInventoryItem={handleEditInventoryItemFromReport}
              />
            )}

            {currentView === 'settings' && (
              <Settings />
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
