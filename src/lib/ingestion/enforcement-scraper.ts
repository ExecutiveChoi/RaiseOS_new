/**
 * SEC Enforcement Action Scraper
 *
 * Scrapes two public SEC sources:
 * 1. Litigation Releases — https://www.sec.gov/litigation/litreleases.htm
 * 2. Administrative Proceedings — https://www.sec.gov/litigation/admin.htm
 *
 * Both are freely available HTML pages. No API key required.
 * Rate limit: same as EDGAR — stay under 10 req/sec.
 */

import * as cheerio from "cheerio";
import type { EnforcementAction } from "@/types/filing";

const SEC_BASE = "https://www.sec.gov";
const USER_AGENT = "SyndiCheck support@syndicheck.com";

const HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml",
};

export interface ScrapedEnforcement {
  secActionId: string;
  secUrl: string;
  title: string;
  summary: string;
  respondentNames: string[];
  severity: "low" | "medium" | "high" | "critical";
  actionDate: string | null;
  disgorgementAmount: number | null;
  penaltyAmount: number | null;
  source: "litigation_release" | "admin_proceeding";
}

/**
 * Scrape recent SEC litigation releases
 * Returns up to `limit` recent releases
 */
export async function scrapeLitigationReleases(
  limit = 50
): Promise<ScrapedEnforcement[]> {
  const url = `${SEC_BASE}/litigation/litreleases.htm`;

  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch litigation releases: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results: ScrapedEnforcement[] = [];

  // Litigation releases are in a table with date, release number, and description
  $("table tr").each((_, row) => {
    if (results.length >= limit) return false;

    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const dateText = $(cells[0]).text().trim();
    const linkEl = $(cells[1]).find("a").first();
    const title = linkEl.text().trim();
    const href = linkEl.attr("href");
    const fullText = $(cells[1]).text().trim();

    if (!title || !href) return;

    const secUrl = href.startsWith("http") ? href : `${SEC_BASE}${href}`;
    const actionId = href.match(/lr(\d+)/i)?.[1] ?? href;
    const actionDate = parseSECDate(dateText);

    // Extract respondent names from title (usually "SEC v. [Name]" or "In re [Name]")
    const respondentNames = extractRespondentNames(title);

    // Determine severity based on keywords
    const severity = classifyEnforcementSeverity(fullText);

    // Extract financial amounts
    const disgorgement = extractDollarAmount(fullText, [
      "disgorge",
      "disgorgement",
    ]);
    const penalty = extractDollarAmount(fullText, ["penalty", "penalties", "fine"]);

    results.push({
      secActionId: `LR-${actionId}`,
      secUrl,
      title,
      summary: fullText.slice(0, 500),
      respondentNames,
      severity,
      actionDate,
      disgorgementAmount: disgorgement,
      penaltyAmount: penalty,
      source: "litigation_release",
    });
  });

  return results;
}

/**
 * Scrape recent SEC administrative proceedings
 */
export async function scrapeAdminProceedings(
  limit = 50
): Promise<ScrapedEnforcement[]> {
  const url = `${SEC_BASE}/litigation/admin.htm`;

  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch admin proceedings: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results: ScrapedEnforcement[] = [];

  $("table tr").each((_, row) => {
    if (results.length >= limit) return false;

    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const dateText = $(cells[0]).text().trim();
    const linkEl = $(cells[1]).find("a").first();
    const title = linkEl.text().trim();
    const href = linkEl.attr("href");
    const fullText = $(cells[1]).text().trim();

    if (!title || !href) return;

    const secUrl = href.startsWith("http") ? href : `${SEC_BASE}${href}`;
    const actionId = href.match(/(\d+-\d+)/)?.[1] ?? href.split("/").pop() ?? href;
    const actionDate = parseSECDate(dateText);
    const respondentNames = extractRespondentNames(title);
    const severity = classifyEnforcementSeverity(fullText);
    const disgorgement = extractDollarAmount(fullText, ["disgorge", "disgorgement"]);
    const penalty = extractDollarAmount(fullText, ["penalty", "penalties", "fine"]);

    results.push({
      secActionId: `AP-${actionId}`,
      secUrl,
      title,
      summary: fullText.slice(0, 500),
      respondentNames,
      severity,
      actionDate,
      disgorgementAmount: disgorgement,
      penaltyAmount: penalty,
      source: "admin_proceeding",
    });
  });

  return results;
}

