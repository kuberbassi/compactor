import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { seoTitleForRoute, TOOL_ROUTES } from './src/config/toolRouteData.ts'

const SITE_URL = 'https://compactor.kuberbassi.com'

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const replaceMetaContent = (html: string, selector: string, value: string) => {
  const escaped = escapeHtml(value)
  const pattern = new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*("\\s*/?>)`, 'i')
  return html.replace(pattern, `$1${escaped}$2`)
}

const seoEntryPages = () => ({
  name: 'compactor-seo-entry-pages',
  async closeBundle() {
    const distDir = path.resolve(__dirname, 'dist')
    const template = await readFile(path.join(distDir, 'index.html'), 'utf8')

    await Promise.all(TOOL_ROUTES.map(async route => {
      const canonical = `${SITE_URL}${route.path}`
      const title = seoTitleForRoute(route)
      const description = route.description
      const entryMarkup = `<main class="seo-entry" aria-label="${escapeHtml(route.title)}"><p>Private browser tool</p><h1>${escapeHtml(route.title)}</h1><p>${escapeHtml(description)} Files stay on your device.</p></main>`
      let html = template
        .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
        .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />`)
        .replace('<div id="root"></div>', `<div id="root">${entryMarkup}</div>`)
      html = replaceMetaContent(html, 'name="description"', description)
      html = replaceMetaContent(html, 'property="og:url"', canonical)
      html = replaceMetaContent(html, 'property="og:title"', title)
      html = replaceMetaContent(html, 'property="og:description"', description)
      html = replaceMetaContent(html, 'property="twitter:url"', canonical)
      html = replaceMetaContent(html, 'property="twitter:title"', title)
      html = replaceMetaContent(html, 'property="twitter:description"', description)

      const routeDir = path.join(distDir, route.path.slice(1))
      await mkdir(routeDir, { recursive: true })
      await writeFile(path.join(routeDir, 'index.html'), html)
    }))

    const urls = ['/', ...TOOL_ROUTES.map(route => route.path)]
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(routePath => `  <url><loc>${SITE_URL}${routePath}</loc></url>`).join('\n')}\n</urlset>\n`
    await writeFile(path.join(distDir, 'sitemap.xml'), sitemap)
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoEntryPages()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@base-ui')) {
            return 'vendor-baseui';
          }
          if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdf';
          }
          if (id.includes('node_modules/@ffmpeg')) {
            return 'vendor-ffmpeg';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/react-icons')) {
            return 'vendor-icons';
          }
        }
      }
    }
  }
})
