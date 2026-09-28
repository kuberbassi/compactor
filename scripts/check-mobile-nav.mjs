import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5176';
const outputDir = 'test-results/mobile-nav';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const results = [];

try {
  for (const viewport of [
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
  ]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Compactor navigation' });
    await dialog.waitFor({ state: 'visible' });

    const bounds = await dialog.boundingBox();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const searchRemoved = await dialog.getByText('Find a tool', { exact: true }).count() === 0;
    const profileVisible = await dialog.getByRole('link', { name: /Kuber Bassi/i }).isVisible();
    const pageLinks = await dialog.getByRole('navigation', { name: 'Menu pages' }).locator('a, button').allTextContents();
    const subfeaturesRemoved = await dialog.getByText('Compress PDF', { exact: true }).count() === 0;
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${outputDir}/${viewport.name}.png`, fullPage: false });

    await dialog.getByRole('button', { name: 'Close navigation' }).click();
    await dialog.waitFor({ state: 'hidden' });

    const unexpectedFailedRequests = failedRequests.filter(({ url }) => new URL(url).origin === new URL(baseUrl).origin);
    const passed = Boolean(
      bounds
      && bounds.width <= 380
      && bounds.x >= 0
      && bounds.x + bounds.width <= viewport.width
      && documentWidth <= viewport.width
      && searchRemoved
      && profileVisible
      && JSON.stringify(pageLinks) === JSON.stringify(['Home', 'Video', 'PDF', 'Images', 'Audio', 'Convert'])
      && subfeaturesRemoved
      && unexpectedFailedRequests.length === 0
    );

    results.push({ viewport: viewport.name, bounds, documentWidth, searchRemoved, profileVisible, pageLinks, subfeaturesRemoved, unexpectedFailedRequests, ignoredExternalFailures: failedRequests.length - unexpectedFailedRequests.length, passed });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
