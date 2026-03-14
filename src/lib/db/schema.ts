import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  jsonb,
  inet,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================
// ENUMS
// =============================================================
export const userRoleEnum = pgEnum("user_role", ["lp", "gp", "admin"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "pro",
  "verified",
  "premium",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
]);
export const filingTypeEnum = pgEnum("filing_type", [
  "form_d",
  "form_d_a",
  "other",
]);
export const exemptionTypeEnum = pgEnum("exemption_type", [
  "506b",
  "506c",
  "other",
]);
export const enforcementSeverityEnum = pgEnum("enforcement_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const claimStatusEnum = pgEnum("claim_status", [
  "pending",
  "verified",
  "rejected",
]);
export const alertTypeEnum = pgEnum("alert_type", [
  "new_filing",
  "enforcement_action",
  "new_review",
  "score_change",
]);

// =============================================================
// PROFILES
// =============================================================
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: userRoleEnum("role").notNull().default("lp"),
  avatarUrl: text("avatar_url"),
  isAccreditedInvestor: boolean("is_accredited_investor").default(false),
  companyName: text("company_name"),
  subscriptionTier: subscriptionTierEnum("subscription_tier")
    .notNull()
    .default("free"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default(
    "active"
  ),
  stripeCustomerId: text("stripe_customer_id").unique(),
  monthlySearchesUsed: integer("monthly_searches_used").notNull().default(0),
  monthlySearchesResetAt: timestamp("monthly_searches_reset_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// =============================================================
// SUBSCRIPTIONS
// =============================================================
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").unique().notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    tier: subscriptionTierEnum("tier").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_subscriptions_user").on(t.userId),
    stripeIdx: index("idx_subscriptions_stripe").on(t.stripeSubscriptionId),
  })
);

// =============================================================
// SPONSORS
// =============================================================
export const sponsors = pgTable(
  "sponsors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    normalizedName: text("normalized_name").notNull(),
    cik: text("cik"),
    secFileNumber: text("sec_file_number"),
    ein: text("ein"),
    state: text("state"),
    city: text("city"),
    zipCode: text("zip_code"),
    address: text("address"),
    description: text("description"),
    website: text("website"),
    logoUrl: text("logo_url"),
    yearFounded: integer("year_founded"),
    totalOfferings: integer("total_offerings").notNull().default(0),
    totalAmountRaised: bigint("total_amount_raised", { mode: "number" })
      .notNull()
      .default(0),
    totalReviews: integer("total_reviews").notNull().default(0),
    averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
    trustScore: integer("trust_score"),
    trustScoreComputedAt: timestamp("trust_score_computed_at", {
      withTimezone: true,
    }),
    hasEnforcementActions: boolean("has_enforcement_actions")
      .notNull()
      .default(false),
    hasFinraFlags: boolean("has_finra_flags").notNull().default(false),
    isClaimed: boolean("is_claimed").notNull().default(false),
    claimedBy: uuid("claimed_by").references(() => profiles.id),
    firstFilingDate: timestamp("first_filing_date", { withTimezone: true }),
    latestFilingDate: timestamp("latest_filing_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("idx_sponsors_slug").on(t.slug),
    cikIdx: index("idx_sponsors_cik").on(t.cik),
    trustScoreIdx: index("idx_sponsors_trust_score").on(t.trustScore),
    stateIdx: index("idx_sponsors_state").on(t.state),
    totalRaisedIdx: index("idx_sponsors_total_raised").on(t.totalAmountRaised),
  })
);

