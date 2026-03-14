import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "pro",
  [process.env.STRIPE_PRICE_VERIFIED_MONTHLY ?? ""]: "verified",
  [process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? ""]: "premium",
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (!userId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = PRICE_TO_TIER[priceId] ?? "pro";

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          tier,
          status: subscription.status as string,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        });

        await supabase
          .from("profiles")
          .update({ subscription_tier: tier, subscription_status: "active" })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = PRICE_TO_TIER[priceId] ?? "pro";
        const status = subscription.status;

        await supabase
          .from("subscriptions")
          .update({
            tier,
            status: status as string,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at: subscription.cancel_at
              ? new Date(subscription.cancel_at * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", subscription.id);

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub?.user_id) {
          await supabase
            .from("profiles")
            .update({ subscription_tier: tier, subscription_status: status })
            .eq("id", sub.user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabase
          .from("subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub?.user_id) {
          await supabase
            .from("profiles")
            .update({ subscription_tier: "free", subscription_status: "canceled" })
            .eq("id", sub.user_id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
