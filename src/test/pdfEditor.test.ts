import { describe, expect, it } from 'vitest';
import { getAutoSignatureFontSize, getAutoStampFontSize, getClosestPageIndex, getTargetPageIndexes, getWatermarkGrid, getWatermarkPatternPositions, togglePageEffect } from '../utils/pdfEditor';

describe('PDF editor page behavior', () => {
  it('targets the visible page or every page according to scope', () => {
    expect(getTargetPageIndexes('current', 2, 4)).toEqual([2]);
    expect(getTargetPageIndexes('all', 2, 4)).toEqual([0, 1, 2, 3]);
  });

  it('selects the page nearest the viewport center', () => {
    const pages = [
      { top: -650, height: 800 },
      { top: 180, height: 800 },
      { top: 1010, height: 800 },
    ];
    expect(getClosestPageIndex({ top: 0, height: 900 }, pages)).toBe(1);
  });

  it('toggles fixed page effects without duplicating pages', () => {
    expect(togglePageEffect([0], [0, 1])).toEqual([0, 1]);
    expect(togglePageEffect([0, 1, 2], [0, 1])).toEqual([2]);
  });

  it('normalizes pattern watermark density to a safe grid', () => {
    expect(getWatermarkGrid(4)).toEqual({ columns: 4, rows: 6, count: 24 });
    expect(getWatermarkGrid(0)).toEqual({ columns: 2, rows: 4, count: 8 });
    expect(getWatermarkGrid(12)).toEqual({ columns: 6, rows: 8, count: 48 });
  });

  it('creates staggered watermark tiles beyond the page edges', () => {
    const positions = getWatermarkPatternPositions(3);
    expect(positions.some(position => position.x < 0)).toBe(true);
    expect(positions.some(position => position.x > 100)).toBe(true);
    expect(positions[0].x).not.toBe(positions[5].x);
  });

  it('fits inserted labels to their box and responds to resizing', () => {
    const regularStamp = getAutoStampFontSize('CANCELLED', 300, 100);
    expect(regularStamp).toBeGreaterThan(14);
    expect(getAutoStampFontSize('A MUCH LONGER STAMP', 300, 100)).toBeLessThan(regularStamp);
    expect(getAutoStampFontSize('CANCELLED', 150, 50)).toBeLessThan(regularStamp);
    expect(getAutoSignatureFontSize('Verified Signature', 350, 140)).toBeGreaterThan(14);
  });
});
