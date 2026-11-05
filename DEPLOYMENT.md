# ArtHub deployment state

Updated 5 November 2026 (Asia/Shanghai).

## Live origins

| Component | Vercel project | Production origin | State |
| --- | --- | --- | --- |
| Frontend | arthub-web | https://arthub-web-orpin.vercel.app | READY; canonical domain promoted |
| Backend | server | https://server-seven-sand-74.vercel.app | READY; remote MongoDB connected |

Vercel scope: `sabbirm2010-7086s-projects`.
Frontend deployment: `dpl_BE9hd5wuQRKdyT1PzUYU1CRvv9DR`.
Backend deployment: `dpl_5GzkvDdsLi7J7baT8bKwdwhBQqTo`.
The frontend uses Node.js 24 with root `client`; the user's server project uses Node.js 26 with root `server`.

The previous arthub-api project is no longer the backend. The frontend had been targeting that absent deployment, causing API 404 responses. The user-selected server project initially had only MONGODB_URI and failed startup because JWT_SECRET was missing. Both production configuration issues are fixed.

## Production configuration

- Frontend API_URL: https://server-seven-sand-74.vercel.app.
- Backend FRONTEND_URL: https://arthub-web-orpin.vercel.app.
- Backend NODE_ENV: production.
- The user-supplied production MONGODB_URI was preserved without printing or exporting its sensitive value.
- Fresh JWT_SECRET and BETTER_AUTH_SECRET are stored as sensitive Vercel values and preserved on later configuration runs.
- The default catalog initially had no artworks. The existing seed added 14 clearly labeled museum demo listings, five demo accounts and two sample transactions. These do not represent real sales; demo listings remain unavailable for purchase.
- The optional build-time seed requires SEED_DEMO_DATA=true and explicit seed account passwords. It is idempotent and does not reset existing user passwords or listings. A sparse unique seedKey index guards demo listing identity.
- Google, Stripe and imgBB activation remains pending the separate provider credentials requested earlier.

## Verification

- Both remote Vercel builds and production deployments passed.
- Direct backend /api/health and same-origin frontend /api/health return HTTP 200 with database health ok.
- Frontend catalog API returns artwork data; the homepage renders six featured pieces and three artists, and browse renders 12 available pieces.
- Live public pages survive direct loads and reloads; the custom 404 returns HTTP 404.
- Live admin sign-in, HTTP-only/Secure/SameSite cookie attributes, private dashboard route reloads, responsive layouts, logout and runtime error checks passed.
- Live buyer and artist login, private-route reloads, responsive layout and logout also passed with `--private-only`; credential-free reports are saved outside the repository.
- All 13 local backend integration tests and frontend TypeScript checking pass after adding the seed index.

Re-run `scripts/verify-live.mjs` against these two production origins using credentials from environment variables. `scripts/configure-vercel.mjs --preserve-database` updates configuration without reading or replacing the remote MongoDB secret. Hosting metadata is kept in ignored `.vercel/arthub-projects.json`.
