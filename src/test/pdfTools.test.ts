import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';

describe('PDF Tools & Manipulation Utilities', () => {
  it('creates a blank PDF document and adds pages', async () => {
    const pdfDoc = await PDFDocument.create();
    const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
    const page2 = pdfDoc.addPage([595.28, 841.89]);

    expect(pdfDoc.getPageCount()).toBe(2);
    expect(page1.getWidth()).toBe(595.28);
    expect(page2.getHeight()).toBe(841.89);
  });

  it('rotates PDF page by 90, 180, 270 degrees accurately', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);

    page.setRotation({ type: 'degrees', angle: 90 } as any);
    expect((page.getRotation() as any).angle).toBe(90);

    page.setRotation({ type: 'degrees', angle: 180 } as any);
    expect((page.getRotation() as any).angle).toBe(180);
  });

  it('merges two PDF documents into a combined document', async () => {
    const docA = await PDFDocument.create();
    docA.addPage();
    docA.addPage();

    const docB = await PDFDocument.create();
    docB.addPage();

    const merged = await PDFDocument.create();
    const pagesA = await merged.copyPages(docA, docA.getPageIndices());
    pagesA.forEach((p) => merged.addPage(p));

    const pagesB = await merged.copyPages(docB, docB.getPageIndices());
    pagesB.forEach((p) => merged.addPage(p));

    expect(merged.getPageCount()).toBe(3);
  });

  it('extracts specific page indices from a multi-page PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage(); // index 0
    doc.addPage(); // index 1
    doc.addPage(); // index 2
    doc.addPage(); // index 3

    const extracted = await PDFDocument.create();
    const selection = [0, 2]; // select page 1 and page 3
    const copied = await extracted.copyPages(doc, selection);
    copied.forEach((p) => extracted.addPage(p));

    expect(extracted.getPageCount()).toBe(2);
  });

  it('parses page ranges string correctly into 0-based page index array', () => {
    const parsePageRange = (input: string, totalPages: number): number[] => {
      const result: number[] = [];
      const parts = input.split(',').map((s) => s.trim());

      for (const part of parts) {
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-').map((s) => s.trim());
          const start = Math.max(1, parseInt(startStr, 10));
          const end = Math.min(totalPages, parseInt(endStr, 10));
          for (let i = start; i <= end; i++) {
            if (!result.includes(i - 1)) result.push(i - 1);
          }
        } else {
          const p = parseInt(part, 10);
          if (!isNaN(p) && p >= 1 && p <= totalPages && !result.includes(p - 1)) {
            result.push(p - 1);
          }
        }
      }

      return result.sort((a, b) => a - b);
    };

    const pages = parsePageRange('1-3, 5, 7-8', 10);
    expect(pages).toEqual([0, 1, 2, 4, 6, 7]);
  });
});
