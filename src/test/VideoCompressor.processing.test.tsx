import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoCompressor } from '../pages/VideoCompressor/VideoCompressor';
import { compressVideo } from '../utils/ffmpeg';

vi.mock('../utils/ffmpeg', () => ({
  getFFmpeg: vi.fn(async () => undefined),
  compressVideo: vi.fn(() => new Promise(() => undefined)),
  terminateFFmpeg: vi.fn(async () => undefined),
}));

describe('VideoCompressor processing state', () => {
  beforeEach(() => {
    vi.mocked(compressVideo).mockImplementation(() => new Promise(() => undefined));
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:source-video'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('keeps the workspace mounted and shows progress while encoding', async () => {
    const { container } = render(
      <VideoCompressor
        mode="compress"
        onGoHome={() => {}}
        onSelectTool={() => {}}
        onUploadSuccess={() => {}}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })] },
    });

    fireEvent.click(await screen.findByRole('button', { name: /start compression/i }));

    await waitFor(() => {
      expect(screen.getByText(/encoding video frames safely inside your browser/i)).toBeVisible();
    });
    expect(screen.getByRole('button', { name: /cancel processing/i })).toBeVisible();
    expect(container.querySelector('.image-workbench')).toHaveClass('is-processing');
    expect(screen.getByRole('region', { name: /video processing status/i })).toBeVisible();
  });
});