// =============================================================
// FILINGS
// =============================================================
export const filings = pgTable(
  "filings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    accessionNumber: text("accession_number").unique().notNull(),
    secUrl: text("sec_url"),
    filingType: filingTypeEnum("filing_type").notNull().default("form_d"),
    filedAt: timestamp("filed_at", { withTimezone: true }).notNull(),
    issuerName: text("issuer_name").notNull(),
    entityType: text("entity_type"),
    industryGroup: text("industry_group"),
    exemption: exemptionTypeEnum("exemption"),
    totalOfferingAmount: bigint("total_offering_amount", { mode: "number" }),
    totalAmountSold: bigint("total_amount_sold", { mode: "number" }),
    totalRemaining: bigint("total_remaining", { mode: "number" }),
    minimumInvestmentAmount: bigint("minimum_investment_amount", {
      mode: "number",
    }),
    totalNumberAlreadyInvested: integer("total_number_already_invested"),
    hasSalesCompensation: boolean("has_sales_compensation").default(false),
    salesCompensationAmount: bigint("sales_compensation_amount", {
      mode: "number",
    }),
    hasNonAccreditedInvestors: boolean("has_non_accredited_investors").default(
      false
    ),
    numberNonAccredited: integer("number_non_accredited").default(0),
    relatedPersons: jsonb("related_persons").default([]),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sponsorIdx: index("idx_filings_sponsor").on(t.sponsorId),
    filedAtIdx: index("idx_filings_filed_at").on(t.filedAt),
    accessionIdx: index("idx_filings_accession").on(t.accessionNumber),
    exemptionIdx: index("idx_filings_exemption").on(t.exemption),
  })
);

// =============================================================
// ENFORCEMENT ACTIONS
// =============================================================
export const enforcementActions = pgTable(
  "enforcement_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    secActionId: text("sec_action_id"),
    secUrl: text("sec_url"),
    title: text("title").notNull(),
    summary: text("summary"),
    respondentNames: text("respondent_names").array().notNull().default([]),
    severity: enforcementSeverityEnum("severity").notNull().default("medium"),
    actionDate: timestamp("action_date", { withTimezone: true }),
    resolutionDate: timestamp("resolution_date", { withTimezone: true }),
    disgorgementAmount: bigint("disgorgement_amount", { mode: "number" }),
    penaltyAmount: bigint("penalty_amount", { mode: "number" }),
    matchedAutomatically: boolean("matched_automatically").notNull().default(true),
    matchConfidence: numeric("match_confidence", { precision: 3, scale: 2 }),
    reviewedByAdmin: boolean("reviewed_by_admin").notNull().default(false),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sponsorIdx: index("idx_enforcement_sponsor").on(t.sponsorId),
    dateIdx: index("idx_enforcement_date").on(t.actionDate),
  })
);

// =============================================================
// BROKER RECORDS
// =============================================================
export const brokerRecords = pgTable(
  "broker_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    finraCrdNumber: text("finra_crd_number"),
    individualName: text("individual_name").notNull(),
    isCurrentlyRegistered: boolean("is_currently_registered").default(false),
    registrationStatus: text("registration_status"),
    totalDisclosures: integer("total_disclosures").notNull().default(0),
    customerDisputes: integer("customer_disputes").notNull().default(0),
    regulatoryActions: integer("regulatory_actions").notNull().default(0),
    criminalRecords: integer("criminal_records").notNull().default(0),
    currentEmployer: text("current_employer"),
    employmentHistory: jsonb("employment_history").default([]),
    matchConfidence: numeric("match_confidence", { precision: 3, scale: 2 }),
    rawData: jsonb("raw_data"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sponsorIdx: index("idx_broker_sponsor").on(t.sponsorId),
    crdIdx: index("idx_broker_crd").on(t.finraCrdNumber),
  })
);

// =============================================================
// TRUST SCORES
// =============================================================
export const trustScores = pgTable(
  "trust_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    filingComplianceScore: integer("filing_compliance_score").notNull(),
    enforcementScore: integer("enforcement_score").notNull(),
    brokerRecordScore: integer("broker_record_score").notNull(),
    propertyVerificationScore: integer("property_verification_score").notNull(),
    communitySentimentScore: integer("community_sentiment_score").notNull(),
    filingConsistencyScore: integer("filing_consistency_score").notNull(),
    factors: jsonb("factors").notNull().default({}),
    dataCompleteness: numeric("data_completeness", { precision: 3, scale: 2 }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sponsorIdx: index("idx_trust_scores_sponsor").on(t.sponsorId),
    computedIdx: index("idx_trust_scores_computed").on(t.computedAt),
  })
);

