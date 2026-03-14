import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch sponsor
  const { data: sponsor, error: sponsorError } = await supabase
    .from("sponsors")
    .select("*")
    .or(`id.eq.${id},slug.eq.${id}`)
    .single();

  if (sponsorError || !sponsor) {
    return NextResponse.json({ error: "Sponsor not found" }, { status: 404 });
  }

  // Fetch related data in parallel
  const [filingsResult, enforcementResult, trustScoreResult, reviewSummaryResult] =
    await Promise.all([
      // Last 5 filings
      supabase
        .from("filings")
        .select("*")
        .eq("sponsor_id", sponsor.id)
        .order("filed_at", { ascending: false })
        .limit(5),

      // All enforcement actions
      supabase
        .from("enforcement_actions")
        .select("*")
        .eq("sponsor_id", sponsor.id)
        .order("action_date", { ascending: false }),

      // Latest trust score
      supabase
        .from("trust_scores")
        .select("*")
        .eq("sponsor_id", sponsor.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .single(),

      // Review summary
      supabase
        .from("reviews")
        .select("overall_rating")
        .eq("sponsor_id", sponsor.id)
        .eq("is_published", true),
    ]);

  // Compute review summary
  const reviews = reviewSummaryResult.data ?? [];
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  for (const review of reviews) {
    ratingDistribution[review.overall_rating] =
      (ratingDistribution[review.overall_rating] ?? 0) + 1;
  }
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length
      : 0;

  return NextResponse.json({
    sponsor,
    latestFilings: filingsResult.data ?? [],
    enforcementActions: enforcementResult.data ?? [],
    trustScore: trustScoreResult.data ?? null,
    reviewSummary: {
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution,
    },
  });
}
