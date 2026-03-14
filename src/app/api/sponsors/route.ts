import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  state: z.string().length(2).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  sortBy: z.enum(["trust_score", "total_raised", "latest_filing"]).optional().default("trust_score"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user profile for tier checking
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, monthly_searches_used, monthly_searches_reset_at, stripe_customer_id")
    .eq("id", user.id)
    .single();

  // Rate limit for free tier
  if (profile?.subscription_tier === "free") {
    const FREE_LIMIT = 3;
    const resetAt = new Date(profile.monthly_searches_reset_at);
    const now = new Date();
    const daysSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60 * 24);

    let searchesUsed = profile.monthly_searches_used;

    if (daysSinceReset >= 30) {
      // Reset counter
      await supabase
        .from("profiles")
        .update({ monthly_searches_used: 0, monthly_searches_reset_at: now.toISOString() })
        .eq("id", user.id);
      searchesUsed = 0;
    }

    if (searchesUsed >= FREE_LIMIT) {
      return NextResponse.json(
        {
          error: "Monthly search limit reached",
          searchesUsed,
          limit: FREE_LIMIT,
          upgradeUrl: "/billing",
        },
        { status: 429 }
      );
    }
  }

  // Parse and validate query params
  const { searchParams } = new URL(request.url);
  const params = searchSchema.safeParse(Object.fromEntries(searchParams));

  if (!params.success) {
    return NextResponse.json(
      { error: "Invalid search parameters", details: params.error.flatten() },
      { status: 400 }
    );
  }

  const { q, state, minScore, sortBy, page, limit } = params.data;
  const offset = (page - 1) * limit;

  // Build Supabase query
  let query = supabase.from("sponsors").select(
    `
    id, name, slug, state, city,
    trust_score, trust_score_computed_at,
    total_offerings, total_amount_raised,
    total_reviews, average_rating,
    has_enforcement_actions, has_finra_flags,
    is_claimed, latest_filing_date, first_filing_date
  `,
    { count: "exact" }
  );

  // Text search using normalized_name (pg_trgm)
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  // State filter
  if (state) {
    query = query.eq("state", state.toUpperCase());
  }

  // Min score filter
  if (minScore !== undefined) {
    query = query.gte("trust_score", minScore);
  }

  // Sorting
  if (sortBy === "trust_score") {
    query = query.order("trust_score", { ascending: false, nullsFirst: false });
  } else if (sortBy === "total_raised") {
    query = query.order("total_amount_raised", { ascending: false });
  } else if (sortBy === "latest_filing") {
    query = query.order("latest_filing_date", { ascending: false, nullsFirst: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data: sponsorData, count, error } = await query;

  if (error) {
    console.error("Sponsor search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  // Log search (fire and forget)
  supabase
    .from("search_logs")
    .insert({
      user_id: user.id,
      query: q ?? "",
      results_count: count ?? 0,
    })
    .then(() => {});

  // Increment search count for free users
  if (profile?.subscription_tier === "free" && q) {
    supabase
      .from("profiles")
      .update({
        monthly_searches_used: (profile.monthly_searches_used ?? 0) + 1,
      })
      .eq("id", user.id)
      .then(() => {});
  }

  return NextResponse.json({
    sponsors: sponsorData ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
