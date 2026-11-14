import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export function stripeClient() {
  return new Stripe(required("STRIPE_SECRET_KEY"), { maxNetworkRetries: 2 });
}
export function adminDb() {
  const key =
    process.env.SUPABASE_SECRET_KEY || required("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function appUrl(request: Request) {
  const configured = process.env.APP_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production")
    throw new Error("Missing server configuration: APP_URL");
  return new URL(request.url).origin;
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== appUrl(request))
    throw new HttpError(403, "Request origin is not allowed.");
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  // Never send Stripe objects, credentials, or database internals to the browser.
  console.error(
    "Payment operation failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    {
      error: "Payments are temporarily unavailable. Please try again shortly.",
    },
    { status: 503 },
  );
}
export async function syncSeller(accountId: string) {
  const db = adminDb();
  const { data: seller, error } = await db
    .from("stripe_sellers")
    .select("id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  if (!seller) return null;
  const account = await stripeClient().accounts.retrieve(accountId);
  const ready =
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted;
  const { error: updateError } = await db
    .from("stripe_sellers")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    })
    .eq("id", seller.id);
  if (updateError) throw updateError;
  return ready;
}
