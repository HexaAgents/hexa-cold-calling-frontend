import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get today's date as YYYY-MM-DD in the user's local timezone.
 * Avoids `toISOString().slice(0,10)` which converts to UTC first.
 */
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Format a date-like value (ISO string or YYYY-MM-DD) for display,
 * avoiding UTC-to-local shifts that cause off-by-one day errors.
 * Parses at noon local time so timezone offsets never push to an adjacent day.
 */
export function formatLocalDate(
  value: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateStr = value.slice(0, 10);
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, options);
}
