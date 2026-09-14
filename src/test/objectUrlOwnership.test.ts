import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompressionResult } from '../pages/PdfTools/pdfToolsConfig';
import type { ImageProcessResult } from '../utils/image';
import { compressVideoNative } from '../utils/nativeCompressor';
import { createObjectUrlOwner } from '../utils/objectUrl';

const pdfResult = (url?: string): CompressionResult => ({
  sourceName: 'source.pdf',
  sourceSize: 100,
  outputName: 'output.pdf',
  outputSize: url ? 50 : 0,
  url,
});

const imageResult = (url: string): ImageProcessResult => ({
  blob: new Blob(),
  url,
  name: 'output.webp',
  originalSize: 100,
  newSize: 50,
  width: 10,
  height: 10,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('object URL ownership', () => {
  it('preserves retained PDF results during retry and revokes departed results on reset', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const retained = pdfResult('blob:retained-pdf');
    const failed = pdfResult();
    const retried = pdfResult('blob:retried-pdf');

    const owner = createObjectUrlOwner(
      [] as CompressionResult[],
      results => results.flatMap(result => result.url ? [result.url] : []),
    );
    owner.replace([retained, failed]);
    owner.replace([retained, retried]);
    expect(revoke).not.toHaveBeenCalled();
    expect(owner.current()).toEqual([retained, retried]);

    owner.cleanup();
    expect(revoke.mock.calls).toEqual([
      ['blob:retained-pdf'],
      ['blob:retried-pdf'],
    ]);
  });

  it('preserves retained image results during retry and revokes removed results', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const retained = imageResult('blob:retained-image');
    const retried = imageResult('blob:retried-image');

    const owner = createObjectUrlOwner([] as ImageProcessResult[], results => results.map(result => result.url));
    owner.replace([retained]);
    owner.replace([retained, retried]);
    expect(revoke).not.toHaveBeenCalled();

    owner.replace([retried]);
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:retained-image');
  });

  it('revokes the native compressor source URL exactly once when metadata loading fails', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:native-source');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const realCreateElement = document.createElement.bind(document);
    const metadataVideo = {
      preload: '',
      src: '',
      duration: 0,
      onloadedmetadata: null as null | (() => void),
      onerror: null as null | (() => void),
      removeAttribute: vi.fn(),
      load: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => (
      tagName === 'video' ? metadataVideo : realCreateElement(tagName)
    )) as typeof document.createElement);

    const pending = compressVideoNative(
      new File(['not-video'], 'broken.mp4', { type: 'video/mp4' }),
      {
        bitrateKbps: 1000,
        removeAudio: false,
        onProgress: vi.fn(),
        onLog: vi.fn(),
      },
    );
    metadataVideo.onerror?.();

    await expect(pending).rejects.toThrow('Unable to read video metadata');
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:native-source');
    expect(metadataVideo.removeAttribute).toHaveBeenCalledWith('src');
    expect(metadataVideo.load).toHaveBeenCalledOnce();
  });
});
