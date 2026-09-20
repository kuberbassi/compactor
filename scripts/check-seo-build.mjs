import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const siteUrl = 'https://compactor.kuberbassi.com';
const escapeHtml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const routeSource = await readFile('src/config/toolRouteData.ts', 'utf8');
const routeMatcher = /route\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g;
const routes = Array.from(routeSource.matchAll(routeMatcher), ([, id, routePath, title, description]) => ({ id, routePath, title, description }));

if (routes.length === 0) throw new Error('No tool routes were found in src/config/toolRouteData.ts.');

const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const sitemapUrls = new Set(Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]));
const expectedUrls = [`${siteUrl}/`, ...routes.map(route => `${siteUrl}${route.routePath}`)];
const missingUrls = expectedUrls.filter(url => !sitemapUrls.has(url));
const unexpectedUrls = [...sitemapUrls].filter(url => !expectedUrls.includes(url));

if (missingUrls.length || unexpectedUrls.length) {
  throw new Error(`Generated sitemap is out of sync. Missing: ${missingUrls.join(', ') || 'none'}. Unexpected: ${unexpectedUrls.join(', ') || 'none'}.`);
}

await Promise.all(routes.map(async route => {
  const pagePath = path.join('dist', `${route.routePath.slice(1)}.html`);
  await access(pagePath);
  const page = await readFile(pagePath, 'utf8');
  const canonical = `${siteUrl}${route.routePath}`;
  const title = `${route.title} Online — Free & Private | Compactor`;

  for (const expected of [
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${canonical}" />`,
    `<h1>${escapeHtml(route.title)}</h1>`,
    `content="${escapeHtml(route.description)}"`,
  ]) {
    if (!page.includes(expected)) throw new Error(`${pagePath} is missing expected SEO content: ${expected}`);
  }
}));

console.log(`SEO build verified: ${routes.length} prerendered routes and sitemap entries are in sync.`);