/**
 * Fetch and parse the full text of an enforcement action page
 * to get more detail (summary, full respondent list, amounts)
 */
export async function fetchEnforcementDetail(url: string): Promise<{
  fullSummary: string;
  additionalRespondents: string[];
  disgorgementAmount: number | null;
  penaltyAmount: number | null;
}> {
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      return { fullSummary: "", additionalRespondents: [], disgorgementAmount: null, penaltyAmount: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Get main content text
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const fullSummary = bodyText.slice(0, 1500);

    const disgorgementAmount = extractDollarAmount(bodyText, ["disgorge", "disgorgement"]);
    const penaltyAmount = extractDollarAmount(bodyText, ["penalty", "penalties", "fine"]);

    return {
      fullSummary,
      additionalRespondents: [],
      disgorgementAmount,
      penaltyAmount,
    };
  } catch {
    return { fullSummary: "", additionalRespondents: [], disgorgementAmount: null, penaltyAmount: null };
  }
}

// =============================================================
// HELPERS
// =============================================================

/**
 * Parse SEC date formats: "March 14, 2024" or "03/14/2024"
 */
export function parseSECDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.trim();
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Extract respondent names from enforcement action title
 * Handles patterns like:
 * - "SEC v. John Smith"
 * - "In the Matter of John Smith"
 * - "SEC Charges John Smith"
 * - "John Smith Charged With..."
 */
export function extractRespondentNames(title: string): string[] {
  const patterns = [
    /SEC\s+v\.?\s+(.+?)(?:\s+and\s+|,|$)/i,
    /In (?:the )?(?:Matter|Re)\s+(?:of\s+)?(.+?)(?:\s+and\s+|,|$)/i,
    /(?:SEC\s+)?Charges?\s+(.+?)(?:\s+(?:With|For|in)\s+|$)/i,
    /(?:SEC\s+)?(?:Files?|Obtains?|Announces?|Enters?)\s+.+?\s+(?:Against|v\.)\s+(.+?)(?:\s+(?:and|for|in)\s+|[,;]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const names = match[1]
        .split(/\s+and\s+/i)
        .map((n) => n.trim().replace(/[,;.]$/, ""))
        .filter((n) => n.length > 2 && n.length < 100);
      if (names.length > 0) return names;
    }
  }

  // Fallback: return the title trimmed (will be used for fuzzy matching)
  return [title.slice(0, 100)];
}

/**
 * Classify severity based on action content keywords
 */
export function classifyEnforcementSeverity(
  text: string
): "low" | "medium" | "high" | "critical" {
  const lower = text.toLowerCase();

  // Critical: fraud, Ponzi, criminal, prison
  if (
    lower.includes("ponzi") ||
    lower.includes("criminal") ||
    lower.includes("prison") ||
    lower.includes("jail") ||
    lower.includes("felony") ||
    (lower.includes("fraud") && lower.includes("million"))
  ) {
    return "critical";
  }

  // High: large fraud, significant violations
  if (
    lower.includes("fraud") ||
    lower.includes("misappropriat") ||
    lower.includes("embezzl") ||
    lower.includes("unregistered") ||
    lower.includes("willful")
  ) {
    return "high";
  }

  // Medium: violations, failures, improper conduct
  if (
    lower.includes("violation") ||
    lower.includes("failed to") ||
    lower.includes("improper") ||
    lower.includes("mislead") ||
    lower.includes("material misrepresent")
  ) {
    return "medium";
  }

  return "low";
}

/**
 * Extract dollar amount from text near specific keywords (returns cents)
 */
export function extractDollarAmount(
  text: string,
  keywords: string[]
): number | null {
  const lower = text.toLowerCase();

  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword);
    if (idx === -1) continue;

    // Look for dollar amounts within 200 chars of the keyword
    const window = text.slice(Math.max(0, idx - 50), idx + 200);
    const match = window.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?/i);

    if (match) {
      let amount = parseFloat(match[1].replace(/,/g, ""));
      const multiplier = match[2]?.toLowerCase();
      if (multiplier === "billion") amount *= 1_000_000_000;
      else if (multiplier === "million") amount *= 1_000_000;
      else if (multiplier === "thousand") amount *= 1_000;

      return Math.round(amount * 100); // Convert to cents
    }
  }

  return null;
}
