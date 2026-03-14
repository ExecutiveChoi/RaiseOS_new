import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminSettingsForm } from "./settings-form";
import { Shield } from "lucide-react";

export const metadata: Metadata = { title: "Platform Settings — Admin" };

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch current settings
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("*")
    .order("key");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-600 mt-0.5">
            Configure non-secret platform behavior. API keys must be set in Vercel
            environment variables — never stored here.
          </p>
        </div>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-amber-800">
            <strong>Security note:</strong> This page only stores non-sensitive
            configuration (feature flags, rate limits, display text). All API
            keys (Stripe, OpenAI, Supabase, etc.) must be set as Vercel
            environment variables. See{" "}
            <code className="bg-amber-100 px-1 rounded">.env.example</code> for
            the full list.
          </p>
        </CardContent>
      </Card>

      {/* Where to add API keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys — Set in Vercel</CardTitle>
          <CardDescription>
            These secrets must be added via the Vercel dashboard, not this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", where: "Supabase → Project Settings → API" },
              { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon Key", where: "Supabase → Project Settings → API" },
              { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role", where: "Supabase → Project Settings → API" },
              { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", where: "Stripe Dashboard → Developers → API keys" },
              { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", where: "Stripe Dashboard → Webhooks" },
              { key: "OPENAI_API_KEY", label: "OpenAI API Key", where: "platform.openai.com/api-keys" },
              { key: "RESEND_API_KEY", label: "Resend API Key", where: "resend.com/api-keys" },
              { key: "UPSTASH_REDIS_REST_URL", label: "Upstash Redis URL", where: "console.upstash.com" },
              { key: "CRON_SECRET", label: "Cron Secret", where: "Generate: openssl rand -base64 32" },
            ].map(({ key, label, where }) => (
              <div key={key} className="flex items-start justify-between gap-4 py-2 border-b last:border-0 text-sm">
                <div>
                  <code className="text-blue-700 bg-blue-50 px-1 rounded text-xs">{key}</code>
                  <p className="text-gray-700 mt-0.5">{label}</p>
                </div>
                <p className="text-gray-400 text-xs text-right shrink-0">{where}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editable platform config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Configuration</CardTitle>
          <CardDescription>
            Feature flags and behavior settings stored in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminSettingsForm
            settings={
              (settings ?? []) as Array<{
                id: string;
                key: string;
                value: string;
                description: string | null;
              }>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
