/**
 * Trust Score Algorithm
 *
 * Computes a 0-100 trust score for a sponsor based on 6 weighted components.
 * See Section 9 of the blueprint for full specification.
 */

export interface ScoringInput {
  // Filing compliance inputs
  filings: Array<{
    filedAt: string;
    firstSaleDate?: string | null;
    exemption: string | null;
    totalOfferingAmount: number | null;
    totalAmountSold: number | null;
    filingType: string;
  }>;

  // Enforcement inputs
  enforcementActions: Array<{
    severity: "low" | "medium" | "high" | "critical";
    actionDate: string | null;
  }>;

  // Broker record inputs
  brokerRecords: Array<{
    totalDisclosures: number;
    customerDisputes: number;
    regulatoryActions: number;
    criminalRecords: number;
  }>;

  // Property verification inputs
  propertyClaims: Array<{
    verified: boolean;
    hasDiscrepancy: boolean;
  }>;

  // Community review inputs
  reviews: Array<{
    overallRating: number;
    isVerifiedInvestor: boolean;
    createdAt: string;
  }>;
}

export interface TrustScoreResult {
  overallScore: number;
  filingComplianceScore: number;
  enforcementScore: number;
  brokerRecordScore: number;
  propertyVerificationScore: number;
  communitySentimentScore: number;
  filingConsistencyScore: number;
  dataCompleteness: number;
  factors: Record<string, unknown>;
}

/**
 * Component weights (must sum to 1.0)
 */
const WEIGHTS = {
  filingCompliance: 0.25,
  enforcement: 0.25,
  brokerRecord: 0.15,
  propertyVerification: 0.15,
  communitySentiment: 0.10,
  filingConsistency: 0.10,
} as const;

/**
 * Compute trust score for a sponsor
 */
export function computeTrustScore(input: ScoringInput): TrustScoreResult {
  const filingComplianceScore = scoreFilingCompliance(input.filings);
  const enforcementScore = scoreEnforcement(input.enforcementActions);
  const brokerRecordScore = scoreBrokerRecords(input.brokerRecords);
  const propertyVerificationScore = scorePropertyVerification(input.propertyClaims);
  const communitySentimentScore = scoreCommunity(input.reviews);
  const filingConsistencyScore = scoreFilingConsistency(input.filings);

  // Count available data sources
  const dataSources = [
    input.filings.length > 0,
    true, // enforcement always checked
    input.brokerRecords.length > 0 || input.filings.length > 0, // FINRA checked if we have filings
    input.propertyClaims.length > 0,
    input.reviews.length > 0,
    input.filings.length > 0,
  ];
  const availableSources = dataSources.filter(Boolean).length;
  const dataCompleteness = Math.max(0.5, availableSources / dataSources.length);

  // Weighted average
  const rawScore =
    filingComplianceScore * WEIGHTS.filingCompliance +
    enforcementScore * WEIGHTS.enforcement +
    brokerRecordScore * WEIGHTS.brokerRecord +
    propertyVerificationScore * WEIGHTS.propertyVerification +
    communitySentimentScore * WEIGHTS.communitySentiment +
    filingConsistencyScore * WEIGHTS.filingConsistency;

  // Apply data completeness modifier
  const overallScore = Math.round(rawScore * dataCompleteness);

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    filingComplianceScore,
    enforcementScore,
    brokerRecordScore,
    propertyVerificationScore,
    communitySentimentScore,
    filingConsistencyScore,
    dataCompleteness,
    factors: {
      filingCount: input.filings.length,
      enforcementCount: input.enforcementActions.length,
      brokerRecordCount: input.brokerRecords.length,
      propertyClaimCount: input.propertyClaims.length,
      reviewCount: input.reviews.length,
      weights: WEIGHTS,
    },
  };
}

/**
 * Filing compliance score (0-100)
 * - Were forms filed on time? (within 15 days of first sale)
 * - Were amendments filed properly?
 * - Consistent exemption usage?
 */
