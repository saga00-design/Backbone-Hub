import { Unit, InventoryType } from '../types';

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
  'custom': 1,
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
 * Converts any quantity and unit to its base unit equivalent.
 */
export function convertToBaseUnit(quantity: number, unit: Unit, unitSize?: number): number {
  const factor = CONVERSION_FACTORS[unit] || 1;
  const size = unitSize !== undefined ? unitSize : 1;
  
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
  const factor = CONVERSION_FACTORS[targetUnit] || 1;
  const size = unitSize !== undefined ? unitSize : 1;
  const totalFactor = size * factor;
  return totalFactor > 0 ? roundTo(baseQuantity / totalFactor) : 0;
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
