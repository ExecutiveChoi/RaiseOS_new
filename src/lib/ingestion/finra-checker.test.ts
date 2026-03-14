import { describe, it, expect } from "vitest";
import {
  calculateNameConfidence,
  processFinraHit,
} from "./finra-checker";
import type { FinraHit } from "./finra-checker";

describe("calculateNameConfidence", () => {
  it("returns 1.0 for identical names", () => {
    expect(calculateNameConfidence("john smith", "john smith")).toBe(1.0);
  });

  it("returns 0.95 for matching first and last name", () => {
    expect(calculateNameConfidence("john a smith", "john b smith")).toBe(0.95);
  });

  it("returns 0.85 for matching last name and first initial", () => {
    expect(calculateNameConfidence("j smith", "james smith")).toBe(0.85);
  });

  it("returns 0.75 for matching last name only", () => {
    expect(calculateNameConfidence("alice smith", "robert smith")).toBe(0.75);
  });

  it("returns 0.0 for completely different names", () => {
    expect(calculateNameConfidence("john smith", "jane doe")).toBe(0.0);
  });

  it("normalizes punctuation and case before comparing", () => {
    expect(calculateNameConfidence("John Smith", "john smith")).toBe(1.0);
    expect(calculateNameConfidence("O'Brien, John", "obrien john")).toBe(1.0);
  });
});

describe("processFinraHit", () => {
  const makeHit = (overrides: Partial<FinraHit["_source"]> = {}): FinraHit => ({
    _id: "1234567",
    _source: {
      ind_firstname: "John",
      ind_lastname: "Smith",
      ind_bc_scope: "Active",
      ind_employments: [
        {
          ia_emp_firm_name: "Acme Capital LLC",
          emp_is_current: true,
          emp_start_date: "2020-01-01",
        },
      ],
      ind_disclosures: [],
      ind_approved_finra_registration_count: 2,
      ...overrides,
    },
  });

  it("extracts CRD number from hit ID", () => {
    const result = processFinraHit(makeHit(), 0.95);
    expect(result.finraCrdNumber).toBe("1234567");
  });

  it("builds individual name", () => {
    const result = processFinraHit(makeHit(), 0.95);
    expect(result.individualName).toBe("John Smith");
  });

  it("detects active registration status", () => {
    const result = processFinraHit(makeHit(), 0.95);
    expect(result.isCurrentlyRegistered).toBe(true);
  });

  it("detects inactive registration status", () => {
    const result = processFinraHit(
      makeHit({ ind_bc_scope: "Not Currently Registered" }),
      0.9
    );
    expect(result.isCurrentlyRegistered).toBe(false);
  });

  it("finds current employer from employments", () => {
    const result = processFinraHit(makeHit(), 0.95);
    expect(result.currentEmployer).toBe("Acme Capital LLC");
  });

  it("counts disclosures by type", () => {
    const result = processFinraHit(
      makeHit({
        ind_disclosures: [
          { disc_type: "Customer Dispute" },
          { disc_type: "Customer Complaint" },
          { disc_type: "Regulatory Action" },
          { disc_type: "Criminal Disclosure" },
        ],
      }),
      0.9
    );
    expect(result.totalDisclosures).toBe(4);
    expect(result.customerDisputes).toBe(2);
    expect(result.regulatoryActions).toBe(1);
    expect(result.criminalRecords).toBe(1);
  });

  it("preserves match confidence", () => {
    const result = processFinraHit(makeHit(), 0.85);
    expect(result.matchConfidence).toBe(0.85);
  });

  it("handles missing employment gracefully", () => {
    const result = processFinraHit(
      makeHit({ ind_employments: undefined }),
      0.9
    );
    expect(result.currentEmployer).toBeNull();
    expect(result.employmentHistory).toHaveLength(0);
  });
});
