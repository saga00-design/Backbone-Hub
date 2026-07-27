import { Unit, InventoryType, InventoryItem } from '../types';

export const BASE_UNITS: Record<string, Unit> = {
  LIQUID: 'ml',
  SOLID: 'g',
  UNIT: 'pcs',
};

export const CONVERSION_FACTORS: Record<string, number> = {
  'L': 1000,
  'ml': 1,
  'cl': 10,
  'kg': 1000,
  'g': 1,
  'gr': 1,
  'pcs': 1,
  'box': 1,
  'bottles': 1,
  'bags': 1,
  'portions': 1,
  'packs': 1,
  'cases': 1,
  'cans': 1,
  'kegs': 1,
  'servings': 1,
  'tray': 1,
  'vacuum pack': 1,
  'sack': 1,
  'tin': 1,
  'jar': 1,
  'tub': 1,
  'sachet': 1,
  'loose': 1,
  'custom': 1,
};

// Maps an inventory item's singular packaging/casePackaging label (e.g. 'bottle', 'case') to
// the matching Unit value used for invoice line items and cost conversion (e.g. 'bottles').
// Kept as the single source of truth so InvoiceProcessor's unit picker and App.tsx's
// case-tier detection in handleApproveInvoice never drift apart.
export const PACKAGING_TO_UNIT: Record<string, Unit> = {
  pack: 'packs', box: 'box', case: 'cases', sack: 'sack', bottle: 'bottles',
  'vacuum pack': 'vacuum pack', bag: 'bags', tray: 'tray', tin: 'tin', jar: 'jar',
  tub: 'tub', sachet: 'sachet', loose: 'loose', pcs: 'pcs',
};

export const UNIT_TYPES: Record<string, InventoryType> = {
  'L': 'LIQUID',
  'ml': 'LIQUID',
  'cl': 'LIQUID',
  'kg': 'SOLID',
  'g': 'SOLID',
  'gr': 'SOLID',
  'pcs': 'UNIT',
  'box': 'UNIT',
  'bottles': 'UNIT',
  'bags': 'UNIT',
  'portions': 'UNIT',
  'packs': 'UNIT',
  'cases': 'UNIT',
  'cans': 'UNIT',
  'kegs': 'UNIT',
  'servings': 'UNIT',
  'tray': 'UNIT',
  'vacuum pack': 'UNIT',
  'sack': 'UNIT',
  'tin': 'UNIT',
  'jar': 'UNIT',
  'tub': 'UNIT',
  'sachet': 'UNIT',
  'loose': 'UNIT',
  'custom': 'CUSTOM',
};

/**
 * Rounds a number to a specific precision to avoid floating point issues.
 */
export function roundTo(num: number, decimals: number = 6): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Coerces any value to a finite number for safe display/calculation, falling back
 * (default 0) for NaN, undefined, null, or non-numeric values — e.g. a corrupted
 * Firestore field that landed as an object instead of a number. Used at every quantity/price
 * chokepoint so a single bad stored value can't propagate NaN into a render and crash the page.
 */
