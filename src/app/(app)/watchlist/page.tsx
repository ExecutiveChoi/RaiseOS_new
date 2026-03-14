import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrustScoreBadge } from "@/components/sponsors/TrustScoreBadge";
import { Bookmark, Lock } from "lucide-react";
import { formatDollars } from "@/lib/utils";
import type { Profile } from "@/types/user";
import { TIER_CAPABILITIES } from "@/types/user";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.subscription_tier ?? "free") as Profile["subscriptionTier"];
  const caps = TIER_CAPABILITIES[tier];

  if (!caps.canAccessWatchlist) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
        <p className="text-gray-600 mt-2 mb-6">
          Track sponsors and get email alerts when new filings or enforcement
          actions are detected. Available on the Pro plan.
        </p>
        <Button asChild>
          <Link href="/billing">Upgrade to Pro — $29/mo</Link>
        </Button>
      </div>
    );
  }

  const { data: watchlistItems } = await supabase
    .from("watchlist_items")
    .select(`
      id,
      created_at,
      alert_on_new_filing,
      alert_on_enforcement,
      sponsors (
        id, name, slug, state, city,
        trust_score, total_offerings, total_amount_raised,
        has_enforcement_actions, latest_filing_date
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
          <p className="text-gray-600 mt-1">
            {watchlistItems?.length ?? 0} sponsor{(watchlistItems?.length ?? 0) !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/search">
            <Bookmark className="h-4 w-4" />
            Add sponsors
          </Link>
        </Button>
      </div>

      {!watchlistItems || watchlistItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Bookmark className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">Your watchlist is empty</p>
            <p className="text-sm text-gray-500 mt-1">
              Search for sponsors and add them to track filing updates.
            </p>
            <Button asChild className="mt-4">
              <Link href="/search">Search Sponsors</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {watchlistItems.map((item) => {
            const sponsor = (item.sponsors as unknown) as {
              id: string; name: string; slug: string; state: string | null;
              city: string | null; trust_score: number | null;
              total_offerings: number; total_amount_raised: number;
              has_enforcement_actions: boolean; latest_filing_date: string | null;
            } | null;
            if (!sponsor) return null;

            return (
              <Card key={item.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <TrustScoreBadge score={sponsor.trust_score} size="sm" />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/sponsor/${sponsor.slug}`}
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {sponsor.name}
                      </Link>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[sponsor.city, sponsor.state].filter(Boolean).join(", ")}
                      </p>
                      <div className="flex gap-4 mt-1 text-sm text-gray-600">
                        <span>{sponsor.total_offerings} offerings</span>
                        <span>{formatDollars(sponsor.total_amount_raised)} raised</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
