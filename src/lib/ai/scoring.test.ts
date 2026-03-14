import { describe, it, expect } from "vitest";
import { computeTrustScore } from "./scoring";

describe("computeTrustScore", () => {
  it("returns 100 enforcement score when no enforcement actions", () => {
    const result = computeTrustScore({
      filings: [],
      enforcementActions: [],
      brokerRecords: [],
      propertyClaims: [],
      reviews: [],
    });
    expect(result.enforcementScore).toBe(100);
  });

  it("reduces enforcement score for critical action", () => {
    const result = computeTrustScore({
      filings: [],
      enforcementActions: [{ severity: "critical", actionDate: null }],
      brokerRecords: [],
      propertyClaims: [],
      reviews: [],
    });
    expect(result.enforcementScore).toBe(20); // 100 - 80
  });

  it("clamps enforcement score at 0 for multiple critical actions", () => {
    const result = computeTrustScore({
      filings: [],
      enforcementActions: [
        { severity: "critical", actionDate: null },
        { severity: "critical", actionDate: null },
      ],
      brokerRecords: [],
      propertyClaims: [],
      reviews: [],
    });
    expect(result.enforcementScore).toBe(0);
  });

  it("returns neutral scores when no data available", () => {
    const result = computeTrustScore({
      filings: [],
      enforcementActions: [],
      brokerRecords: [],
      propertyClaims: [],
      reviews: [],
    });
    expect(result.filingComplianceScore).toBe(50);
    expect(result.brokerRecordScore).toBe(70);
    expect(result.propertyVerificationScore).toBe(70);
    expect(result.communitySentimentScore).toBe(60);
  });

  it("computes high overall score for clean sponsor", () => {
    const result = computeTrustScore({
      filings: [
        {
          filedAt: "2023-01-20",
          firstSaleDate: "2023-01-10",
          exemption: "506c",
          totalOfferingAmount: 5000000 * 100,
          totalAmountSold: 2000000 * 100,
          filingType: "form_d",
        },
        {
          filedAt: "2022-03-15",
          firstSaleDate: "2022-03-05",
          exemption: "506c",
          totalOfferingAmount: 3000000 * 100,
          totalAmountSold: 3000000 * 100,
          filingType: "form_d",
        },
      ],
      enforcementActions: [],
      brokerRecords: [
        {
          totalDisclosures: 0,
          customerDisputes: 0,
          regulatoryActions: 0,
          criminalRecords: 0,
        },
      ],
      propertyClaims: [
        { verified: true, hasDiscrepancy: false },
        { verified: true, hasDiscrepancy: false },
      ],
      reviews: [
        { overallRating: 5, isVerifiedInvestor: true, createdAt: new Date().toISOString() },
        { overallRating: 4, isVerifiedInvestor: false, createdAt: new Date().toISOString() },
        { overallRating: 5, isVerifiedInvestor: true, createdAt: new Date().toISOString() },
      ],
    });

    expect(result.overallScore).toBeGreaterThan(70);
    expect(result.enforcementScore).toBe(100);
    expect(result.brokerRecordScore).toBe(100);
    expect(result.propertyVerificationScore).toBe(100);
  });

  it("overall score is between 0 and 100", () => {
    const result = computeTrustScore({
      filings: [],
      enforcementActions: [
        { severity: "critical", actionDate: null },
        { severity: "critical", actionDate: null },
      ],
      brokerRecords: [
        { totalDisclosures: 5, customerDisputes: 3, regulatoryActions: 2, criminalRecords: 1 },
      ],
      propertyClaims: [{ verified: false, hasDiscrepancy: true }],
      reviews: [
        { overallRating: 1, isVerifiedInvestor: false, createdAt: new Date().toISOString() },
        { overallRating: 1, isVerifiedInvestor: false, createdAt: new Date().toISOString() },
        { overallRating: 1, isVerifiedInvestor: false, createdAt: new Date().toISOString() },
      ],
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});
