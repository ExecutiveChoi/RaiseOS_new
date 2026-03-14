import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Bookmark, Bell, TrendingUp } from "lucide-react";
import type { Profile } from "@/types/user";
import { TIER_CAPABILITIES } from "@/types/user";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const typedProfile = profile as Profile | null;
  const tier = typedProfile?.subscriptionTier ?? "free";
  const caps = TIER_CAPABILITIES[tier];

  const searchesRemaining =
    caps.maxMonthlySearches === null
      ? "Unlimited"
      : Math.max(
          0,
          caps.maxMonthlySearches - (typedProfile?.monthlySearchesUsed ?? 0)
        );

  // Get recent search count
  const { count: recentSearchCount } = await supabase
    .from("search_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Get watchlist count
  const { count: watchlistCount } = await supabase
    .from("watchlist_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Get unread alerts
  const { count: alertCount } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {typedProfile?.fullName?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-gray-600 mt-1">
          Here&apos;s your SyndiCheck overview.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Searches Remaining"
          value={String(searchesRemaining)}
          subtitle="This month"
          icon={<Search className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          title="Sponsors Searched"
          value={String(recentSearchCount ?? 0)}
          subtitle="All time"
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          title="Watchlist"
          value={String(watchlistCount ?? 0)}
          subtitle="Sponsors tracked"
          icon={<Bookmark className="h-5 w-5 text-purple-500" />}
          locked={!caps.canAccessWatchlist}
        />
        <StatCard
          title="Alerts"
          value={String(alertCount ?? 0)}
          subtitle="Unread notifications"
          icon={<Bell className="h-5 w-5 text-amber-500" />}
          locked={!caps.canAccessWatchlist}
        />
      </div>

      {/* CTA for free users */}
      {tier === "free" && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-blue-900">
                  Upgrade to Pro for unlimited access
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  Get unlimited sponsor searches, full AI-generated vetting
                  reports, watchlist alerts, and more for $29/month.
                </p>
              </div>
              <Button asChild className="shrink-0">
                <Link href="/billing">Upgrade to Pro</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search a Sponsor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Search by name, CIK, or state to pull up SEC filings and trust
              scores.
            </p>
            <Button asChild>
              <Link href="/search">
                <Search className="h-4 w-4" />
                Search Sponsors
              </Link>
            </Button>
          </CardContent>
        </Card>

        {caps.canAccessWatchlist ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Watchlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Track sponsors and get alerts when new filings or enforcement
                actions are detected.
              </p>
              <Button asChild variant="outline">
                <Link href="/watchlist">
                  <Bookmark className="h-4 w-4" />
                  View Watchlist
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-base">
                Watchlist{" "}
                <span className="text-xs font-normal text-amber-600 ml-2">
                  Pro feature
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Track sponsors and get email alerts when their filings or trust
                scores change.
              </p>
              <Button asChild variant="outline">
                <Link href="/billing">Unlock with Pro</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  locked = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <Card className={locked ? "opacity-60" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {locked ? "—" : value}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {locked ? "Pro feature" : subtitle}
            </p>
          </div>
          <div className="opacity-70">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
