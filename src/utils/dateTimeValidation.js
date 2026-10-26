/**
 * Global Date & Time Validation and Utility Functions
 * Used across tenant management, subscriptions, and platform administration.
 */

/**
 * Format a Date object to YYYY-MM-DDTHH:mm for datetime-local input fields
 * in local timezone.
 */
export function formatLocalDateTimeForInput(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Safely parse a date-time value (ISO string, Timestamp, or Date)
 * Returns Date object or null if invalid.
 */
export function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  // Handle Firestore Timestamp object (has toDate() method or seconds/nanoseconds)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Check if a date string/value is valid
 */
export function isValidDateTime(value) {
  const d = parseDateTime(value);
  if (!d) return false;
  const year = d.getFullYear();
  // Ensure year is within realistic bounds
  return year >= 2000 && year <= 2100;
}

/**
 * Calculate subscription end date based on start date and subscription type
 * @param {string|Date} startDate 
 * @param {'MONTHLY'|'YEARLY'|string} type 
 * @returns {string} datetime-local formatted string
 */
export function calculateSubscriptionEndDate(startDate, type = 'MONTHLY') {
  const start = parseDateTime(startDate) || new Date();
  const end = new Date(start.getTime());

  const normalizedType = String(type).toUpperCase();
  if (normalizedType.includes('YEAR') || normalizedType === '2' || normalizedType === 'YEARLY') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    // Default to 1 Month
    end.setMonth(end.getMonth() + 1);
  }

  return formatLocalDateTimeForInput(end);
}

/**
 * Global date range validation
 * Ensures both start and end are valid and end date is strictly after start date.
 * 
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateDateTimeRange(startDate, endDate) {
  if (!startDate) {
    return { isValid: false, error: 'Start Date & Time is required' };
  }
  if (!endDate) {
    return { isValid: false, error: 'End Date & Time is required' };
  }

  const start = parseDateTime(startDate);
  if (!start) {
    return { isValid: false, error: 'Invalid Start Date format' };
  }

  const end = parseDateTime(endDate);
  if (!end) {
    return { isValid: false, error: 'Invalid End Date format' };
  }

  if (end.getTime() <= start.getTime()) {
    return { 
      isValid: false, 
      error: 'End Date & Time must be strictly after Start Date & Time' 
    };
  }

  return { isValid: true, error: null };
}

/**
 * Format date for human display in tables / cards
 * e.g. "22 Oct 2026, 11:30 AM" or "22 Oct 2026"
 */
export function formatDisplayDateTime(value, includeTime = false) {
  const d = parseDateTime(value);
  if (!d) return '—';

  const options = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  return d.toLocaleDateString('en-US', options);
}

/**
 * Convert local datetime-local string to standard ISO-8601 UTC string
 */
export function toUtcIsoString(localDateTimeStr) {
  const d = parseDateTime(localDateTimeStr);
  if (!d) return null;
  return d.toISOString();
}
