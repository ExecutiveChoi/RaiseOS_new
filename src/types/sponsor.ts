export interface Sponsor {
  id: string;
  name: string;
  slug: string;
  normalizedName: string;
  cik: string | null;
  secFileNumber: string | null;
  ein: string | null;
  state: string | null;
  city: string | null;
  zipCode: string | null;
  address: string | null;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  yearFounded: number | null;
  totalOfferings: number;
  totalAmountRaised: number;
  totalReviews: number;
  averageRating: string | null;
  trustScore: number | null;
  trustScoreComputedAt: string | null;
  hasEnforcementActions: boolean;
  hasFinraFlags: boolean;
  isClaimed: boolean;
  claimedBy: string | null;
  firstFilingDate: string | null;
  latestFilingDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrustScore {
  id: string;
  sponsorId: string;
  overallScore: number;
  filingComplianceScore: number;
  enforcementScore: number;
  brokerRecordScore: number;
  propertyVerificationScore: number;
  communitySentimentScore: number;
  filingConsistencyScore: number;
  factors: Record<string, unknown>;
  dataCompleteness: string | null;
  computedAt: string;
}

export interface TrustScoreDisplay {
  score: number | null;
  label: string;
  color: "green" | "blue" | "amber" | "red" | "gray";
  icon: string;
}

export function getTrustScoreDisplay(score: number | null): TrustScoreDisplay {
  if (score === null) {
    return { score: null, label: "Insufficient Data", color: "gray", icon: "?" };
  }
  if (score >= 90) return { score, label: "Excellent", color: "green", icon: "✓✓" };
  if (score >= 80) return { score, label: "Strong", color: "green", icon: "✓" };
  if (score >= 70) return { score, label: "Good", color: "blue", icon: "●" };
  if (score >= 60) return { score, label: "Fair", color: "blue", icon: "●" };
  if (score >= 50) return { score, label: "Caution", color: "amber", icon: "⚠" };
  if (score >= 40) return { score, label: "Elevated Risk", color: "amber", icon: "⚠" };
  return { score, label: "High Risk", color: "red", icon: "✕" };
}

export function formatAmountRaised(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}
