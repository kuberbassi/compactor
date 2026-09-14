import { afterEach, describe, expect, it } from 'vitest';
import { pathForTool, seoTitleForRoute, TOOL_ROUTES, toolIdFromLocation, updateToolMetadata } from '../config/toolRoutes';

describe('tool routes and SEO metadata', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('keeps every public route unique and reversible', () => {
    expect(new Set(TOOL_ROUTES.map(route => route.path)).size).toBe(TOOL_ROUTES.length);
    expect(new Set(TOOL_ROUTES.map(route => route.id)).size).toBe(TOOL_ROUTES.length);

    TOOL_ROUTES.forEach(route => {
      expect(pathForTool(route.id)).toBe(route.path);
      expect(toolIdFromLocation({ pathname: `${route.path}/`, hash: '' })).toBe(route.id);
      expect(seoTitleForRoute(route)).toContain(route.title);
    });
  });

  it('updates canonical, search, and social metadata together', () => {
    document.head.innerHTML = `
      <meta name="description" content="">
      <link rel="canonical" href="">
      <meta property="og:url" content="">
      <meta property="og:title" content="">
      <meta property="og:description" content="">
      <meta property="twitter:url" content="">
      <meta property="twitter:title" content="">
      <meta property="twitter:description" content="">
    `;

    updateToolMetadata('pdf-compress');

    expect(document.title).toBe('Compress PDF Online — Free & Private | Compactor');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://compactor.kuberbassi.com/compress-pdf');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('Reduce PDF file size');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(document.title);
    expect(document.querySelector('meta[property="twitter:url"]')?.getAttribute('content')).toBe('https://compactor.kuberbassi.com/compress-pdf');
  });
});
