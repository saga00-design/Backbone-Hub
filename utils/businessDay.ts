// Single source of truth for the app's 6am-to-6am London business day boundary.
// Extracted from App.tsx's original inline getBusinessDay() so every component
// (imports, dashboards, closures) applies the exact same rule instead of
// reimplementing it slightly differently.

export const LONDON_TIMEZONE = 'Europe/London';

/** Applies the 6am London cutoff to an arbitrary timestamp. */
export function getBusinessDayFor(date: Date): string {
  const londonHour = parseInt(
    date.toLocaleString('en-GB', { timeZone: LONDON_TIMEZONE, hour: 'numeric', hour12: false })
  );
  if (londonHour < 6) {
    const prior = new Date(date);
    prior.setDate(prior.getDate() - 1);
    return prior.toLocaleDateString('en-CA', { timeZone: LONDON_TIMEZONE });
  }
  return date.toLocaleDateString('en-CA', { timeZone: LONDON_TIMEZONE });
}

/** Current business day (6am London cutoff). */
export function getBusinessDay(): string {
  return getBusinessDayFor(new Date());
}
