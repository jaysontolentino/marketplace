# Marketplace

A Facebook Marketplace inspired local marketplace, built with Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/ui components, Lucide icons, and Supabase. The reference mockups guide the sidebar, responsive product grid, detail page, listing type selection, and listing editor with a live preview.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The app uses Supabase for all listings, uploaded photos, and buyer messages. An empty database shows an empty marketplace. Missing configuration or failed requests display an error; no sample data or browser-local listing/message fallback is used. Saved-item bookmarks stay in this browser's localStorage.

## Supabase configuration

1. Create a Supabase project.
2. Run `supabase/migrations/202611140001_marketplace.sql` in the project's SQL Editor. It contains the supplied tables, indexes, RLS policies, image bucket, and update trigger, plus a 5 MB image limit and supported image MIME types.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's URL and publishable key. Legacy projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead. Never use a service-role key in these variables.
5. Restart `npm run dev`, or rebuild before deploying. These public variables are embedded at build time.

Browsing and detail pages read from `listings`. Publishing uploads a validated image to `listing-images`, saves the listing with its public image URL, and opens the persisted item page. Messaging inserts the listing ID, buyer email, seller email, and message into `messages`; success appears only after Supabase accepts the insert. Existing tables and buckets do not need to be recreated if the migration is already applied.

Uploads and listing inserts are separate requests. If an insert fails after a successful upload, the app reports the failure and the photo remains in Storage. The supplied storage policies do not allow anonymous deletion; no public delete policy is added.

The migration preserves the requested public message SELECT policy. That policy lets anyone with the public API key read buyer/seller emails and message contents. Before using real customer messages, replace it with participant-only policies and add authenticated accounts. The UI does not expose an inbox, and messaging sends no email notifications. Seller email links open the user's email application.

## Routes and behavior

- `/`: keyword search, category sidebar and tabs, price filter, newest/price sorting, grid/list toggle, and browser-local saved items.
- `/create/`: listing type selection, validated photo upload, form fields, live preview, publication, and redirect to the new listing.
- `/listing/?id=<uuid>`: shareable item page, full description, seller email, and buyer message form.

The query-string detail route supports newly created Supabase items without generating a page per item. Listing and message operations use browser Supabase RLS. Payment operations run exclusively on the server.

## Stripe Connect and Checkout

1. Apply `supabase/migrations/202611140002_stripe.sql` in the Supabase SQL Editor after the initial migration. It adds private seller accounts and orders, listing status, and server-only transactional checkout functions. It also removes anonymous listing updates so payment amounts and sold status cannot be changed through the public API.
2. Keep your existing Stripe sandbox keys. Add `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) to `.env.local` and Vercel; never prefix these server secrets with `NEXT_PUBLIC_`. Hosted Checkout redirects do not require the Stripe publishable key.
3. Set `APP_URL` to `http://localhost:3000` locally and your public production HTTPS origin in Vercel. Restart the local server after changing environment variables.
4. Visit `/connect/`, enter the email on your listings, and click **Connect with Stripe**. Finish hosted onboarding using sandbox data. Email matching ignores whitespace and case. Returning to the app and verified `account.updated` webhooks both refresh payment readiness. A return URL alone never declares onboarding complete. No marketplace login or email verification is required, as requested; email is an identifier rather than proof of ownership.
5. Eligible available listings show **Buy Now** on the detail page. Checkout charges the seller's connected account directly in USD and sends a 10% application fee to the platform. Stripe processing fees are also deducted from the seller's balance. Prices must be $0.50–$999,999.99 for online checkout; free and out-of-range listings remain browseable and messageable.
6. A database reservation prevents concurrent sales. Browser retries use a stable order ID and Stripe idempotency key. Checkout expires after approximately 35 minutes; the expiry webhook releases the reservation. Returning from a cancelled checkout lets the same browser resume it until expiry. Pending reservations are never released based only on elapsed local time, since a payment confirmation may be in flight. Transport failures retain the reservation for a safe retry; definitive Stripe validation failures release it.
7. The success page retrieves the receipt using the unguessable Checkout session ID and waits for webhook confirmation. Only a signed, paid Checkout event atomically records the payment details and marks the listing sold. Retried events are idempotent. Private order tables are unavailable to anonymous clients; receipts omit buyer email and seller account IDs. Unrecognized accounts, orders, and events are acknowledged with HTTP 200 in the shared sandbox.

### Webhook setup on Vercel

Deploy as a normal Next.js application on Vercel, with the environment variables above. Ensure `/api/stripe/webhook/` on the **production URL** is publicly reachable, without preview login protection. Then set `APP_URL` in `.env.local` to that production origin and run once:

```sh
node --env-file=.env.local scripts/create-webhook.mjs
```

The script checks the deployed route, registers a **Connect** endpoint (`connect: true`) pinned to the installed Stripe SDK's API version, and subscribes to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `account.updated`. It immediately saves the one-time signing secret to ignored `.env.local` without printing it. If a nonempty local secret already exists, the new secret goes to ignored `.env.webhook` instead. The script refuses to create another endpoint with the same URL and never deletes any endpoint. Copy the saved `STRIPE_WEBHOOK_SECRET` into Vercel and redeploy. Restore local `APP_URL` afterward when developing locally.

For local webhook testing:

```sh
stripe listen --api-key YOUR_SANDBOX_SECRET --forward-connect-to localhost:3000/api/stripe/webhook/
```

Use the CLI's temporary `whsec_...` as the local `STRIPE_WEBHOOK_SECRET`, then restart. Keep the separately registered production secret in Vercel. Complete a checkout using card `4242 4242 4242 4242`, a future expiration date and any CVC. Verify the success receipt, paid order in Supabase, sold listing, and the direct charge/application fee on the connected account.

## Checks and deployment

```sh
npm run typecheck
npm run test:payments
npm test
npm run build
```

The browser tests use Microsoft Edge (installed locally) and start an isolated dev server on port 3100 with test-only Supabase configuration. Supabase HTTP requests are intercepted with test fixtures: no automated test writes to your real project. Tests cover browsing, filters, bookmarks, uploads followed by listing inserts, reloading a persisted item, messaging payloads, empty states, and database/storage failures. For another browser, change the channel in `playwright.config.ts`. Test fixtures are confined to the tests and are never imported by the application.

Run `npm run dev` for local development, or `npm run build` followed by `npm start` to run the production Next.js server. Payments require server routes, so static export/`out/` hosting is no longer supported. The historical `.openai/hosting.json` refers to the previous static Sites deployment; deploy this server application to Vercel instead. Payment unit tests use mocked external services and real Stripe signature verification; browser tests mock Supabase and Stripe availability and never write to live services.
