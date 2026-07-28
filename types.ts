
export type InventoryCategory = string;
export type InventoryType = string;
export type Unit = 'kg' | 'g' | 'gr' | 'L' | 'ml' | 'cl' | 'pcs' | 'box' | 'bottles' | 'bags' | 'portions' | 'cans' | 'kegs' | 'servings' | 'cases' | 'packs' | 'tray' | 'vacuum pack' | 'sack' | 'tin' | 'jar' | 'tub' | 'sachet' | 'loose' | 'custom';
export type MovementType = 'RECEIPT' | 'SALE' | 'WASTE' | 'ADJUSTMENT' | 'PRODUCTION' | 'TRANSFER' | 'STOCKTAKE';

export interface StockMovement {
  id: string;
  productId: string; // inventoryItemId or recipe-recipeId
  type: MovementType;
  quantityChange: number; // in base units
  stockBefore: number;
  stockAfter: number;
  costImpact?: number;
  referenceId?: string; // orderId, invoiceId, wasteId, etc.
  referenceType?: 'SALE' | 'RECEIPT' | 'WASTE' | 'ADJUSTMENT' | 'PRODUCTION';
  createdAt: string;
  createdBy: string;
  notes?: string;
}

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
  inventoryType: InventoryType; // LIQUID, SOLID, or UNIT
  baseUnit: Unit; // ml, g, or pcs
  quantity: number; // Current stock in BASE UNITS (ml, g, pcs)
  unitSize: number; // Size of a single pack in base units
  unit: Unit; // Unit of the unitSize (L, kg, etc.)
  packaging?: string; // e.g. bottle, box, pack
  caseSize?: number; // Number of packs per case/box/sack, if this item is also bought by the case
  casePackaging?: string; // e.g. case, box, sack
  minStockLevel: number;
  pricePerUnit: number; // Cost per BASE UNIT
  averageCostBase?: number; // Weighted average cost per base unit
  retailPrice?: number;
  lastUpdated: string;
  imageUrl?: string;
  description?: string;
  expiryDate?: string;
  supplier?: string;
  supplierContact?: string;
  dailyUsageRate?: number;
  barcode?: string;
  allergies?: string[];
  totalOwned?: number;
  brokenQuantity?: number;
  vatCode?: VatCode;
  vatRate?: number;
  yieldFactor?: number; // 0 to 1 (e.g. 0.8 for 80% usable product)
  priceHistory?: { date: string; price: number }[];
  storageLocation?: string;
  isActive: boolean;
}

export interface StockReceipt {
  id: string;
  productId: string;
  supplierId: string;
  qtyReceived: number; // Number of packs
  packSize: number; // Size per pack
  packUnit: Unit; // Unit of the pack (L, kg, etc.)
  totalBaseQty: number; // Calculated: qty * size converted to base
  unitCostNet: number; // Cost per pack
  totalCostNet: number;
  costPerBaseUnit: number;
  invoiceReference?: string;
  receivedAt: string;
  enteredBy: string;
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
  quantity: number; // Input quantity
  unit: Unit; // Input unit (L, kg, ml, g)
  baseQuantity: number; // Calculated quantity in base units (ml, g)
  costAtCreation?: number; // Snapshot of cost per base unit
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
  parentId: string | null; // ID of parent category, null for top-level
  order: number;
  isDrink: boolean;
  allowSubcategories: boolean;
  hidden?: boolean;
  locationId?: string;
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
  posId?: string; // PLU or Product ID from external POS
  posCategory?: string; // POS Category mapping
  posCategoryId?: string; // POS Category ID mapping
  marginTarget?: number; // Target GP% for this item
  
  yieldAmount?: number; // For batch recipes
  yieldUnit?: string; // e.g., 'portions', 'L', 'kg'
  quantity?: number; // Current stock quantity for batches/prep
  pricePerUnit?: number; // Cost per base unit for batches/prep
  calories?: number; // Estimated calories
  station?: Station;
  course?: Course;
  trackAvailability?: boolean;
  isActive?: boolean;
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

  trainingSteps?: { title?: string, image: string, description: string }[];
  quizResults?: { [userId: string]: { score: number, total: number, date: string, passed: boolean } };

