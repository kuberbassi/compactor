import { chromium, webkit } from 'playwright';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5177';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const results = [];

const runBrowser = async (name, browserType, launchOptions = {}) => {
  const browser = await browserType.launch({ headless: true, ...launchOptions });
  try {
    for (const width of [320, 360, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name.toLowerCase()));
      const heavyResources = resources.filter(url => /ffmpeg-core|pdf\.worker|universalconversion|pdfmake|vfs_fonts/.test(url));
      results.push({
        browser: name,
        width,
        surface: 'compact-home',
        compact: await page.locator('.compact-app').isVisible(),
        noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        heavyEngineLoaded: heavyResources.length > 0,
        heavyResources,
        recentRemoved: await page.getByText('Recent', { exact: true }).count() === 0,
        searchVisible: await page.getByRole('searchbox', { name: 'Search phone tools' }).isVisible(),
      });
      await page.close();
    }

    const compactDesign = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await compactDesign.goto(`${baseUrl}/image/compress`, { waitUntil: 'networkidle' });
    await compactDesign.locator('input[type=file]').setInputFiles({ name: 'design-check.png', mimeType: 'image/png', buffer: Buffer.from('queue-only') });
    await compactDesign.getByRole('button', { name: 'Output format' }).click();
    const menuRect = await compactDesign.getByRole('listbox', { name: 'Output format' }).boundingBox();
    results.push({
      browser: name,
      surface: 'compact-controls',
      queueAddVisible: await compactDesign.getByRole('button', { name: /add files/i }).isVisible(),
      removedImageFeatures: await compactDesign.getByText(/maximum dimension|re-encoding removes/i).count() === 0,
      jpgOption: await compactDesign.getByRole('option', { name: 'JPG', exact: true }).isVisible(),
      menuContained: Boolean(menuRect && menuRect.x >= 0 && menuRect.x + menuRect.width <= 360),
      noOverflow: await compactDesign.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    });
    await compactDesign.close();

    const statePage = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await statePage.goto(`${baseUrl}/image/compress`, { waitUntil: 'networkidle' });
    await statePage.locator('input[type=file]').setInputFiles({ name: 'rotation-state.png', mimeType: 'image/png', buffer: Buffer.from('not-decoded-until-processing') });
    await statePage.setViewportSize({ width: 800, height: 430 });
    await statePage.locator('[data-layout-mode="full"]').waitFor({ state: 'visible' });
    const crossedToFull = await statePage.locator('[data-layout-mode="full"]').isVisible();
    await statePage.setViewportSize({ width: 360, height: 800 });
    await statePage.locator('.compact-app').waitFor({ state: 'visible' });
    results.push({
      browser: name,
      surface: 'compact-rotation-state',
      crossedToFull,
      selectionRetained: await statePage.locator('.compact-queue-item__copy strong').filter({ hasText: 'rotation-state.png' }).isVisible(),
      noOverflow: await statePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    });
    await statePage.close();

    const unsupported = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await unsupported.goto(`${baseUrl}/edit-pdf`, { waitUntil: 'networkidle' });
    results.push({
      browser: name,
      surface: 'desktop-only-handoff',
      explanation: await unsupported.getByRole('heading', { name: /needs a larger editing workspace/i }).isVisible(),
      alternatives: await unsupported.getByRole('heading', { name: /try a compact alternative/i }).isVisible(),
      noOverflow: await unsupported.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    });
    await unsupported.close();

    for (const width of [320, 390, 430]) {
      for (const route of ['privacy', 'terms']) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' });
        const geometry = await page.evaluate(() => {
          const header = document.querySelector('.tool-layout__header')?.getBoundingClientRect();
          const title = document.querySelector('.legal-document__hero h1');
          return {
            headerHeight: header?.height ?? Number.POSITIVE_INFINITY,
            titleSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : Number.POSITIVE_INFINITY,
          };
        });
        results.push({
          browser: name,
          width,
          surface: `compact-${route}`,
          headerCompact: geometry.headerHeight <= 90,
          titleCompact: geometry.titleSize <= 42,
          noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        });
        await page.close();
      }
    }

    for (const width of [768, 820, 1024]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${baseUrl}/video/compress`, { waitUntil: 'networkidle' });
      results.push({
        browser: name,
        width,
        surface: 'full-video-workspace',
        full: await page.locator('[data-layout-mode="full"]').isVisible(),
        noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
};

await runBrowser('chromium', chromium, { executablePath: chromePath });
await runBrowser('webkit', webkit);
console.log(JSON.stringify(results, null, 2));
if (results.some(result => Object.entries(result).some(([key, value]) => key !== 'heavyEngineLoaded' && value === false) || result.heavyEngineLoaded === true)) process.exitCode = 1;
