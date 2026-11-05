# ArtHub client

Next.js 16 / React 19 frontend for the ArtHub marketplace. Includes the responsive gallery, searching/filtering, artwork details, role dashboards, artist forms, authentication screens, comments, wishlists, a persistent buyer cart with per-artwork checkout, subscriptions, themes, and error/loading states. Role-based Dashboard menus support keyboard and mobile navigation; dashboard tables use skeleton rows and checkout shows a global spinner.

Live URL: production promotion awaits the remote MongoDB connection. [Frontend deployment candidate](https://arthub-muh6yhvar-sabbirm2010-7086s-projects.vercel.app) has no live backend yet. [Backend source](https://github.com/coders-sabbir/ArtHub/tree/main/server).

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

The Next.js configuration resolves its Turbopack root from the installed Next.js package, supporting both this npm workspace and a standalone client install. Sold pieces are hidden in the default browse view; use “Include sold artworks” in filters to see them.
