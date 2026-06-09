
import { AppPermissions } from './types';

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
  { id: 'staffing_rota', name: 'Staffing & Rota' },
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
    tables: { view: true, editLayout: true, manageZones: true, seatCustomers: true, transferOrders: true, closeTable: true },
    staffingRota: { view: true, manageForecasts: true, buildRota: true, approveRota: true, viewBudgets: true, manageAvailability: true }
  },
  Manager: {
    inventory: { view: true, create: true, edit: true, delete: true, manageSuppliers: true, viewCosts: true, processInvoices: true },
    orders: { view: true, create: true, edit: true, delete: true, managePOS: true, voidItems: true, applyDiscounts: true },
    recipes: { view: true, create: true, edit: true, delete: true, viewCosts: true, manageMenuEngineering: true },
    reports: { viewSales: true, viewFinancials: true, viewStaffPerformance: true, viewFoodSafety: true, exportData: true },
    staff: { viewProfiles: true, editProfiles: true, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: true, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: true, managePermissions: false, manageAutomation: false },
    stockCount: { view: true, startCount: true, editCount: true, deleteCount: true, viewVariances: true, finalizeCount: true },
    tables: { view: true, editLayout: true, manageZones: true, seatCustomers: true, transferOrders: true, closeTable: true },
    staffingRota: { view: true, manageForecasts: true, buildRota: true, approveRota: true, viewBudgets: true, manageAvailability: true }
  },
  Waiter: {
    inventory: { view: false, create: false, edit: false, delete: false, manageSuppliers: false, viewCosts: false, processInvoices: false },
    orders: { view: false, create: false, edit: false, delete: false, managePOS: false, voidItems: false, applyDiscounts: false },
    recipes: { view: false, create: false, edit: false, delete: false, viewCosts: false, manageMenuEngineering: false },
    reports: { viewSales: false, viewFinancials: false, viewStaffPerformance: false, viewFoodSafety: false, exportData: false },
    staff: { viewProfiles: false, editProfiles: false, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: false, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: false, managePermissions: false, manageAutomation: false },
    stockCount: { view: false, startCount: false, editCount: false, deleteCount: false, viewVariances: false, finalizeCount: false },
    tables: { view: false, editLayout: false, manageZones: false, seatCustomers: false, transferOrders: false, closeTable: false },
    staffingRota: { view: true, manageForecasts: false, buildRota: false, approveRota: false, viewBudgets: false, manageAvailability: true }
  },
  Bartender: {
    inventory: { view: false, create: false, edit: false, delete: false, manageSuppliers: false, viewCosts: false, processInvoices: false },
    orders: { view: false, create: false, edit: false, delete: false, managePOS: false, voidItems: false, applyDiscounts: false },
    recipes: { view: false, create: false, edit: false, delete: false, viewCosts: false, manageMenuEngineering: false },
    reports: { viewSales: false, viewFinancials: false, viewStaffPerformance: false, viewFoodSafety: false, exportData: false },
    staff: { viewProfiles: false, editProfiles: false, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: false, viewBriefingTargets: false, viewBriefingChallenges: false, viewBriefing86: true, viewBriefingPerformance: false },
    settings: { view: false, managePermissions: false, manageAutomation: false },
    stockCount: { view: false, startCount: false, editCount: false, deleteCount: false, viewVariances: false, finalizeCount: false },
    tables: { view: false, editLayout: false, manageZones: false, seatCustomers: false, transferOrders: false, closeTable: false },
    staffingRota: { view: true, manageForecasts: false, buildRota: false, approveRota: false, viewBudgets: false, manageAvailability: true }
  },
  Chef: {
    inventory: { view: true, create: true, edit: true, delete: false, manageSuppliers: true, viewCosts: false, processInvoices: true },
    orders: { view: true, create: true, edit: false, delete: false, managePOS: false, voidItems: false, applyDiscounts: false },
    recipes: { view: true, create: true, edit: true, delete: true, viewCosts: true, manageMenuEngineering: true },
    reports: { viewSales: false, viewFinancials: false, viewStaffPerformance: false, viewFoodSafety: true, exportData: false },
    staff: { viewProfiles: false, editProfiles: false, editSalaries: false, manageRoles: false, viewTraining: true, viewBriefing: true, manageBriefing: true, viewBriefingTargets: true, viewBriefingChallenges: true, viewBriefing86: true, viewBriefingPerformance: true },
    settings: { view: false, managePermissions: false, manageAutomation: false },
    stockCount: { view: true, startCount: true, editCount: true, deleteCount: false, viewVariances: true, finalizeCount: false },
    tables: { view: false, editLayout: false, manageZones: false, seatCustomers: false, transferOrders: false, closeTable: false },
    staffingRota: { view: true, manageForecasts: false, buildRota: false, approveRota: false, viewBudgets: true, manageAvailability: true }
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
