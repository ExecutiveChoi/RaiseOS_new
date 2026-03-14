import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Shield,
  BarChart3,
  Star,
  CheckCircle,
  ArrowRight,
  Lock,
} from "lucide-react";
import { TrustScoreBadge } from "@/components/sponsors/TrustScoreBadge";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">SyndiCheck</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-700 border-blue-200">
            Powered by SEC EDGAR · FINRA · Community Reviews
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Vet your syndicator
            <br />
            <span className="text-blue-600">before you invest</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            SyndiCheck aggregates SEC filings, FINRA records, and LP community
            reviews into a unified trust score for every real estate syndicator.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                <Search className="h-5 w-5" />
                Search Sponsors Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#how-it-works">
                How it works
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            No credit card required · 3 free searches/month
          </p>
        </div>
      </section>

      {/* Demo Trust Score */}
      <section className="py-16 px-4 border-b">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-8">
            Sample Trust Report
          </h2>
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <TrustScoreBadge score={78} size="lg" showLabel />
                <div className="flex-1">
                  <h3 className="text-lg font-bold">Acme Capital Partners LLC</h3>
                  <p className="text-sm text-gray-500">Dallas, TX · Since 2018</p>
                  <p className="text-sm text-gray-600 mt-1">
                    12 offerings · $45.2M raised · 506(c)
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="success">No enforcement</Badge>
                    <Badge variant="success">FINRA clear</Badge>
                    <Badge variant="warning">2 unverified properties</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                {[
                  { label: "Filing Compliance", score: 82 },
                  { label: "Enforcement Record", score: 100 },
                  { label: "Broker History", score: 80 },
                  { label: "Community Rating", score: 84 },
                ].map(({ label, score }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <span className="w-36 text-gray-600 shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="text-gray-700 font-medium w-8 text-right">{score}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 px-4 border-b">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-12">
            How SyndiCheck works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step
              number={1}
              icon={<Search className="h-6 w-6 text-blue-600" />}
              title="Search"
              description="Enter a syndicator's name, company, or SEC CIK number. We query the SEC EDGAR database in real time."
            />
            <Step
              number={2}
              icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              title="Review the Report"
              description="See their full filing history, enforcement actions, FINRA records, property verification results, and community reviews."
            />
            <Step
              number={3}
              icon={<Shield className="h-6 w-6 text-blue-600" />}
              title="Decide"
              description="Use the trust score and AI-generated risk report to inform your due diligence — then invest with more confidence."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-gray-600 mb-12">
            For LP investors and GP syndicators.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PricingCard
              tier="Free"
              price="$0"
              description="For investors starting out"
              features={[
                "3 searches/month",
                "Basic trust score",
                "Write reviews",
                "Filing history",
              ]}
              cta="Get started"
              ctaHref="/signup"
              variant="default"
            />
            <PricingCard
              tier="Pro"
              price="$29"
              period="/month"
              description="For active LP investors"
              features={[
                "Unlimited searches",
                "Full AI vetting reports",
                "Watchlist + alerts",
                "Score change notifications",
              ]}
              cta="Start Pro"
              ctaHref="/signup?plan=pro"
              variant="primary"
              badge="Most Popular"
            />
            <PricingCard
              tier="Verified GP"
              price="$99"
              period="/month"
              description="For syndicators"
              features={[
                "Claim your profile",
                "Respond to reviews",
                "SyndiCheck Verified badge",
                "Profile analytics",
              ]}
              cta="Get Verified"
              ctaHref="/signup?plan=verified"
              variant="default"
            />
            <PricingCard
              tier="Premium GP"
              price="$299"
              period="/month"
              description="For high-growth syndicators"
              features={[
                "All Verified features",
                "Lead gen dashboard",
                "See who viewed your profile",
                "Priority support",
              ]}
              cta="Go Premium"
              ctaHref="/signup?plan=premium"
              variant="default"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span className="font-semibold text-blue-600">SyndiCheck</span>
          <p className="text-center text-xs max-w-xl">
            SyndiCheck provides informational data aggregation only. Not
            investment advice. Always conduct your own due diligence.
          </p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-gray-700">Sign in</Link>
            <Link href="/signup" className="hover:text-gray-700">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <div className="text-sm font-medium text-blue-600 mb-1">Step {number}</div>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function PricingCard({
  tier,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  variant,
  badge,
}: {
  tier: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  variant: "default" | "primary";
  badge?: string;
}) {
  return (
    <Card
      className={variant === "primary" ? "border-blue-500 border-2 shadow-lg" : ""}
    >
      <CardContent className="pt-6 space-y-4">
        {badge && (
          <Badge className="bg-blue-600 text-white">{badge}</Badge>
        )}
        <div>
          <h3 className="font-bold text-gray-900">{tier}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-900">{price}</span>
          {period && <span className="text-gray-500 pb-1">{period}</span>}
        </div>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
        <Button
          asChild
          className="w-full"
          variant={variant === "primary" ? "default" : "outline"}
        >
          <Link href={ctaHref}>{cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
