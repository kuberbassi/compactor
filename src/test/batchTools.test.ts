import { describe, expect, it, vi } from 'vitest';
import {
  appendUniqueFiles,
  downloadAll,
  fileIdentity,
  getSizeSummary,
  loadSetting,
  makeUniqueNames,
  saveSetting,
} from '../utils/batch';

describe('shared compressor batch rules', () => {
  it('uses stable file identity and skips exact duplicate imports', () => {
    const first = new File(['one'], 'photo.jpg', { type: 'image/jpeg', lastModified: 10 });
    const duplicate = new File(['one'], 'photo.jpg', { type: 'image/jpeg', lastModified: 10 });
    const different = new File(['two'], 'photo.jpg', { type: 'image/jpeg', lastModified: 11 });

    expect(fileIdentity(first)).toBe(fileIdentity(duplicate));
    expect(appendUniqueFiles([first], [duplicate, different])).toEqual([first, different]);
  });

  it('creates collision-safe download names while preserving extensions', () => {
    expect(makeUniqueNames(['report.pdf', 'report.pdf', 'report.pdf', 'photo'])).toEqual([
      'report.pdf',
      'report (1).pdf',
      'report (2).pdf',
      'photo',
    ]);
  });

  it('calculates before/after totals without reporting negative savings', () => {
    expect(getSizeSummary([
      { originalSize: 1_000, newSize: 600 },
      { originalSize: 2_000, newSize: 1_500 },
    ])).toEqual({ originalSize: 3_000, newSize: 2_100, savedSize: 900, savedPercent: 30 });
    expect(getSizeSummary([{ originalSize: 100, newSize: 110 }]).savedSize).toBe(0);
  });

  it('persists and safely reloads beginner preset settings', () => {
    saveSetting('test-preset', 'maximum');
    expect(loadSetting('test-preset', 'balanced')).toBe('maximum');
    localStorage.setItem('broken-setting', '{');
    expect(loadSetting('broken-setting', 'balanced')).toBe('balanced');
  });

  it('downloads every completed item and assigns unique names', () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadAll([
      { url: 'blob:first', name: 'same.pdf' },
      { url: 'blob:second', name: 'same.pdf' },
    ]);
    vi.runAllTimers();
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
    vi.useRealTimers();
  });
});
