import { describe, expect, it } from 'vitest';
import { parsePageRange } from '../compact/pdf/compactPdfJobs';

describe('compact PDF page ranges', () => {
  it('uses all pages for an empty range and deduplicates ordered selections', () => {
    expect(parsePageRange('', 4)).toEqual([1, 2, 3, 4]);
    expect(parsePageRange('3, 1-2, 2', 5)).toEqual([1, 2, 3]);
  });

  it('rejects malformed, reversed, and out-of-bounds ranges', () => {
    expect(() => parsePageRange('one', 3)).toThrow(/page numbers/i);
    expect(() => parsePageRange('3-1', 3)).toThrow(/between 1 and 3/i);
    expect(() => parsePageRange('4', 3)).toThrow(/between 1 and 3/i);
  });
});
