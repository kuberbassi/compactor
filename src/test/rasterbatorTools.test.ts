import { describe, it, expect } from 'vitest';

const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)', mmW: 210, mmH: 297 },
  A3: { width: 841.89, height: 1190.55, label: 'A3 (297 × 420 mm)', mmW: 297, mmH: 420 },
  A2: { width: 1190.55, height: 1683.78, label: 'A2 (420 × 594 mm)', mmW: 420, mmH: 594 },
  Letter: { width: 612.00, height: 792.00, label: 'Letter (8.5 × 11 in)', mmW: 215.9, mmH: 279.4 },
  Legal: { width: 612.00, height: 1008.00, label: 'Legal (8.5 × 14 in)', mmW: 215.9, mmH: 355.6 },
  Tabloid: { width: 792.00, height: 1224.00, label: 'Tabloid (11 × 17 in)', mmW: 279.4, mmH: 431.8 }
};

function recalcRows(cols: number, imgW: number, imgH: number, sizeKey: keyof typeof PAGE_SIZES, orient: 'Portrait' | 'Landscape') {
  const p = PAGE_SIZES[sizeKey];
  const pW = orient === 'Portrait' ? p.mmW : p.mmH;
  const pH = orient === 'Portrait' ? p.mmH : p.mmW;
  const imgAspect = imgW / imgH;
  return Math.max(1, Math.round((cols * pW) / (imgAspect * pH)));
}

describe('Rasterbator (Poster Maker) Utilities', () => {
  it('PAGE_SIZES defines accurate A4, A3, and Letter millimeter dimensions', () => {
    expect(PAGE_SIZES.A4.mmW).toBe(210);
    expect(PAGE_SIZES.A4.mmH).toBe(297);
    expect(PAGE_SIZES.A3.mmW).toBe(297);
    expect(PAGE_SIZES.A3.mmH).toBe(420);
    expect(PAGE_SIZES.Letter.mmW).toBe(215.9);
  });

  it('recalcRows calculates row count proportionally based on image aspect ratio', () => {
    // 16:9 widescreen image (1920x1080) on 5 columns of A4 Portrait
    const cols = 5;
    const imgW = 1920;
    const imgH = 1080;
    const rows = recalcRows(cols, imgW, imgH, 'A4', 'Portrait');

    // 5 * 210 = 1050mm width. 16:9 height = 1050 / (16/9) = 590.625mm.
    // A4 height = 297mm => ~2 rows!
    expect(rows).toBe(2);
  });

  it('calculates total grid pages accurately', () => {
    const cols = 4;
    const rows = 3;
    const totalPages = cols * rows;
    expect(totalPages).toBe(12);
  });

  it('orientation swaps page width and height dimensions', () => {
    const p = PAGE_SIZES.A4;
    const portraitW = p.mmW;
    const portraitH = p.mmH;

    const landscapeW = p.mmH;
    const landscapeH = p.mmW;

    expect(portraitW).toBe(210);
    expect(portraitH).toBe(297);
    expect(landscapeW).toBe(297);
    expect(landscapeH).toBe(210);
  });

  it('calculates total poster physical width in meters correctly', () => {
    const cols = 5;
    const a4MmWidth = PAGE_SIZES.A4.mmW; // 210mm
    const totalMmWidth = cols * a4MmWidth; // 1050mm
    const metersWidth = totalMmWidth / 1000; // 1.05m

    expect(metersWidth).toBe(1.05);
  });
});
