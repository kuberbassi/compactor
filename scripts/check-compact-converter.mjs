import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { Document, Packer, Paragraph } from 'docx';

const baseUrl = process.env.COMPACTOR_BASE_URL ?? 'http://127.0.0.1:5179';
const outputDir = 'test-results/compact-converter';
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const makeWav = () => {
  const sampleRate = 16000, samples = sampleRate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) buffer.writeInt16LE(Math.sin(index / sampleRate * Math.PI * 2 * 440) * 10000, 44 + index * 2);
  return buffer;
};

try {
  const fixturePage = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await fixturePage.setContent('<style>body{margin:0;background:linear-gradient(135deg,#6d5dfc,#101116)}div{padding:70px 35px;color:#fff;font:700 32px sans-serif}</style><div>Convert me</div><canvas width="320" height="180"></canvas>');
  const png = await fixturePage.screenshot({ type: 'png' });
  const video = await fixturePage.evaluate(async () => {
    const canvas = document.querySelector('canvas'); const context = canvas.getContext('2d'); const stream = canvas.captureStream(12);
    const audioContext = new AudioContext(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); const destination = audioContext.createMediaStreamDestination();
    gain.gain.value = 0.08; oscillator.frequency.value = 330; oscillator.connect(gain).connect(destination); oscillator.start(); stream.addTrack(destination.stream.getAudioTracks()[0]);
    const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8'].find(type => MediaRecorder.isTypeSupported(type));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const recorder = new MediaRecorder(stream, { mimeType }); const chunks = [];
      recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
      const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true })); recorder.start();
      for (let frame = 0; frame < 20; frame += 1) { context.fillStyle = frame % 2 ? '#6d5dfc' : '#15161b'; context.fillRect(0, 0, 320, 180); context.fillStyle = '#fff'; context.font = 'bold 26px sans-serif'; context.fillText(`Convert ${frame + 1}`, 85, 98); await new Promise(resolve => setTimeout(resolve, 75)); }
      recorder.stop(); await stopped; const bytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
      if (bytes.byteLength > 20000) return { bytes: Array.from(bytes), mimeType };
    }
    throw new Error('Could not generate a stable video fixture');
  });
  await fixturePage.close();
  const docx = Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Compactor document conversion verification')] }] })));

  const flows = [
    { name: 'document', target: 'txt', files: [{ name: 'document.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx }] },
    { name: 'image', target: 'webp', files: [{ name: 'image.png', mimeType: 'image/png', buffer: png }] },
    { name: 'media', target: 'mp3', files: [{ name: 'tone.wav', mimeType: 'audio/wav', buffer: makeWav() }, { name: `clip.${video.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`, mimeType: video.mimeType, buffer: Buffer.from(video.bytes) }] },
    { name: 'text', target: 'html', files: [{ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Notes') }, { name: 'readme.txt', mimeType: 'text/plain', buffer: Buffer.from('Plain text') }] },
    { name: 'data', target: 'json', files: [{ name: 'rows.csv', mimeType: 'text/csv', buffer: Buffer.from('name,value\nalpha,1\nbeta,2') }] },
  ].filter(flow => !process.env.COMPACTOR_FLOW || flow.name === process.env.COMPACTOR_FLOW);
  const results = [];

  for (const flow of flows) {
    const page = await browser.newPage({ viewport: { width: 360, height: 820 } });
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(`${baseUrl}/file-converter`, { waitUntil: 'networkidle' });
    const loadedBeforeSelection = requests.some(url => url.includes('universalConversion'));
    await page.locator('input[type="file"]').setInputFiles(flow.files);
    const targetSelect = page.getByRole('button', { name: 'Convert every file to' });
    await targetSelect.click();
    const targetOption = page.getByRole('option', { name: flow.target.toUpperCase(), exact: true });
    await targetOption.click();
    let unsupportedDisabled = true;
    if (flow.name === 'image') {
      await targetSelect.click();
      unsupportedDisabled = await page.getByRole('option', { name: 'DOCX', exact: true }).count() === 0;
      await targetSelect.click();
    }
    await page.getByRole('button', { name: new RegExp(`Convert ${flow.files.length} to ${flow.target}`, 'i') }).click();
    try {
      await Promise.race([
        page.getByRole('heading', { name: new RegExp(`${flow.files.length} file${flow.files.length === 1 ? ' is' : 's are'} ready`, 'i') }).waitFor({ timeout: 180000 }),
        page.getByRole('alert').waitFor({ timeout: 180000 }),
      ]);
      if (await page.getByRole('alert').isVisible().catch(() => false)) throw new Error(await page.getByRole('alert').innerText());
    } catch (error) {
      await page.screenshot({ path: `${outputDir}/${flow.name}-failure.png`, fullPage: true });
      throw new Error(`${flow.name} conversion failed: ${(await page.locator('body').innerText()).slice(-1400)}`, { cause: error });
    }
    const loadedAfterStart = requests.some(url => url.includes('universalConversion'));
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const downloads = flow.files.length === 1 ? await page.getByRole('button', { name: /^Download /i }).count() : await page.locator('.compact-result-downloads__list button').count();
    await page.screenshot({ path: `${outputDir}/${flow.name}-360.png`, fullPage: true });
    const passed = !loadedBeforeSelection && loadedAfterStart && unsupportedDisabled && documentWidth <= 360 && downloads === flow.files.length;
    results.push({ flow: flow.name, files: flow.files.length, target: flow.target, loadedBeforeSelection, loadedAfterStart, unsupportedDisabled, documentWidth, downloads, passed });
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
} finally {
  await browser.close();
}
