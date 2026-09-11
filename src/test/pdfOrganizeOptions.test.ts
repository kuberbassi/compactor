import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { addPageNumbersToPdf, cropPdfMargins, reorganizePdfPages } from '../utils/pdf';

describe('organizer export options', () => {
  it('applies proportional cropping and numbering to every retained page', async () => {
    const source = await PDFDocument.create();
    source.addPage([400, 600]);
    source.addPage([500, 700]);
    source.addPage([600, 800]);
    const sourceBytes = Uint8Array.from(await source.save());
    const sourceFile = new File([sourceBytes.buffer], 'source.pdf', { type: 'application/pdf' });

    const organized = await reorganizePdfPages(sourceFile, [
      { originalIndex: 2, rotation: 0 },
      { originalIndex: 0, rotation: 0 },
    ]);
    const cropped = await cropPdfMargins(new File([organized], 'organized.pdf', { type: 'application/pdf' }), 10);
    const numbered = await addPageNumbersToPdf(new File([cropped], 'cropped.pdf', { type: 'application/pdf' }), 'top');
    const result = await PDFDocument.load(await numbered.arrayBuffer());

    expect(result.getPageCount()).toBe(2);
    expect(result.getPages().map(page => page.getCropBox())).toEqual([
      { x: 60, y: 80, width: 480, height: 640 },
      { x: 40, y: 60, width: 320, height: 480 },
    ]);
    result.getPages().forEach(page => {
      expect(page.node.get(PDFName.of('Contents'))).toBeTruthy();
    });
  });
});
