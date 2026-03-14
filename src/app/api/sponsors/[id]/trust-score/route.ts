import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sponsors,
  filings,
  enforcementActions,
  brokerRecords,
  reviews,
  trustScores,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeTrustScore } from "@/lib/ai/scoring";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/sponsors/:id/trust-score
 *
 * Returns the latest trust score for a sponsor, or computes one on-demand
 * if none exists. Public endpoint — no auth required (scores are public data).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  try {
    // Verify sponsor exists
    const sponsorRows = await db
      .select({ id: sponsors.id, name: sponsors.name })
      .from(sponsors)
      .where(eq(sponsors.id, id))
      .limit(1);

    if (!sponsorRows.length) {
      return NextResponse.json({ error: "Sponsor not found" }, { status: 404 });
    }

    // Check for a recent cached score (< 24 hours old)
    const cachedScore = await db
      .select()
      .from(trustScores)
      .where(eq(trustScores.sponsorId, id))
      .orderBy(desc(trustScores.computedAt))
      .limit(1);

    if (cachedScore.length > 0) {
      const ageMs =
        Date.now() - new Date(cachedScore[0].computedAt).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);

      if (ageHours < 24) {
        return NextResponse.json({
          cached: true,
          computedAt: cachedScore[0].computedAt,
          score: {
            overallScore: cachedScore[0].overallScore,
            filingComplianceScore: cachedScore[0].filingComplianceScore,
            enforcementScore: cachedScore[0].enforcementScore,
            brokerRecordScore: cachedScore[0].brokerRecordScore,
            propertyVerificationScore: cachedScore[0].propertyVerificationScore,
            communitySentimentScore: cachedScore[0].communitySentimentScore,
            filingConsistencyScore: cachedScore[0].filingConsistencyScore,
            factors: cachedScore[0].factors,
            dataCompleteness: cachedScore[0].dataCompleteness,
          },
        });
      }
    }

    // Compute fresh score — fetch all inputs in parallel
    const [sponsorFilings, sponsorEnforcement, sponsorBrokers, sponsorReviews] =
      await Promise.all([
        db.select().from(filings).where(eq(filings.sponsorId, id)),
        db
          .select()
          .from(enforcementActions)
          .where(eq(enforcementActions.sponsorId, id)),
        db
          .select()
          .from(brokerRecords)
          .where(eq(brokerRecords.sponsorId, id)),
        db
          .select({
            overallRating: reviews.overallRating,
            isVerifiedInvestor: reviews.isVerifiedInvestor,
            createdAt: reviews.createdAt,
          })
          .from(reviews)
          .where(eq(reviews.sponsorId, id)),
      ]);

    const scoreResult = computeTrustScore({
      filings: sponsorFilings.map((f) => ({
        filedAt: String(f.filedAt),
        exemption: f.exemption,
        totalOfferingAmount: f.totalOfferingAmount,
        totalAmountSold: f.totalAmountSold,
        filingType: f.filingType,
      })),
      enforcementActions: sponsorEnforcement.map((e) => ({
        severity: e.severity,
        actionDate: e.actionDate ? String(e.actionDate) : null,
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
        createdAt: String(r.createdAt),
      })),
    });

    // Persist the new score
    const now = new Date();
    await db.insert(trustScores).values({
      sponsorId: id,
      overallScore: scoreResult.overallScore,
      filingComplianceScore: scoreResult.filingComplianceScore,
      enforcementScore: scoreResult.enforcementScore,
      brokerRecordScore: scoreResult.brokerRecordScore,
      propertyVerificationScore: scoreResult.propertyVerificationScore,
      communitySentimentScore: scoreResult.communitySentimentScore,
      filingConsistencyScore: scoreResult.filingConsistencyScore,
      factors: scoreResult.factors as Record<string, unknown>,
      dataCompleteness: scoreResult.dataCompleteness.toFixed(2),
      computedAt: now,
    });

    // Update denormalized trust score on sponsor
    await db
      .update(sponsors)
      .set({
        trustScore: scoreResult.overallScore,
        trustScoreComputedAt: now,
        updatedAt: now,
      })
      .where(eq(sponsors.id, id));

    return NextResponse.json({
      cached: false,
      computedAt: now.toISOString(),
      score: scoreResult,
    });
  } catch (error) {
    console.error("Trust score computation error:", error);
    return NextResponse.json(
      { error: "Failed to compute trust score" },
      { status: 500 }
    );
  }
}