// =============================================================
// REVIEWS
// =============================================================
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    overallRating: integer("overall_rating").notNull(),
    communicationRating: integer("communication_rating"),
    transparencyRating: integer("transparency_rating"),
    returnsAccuracyRating: integer("returns_accuracy_rating"),
    title: text("title"),
    body: text("body").notNull(),
    investmentAmountRange: text("investment_amount_range"),
    investmentYear: integer("investment_year"),
    dealType: text("deal_type"),
    isVerifiedInvestor: boolean("is_verified_investor").default(false),
    isPublished: boolean("is_published").notNull().default(true),
    isFlagged: boolean("is_flagged").notNull().default(false),
    flaggedReason: text("flagged_reason"),
    gpResponse: text("gp_response"),
    gpResponseAt: timestamp("gp_response_at", { withTimezone: true }),
    gpRespondedBy: uuid("gp_responded_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sponsorIdx: index("idx_reviews_sponsor").on(t.sponsorId),
    userIdx: index("idx_reviews_user").on(t.userId),
    uniqueUserSponsor: uniqueIndex("idx_reviews_unique_user_sponsor").on(
      t.userId,
      t.sponsorId
    ),
  })
);

// =============================================================
// WATCHLIST
// =============================================================
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    alertOnNewFiling: boolean("alert_on_new_filing").notNull().default(true),
    alertOnEnforcement: boolean("alert_on_enforcement").notNull().default(true),
    alertOnNewReview: boolean("alert_on_new_review").notNull().default(true),
    alertOnScoreChange: boolean("alert_on_score_change").notNull().default(true),
    personalNotes: text("personal_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueUserSponsor: uniqueIndex("idx_watchlist_unique").on(
      t.userId,
      t.sponsorId
    ),
    userIdx: index("idx_watchlist_user").on(t.userId),
  })
);

// =============================================================
// ALERTS
// =============================================================
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    type: alertTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    isEmailed: boolean("is_emailed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_alerts_user").on(t.userId),
  })
);

// =============================================================
// SEARCH LOGS
// =============================================================
export const searchLogs = pgTable(
  "search_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    query: text("query").notNull(),
    resultsCount: integer("results_count").notNull().default(0),
    sponsorClicked: uuid("sponsor_clicked").references(() => sponsors.id),
    ipAddress: inet("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_search_logs_user").on(t.userId),
    dateIdx: index("idx_search_logs_date").on(t.createdAt),
  })
);

// =============================================================
// SPONSOR CLAIMS
// =============================================================
export const sponsorClaims = pgTable(
  "sponsor_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: claimStatusEnum("status").notNull().default("pending"),
    verificationMethod: text("verification_method"),
    verificationDocumentUrl: text("verification_document_url"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sponsorIdx: index("idx_claims_sponsor").on(t.sponsorId),
    statusIdx: index("idx_claims_status").on(t.status),
  })
);

// =============================================================
// ADMIN SETTINGS
// =============================================================
export const adminSettings = pgTable("admin_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// =============================================================
// RELATIONS
// =============================================================
export const profilesRelations = relations(profiles, ({ many }) => ({
  subscriptions: many(subscriptions),
  reviews: many(reviews),
  watchlistItems: many(watchlistItems),
  alerts: many(alerts),
  searchLogs: many(searchLogs),
  sponsorClaims: many(sponsorClaims),
}));

export const sponsorsRelations = relations(sponsors, ({ many }) => ({
  filings: many(filings),
  enforcementActions: many(enforcementActions),
  brokerRecords: many(brokerRecords),
  trustScores: many(trustScores),
  reviews: many(reviews),
  watchlistItems: many(watchlistItems),
  sponsorClaims: many(sponsorClaims),
}));

export const filingsRelations = relations(filings, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [filings.sponsorId],
    references: [sponsors.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [reviews.sponsorId],
    references: [sponsors.id],
  }),
  user: one(profiles, {
    fields: [reviews.userId],
    references: [profiles.id],
  }),
}));
