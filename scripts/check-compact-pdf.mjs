import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5177';
const outputDir = 'test-results/compact-pdf';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
await mkdir(outputDir, { recursive: true });

const makePdf = async (name) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index += 1) {
    const page = pdf.addPage([420, 595]);
    page.drawText(`${name} page ${index + 1}`, { x: 45, y: 520, size: 20, font });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};

const browserName = process.env.COMPACTOR_BROWSER ?? 'chromium';
const browser = browserName === 'webkit'
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ headless: true, executablePath: chromePath });
const results = [];
try {
  const fixture = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await fixture.setContent('<style>body{margin:0;background:#765cff;color:white;font:700 30px sans-serif}div{padding:70px 25px}</style><div>Compact PDF</div>');
  const png = await fixture.screenshot({ type: 'png' });
  await fixture.close();
  const firstPdf = await makePdf('First');
  const secondPdf = await makePdf('Second');

  const open = async path => {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, acceptDownloads: true });
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
    return page;
  };

  const merge = await open('/merge-pdf');
  await merge.locator('input[type=file]').setInputFiles([{ name: 'first.pdf', mimeType: 'application/pdf', buffer: firstPdf }, { name: 'second.pdf', mimeType: 'application/pdf', buffer: secondPdf }]);
  await merge.getByRole('button', { name: /move second.pdf earlier/i }).click();
  await merge.getByRole('button', { name: /^merge pdfs$/i }).click();
  await merge.getByRole('button', { name: /download merged-document.pdf/i }).waitFor();
  results.push({ flow: 'merge', noOverflow: await merge.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await merge.close();

  const protect = await open('/protect-pdf');
  await protect.locator('input[type=file]').setInputFiles({ name: 'secure-source.pdf', mimeType: 'application/pdf', buffer: firstPdf });
  await protect.getByLabel('Password', { exact: true }).fill('compact-secret');
  await protect.getByLabel(/confirm password/i).fill('compact-secret');
  await protect.getByRole('button', { name: /^protect pdf$/i }).click();
  const protectedButton = protect.getByRole('button', { name: /download secure-source-protected.pdf/i });
  await protectedButton.waitFor({ timeout: 30000 });
  const protectedDownloadPromise = protect.waitForEvent('download');
  await protectedButton.click();
  const protectedDownload = await protectedDownloadPromise;
  const protectedPath = `${outputDir}/protected.pdf`;
  await protectedDownload.saveAs(protectedPath);
  results.push({ flow: 'protect', passwordsCleared: await protect.locator('input[type=password]').evaluateAll(inputs => inputs.every(input => input.value === '')), noOverflow: await protect.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await protect.close();

  const unlock = await open('/unlock-pdf');
  await unlock.locator('input[type=file]').setInputFiles(protectedPath);
  await unlock.getByLabel('Password', { exact: true }).fill('compact-secret');
  await unlock.getByRole('button', { name: /^unlock pdf$/i }).click();
  try {
    await unlock.getByRole('button', { name: /download protected-unlocked.pdf/i }).waitFor({ timeout: 30000 });
  } catch (error) {
    throw new Error(`Unlock result missing: ${(await unlock.locator('body').innerText()).slice(-800)}`, { cause: error });
  }
  results.push({ flow: 'unlock', noOverflow: await unlock.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await unlock.close();

  const pages = await open('/pdf-to-images');
  await pages.locator('input[type=file]').setInputFiles({ name: 'pages.pdf', mimeType: 'application/pdf', buffer: firstPdf });
  await pages.getByRole('heading', { name: /3 pages detected/i }).waitFor({ timeout: 30000 });
  await pages.getByLabel(/page range/i).fill('2-3');
  await pages.getByRole('button', { name: /export pages/i }).click();
  await pages.getByRole('button', { name: /download 2 files as zip/i }).waitFor({ timeout: 30000 });
  results.push({ flow: 'pdf-to-images', twoPages: await pages.getByRole('heading', { name: /2 files are ready/i }).isVisible(), noOverflow: await pages.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await pages.close();

  const images = await open('/image/to-pdf');
  await images.locator('input[type=file]').setInputFiles([{ name: 'one.png', mimeType: 'image/png', buffer: png }, { name: 'two.png', mimeType: 'image/png', buffer: png }]);
  await images.getByRole('button', { name: /move two.png earlier/i }).click();
  await images.getByRole('button', { name: /rotate two.png clockwise/i }).click();
  await images.getByRole('button', { name: /create pdf from 2 images/i }).click();
  await images.getByRole('button', { name: /download compactor-images.pdf/i }).waitFor({ timeout: 30000 });
  await images.screenshot({ path: `${outputDir}/images-to-pdf-360.png`, fullPage: true });
  results.push({ flow: 'images-to-pdf', noOverflow: await images.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await images.close();

  const watermark = await open('/watermark-pdf');
  await watermark.locator('input[type=file]').setInputFiles({ name: 'watermark-source.pdf', mimeType: 'application/pdf', buffer: firstPdf });
  await watermark.getByLabel('Watermark position').click();
  await watermark.getByRole('option', { name: 'Repeated pattern' }).click();
  await watermark.getByRole('button', { name: /add watermark/i }).click();
  await watermark.getByRole('button', { name: /download watermark-source-watermarked.pdf/i }).waitFor({ timeout: 30000 });
  results.push({ flow: 'watermark', noOverflow: await watermark.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await watermark.close();

  const flatten = await open('/flatten-pdf');
  await flatten.locator('input[type=file]').setInputFiles({ name: 'flatten-source.pdf', mimeType: 'application/pdf', buffer: firstPdf });
  await flatten.getByRole('button', { name: /^flatten pdf$/i }).click();
  await flatten.getByRole('button', { name: /download flatten-source-flattened.pdf/i }).waitFor({ timeout: 30000 });
  results.push({ flow: 'flatten', noOverflow: await flatten.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  await flatten.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ browser: browserName, results }, null, 2));
if (results.some(result => Object.values(result).includes(false))) process.exitCode = 1;