  ingredients: RecipeIngredient[];
  lastUpdated: string;
  sustainabilityScore?: number; // 1-100
  carbonFootprint?: string; // e.g., "Low", "Medium", "High" or specific value
  sustainabilityTips?: string[];
  sides?: RecipeSide[];
  addons?: RecipeAddon[];

  // Event Menu Creator (Set Menus & Specials tab)
  isEventSpecial?: boolean; // true if created inline from an event menu's "Create New Dish"
  eventMenuId?: string; // the setMenus doc this dish was created for
}

export interface SetMenuCourseItem {
  recipeId: string;
  recipeName: string;
  cost: number; // NET in pence
  isNew: boolean; // true if created for this event only (via "Create New Dish")
  notes?: string;
  quantity: number; // always 1 per cover
}

export interface SetMenuCourse {
  id: string;
  name: string; // e.g. "Starter", "Main", "Dessert"
  items: SetMenuCourseItem[];
}

export interface SetMenu {
  id: string;
  name: string; // e.g. "Valentine's Day 2026"
  description: string;
  eventDate: string; // ISO date
  pricePerHead: number; // gross inc VAT in pence
  covers: number; // covers per booking, default 1
  courses: SetMenuCourse[];
  totalCost: number; // calculated NET in pence
  totalGP: number; // calculated percentage
  isActive: boolean;
  locationId: string;
  lastUpdated: string;
}

export interface RecipeSide {
  id: string;
  name: string;
  price: number;       // gross inc VAT in pence
  cost: number;        // (parentCostPerGram * weight)
  weight: number;
  unit: 'g' | 'ml' | 'portions';
  posMenuItemId?: string;
}

export interface RecipeAddon {
  id: string;
  name: string;
  price: number;       // gross inc VAT in pence
  cost: number;        // (parentCostPerGram * weight)
  weight: number;
  unit: 'g' | 'ml' | 'portions';
  posMenuItemId?: string;
}

export interface SideAddonItem {
  id: string;
  name: string;
  type: 'side' | 'addon';
  sourceType: 'batch' | 'raw_ingredient';
  sourceId: string;
  sourceName: string;
  weight: number;
  unit: 'g' | 'ml' | 'portions';
  price: number;        // gross inc VAT in pence
  cost: number;         // NET of VAT in pence
  vatRate: number;      // e.g. 20
  gp: number;           // percentage e.g. 74.5
  categoryId: string;   // 'cat_sides' or 'cat_addons'
  posMenuItemId?: string;
  locationId: string;
  isActive: boolean;
  lastUpdated: string;
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
      itemId?: string;
      name: string;
      expected: number;
      actual: number;
      variance: number;
      unit: string;
      expectedValue: number;
      actualValue: number;
      varianceValue: number;
      imageUrl?: string;
  }[];
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  date: string;
  vendor: string;
  supplierId?: string;
  orderId?: string; // Explicit link to the Stock Order this invoice is for — set during
                     // approval review, drives the three-way match against ReceivingRecords.
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

// One entry per processed invoice line, keyed by item AND supplier — the same ingredient
// bought from two different suppliers at different prices is never a "price change," it's
// two independent price histories. Written on every approval regardless of whether the price
// matched the prior entry or not, so this grows into a running per-supplier price log.
export interface SupplierPriceHistoryEntry {
  id: string;
  inventoryItemId: string;
  itemName: string;
  supplier: string;
  price: number; // per base unit, same convention as InventoryItem.pricePerUnit
  invoiceId: string;
  locationId: string;
  date: string; // invoice date
  createdAt: string;
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
  foodSales: number; // Food category
  beverageSales: number; // Beverage category
  nonFbSales: number; // Non-F&B category
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
  status: 'Draft' | 'Sent' | 'Partially Received' | 'Received' | 'Cancelled';
  ccEmails?: string[];
}

// Phase 1 — Receive Goods. One record per receiving session against a Sent Order: what was
// actually ticked off as arrived, in base units, per line — the sole source of truth for
// adding purchased stock (Invoice Processing no longer writes stock; it only reconciles
// against this record via orderId once an invoice is explicitly linked to its Order).
export interface ReceivingRecordItem {
  inventoryItemId: string;
  name: string;
  unit: Unit;
  unitSize?: number;
  orderedQuantity: number;  // base units, from the Order at time of receiving
  receivedQuantity: number; // base units, as ticked off on arrival
}

