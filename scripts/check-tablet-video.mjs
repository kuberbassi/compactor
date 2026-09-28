import { chromium } from 'playwright';

const baseUrl = process.env.COMPACTOR_TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  const browserLogs = [];
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(baseUrl).origin) browserLogs.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on('pageerror', error => browserLogs.push(error.message));

  await page.setContent('<canvas width="320" height="180"></canvas>');
  const generatedVideo = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(12);
    const mimeType = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
    ].find(candidate => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error('No supported MediaRecorder video format');

    let bytes = new Uint8Array();
    for (let attempt = 0; attempt < 3 && bytes.byteLength < 1000; attempt += 1) {
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));
      recorder.start();
      for (let frame = 0; frame < 18; frame += 1) {
        context.fillStyle = frame % 2 === 0 ? '#17181c' : '#6d5dfc';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.font = 'bold 28px sans-serif';
        context.fillText('Compactor tablet test', 22, 96);
        await new Promise(resolve => setTimeout(resolve, 70));
      }
      recorder.stop();
      await stopped;
      bytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
    }
    if (bytes.byteLength < 1000) throw new Error(`Generated tablet video is too small (${bytes.byteLength} bytes)`);
    return { bytes: Array.from(bytes), mimeType };
  });

  const extension = generatedVideo.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  await page.goto(`${baseUrl}/video/compress`);
  await page.locator('[aria-label="Loading tool workspace"]').waitFor({ state: 'hidden' });
  await page.locator('input[type="file"]').setInputFiles({
    name: `tablet-check.${extension}`,
    mimeType: generatedVideo.mimeType,
    buffer: Buffer.from(generatedVideo.bytes),
  });
  await page.locator('.video-tool-layout.has-active-session').waitFor();

  const loadedGeometry = await page.evaluate(() => {
    const workbench = document.querySelector('.image-workbench')?.getBoundingClientRect();
    const sidebar = document.querySelector('.image-workbench__sidebar')?.getBoundingClientRect();
    const main = document.querySelector('.image-workbench__main')?.getBoundingClientRect();
    const nav = document.querySelector('.image-workbench__sidebar .workspace-tool-nav');
    const preview = document.querySelector('.video-preview-workspace');
    const stage = document.querySelector('.video-source-preview');
    const media = document.querySelector('.video-source-media')?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    const workbenchElement = document.querySelector('.image-workbench');
    const sidebarElement = document.querySelector('.image-workbench__sidebar');
    return {
      workbench: workbench?.toJSON(),
      sidebar: sidebar?.toJSON(),
      main: main?.toJSON(),
      navColumns: nav ? getComputedStyle(nav).gridTemplateColumns : null,
      clippedLabels: nav ? [...nav.querySelectorAll('button span')].filter(label => getComputedStyle(label).display !== 'none' && label.scrollWidth > label.clientWidth + 1).map(label => label.textContent) : [],
      compactNav: nav ? [...nav.querySelectorAll('button')].every(button => {
        const label = button.querySelector('span');
        return Boolean(button.title && label && getComputedStyle(label).display === 'none');
      }) : false,
      internalOverflow: {
        main: document.querySelector('.image-workbench__main')?.scrollWidth - document.querySelector('.image-workbench__main')?.clientWidth,
        preview: preview ? preview.scrollWidth - preview.clientWidth : null,
        stage: stage ? stage.scrollWidth - stage.clientWidth : null,
      },
      mediaOutsideStage: Boolean(media && stageRect && (media.left < stageRect.left - 1 || media.right > stageRect.right + 1)),
      computed: {
        display: workbenchElement ? getComputedStyle(workbenchElement).display : null,
        rows: workbenchElement ? getComputedStyle(workbenchElement).gridTemplateRows : null,
        alignItems: workbenchElement ? getComputedStyle(workbenchElement).alignItems : null,
        sidebarHeight: sidebarElement ? getComputedStyle(sidebarElement).height : null,
        sidebarMinHeight: sidebarElement ? getComputedStyle(sidebarElement).minHeight : null,
        sidebarMaxHeight: sidebarElement ? getComputedStyle(sidebarElement).maxHeight : null,
        sidebarPosition: sidebarElement ? getComputedStyle(sidebarElement).position : null,
        sidebarAlignSelf: sidebarElement ? getComputedStyle(sidebarElement).alignSelf : null,
      },
    };
  });
  if (!loadedGeometry.workbench || !loadedGeometry.sidebar || loadedGeometry.sidebar.width > 270 || Math.abs(loadedGeometry.sidebar.height - loadedGeometry.workbench.height) > 1 || !loadedGeometry.main || loadedGeometry.main.width < 384 || Math.abs(loadedGeometry.main.height - loadedGeometry.workbench.height) > 1 || !loadedGeometry.navColumns?.includes(' ') || !loadedGeometry.compactNav || loadedGeometry.clippedLabels.length || Object.values(loadedGeometry.internalOverflow).some(value => value !== null && value > 1) || loadedGeometry.mediaOutsideStage) {
    throw new Error(`Loaded video tablet columns failed: ${JSON.stringify(loadedGeometry)}`);
  }

  await page.getByTitle('Collapse to icon rail').click();
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('.image-workbench__sidebar');
    return sidebar && sidebar.getBoundingClientRect().width <= 58;
  });
  const collapsedGeometry = await page.evaluate(() => {
    const workbenchElement = document.querySelector('.image-workbench');
    const workbench = workbenchElement?.getBoundingClientRect();
    const sidebar = document.querySelector('.image-workbench__sidebar')?.getBoundingClientRect();
    const main = document.querySelector('.image-workbench__main')?.getBoundingClientRect();
    return {
      workbench: workbench?.toJSON(),
      sidebar: sidebar?.toJSON(),
      main: main?.toJSON(),
      workbenchClass: workbenchElement?.className,
      sidebarClass: document.querySelector('.image-workbench__sidebar')?.className,
      display: workbenchElement ? getComputedStyle(workbenchElement).display : null,
      columns: workbenchElement ? getComputedStyle(workbenchElement).gridTemplateColumns : null,
    };
  });
  if (!collapsedGeometry.workbench || !collapsedGeometry.sidebar || collapsedGeometry.sidebar.width > 58 || Math.abs(collapsedGeometry.sidebar.height - collapsedGeometry.workbench.height) > 1 || !collapsedGeometry.main || collapsedGeometry.main.width <= loadedGeometry.main.width) {
    throw new Error(`Collapsed video tablet rail failed: ${JSON.stringify({ loadedGeometry, collapsedGeometry })}`);
  }
  await page.getByTitle('Expand sidebar').click();

  const assertNoHorizontalOverflow = async label => {
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: document.querySelector('#main-content').scrollWidth - document.querySelector('#main-content').clientWidth,
      layout: document.querySelector('.app-container')?.getAttribute('data-layout-mode'),
    }));
    if (overflow.document > 1 || overflow.main > 1 || overflow.layout !== 'full') {
      throw new Error(`${label} tablet layout failed: ${JSON.stringify(overflow)}`);
    }
  };

  await assertNoHorizontalOverflow('Loaded video');
  await page.locator('.workspace-primary-action').click();
  await Promise.race([
    page.getByText('Video ready', { exact: false }).waitFor({ timeout: 120_000 }),
    page.getByText(/compression failed/i).waitFor({ timeout: 120_000 }),
  ]);
  if (await page.getByText(/compression failed/i).isVisible().catch(() => false)) {
    throw new Error(`Tablet video failed: ${await page.getByText(/compression failed/i).innerText()} | fixture=${generatedVideo.bytes.length} bytes`);
  }
  await page.getByRole('button', { name: /download video/i }).waitFor();
  await assertNoHorizontalOverflow('Completed video');

  if (browserLogs.length > 0) {
    throw new Error(`Browser errors detected: ${browserLogs.join(' | ')}`);
  }

  console.log(`Tablet video smoke check passed (${generatedVideo.mimeType}, ${generatedVideo.bytes.length} bytes).`);
} finally {
  await browser.close();
}
