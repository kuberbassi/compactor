import { seoTitleForRoute, TOOL_ROUTES } from './toolRouteData';
import type { ToolRoute } from './toolRouteData';

export { seoTitleForRoute, TOOL_ROUTES } from './toolRouteData';
export type { ToolRoute } from './toolRouteData';

const routeById = new Map(TOOL_ROUTES.map(item => [item.id, item]));
const routeByPath = new Map(TOOL_ROUTES.map(item => [item.path, item]));

export const routeForTool = (id: string): ToolRoute | undefined => routeById.get(id);

export const pathForTool = (id: string): string => routeForTool(id)?.path || `/tools/${id}`;

export const toolIdFromLocation = (location: Pick<Location, 'pathname' | 'hash'>): string | null => {
  const normalizedPath = location.pathname.length > 1 ? location.pathname.replace(/\/$/, '') : '/';
  if (normalizedPath !== '/') return routeByPath.get(normalizedPath)?.id || null;
  return location.hash.slice(1) || null;
};

export const updateToolMetadata = (id: string | null) => {
  const route = id ? routeForTool(id) : undefined;
  const title = route ? seoTitleForRoute(route) : 'Compactor — Private Media Compressor & File Converter';
  const description = route?.description || 'Private browser-based tools to compress, convert, edit, and organize files.';
  const canonical = route ? `https://compactor.kuberbassi.com${route.path}` : 'https://compactor.kuberbassi.com/';

  document.title = title;
  const descriptionElement = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (descriptionElement) descriptionElement.content = description;
  const canonicalElement = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonicalElement) canonicalElement.href = canonical;

  const metadata = [
    ['meta[property="og:url"]', canonical],
    ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description],
    ['meta[property="twitter:url"]', canonical],
    ['meta[property="twitter:title"]', title],
    ['meta[property="twitter:description"]', description],
  ] as const;
  metadata.forEach(([selector, content]) => {
    const element = document.querySelector<HTMLMetaElement>(selector);
    if (element) element.content = content;
  });
};