export interface ReceivingRecord {
  id: string;
  orderId: string;
  supplier: string;
  locationId: string;
  date: string; // business day, YYYY-MM-DD
  items: ReceivingRecordItem[];
  receivedBy: string;
  receivedByName: string;
  createdAt: string;
}

export type TableStatus = 'Available' | 'Seated' | 'Ordered' | 'Served' | 'Paid';
export type TableShape = 'Round' | 'Square' | 'Rectangle' | 'Booth';
export type OrderStatus = 'Open' | 'Sent' | 'Paid' | 'Cancelled' | 'Refunded';
export type OrderItemStatus = 'Pending' | 'In Progress' | 'Ready' | 'Served' | 'Void';
export type Station = 'Beverage' | 'Grill' | 'Cold' | 'Dessert' | 'Pizza' | 'Pasta' | 'Saute' | 'Fry' | 'Prep';
export type Course = '1st Course' | '2nd Course' | '3rd Course' | '4th Course' | '5th Course' | 'Drinks' | 'Starters' | 'Mains' | 'Desserts' | 'Sides';

export interface Table {
  id: string;
  name: string;
  zoneId: string;
  seats: number;
  active: boolean;
  locationId: string;
  status: string;
  createdAt: string;
  lastUpdated: string;
  // Optional POS fields for compatibility
  number?: string;
  capacity?: number;
  x?: number;
  y?: number;
  shape?: TableShape;
  currentOrderId?: string;
  waiterId?: string;
  seatedAt?: string;
  lastActionAt?: string;
  zone?: string;
}

export interface Modifier {
  id: string;
  locationId: string;
  name: string;
  price: number;
  inventoryItemId?: string;
  quantity?: number;
  category?: string;
  lastUpdated: string;
}

export interface StaffCertification {
  id: string;
  locationId: string;
  staffId: string;
  staffName: string;
  recipeId: string;
  recipeName: string;
  score: number;
  total: number;
  passed: boolean;
  completedAt: string;
}

export interface AuditLog {
  id: string;
  locationId: string;
  userId: string;
  userName: string;
  action: string;
  targetType: 'Inventory' | 'Recipe' | 'Modifier' | 'Settings' | 'Supplier' | 'Invoice' | 'Order' | 'WasteRecord' | 'ExpenseRecord' | 'Section';
  targetId: string;
  targetName: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
}

export interface POSOrderItem {
  id: string;
  itemId?: string;
  recipeId: string;
  name: string;
  price: number;
  priceGross?: number; // Price in cents
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
  isInventoryDepleted?: boolean;
  status: OrderItemStatus;
  station: Station;
  course: Course;
  firedAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface POSOrder {
  id: string;
  locationId: string;
  tableId?: string; // undefined for takeaway
  tableNumber?: string;
  customerName?: string;
  tableName?: string;
  waiterName?: string;
  type: 'Dine-In' | 'Takeaway' | 'Delivery';
  platform?: string; // e.g. UberEats, Deliveroo, Direct
  status: OrderStatus;
  items: POSOrderItem[];
  subtotal: number;
  net_total?: number;
  vat: number;
  serviceCharge: number;
  service_charge?: number;
  total: number;
  amount?: number;
  tips: number;
  waiterId: string;
  isInventoryDepleted?: boolean;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  payments: Payment[];
  financials?: {
    grossSales?: number;
    netSales?: number;
    vatTotal?: number;
    serviceChargeTotal?: number;
    discountTotal?: number;
    totalPaid?: number;
    paymentTimestamp?: string | any;
    zeroRatedSales?: number;
    exemptSales?: number;
  };
}

export interface Payment {
  id: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Contactless';
  timestamp: string;
}

export interface POSPayment extends Payment {
  orderId: string;
  locationId: string;
  performanceProcessed?: boolean;
  totalPaid?: number;
  amountPaid?: number;
  grossSales?: number;
  netSales?: number;
  vatTotal?: number;
  serviceChargeTotal?: number;
  discountTotal?: number;
  tips?: number;
  paymentMethod?: string;
}

export interface StaffPerformanceMetrics {
  totalSales: number;
  averageSpend: number;
  itemsPerOrder: number;
  drinksPerTable: number;
  cocktailsSold: number;
  premiumRatio: number;
  speedOrdersPerHour: number;
  tableTurnaroundTime: number;
  upsellingSuccessRate: number;
  complaintsCount: number;
  ticketTime: number;
  errorRate: number;
  wasteLogged: number;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: string;
  impactMetric: keyof StaffPerformanceMetrics;
  targetImprovement: number; // e.g. 10 for 10%
  points: number;
  estimatedTime: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  type: 'Training' | 'Performance' | 'Hybrid';
  requirement?: string;
}

export interface SalaryChange {
  date: string;
  rate: number;
  reason: string;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Waiter' | 'Chef' | 'Bartender';
  pin: string; // 4 digits
  active: boolean;
  locationId: string;
  department?: string;
  hourlyRate: number;
  salaryChanges?: SalaryChange[];

