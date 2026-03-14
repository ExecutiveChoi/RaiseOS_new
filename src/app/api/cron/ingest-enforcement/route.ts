import { type NextRequest, NextResponse } from "next/server";
import {
  scrapeLitigationReleases,
  scrapeAdminProceedings,
} from "@/lib/ingestion/enforcement-scraper";
import { db } from "@/lib/db";
import { enforcementActions, sponsors } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { normalizeName } from "@/lib/utils";

function verifyRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Try to match enforcement respondent names to existing sponsors
 * using normalized name similarity.
 */
async function matchSponsor(respondentNames: string[]): Promise<{
  sponsorId: string | null;
  confidence: number;
}> {
  if (respondentNames.length === 0) return { sponsorId: null, confidence: 0 };

  for (const name of respondentNames) {
    const normalized = normalizeName(name);
    if (!normalized) continue;

    // Exact normalized name match
    const exactMatch = await db
      .select({ id: sponsors.id })
      .from(sponsors)
      .where(eq(sponsors.normalizedName, normalized))
      .limit(1);

    if (exactMatch.length > 0) {
      return { sponsorId: exactMatch[0].id, confidence: 0.95 };
    }

    // Fuzzy match via pg_trgm similarity
    const fuzzyMatch = await db.execute(
      sql`SELECT id FROM sponsors WHERE similarity(normalized_name, ${normalized}) > 0.6 ORDER BY similarity(normalized_name, ${normalized}) DESC LIMIT 1`
    );
    const fuzzyRows = Array.isArray(fuzzyMatch) ? fuzzyMatch : [];
    if (fuzzyRows.length > 0) {
      const row = fuzzyRows[0] as { id: string };
      return { sponsorId: row.id, confidence: 0.7 };
    }
  }

  return { sponsorId: null, confidence: 0 };
}

export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    litigationProcessed: 0,
    adminProcessed: 0,
    newActions: 0,
    matched: 0,
    errors: 0,
  };

  try {
    // Scrape both sources
    const [litigationReleases, adminProceedings] = await Promise.all([
      scrapeLitigationReleases(100),
      scrapeAdminProceedings(100),
    ]);

    const allActions = [...litigationReleases, ...adminProceedings];

    for (const action of allActions) {
      try {
        // Check if we already have this action
        const existing = await db
          .select({ id: enforcementActions.id })
          .from(enforcementActions)
          .where(eq(enforcementActions.secActionId, action.secActionId))
          .limit(1);

        if (existing.length > 0) {
          if (action.source === "litigation_release") results.litigationProcessed++;
          else results.adminProcessed++;
          continue;
        }

        // Try to match to a sponsor
        const { sponsorId, confidence } = await matchSponsor(
          action.respondentNames
        );

        // Insert enforcement action
        await db.insert(enforcementActions).values({
          sponsorId,
          secActionId: action.secActionId,
          secUrl: action.secUrl,
          title: action.title,
          summary: action.summary,
          respondentNames: action.respondentNames,
          severity: action.severity,
          actionDate: action.actionDate ? new Date(action.actionDate) : null,
          disgorgementAmount: action.disgorgementAmount,
          penaltyAmount: action.penaltyAmount,
          matchedAutomatically: true,
          matchConfidence: sponsorId ? confidence.toFixed(2) : null,
          reviewedByAdmin: false,
          rawData: action as unknown as Record<string, unknown>,
        });

        results.newActions++;

        // If matched to a sponsor, flag them
        if (sponsorId) {
          results.matched++;
          await db
            .update(sponsors)
            .set({
              hasEnforcementActions: true,
              updatedAt: new Date(),
            })
            .where(eq(sponsors.id, sponsorId));
        }

        if (action.source === "litigation_release") results.litigationProcessed++;
        else results.adminProcessed++;

        // Rate limit: be respectful to SEC servers
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (err) {
        console.error("Error processing enforcement action:", err);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Ingested ${results.newActions} new enforcement actions, matched ${results.matched} to sponsors`,
    });
  } catch (error) {
    console.error("Enforcement ingestion error:", error);
    return NextResponse.json(
      { success: false, error: String(error), ...results },
      { status: 500 }
    );
  }
}
