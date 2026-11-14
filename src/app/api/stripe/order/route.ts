import { adminDb, apiError, HttpError, stripeClient } from "@/lib/payments";

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id") || "";
    if (
      !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId) ||
      sessionId.length > 255
    )
      throw new HttpError(400, "Invalid checkout session.");
    // The unguessable Checkout session ID is the receipt token. No buyer/seller personal data is exposed.
    const { data: order, error } = await adminDb()
      .from("orders")
      .select(
        "id,listing_id,listing_title,amount_total,currency,status,seller_account_id",
      )
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new HttpError(404, "Order not found.");
    let paymentReceived = order.status === "paid";
    if (order.status === "pending") {
      const session = await stripeClient().checkout.sessions.retrieve(
        sessionId,
        {},
        { stripeAccount: order.seller_account_id },
      );
      paymentReceived = session.payment_status === "paid";
    }
    const { seller_account_id: _account, ...receipt } = order;
    return Response.json(
      { ...receipt, paymentReceived },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