  permissions: AppPermissions;

  allowedStations: string[]; // ['food', 'beverage', 'non_fb']

  trainingSummary: {
    level: number;
    completedModules: number;
    totalModules: number;
    requiredOutstanding: number;
    lastUpdated: string | null;
  };

  certifications: string[];
  createdAt: string;
  lastUpdated: string;

  // Legacy / Hub Specific
  isClockedIn?: boolean;
  lastClockIn?: string;
  performanceMetrics?: StaffPerformanceMetrics;
  performanceScore?: number;
  managerRating?: number;
  scoreTrend?: 'up' | 'down' | 'stable';
  rank?: number;
  badges?: string[];
  completedModules?: string[];
  salaryHistory?: SalaryChange[];
  trainingProgress?: Record<string, number>;
}

export interface ClockInRecord {
  id: string;
  staffId: string;
  staffName: string;
  locationId: string;
  clockIn: string; // ISO string
  clockOut?: string; // ISO string
  hourlyRateAtTime: number;
  totalHours?: number;
  totalCost?: number;
  status: 'active' | 'completed' | 'verified';
  breakMinutes?: number;
}


export interface WasteRecord {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number; // in display unit
  baseQuantity: number; // in base unit
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

// Manual WEEK-based P&L cost entry (Operation Costs > P&L Cost Entry tab). One document per
// Monday-Sunday week (see utils/fiscalCalendar.ts). Rollup views (Period/Monthly/Quarterly)
// sum these weekly documents client-side rather than being stored separately. Deliberately
// excludes Restaurant/Deliveroo sales, COGS, and Wages — those are automated elsewhere (POS,
// recipe costing, Labour Import) and must not be re-entered here. NOT currently wired into
// services/pnlEngine.ts — this is data capture only; wiring it into the P&L waterfall is a
// separate follow-up task.
export interface WeeklyCostEntry {
  id: string; // `${locationId}-W${weekStartDate}`
  locationId: string;
  weekId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  lastUpdated: string;

  // Labour (partial — Wages is automated via Labour Import, excluded here)
  salaries: number;
  otherRota: number;
  bonuses: number;
  statutoryPaymentsAndPensions: number;
  uniforms: number;
  staffRecruitment: number;
  staffFood: number;
  staffWelfareAndTravel: number;

  // Cleaning costs
  cleaningProducts: number;
  tradeRefuse: number;
  contractCleaning: number;
  laundry: number;

  // Delivery costs
  takeAwayPackaging: number;
  deliverooCharges: number;

  // Disposables
  replacementEquipmentAndCrockery: number;
  menusFoodAndCocktail: number;
  stickersLabelsAndTillRolls: number;
  postageAndStationery: number;
  sauces: number;
  plantsAndDecoration: number;
  deliveryCharges: number;

  // Utilities
  telephoneItAndEpos: number;
  music: number;
  maintenanceContracts: number;
  repairsAndMaintenance: number;
  electricity: number;
  gas: number;
  water: number;

  // Admin
  centralSupportAdminAndVouchers: number;
  bankingDifferences: number;
  sundryCosts: number;

  // Variable costs
  advertisingAndPromotions: number;
  staffTraining: number;
  mysteryDiner: number;
  bankCharges: number;
  creditCardCharges: number;
  healthAndSafety: number;

