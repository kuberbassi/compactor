import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5177';
const outputDir = 'test-results/compact-compressors';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const results = [];

const makePdf = async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([420, 595]);
  page.drawText('Compactor compact PDF verification', { x: 40, y: 520, size: 18, font });
  for (let index = 0; index < 24; index += 1) page.drawText(`Private browser compression line ${index + 1}`, { x: 40, y: 485 - (index * 16), size: 10, font });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};

try {
  const fixturePage = await browser.newPage({ viewport: { width: 420, height: 320 } });
  await fixturePage.setContent('<style>body{margin:0;background:linear-gradient(135deg,#725cff,#12131a)}div{padding:80px;color:white;font:700 36px sans-serif}</style><div>Compactor</div>');
  const png = await fixturePage.screenshot({ type: 'png' });
  await fixturePage.close();
  const pdf = await makePdf();

  for (const width of [360, 430]) {
    for (const flow of [
      { name: 'image', path: '/image/compress', file: { name: 'compact-check.png', mimeType: 'image/png', buffer: png } },
      { name: 'pdf', path: '/compress-pdf', file: { name: 'compact-check.pdf', mimeType: 'application/pdf', buffer: pdf } },
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 820 } });
      const failedRequests = [];
      page.on('requestfailed', request => {
        if (new URL(request.url()).origin === new URL(baseUrl).origin) failedRequests.push(request.url());
      });
      await page.goto(`${baseUrl}${flow.path}`, { waitUntil: 'networkidle' });
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() === 0) {
        throw new Error(`Compact file input missing at ${page.url()}: ${(await page.locator('body').innerText()).slice(0, 500)}`);
      }
      await fileInput.setInputFiles(flow.file);
      let expandedControlsVisible = true;
      let targetControlsAccurate = true;
      if (flow.name === 'image' && width === 360) {
        await page.getByRole('button', { name: 'Compression method' }).click();
        await page.getByRole('option', { name: 'Target size' }).click();
        const targetInput = page.locator('.compact-target-size input[type=number]');
        await targetInput.fill('20');
        await page.getByRole('button', { name: 'Target size unit' }).click();
        const mbVisible = await page.getByRole('option', { name: 'MB', exact: true }).isVisible();
        await page.getByRole('option', { name: 'KB', exact: true }).click();
        await page.getByText('Resize', { exact: true }).click();
        await page.getByText('Watermark', { exact: true }).click();
        expandedControlsVisible = await page.locator('.compact-target-size').isVisible()
          && await page.getByText('Resize output', { exact: true }).isVisible()
          && await page.getByPlaceholder('Optional watermark').isVisible();
        targetControlsAccurate = mbVisible && await page.getByText('Quality', { exact: true }).count() === 0;
        await page.screenshot({ path: `${outputDir}/image-controls-360.png`, fullPage: true });
      }
      const processButton = page.getByRole('button', { name: /Compress 1 file/i });
      await processButton.click();
      await page.getByRole('heading', { name: /1 file is ready/i }).waitFor({ state: 'visible', timeout: 30000 });

      const downloadVisible = await page.getByRole('button', { name: /Download .*optimized|Download .*compressed/i }).isVisible();
      let downloadBytes = null;
      if (flow.name === 'image' && width === 360) {
        const pendingDownload = page.waitForEvent('download');
        await page.getByRole('button', { name: /Download .*optimized/i }).click();
        const download = await pendingDownload;
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        downloadBytes = Buffer.concat(chunks).byteLength;
        targetControlsAccurate = targetControlsAccurate && downloadBytes <= 20 * 1024;
      }
      const itemDownloadVisible = downloadVisible;
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const stickyAction = await page.locator('.compact-action-bar').count() ? await page.locator('.compact-action-bar').evaluate(element => getComputedStyle(element).position) : 'result-page';
      await page.screenshot({ path: `${outputDir}/${flow.name}-${width}.png`, fullPage: true });

      const passed = downloadVisible && itemDownloadVisible && expandedControlsVisible && targetControlsAccurate && documentWidth <= width && stickyAction === 'result-page' && failedRequests.length === 0;
      results.push({ width, flow: flow.name, documentWidth, downloadVisible, itemDownloadVisible, downloadBytes, expandedControlsVisible, targetControlsAccurate, stickyAction, failedRequests, passed });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
