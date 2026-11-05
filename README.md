# ArtHub — Online Art Marketplace

ArtHub connects independent artists with collectors through a responsive gallery, artist studios, buyer collections, and an admin dashboard. Built from the requirements in `A10_CAT-003.docx` using a Next.js frontend and a separate Express/MongoDB backend.

**Local app:** http://localhost:3000

**Local API:** http://127.0.0.1:4000/api/health

**Live URL:** https://arthub-web-orpin.vercel.app

**Live API health:** https://server-seven-sand-74.vercel.app/api/health

**GitHub repository:** https://github.com/coders-sabbir/ArtHub

**Client source:** https://github.com/coders-sabbir/ArtHub/tree/main/client

**Server source:** https://github.com/coders-sabbir/ArtHub/tree/main/server

## Run locally

Requirements: Node.js 22+ and MongoDB with replica-set support (or Docker). MongoDB transactions protect artwork reservations and payment fulfillment.

```sh
npm install
npm run setup
```

Start the isolated local database in a separate terminal:

```sh
npm run db:start
```

Or, with Docker, use `docker compose up -d` instead. Wait for MongoDB to be ready, then:

```sh
npm run seed
npm run dev
```

Open http://localhost:3000. `npm run setup` generates random JWT/Better Auth secrets without replacing existing configuration. Database files stay in ignored `.data/`. Seeding is idempotent and preserves existing users and artworks.

If `npm run dev` reports `ECONNREFUSED 127.0.0.1:27018`, the local database is stopped. Run `npm run db:start` in a separate terminal and leave it running, then restart `npm run dev`. With Docker, run `docker compose up -d` instead. The frontend's `ECONNREFUSED 127.0.0.1:4000` proxy errors occur because the API waits for MongoDB before listening. Check http://127.0.0.1:4000/api/health after restarting; it should return `{"status":"ok"}`.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Buyer | buyer@arthub.com | ArtHub@123 |
| Artist | artist@arthub.com | ArtHub@123 |
| Admin | admin@arthub.com | Admin@123 |

These credentials apply to the explicitly seeded local accounts. Set `SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD` before seeding a production database. Seeding will not reset an existing password.

The catalog contains 14 clearly labeled public-domain museum reproductions, with attribution on details pages, and two labeled sample purchase records. Museum originals are **not for sale**; the backend rejects checkout for demo listings. Create original listings from an artist account to exercise real checkout after connecting Stripe. Sample prices and transactions are illustrative; no payment occurred.

## Features

- Responsive homepage with a three-image hero carousel, six database-backed featured artworks, top artists, category navigation, and reduced-motion support.
- Public artwork browsing and details, title/artist search, categories, price ranges, availability filter, three sorts, and server pagination.
- Email/password registration with buyer/artist selection, bcrypt password hashing, and seven-day JWTs stored in HTTP-only cookies. Session restoration waits for server verification before redirecting protected pages.
- Google OAuth through Better Auth, followed by an ArtHub JWT session, when Google credentials are configured.
- Artist-owned artwork CRUD, imgBB artwork/profile uploads, sales history, and profile/password management.
- Buyer purchase history, collection gallery, server-persisted wishlist and cart, per-artwork checkout, and purchased-only comment creation/editing/deletion.
- Admin user-role management, artwork moderation, transaction history, analytics, revenue chart, and category distribution.
- Stripe hosted checkout for artworks, optional artist publishing fees, and recurring Pro/Premium subscriptions, verified webhooks, idempotent fulfillment, subscription lifecycle handling, and billing portal.
- Atomic artwork reservations and subscription purchase limits: Free 3, Pro 9, Premium unlimited. Pending checkout reservations count toward the limit. Artwork payment fulfillment marks a piece sold, removes it from the buyer’s cart, and hides it from the default public catalog. Browse filters can explicitly include sold artworks; details and collection history remain accessible. Successful purchase, publishing-fee or subscription fulfillment logs a simulated receipt once; no real email is sent. Purchases also set `published: false` in the database.
- Role-based Dashboard dropdown, dedicated admin artist metrics, dark mode, artwork/table skeletons, payment spinners, fetch-error toasts with retry, custom 404, runtime error boundary, confirmations, and keyboard-accessible dialogs.
- Optional browser WebMCP tools for catalog search and signed-in wishlist saves, with server authorization unchanged.