  // Fixed costs
  rent: number;
  turnoverRent: number;
  serviceCharge: number;
  rates: number;
  insurance: number;
  legalAndProfessional: number;
  recruitmentFeesAndRMLarge: number;
}

// --- Shift Briefing & Performance ---

export type ShiftType = 'Lunch' | 'Dinner' | 'All Day';
export type BriefingItemType = 'Urgent Alert' | 'Special' | 'Recommendation' | 'Service Note';
export type UnavailableStatus = 'Active' | 'Low Stock' | 'Unavailable (86)';

export interface BriefingItem {
  id: string;
  type: BriefingItemType;
  title: string;
  content: string;
  price?: number;
  shift: ShiftType;
  roles: string[]; // ['waiter', 'bartender', 'chef', 'manager', 'all']
  startDate: string;
  endDate: string;
  isActive: boolean;
  priority: 'High' | 'Medium' | 'Low';
  reason?: string;
  createdBy: string;
  createdAt: string;
  locationId: string;
}

export interface UnavailableItem {
  id: string;
  menuItemId: string; // From recipes (menu_item)
  name: string;
  status: UnavailableStatus;
  reason?: string;
  expectedReturn?: string;
  quantityRemaining?: number;
  locationId: string;
  updatedAt: string;
}

export interface ShiftTarget {
  id: string;
  type: 'Item' | 'Revenue' | 'Behavior';
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit?: string; // e.g. 'margaritas', '£', 'desserts'
  targetItemId?: string; // ID of the recipe/item to track
  roles: string[];
  shift: ShiftType;
  status: 'Active' | 'Completed' | 'Expired';
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
  locationId: string;
}

export type ChallengeType = 'Product Push' | 'Sales Race' | 'Quality Challenge' | 'Team vs Team' | 'Upsell Warrior';

export interface ShiftChallenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  rules: {
    targetItemIds?: string[]; // IDs of items that give points
    pointsPerItem?: number;
    pointsPerUpsell?: number;
    pointsPerAvgSpend?: number;
    pointsPerFastService?: number;
    pointsPenaltyComplaint?: number;
    pointsPenaltyVoid?: number;
  };
  rewards: {
    description: string;
    value?: string;
    type: 'Bonus' | 'Perk' | 'Badge' | 'Priority';
  };
  startDate: string;
  endDate: string;
  shift: ShiftType;
  roles: string[];
  isActive: boolean;
  locationId: string;
  createdBy: string;
  createdAt: string;
}

export type ShiftBriefingType = 'Urgent Alert' | 'Special' | 'Recommendation' | 'Service Note'; // Alias for BriefingItemType if needed

export interface StaffShiftPerformance {
  id: string; // staffId_date_shift
  staffId: string;
  staffName: string;
  shiftDate: string; // was date
  shift: ShiftType;
  points: number;
  salesCount: number; // was sales
  totalRevenue: number; // added
  upsellCount: number; // added
  itemsSold: Record<string, number>; // itemId -> count
  complaints: number;
  voids: number;
  avgSpend: number;
  rank: number;
  lastUpdated: string;
  locationId: string;
}

export enum ClosureType {
  DAY = 'day',
  SHIFT = 'shift'
}

export interface DailyClosure {
  id: string;
  locationId: string;
  type: ClosureType;
  date: string;
  shiftName?: string;
  periodStart: string;
  periodEnd: string;
  closedBy: {
    staffId: string;
    name: string;
  };
  totals: {
    grossSales: number;
    netSales: number;
    vat: {
      collected: number;
      payable: number;
    };
    serviceCharge: {
      collected: number;
      pending: number;
    };
    cogs: number;
    labour: number;
    expenses: number;
    profitBeforeVAT: number;
    vatLiability: number;
    realProfitAfterVAT: number;
    
    vatTotal: number; // legacy compatibility
    serviceChargeTotal: number; // legacy compatibility
    discountTotal: number;
    totalPaid: number;
    orderCount: number;
    profit: number; // legacy compatibility
    tips: number;
    averageOrderValue: number;
    salesByCategory?: Record<string, number>;
    cogsByCategory?: Record<string, number>;
  };
  insights?: {
    lowMarginItems: { name: string; margin: number; volume: number }[];
    topItems: { name: string; revenue: number; profit: number }[];
    topStaff: { name: string; metric: string; value: string }[];
    slowHours: { hour: string; revenue: number }[];
    discountAlerts: { staffName: string; ratio: number; amount: number }[];
    profitWarnings: string[];
  };
  actions?: {
    pricing: { itemName: string; currentMargin: number; currentPrice: number; suggestedPrice: number; suggestion: string }[];
    staffing: { hour: string; action: 'increase' | 'decrease'; suggestion: string }[];
    promotions: { hour: string; suggestion: string }[];
    riskAlerts: { type: string; message: string; severity: 'high' | 'medium' }[];
  };
  profitReport?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
  };
  vatReport?: {
    grossSales: number;
    netSales: number;
    vatTotal: number;
    serviceChargeGross: number;
    serviceChargeNet: number;
    serviceChargeVAT: number;
    discountGross: number;
    discountNet: number; // Impact on net
    discountVATImpact: number;
  };
  breakdowns: {
    byPaymentMethod: Record<string, number>;
    byStaff: {
      staffId: string;
      staffName: string;
      role: string;
      orders: number;
      grossSales: number;
      netSales: number;
      vat: number;
      serviceCharge: number;
      discounts: number;
      averageOrderValue: number;
    }[];
    byHour: {
      hour: number;
      totalPaid: number;
      orderCount: number;
      grossSales: number;
      netSales: number;
      vat: number;
    }[];
  };
  meta: {
    totalOrders: number;
    totalPayments: number;
    createdAt: string;
  };
  // Generated once per business day at closure time (see closureService.performClosure).
  // Dashboard reads this cached field instead of triggering a live AI call on view.
  aiInsight?: string;
}

