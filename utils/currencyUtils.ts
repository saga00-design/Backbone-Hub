export const normalizeCurrency = (val: any): number => {
  if (val === null || val === undefined) return 0;

  let raw: number;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9-.]+/g, '');
    raw = Number(cleaned);
  } else {
    raw = Number(val);
  }

  if (isNaN(raw) || raw === 0) return 0;
  const absRaw = Math.abs(raw);

  // If value is very large (> 800) it's almost certainly pence
  if (absRaw > 800) return raw / 100;

  // If it's an integer larger than 10, likely pence
  if (Number.isInteger(raw) && absRaw > 10) return raw / 100;

  // Values of 1 or 2 are almost certainly corrupt/placeholder data
  // Return 0 rather than trust them
  if (Number.isInteger(raw) && absRaw <= 2) return 0;

  // Fallback: trust as pounds
  return raw;
};

// Converts a POS millisecond timestamp to ISO string
export const normalizeTimestamp = (val: any): string => {
  if (!val) return new Date().toISOString();

  // Already an ISO string
  if (typeof val === 'string' && val.includes('T')) return val;

  // Firestore Timestamp object
  if (typeof val === 'object' && val.seconds) {
    return new Date(val.seconds * 1000).toISOString();
  }

  // Milliseconds number (POS format)
  if (typeof val === 'number') {
    return new Date(val).toISOString();
  }

  return new Date().toISOString();
};

// Normalises POS status to HUB format
// POS uses lowercase "paid", HUB expects "Paid"
export const normalizeStatus = (val: any): string => {
  if (!val) return '';
  const s = String(val).toLowerCase().trim();
  if (s === 'paid') return 'Paid';
  if (s === 'open') return 'Open';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'refunded') return 'Refunded';
  if (s === 'sent') return 'Sent';
  return val;
};