## Connect external services

Set values in `server/.env`; all secret keys stay on the server.

| Setting | Purpose |
| --- | --- |
| `MONGODB_URI` | Local replica set or MongoDB Atlas connection |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `FRONTEND_URL` | Exact frontend origin; no trailing slash |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` | Google sign-in |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe checkout and signed webhook verification |
| `IMGBB_API_KEY` | Server-side image uploads |
| `PUBLISHING_FEE_USD` | Per-artwork publishing fee; default `0` (free), or at least `0.50` USD |

Google authorized redirect URI: `<FRONTEND_URL>/api/oauth/callback/google`. Better Auth uses the MongoDB adapter and the frontend's same-origin API proxy. Google accounts register as buyers or artists; admin access cannot be requested during registration.

Stripe webhook endpoint: `<BACKEND_URL>/api/payments/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.paid`. Configure the Stripe customer billing portal before using membership management. Use Stripe test mode first.

Publishing is free by default. Set `PUBLISHING_FEE_USD` in `server/.env` and restart the API to enable a fee. Artists see the amount before submitting their artwork. With a fee enabled, artwork goes live only after Stripe confirms payment; canceled or unpaid checkouts do not publish it. Artwork edits remain free.

For local Stripe testing:

```sh
stripe listen --forward-to localhost:4000/api/payments/webhook
```

Copy the CLI webhook secret into `server/.env`. Missing external keys produce clear unavailable messages; the app never simulates a successful real payment. Contact and newsletter forms are explicitly frontend previews; delivery is not connected.

## Validation

```sh
npm test
npm run build
# With the local app running and the seeded accounts:
npx playwright install chromium
npm run test:e2e
```

API tests use temporary, uniquely named database records and clean up afterward. Cart tests cover per-user persistence, role checks, deduplication, unavailable listings, and cleanup after artwork deletion. Payment tests verify one simulated receipt and one transaction even under concurrent fulfillment, subscription tier updates, and sold catalog visibility. They cover validation, persistent sessions, server-side permissions, artist ownership, purchased-only comments, wishlists, payment unavailability, webhook signatures, concurrent reservations and purchase limits, checkout-failure rollback, duplicate fulfillment, and session invalidation after password/role changes. Payment transaction tests use a Stripe test double; live Stripe/imgBB cannot be verified without credentials. Google OAuth initiation is verified in production; completing sign-in requires a user to sign in to Google.

Verified on 5 November 2026: all 13 API integration tests, all 7 browser flow tests, TypeScript checking, and the default production build passed. Browser tests cover gallery controls, 320/390/768/1440px layouts, reload-safe buyer sessions, wishlist persistence, comment CRUD, artist create/edit/delete, admin pages, role-based dropdown navigation with keyboard/mobile interaction, dashboard table skeletons, fetch-error recovery, and persisted wishlist-to-cart checkout with payment-unavailable recovery. Browser tool search, malformed input rejection, and persisted wishlist saves were checked using a controlled WebMCP registry; native browser WebMCP support was not available.

## Deploy to Vercel

1. Put `server/` and `client/` into their own repositories, or use them as root directories of two Vercel projects in a monorepo. Keep the relevant lockfile with each project. Root workspace files are needed when deploying as an npm monorepo.
2. Provision MongoDB Atlas. Use a replica set; configure appropriate network access and a database user. Add backend environment values in Vercel, including `NODE_ENV=production`, MongoDB URI, random secrets, and the frontend production origin.
3. Deploy the Express project using `server/vercel.json`. Apply database indexes and optionally seed with explicit production credentials from a trusted terminal.
4. Set the frontend server-only `API_URL` to the backend's HTTPS origin. Deploy `client/` as a Next.js project. The `/api/:path*` rewrite keeps browser requests and authentication cookies on the frontend origin. Direct route reloads are handled by Next.js.
5. Configure Google callback URLs, Stripe webhooks, billing portal, and imgBB. Verify login survives a direct private-route reload, create/edit an artist listing, then complete a Stripe test purchase and subscription.
6. Replace the pending live/repository URLs above with actual deployed URLs.

The frontend is deployed in the arthub-web Vercel project and the backend in the user-selected server project. The production frontend API_URL points to https://server-seven-sand-74.vercel.app. Database connectivity, public catalog rendering, CORS, admin login, secure session cookies and private-route reloads were verified on the live origins. The labeled demo catalog and accounts were seeded without overwriting existing records. Google credentials are configured in production, and the live Google button was verified to open Google's sign-in page with the production callback; account sign-in and callback completion require a user to sign in. Stripe/imgBB still need their service credentials. The client, server and root workspace files are published together in the requested ArtHub repository. Separate component Git repositories remain available locally.

## Project structure and packages

```text
client/       Next.js App Router, React, TypeScript, gallery and dashboards
server/       Express API, MongoDB, authentication, payments, seed and API tests
scripts/      Local environment and MongoDB setup
tests/        Playwright browser flows
```

Frontend packages: Next.js, React, React DOM, TypeScript, Lucide React, next-themes, Recharts. Backend packages: Express, MongoDB driver, bcryptjs, jsonwebtoken, cookie-parser, cors, helmet, express-rate-limit, dotenv, Zod, Stripe, Better Auth, and its MongoDB adapter. Tooling: concurrently and Playwright.

Integration references: [Next.js routing and setup](https://nextjs.org/docs/app/getting-started), [Better Auth Express integration](https://better-auth.com/docs/integrations/express), [MongoDB adapter](https://better-auth.com/docs/adapters/mongo), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment). Artwork licenses, source URLs, credit lines, and museum records are recorded in `server/data/artwork-sources.json`.

## Deployment checks

See `DEPLOYMENT.md` for the current hosting state. The Vercel API entry initializes database indexes before serving requests, including on cold starts. `.vercelignore` excludes environment files, local database data, Git metadata and build caches.

To update the production environment, values are sent through stdin without printing secrets:

```sh
node scripts/configure-vercel.mjs
```

The local `.vercel/arthub-projects.json` records the two selected project IDs and canonical origins. This ignored file contains hosting metadata only. Backend configuration rejects a loopback MongoDB URI and preserves existing production signing secrets.

To check deployed origins, set `ARTHUB_VERIFY_EMAIL` and `ARTHUB_VERIFY_PASSWORD` in the process environment, then run:

```sh
node scripts/verify-live.mjs https://arthub-web-orpin.vercel.app https://server-seven-sand-74.vercel.app
```

This verifies database/API health, frontend proxying, CORS, direct public-route loads/reloads, custom 404, cookie security, role dashboard reloads, responsive layout and logout. Set `ARTHUB_VERIFICATION_REPORT` to a local path to save results without credentials. The script passed against both the local production build and the live production origins. Use --private-only when checking additional roles to skip repeated public-route checks.

When the remote MONGODB_URI is already stored as a sensitive Vercel variable, preserve it with `node scripts/configure-vercel.mjs --preserve-database`. An explicit `--seed-demo` also configures the labeled demonstration catalog/accounts for the backend Vercel build. The backend `vercel-build` hook seeds only when SEED_DEMO_DATA=true and explicit seed passwords are present; it does not reset existing accounts or artworks. A unique sparse seedKey index prevents duplicate demo listings.