export interface StaffingForecast {
  id: string;
  locationId: string;
  date: string;
  shift: ShiftType;
  forecastSales: number;
  departments: {
    foh: number;
    bar: number;
    kitchen: number;
  };
  labourBudget: number;
  expectedLabourPercent: number;
  recommendedStaff: {
    role: string;
    count: number;
  }[];
  createdAt: string;
}

export interface RotaShift {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  estimatedCost: number;
  department: string;
}

export interface Rota {
  id: string;
  locationId: string;
  weekStarting: string; // ISO date (Monday)
  shifts: RotaShift[];
  status: 'Draft' | 'Published';
  approvedBy?: string;
  approvedAt?: string;
  totalEstimatedLabour: number;
  totalForecastSales: number;
  targetLabourPercent: number;
  createdAt: string;
}

export interface RotaSuggestion {
  id: string;
  locationId: string;
  weekStarting: string;
  suggestedShifts: Omit<RotaShift, 'id'>[];
  confidence: number;
  reasoning: string;
  generatedAt: string;
}

export interface StaffAvailability {
  id: string; // staffId
  locationId: string;
  weeklyPreferences: {
    day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    preference: 'Unavailable' | 'Preferred' | 'Neutral';
  }[];
  unavailableDates: {
    date: string;
    reason: string;
    type: 'Holiday' | 'Sick' | 'Personal';
  }[];
  maxWeeklyHours: number;
}

export interface LabourBudgetRecord {
  id: string;
  locationId: string;
  date: string;
  forecastSales: number;
  targetLabourPercent: number;
  maxLabourSpend: number;
  actualScheduledSpend: number;
  variance: number;
}

export type ForecastType = 'day' | 'week' | 'month' | 'quarter';

export interface Forecast {
  id: string;
  locationId: string;
  type: ForecastType;
  periodStart: string;
  periodEnd: string;
  forecast: {
    revenue: number;
    orders: number;
    cogs: number;
    profit: number;
    margin: number;
  };
  trends: {
    growthRate: number;
    avgDailySales: number;
    bestDay?: string;
    worstDay?: string;
    weekdayPattern?: Record<string, number>;
  };
  createdAt: string;
}

