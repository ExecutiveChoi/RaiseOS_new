"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrustScoreBadge } from "@/components/sponsors/TrustScoreBadge";
import { formatDollars, formatDate } from "@/lib/utils";
import { getTrustScoreDisplay } from "@/types/sponsor";

interface SponsorResult {
  id: string;
  name: string;
  slug: string;
  state: string | null;
  city: string | null;
  trust_score: number | null;
  total_offerings: number;
  total_amount_raised: number;
  total_reviews: number;
  average_rating: string | null;
  has_enforcement_actions: boolean;
  has_finra_flags: boolean;
  is_claimed: boolean;
  latest_filing_date: string | null;
}

interface SearchResponse {
  sponsors: SponsorResult[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
  upgradeUrl?: string;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export function SponsorSearchClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sortBy, setSortBy] = useState<"trust_score" | "total_raised" | "latest_filing">("trust_score");
  const [results, setResults] = useState<SponsorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (searchPage = 1) => {
    if (!query.trim() && !state) return;

    setLoading(true);
    setError(null);
    setUpgradeRequired(false);
    setHasSearched(true);

    const params = new URLSearchParams({
      page: String(searchPage),
      limit: "20",
      sortBy,
    });
    if (query.trim()) params.set("q", query.trim());
    if (state) params.set("state", state);
    if (minScore) params.set("minScore", minScore);

    try {
      const response = await fetch(`/api/sponsors?${params}`);
      const data: SearchResponse = await response.json();

      if (response.status === 429) {
        setUpgradeRequired(true);
        setError(data.error ?? "Search limit reached");
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Search failed. Please try again.");
        return;
      }

      setResults(data.sponsors);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [query, state, minScore, sortBy]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    doSearch(1);
  }

  function handleSponsorClick(sponsor: SponsorResult) {
    router.push(`/sponsor/${sponsor.slug}`);
  }

  return (
    <div className="space-y-4">
      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, company, or CIK..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">All states</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Min score</label>
              <select
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Any</option>
                <option value="40">40+ (Caution)</option>
                <option value="60">60+ (Fair)</option>
                <option value="70">70+ (Good)</option>
                <option value="80">80+ (Strong)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="trust_score">Trust Score</option>
                <option value="total_raised">Total Raised</option>
                <option value="latest_filing">Latest Filing</option>
              </select>
            </div>
          </div>
        )}
      </form>

      {/* Upgrade banner */}
      {upgradeRequired && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-900">Monthly search limit reached</p>
                <p className="text-sm text-amber-700 mt-1">
                  Free accounts get 3 searches per month. Upgrade to Pro for unlimited searches.
                </p>
              </div>
              <Button onClick={() => router.push("/billing")}>
                Upgrade to Pro — $29/mo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && !upgradeRequired && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && !error && results.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No sponsors found</p>
          <p className="text-sm mt-1">
            Try a different search term. SEC data is updated daily.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} sponsor{total !== 1 ? "s" : ""} found
          </p>

          <div className="space-y-3">
            {results.map((sponsor) => (
              <SponsorResultCard
                key={sponsor.id}
                sponsor={sponsor}
                onClick={() => handleSponsorClick(sponsor)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => doSearch(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => doSearch(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SponsorResultCard({
  sponsor,
  onClick,
}: {
  sponsor: SponsorResult;
  onClick: () => void;
}) {
  const scoreDisplay = getTrustScoreDisplay(sponsor.trust_score);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <TrustScoreBadge score={sponsor.trust_score} size="sm" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 hover:text-blue-600">
                  {sponsor.name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {[sponsor.city, sponsor.state].filter(Boolean).join(", ")}
                  {sponsor.latest_filing_date &&
                    ` · Last filing: ${formatDate(sponsor.latest_filing_date)}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {sponsor.is_claimed && (
                  <Badge variant="success" className="text-xs">Verified</Badge>
                )}
                {sponsor.has_enforcement_actions && (
                  <Badge variant="danger" className="text-xs">⚠ Enforcement</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              <span>{sponsor.total_offerings} offering{sponsor.total_offerings !== 1 ? "s" : ""}</span>
              <span>{formatDollars(sponsor.total_amount_raised)} raised</span>
              {sponsor.total_reviews > 0 && (
                <span>
                  ★ {parseFloat(sponsor.average_rating ?? "0").toFixed(1)}{" "}
                  ({sponsor.total_reviews} review{sponsor.total_reviews !== 1 ? "s" : ""})
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
