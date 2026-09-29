import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const baseUrl = process.env.COMPACTOR_TEST_URL ?? 'http://127.0.0.1:5177';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];

const createWavFixture = () => {
  const sampleRate = 8000;
  const sampleCount = 2000;
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(index * .08) * 6000), 44 + index * 2);
  }
  return buffer;
};

const measure = async (page, label, selectors = []) => {
  const result = await page.evaluate(selectorsToCheck => {
    const overflowing = selectorsToCheck.flatMap(selector => [...document.querySelectorAll(selector)]).filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    }).map(element => ({ className: element.className, rect: element.getBoundingClientRect().toJSON() }));
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflowing,
    };
  }, selectors);
  if (result.documentWidth > result.viewport || result.overflowing.length) failures.push({ label, ...result });
};

try {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  page.drawText('Compactor tablet workspace check', { x: 72, y: 760, size: 18 });
  const pdfBytes = await pdf.save();

  for (const width of [768, 820, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const browserErrors = [];

    const pdfPage = await context.newPage();
    pdfPage.on('pageerror', error => browserErrors.push(`pdf-${width}: ${error.stack ?? error.message}`));
    await pdfPage.goto(`${baseUrl}/edit-pdf`);
    await pdfPage.locator('input[type=file]').setInputFiles({ name: 'tablet-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) });
    await pdfPage.locator('.pdf-editor img[alt="Page 1"], .pdf-organizer__preview img').first().waitFor({ timeout: 30000 });
    await measure(pdfPage, `pdf-${width}`, ['.pdf-editor__toolbar', '.pdf-organizer__page-toolbar', '.pdf-organizer__commandbar']);
    const addTextButton = pdfPage.getByTitle('Add Text (Click to activate)');
    if (await addTextButton.isVisible()) {
      await addTextButton.click();
      await pdfPage.locator('.pdf-editor__annotation-layer').first().click({ position: { x: 120, y: 120 } });
      await pdfPage.locator('.pdf-editor__toolbar > .pdf-editor__properties').waitFor();
      const toolbarGeometry = await pdfPage.evaluate(() => {
        const toolbar = document.querySelector('.pdf-editor__toolbar');
        const toolbarRect = toolbar?.getBoundingClientRect();
        const clipped = toolbar && toolbarRect
          ? [...toolbar.querySelectorAll(':scope > *')].filter(child => {
              const rect = child.getBoundingClientRect();
              return rect.left < toolbarRect.left - 1 || rect.right > toolbarRect.right + 1;
            }).map(child => child.className)
          : [];
        return {
          toolbar: toolbarRect?.toJSON(),
          scrollOverflow: toolbar ? toolbar.scrollWidth - toolbar.clientWidth : null,
          clipped,
        };
      });
      if (!toolbarGeometry.toolbar || toolbarGeometry.scrollOverflow > 1 || toolbarGeometry.clipped.length || toolbarGeometry.toolbar.height < 44 || toolbarGeometry.toolbar.height > 104) {
        failures.push({ label: `pdf-toolbar-wrap-${width}`, reason: 'Contextual controls did not resolve to a contained tablet toolbar', toolbarGeometry });
      }
    }
    const collapseButton = pdfPage.getByRole('button', { name: 'Collapse tools sidebar' });
    if (!await collapseButton.isVisible()) failures.push({ label: `pdf-collapse-button-${width}`, reason: 'Collapse control is not visible' });
    else {
      try {
        await collapseButton.click({ timeout: 5000 });
        if (!await pdfPage.getByRole('button', { name: 'Expand tools sidebar' }).isVisible()) {
          failures.push({ label: `pdf-expand-button-${width}`, reason: 'Collapsed rail control is not visible' });
        }
      } catch (error) {
        const geometry = await pdfPage.evaluate(() => {
          const editor = document.querySelector('.pdf-editor');
          const button = document.querySelector('.pdf-editor__sidebar-collapse');
          const rect = button?.getBoundingClientRect();
          const coveringElement = rect ? document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
          return {
            editorClass: editor?.className,
            gridColumns: editor ? getComputedStyle(editor).gridTemplateColumns : null,
            button: rect?.toJSON(),
            coveringElement: coveringElement?.className,
          };
        });
        failures.push({ label: `pdf-collapse-button-${width}`, reason: error instanceof Error ? error.message : String(error), geometry });
      }
    }

    const organizerPage = await context.newPage();
    organizerPage.on('pageerror', error => browserErrors.push(`organizer-${width}: ${error.message}`));
    await organizerPage.goto(`${baseUrl}/organize-pdf`);
    await organizerPage.locator('input[type=file]').setInputFiles({ name: 'tablet-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) });
    await organizerPage.locator('.pdf-organizer').waitFor({ timeout: 30000 });
    await measure(organizerPage, `organizer-${width}`, ['.pdf-organizer', '.pdf-organizer__commandbar', '.pdf-organizer__header-actions', '.pdf-organizer__commands']);
    const organizerGeometry = await organizerPage.evaluate(() => {
      const toolbar = document.querySelector('.pdf-organizer__commandbar')?.getBoundingClientRect();
      const commandsElement = document.querySelector('.pdf-organizer__commands');
      const commands = commandsElement?.getBoundingClientRect();
      const primaryAction = commandsElement?.querySelector('.pdf-organizer__export')?.getBoundingClientRect();
      const sidebarHeading = document.querySelector('.pdf-organizer__pages-heading')?.getBoundingClientRect();
      const sidebarToggle = document.querySelector('.pdf-organizer__pages-heading > button')?.getBoundingClientRect();
      const firstThumbnail = document.querySelector('.pdf-organizer__thumbnail')?.getBoundingClientRect();
      return {
        toolbar: toolbar?.toJSON(),
        commands: commands?.toJSON(),
        primaryAction: primaryAction?.toJSON(),
        primaryRightGap: commands && primaryAction ? commands.right - primaryAction.right : null,
        sidebarToggleCenterOffset: sidebarHeading && sidebarToggle
          ? Math.abs((sidebarHeading.top + sidebarHeading.height / 2) - (sidebarToggle.top + sidebarToggle.height / 2))
          : null,
        commandScrollOverflow: commandsElement ? commandsElement.scrollWidth - commandsElement.clientWidth : null,
        firstThumbnail: firstThumbnail?.toJSON(),
      };
    });
    if (!organizerGeometry.toolbar || organizerGeometry.toolbar.height < 70 || !organizerGeometry.commands || organizerGeometry.commands.width > organizerGeometry.toolbar.width + 1 || organizerGeometry.commandScrollOverflow > 1 || !organizerGeometry.primaryAction || organizerGeometry.primaryRightGap > 2 || organizerGeometry.sidebarToggleCenterOffset > 2 || !organizerGeometry.firstThumbnail || organizerGeometry.firstThumbnail.width > 130) {
      failures.push({ label: `organizer-two-row-${width}`, reason: 'Tablet command bar did not resolve to the contained two-row layout', organizerGeometry });
    }
    const organizerCollapse = organizerPage.getByTitle('Collapse page panel');
    if (!await organizerCollapse.isVisible()) {
      failures.push({ label: `organizer-collapse-${width}`, reason: 'Page-panel collapse control is not visible' });
    } else {
      await organizerCollapse.click();
      await organizerPage.getByTitle('Expand page panel').waitFor({ state: 'visible', timeout: 5000 });
      await organizerPage.waitForFunction(() => document.querySelector('.pdf-organizer__pages')?.getBoundingClientRect().width <= 58);
      const collapsedPanelGeometry = await organizerPage.evaluate(() => {
        const panel = document.querySelector('.pdf-organizer__pages')?.getBoundingClientRect();
        const heading = document.querySelector('.pdf-organizer__pages-heading')?.getBoundingClientRect();
        const toggle = document.querySelector('.pdf-organizer__pages-heading > button')?.getBoundingClientRect();
        return {
          panelWidth: panel?.width ?? null,
          toggleCenterOffset: heading && toggle
            ? Math.abs((heading.top + heading.height / 2) - (toggle.top + toggle.height / 2))
            : null,
        };
      });
      if (!await organizerPage.getByTitle('Expand page panel').isVisible() || collapsedPanelGeometry.panelWidth > 58 || collapsedPanelGeometry.toggleCenterOffset > 2) {
        failures.push({ label: `organizer-expand-${width}`, reason: 'Page-panel expand control is not visible and centered after collapse', collapsedPanelGeometry });
      }
    }

    const compressPdfPage = await context.newPage();
    compressPdfPage.on('pageerror', error => browserErrors.push(`compress-pdf-${width}: ${error.message}`));
    await compressPdfPage.goto(`${baseUrl}/compress-pdf`);
    await compressPdfPage.locator('input[type=file]').setInputFiles({ name: 'tablet-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) });
    await compressPdfPage.locator('.pdf-organizer[aria-label="Compress PDF documents"]').waitFor({ timeout: 30000 });
    const compressPdfGeometry = await compressPdfPage.evaluate(() => {
      const commands = document.querySelector('.pdf-organizer__commands')?.getBoundingClientRect();
      const processButton = document.querySelector('.pdf-organizer__commands .pdf-organizer__export')?.getBoundingClientRect();
      return {
        commands: commands?.toJSON(),
        processButton: processButton?.toJSON(),
        processRightGap: commands && processButton ? commands.right - processButton.right : null,
      };
    });
    if (!compressPdfGeometry.commands || !compressPdfGeometry.processButton || compressPdfGeometry.processRightGap > 2) {
      failures.push({ label: `compress-pdf-process-position-${width}`, reason: 'Compress PDF process button was not anchored to the extreme right of the tablet command row', compressPdfGeometry });
    }

    const imagePage = await context.newPage();
    imagePage.on('pageerror', error => browserErrors.push(`image-${width}: ${error.message}`));
    await imagePage.goto(`${baseUrl}/image/compress`);
    await imagePage.locator('input[type=file]').setInputFiles('public/compactor-embed.png');
    await imagePage.locator('.image-tool-layout.has-active-session').waitFor({ timeout: 30000 });
    await measure(imagePage, `image-${width}`, ['.image-workbench', '.image-workbench__sidebar', '.image-editor-stage']);
    const imageGeometry = await imagePage.evaluate(() => {
      const workbench = document.querySelector('.image-workbench')?.getBoundingClientRect();
      const sidebar = document.querySelector('.image-workbench__sidebar')?.getBoundingClientRect();
      const main = document.querySelector('.image-workbench__main')?.getBoundingClientRect();
      const navButtons = [...document.querySelectorAll('.image-workbench__sidebar .workspace-tool-nav button')];
      const labels = navButtons.map(button => button.querySelector('span')).filter(Boolean);
      return {
        workbench: workbench?.toJSON(),
        sidebar: sidebar?.toJSON(),
        main: main?.toJSON(),
        clippedLabels: labels.filter(label => getComputedStyle(label).display !== 'none' && label.scrollWidth > label.clientWidth + 1).map(label => label.textContent),
        compactNav: navButtons.every((button, index) => Boolean(button.title && labels[index] && getComputedStyle(labels[index]).display === 'none')),
        presets: (() => {
          const grid = document.querySelector('.compression-preset-selector__grid');
          const buttons = grid ? [...grid.querySelectorAll('button')] : [];
          return {
            count: buttons.length,
            rows: new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top))).size,
            overflow: grid ? grid.scrollWidth - grid.clientWidth : null,
          };
        })(),
      };
    });
    if (!imageGeometry.workbench || !imageGeometry.sidebar || imageGeometry.sidebar.width > Math.min(270, width * .35) || Math.abs(imageGeometry.sidebar.height - imageGeometry.workbench.height) > 1 || !imageGeometry.main || imageGeometry.main.width < width * .5 || Math.abs(imageGeometry.main.height - imageGeometry.workbench.height) > 1 || !imageGeometry.compactNav || imageGeometry.clippedLabels.length || imageGeometry.presets.count !== 3 || imageGeometry.presets.rows !== 1 || imageGeometry.presets.overflow > 1) {
      failures.push({ label: `image-columns-${width}`, reason: 'Tablet workspace columns are not proportioned correctly', imageGeometry });
    }

    await imagePage.getByTitle('Collapse to icon rail').click();
    await imagePage.waitForFunction(() => document.querySelector('.image-workbench__sidebar')?.getBoundingClientRect().width <= 58);
    const collapsedImageGeometry = await imagePage.evaluate(() => ({
      workbench: document.querySelector('.image-workbench')?.getBoundingClientRect().toJSON(),
      sidebar: document.querySelector('.image-workbench__sidebar')?.getBoundingClientRect().toJSON(),
      main: document.querySelector('.image-workbench__main')?.getBoundingClientRect().toJSON(),
    }));
    if (!collapsedImageGeometry.workbench || !collapsedImageGeometry.sidebar || Math.abs(collapsedImageGeometry.sidebar.height - collapsedImageGeometry.workbench.height) > 1 || !collapsedImageGeometry.main || collapsedImageGeometry.main.width <= imageGeometry.main.width) {
      failures.push({ label: `image-collapse-${width}`, reason: 'Collapsed rail did not return space to the editor at full height', imageGeometry, collapsedImageGeometry });
    }
    await imagePage.getByTitle('Expand sidebar').click();

    const posterPage = await context.newPage();
    posterPage.on('pageerror', error => browserErrors.push(`poster-${width}: ${error.message}`));
    await posterPage.goto(`${baseUrl}/poster-maker`);
    await posterPage.locator('input[type=file]').setInputFiles('public/compactor-embed.png');
    await posterPage.locator('.rasterbator-tool-layout.has-active-session').waitFor({ timeout: 30000 });
    const posterTileCountGeometry = await posterPage.evaluate(() => {
      const steppers = [...document.querySelectorAll('.poster-stepper')];
      const countFields = [...document.querySelectorAll('.poster-count-field')];
      const stepperInputs = steppers
        .map(stepper => stepper.querySelector('input'))
        .filter(Boolean);
      return {
        fieldCount: countFields.length,
        fieldRows: new Set(countFields.map(field => Math.round(field.getBoundingClientRect().top))).size,
        clippedSteppers: steppers.filter(stepper => stepper.scrollWidth > stepper.clientWidth + 1).length,
        narrowStepperInputs: stepperInputs.filter(input => input.getBoundingClientRect().width < 44).length,
      };
    });
    if (posterTileCountGeometry.fieldCount !== 2 || posterTileCountGeometry.fieldRows !== 2 || posterTileCountGeometry.clippedSteppers || posterTileCountGeometry.narrowStepperInputs) {
      failures.push({ label: `poster-tile-count-${width}`, reason: 'Poster tile-count steppers were not stacked into readable full-width rows', posterTileCountGeometry });
    }

    await posterPage.getByTitle('Style & Rotate').click();
    const posterCompactGeometry = await posterPage.evaluate(() => {
      const actions = [...document.querySelectorAll('.poster-transform-action')];
      return {
        count: actions.length,
        rows: new Set(actions.map(action => Math.round(action.getBoundingClientRect().top))).size,
        labelsVisible: actions.some(action => {
          const label = action.querySelector('span');
          return label && getComputedStyle(label).display !== 'none';
        }),
        missingTitles: actions.filter(action => !action.getAttribute('title') || !action.getAttribute('aria-label')).length,
      };
    });
    if (posterCompactGeometry.count !== 4 || posterCompactGeometry.rows !== 1 || posterCompactGeometry.labelsVisible || posterCompactGeometry.missingTitles) {
      failures.push({ label: `poster-compact-controls-${width}`, reason: 'Constrained poster controls did not switch to accessible icon-only buttons', posterCompactGeometry });
    }

    const audioPage = await context.newPage();
    audioPage.on('pageerror', error => browserErrors.push(`audio-${width}: ${error.message}`));
    await audioPage.goto(`${baseUrl}/compress-audio`);
    await audioPage.locator('input[type=file]').setInputFiles({ name: 'tablet-check.wav', mimeType: 'audio/wav', buffer: createWavFixture() });
    await audioPage.locator('.audio-tool-layout.has-active-session .workspace-tool-nav').waitFor({ timeout: 30000 });
    const audioCompactNav = await audioPage.evaluate(() => {
      const buttons = [...document.querySelectorAll('.audio-tool-layout.has-active-session .workspace-tool-nav button')];
      return {
        count: buttons.length,
        compact: buttons.every(button => {
          const label = button.querySelector('span');
          return Boolean(button.title && label && getComputedStyle(label).display === 'none');
        }),
        rows: new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top))).size,
      };
    });
    if (audioCompactNav.count !== 4 || !audioCompactNav.compact || audioCompactNav.rows > 2) {
      failures.push({ label: `audio-compact-nav-${width}`, reason: 'Audio tablet navigation did not use the shared compact button contract', audioCompactNav });
    }

    const splitPage = await context.newPage();
    splitPage.on('pageerror', error => browserErrors.push(`split-${width}: ${error.message}`));
    await splitPage.goto(`${baseUrl}/split-pdf`);
    await splitPage.locator('input[type=file]').setInputFiles({ name: 'tablet-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) });
    await splitPage.locator('.pdf-split-presets').waitFor({ timeout: 30000 });
    const splitGeometry = await splitPage.evaluate(() => {
      const sidebar = document.querySelector('.pdf-organizer__pages')?.getBoundingClientRect();
      const presetButtons = [...document.querySelectorAll('.pdf-split-presets button')];
      return {
        sidebar: sidebar?.toJSON(),
        presetRows: new Set(presetButtons.map(button => Math.round(button.getBoundingClientRect().top))).size,
        clippedPresets: presetButtons.filter(button => button.scrollWidth > button.clientWidth + 1).map(button => button.textContent?.trim()),
      };
    });
    if (!splitGeometry.sidebar || splitGeometry.sidebar.width < 220 || splitGeometry.clippedPresets.length || (width <= 820 && splitGeometry.presetRows < 2) || !await splitPage.getByTitle('Collapse options panel').isVisible()) {
      failures.push({ label: `split-sidebar-${width}`, reason: 'Split-PDF tablet options are clipped or the collapse control is missing', splitGeometry });
    }

    const converterPage = await context.newPage();
    converterPage.on('pageerror', error => browserErrors.push(`converter-${width}: ${error.message}`));
    await converterPage.goto(`${baseUrl}/file-converter`);
    await converterPage.locator('input[type=file]').setInputFiles({
      name: 'tablet-check.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!doctype html><title>Tablet check</title><p>Converter layout</p>'),
    });
    await converterPage.locator('.converter-tool-layout.has-active-session').waitFor({ timeout: 30000 });
    await converterPage.setViewportSize({ width, height: 650 });
    await measure(converterPage, `converter-${width}`, ['.converter-tool-layout', '.converter-category-grid', '.converter-format-grid']);
    const converterGeometry = await converterPage.evaluate(() => {
      const categoryGrid = document.querySelector('.converter-category-grid');
      const buttons = categoryGrid ? [...categoryGrid.querySelectorAll('button')] : [];
      const main = document.querySelector('.converter-tool-layout.has-active-session .image-workbench__main');
      const queueItem = document.querySelector('.converter-queue-item');
      const queueCopy = document.querySelector('.converter-queue-item__copy')?.getBoundingClientRect();
      const before = main?.scrollTop ?? 0;
      if (main) main.scrollTop = main.scrollHeight;
      const after = main?.scrollTop ?? 0;
      const rows = new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top)));
      return {
        grid: categoryGrid?.getBoundingClientRect().toJSON(),
        rowCount: rows.size,
        clippedLabels: buttons.filter(button => button.scrollWidth > button.clientWidth + 1).map(button => button.textContent?.trim()),
        mainScrollable: Boolean(main && main.scrollHeight > main.clientHeight + 1 && after > before),
        mainMetrics: main ? {
          clientHeight: main.clientHeight,
          scrollHeight: main.scrollHeight,
          before,
          after,
          overflowY: getComputedStyle(main).overflowY,
          rect: main.getBoundingClientRect().toJSON(),
        } : null,
        queueOverflow: queueItem ? queueItem.scrollWidth - queueItem.clientWidth : null,
        queueCopy: queueCopy?.toJSON(),
      };
    });
    if (!converterGeometry.grid || converterGeometry.clippedLabels.length || (width <= 820 && converterGeometry.rowCount < 2) || !converterGeometry.mainScrollable || converterGeometry.queueOverflow > 1 || !converterGeometry.queueCopy || converterGeometry.queueCopy.width < 44) {
      failures.push({ label: `converter-adaptive-strip-${width}`, reason: 'Converter category strip did not wrap into contained rows', converterGeometry });
    }

    if (browserErrors.length) failures.push({ label: `browser-errors-${width}`, browserErrors });

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ viewports: [768, 820, 1024], failures }, null, 2));
if (failures.length) process.exitCode = 1;
