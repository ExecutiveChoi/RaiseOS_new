export interface Review {
  id: string;
  sponsorId: string;
  userId: string;
  overallRating: number;
  communicationRating: number | null;
  transparencyRating: number | null;
  returnsAccuracyRating: number | null;
  title: string | null;
  body: string;
  investmentAmountRange: string | null;
  investmentYear: number | null;
  dealType: string | null;
  isVerifiedInvestor: boolean;
  isPublished: boolean;
  isFlagged: boolean;
  flaggedReason: string | null;
  gpResponse: string | null;
  gpResponseAt: string | null;
  gpRespondedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithProfile extends Review {
  profile?: {
    fullName: string | null;
    avatarUrl: string | null;
    isAccreditedInvestor: boolean;
  };
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export const INVESTMENT_AMOUNT_RANGES = [
  { value: "<50k", label: "Under $50K" },
  { value: "50k-100k", label: "$50K – $100K" },
  { value: "100k-250k", label: "$100K – $250K" },
  { value: "250k+", label: "$250K+" },
] as const;

export const DEAL_TYPES = [
  { value: "multifamily", label: "Multifamily" },
  { value: "office", label: "Office" },
  { value: "retail", label: "Retail" },
  { value: "industrial", label: "Industrial" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "storage", label: "Self Storage" },
  { value: "hotel", label: "Hotel / Hospitality" },
  { value: "land", label: "Land / Development" },
  { value: "other", label: "Other" },
] as const;
