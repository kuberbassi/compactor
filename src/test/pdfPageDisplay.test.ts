import { describe, expect, it } from 'vitest';
import { getDefaultPageZoom, getPageAspectRatio } from '../pages/PdfTools/pdfPageDisplay';

describe('PDF page display defaults', () => {
  it('opens portrait pages at 50% and landscape pages at 100%', () => {
    expect(getDefaultPageZoom({ width: 595, height: 842, rotation: 0 })).toBe(50);
    expect(getDefaultPageZoom({ width: 1280, height: 720, rotation: 0 })).toBe(100);
  });

  it('accounts for quarter-turn page rotation', () => {
    const landscape = { width: 1280, height: 720, rotation: 90 };
    expect(getPageAspectRatio(landscape)).toBeCloseTo(720 / 1280);
    expect(getDefaultPageZoom(landscape)).toBe(50);
  });

  it('uses the safe portrait default until dimensions are available', () => {
    expect(getDefaultPageZoom()).toBe(50);
    expect(getPageAspectRatio({ rotation: 0 })).toBe(0.72);
  });
});
