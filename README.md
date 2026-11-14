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

The query-string detail route allows newly created Supabase items to work with static hosting without generating a page per item. All data operations happen in the browser under Supabase RLS.

## Checks and deployment

```sh
npm run typecheck
npm test
npm run build
```

The browser tests use Microsoft Edge (installed locally) and start an isolated dev server on port 3100 with test-only Supabase configuration. Supabase HTTP requests are intercepted with test fixtures: no automated test writes to your real project. Tests cover browsing, filters, bookmarks, uploads followed by listing inserts, reloading a persisted item, messaging payloads, empty states, and database/storage failures. For another browser, change the channel in `playwright.config.ts`. Test fixtures are confined to the tests and are never imported by the application.

The production build exports `out/`. Run `npm run dev` for local development, or `npm run build` followed by `npm start` to serve the production output. `.openai/hosting.json` configures private Sites hosting for this output. External product photos are loaded from Unsplash; replace them with your own images for real listings.
