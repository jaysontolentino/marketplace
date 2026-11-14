import Stripe from "stripe";
import {
  adminDb,
  apiError,
  appUrl,
  checkOrigin,
  HttpError,
  stripeClient,
  syncSeller,
  uuid,
} from "@/lib/payments";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { listingId, requestId } = await request.json();
    if (
      typeof listingId !== "string" ||
      !uuid.test(listingId) ||
      typeof requestId !== "string" ||
      !uuid.test(requestId)
    )
      throw new HttpError(400, "Invalid checkout request.");
    const db = adminDb();
    const stripe = stripeClient();
    // Reconcile abandoned sessions with Stripe before releasing their reservation.
    // Never release solely on a local clock: a payment webhook may still be in flight.
    const { data: previous, error: previousError } = await db
      .from("orders")
      .select("*")
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .maybeSingle();
    if (previousError) throw previousError;
    if (previous?.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        previous.stripe_session_id,
        {},
        { stripeAccount: previous.seller_account_id },
      );
      if (session.status === "expired") {
        const { error } = await db
          .from("orders")
          .update({ status: "expired" })
          .eq("id", previous.id)
          .eq("status", "pending");
        if (error) throw error;
        if (previous.id === requestId)
          throw new HttpError(410, "Checkout expired. Please try again.");
      } else if (previous.id !== requestId || session.status === "complete") {
        throw new HttpError(
          409,
          "This item is reserved by another checkout or awaiting payment confirmation.",
        );
      }
    }
    const { data: order, error } = await db.rpc("reserve_checkout", {
      p_listing_id: listingId,
      p_order_id: requestId,
    });
    if (error) {
      if (error.message?.includes("Checkout expired"))
        throw new HttpError(410, "Checkout expired. Please try again.");
      throw new HttpError(
        409,
        "This item is unavailable, reserved for checkout, or its seller has not finished Stripe onboarding.",
      );
    }
    if (!(await syncSeller(order.seller_account_id))) {
      // A concurrent retry may already be creating this session. Retain its
      // reservation until Stripe confirms expiry rather than risking a second sale.
      throw new HttpError(409, "This seller cannot accept payments yet.");
    }
    const origin = appUrl(request);
    // The order ID remains stable on retries, so a network failure cannot create two sessions.
    const session = order.stripe_session_id
      ? await stripe.checkout.sessions.retrieve(
          order.stripe_session_id,
          {},
          { stripeAccount: order.seller_account_id },
        )
      : await stripe.checkout.sessions
          .create(
            {
              mode: "payment",
              allowed_payment_method_types: ["card"],
              client_reference_id: order.id,
              expires_at:
                Math.floor(Date.parse(order.created_at) / 1000) + 35 * 60,
              metadata: { order_id: order.id, listing_id: order.listing_id },
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: order.currency,
                    unit_amount: order.amount_total,
                    product_data: { name: order.listing_title },
                  },
                },
              ],
              payment_intent_data: {
                application_fee_amount: order.platform_fee,
                metadata: { order_id: order.id },
              },
              success_url: `${origin}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${origin}/listing/?id=${order.listing_id}&checkout=cancelled`,
            },
            {
              stripeAccount: order.seller_account_id,
              idempotencyKey: `checkout-${order.id}`,
            },
          )
          .catch(async (error) => {
            // A validation failure guarantees no session was created. Timeouts and
            // transport errors remain reserved so the same idempotency key can recover.
            if (error instanceof Stripe.errors.StripeInvalidRequestError) {
              const { error: releaseError } = await db
                .from("orders")
                .update({ status: "expired" })
                .eq("id", order.id)
                .eq("status", "pending");
              if (releaseError) throw releaseError;
              throw new HttpError(
                410,
                "Could not open this checkout. Please try again.",
              );
            }
            throw error;
          });
    const { error: saveError } = await db
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);
    if (saveError) throw saveError;
    if (!session.url)
      throw new HttpError(
        409,
        "Checkout is already completed. Please wait for payment confirmation.",
      );
    return Response.json({ url: session.url });
  } catch (error) {
    return apiError(error);
  }
}
