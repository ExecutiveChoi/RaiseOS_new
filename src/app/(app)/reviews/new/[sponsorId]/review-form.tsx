"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { INVESTMENT_AMOUNT_RANGES, DEAL_TYPES } from "@/types/review";

interface ReviewFormProps {
  sponsorId: string;
  sponsorSlug: string;
}

export function ReviewForm({ sponsorId, sponsorSlug }: ReviewFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [overallRating, setOverallRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [transparencyRating, setTransparencyRating] = useState(0);
  const [returnsRating, setReturnsRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amountRange, setAmountRange] = useState("");
  const [investmentYear, setInvestmentYear] = useState("");
  const [dealType, setDealType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overallRating === 0) {
      setError("Please select an overall rating.");
      return;
    }
    if (body.trim().length < 20) {
      setError("Review must be at least 20 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error: insertError } = await supabase.from("reviews").insert({
      sponsor_id: sponsorId,
      user_id: user.id,
      overall_rating: overallRating,
      communication_rating: communicationRating || null,
      transparency_rating: transparencyRating || null,
      returns_accuracy_rating: returnsRating || null,
      title: title.trim() || null,
      body: body.trim(),
      investment_amount_range: amountRange || null,
      investment_year: investmentYear ? parseInt(investmentYear) : null,
      deal_type: dealType || null,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("You have already reviewed this sponsor.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    router.push(`/sponsor/${sponsorSlug}?reviewed=true`);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Overall Rating */}
          <div className="space-y-2">
            <Label>Overall Rating *</Label>
            <StarSelector value={overallRating} onChange={setOverallRating} />
          </div>

          {/* Optional sub-ratings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Communication</Label>
              <StarSelector value={communicationRating} onChange={setCommunicationRating} size="sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Transparency</Label>
              <StarSelector value={transparencyRating} onChange={setTransparencyRating} size="sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Returns Accuracy</Label>
              <StarSelector value={returnsRating} onChange={setReturnsRating} size="sm" />
            </div>
          </div>

          {/* Review text */}
          <div className="space-y-2">
            <Label htmlFor="title">Review Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line summary"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Your Review *</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your experience as an LP investor. What was it like working with this syndicator? Would you invest again?"
              required
              minLength={20}
              maxLength={2000}
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="text-xs text-gray-400">{body.length}/2000 characters</p>
          </div>

          {/* Optional context */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountRange">Investment Amount</Label>
              <select
                id="amountRange"
                value={amountRange}
                onChange={(e) => setAmountRange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Prefer not to say</option>
                {INVESTMENT_AMOUNT_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="investmentYear">Investment Year</Label>
              <Input
                id="investmentYear"
                type="number"
                min={2000}
                max={new Date().getFullYear()}
                value={investmentYear}
                onChange={(e) => setInvestmentYear(e.target.value)}
                placeholder="e.g. 2022"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealType">Deal Type</Label>
              <select
                id="dealType"
                value={dealType}
                onChange={(e) => setDealType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {DEAL_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
            Your review will be posted anonymously. Investment context
            (amount, year, deal type) is optional and helps other investors
            evaluate the relevance of your review.
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StarSelector({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const starSize = size === "sm" ? "text-lg" : "text-2xl";

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${starSize} transition-colors ${
            star <= (hover || value) ? "text-amber-400" : "text-gray-200"
          } hover:text-amber-400`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
