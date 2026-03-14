import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts, watchlistItems, sponsors, profiles } from "@/lib/db/schema";
import { eq, and, isNull, isNotNull, sql, gt } from "drizzle-orm";
import { subDays } from "date-fns";

function verifyRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Send an email via Resend (if configured).
 * Gracefully skips if RESEND_API_KEY is not set.
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SyndiCheck <alerts@syndicheck.com>",
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildAlertEmail(
  alertTitle: string,
  alertBody: string,
  sponsorName: string,
  sponsorSlug: string,
  appUrl: string
): string {
  const sponsorUrl = `${appUrl}/sponsor/${sponsorSlug}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${alertTitle}</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 20px; color: #2563eb;">SyndiCheck Alert</h1>
  </div>
  <h2 style="font-size: 16px;">${alertTitle}</h2>
  <p style="color: #4b5563;">${alertBody}</p>
  <a href="${sponsorUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; margin-top: 16px;">
    View ${sponsorName} on SyndiCheck
  </a>
  <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
    You're receiving this because ${sponsorName} is on your watchlist.
    <a href="${appUrl}/app/watchlist" style="color: #2563eb;">Manage watchlist</a>
  </p>
</body>
</html>`.trim();
}

export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://syndicheck.com";

  const results = {
    alertsFound: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    markedRead: 0,
    errors: 0,
  };

  try {
    // Find all unsent alerts created in the last 24 hours
    const since = subDays(new Date(), 1);

    const pendingAlerts = await db
      .select({
        alertId: alerts.id,
        userId: alerts.userId,
        sponsorId: alerts.sponsorId,
        type: alerts.type,
        title: alerts.title,
        body: alerts.body,
        link: alerts.link,
        userEmail: profiles.email,
        sponsorName: sponsors.name,
        sponsorSlug: sponsors.slug,
        alertOnEnforcement: watchlistItems.alertOnEnforcement,
        alertOnNewFiling: watchlistItems.alertOnNewFiling,
        alertOnNewReview: watchlistItems.alertOnNewReview,
        alertOnScoreChange: watchlistItems.alertOnScoreChange,
      })
      .from(alerts)
      .innerJoin(profiles, eq(alerts.userId, profiles.id))
      .leftJoin(sponsors, eq(alerts.sponsorId, sponsors.id))
      .leftJoin(
        watchlistItems,
        and(
          eq(watchlistItems.userId, alerts.userId),
          eq(watchlistItems.sponsorId, alerts.sponsorId!)
        )
      )
      .where(
        and(
          eq(alerts.isEmailed, false),
          eq(alerts.isRead, false),
          gt(alerts.createdAt, since)
        )
      )
      .limit(200);

    results.alertsFound = pendingAlerts.length;

    for (const alert of pendingAlerts) {
      try {
        // Check if user wants this type of alert emailed
        const wantsEmail = (() => {
          if (!alert.alertOnEnforcement && !alert.alertOnNewFiling &&
              !alert.alertOnNewReview && !alert.alertOnScoreChange) {
            // No watchlist item found — still send
            return true;
          }
          if (alert.type === "enforcement_action") return alert.alertOnEnforcement ?? true;
          if (alert.type === "new_filing") return alert.alertOnNewFiling ?? true;
          if (alert.type === "new_review") return alert.alertOnNewReview ?? true;
          if (alert.type === "score_change") return alert.alertOnScoreChange ?? true;
          return true;
        })();

        if (!wantsEmail) {
          results.emailsSkipped++;
          continue;
        }

        const sponsorName = alert.sponsorName ?? "a syndicator";
        const sponsorSlug = alert.sponsorSlug ?? "";

        const html = buildAlertEmail(
          alert.title,
          alert.body ?? "",
          sponsorName,
          sponsorSlug,
          appUrl
        );

        const sent = await sendEmail({
          to: alert.userEmail,
          subject: `SyndiCheck: ${alert.title}`,
          html,
        });

        if (sent) {
          results.emailsSent++;
        } else {
          results.emailsSkipped++;
        }

        // Mark as emailed regardless (avoid re-sending on next run)
        await db
          .update(alerts)
          .set({ isEmailed: true })
          .where(eq(alerts.id, alert.alertId));

        results.markedRead++;
      } catch (err) {
        console.error("Error sending alert:", err);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Processed ${results.alertsFound} alerts, sent ${results.emailsSent} emails`,
    });
  } catch (error) {
    console.error("Alert sending error:", error);
    return NextResponse.json(
      { success: false, error: String(error), ...results },
      { status: 500 }
    );
  }
}
