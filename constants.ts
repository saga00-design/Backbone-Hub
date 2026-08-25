
import { AppPermissions } from './types';

// Single source of truth for hardcoded bootstrap/fallback admin emails.
// These bypass the normal staffProfiles.role check entirely - kept for
// initial system access before any staff records exist, and as a safety
// net. The real, ongoing source of truth for access should be
// staffProfiles.role once staff records exist.
//
// IMPORTANT: firestore.rules' isManager() function and Backbone POS's own
// copy of this list (src/app/config.ts) CANNOT import from here - Firestore
// rules can't import application code, and POS is a separate repo. If this
// list ever changes, update those two places by hand to match.
export const ADMIN_EMAILS = ['saga00@gmail.com', 'famrokha@gmail.com'] as const;

export const APP_SECTIONS = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'inventory', name: 'Inventory' },
  { id: 'recipes', name: 'Recipes' },
  { id: 'tables', name: 'Table Manager' },
  { id: 'orders', name: 'Orders' },
  { id: 'reports', name: 'Reports' },
  { id: 'settings', name: 'Settings' },
  { id: 'training', name: 'Training' },
  { id: 'sales', name: 'Sales Import' },
  { id: 'stocktake', name: 'Stock Count' },
  { id: 'invoices', name: 'Invoices' },
  { id: 'suppliers', name: 'Suppliers' },
];

export const DEFAULT_PERMISSIONS: Record<string, AppPermissions> = {
  Admin: {
    inventory: { view: true, create: true, edit: true, delete: true, manageSuppliers: true, viewCosts: true, processInvoices: true },
    orders: { view: true, create: true, edit: true, delete: true, managePOS: true, voidItems: true, applyDiscounts: true },
    recipes: { view: true, create: true, edit: true, delete: true, viewCosts: true, manageMenuEngineering: true },
    reports: { viewSales: true, viewFinancials: true, viewStaffPerformance: true, viewFoodSafety: true, exportData: true },
    staff: { viewProfiles: true, editProfiles: true, editSalaries: true, manageRoles: true, viewTraining: true, viewBriefing: true, manageBriefing: true, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: true, managePermissions: true, manageAutomation: true },
    stockCount: { view: true, startCount: true, editCount: true, deleteCount: true, viewVariances: true, finalizeCount: true },
    tables: { view: true, editLayout: true, manageZones: true, seatCustomers: true, transferOrders: true, closeTable: true }
  },
  Manager: {
    inventory: { view: true, create: true, edit: true, delete: true, manageSuppliers: true, viewCosts: true, processInvoices: true },
    orders: { view: true, create: true, edit: true, delete: true, managePOS: true, voidItems: true, applyDiscounts: true },
    recipes: { view: true, create: true, edit: true, delete: true, viewCosts: true, manageMenuEngineering: true },
    reports: { viewSales: true, viewFinancials: true, viewStaffPerformance: true, viewFoodSafety: true, exportData: true },
    staff: { viewProfiles: true, editProfiles: true, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: true, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: true, managePermissions: false, manageAutomation: false },
    stockCount: { view: true, startCount: true, editCount: true, deleteCount: true, viewVariances: true, finalizeCount: true },
    tables: { view: true, editLayout: true, manageZones: true, seatCustomers: true, transferOrders: true, closeTable: true }
  },
  Waiter: {
    inventory: { view: false, create: false, edit: false, delete: false, manageSuppliers: false, viewCosts: false, processInvoices: false },
    orders: { view: false, create: false, edit: false, delete: false, managePOS: false, voidItems: false, applyDiscounts: false },
    recipes: { view: false, create: false, edit: false, delete: false, viewCosts: false, manageMenuEngineering: false },
    reports: { viewSales: false, viewFinancials: false, viewStaffPerformance: false, viewFoodSafety: false, exportData: false },
    staff: { viewProfiles: false, editProfiles: false, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: false, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: false, managePermissions: false, manageAutomation: false },
    stockCount: { view: false, startCount: false, editCount: false, deleteCount: false, viewVariances: false, finalizeCount: false },
    tables: { view: false, editLayout: false, manageZones: false, seatCustomers: false, transferOrders: false, closeTable: false }
  },
  Bartender: {
    inventory: { view: false, create: false, edit: false, delete: false, manageSuppliers: false, viewCosts: false, processInvoices: false },
    orders: { view: false, create: false, edit: false, delete: false, managePOS: false, voidItems: false, applyDiscounts: false },
    recipes: { view: false, create: false, edit: false, delete: false, viewCosts: false, manageMenuEngineering: false },
    reports: { viewSales: false, viewFinancials: false, viewStaffPerformance: false, viewFoodSafety: false, exportData: false },
    staff: { viewProfiles: false, editProfiles: false, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: false, viewBriefingTargets: false, viewBriefingChallenges: false, viewBriefing86: true, viewBriefingPerformance: false },
    settings: { view: false, managePermissions: false, manageAutomation: false },
    stockCount: { view: false, startCount: false, editCount: false, deleteCount: false, viewVariances: false, finalizeCount: false },
    tables: { view: false, editLayout: false, manageZones: false, seatCustomers: false, transferOrders: false, closeTable: false }
  },
  Chef: {
    inventory: { view: true, create: true, edit: true, delete: false, manageSuppliers: true, viewCosts: false, processInvoices: true },
    orders: { view: true, create: true, edit: false, delete: false, managePOS: false, voidItems: false, applyDiscounts: false },
    recipes: { view: true, create: true, edit: true, delete: true, viewCosts: true, manageMenuEngineering: true },
    reports: { viewSales: false, viewFinancials: false, viewStaffPerformance: false, viewFoodSafety: true, exportData: false },
    staff: { viewProfiles: false, editProfiles: false, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: true, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: false, managePermissions: false, manageAutomation: false },
    stockCount: { view: true, startCount: true, editCount: true, deleteCount: false, viewVariances: true, finalizeCount: false },
    tables: { view: false, editLayout: false, manageZones: false, seatCustomers: false, transferOrders: false, closeTable: false }
  }
};

