import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5178';
const outputDir = 'test-results/compact-media';
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

try {
  const fixturePage = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await fixturePage.setContent('<canvas width="320" height="180"></canvas>');
  const fixtures = await fixturePage.evaluate(async () => {
    const sampleRate = 22050;
    const seconds = 1.2;
    const samples = Math.floor(sampleRate * seconds);
    const wav = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(wav);
    const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let index = 0; index < samples; index += 1) view.setInt16(44 + index * 2, Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 12000, true);

    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(12);
    const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No MediaRecorder format available');
    let videoBytes = new Uint8Array();
    for (let attempt = 0; attempt < 3 && videoBytes.byteLength < 1000; attempt += 1) {
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
      const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));
      recorder.start();
      for (let frame = 0; frame < 18; frame += 1) {
        context.fillStyle = frame % 2 ? '#6d5dfc' : '#17181c'; context.fillRect(0, 0, 320, 180);
        context.fillStyle = 'white'; context.font = 'bold 24px sans-serif'; context.fillText('Compact media', 58, 98);
        await new Promise(resolve => setTimeout(resolve, 70));
      }
      recorder.stop(); await stopped;
      videoBytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
    }
    if (videoBytes.byteLength < 1000) throw new Error(`Generated video fixture is too small (${videoBytes.byteLength} bytes)`);
    return { audio: Array.from(new Uint8Array(wav)), video: Array.from(videoBytes), mimeType };
  });
  await fixturePage.close();

  for (const flow of [
    { name: 'audio', path: '/compress-audio', file: { name: 'compact-tone.wav', mimeType: 'audio/wav', buffer: Buffer.from(fixtures.audio) } },
    { name: 'video', path: '/video/compress', file: { name: `compact-clip.${fixtures.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`, mimeType: fixtures.mimeType, buffer: Buffer.from(fixtures.video) } },
  ]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 820 } });
    const browserErrors = [];
    page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.goto(`${baseUrl}${flow.path}`, { waitUntil: 'networkidle' });
    await page.locator('input[type="file"]').setInputFiles(flow.file);
    const previewVisible = await page.locator('.compact-file-preview').isVisible();
    let socialPresetVisible = true;
    let watermarkControlVisible = true;
    if (flow.name === 'video') {
      await page.getByRole('button', { name: 'Video target' }).click();
      socialPresetVisible = await page.getByRole('option', { name: /Discord Free/i }).isVisible() && await page.getByRole('option', { name: /Instagram Reels/i }).isVisible();
      await page.getByRole('option', { name: /Discord Free/i }).click();
      await page.getByText('Watermark', { exact: true }).click();
      const watermarkInput = page.getByPlaceholder('Optional watermark');
      watermarkControlVisible = await watermarkInput.isVisible();
      await watermarkInput.fill('COMPACTOR');
      await page.screenshot({ path: `${outputDir}/video-controls-360.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 640, height: 360 });
    const preservedAfterRotation = await page.locator('.compact-queue-item__copy strong').filter({ hasText: flow.file.name }).isVisible();
    await page.setViewportSize({ width: 360, height: 820 });
    await page.getByRole('button', { name: /Compress 1 file/i }).click();
    try {
      await Promise.race([
        page.getByRole('heading', { name: /1 file is ready/i }).waitFor({ timeout: 180000 }),
        page.getByRole('alert').waitFor({ timeout: 180000 }),
      ]);
      if (await page.getByRole('alert').isVisible().catch(() => false)) throw new Error(await page.getByRole('alert').innerText());
    } catch (error) {
      await page.screenshot({ path: `${outputDir}/${flow.name}-failure.png`, fullPage: true });
      throw new Error(`${flow.name} did not complete: ${(await page.locator('body').innerText()).slice(-1200)} | ${browserErrors.join(' | ')}`, { cause: error });
    }
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const downloadButton = page.getByRole('button', { name: /^Download compact-/i });
    const downloadVisible = await downloadButton.isVisible();
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    const zipName = download.suggestedFilename();
    await page.screenshot({ path: `${outputDir}/${flow.name}-360.png`, fullPage: true });
    const passed = documentWidth <= 360 && downloadVisible && previewVisible && preservedAfterRotation && socialPresetVisible && watermarkControlVisible && !zipName.endsWith('.zip');
    results.push({ flow: flow.name, inputBytes: flow.file.buffer.length, documentWidth, downloadVisible, previewVisible, preservedAfterRotation, socialPresetVisible, watermarkControlVisible, zipName, passed });
    await page.close();
  }

  const audioFile = { name: 'compact-tone.wav', mimeType: 'audio/wav', buffer: Buffer.from(fixtures.audio) };
  const join = await browser.newPage({ viewport: { width: 360, height: 820 } });
  await join.goto(`${baseUrl}/join-audio`, { waitUntil: 'networkidle' });
  await join.locator('input[type=file]').setInputFiles([audioFile, { ...audioFile, name: 'compact-tone-two.wav' }]);
  const joinPreview = await join.locator('.compact-file-preview audio').isVisible();
  await join.getByRole('button', { name: /^join audio$/i }).click();
  await join.getByRole('button', { name: /download joined-audio.wav/i }).waitFor({ timeout: 180000 });
  results.push({ flow: 'audio-join', previewVisible: joinPreview, noOverflow: await join.evaluate(() => document.documentElement.scrollWidth <= innerWidth), passed: joinPreview });
  await join.close();

  const bpm = await browser.newPage({ viewport: { width: 360, height: 820 } });
  await bpm.goto(`${baseUrl}/audio-key-bpm-finder`, { waitUntil: 'networkidle' });
  await bpm.locator('input[type=file]').setInputFiles(audioFile);
  await bpm.getByRole('button', { name: /analyze key & bpm/i }).click();
  await bpm.getByText('Analysis complete', { exact: true }).waitFor({ timeout: 180000 });
  const bpmCards = await bpm.locator('.compact-audio-analysis article').count();
  const bpmPreview = await bpm.locator('.compact-file-preview audio').isVisible();
  await bpm.screenshot({ path: `${outputDir}/audio-bpm-result-360.png`, fullPage: true });
  const confidenceVisible = await bpm.getByText(/confidence/i).isVisible().catch(() => false);
  results.push({ flow: 'audio-bpm', resultCards: bpmCards, previewVisible: bpmPreview, confidenceVisible, noOverflow: await bpm.evaluate(() => document.documentElement.scrollWidth <= innerWidth), passed: bpmCards === 2 && bpmPreview && !confidenceVisible });
  await bpm.close();

  const pitch = await browser.newPage({ viewport: { width: 360, height: 820 } });
  await pitch.goto(`${baseUrl}/change-audio-pitch-speed`, { waitUntil: 'networkidle' });
  await pitch.locator('input[type=file]').setInputFiles(audioFile);
  const pitchPreview = await pitch.locator('.compact-live-audio-player').isVisible();
  await pitch.screenshot({ path: `${outputDir}/audio-pitch-controls-360.png`, fullPage: true });
  await pitch.locator('.compact-settings input[type=range]').first().fill('2');
  await pitch.getByRole('button', { name: /export changed audio/i }).click();
  await pitch.getByRole('button', { name: /download compact-tone-pitch-speed.wav/i }).waitFor({ timeout: 180000 });
  results.push({ flow: 'audio-pitch-speed', previewVisible: pitchPreview, noOverflow: await pitch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), passed: pitchPreview });
  await pitch.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
