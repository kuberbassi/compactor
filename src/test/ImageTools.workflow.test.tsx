import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageTools } from '../pages/ImageTools/ImageTools';
import { processImage } from '../utils/image';

vi.mock('../utils/image', async importOriginal => {
  const actual = await importOriginal<typeof import('../utils/image')>();
  return {
    ...actual,
    loadImage: vi.fn(async () => ({ naturalWidth: 100, naturalHeight: 80 })),
    processImage: vi.fn(),
  };
});

const processed = (name: string, url: string) => ({
  blob: new Blob(['optimized']), url, name, originalSize: 100, newSize: 50, width: 100, height: 80,
});

describe('ImageTools workflow', () => {
  beforeEach(() => {
    vi.mocked(processImage)
      .mockResolvedValueOnce(processed('first.webp', 'blob:image-result-1'))
      .mockRejectedValueOnce(new Error('decode failed'))
      .mockResolvedValueOnce(processed('second.webp', 'blob:image-result-2'));
    let previewIndex = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:image-preview-${++previewIndex}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('selects a multi-file queue, retries a partial failure, and retains successful output', async () => {
    const onUploadSuccess = vi.fn();
    const { container, unmount } = render(
      <ImageTools initialTab="compress" onGoHome={vi.fn()} onSelectTool={vi.fn()} onUploadSuccess={onUploadSuccess} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File(['first'], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [first, second] } });
    expect(await screen.findByRole('button', { name: 'Select image 2: second.png' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Select image 2: second.png' }));
    expect(screen.getByRole('button', { name: 'Select image 2: second.png' })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getAllByRole('button', { name: /compress \(2\)/i })[0]);

    expect(await screen.findByRole('button', { name: /retry 1 failed/i })).toBeVisible();
    expect(screen.getByText('first.webp')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /retry 1 failed/i }));

    await waitFor(() => expect(processImage).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('second.webp')).toBeVisible();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:image-result-1');
    expect(onUploadSuccess).toHaveBeenCalledTimes(2);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image-result-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image-result-2');
  });
});