export interface StaffIncentiveConfig {
  id: string;
  locationId: string;
  tiers: {
    platinum: { minScore: number; rewardType: 'cash' | 'voucher' | 'custom'; rewardValue: string | number; label: string };
    gold: { minScore: number; rewardType: 'cash' | 'voucher' | 'custom'; rewardValue: string | number; label: string };
    silver: { minScore: number; rewardType: 'cash' | 'voucher' | 'custom'; rewardValue: string | number; label: string };
  };
  updatedAt: string;
}

export interface MenuEngineeringRecord {
  id: string;
  locationId: string;
  itemId: string;
  name: string;
  category: string;
  metrics: {
    quantitySold: number;
    revenue: number;
    profit: number;
    avgPrice: number;
    unitCost: number;
    margin: number;
    marginPercent: number;
    popularityIndex: number; // item sales / total category sales
  };
  classification: 'star' | 'plowhorse' | 'puzzle' | 'dog';
  action: string;
  optimization?: {
    suggestedPrice: number;
    currentPrice: number;
    priceChangePercent: number;
    estimatedProfitImpact: number;
    priority: 'high' | 'medium' | 'low';
  };
  insights: {
    pricing?: string;
    optimization?: string;
    promotion?: string;
  };
  lastUpdated: string;
}

export interface AutomationSettings {
  id: string;
  automationMode: 'off' | 'suggest' | 'auto';
  maxPriceChangePercent: number;
  lastUpdated: string;
}

export interface AutomationLog {
  id: string;
  action: string;
  category: 'pricing' | 'inventory' | 'staff';
  targetId: string;
  targetName: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
  mode: string;
  status: 'pending' | 'applied' | 'rejected';
}

export interface ShiftBriefingNote {
  id: string;
  title: string;
  message: string;
  date: string;
  shift: ShiftType;
  author: string;
  locationId: string;
  lastUpdated: string;
  challenges?: string[];
  focusOfDay?: string;
  items86?: string[];
  targets?: {
    floor?: {
      totalSalesTarget?: string;
      dessertTarget?: string;
    };
    bar?: {
      cocktailTarget?: string;
      premiumDrinkTarget?: string;
    };
    kitchen?: {
      avgPrepTimeTarget?: string;
    };
    individual?: {
      salesTarget?: string;
      dessertTarget?: string;
      cocktailTarget?: string;
    };
  };
  specials?: string[];
  managerAlerts?: string[];
  isActiveOnPOS?: boolean;
}

export interface ShiftReport {
  id: string;
  locationId: string;
  shiftDate: string;
  shiftType: ShiftType;
  totalRevenue: number;
  totalPoints: number;
  topPerformerId: string;
  topPerformerName: string;
  itemSales: Record<string, number>;
  targetsReached: number;
  closedBy: string;
  timestamp: string;
}

export interface StaffPerformanceRecord {
  id: string;
  locationId: string;
  staffId: string;
  staffName: string;
  date: string; // ISO date of closure
  metrics: {
    totalSales: number;
    orders: number;
    avgOrderValue: number;
    discounts: number;
    discountRatio: number;
    marginContribution: number;
  };
  score: number;
  tier: 'platinum' | 'gold' | 'silver' | 'training';
  createdAt: string;
}

export interface VATTracker {
  id: string; // date string
  locationId: string;
  date: string;
  vatCollected: number; // From sales
  vatOnExpenses: number; // From supplier invoices / expenses
  vatPayable: number; // vatCollected - vatOnExpenses
  lastUpdated: string;
}

export interface ServiceChargeTracker {
  id: string; // date string
  locationId: string;
  date: string;
  totalServiceCharge: number;
  distributed: number;
  pending: number; // totalServiceCharge - distributed
  lastUpdated: string;
}

export interface StaffEarnings {
  id: string; // staffId_date
  staffId: string;
  date: string;
  locationId: string;
  basePay: number;
  serviceChargeShare: number;
  totalEarnings: number;
  timestamp: string;
}

export interface VATReturn {
  id: string;
  locationId: string;
  periodStart: string;
  periodEnd: string;
  status: 'Draft' | 'Submitted';
  box1: number; // VAT on sales
  box2: number; // VAT on EU acquisitions
  box3: number; // Total VAT (Box 1 + Box 2)
  box4: number; // VAT on purchases
  box5: number; // Net VAT to pay (Box 3 - Box 4)
  box6: number; // Net sales ex VAT
  box7: number; // Net purchases ex VAT
  box8: number; // EU sales ex VAT
  box9: number; // EU purchases ex VAT
  createdAt: string;
  submittedAt?: string;
}

