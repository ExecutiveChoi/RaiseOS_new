import type { TrustScore } from "@/types/sponsor";

interface TrustScoreBreakdownProps {
  trustScore: TrustScore;
}

interface ScoreRow {
  label: string;
  score: number;
  weight: string;
  description: string;
}

export function TrustScoreBreakdown({ trustScore }: TrustScoreBreakdownProps) {
  const rows: ScoreRow[] = [
    {
      label: "Filing Compliance",
      score: trustScore.filingComplianceScore,
      weight: "25%",
      description: "Timely filings, proper amendments, exemption consistency",
    },
    {
      label: "Enforcement Record",
      score: trustScore.enforcementScore,
      weight: "25%",
      description: "SEC enforcement actions and regulatory penalties",
    },
    {
      label: "Broker/Adviser History",
      score: trustScore.brokerRecordScore,
      weight: "15%",
      description: "FINRA disclosures, customer disputes, regulatory actions",
    },
    {
      label: "Property Verification",
      score: trustScore.propertyVerificationScore,
      weight: "15%",
      description: "Claimed properties verified against public records",
    },
    {
      label: "Community Rating",
      score: trustScore.communitySentimentScore,
      weight: "10%",
      description: "Weighted average of LP investor reviews",
    },
    {
      label: "Filing Consistency",
      score: trustScore.filingConsistencyScore,
      weight: "10%",
      description: "Consistent offering amounts and exemption patterns",
    },
  ];

  const dataCompleteness = trustScore.dataCompleteness
    ? Math.round(parseFloat(String(trustScore.dataCompleteness)) * 100)
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row) => (
          <ScoreBar key={row.label} {...row} />
        ))}
      </div>

      {dataCompleteness !== null && (
        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">
            Score based on{" "}
            <span className="font-medium">{dataCompleteness}%</span> data
            completeness.{" "}
            {dataCompleteness < 100 &&
              "Some data sources not yet available for this sponsor."}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Last computed:{" "}
        {new Date(trustScore.computedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  weight,
  description,
}: ScoreRow) {
  const color =
    score >= 80
      ? "bg-green-500"
      : score >= 60
      ? "bg-blue-500"
      : score >= 40
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">{label}</span>
          <span className="text-xs text-gray-400">{weight}</span>
        </div>
        <span className="font-semibold text-gray-900">{score}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
