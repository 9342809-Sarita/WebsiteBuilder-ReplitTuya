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
export function getIstDayStart(date: Date): Date {
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  
  // Get start of day in IST
  const istDayStart = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());
  
  // Convert back to UTC
  return new Date(istDayStart.getTime() - istOffset);
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