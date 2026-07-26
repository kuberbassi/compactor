import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredUploadCount, incrementStoredUploadCount } from '../utils/counterStorage';

describe('counterStorage utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns baseline dynamic upload count when storage is empty', async () => {
    const count = await getStoredUploadCount();
    expect(count).toBeGreaterThanOrEqual(1489230);
  });

  it('increments upload count correctly', async () => {
    const initial = await getStoredUploadCount();
    const updated = await incrementStoredUploadCount(5);
    expect(updated).toBe(initial + 5);

    const reloaded = await getStoredUploadCount();
    expect(reloaded).toBe(updated);
  });
});
