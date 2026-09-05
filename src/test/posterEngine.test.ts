import { describe, it, expect } from 'vitest';
import {
  calculatePosterPlan,
  PAGE_SIZES,
  HALFTONE_CELL_SIZE,
  HALFTONE_SAMPLE_POINTS
} from '../utils/posterEngine';

describe('posterEngine', () => {
  it('defines standard page sizes correctly in mm and PDF points', () => {
    expect(PAGE_SIZES.A4.mmW).toBe(210);
    expect(PAGE_SIZES.A4.mmH).toBe(297);
    expect(PAGE_SIZES.Letter.mmW).toBeCloseTo(215.9, 1);
    expect(PAGE_SIZES.Letter.mmH).toBeCloseTo(279.4, 1);
  });

  it('calculates poster plan correctly for A4 portrait 3x3', () => {
    const plan = calculatePosterPlan({
      imageWidth: 3000,
      imageHeight: 2000,
      pageSize: 'A4',
      orientation: 'Portrait',
      columns: 3,
      rows: 3,
      styleMode: 'color',
      showCropMarks: true,
    });

    expect(plan.columns).toBe(3);
    expect(plan.rows).toBe(3);
    expect(plan.totalPages).toBe(9);
    expect(plan.totalMMW).toBe(3 * 210);
    expect(plan.totalMMH).toBe(3 * 297);
    expect(plan.pagePdfWidth).toBe(PAGE_SIZES.A4.width);
    expect(plan.pagePdfHeight).toBe(PAGE_SIZES.A4.height);
  });

  it('calculates poster plan for landscape orientation swapping dimensions', () => {
    const plan = calculatePosterPlan({
      imageWidth: 4000,
      imageHeight: 3000,
      pageSize: 'A4',
      orientation: 'Landscape',
      columns: 4,
      rows: 2,
      styleMode: 'bw',
      showCropMarks: false,
    });

    expect(plan.columns).toBe(4);
    expect(plan.rows).toBe(2);
    expect(plan.totalPages).toBe(8);
    expect(plan.totalMMW).toBe(4 * 297);
    expect(plan.totalMMH).toBe(2 * 210);
    expect(plan.pagePdfWidth).toBe(PAGE_SIZES.A4.height);
    expect(plan.pagePdfHeight).toBe(PAGE_SIZES.A4.width);
  });

  it('throws an error if total pages exceed the maximum safety cap', () => {
    expect(() => {
      calculatePosterPlan({
        imageWidth: 2000,
        imageHeight: 2000,
        pageSize: 'A4',
        orientation: 'Portrait',
        columns: 15,
        rows: 10,
        styleMode: 'halftone',
        showCropMarks: true,
        maxSheetsCap: 100
      });
    }).toThrow(/exceeds the safety limit/);
  });

  it('clamps columns and rows to min 1 and max 20', () => {
    const plan = calculatePosterPlan({
      imageWidth: 1000,
      imageHeight: 1000,
      pageSize: 'A4',
      orientation: 'Portrait',
      columns: 0,
      rows: 50,
      styleMode: 'color',
      showCropMarks: true,
      maxSheetsCap: 500
    });

    expect(plan.columns).toBe(1);
    expect(plan.rows).toBe(20);
  });

  it('verifies halftone sampling points and cell size constants', () => {
    expect(HALFTONE_CELL_SIZE).toBeGreaterThan(0);
    expect(HALFTONE_SAMPLE_POINTS.length).toBe(5);
    for (const [x, y] of HALFTONE_SAMPLE_POINTS) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });
});

