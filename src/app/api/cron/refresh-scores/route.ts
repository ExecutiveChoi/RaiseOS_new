import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sponsors, filings, enforcementActions, brokerRecords, trustScores, reviews } from "@/lib/db/schema";
import { eq, desc, isNotNull, sql } from "drizzle-orm";
import { computeTrustScore } from "@/lib/ai/scoring";

function verifyRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { processed: 0, errors: 0 };

  try {
    // Get all sponsors that need score refresh
    const sponsorList = await db
      .select({ id: sponsors.id })
      .from(sponsors)
      .limit(100); // Process in batches

    for (const sponsor of sponsorList) {
      try {
        const [
          sponsorFilings,
          sponsorEnforcement,
          sponsorBrokers,
          sponsorReviews,
        ] = await Promise.all([
          db.select().from(filings).where(eq(filings.sponsorId, sponsor.id)),
          db.select().from(enforcementActions).where(eq(enforcementActions.sponsorId, sponsor.id)),
          db.select().from(brokerRecords).where(eq(brokerRecords.sponsorId, sponsor.id)),
          db.select().from(reviews).where(eq(reviews.sponsorId, sponsor.id)),
        ]);

        const scoreResult = computeTrustScore({
          filings: sponsorFilings.map((f) => ({
            filedAt: f.filedAt.toISOString(),
            exemption: f.exemption,
            totalOfferingAmount: f.totalOfferingAmount,
            totalAmountSold: f.totalAmountSold,
            filingType: f.filingType,
          })),
          enforcementActions: sponsorEnforcement.map((e) => ({
            severity: e.severity,
            actionDate: e.actionDate?.toISOString() ?? null,
          })),
          brokerRecords: sponsorBrokers.map((b) => ({
            totalDisclosures: b.totalDisclosures,
            customerDisputes: b.customerDisputes,
            regulatoryActions: b.regulatoryActions,
            criminalRecords: b.criminalRecords,
          })),
          propertyClaims: [],
          reviews: sponsorReviews.map((r) => ({
            overallRating: r.overallRating,
            isVerifiedInvestor: r.isVerifiedInvestor ?? false,
            createdAt: r.createdAt.toISOString(),
          })),
        });

        // Insert trust score snapshot
        await db.insert(trustScores).values({
          sponsorId: sponsor.id,
          overallScore: scoreResult.overallScore,
          filingComplianceScore: scoreResult.filingComplianceScore,
          enforcementScore: scoreResult.enforcementScore,
          brokerRecordScore: scoreResult.brokerRecordScore,
          propertyVerificationScore: scoreResult.propertyVerificationScore,
          communitySentimentScore: scoreResult.communitySentimentScore,
          filingConsistencyScore: scoreResult.filingConsistencyScore,
          factors: scoreResult.factors,
          dataCompleteness: String(scoreResult.dataCompleteness),
        });

        // Update sponsor's denormalized trust score
        await db
          .update(sponsors)
          .set({
            trustScore: scoreResult.overallScore,
            trustScoreComputedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sponsors.id, sponsor.id));

        results.processed++;
      } catch (err) {
        console.error(`Error computing score for sponsor ${sponsor.id}:`, err);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Refreshed scores for ${results.processed} sponsors`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
