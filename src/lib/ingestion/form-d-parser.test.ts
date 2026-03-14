import { describe, it, expect } from "vitest";
import { parseFormDXml } from "./sec-edgar";

const SAMPLE_FORM_D_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission>
  <headerData>
    <submissionType>D</submissionType>
    <dateFiled>2024-03-15</dateFiled>
  </headerData>
  <primaryIssuer>
    <cik>0001234567</cik>
    <entityName>ABC Capital Partners LLC</entityName>
    <issuerStreet1>123 Main St</issuerStreet1>
    <issuerCity>Dallas</issuerCity>
    <issuerState>TX</issuerState>
    <issuerZipCode>75201</issuerZipCode>
    <entityType>Limited Liability Company</entityType>
    <yearOfIncorporation>2018</yearOfIncorporation>
  </primaryIssuer>
  <relatedPersonsList>
    <relatedPersonInfo>
      <relatedPersonName>
        <firstName>John</firstName>
        <lastName>Smith</lastName>
      </relatedPersonName>
      <relatedPersonRelationshipList>Director, Executive Officer</relatedPersonRelationshipList>
    </relatedPersonInfo>
  </relatedPersonsList>
  <offeringData>
    <industryGroup>
      <industryGroupType>Real Estate</industryGroupType>
    </industryGroup>
    <federalExemptionsExclusions>
      <item>06c</item>
    </federalExemptionsExclusions>
    <offeringSalesAmounts>
      <totalOfferingAmount>10000000</totalOfferingAmount>
      <totalAmountSold>3500000</totalAmountSold>
      <totalRemaining>6500000</totalRemaining>
    </offeringSalesAmounts>
    <minimumInvestmentAccepted>50000</minimumInvestmentAccepted>
    <investors>
      <hasNonAccreditedInvestors>false</hasNonAccreditedInvestors>
      <numberNonAccreditedInvestors>0</numberNonAccreditedInvestors>
      <totalNumberAlreadyInvested>12</totalNumberAlreadyInvested>
    </investors>
  </offeringData>
</edgarSubmission>
`;

describe("parseFormDXml", () => {
  it("parses entity name correctly", () => {
    const result = parseFormDXml(
      SAMPLE_FORM_D_XML,
      "0001234567",
      "0001234567-24-000001",
      "https://sec.gov/test"
    );
    expect(result.entityName).toBe("ABC Capital Partners LLC");
  });

  it("parses state and city", () => {
    const result = parseFormDXml(
      SAMPLE_FORM_D_XML,
      "0001234567",
      "0001234567-24-000001",
      "https://sec.gov/test"
    );
    expect(result.issuerState).toBe("TX");
    expect(result.issuerCity).toBe("Dallas");
  });

  it("parses 506(c) exemption", () => {
    const result = parseFormDXml(
      SAMPLE_FORM_D_XML,
      "0001234567",
      "0001234567-24-000001",
      "https://sec.gov/test"
    );
    expect(result.federalExemptions).toContain("506c");
  });

  it("converts offering amounts to cents", () => {
    const result = parseFormDXml(
      SAMPLE_FORM_D_XML,
      "0001234567",
      "0001234567-24-000001",
      "https://sec.gov/test"
    );
    expect(result.totalOfferingAmount).toBe(1_000_000_000); // $10M in cents
    expect(result.totalAmountSold).toBe(350_000_000); // $3.5M in cents
  });

  it("parses related persons", () => {
    const result = parseFormDXml(
      SAMPLE_FORM_D_XML,
      "0001234567",
      "0001234567-24-000001",
      "https://sec.gov/test"
    );
    expect(result.relatedPersons).toHaveLength(1);
    expect(result.relatedPersons[0].firstName).toBe("John");
    expect(result.relatedPersons[0].lastName).toBe("Smith");
  });

  it("parses non-accredited investor flag", () => {
    const result = parseFormDXml(
      SAMPLE_FORM_D_XML,
      "0001234567",
      "0001234567-24-000001",
      "https://sec.gov/test"
    );
    expect(result.hasNonAccreditedInvestors).toBe(false);
  });
});
