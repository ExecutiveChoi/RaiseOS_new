import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import type { Profile } from "@/types/user";

export const metadata: Metadata = { title: "Billing" };

const PLANS = [
  {
    id: "pro",
    name: "Pro",
    price: 29,
    description: "For active LP investors",
    features: [
      "Unlimited sponsor searches",
      "Full AI vetting reports",
      "Watchlist (track unlimited sponsors)",
      "Email alerts for filing changes",
      "Score change notifications",
      "Priority search results",
    ],
    priceParam: "pro",
  },
  {
    id: "verified",
    name: "Verified GP",
    price: 99,
    description: "For syndicators who want to build trust",
    features: [
      "Claim and manage your profile",
      "Respond to investor reviews",
      "SyndiCheck Verified badge",
      "Profile view analytics",
      "All Pro LP features",
    ],
    priceParam: "verified",
  },
  {
    id: "premium",
    name: "Premium GP",
    price: 299,
    description: "For high-growth syndicators",
    features: [
      "All Verified GP features",
      "Lead gen dashboard",
      "See which LPs viewed your profile",
      "Investor intent signals",
      "Priority support",
    ],
    priceParam: "premium",
  },
];

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const typedProfile = profile as Profile | null;
  const currentTier = typedProfile?.subscriptionTier ?? "free";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-600 mt-1">
          Current plan:{" "}
          <Badge variant={currentTier === "free" ? "secondary" : "default"} className="capitalize ml-1">
            {currentTier}
          </Badge>
        </p>
      </div>

      {/* Setup required notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-blue-800">
            <strong>Setup required:</strong> Stripe integration needs to be configured.
            Add your Stripe keys to the environment variables to enable payments.
            See <code className="bg-blue-100 px-1 rounded">.env.example</code> for instructions.
          </p>
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentTier === plan.id;
          return (
            <Card key={plan.id} className={isCurrentPlan ? "border-blue-500 border-2" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isCurrentPlan && <Badge>Current plan</Badge>}
                </div>
                <p className="text-sm text-gray-500">{plan.description}</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-gray-500 pb-1">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? "Current plan" : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {currentTier !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Manage your billing, update payment methods, or cancel your subscription
              through the Stripe billing portal.
            </p>
            <Button variant="outline" disabled>
              Open Billing Portal (Stripe setup required)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
