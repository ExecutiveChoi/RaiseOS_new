export interface Filing {
  id: string;
  sponsorId: string;
  accessionNumber: string;
  secUrl: string | null;
  filingType: "form_d" | "form_d_a" | "other";
  filedAt: string;
  issuerName: string;
  entityType: string | null;
  industryGroup: string | null;
  exemption: "506b" | "506c" | "other" | null;
  totalOfferingAmount: number | null;
  totalAmountSold: number | null;
  totalRemaining: number | null;
  minimumInvestmentAmount: number | null;
  totalNumberAlreadyInvested: number | null;
  hasSalesCompensation: boolean;
  salesCompensationAmount: number | null;
  hasNonAccreditedInvestors: boolean;
  numberNonAccredited: number;
  relatedPersons: RelatedPerson[];
  rawData: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface RelatedPerson {
  name: string;
  relationship: string;
  address?: string;
}

export interface EnforcementAction {
  id: string;
  sponsorId: string | null;
  secActionId: string | null;
  secUrl: string | null;
  title: string;
  summary: string | null;
  respondentNames: string[];
  severity: "low" | "medium" | "high" | "critical";
  actionDate: string | null;
  resolutionDate: string | null;
  disgorgementAmount: number | null;
  penaltyAmount: number | null;
  matchedAutomatically: boolean;
  matchConfidence: string | null;
  reviewedByAdmin: boolean;
  rawData: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerRecord {
  id: string;
  sponsorId: string | null;
  finraCrdNumber: string | null;
  individualName: string;
  isCurrentlyRegistered: boolean;
  registrationStatus: string | null;
  totalDisclosures: number;
  customerDisputes: number;
  regulatoryActions: number;
  criminalRecords: number;
  currentEmployer: string | null;
  employmentHistory: unknown[];
  matchConfidence: string | null;
  rawData: unknown;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}
