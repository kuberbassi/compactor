import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5177';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sitemap = await readFile('public/sitemap.xml', 'utf8');
const paths = [...sitemap.matchAll(/<loc>https:\/\/compactor\.kuberbassi\.com([^<]*)<\/loc>/g)].map(match => match[1] || '/');
const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const failures = [];

try {
  const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
  for (const path of paths) {
    try {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('[data-layout-mode="full"]').waitFor({ state: 'visible', timeout: 30000 });
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      if (geometry.document > geometry.viewport) failures.push({ path, reason: 'page overflow', ...geometry });

      if (path === '/privacy' || path === '/terms') {
        await page.locator('.legal-document').waitFor();
        const legalGeometry = await page.evaluate(async () => {
          const documentElement = document.documentElement;
          const before = scrollY;
          documentElement.style.scrollBehavior = 'auto';
          window.scrollTo(0, documentElement.scrollHeight);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return {
            scrollHeight: documentElement.scrollHeight,
            clientHeight: documentElement.clientHeight,
            scrollTop: scrollY,
            startedAt: before,
          };
        });
        if (legalGeometry.scrollHeight <= legalGeometry.clientHeight || legalGeometry.scrollTop <= legalGeometry.startedAt) {
          failures.push({ path, reason: 'legal page is not vertically scrollable', ...legalGeometry });
        }
      }
    } catch (error) {
      failures.push({ path, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const width of [360, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/privacy', '/terms']) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('.legal-document').waitFor();
      const geometry = await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
          scrollTop: scrollY,
        };
      });
      if (geometry.documentWidth > geometry.viewportWidth || geometry.scrollHeight <= geometry.clientHeight || geometry.scrollTop <= 0) {
        failures.push({ path, width, reason: 'legal responsive scroll/overflow failure', ...geometry });
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ width: 768, checkedRoutes: paths.length, legalViewports: [360, 768, 1024], failures }, null, 2));
if (failures.length) process.exitCode = 1;