function scoreFilingCompliance(
  filings: ScoringInput["filings"]
): number {
  if (filings.length === 0) return 50; // Neutral if no filings

  let score = 100;
  let totalFilings = filings.length;
  let lateFilings = 0;
  let amendments = 0;

  for (const filing of filings) {
    if (filing.filingType === "form_d_a") amendments++;

    // Check if late (>15 days after first sale)
    if (filing.firstSaleDate && filing.filedAt) {
      const daysDiff =
        (new Date(filing.filedAt).getTime() -
          new Date(filing.firstSaleDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysDiff > 15) lateFilings++;
    }
  }

  // Deduct for late filings
  const lateRatio = lateFilings / totalFilings;
  score -= lateRatio * 30;

  // Amendments are normal but many can indicate issues
  const amendmentRatio = amendments / totalFilings;
  if (amendmentRatio > 0.5) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Enforcement score (0-100)
 * - 100 if no enforcement actions
 * - Deduct based on severity
 */
function scoreEnforcement(
  actions: ScoringInput["enforcementActions"]
): number {
  if (actions.length === 0) return 100;

  let score = 100;
  const DEDUCTIONS = { critical: 80, high: 50, medium: 30, low: 15 };

  for (const action of actions) {
    score -= DEDUCTIONS[action.severity];
  }

  return Math.max(0, score);
}

/**
 * Broker/adviser record score (0-100)
 */
function scoreBrokerRecords(
  records: ScoringInput["brokerRecords"]
): number {
  if (records.length === 0) return 70; // Neutral — not checked yet

  let score = 100;

  for (const record of records) {
    score -= record.customerDisputes * 15;
    score -= record.regulatoryActions * 25;
    score -= record.criminalRecords * 50;
  }

  return Math.max(0, score);
}

/**
 * Property verification score (0-100)
 */
function scorePropertyVerification(
  claims: ScoringInput["propertyClaims"]
): number {
  if (claims.length === 0) return 70; // Neutral if no property data

  const verified = claims.filter((c) => c.verified && !c.hasDiscrepancy).length;
  const withDiscrepancy = claims.filter((c) => c.hasDiscrepancy).length;

  const baseScore = (verified / claims.length) * 100;
  const discrepancyPenalty = withDiscrepancy * 15;

  return Math.max(0, Math.round(baseScore - discrepancyPenalty));
}

/**
 * Community sentiment score (0-100)
 * - Weighted average of ratings (1-5 → 0-100)
 * - Verified investors weighted 2x
 * - Recent reviews weighted 1.5x
 */
function scoreCommunity(
  reviews: ScoringInput["reviews"]
): number {
  if (reviews.length < 3) return 60; // Neutral if insufficient reviews

  const now = Date.now();
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const review of reviews) {
    const isRecent =
      now - new Date(review.createdAt).getTime() < ONE_YEAR;
    const recencyWeight = isRecent ? 1.5 : 1.0;
    const verifiedWeight = review.isVerifiedInvestor ? 2.0 : 1.0;
    const weight = recencyWeight * verifiedWeight;

    // Convert 1-5 rating to 0-100
    const normalizedRating = ((review.overallRating - 1) / 4) * 100;

    weightedSum += normalizedRating * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight);
}

/**
 * Filing consistency score (0-100)
 * - Regular filing pattern
 * - Consistent exemption type
 * - Reasonable offering amounts
 */
function scoreFilingConsistency(
  filings: ScoringInput["filings"]
): number {
  if (filings.length === 0) return 50;
  if (filings.length === 1) return 70;

  let score = 100;

  // Check exemption consistency
  const exemptions = filings.map((f) => f.exemption).filter(Boolean);
  const uniqueExemptions = new Set(exemptions);
  if (uniqueExemptions.size > 2) score -= 15; // Switching exemption types

  // Check for wildly fluctuating offering amounts
  const amounts = filings
    .map((f) => f.totalOfferingAmount)
    .filter((a): a is number => a !== null && a > 0);

  if (amounts.length > 1) {
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - avg) / avg));
    if (maxDeviation > 5) score -= 10; // More than 5x deviation
  }

  return Math.max(0, Math.round(score));
}
