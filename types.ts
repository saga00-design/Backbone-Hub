
export type InventoryCategory = string;
export type Unit = 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'box' | 'bottles';

export type VatCode = 'STANDARD_20' | 'REDUCED_5' | 'ZERO_0' | 'EXEMPT';

export const ALLERGIES_LIST = [
  'Celery', 'Gluten', 'Crustaceans', 'Eggs', 'Fish', 
  'Lupin', 'Milk', 'Molluscs', 'Mustard', 'Peanuts', 'Sesame', 
  'Soybeans', 'Sulphites', 'Tree nuts'
];

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  subCategory?: string;
  department?: string;
  quantity: number; // Currently available
  unit: Unit;
  minStockLevel: number;
  pricePerUnit: number;
  retailPrice?: number; // Added for retail items or recipes
  lastUpdated: string;
  imageUrl?: string;
  description?: string; // Added for training/upselling info
  expiryDate?: string; // YYYY-MM-DD
  supplier?: string;
  supplierContact?: string;
  dailyUsageRate?: number; // Estimated usage per day
  barcode?: string;
  allergies?: string[]; // Added for auto-detection
  
  // New fields for Crockery/Equipment tracking
  totalOwned?: number; // Total quantity owned (Par Stock)
  brokenQuantity?: number; // Quantity missing/broken
  vatCode?: VatCode;
  vatRate?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  quantity: number; // Quantity used in the recipe
  unit?: string; // The unit used in the recipe (e.g., kg, g, L, ml)
}

export type RecipeType = 'recipe' | 'menu_item';

export interface PairingInfo {
  name: string;
  nose?: string;
  palate?: string;
  finish?: string;
  aromas?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  path: string; // e.g., "Beverage > Tequilas"
  parentId?: string; // ID of parent category
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  type?: RecipeType;
  category?: string;
  subCategory?: string;
  menuPath?: string; // e.g., "Beverage > Tequilas > Blanco"
  imageUrl?: string;
  
  sellingPrice: number; // Price excluding VAT
  vatRate?: number; // Percentage, e.g., 20
  vatCode?: VatCode;
  serviceChargeRate?: number; // Percentage, e.g., 12.5
  
  yieldAmount?: number; // For batch recipes
  yieldUnit?: string; // e.g., 'portions', 'L', 'kg'
  quantity?: number; // Current stock quantity for batches/prep
  calories?: number; // Estimated calories
  station?: Station;
  course?: Course;
  trackAvailability?: boolean;
  availabilityCount?: number;

  allergies?: string[];
  allergyIngredients?: Record<string, string[]>;
  autoDetectAllergies?: boolean;

  winePairing?: PairingInfo;
  tequilaPairing?: PairingInfo;
  mezcalPairing?: PairingInfo;
  cocktailPairing?: PairingInfo;

  // Food pairings for beverages
  starterPairing?: PairingInfo;
  mainPairing?: PairingInfo;
  dessertPairing?: PairingInfo;

  trainingSteps?: { image: string, description: string }[];

  ingredients: RecipeIngredient[];
  lastUpdated: string;
  sustainabilityScore?: number; // 1-100
  carbonFootprint?: string; // e.g., "Low", "Medium", "High" or specific value
  sustainabilityTips?: string[];
}

export interface StockCount {
  id: string;
  date: string;
  type: 'Daily' | 'Weekly' | 'Monthly';
  items: StockCountItem[];
  status: 'Draft' | 'Completed';
}

export interface StockCountItem {
  itemId: string;
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number | '';
  discrepancy: number;
  unit: Unit;
  expectedValue: number;
  actualValue: number;
  varianceValue: number;
}

export interface StockCountRecord {
  id: string;
  date: string;
  aiAnalysis: string;
  items: {
      name: string;
      expected: number;
      actual: number;
      variance: number;
      unit: string;
      expectedValue: number;
      actualValue: number;
      varianceValue: number;
  }[];
}

export interface Invoice {
  id: string;
  date: string;
  vendor: string;
  supplierId?: string;
  items: InvoiceItem[];
  totalAmount: number;
  status: 'Pending' | 'Processed';
  paymentStatus: 'Paid' | 'Unpaid';
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unit: Unit;
  price: number;
}

export interface AiInsight {
  type: 'reorder' | 'expiry' | 'slow_moving' | 'anomaly';
  item: string;
  message: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SalesImportRecord {
  id: string;
  date: string;
  fileName: string;
  totalSales: number;
  kitchenSales: number; // Food category
  barSales: number; // Beverage category
  itemsCount: number;
  matchedCount: number;
  ingredientsAffected: number;
}

export interface OrderItem {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unit: Unit;
  pricePerUnit: number;
  supplier?: string;
  category: InventoryCategory;
}

export interface Order {
  id: string;
  date: string;
  supplier: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
}

export type TableStatus = 'Available' | 'Seated' | 'Ordered' | 'Served' | 'Paid';
export type TableShape = 'Round' | 'Square' | 'Rectangle' | 'Booth';
export type OrderStatus = 'Open' | 'Paid' | 'Cancelled' | 'Refunded';
export type OrderItemStatus = 'Pending' | 'In Progress' | 'Ready' | 'Served' | 'Void';
export type Station = 'Bar' | 'Grill' | 'Cold' | 'Dessert';
export type Course = '1st Course' | '2nd Course' | '3rd Course' | '4th Course' | '5th Course' | 'Drinks' | 'Starters' | 'Mains' | 'Desserts' | 'Sides';

export interface Table {
  id: string;
  number: string;
  capacity: number;
  x: number;
  y: number;
  width?: number; // in grid units
  height?: number; // in grid units
  shape?: TableShape;
  status: TableStatus;
  currentOrderId?: string;
  waiterId?: string;
  seatedAt?: string;
  lastActionAt?: string;
  zone?: string; // Added zone field
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  inventoryItemId?: string;
  quantity?: number;
}

export interface POSOrderItem {
  id: string;
  recipeId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: Modifier[];
  vatCode?: VatCode;
  vatRate?: number;
  notes?: string;
  allergies?: string[];
  discount?: number; // Discount amount applied to this item
  discountReason?: string;
  isVoided?: boolean;
  voidReason?: string;
  status: OrderItemStatus;
  station: Station;
  course: Course;
  firedAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface POSOrder {
  id: string;
  tableId?: string; // undefined for takeaway
  tableNumber?: string;
  customerName?: string;
  type: 'Dine-In' | 'Takeaway' | 'Delivery';
  platform?: string; // e.g. UberEats, Deliveroo, Direct
  status: OrderStatus;
  items: POSOrderItem[];
  subtotal: number;
  vat: number;
  serviceCharge: number;
  total: number;
  tips: number;
  waiterId: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  payments: Payment[];
}

export interface Payment {
  id: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Contactless';
  timestamp: string;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Staff' | 'Waiter' | 'Chef';
  permissions: string[];
  pin: string; // 4 digits
  hourlyRate: number;
  trainingProgress: Record<string, number>; // category -> level (0-100)
  active: boolean;
  isClockedIn: boolean;
  lastClockIn?: string; // ISO date
  performanceMetrics?: {
    averageTicketValue: number;
    upsellRate: number;
  };
}

export interface WasteRecord {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unit: Unit;
  reason: string;
  cost: number;
  date: string;
  staffId: string;
  staffName?: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  vatAmount?: number;
  description: string;
  vendor: string;
  receiptImageUrl?: string;
  paymentMethod: string;
  staffId: string;
  staffName?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}
