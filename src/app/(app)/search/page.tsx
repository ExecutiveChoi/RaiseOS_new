import type { Metadata } from "next";
import { SponsorSearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Search Sponsors",
};

export default function SearchPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Sponsors</h1>
        <p className="text-gray-600 mt-1">
          Search SEC filings to find and vet real estate syndicators.
        </p>
      </div>
      <SponsorSearchClient />
    </div>
  );
}
