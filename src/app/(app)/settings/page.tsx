import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Profile } from "@/types/user";
import { TIER_CAPABILITIES } from "@/types/user";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const typedProfile = profile as Profile | null;
  const tier = typedProfile?.subscriptionTier ?? "free";
  const caps = TIER_CAPABILITIES[tier];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account preferences.</p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Email</span>
            <span className="font-medium">{typedProfile?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Name</span>
            <span className="font-medium">{typedProfile?.fullName ?? "—"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Role</span>
            <Badge variant="outline" className="capitalize">{typedProfile?.role ?? "lp"}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Plan</span>
            <div className="flex items-center gap-2">
              <Badge variant={tier === "free" ? "secondary" : "default"} className="capitalize">
                {tier}
              </Badge>
              {tier === "free" && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/billing">Upgrade</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Accredited Investor</span>
            <span className="font-medium">
              {typedProfile?.isAccreditedInvestor ? "Yes" : "Not verified"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Search Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Usage</CardTitle>
          <CardDescription>
            {caps.maxMonthlySearches === null
              ? "You have unlimited searches on your current plan."
              : `Free plan: ${caps.maxMonthlySearches} searches per month.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {caps.maxMonthlySearches !== null ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Used this month</span>
                <span className="font-medium">{typedProfile?.monthlySearchesUsed ?? 0} / {caps.maxMonthlySearches}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, ((typedProfile?.monthlySearchesUsed ?? 0) / caps.maxMonthlySearches) * 100)}%`,
                  }}
                />
              </div>
              {(typedProfile?.monthlySearchesUsed ?? 0) >= caps.maxMonthlySearches && (
                <p className="text-sm text-amber-600">
                  Limit reached.{" "}
                  <Link href="/billing" className="underline">
                    Upgrade to Pro
                  </Link>{" "}
                  for unlimited searches.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-green-600">Unlimited searches active.</p>
          )}
        </CardContent>
      </Card>

      {/* Notifications (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Notifications</CardTitle>
          <CardDescription>
            {caps.canAccessWatchlist
              ? "Configure when you receive watchlist alerts."
              : "Upgrade to Pro to enable watchlist email alerts."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {caps.canAccessWatchlist ? (
            <p className="text-sm text-gray-600">
              Email alerts are configured per sponsor in your{" "}
              <Link href="/watchlist" className="text-blue-600 underline">
                watchlist
              </Link>
              .
            </p>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/billing">Upgrade to enable alerts</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
