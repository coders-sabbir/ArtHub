# ArtHub deployment state

Updated 5 November 2026 (Asia/Shanghai).

The user authorized deploying the frontend/backend and verifying live route reloads, persistent login and API behavior. The user separately authorized public access for the two new ArtHub Vercel projects.

## Hosting

Vercel scope: `sabbirm2010-7086s-projects`.

| Component | Project | Assigned production origin | State |
| --- | --- | --- | --- |
| Frontend | arthub-web | https://arthub-web-orpin.vercel.app | Production candidate is READY; canonical origin not promoted |
| Backend | arthub-api | https://arthub-api.vercel.app | Project created; deployment awaits remote MongoDB |

Frontend candidate: https://arthub-muh6yhvar-sabbirm2010-7086s-projects.vercel.app

Deployment ID: `dpl_2iEn8E3XhBVKNDgXXSBQbXpK3mJP`. This candidate's UI files are deployed; catalog, authentication and other backend-dependent actions are not live yet. Do not submit this as a completed marketplace.

Both projects use Node.js 24. The frontend root is `client`, backend root is `server`; workspace source is uploaded from the repository root. The frontend's production API_URL points to the assigned backend origin. Only these new projects had SSO protection removed, following explicit user approval. Application authentication and authorization remain in place.

## Pending database connection

The current `server/.env` points to MongoDB on 127.0.0.1. Vercel cannot use that local database. The user is connecting MongoDB Atlas; connection was not yet confirmed.

Continue with the user-selected Atlas project or a remote MONGODB_URI supplied through `server/.env` or the process environment. Use a dedicated ArtHub database. Do not reuse unrelated application data or expose local MongoDB through a tunnel. Set production environment values with `node scripts/configure-vercel.mjs`; secrets are sent through stdin and never printed.

Apply database indexes and seed only the intended ArtHub database. The seed accepts explicit production seed passwords; it does not reset existing users. The assignment's admin account is admin@arthub.com / Admin@123. Do not put database credentials or service tokens in this document.

## Finish deployment

1. Confirm remote database connectivity and replica-set transaction support; create required indexes and intended seed records.
2. Configure backend runtime values, using the canonical frontend origin for CORS and fresh production signing secrets. Google/Stripe/imgBB credentials remain a separate follow-up per the user's earlier instruction.
3. Deploy the backend production source from this workspace to arthub-api. Verify direct /api/health and CORS.
4. Promote the existing frontend candidate if its source/configuration is still current, or redeploy if it changed. Preserve the assigned frontend origin.
5. Run `scripts/verify-live.mjs` with both canonical origins and an existing account provided through environment variables. Verify buyer, artist and admin roles with their intended credentials.
6. Update README live links and this document only after actual live checks pass.

## Checks already completed

- Remote frontend Next.js build and deployment: passed.
- Deployment upload inspection: environment files, Git metadata, database files and caches excluded.
- API integration suite: all 13 tests passed through the Vercel serverless handler.
- TypeScript: passed.
- New smoke-check script against local production frontend/API: health, proxy, CORS, public direct loads/reloads, custom 404, admin login/cookie attributes, private reloads, responsive layout and logout all passed.
- Full live database, login persistence, and API verification: pending remote database, not claimed as complete.
