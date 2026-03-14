/**
 * SEC EDGAR API Client
 *
 * Uses the FREE SEC EDGAR full-text search API to find Form D filings.
 * Rate limit: 10 requests/second
 * Required header: User-Agent with contact info (SEC policy)
 */

const SEC_EDGAR_BASE = "https://efts.sec.gov";
const SEC_DATA_BASE = "https://data.sec.gov";
const SEC_WWW_BASE = "https://www.sec.gov";

const USER_AGENT =
  process.env.SEC_USER_AGENT ?? "SyndiCheck support@syndicheck.com";

const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
};

export interface EdgarSearchResult {
  hits: {
    total: { value: number };
    hits: EdgarHit[];
  };
}

export interface EdgarHit {
  _id: string;
  _source: {
    period_of_report: string;
    entity_name: string;
    file_date: string;
    form_type: string;
    biz_location: string;
    inc_states: string;
    entity_id: string; // CIK
  };
}

export interface EdgarSubmission {
  cik: string;
  name: string;
  sic: string;
  stateOfIncorporation: string;
  addresses: {
    business?: {
      street1?: string;
      city?: string;
      stateOrCountry?: string;
      zipCode?: string;
    };
  };
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

export interface FormDData {
  cik: string;
  entityName: string;
  accessionNumber: string;
  filingDate: string;
  formType: "D" | "D/A";
  issuerState: string;
  issuerStreet: string;
  issuerCity: string;
  issuerZip: string;
  entityType: string;
  yearOfIncorporation: string;
  federalExemptions: string[];
  industryGroup: string;
  totalOfferingAmount: number | null;
  totalAmountSold: number | null;
  totalRemaining: number | null;
  minimumInvestmentAccepted: number | null;
  totalNumberAlreadyInvested: number | null;
  hasSalesCompensation: boolean;
  hasNonAccreditedInvestors: boolean;
  numberNonAccredited: number;
  relatedPersons: Array<{
    firstName: string;
    lastName: string;
    relationship: string;
  }>;
  secUrl: string;
}

/**
 * Search EDGAR for recent Form D filings
 */
export async function searchRecentFormDs(
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  from: number = 0,
  size: number = 40
): Promise<EdgarSearchResult> {
  const url = new URL(`${SEC_EDGAR_BASE}/LATEST/search-index`);
  url.searchParams.set("q", '"form D" "real estate"');
  url.searchParams.set("dateRange", "custom");
  url.searchParams.set("startdt", startDate);
  url.searchParams.set("enddt", endDate);
  url.searchParams.set("forms", "D,D/A");
  url.searchParams.set("from", String(from));
  url.searchParams.set("hits.hits.total.relation", "eq");

  const response = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(
      `SEC EDGAR search failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch company submissions (all filings) by CIK
 */
export async function getCompanySubmissions(
  cik: string
): Promise<EdgarSubmission> {
  const paddedCik = cik.padStart(10, "0");
  const url = `${SEC_DATA_BASE}/submissions/CIK${paddedCik}.json`;

  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    next: { revalidate: 3600 }, // Cache 1 hour
  });

  if (!response.ok) {
    throw new Error(
      `SEC submissions fetch failed for CIK ${cik}: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Fetch and parse a specific Form D XML filing
 */
export async function fetchFormD(
  cik: string,
  accessionNumber: string
): Promise<FormDData | null> {
  try {
    const paddedCik = cik.padStart(10, "0");
    const formattedAccession = accessionNumber.replace(/-/g, "");

    // Fetch the filing index to find the primary XML document
    const indexUrl = `${SEC_WWW_BASE}/Archives/edgar/data/${paddedCik}/${formattedAccession}/${accessionNumber}-index.json`;

    const indexResponse = await fetch(indexUrl, {
      headers: DEFAULT_HEADERS,
    });

    if (!indexResponse.ok) {
      // Try alternate URL format
      return null;
    }

    const index = await indexResponse.json();
    const xmlFile = index.directory?.item?.find(
      (item: { name: string }) =>
        item.name.endsWith(".xml") &&
        !item.name.includes("primary") &&
        item.name !== `${accessionNumber}.xml`
    );

    if (!xmlFile) return null;

    const xmlUrl = `${SEC_WWW_BASE}/Archives/edgar/data/${paddedCik}/${formattedAccession}/${xmlFile.name}`;
    const xmlResponse = await fetch(xmlUrl, { headers: DEFAULT_HEADERS });

    if (!xmlResponse.ok) return null;

    const xmlText = await xmlResponse.text();
    return parseFormDXml(xmlText, cik, accessionNumber, xmlUrl);
  } catch (error) {
    console.error(`Error fetching Form D for ${cik}/${accessionNumber}:`, error);
    return null;
  }
}

/**
 * Parse Form D XML and extract key fields
 * See Appendix A of the blueprint for XML structure reference
 */
export function parseFormDXml(
  xmlText: string,
  cik: string,
  accessionNumber: string,
  secUrl: string
): FormDData {
  // Helper to extract text content from XML tag
  function extract(tag: string): string {
    const match = xmlText.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
    return match?.[1]?.trim() ?? "";
  }

  function extractNumber(tag: string): number | null {
    const val = extract(tag);
    if (!val || val === "0" || val === "Indefinite") return null;
    const num = parseFloat(val.replace(/,/g, ""));
    return isNaN(num) ? null : Math.round(num * 100); // Convert to cents
  }

  // Extract exemptions (can be multiple)
  // SEC uses "06b" and "06c" as item values inside federalExemptionsExclusions
  const exemptions: string[] = [];
  const exemptionMatches = xmlText.matchAll(/<item>([^<]+)<\/item>/gi);
  for (const match of exemptionMatches) {
    const item = match[1].trim();
    if (item === "06b" || item === "6b") {
      exemptions.push("506b");
    } else if (item === "06c" || item === "6c") {
      exemptions.push("506c");
    }
  }

  // Extract related persons
  const relatedPersons: FormDData["relatedPersons"] = [];
  const personMatches = xmlText.matchAll(
    /<relatedPersonInfo>([\s\S]*?)<\/relatedPersonInfo>/gi
  );
  for (const match of personMatches) {
    const block = match[1];
    const firstName =
      block.match(/<firstName>([^<]*)<\/firstName>/i)?.[1]?.trim() ?? "";
    const lastName =
      block.match(/<lastName>([^<]*)<\/lastName>/i)?.[1]?.trim() ?? "";
    const relationship =
      block.match(
        /<relatedPersonRelationshipList>([^<]*)<\/relatedPersonRelationshipList>/i
      )?.[1]?.trim() ?? "";

    if (firstName || lastName) {
      relatedPersons.push({ firstName, lastName, relationship });
    }
  }

  const entityName = extract("entityName") || extract("issuerName");
  const formType = xmlText.includes("D/A") ? "D/A" : "D";

  return {
    cik,
    entityName,
    accessionNumber,
    filingDate: extract("dateFiled") || extract("filedAt"),
    formType: formType as "D" | "D/A",
    issuerState: extract("issuerState") || extract("stateOrCountry"),
    issuerStreet: extract("issuerStreet1"),
    issuerCity: extract("issuerCity"),
    issuerZip: extract("issuerZipCode"),
    entityType: extract("entityType"),
    yearOfIncorporation: extract("yearOfIncorporation"),
    federalExemptions: exemptions,
    industryGroup: extract("industryGroupType"),
    totalOfferingAmount: extractNumber("totalOfferingAmount"),
    totalAmountSold: extractNumber("totalAmountSold"),
    totalRemaining: extractNumber("totalRemaining"),
    minimumInvestmentAccepted: extractNumber("minimumInvestmentAccepted"),
    totalNumberAlreadyInvested:
      parseInt(extract("totalNumberAlreadyInvested")) || null,
    hasSalesCompensation:
      xmlText.includes("<salesCompensation>") ||
      parseInt(extract("totalSalesCompensation")) > 0,
    hasNonAccreditedInvestors:
      extract("hasNonAccreditedInvestors").toLowerCase() === "true",
    numberNonAccredited: parseInt(extract("numberNonAccreditedInvestors")) || 0,
    relatedPersons,
    secUrl,
  };
}

/**
 * Rate-limited fetch wrapper (respects SEC's 10 req/sec limit)
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 110; // ms between requests (< 10/sec)

export async function rateLimitedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
  return fetch(url, { ...options, headers: { ...DEFAULT_HEADERS, ...options?.headers } });
}
