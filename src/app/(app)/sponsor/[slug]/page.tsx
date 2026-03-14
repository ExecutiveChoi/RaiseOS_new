import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrustScoreBadge } from "@/components/sponsors/TrustScoreBadge";
import { TrustScoreBreakdown } from "@/components/sponsors/TrustScoreBreakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle,
  Lock,
  ExternalLink,
} from "lucide-react";
import { formatDollars, formatDate, formatExemption } from "@/lib/utils";
import type { TrustScore } from "@/types/sponsor";
import type { Profile } from "@/types/user";
import { TIER_CAPABILITIES } from "@/types/user";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("name, city, state, description")
    .eq("slug", slug)
    .single();

  if (!sponsor) return { title: "Sponsor Not Found" };

  return {
    title: `${sponsor.name} — Trust Report`,
    description: `Vetting report for ${sponsor.name}${sponsor.city ? `, ${sponsor.city}` : ""}${sponsor.state ? `, ${sponsor.state}` : ""}. View SEC filings, trust score, and community reviews.`,
  };
}

export default async function SponsorProfilePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const typedProfile = profile as Profile | null;
  const tier = typedProfile?.subscriptionTier ?? "free";
  const caps = TIER_CAPABILITIES[tier];

  // Fetch sponsor
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!sponsor) notFound();

  // Fetch related data in parallel
  const [filingsRes, enforcementRes, trustScoreRes, reviewsRes] =
    await Promise.all([
      supabase
        .from("filings")
        .select("*")
        .eq("sponsor_id", sponsor.id)
        .order("filed_at", { ascending: false })
        .limit(10),

      supabase
        .from("enforcement_actions")
        .select("*")
        .eq("sponsor_id", sponsor.id)
        .order("action_date", { ascending: false }),

      supabase
        .from("trust_scores")
        .select("*")
        .eq("sponsor_id", sponsor.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("reviews")
        .select("overall_rating, communication_rating, transparency_rating, title, body, created_at, is_verified_investor, deal_type")
        .eq("sponsor_id", sponsor.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const filings = filingsRes.data ?? [];
  const enforcementActions = enforcementRes.data ?? [];
  const trustScore = trustScoreRes.data as TrustScore | null;
  const reviews = reviewsRes.data ?? [];

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length
      : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/search"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <TrustScoreBadge score={sponsor.trust_score} size="lg" showLabel />

        <div className="flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{sponsor.name}</h1>
            {sponsor.is_claimed && (
              <Badge variant="success" className="mt-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
            {(sponsor.city || sponsor.state) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[sponsor.city, sponsor.state].filter(Boolean).join(", ")}
              </span>
            )}
            {sponsor.first_filing_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Since {new Date(sponsor.first_filing_date).getFullYear()}
              </span>
            )}
            {sponsor.total_amount_raised > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {formatDollars(sponsor.total_amount_raised)} raised
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            <span className="text-gray-600">
              {sponsor.total_offerings} offering{sponsor.total_offerings !== 1 ? "s" : ""}
            </span>
            {avgRating && (
              <span className="text-gray-600">
                ★ {avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Button asChild size="sm">
              <Link href={`/reviews/new/${sponsor.id}`}>Write a Review</Link>
            </Button>
            {caps.canAccessWatchlist && (
              <Button variant="outline" size="sm">
                + Watchlist
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Red Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Quick Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FlagRow
              label="Enforcement actions"
              isFlag={sponsor.has_enforcement_actions}
              okText="No enforcement actions found"
              flagText={`${enforcementActions.length} enforcement action${enforcementActions.length !== 1 ? "s" : ""} found`}
            />
            <FlagRow
              label="FINRA disclosures"
              isFlag={sponsor.has_finra_flags}
              okText="No FINRA disclosures found"
              flagText="FINRA disclosures on record"
            />
            <FlagRow
              label="SEC Form D filings"
              isFlag={filings.length === 0}
              okText={`${filings.length} Form D filing${filings.length !== 1 ? "s" : ""} on file`}
              flagText="No SEC filings found"
            />
            <FlagRow
              label="Profile claimed"
              isFlag={!sponsor.is_claimed}
              okText="Profile claimed and verified"
              flagText="Profile not yet claimed by sponsor"
              isWarning={!sponsor.is_claimed}
            />
          </div>
        </CardContent>
      </Card>

      {/* Trust Score Breakdown */}
      {trustScore ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trust Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <TrustScoreBreakdown trustScore={trustScore} />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center text-gray-500">
            <p className="text-sm">
              Trust score not yet computed. Scores are calculated nightly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filing History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent SEC Filings</CardTitle>
        </CardHeader>
        <CardContent>
          {filings.length === 0 ? (
            <p className="text-sm text-gray-500">No filings found.</p>
          ) : (
            <div className="space-y-3">
              {filings.map((filing) => (
                <div
                  key={filing.id}
                  className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{filing.issuer_name}</span>
                      {filing.exemption && (
                        <Badge variant="outline" className="text-xs">
                          {formatExemption(filing.exemption)}
                        </Badge>
                      )}
                      {filing.filing_type === "form_d_a" && (
                        <Badge variant="secondary" className="text-xs">Amendment</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Filed: {formatDate(filing.filed_at)}
                      {filing.total_offering_amount &&
                        ` · Offering: ${formatDollars(filing.total_offering_amount)}`}
                      {filing.total_amount_sold &&
                        ` · Sold: ${formatDollars(filing.total_amount_sold)}`}
                    </p>
                  </div>
                  {filing.sec_url && (
                    <a
                      href={filing.sec_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
              {sponsor.total_offerings > filings.length && (
                <Link
                  href={`/sponsor/${slug}/filings`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View all {sponsor.total_offerings} filings →
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enforcement Actions */}
      {enforcementActions.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Enforcement Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enforcementActions.map((action) => (
                <div key={action.id} className="py-2 border-b last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{action.title}</p>
                      {action.summary && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {action.summary}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {action.action_date && formatDate(action.action_date)}
                      </p>
                    </div>
                    <Badge variant="danger" className="shrink-0 capitalize">
                      {action.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Report — Paywall gate */}
      <Card className={caps.canAccessFullReports ? "" : "border-dashed"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {caps.canAccessFullReports ? (
              "AI Vetting Report"
            ) : (
              <>
                <Lock className="h-4 w-4 text-gray-400" />
                AI Vetting Report
                <Badge variant="warning" className="ml-1">Pro</Badge>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {caps.canAccessFullReports ? (
            <AIReportSection sponsorId={sponsor.id} />
          ) : (
            <div className="text-center py-6">
              <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">
                Full AI report available on Pro plan
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Get a detailed executive summary, risk analysis, peer comparison,
                and investor considerations — generated from all available data.
              </p>
              <Button asChild className="mt-4">
                <Link href="/billing">Upgrade to Pro — $29/mo</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Community Reviews */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Community Reviews</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href={`/reviews/new/${sponsor.id}`}>Write Review</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">
              No reviews yet. Be the first to share your experience.
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={`${review.created_at}-${review.overall_rating}`} className="py-3 border-b last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.overall_rating} />
                      {review.is_verified_investor && (
                        <Badge variant="success" className="text-xs">Verified LP</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  {review.title && (
                    <p className="font-medium text-sm mt-1">{review.title}</p>
                  )}
                  <p className="text-sm text-gray-700 mt-1 line-clamp-3">{review.body}</p>
                </div>
              ))}
              <Link
                href={`/sponsor/${slug}/reviews`}
                className="text-sm text-blue-600 hover:underline"
              >
                View all reviews →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legal Disclaimer */}
      <div className="bg-gray-50 border rounded-lg p-4 text-xs text-gray-500">
        <p>
          <strong>Disclaimer:</strong> SyndiCheck provides informational data
          aggregation only. Trust scores and reports are not investment advice
          and should not be the sole basis for any investment decision.
          SyndiCheck does not verify the accuracy of data from third-party
          sources including the SEC, FINRA, and county records. Always conduct
          your own due diligence and consult qualified legal and financial
          advisors before investing in any private offering.
        </p>
      </div>
    </div>
  );
}

function FlagRow({
  label,
  isFlag,
  okText,
  flagText,
  isWarning = false,
}: {
  label: string;
  isFlag: boolean;
  okText: string;
  flagText: string;
  isWarning?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {isFlag ? (
        isWarning ? (
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        )
      ) : (
        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
      )}
      <span className={isFlag && !isWarning ? "text-red-700" : isFlag ? "text-amber-700" : "text-gray-700"}>
        {isFlag ? flagText : okText}
      </span>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-amber-400" : "text-gray-200"}>
          ★
        </span>
      ))}
    </div>
  );
}

function AIReportSection({ sponsorId }: { sponsorId: string }) {
  return (
    <div className="text-sm text-gray-600">
      <p className="text-gray-500 italic">
        AI report loading... (Connect OpenAI API key to enable)
      </p>
    </div>
  );
}
