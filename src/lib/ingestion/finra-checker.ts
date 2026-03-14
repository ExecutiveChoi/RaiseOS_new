/**
 * FINRA BrokerCheck Integration
 *
 * Queries the public FINRA BrokerCheck API to look up broker/adviser records
 * for individuals associated with a sponsor (via relatedPersons from Form D).
 *
 * FINRA has an undocumented but publicly accessible JSON API used by their
 * BrokerCheck web app. This is public data — no API key required.
 *
 * Endpoints:
 *   Search: https://api.brokercheck.finra.org/search/individual?query={name}&hl=true&includePrevious=true&wt=json
 *   Detail: https://api.brokercheck.finra.org/search/individual/{crd}
 */

export interface FinraSearchResult {
  hits: {
    total: number;
    hits: FinraHit[];
  };
}

export interface FinraHit {
  _id: string;
  _source: {
    ind_firstname: string;
    ind_lastname: string;
    ind_middlename?: string;
    ind_bc_scope?: string; // "Active" | "Not Currently Registered"
    ind_employments?: FinraEmployment[];
    ind_disclosures?: FinraDisclosure[];
    ind_approved_finra_registration_count?: number;
  };
}

export interface FinraEmployment {
  ia_emp_firm_name?: string;
  broker_emp_firm_name?: string;
  emp_start_date?: string;
  emp_end_date?: string;
  emp_is_current?: boolean;
}

export interface FinraDisclosure {
  disc_type?: string;
  disc_date?: string;
  disc_detail?: string;
  disc_resolution?: string;
}

export interface ProcessedBrokerRecord {
  finraCrdNumber: string | null;
  individualName: string;
  isCurrentlyRegistered: boolean;
  registrationStatus: string;
  totalDisclosures: number;
  customerDisputes: number;
  regulatoryActions: number;
  criminalRecords: number;
  currentEmployer: string | null;
  employmentHistory: FinraEmployment[];
  matchConfidence: number;
  rawData: unknown;
}

const FINRA_API_BASE = "https://api.brokercheck.finra.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SyndiCheck/1.0; +https://syndicheck.com)",
  Accept: "application/json",
  Origin: "https://brokercheck.finra.org",
  Referer: "https://brokercheck.finra.org/",
};

/**
 * Search for an individual by name in FINRA BrokerCheck
 */
export async function searchBrokerByName(
  firstName: string,
  lastName: string
): Promise<FinraSearchResult | null> {
  const query = encodeURIComponent(`${firstName} ${lastName}`);
  const url = `${FINRA_API_BASE}/search/individual?query=${query}&hl=true&includePrevious=true&wt=json&rows=5&start=0&sort=score+desc`;

  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get detailed record for a specific CRD number
 */
export async function getBrokerDetail(crdNumber: string): Promise<FinraHit | null> {
  const url = `${FINRA_API_BASE}/search/individual/${crdNumber}?hl=true&includePrevious=true&wt=json`;

  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.hits?.hits?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Look up broker records for a list of related persons from a Form D filing
 * Returns processed records for those with a confident match
 */
export async function checkRelatedPersons(
  relatedPersons: Array<{ firstName: string; lastName: string; relationship: string }>
): Promise<ProcessedBrokerRecord[]> {
  const records: ProcessedBrokerRecord[] = [];

  for (const person of relatedPersons) {
    // Only check principals (directors, officers, GPs)
    const relationship = person.relationship.toLowerCase();
    const isPrincipal =
      relationship.includes("director") ||
      relationship.includes("officer") ||
      relationship.includes("executive") ||
      relationship.includes("general partner") ||
      relationship.includes("manager") ||
      relationship.includes("principal");

    if (!isPrincipal) continue;

    const searchResult = await searchBrokerByName(
      person.firstName,
      person.lastName
    );

    if (!searchResult?.hits?.hits?.length) continue;

    const bestHit = searchResult.hits.hits[0];
    const source = bestHit._source;

    // Calculate match confidence based on name similarity
    const searchName = `${person.firstName} ${person.lastName}`.toLowerCase();
    const resultName = `${source.ind_firstname} ${source.ind_lastname}`.toLowerCase();
    const confidence = calculateNameConfidence(searchName, resultName);

    // Only include if reasonably confident (>= 0.75)
    if (confidence < 0.75) continue;

    const processed = processFinraHit(bestHit, confidence);
    records.push(processed);

    // Small delay to be respectful to FINRA's servers
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return records;
}

/**
 * Process a raw FINRA hit into our normalized structure
 */
export function processFinraHit(
  hit: FinraHit,
  confidence: number
): ProcessedBrokerRecord {
  const source = hit._source;
  const disclosures = source.ind_disclosures ?? [];

  // Count disclosure types
  let customerDisputes = 0;
  let regulatoryActions = 0;
  let criminalRecords = 0;

  for (const disc of disclosures) {
    const type = disc.disc_type?.toLowerCase() ?? "";
    if (type.includes("customer") || type.includes("civil")) {
      customerDisputes++;
    } else if (type.includes("regulatory") || type.includes("employment")) {
      regulatoryActions++;
    } else if (type.includes("criminal")) {
      criminalRecords++;
    }
  }

  // Find current employer
  const employments = source.ind_employments ?? [];
  const currentJob = employments.find((e) => e.emp_is_current);
  const currentEmployer =
    currentJob?.ia_emp_firm_name ??
    currentJob?.broker_emp_firm_name ??
    null;

  const isRegistered =
    source.ind_bc_scope?.toLowerCase().includes("active") ?? false;

  return {
    finraCrdNumber: hit._id,
    individualName: `${source.ind_firstname} ${source.ind_lastname}`.trim(),
    isCurrentlyRegistered: isRegistered,
    registrationStatus: source.ind_bc_scope ?? "Unknown",
    totalDisclosures: disclosures.length,
    customerDisputes,
    regulatoryActions,
    criminalRecords,
    currentEmployer,
    employmentHistory: employments.slice(0, 10),
    matchConfidence: confidence,
    rawData: source,
  };
}

/**
 * Simple name similarity score (0.0 - 1.0)
 * Checks if first and last names match after normalization
 */
export function calculateNameConfidence(name1: string, name2: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z\s]/g, "");

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1.0;

  const parts1 = n1.split(/\s+/);
  const parts2 = n2.split(/\s+/);

  // Check if first and last name match
  const firstName1 = parts1[0];
  const lastName1 = parts1[parts1.length - 1];
  const firstName2 = parts2[0];
  const lastName2 = parts2[parts2.length - 1];

  if (firstName1 === firstName2 && lastName1 === lastName2) return 0.95;
  if (lastName1 === lastName2 && firstName1[0] === firstName2[0]) return 0.85;
  if (lastName1 === lastName2) return 0.75;

  return 0.0;
}
