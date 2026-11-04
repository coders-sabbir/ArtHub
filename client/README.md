# ArtHub client

Next.js 16 / React 19 frontend for the ArtHub marketplace. Includes the responsive gallery, searching/filtering, artwork details, role dashboards, artist forms, authentication screens, comments, wishlists, subscriptions, themes, and error/loading states.

Live URL: pending Vercel deployment. Backend repository: pending remote setup.

```sh
npm install
cp .env.example .env.local
npm run dev
```

For a standalone repository, install from this directory. In the shared workspace, install from the root. Configure server-only `API_URL` with the Express backend origin. Browser API requests use the same-origin `/api` rewrite; no database, Stripe, Google or imgBB secrets belong in frontend configuration.

```sh
npm run typecheck
npm run build
npm start
```

Packages: Next.js, React, React DOM, TypeScript, Lucide React, next-themes, Recharts. The workspace root contains Playwright UI flow tests and the complete setup/deployment guide.

The starting catalog uses public-domain museum reproductions, clearly marked as demo listings and unavailable for purchase. Museum attribution appears on each artwork's detail page. Original artist uploads become real listings. Contact/newsletter delivery is a frontend placeholder.
