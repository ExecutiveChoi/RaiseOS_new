import { describe, it, expect } from "vitest";
import {
  parseSECDate,
  extractRespondentNames,
  classifyEnforcementSeverity,
  extractDollarAmount,
} from "./enforcement-scraper";

describe("parseSECDate", () => {
  it("parses long-form SEC date", () => {
    const result = parseSECDate("March 14, 2024");
    expect(result).not.toBeNull();
    expect(result).toContain("2024-03-14");
  });

  it("parses slash-separated date", () => {
    const result = parseSECDate("03/14/2024");
    expect(result).not.toBeNull();
    expect(result).toContain("2024-03-14");
  });

  it("returns null for empty string", () => {
    expect(parseSECDate("")).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(parseSECDate("not a date")).toBeNull();
  });
});

describe("extractRespondentNames", () => {
  it("extracts name from SEC v. pattern", () => {
    const names = extractRespondentNames("SEC v. John Smith");
    expect(names).toContain("John Smith");
  });

  it("extracts name from SEC Charges pattern", () => {
    const names = extractRespondentNames("SEC Charges Jane Doe With Fraud");
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toMatch(/Jane Doe/);
  });

  it("extracts name from In the Matter of pattern", () => {
    const names = extractRespondentNames("In the Matter of Acme Capital LLC");
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toContain("Acme Capital LLC");
  });

  it("falls back to title if no pattern matches", () => {
    const title = "Some Unknown Enforcement Action Format";
    const names = extractRespondentNames(title);
    expect(names.length).toBe(1);
    expect(names[0]).toBe(title.slice(0, 100));
  });
});

describe("classifyEnforcementSeverity", () => {
  it("classifies Ponzi schemes as critical", () => {
    expect(
      classifyEnforcementSeverity("Defendant ran a Ponzi scheme targeting retirees")
    ).toBe("critical");
  });

  it("classifies criminal/prison as critical", () => {
    expect(
      classifyEnforcementSeverity("Sentenced to 5 years in prison for securities fraud")
    ).toBe("critical");
  });

  it("classifies fraud alone as high", () => {
    expect(
      classifyEnforcementSeverity("SEC charges company with investment fraud")
    ).toBe("high");
  });

  it("classifies misappropriation as high", () => {
    expect(
      classifyEnforcementSeverity("Defendant misappropriated investor funds")
    ).toBe("high");
  });

  it("classifies violations as medium", () => {
    expect(
      classifyEnforcementSeverity("Company failed to disclose material information")
    ).toBe("medium");
  });

  it("classifies benign text as low", () => {
    expect(
      classifyEnforcementSeverity("Administrative order issued regarding registration")
    ).toBe("low");
  });
});

describe("extractDollarAmount", () => {
  it("extracts plain dollar amount near keyword", () => {
    const text = "The court ordered disgorgement of $500,000 plus interest.";
    const result = extractDollarAmount(text, ["disgorgement"]);
    // 500000 * 100 cents = 50000000
    expect(result).toBe(50_000_000);
  });

  it("extracts million dollar amounts", () => {
    const text = "Defendant must pay a penalty of $2.5 million.";
    const result = extractDollarAmount(text, ["penalty"]);
    // 2.5M * 100 = 250000000
    expect(result).toBe(250_000_000);
  });

  it("extracts billion dollar amounts", () => {
    const text = "The disgorgement totaled $1.2 billion.";
    const result = extractDollarAmount(text, ["disgorgement"]);
    expect(result).toBe(120_000_000_000);
  });

  it("returns null when keyword not found", () => {
    const text = "No financial penalties mentioned here.";
    const result = extractDollarAmount(text, ["disgorgement"]);
    expect(result).toBeNull();
  });

  it("returns null when no dollar amount near keyword", () => {
    const text = "There was a disgorgement order with no specified amount.";
    const result = extractDollarAmount(text, ["disgorgement"]);
    expect(result).toBeNull();
  });
});
