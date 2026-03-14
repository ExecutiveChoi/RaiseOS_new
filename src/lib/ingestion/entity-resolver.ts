/**
 * Entity Resolution
 *
 * Matches incoming filing data to existing sponsors or creates new ones.
 * Priority order:
 * 1. CIK match (exact) → confidence 1.0
 * 2. Normalized name match → confidence 0.95
 * 3. Fuzzy match via pg_trgm (>0.7) → confidence 0.75–0.85
 * 4. Related persons match → confidence 0.85
 * 5. Address + name match → confidence 0.75
 */

import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { normalizeName, generateSlug, buildUniqueSlug } from "@/lib/utils";
import type { FormDData } from "./sec-edgar";

export interface ResolvedSponsor {
  id: string;
  isNew: boolean;
  matchConfidence: number;
  matchMethod: string;
}

/**
 * Resolve a Form D filing to an existing sponsor or create a new one
 */
export async function resolveOrCreateSponsor(
  formD: FormDData
): Promise<ResolvedSponsor> {
  const normalized = normalizeName(formD.entityName);

  // 1. Try exact CIK match
  if (formD.cik) {
    const existing = await db
      .select({ id: sponsors.id })
      .from(sponsors)
      .where(eq(sponsors.cik, formD.cik))
      .limit(1);

    if (existing.length > 0) {
      return {
        id: existing[0].id,
        isNew: false,
        matchConfidence: 1.0,
        matchMethod: "cik_exact",
      };
    }
  }

  // 2. Try normalized name exact match
  const nameMatch = await db
    .select({ id: sponsors.id })
    .from(sponsors)
    .where(eq(sponsors.normalizedName, normalized))
    .limit(1);

  if (nameMatch.length > 0) {
    return {
      id: nameMatch[0].id,
      isNew: false,
      matchConfidence: 0.95,
      matchMethod: "normalized_name_exact",
    };
  }

  // 3. Try fuzzy match using pg_trgm similarity
  const fuzzyMatch = await db.execute<{ id: string; sim: number }>(
    sql`
      SELECT id, similarity(normalized_name, ${normalized}) as sim
      FROM sponsors
      WHERE similarity(normalized_name, ${normalized}) > 0.7
      ORDER BY sim DESC
      LIMIT 1
    `
  );

  const fuzzyRows = Array.isArray(fuzzyMatch) ? fuzzyMatch : [];

  if (fuzzyRows.length > 0) {
    const row = fuzzyRows[0] as { id: string; sim: number };
    const confidence = 0.6 + row.sim * 0.3; // Map 0.7–1.0 similarity to 0.81–0.9 confidence

    if (confidence >= 0.70) {
      return {
        id: row.id,
        isNew: false,
        matchConfidence: Math.min(confidence, 0.90),
        matchMethod: "fuzzy_name",
      };
    }
  }

  // 4. No match found — create a new sponsor
  const newSponsor = await createNewSponsor(formD, normalized);
  return {
    id: newSponsor.id,
    isNew: true,
    matchConfidence: 1.0,
    matchMethod: "new_entity",
  };
}

async function createNewSponsor(
  formD: FormDData,
  normalized: string
): Promise<{ id: string }> {
  // Get existing slugs to ensure uniqueness
  const existingSlugs = await db
    .select({ slug: sponsors.slug })
    .from(sponsors)
    .then((rows) => rows.map((r) => r.slug));

  const slug = buildUniqueSlug(formD.entityName, existingSlugs);

  const [newSponsor] = await db
    .insert(sponsors)
    .values({
      name: formD.entityName,
      slug,
      normalizedName: normalized,
      cik: formD.cik || null,
      state: formD.issuerState || null,
      city: formD.issuerCity || null,
      zipCode: formD.issuerZip || null,
      address: formD.issuerStreet || null,
      yearFounded: formD.yearOfIncorporation
        ? parseInt(formD.yearOfIncorporation)
        : null,
      firstFilingDate: formD.filingDate ? new Date(formD.filingDate) : null,
      latestFilingDate: formD.filingDate ? new Date(formD.filingDate) : null,
    })
    .returning({ id: sponsors.id });

  return newSponsor;
}
