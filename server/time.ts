/**
 * Time utilities for UTC minute floor and IST window helpers
 */

/**
 * Floor a date to the nearest minute (zero out seconds and milliseconds)
 */
export function floorToMinute(date: Date): Date {
  const floored = new Date(date);
  floored.setSeconds(0, 0);
  return floored;
}

/**
 * Convert UTC date to IST and get the start of the day in IST
 */
export function getIstDayStart(date?: Date): Date {
  const inputDate = date || new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(inputDate.getTime() + istOffset);
  
  // Get start of day in IST
  const istDayStart = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());
  
  // Convert back to UTC
  const result = new Date(istDayStart.getTime() - istOffset);
  
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[TIME] getIstDayStart(${inputDate.toISOString()}) -> ${result.toISOString()} (IST: ${toIsoIst(result)})`);
  }
  
  return result;
}

/**
 * Get the previous IST day start from a given UTC date
 */
export function getPreviousIstDayStart(date: Date): Date {
  const istDayStart = getIstDayStart(date);
  return new Date(istDayStart.getTime() - 24 * 60 * 60 * 1000); // Subtract 1 day
}

/**
 * Convert UTC date to IST for display/logging purposes
 */
export function toIstString(date: Date): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  return istDate.toISOString().replace('Z', '+05:30');
}

/**
 * Convert Date to ISO string with +05:30 timezone suffix
 */
export function toIsoIst(d: Date): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  return istDate.toISOString().replace('Z', '+05:30');
}

/**
 * Get the start of the next day in IST
 */
export function getIstNextDayStart(date?: Date): Date {
  const dayStart = getIstDayStart(date);
  const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  
  if (process.env.NODE_ENV === 'development') {
    const inputDate = date || new Date();
    console.debug(`[TIME] getIstNextDayStart(${inputDate.toISOString()}) -> ${nextDayStart.toISOString()} (IST: ${toIsoIst(nextDayStart)})`);
  }
  
  return nextDayStart;
}

/**
 * Get IST month range [month start IST, next month start IST)
 */
export function getIstMonthRange(yyyyMm?: string): { start: Date; end: Date } {
  // Default to current month in IST
  const now = new Date();
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const defaultMonth = istNow.toISOString().substr(0, 7); // YYYY-MM
  const monthStr = yyyyMm || defaultMonth;

  // Parse month and create date range
  const [year, monthNum] = monthStr.split('-').map(Number);
  
  // Create month start in IST, then convert to UTC
  const istMonthStart = new Date(year, monthNum - 1, 1); // Month is 0-indexed
  const start = new Date(istMonthStart.getTime() - (5.5 * 60 * 60 * 1000));
  
  // Create next month start in IST, then convert to UTC
  const istNextMonthStart = new Date(year, monthNum, 1); // Next month
  const end = new Date(istNextMonthStart.getTime() - (5.5 * 60 * 60 * 1000));
  
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[TIME] getIstMonthRange(${monthStr}) -> start: ${start.toISOString()} (IST: ${toIsoIst(start)}), end: ${end.toISOString()} (IST: ${toIsoIst(end)})`);
  }
  
  return { start, end };
}

/**
 * Get IST year range [Jan 1 IST, Jan 1 next year IST)
 */
export function getIstYearRange(yyyy?: number): { start: Date; end: Date } {
  // Default to current year in IST
  const now = new Date();
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const yearNum = yyyy || istNow.getFullYear();
  
  // Create year start in IST, then convert to UTC
  const istYearStart = new Date(yearNum, 0, 1); // Jan 1
  const start = new Date(istYearStart.getTime() - (5.5 * 60 * 60 * 1000));
  
  // Create next year start in IST, then convert to UTC
  const istNextYearStart = new Date(yearNum + 1, 0, 1); // Jan 1 next year
  const end = new Date(istNextYearStart.getTime() - (5.5 * 60 * 60 * 1000));
  
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[TIME] getIstYearRange(${yearNum}) -> start: ${start.toISOString()} (IST: ${toIsoIst(start)}), end: ${end.toISOString()} (IST: ${toIsoIst(end)})`);
  }
  
  return { start, end };
}