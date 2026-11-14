import { cookies } from "next/headers";
import {
  adminDb,
  apiError,
  appUrl,
  checkOrigin,
  HttpError,
  stripeClient,
  syncSeller,
} from "@/lib/payments";

export const runtime = "nodejs";
const cookieName = "marketplace-stripe-onboarding";

async function onboardingLink(account: string, origin: string) {
  return stripeClient().accountLinks.create({
    account,
    type: "account_onboarding",
    refresh_url: `${origin}/api/stripe/connect/?refresh=1`,
    return_url: `${origin}/connect/?returned=1`,
  });
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Enter a valid seller email.");
    const db = adminDb();
    // Insert the email once; concurrent requests resolve to the same seller and Stripe idempotency key.
    const { error: insertError } = await db
      .from("stripe_sellers")
      .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
    if (insertError) throw insertError;
    const { data: seller, error } = await db
      .from("stripe_sellers")
      .select("*")
      .eq("email", email)
      .single();
    if (error) throw error;
    let accountId = seller.stripe_account_id;
    if (!accountId) {
      const account = await stripeClient().accounts.create(
        {
          type: "standard",
          email,
          metadata: { marketplace_seller_id: seller.id },
        },
        { idempotencyKey: `seller-${seller.id}` },
      );
      accountId = account.id;
      const { error: saveError } = await db
        .from("stripe_sellers")
        .update({ stripe_account_id: accountId })
        .eq("id", seller.id);
      if (saveError) throw saveError;
    }
    const ready = await syncSeller(accountId);
    const origin = appUrl(request);
    const link = ready ? null : await onboardingLink(accountId, origin);
    (await cookies()).set(cookieName, seller.connect_token, {
      httpOnly: true,
      secure: new URL(origin).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    return Response.json({ url: link?.url ?? `${origin}/connect/?returned=1` });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get(cookieName)?.value;
    if (!token) return Response.json({ seller: null });
    const db = adminDb();
    const { data: seller, error } = await db
      .from("stripe_sellers")
      .select("email,stripe_account_id")
      .eq("connect_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!seller?.stripe_account_id) return Response.json({ seller: null });
    const ready = await syncSeller(seller.stripe_account_id);
    if (new URL(request.url).searchParams.has("refresh")) {
      const link = await onboardingLink(
        seller.stripe_account_id,
        appUrl(request),
      );
      return Response.redirect(link.url, 303);
    }
    return Response.json(
      { seller: { email: seller.email, ready } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