export function toSafeNumber(value: unknown, fallback: number = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Converts any quantity and unit to its base unit equivalent.
 */
export function convertToBaseUnit(quantity: number, unit: Unit, unitSize?: number): number {
  quantity = toSafeNumber(quantity);
  const factor = CONVERSION_FACTORS[unit] || 1;
  const size = unitSize !== undefined ? toSafeNumber(unitSize, 1) : 1;

  // 1. Standard metric units always use their fixed factor relative to base.
  if (['kg', 'g', 'gr', 'L', 'ml', 'cl'].includes(unit)) {
    return roundTo(quantity * factor);
  }
  
  // 2. For 'pcs', it's always 1:1 to base.
  if (unit === 'pcs') {
    return roundTo(quantity);
  }

  // 3. For other units (box, bottles, portions, etc.), we use the factor and size.
  return roundTo(quantity * size * factor);
}

/**
 * Converts a base quantity into a target unit.
 */
export function convertFromBaseUnit(baseQuantity: number, targetUnit: Unit, unitSize?: number): number {
  baseQuantity = toSafeNumber(baseQuantity);
  const factor = CONVERSION_FACTORS[targetUnit] || 1;
  const size = unitSize !== undefined ? toSafeNumber(unitSize, 1) : 1;
  const totalFactor = size * factor;
  return totalFactor > 0 ? roundTo(baseQuantity / totalFactor) : 0;
}

export interface InvoiceLineResolution {
  invItem?: InventoryItem;
  quantityInBase: number;
  pricePerBase: number;
  unitMismatch: boolean;
}

/**
 * Resolves an invoice line (name-matched against the inventory catalog, same as everywhere
 * else in Invoice Processing) into a base-unit quantity and a price-per-base-unit — including
 * the case-tier detection (invoiced "by the case" vs "by the pack"). Extracted so the
 * pre-approval three-way-match preview and the actual approval write use identical math and
 * can never drift apart, the same reasoning behind PACKAGING_TO_UNIT above.
 */
export function resolveInvoiceLine(
  itemName: string,
  quantity: number,
  unit: Unit,
  price: number,
  inventoryItems: InventoryItem[]
): InvoiceLineResolution {
  const invItem = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
  const caseUnit = invItem ? (PACKAGING_TO_UNIT[invItem.casePackaging || 'case'] || 'cases') : undefined;
  const isCaseTier = !!(invItem && invItem.caseSize && unit === caseUnit);
  const tierBaseSize = isCaseTier
    ? (invItem!.unitSize || 1) * (invItem!.caseSize || 1)
    : (invItem?.unitSize || 1);
  const unitMismatch = !!(invItem && !isCaseTier && unit !== invItem.baseUnit && tierBaseSize === 1);
  const quantityInBase = convertToBaseUnit(toSafeNumber(quantity), unit, tierBaseSize);
  const pricePerBase = price && quantityInBase > 0 ? toSafeNumber(price) / quantityInBase : 0;
  return { invItem, quantityInBase, pricePerBase, unitMismatch };
}

/**
 * Calculates the total base quantity from a purchase entry.
 * Example: 3 bottles of 700ml -> 2100ml
 */
export function calculateTotalBaseQuantity(qtyReceived: number, packSize: number, packUnit: Unit): number {
  const baseSize = convertToBaseUnit(packSize, packUnit);
  return qtyReceived * baseSize;
}

/**
 * Formats a base quantity into a human-readable display string.
 * e.g., 2100ml -> 2.1 L, 500ml -> 500 ml
 */
export function formatDisplayValue(quantity: number, inventoryType: InventoryType): { value: number, unit: Unit } {
  if (inventoryType === 'LIQUID') {
    if (quantity >= 1000) {
      return { value: quantity / 1000, unit: 'L' };
    }
    return { value: quantity, unit: 'ml' };
  }
  if (inventoryType === 'SOLID') {
    if (quantity >= 1000) {
      return { value: quantity / 1000, unit: 'kg' };
    }
    return { value: quantity, unit: 'g' };
  }
  return { value: quantity, unit: BASE_UNITS[inventoryType] || 'pcs' };
}

/**
 * Formats price per base unit for display (e.g., per L or per kg).
 */
export function formatPricePerUnit(pricePerBaseUnit: number, inventoryType: InventoryType): string {
  if (inventoryType === 'LIQUID') {
    return `£${(pricePerBaseUnit * 1000).toFixed(4)}/L`;
  } else if (inventoryType === 'SOLID') {
    return `£${(pricePerBaseUnit * 1000).toFixed(4)}/kg`;
  }
  return `£${pricePerBaseUnit.toFixed(4)}/${BASE_UNITS[inventoryType] || 'pcs'}`;
}

/**
 * Validates if two units are compatible (belong to the same inventory type).
 */
export function areUnitsCompatible(unit1: Unit, unit2: Unit): boolean {
  return UNIT_TYPES[unit1] === UNIT_TYPES[unit2];
}

/**
 * How many decimal places a quantity should show/accept for a given unit, e.g. Stock Count's
 * expected/actual quantity fields. Units not listed here default to 2 decimals — callers
 * should log/report any such unit rather than silently guessing further.
 */
export const QTY_DECIMALS: Record<string, number> = {
  kg: 2,
  g: 3,
  l: 2,
  L: 2,
  ml: 3,
  box: 1,
  pcs: 1,
  portions: 1,
  servings: 1,
  bottles: 1,
  cans: 1,
  kegs: 1,
};

const DEFAULT_QTY_DECIMALS = 2;

export function getQtyDecimals(unit: string | undefined): number {
  if (!unit) return DEFAULT_QTY_DECIMALS;
  if (QTY_DECIMALS[unit] !== undefined) return QTY_DECIMALS[unit];
  const lower = unit.toLowerCase();
  return QTY_DECIMALS[lower] !== undefined ? QTY_DECIMALS[lower] : DEFAULT_QTY_DECIMALS;
}

/** The `step` value for a quantity <input type="number">, matching getQtyDecimals precision. */
export function getQtyStep(unit: string | undefined): string {
  const decimals = getQtyDecimals(unit);
  return (1 / Math.pow(10, decimals)).toString();
}

/**
 * Simple pluralization for packaging labels (pack -> packs, tray -> trays, box -> boxes).
 */
export function pluralizePackaging(label: string, count: number): string {
  if (count === 1) return label;
  const lower = label.toLowerCase();
  if (lower.endsWith('y')) return label.slice(0, -1) + 'ies';
  if (lower.endsWith('x') || lower.endsWith('s')) return label + 'es';
  return label + 's';
}

/**
 * Converts a base-unit quantity (e.g. 2000g) into a pack (or case) count with a pluralized
 * packaging label (e.g. "20 packs"). Used everywhere stock/min-stock/order quantities need to
 * be shown the way people actually buy the item, instead of raw base units.
 * Pass tier: 'pack' (default, uses unitSize/packaging) or 'case' (uses caseSize/casePackaging,
 * where caseSize is expressed in packs — the base-unit size of one case is unitSize * caseSize).
 */
export function formatPacksLabel(
  baseQty: number,
  item: Pick<InventoryItem, 'unitSize' | 'packaging' | 'unit' | 'inventoryType' | 'caseSize' | 'casePackaging'>,
  tier: 'pack' | 'case' = 'pack'
): string {
  baseQty = toSafeNumber(baseQty);
  if (tier === 'case') {
    const caseBaseSize = (item.unitSize || 1) * (item.caseSize || 1);
    if (!item.caseSize || caseBaseSize === 0) return formatPacksLabel(baseQty, item, 'pack');
    const cases = Number((baseQty / caseBaseSize).toFixed(2));
    const label = item.casePackaging || 'case';
    return `${cases} ${pluralizePackaging(label, cases)}`;
  }

  if (!item.unitSize || item.unitSize === 0) {
    const display = formatDisplayValue(baseQty, item.inventoryType);
    return `${Number(display.value.toFixed(3))} ${display.unit}`;
  }

  const packs = Number((baseQty / item.unitSize).toFixed(2));
  const label = item.packaging || item.unit;
  return `${packs} ${item.packaging ? pluralizePackaging(label, packs) : label}`;
}

/** A single pack's size expressed in the item's own unit (e.g. unitSize 100g, unit 'g' -> 100). */
export function formatPackSize(item: Pick<InventoryItem, 'unitSize' | 'unit'>): number {
  if (!item.unitSize) return 1;
  const factor = convertToBaseUnit(1, item.unit);
  return Number((item.unitSize / factor).toFixed(3));
}

/** Total price of one pack (unitSize), e.g. "£2.00". Shared by Inventory and Stock Orders. */
export function formatPriceItem(item: Pick<InventoryItem, 'pricePerUnit' | 'unitSize'>): string {
  const packPrice = (item.pricePerUnit || 0) * (item.unitSize || 0);
  const formattedPrice = packPrice.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
  return `£${formattedPrice}`;
}

export interface CaseBoxSackDetails {
  isSet: boolean;
  caseSize?: number;
  casePackaging: string;
  packLabel: string;
  fullCases: number;
  totalPacks: number;
}

type CaseBoxSackItem = Pick<InventoryItem, 'caseSize' | 'casePackaging' | 'packaging' | 'unit' | 'unitSize' | 'quantity'>;

/**
 * Structured case/box/sack conversion data — the single source of truth reused by Inventory's
 * table column, Stock Orders' column, and the item specs tooltip so the "full cases in stock"
 * math never drifts between call sites.
 */
export function getCaseBoxSackDetails(item: CaseBoxSackItem): CaseBoxSackDetails {
  const packLabel = item.packaging || item.unit;
  const safeQuantity = toSafeNumber(item.quantity);
  const totalPacks = item.unitSize > 0 ? safeQuantity / item.unitSize : 0;

  if (!item.caseSize || item.caseSize <= 0) {
    return { isSet: false, casePackaging: 'case', packLabel, fullCases: 0, totalPacks };
  }

  const fullCases = Math.floor(totalPacks / item.caseSize);
  return {
    isSet: true,
    caseSize: item.caseSize,
    casePackaging: item.casePackaging || 'case',
    packLabel,
    fullCases,
    totalPacks
  };
}

/** Bare case count for compact table cells, e.g. "2 cases", or "Not set" when no case size exists. */
export function formatCaseBoxSackLabel(item: CaseBoxSackItem): { label: string; isSet: boolean } {
  const details = getCaseBoxSackDetails(item);
  if (!details.isSet) return { label: 'Not set', isSet: false };
  return { label: `${details.fullCases} ${pluralizePackaging(details.casePackaging, details.fullCases)}`, isSet: true };
}