export interface ShiftInsight {
  id: string;
  type: 'sales' | 'timing' | 'staff' | 'menu' | 'inventory';
  priority: 'high' | 'medium' | 'low';
  message: string;
  reason: string;
  action: string;
  timestamp: string;
  locationId: string;
}

export interface CashflowRecord {
  id: string; // date string
  locationId: string;
  date: string;
  cashIn: number;
  cashOut: number;
  liabilitiesPaid: number;
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
  safeCash: number; // Cash - VAT - Service Charges - Upcoming Liabilities
  timestamp: string;
}

export interface Liability {
  id: string;
  locationId: string;
  type: 'VAT' | 'Rent' | 'Suppliers' | 'Wages' | 'Utilities' | 'Rates' | 'Other';
  name: string;
  amount: number;
  dueDate: string;
  status: 'Pending' | 'Paid' | 'Overdue';
  isRecurring: boolean;
  frequency?: 'Monthly' | 'Quarterly' | 'Yearly';
  createdAt: string;
}

export interface AIAction {
  id: string;
  locationId: string;
  type: 'Sales' | 'Labour' | 'COGS' | 'Menu' | 'Marketing';
  recommendation: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  expectedImpact: string;
  status: 'Draft' | 'Approved' | 'Rejected' | 'Executed';
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  impactAchieved?: number;
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  locationId: string;
  type: 'Profit' | 'VAT' | 'Cashflow' | 'Labour' | 'Service' | 'Stock' | 'Sales';
  severity: 'Critical' | 'Warning' | 'Info';
  message: string;
  description: string;
  isRead: boolean;
  timestamp: string;
}

export interface AppPermissions {
  inventory: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageSuppliers: boolean;
    viewCosts: boolean;
    processInvoices: boolean;
  };
  orders: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    managePOS: boolean;
    voidItems: boolean;
    applyDiscounts: boolean;
  };
  recipes: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    viewCosts: boolean;
    manageMenuEngineering: boolean;
  };
  reports: {
    viewSales: boolean;
    viewFinancials: boolean;
    viewStaffPerformance: boolean;
    viewFoodSafety: boolean;
    exportData: boolean;
  };
  staff: {
    viewProfiles: boolean;
    editProfiles: boolean;
    editSalaries: boolean;
    manageRoles: boolean;
    viewTraining: boolean;
    viewBriefing: boolean;
    manageBriefing: boolean;
    viewBriefingTargets: boolean;
    viewBriefingChallenges: boolean;
    viewBriefing86: boolean;
    viewBriefingPerformance: boolean;
  };
  settings: {
    view: boolean;
    managePermissions: boolean;
    manageAutomation: boolean;
  };
  stockCount: {
    view: boolean;
    startCount: boolean;
    editCount: boolean;
    deleteCount: boolean;
    viewVariances: boolean;
    finalizeCount: boolean;
  };
  tables: {
    view: boolean;
    editLayout: boolean;
    manageZones: boolean;
    seatCustomers: boolean;
    transferOrders: boolean;
    closeTable: boolean;
  };
}

export interface LabourShift {
  id: string;
  staffId?: string | null; // matched staff from staffProfiles
  employeeName: string;
  role: string;
  department?: string | null;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  durationHours: number;
  wageRate: number;
  totalCost: number;
  locationId: string;
  importedAt: string;
  source: string; // e.g. "Time Tracker Pro CSV", "Rota Export CSV"
  shiftWindow?: string; // 'Morning' | 'Lunch' | 'Dinner', auto-assigned from clock-in time
}

export interface LabourForecasting {
  id: string;
  locationId: string;
  date: string;
  expectedSales: number;
  recommendedStaffing: {
    role: string;
    count: number;
  }[];
  efficiencyTarget: number;
  historicalLabourPercent: number;
  createdAt: string;
}

export interface SystemPermissions {
  id: 'permissions_config';
  locationId: string;
  roles: Record<string, AppPermissions>;
  updatedAt: string;
}
