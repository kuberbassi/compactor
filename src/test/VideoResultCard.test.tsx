import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VideoResultCard, type VideoResultData } from '../pages/VideoCompressor/components/VideoResultCard';

const makeResult = (name: string): VideoResultData => ({
  url: 'blob:video-export',
  name,
  originalSize: 2_000_000,
  newSize: 1_000_000,
  blob: new Blob(['export']),
});

describe('VideoResultCard', () => {
  it('renders a complete video export result and reset action', () => {
    const onReset = vi.fn();
    const { container } = render(
      <VideoResultCard
        file={new File(['source'], 'source.mp4', { type: 'video/mp4' })}
        result={makeResult('source-compressed.mp4')}
        mode="compress"
        createsGif={false}
        extractAudio={false}
        onReset={onReset}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Video ready' })).toBeVisible();
    expect(screen.getByText('source-compressed.mp4')).toBeVisible();
    expect(container.querySelector('video')).toHaveAttribute('src', 'blob:video-export');
    expect(screen.getByRole('button', { name: /download video/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /another/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('uses the correct player and download label for audio exports', () => {
    const { container } = render(
      <VideoResultCard
        file={new File(['source'], 'source.mp4', { type: 'video/mp4' })}
        result={makeResult('source.mp3')}
        mode="audio"
        createsGif={false}
        extractAudio
        onReset={() => {}}
      />,
    );

    expect(container.querySelector('audio')).toHaveAttribute('src', 'blob:video-export');
    expect(screen.getByRole('button', { name: /download audio/i })).toBeEnabled();
  });
});
