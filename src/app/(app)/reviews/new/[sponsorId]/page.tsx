import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Write a Review" };

interface Props {
  params: Promise<{ sponsorId: string }>;
}

export default async function NewReviewPage({ params }: Props) {
  const { sponsorId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id, name, slug")
    .eq("id", sponsorId)
    .single();

  if (!sponsor) notFound();

  // Check if user already reviewed this sponsor
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("sponsor_id", sponsorId)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/sponsor/${sponsor.slug}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {sponsor.name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Write a Review</h1>
        <p className="text-gray-600 mt-1">
          Reviewing: <strong>{sponsor.name}</strong>
        </p>
      </div>

      {existingReview ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm">
          You&apos;ve already submitted a review for this sponsor. You can only
          submit one review per sponsor.
        </div>
      ) : (
        <ReviewForm sponsorId={sponsorId} sponsorSlug={sponsor.slug} />
      )}
    </div>
  );
}
