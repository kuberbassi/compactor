import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioTools } from '../pages/AudioTools/AudioTools';

describe('Audio workspace navigation', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:audio-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('returns from the editor to its Audio upload page before leaving the tool', () => {
    const onGoHome = vi.fn();
    const { container } = render(
      <AudioTools
        mode="audio-optimizer"
        onGoHome={onGoHome}
        onSelectTool={vi.fn()}
        onUploadSuccess={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })] } });

    const localBack = screen.getByRole('button', { name: 'Back to Audio upload' });
    fireEvent.click(localBack);
    expect(onGoHome).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Upload Audio or Video for Compress Audio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to all tools' }));
    expect(onGoHome).toHaveBeenCalledOnce();
  });
});
