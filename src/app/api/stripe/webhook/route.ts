import Stripe from "stripe";
import {
  adminDb,
  apiError,
  required,
  stripeClient,
  syncSeller,
  uuid,
} from "@/lib/payments";

export const runtime = "nodejs";
export function GET() {
  return Response.json({ stripeWebhook: true });
}
export async function POST(request: Request) {
  let event: Stripe.Event;
  try {
    const secret = required("STRIPE_WEBHOOK_SECRET");
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });
    try {
      event = stripeClient().webhooks.constructEvent(
        await request.text(),
        signature,
        secret,
      );
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }
  } catch (error) {
    return apiError(error);
  }
  try {
    if (event.type === "account.updated") {
      // syncSeller first checks our database, ignoring other apps' accounts in the shared sandbox.
      await syncSeller((event.data.object as Stripe.Account).id);
    } else if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.expired",
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (!event.account || !orderId || !uuid.test(orderId))
        return Response.json({ received: true });
      const db = adminDb();
      const { data: order, error } = await db
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (
        !order ||
        order.seller_account_id !== event.account ||
        (order.stripe_session_id && order.stripe_session_id !== session.id)
      )
        return Response.json({ received: true });
      if (event.type === "checkout.session.expired") {
        const { error } = await db
          .from("orders")
          .update({ status: "expired", stripe_session_id: session.id })
          .eq("id", order.id)
          .eq("status", "pending");
        if (error) throw error;
      } else if (session.payment_status === "paid") {
        const { error } = await db.rpc("confirm_checkout", {
          p_order_id: order.id,
          p_session_id: session.id,
          p_account_id: event.account,
          p_amount: session.amount_total,
          p_currency: session.currency,
          p_payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          p_buyer_email: session.customer_details?.email ?? null,
        });
        if (error) throw error;
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
