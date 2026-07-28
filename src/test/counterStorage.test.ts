import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProcessedCount, recordProcessedFiles } from '../utils/counterStorage';

describe('trustworthy processed-file metrics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts at an honest zero instead of a fabricated baseline', async () => {
    await expect(getProcessedCount()).resolves.toEqual({ count: 0, scope: 'device' });
  });

  it('counts only explicit successful completion records', async () => {
    await expect(recordProcessedFiles(2)).resolves.toEqual({ count: 2, scope: 'device' });
    await expect(getProcessedCount()).resolves.toEqual({ count: 2, scope: 'device' });
  });

  it('bounds a single metric update to prevent accidental inflation', async () => {
    await expect(recordProcessedFiles(10_000)).resolves.toEqual({ count: 25, scope: 'device' });
  });

  it('broadcasts an honest scoped snapshot to active tabs', async () => {
    const listener = vi.fn();
    window.addEventListener('compactor:count-updated', listener);
    await recordProcessedFiles();
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ count: 1, scope: 'device' });
    window.removeEventListener('compactor:count-updated', listener);
  });
});