export const DEFAULT_ROLES = [
  { id: 'Admin', name: 'Admin' },
  { id: 'Manager', name: 'Manager' },
  { id: 'Waiter', name: 'Waiter' },
  { id: 'Bartender', name: 'Bartender' },
  { id: 'Chef', name: 'Chef' },
];

export const DEFAULT_DEPARTMENTS = [
  { id: 'food', name: 'Food' },
  { id: 'beverage', name: 'Beverage' },
  { id: 'non_fb', name: 'Non-F&B' },
  { id: 'foh', name: 'Front of House' },
  { id: 'admin', name: 'Admin' },
  { id: 'custom', name: 'Custom' },
];

// Single source of truth for the Morning/Lunch/Dinner shift windows.
// Boundaries (12:00 and 17:00) are the ones already hardcoded in the Labour
// Intelligence "Shift Profitability" card; 06:00 reuses the app's existing
// business-day cutoff hour (see utils/businessDay.ts). Not new numbers.
export interface ShiftWindowDefinition {
  name: 'Morning' | 'Lunch' | 'Dinner';
  startHour: number; // inclusive, 24h clock
  endHour: number; // exclusive, 24h clock (24 = midnight, wraps into next calendar day up to the 6am cutoff)
  label: string;
}

export const SHIFT_WINDOWS: ShiftWindowDefinition[] = [
  { name: 'Morning', startHour: 6, endHour: 12, label: '06:00 - 12:00' },
  { name: 'Lunch', startHour: 12, endHour: 17, label: '12:00 - 17:00' },
  { name: 'Dinner', startHour: 17, endHour: 24, label: '17:00 - 23:30' },
];

/** Assigns an hour (0-23) to a Morning/Lunch/Dinner window. Hours 0-5 (post-midnight,
 * pre-cutoff) fold into Dinner since they belong to the prior business day's evening. */
export function getShiftWindowForHour(hour: number): ShiftWindowDefinition {
  if (hour >= 6 && hour < 12) return SHIFT_WINDOWS[0];
  if (hour >= 12 && hour < 17) return SHIFT_WINDOWS[1];
  return SHIFT_WINDOWS[2];
}

export const DEFAULT_CATEGORIES = [
  'Food',
  'Beverage',
  'Non-F&B',
  'Ingredient',
  'Crockery',
  'Utensil',
  'Equipment',
  'Cleaning',
  'Prep',
  'Batch',
  'Other'
];
