"use client";

import { formatDate, formatDollars, formatExemption } from "@/lib/utils";
import type { Filing } from "@/types/filing";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";

interface FilingTimelineProps {
  filings: Filing[];
  className?: string;
}

export function FilingTimeline({ filings, className }: FilingTimelineProps) {
  if (filings.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        No SEC filings found.
      </div>
    );
  }

  return (
    <ol className={`relative border-l border-gray-200 ${className ?? ""}`}>
      {filings.map((filing, index) => (
        <li key={filing.id} className="mb-8 ml-6">
          {/* Timeline dot */}
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-8 ring-white">
            {filing.exemption === "506c" ? (
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
            ) : filing.exemption === "506b" ? (
              <FileText className="h-5 w-5 text-indigo-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}
          </span>

          {/* Header */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <time className="text-xs font-normal text-gray-400">
              {filing.filedAt ? formatDate(filing.filedAt) : "Unknown date"}
            </time>
            <FilingTypeBadge type={filing.filingType} />
            {filing.exemption && (
              <Badge variant="outline" className="text-xs">
                {formatExemption(filing.exemption)}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-gray-900">
            {filing.issuerName}
          </h3>

          {/* Details grid */}
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {filing.totalOfferingAmount != null && (
              <>
                <dt className="text-gray-500">Offering Size</dt>
                <dd className="col-span-1 font-medium text-gray-700">
                  {formatDollars(filing.totalOfferingAmount)}
                </dd>
              </>
            )}
            {filing.totalAmountSold != null && (
              <>
                <dt className="text-gray-500">Amount Raised</dt>
                <dd className="col-span-1 font-medium text-gray-700">
                  {formatDollars(filing.totalAmountSold)}
                </dd>
              </>
            )}
            {filing.totalNumberAlreadyInvested != null && (
              <>
                <dt className="text-gray-500">Investors</dt>
                <dd className="col-span-1 font-medium text-gray-700">
                  {filing.totalNumberAlreadyInvested.toLocaleString()}
                </dd>
              </>
            )}
            {filing.minimumInvestmentAmount != null && (
              <>
                <dt className="text-gray-500">Min Investment</dt>
                <dd className="col-span-1 font-medium text-gray-700">
                  {formatDollars(filing.minimumInvestmentAmount)}
                </dd>
              </>
            )}
          </dl>

          {/* Warning flags */}
          <div className="mt-2 flex flex-wrap gap-2">
            {filing.hasNonAccreditedInvestors && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                <AlertCircle className="h-3 w-3" />
                Non-accredited investors
              </span>
            )}
            {filing.hasSalesCompensation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                <FileText className="h-3 w-3" />
                Sales compensation paid
              </span>
            )}
          </div>

          {/* SEC link */}
          {filing.secUrl && (
            <a
              href={filing.secUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-600 underline-offset-2 hover:underline"
            >
              View on SEC EDGAR →
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

function FilingTypeBadge({ type }: { type: string }) {
  if (type === "form_d_a") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
        Form D/A (Amendment)
      </Badge>
    );
  }
  return (
    <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-xs">
      Form D
    </Badge>
  );
}
