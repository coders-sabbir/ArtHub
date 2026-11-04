# ArtHub server

Express 5 / MongoDB API for ArtHub. Provides seven-day JWT cookie sessions, email/password and optional Google OAuth, role-based permissions, artist artwork CRUD, purchased-only comments, durable wishlists and buyer carts, dashboards, image uploads, subscription limits and verified Stripe fulfillment.

Live API URL: deployment awaits the remote MongoDB connection. [Client source](https://github.com/coders-sabbir/ArtHub/tree/main/client).

```sh
npm install
cp .env.example .env
```

Replace the placeholder secrets with random strings of at least 32 characters. Set `MONGODB_URI` to a MongoDB replica set or Atlas database and `FRONTEND_URL` to the exact client origin. In the shared workspace use `npm run setup` from the root to generate local secrets, and `npm run db:start` to start the isolated local database.

```sh
npm run seed
npm run dev
npm test
```

Standalone API starts on port 4000. `GET /api/health` verifies database availability. The Vercel entry point is `api/index.js`, configured in `vercel.json`; secrets must be set in the backend project's Vercel environment. MongoDB transactions and unique indexes enforce payment idempotency and avoid multiple purchases of one original.

External integrations need `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `IMGBB_API_KEY`. The Google callback is `<FRONTEND_URL>/api/oauth/callback/google`; Stripe webhook is `<BACKEND_URL>/api/payments/webhook`. Never use an unverified success URL as proof of payment.

Demo seeding creates `admin@arthub.com` / `Admin@123`, artist and buyer accounts with `ArtHub@123`, 14 public-domain sample listings, and two clearly labeled sample transactions. Set explicit seed passwords before seeding a production database. Seed does not overwrite existing accounts. Demo artworks cannot be purchased. Source/licensing metadata lives in `data/artwork-sources.json`.

API tests create unique temporary fixtures and clean them up. Stripe transaction tests use an injected test client; actual provider integration verification requires credentials. Checkout reserves artwork for 31 minutes; expired orders are reconciled against Stripe before being released. Purchase allowances include completed purchases and active reservations. Free allows 3 total artworks, Pro ($9.99/month) allows 9, and Premium ($19.99/month) is unlimited. Buyer-owned purchase snapshots survive artwork deletion.

Packages: Express, MongoDB driver, bcryptjs, jsonwebtoken, cookie-parser, cors, helmet, express-rate-limit, dotenv, Zod, Stripe, Better Auth, @better-auth/mongo-adapter. See the workspace README for full deployment steps.

Cart endpoints: authenticated buyers use `GET /api/cart`, `POST /api/cart/:id`, and `DELETE /api/cart/:id`. Demo, sold, and self-owned artworks cannot be added. Checkout remains per artwork and rechecks availability and purchase limits. Fulfillment removes the purchased item from the buyer’s cart and logs one clearly labeled simulated email receipt for a purchase or subscription. Deleted artworks are removed from cart/wishlist arrays.

Public catalog queries exclude sold pieces by default. Use `available=false` to explicitly include sold pieces; artwork details and buyer collection history remain accessible.
