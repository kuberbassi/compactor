import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compressAudio, compressVideo, terminateFFmpeg } from '../utils/ffmpeg';
import { compactAudioAdapter, compactVideoAdapter } from '../compact/mediaCompressionAdapters';

vi.mock('../utils/ffmpeg', () => ({
  compressAudio: vi.fn(),
  compressVideo: vi.fn(),
  terminateFFmpeg: vi.fn(async () => undefined),
}));

const result = { blob: new Blob(['small']), url: 'blob:engine-result', name: 'optimized.mp4', originalSize: 8, newSize: 5 };

describe('compact media adapters', () => {
  beforeEach(() => {
    vi.mocked(compressAudio).mockResolvedValue(result);
    vi.mocked(compressVideo).mockResolvedValue(result);
    vi.mocked(terminateFFmpeg).mockClear();
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('maps compact audio settings to the shared FFmpeg engine', async () => {
    const settings = { format: 'mp3', bitrate: '96k', removeMetadata: true, normalizeAudio: true, channels: 'mono', removeSilence: false, noiseReduction: true, bassBoost: false } as const;
    const progress = vi.fn();
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });
    await compactAudioAdapter.process(file, settings, progress);
    expect(compressAudio).toHaveBeenCalledWith(file, settings, expect.any(Function), progress);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:engine-result');
  });

  it('maps video quality and supports terminating the active FFmpeg job', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    await compactVideoAdapter.process(file, { format: 'mp4', quality: 'smaller', scale: '854:480', removeAudio: true, removeMetadata: true, target: 'general', watermarkText: '', watermarkOpacity: .35 }, vi.fn());
    expect(compressVideo).toHaveBeenCalledWith(file, expect.objectContaining({ crf: 31, scale: '854:480', removeAudio: true, format: 'mp4' }), expect.any(Function), expect.any(Function));
    await compactVideoAdapter.cancelActive?.();
    expect(terminateFFmpeg).toHaveBeenCalledOnce();
  });
});
