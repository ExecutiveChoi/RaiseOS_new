import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a URL-friendly slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "");
}

/**
 * Normalize a name for entity matching (strip legal suffixes, lowercase)
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(llc|inc|corp|ltd|lp|l\.p\.|l\.l\.c\.|incorporated|limited|company|co\.|partners|group)\b/gi,
      ""
    )
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format a dollar amount from cents
 */
export function formatDollars(cents: number | null): string {
  if (cents === null || cents === 0) return "N/A";
  const dollars = cents / 100;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format exemption type for display
 */
export function formatExemption(exemption: string | null): string {
  if (!exemption) return "Unknown";
  if (exemption === "506b") return "Reg D 506(b)";
  if (exemption === "506c") return "Reg D 506(c)";
  return exemption;
}

/**
 * Pad a CIK number to 10 digits (required for SEC EDGAR API)
 */
export function padCIK(cik: string): string {
  return cik.padStart(10, "0");
}

/**
 * Build a unique slug, appending a number if the base slug is taken
 */
export function buildUniqueSlug(base: string, existingSlugs: string[]): string {
  let slug = generateSlug(base);
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${generateSlug(base)}-${counter}`;
    counter++;
  }
  return slug;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}
