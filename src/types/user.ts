export type UserRole = "lp" | "gp" | "admin";
export type SubscriptionTier = "free" | "pro" | "verified" | "premium";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isAccreditedInvestor: boolean;
  companyName: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus | null;
  stripeCustomerId: string | null;
  monthlySearchesUsed: number;
  monthlySearchesResetAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TierCapabilities {
  maxMonthlySearches: number | null; // null = unlimited
  canAccessFullReports: boolean;
  canAccessWatchlist: boolean;
  canSubmitReviews: boolean;
  canClaimProfile: boolean;
  canRespondToReviews: boolean;
  canAccessAnalytics: boolean;
  canAccessLeadGen: boolean;
}

export const TIER_CAPABILITIES: Record<SubscriptionTier, TierCapabilities> = {
  free: {
    maxMonthlySearches: 3,
    canAccessFullReports: false,
    canAccessWatchlist: false,
    canSubmitReviews: true,
    canClaimProfile: false,
    canRespondToReviews: false,
    canAccessAnalytics: false,
    canAccessLeadGen: false,
  },
  pro: {
    maxMonthlySearches: null,
    canAccessFullReports: true,
    canAccessWatchlist: true,
    canSubmitReviews: true,
    canClaimProfile: false,
    canRespondToReviews: false,
    canAccessAnalytics: false,
    canAccessLeadGen: false,
  },
  verified: {
    maxMonthlySearches: null,
    canAccessFullReports: true,
    canAccessWatchlist: true,
    canSubmitReviews: true,
    canClaimProfile: true,
    canRespondToReviews: true,
    canAccessAnalytics: true,
    canAccessLeadGen: false,
  },
  premium: {
    maxMonthlySearches: null,
    canAccessFullReports: true,
    canAccessWatchlist: true,
    canSubmitReviews: true,
    canClaimProfile: true,
    canRespondToReviews: true,
    canAccessAnalytics: true,
    canAccessLeadGen: true,
  },
};

export function getTierCapabilities(tier: SubscriptionTier): TierCapabilities {
  return TIER_CAPABILITIES[tier];
}
