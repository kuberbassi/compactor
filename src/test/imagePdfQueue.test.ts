import { describe, expect, it } from 'vitest';
import { moveQueueItem, remapActiveQueueIndex } from '../pages/ImageTools/imagePdfQueue';

describe('Images-to-PDF page queue', () => {
  it('moves one page while preserving every other page in order', () => {
    expect(moveQueueItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveQueueItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('does not mutate its source or accept invalid positions', () => {
    const source = ['a', 'b'];
    expect(moveQueueItem(source, -1, 1)).toEqual(source);
    expect(moveQueueItem(source, 0, 5)).toEqual(source);
    expect(source).toEqual(['a', 'b']);
  });

  it('keeps the selected page attached to the same image after a move', () => {
    expect(remapActiveQueueIndex(0, 0, 2)).toBe(2);
    expect(remapActiveQueueIndex(1, 0, 2)).toBe(0);
    expect(remapActiveQueueIndex(2, 3, 1)).toBe(3);
    expect(remapActiveQueueIndex(null, 0, 1)).toBeNull();
  });
});
