import { type NextRequest, NextResponse } from "next/server";
import { searchRecentFormDs, fetchFormD } from "@/lib/ingestion/sec-edgar";
import { resolveOrCreateSponsor } from "@/lib/ingestion/entity-resolver";
import { db } from "@/lib/db";
import { filings, sponsors } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { format, subDays } from "date-fns";

// Protect cron endpoint with secret
function verifyRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return false;

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    processed: 0,
    newSponsors: 0,
    newFilings: 0,
    errors: 0,
  };

  try {
    // Fetch yesterday's Form D filings
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), 1), "yyyy-MM-dd");

    let from = 0;
    const pageSize = 40;
    let hasMore = true;

    while (hasMore) {
      const searchResult = await searchRecentFormDs(startDate, endDate, from, pageSize);
      const hits = searchResult.hits?.hits ?? [];

      if (hits.length === 0) {
        hasMore = false;
        break;
      }

      for (const hit of hits) {
        try {
          const source = hit._source;
          const cik = source.entity_id;
          const accessionNumber = hit._id.replace(/:/g, "-");

          // Check if we already have this filing
          const existing = await db
            .select({ id: filings.id })
            .from(filings)
            .where(eq(filings.accessionNumber, accessionNumber))
            .limit(1);

          if (existing.length > 0) {
            results.processed++;
            continue; // Already ingested
          }

          // Fetch the full Form D data
          const formD = await fetchFormD(cik, accessionNumber);

          if (!formD) {
            results.errors++;
            continue;
          }

          // Skip non-real-estate filings
          const industryLower = formD.industryGroup.toLowerCase();
          if (
            formD.industryGroup &&
            !industryLower.includes("real estate") &&
            !industryLower.includes("pooled")
          ) {
            results.processed++;
            continue;
          }

          // Resolve or create sponsor
          const resolved = await resolveOrCreateSponsor(formD);
          if (resolved.isNew) results.newSponsors++;

          // Map exemption
          let exemption: "506b" | "506c" | "other" | null = null;
          if (formD.federalExemptions.includes("506b")) exemption = "506b";
          else if (formD.federalExemptions.includes("506c")) exemption = "506c";
          else if (formD.federalExemptions.length > 0) exemption = "other";

          // Insert filing
          await db.insert(filings).values({
            sponsorId: resolved.id,
            accessionNumber,
            secUrl: formD.secUrl,
            filingType: formD.formType === "D/A" ? "form_d_a" : "form_d",
            filedAt: new Date(formD.filingDate),
            issuerName: formD.entityName,
            entityType: formD.entityType || null,
            industryGroup: formD.industryGroup || null,
            exemption,
            totalOfferingAmount: formD.totalOfferingAmount,
            totalAmountSold: formD.totalAmountSold,
            totalRemaining: formD.totalRemaining,
            minimumInvestmentAmount: formD.minimumInvestmentAccepted,
            totalNumberAlreadyInvested: formD.totalNumberAlreadyInvested,
            hasSalesCompensation: formD.hasSalesCompensation,
            hasNonAccreditedInvestors: formD.hasNonAccreditedInvestors,
            numberNonAccredited: formD.numberNonAccredited,
            relatedPersons: formD.relatedPersons,
            rawData: formD as unknown as Record<string, unknown>,
          });

          results.newFilings++;

          // Update sponsor stats
          await db
            .update(sponsors)
            .set({
              totalOfferings: sql`${sponsors.totalOfferings} + 1`,
              totalAmountRaised: sql`${sponsors.totalAmountRaised} + ${formD.totalAmountSold ?? 0}`,
              latestFilingDate: new Date(formD.filingDate),
              updatedAt: new Date(),
            })
            .where(eq(sponsors.id, resolved.id));

          results.processed++;

          // Small delay to stay within SEC rate limits
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (err) {
          console.error("Error processing filing:", err);
          results.errors++;
        }
      }

      from += pageSize;
      if (hits.length < pageSize) hasMore = false;
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Processed ${results.processed} filings, created ${results.newSponsors} new sponsors, ${results.newFilings} new filings`,
    });
  } catch (error) {
    console.error("Form D ingestion error:", error);
    return NextResponse.json(
      { success: false, error: String(error), ...results },
      { status: 500 }
    );
  }
}
