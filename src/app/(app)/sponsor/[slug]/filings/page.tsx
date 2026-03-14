import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { sponsors, filings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { FilingTimeline } from "@/components/sponsors/FilingTimeline";
import { formatDollars } from "@/lib/utils";
import type { Filing } from "@/types/filing";
import { ArrowLeft, FileText } from "lucide-react";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const sponsor = await db
    .select({ name: sponsors.name })
    .from(sponsors)
    .where(eq(sponsors.slug, params.slug))
    .limit(1);

  const name = sponsor[0]?.name ?? "Sponsor";
  return {
    title: `${name} — Filing History`,
    description: `Complete SEC EDGAR filing history for ${name}`,
  };
}

export default async function FilingsPage({ params }: Props) {
  // Load sponsor
  const sponsorRows = await db
    .select()
    .from(sponsors)
    .where(eq(sponsors.slug, params.slug))
    .limit(1);

  if (!sponsorRows.length) notFound();
  const sponsor = sponsorRows[0];

  // Load all filings for this sponsor, newest first
  const filingRows = await db
    .select()
    .from(filings)
    .where(eq(filings.sponsorId, sponsor.id))
    .orderBy(desc(filings.filedAt));

  const typedFilings = filingRows as unknown as Filing[];

  // Aggregate stats
  const totalRaised = typedFilings.reduce(
    (sum, f) => sum + (f.totalAmountSold ?? 0),
    0
  );
  const totalOffering = typedFilings.reduce(
    (sum, f) => sum + (f.totalOfferingAmount ?? 0),
    0
  );
  const count506b = typedFilings.filter((f) => f.exemption === "506b").length;
  const count506c = typedFilings.filter((f) => f.exemption === "506c").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href={`/sponsor/${params.slug}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {sponsor.name}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          SEC Filing History
        </h1>
        <p className="mt-1 text-sm text-gray-500">{sponsor.name}</p>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Filings" value={String(typedFilings.length)} />
        <StatCard label="Total Raised" value={formatDollars(totalRaised)} />
        <StatCard
          label="506(b) Offerings"
          value={String(count506b)}
          subtitle="Non-advertised"
        />
        <StatCard
          label="506(c) Offerings"
          value={String(count506c)}
          subtitle="Publicly advertised"
        />
      </div>

      {/* Timeline */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-700">
          <FileText className="h-4 w-4" />
          Filing Timeline
        </h2>
        <FilingTimeline filings={typedFilings} />
      </div>

      {/* Legal disclaimer */}
      <p className="mt-10 text-xs text-gray-400">
        Data sourced from SEC EDGAR public records. Filing information reflects
        what was reported to the SEC and may not represent actual investor
        outcomes. This is not investment advice.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}
