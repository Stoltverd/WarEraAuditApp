/**
 * Universal Date Formatting Utilities
 * Standardizes all date presentation across War Era Sovereign application to DD/MM/YYYY format.
 */

/**
 * Format any date input (ISO string, timestamp ms, Date object, or YYYY-MM-DD string) to DD/MM/YYYY.
 * Prevents timezone offset rollback on date-only strings (e.g., "2026-10-09").
 * 
 * @param val The date value to format
 * @param fallback Fallback string if value is null/undefined/invalid (default: '—')
 * @returns Formatted date string in DD/MM/YYYY format
 */
export function formatDateDDMMYYYY(
  val?: string | number | Date | null,
  fallback = '—'
): string {
  if (val === null || val === undefined || val === '') {
    return fallback;
  }

  // Handle pure YYYY-MM-DD strings without timezone shift
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${day}/${month}/${year}`;
    }

    // Already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
  }

  try {
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) {
      return fallback;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());

    return `${day}/${month}/${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Format date and time to DD/MM/YYYY HH:mm
 */
export function formatDateTimeDDMMYYYY(
  val?: string | number | Date | null,
  fallback = '—'
): string {
  if (val === null || val === undefined || val === '') {
    return fallback;
  }

  try {
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) {
      return fallback;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return fallback;
  }
}

/**
 * Format a start and end date range to DD/MM/YYYY – DD/MM/YYYY
 */
export function formatDateRangeDDMMYYYY(
  start?: string | number | Date | null,
  end?: string | number | Date | null,
  separator = ' – '
): string {
  const startFormatted = formatDateDDMMYYYY(start, 'Earliest');
  const endFormatted = formatDateDDMMYYYY(end, 'Latest');
  return `${startFormatted}${separator}${endFormatted}`;
}

/**
 * Get current system date in DD/MM/YYYY format
 */
export function getTodayDDMMYYYY(): string {
  return formatDateDDMMYYYY(new Date());
}

/**
 * Normalizes input date strings (which might be DD/MM/YYYY or YYYY-MM-DD or ISO) to YYYY-MM-DD
 * for internal storage or database operations.
 */
export function normalizeDateToYYYYMMDD(val?: string | null): string {
  if (!val) return new Date().toISOString().split('T')[0];
  const trimmed = val.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // If DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try parsing Date
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fallback
  }

  return new Date().toISOString().split('T')[0];
}
