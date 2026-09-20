# SEO routing

Compactor uses one client-side application, with focused public URLs for real
tools and operations. Each URL opens the shared workspace with the relevant
tool or tab selected; it does not introduce a separately maintained interface.

## Source of truth

`src/config/toolRouteData.ts` owns every canonical tool route, title, and
description. The Vite `compactor-seo-entry-pages` plugin uses that registry at
build time to create a static clean-URL HTML entry page for each route and to
generate `dist/sitemap.xml`.

The static entry provides a title, description, canonical URL, social metadata,
and a short visible description before JavaScript starts. The React application
then replaces it with the interactive workspace.

## Adding a route

1. Add the route to `TOOL_ROUTES` with a unique path and a truthful title and
   description.
2. Make `App.tsx` open the matching existing workspace and, when relevant, its
   matching initial tab.
3. Add a permanent redirect in `vercel.json` if an existing canonical URL is
   being replaced.
4. Run `npm.cmd run quality`. It verifies every generated entry page and makes
   sure the generated sitemap has exactly the public route set.

Only add routes for features that work today and represent a meaningful search
intent. Do not create keyword variants that lead to the same generic state.
