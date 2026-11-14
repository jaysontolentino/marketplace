import Stripe from "stripe";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

if (!process.env.STRIPE_SECRET_KEY)
  throw new Error("Set STRIPE_SECRET_KEY in .env.local.");
const origin = new URL(process.env.APP_URL || "http://localhost:3000");
if (origin.protocol !== "https:" || origin.hostname === "localhost") {
  throw new Error(
    "Set APP_URL to your public production HTTPS origin before registering the webhook.",
  );
}
const url = new URL("/api/stripe/webhook/", origin).href;
// Probe the deployed route before creating anything in the shared Stripe sandbox.
const probe = await fetch(url, { redirect: "manual" });
if (!probe.ok || !(await probe.json().catch(() => null))?.stripeWebhook) {
  throw new Error(
    `Webhook route is not reachable (${probe.status}). Deploy the app without login protection first.`,
  );
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
for await (const existing of stripe.webhookEndpoints.list({ limit: 100 })) {
  if (existing.url === url) {
    throw new Error(
      "This webhook URL is already registered. Use its saved secret; Stripe cannot show it again. No endpoint was modified.",
    );
  }
}
const endpoint = await stripe.webhookEndpoints.create(
  {
    url,
    connect: true,
    api_version: Stripe.API_VERSION,
    enabled_events: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
      "account.updated",
    ],
    description: `Marketplace Connect: ${origin.origin}`,
  },
  { idempotencyKey: `marketplace-webhook-${origin.hostname}` },
);
// Save immediately, without printing the secret in terminal logs.
const envPath = ".env.local";
const contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
if (/^STRIPE_WEBHOOK_SECRET=.+$/m.test(contents)) {
  appendFileSync(".env.webhook", `STRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`);
  console.log(
    `Created ${endpoint.id}. Signing secret saved to ignored .env.webhook; existing local secret preserved.`,
  );
} else {
  appendFileSync(envPath, `\nSTRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`);
  console.log(
    `Created ${endpoint.id}. Signing secret saved to ignored .env.local.`,
  );
}
console.log(
  "Add the signing secret to Vercel's STRIPE_WEBHOOK_SECRET and redeploy. Endpoint:",
  url,
);
