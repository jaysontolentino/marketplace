# Marketplace

A Facebook Marketplace inspired local marketplace, built with Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/ui components, Lucide icons, and Supabase. The reference mockups guide the sidebar, responsive product grid, detail page, listing type selection, and listing editor with a live preview.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase environment variables, the app uses a labeled demo mode with sample listings. New listings, uploaded photos, saved items, and buyer messages persist in this browser’s localStorage. Demo messages do not contact a seller. Browser storage has a limited quota; a failed save displays an error rather than reporting success.

## Connect Supabase later

1. Create a Supabase project.
2. Run `supabase/migrations/202611140001_marketplace.sql` in the project's SQL Editor. It contains the supplied tables, indexes, RLS policies, image bucket, and update trigger, plus a 5 MB image limit and supported image MIME types.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project's URL and publishable/anon key. Never use a service-role key in these variables.
5. Restart `npm run dev`, or rebuild before deploying. These public variables are embedded at build time.

Configured mode reads and writes listings to Supabase, uploads photos to `listing-images`, and inserts buyer messages into `messages`. It starts with your real database contents; demo data is not copied into Supabase. Demo messages and listings remain browser-local.

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

The browser tests use Microsoft Edge (installed locally) and start a dev server automatically. They cover search, categories, saved listings, sorting, publishing with a photo, message persistence, mobile layout, and empty states. For another browser, change the channel in `playwright.config.ts`.

The production build exports `out/`. Run `npm run dev` for local development, or `npm run build` followed by `npm start` to serve the production output. `.openai/hosting.json` configures private Sites hosting for this output. External product photos are loaded from Unsplash; replace them with your own images for real listings.
