# ArtHub requirement audit

Source: user-supplied A10_CAT-003 requirement text.
Updated: 5 November 2026, Asia/Shanghai.

**Status: the identified code gaps are fixed. The Vercel frontend deployment candidate is ready; backend deployment and full live verification await MongoDB Atlas.** The user requested code fixes now and will provide credentials later. No service secrets, payment success, genuine artist ownership, live URLs, or repository links have been fabricated.

## Verification

- `npm run build`: passed with the default Next.js/Turbopack build. Workspace package resolution is configured; no webpack fallback is needed.
- `npm test`: all 13 backend integration tests and frontend TypeScript checking passed.
- `npm run test:e2e`: all 7 Chromium browser tests passed against the production frontend build and local API/database.
- Browser coverage includes 320/390/768/1440px public layouts, reload-safe buyer sessions, purchased-only comment CRUD, artist create/edit/delete, admin analytics/tables, role-based Dashboard dropdowns on desktop/mobile with Escape support, delayed dashboard table skeletons, fetch-error toast/retry, and wishlist-to-cart persistence with checkout loading/error recovery.
- Payment tests use a Stripe test double. They cover concurrent reservations, quotas, idempotent fulfillment, cart removal, sold catalog visibility, subscription tier updates, and one simulated receipt per successful fulfillment.
- Standalone client/server commit counts are 24/15 after committing the fixes; the required minimum counts are met. The requested GitHub repository combines both components with the root workspace files.

## Gaps fixed

| Earlier finding | Current implementation |
| --- | --- |
| Default production build fails | Next.js resolves its Turbopack root from the installed package, supporting the npm workspace and a standalone client install |
| Dashboard is a link with a chevron | Working role-based disclosure with shared dashboard destinations, outside-click dismissal, Escape/focus handling and mobile navigation |
| Dashboard table skeleton rows absent | Shared table skeleton used for transaction, artwork and user data loading; overview uses statistic placeholders |
| Payment redirect/verification spinner absent | Global spinner during artwork/cart/subscription checkout and membership portal redirection; centered spinner during payment verification/cancellation; errors restore the controls |
| No dedicated admin artist card | Separate Total users, Total artists, Artworks sold and Total revenue cards |
| API-fetch error toasts incomplete | Home, browse, artwork details, artist pages, dashboard, wishlist and cart report fetch failures; inline retry remains available |
| Wishlist has no Add to Cart | Available originals can be added to a database-backed buyer cart; cart supports reload persistence, removal and per-artwork Stripe checkout |
| Sold artwork stays in the default catalog | Sold artworks are excluded by default; an explicit Include sold artworks filter exposes sold badges while details/history remain accessible; backend prevents repeat purchase |
| Simulated purchase/payment email absent | Successful purchase or subscription fulfillment emits a clearly labeled simulated email log after commit; duplicate/concurrent fulfillment does not log another receipt |
| Buyer purchase history also mixes subscriptions | Purchase history tab now filters to artwork purchases; recent activity can still show memberships |
| Deleted artwork leaves saved-item references | Artwork deletion also removes cart/wishlist references; purchase transaction snapshots remain intact |

## Existing core features retained

- Email/password registration and login, buyer/artist signup selection, unique email, seven-day JWT cookie sessions, logout, session restoration and role checks.
- Google OAuth through Better Auth followed by the application's JWT session, ready for credentials.
- Hero carousel, latest six featured artworks, top three artists by sales, categories, footer links and newsletter placeholder.
- Public browse/details, title/artist search, category/price filters, three sorts, pagination, responsive cards, image/title/artist/price, detail metadata and owner controls.
- Artist-owned artwork create/read/edit/delete with confirmations; buyer purchase table/collection gallery; admin users/role changes, moderation, transaction history, revenue/category charts.
- Profile/password management, image-upload API/UI, Free 3 / Pro 9 / Premium unlimited limits, Stripe purchase/subscription logic, signed webhooks and transaction histories.
- Purchased-only comment creation and owner-only comment editing/deletion, durable wishlist, dark mode, global loading, artwork skeletons, custom 404 and runtime error fallback.

## Remaining configuration and submission work

| Item | Remaining work |
| --- | --- |
| Google login | Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, configure callback URLs, verify a real OAuth flow |
| Stripe artwork purchases/subscriptions | Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET; configure webhooks/billing portal and verify actual Stripe test-mode payment, tier/history/sold updates |
| imgBB uploads | Set IMGBB_API_KEY; verify original artwork and avatar file uploads |
| Genuine original listings | Publish artwork supplied by its actual artist. Museum demo reproductions intentionally remain unavailable for purchase. Browser tests create and clean up temporary original-listing fixtures; these do not establish ownership of the fixture image |
| Deployment | Vercel login verified; arthub-web and arthub-api created with explicit public-access approval. Frontend production candidate deployed successfully, canonical domain not promoted. Remote MongoDB is still required for backend deployment and full live CORS/API/session checks. See DEPLOYMENT.md |
| Submission links | The user selected one GitHub repository, https://github.com/coders-sabbir/ArtHub, containing client/ and server/ source links. Two separate remote repositories have not been created. The final live URL remains pending database/deployment completion |

JWT, Better Auth and MongoDB configuration are present locally. Google credentials, Stripe credentials and imgBB key were empty when checked; secret values were not printed. No real external-provider success or production behavior is claimed.

## Assignment ambiguities

- The transaction descriptions alternately say subscription/purchase and publishing fee/purchase. No publishing-fee amount or workflow is specified; subscription/purchase remains implemented.
- The document specifies monthly subscription prices but does not define monthly quota resets. Purchase limits continue to use total completed purchases plus active reservations.
- Charts are explicitly required in the admin dashboard. Buyer/artist dashboards have statistic cards; separate charts for those roles are not explicitly defined.
- The linked explanation video was not supplied/reviewed; this audit covers the supplied requirement text, source and local verification.

## Hosting preparation verification

- Vercel remote frontend build and deployment passed: `dpl_2iEn8E3XhBVKNDgXXSBQbXpK3mJP`.
- Serverless API initialization now creates the required indexes before requests. All 13 backend tests pass through this actual serverless handler.
- Upload dry-run verified that `.env`, Git metadata and local database files were excluded.
- The new deployment smoke script passed against the local production frontend/API, including private-route reloads and login/logout. These are local results, not a claim of live database or session verification.
- MongoDB Atlas was still unconnected when last checked; no remote database URI is currently configured. No local database was exposed to the internet.
