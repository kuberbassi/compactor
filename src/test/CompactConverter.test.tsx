import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompactConverter } from '../compact/CompactConverter';
import { convertUniversalFile } from '../utils/universalConversion';

vi.mock('../utils/universalConversion', () => ({ convertUniversalFile: vi.fn() }));
vi.mock('../utils/ffmpeg', () => ({ terminateFFmpeg: vi.fn(async () => undefined) }));

describe('CompactConverter', () => {
  beforeEach(() => {
    vi.mocked(convertUniversalFile).mockImplementation(async (file, target, onProgress) => {
      onProgress(50, 'Converting');
      const content = target === 'pdf' ? '%PDF-1.7\n1 0 obj\nendobj\n%%EOF' : `converted:${file.name}`;
      return { blob: new Blob([content]), name: `${file.name.replace(/\.[^/.]+$/, '')}.${target}` };
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:${Math.random()}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('filters to shared targets, rejects incompatible additions, and converts sequentially', async () => {
    const onProcessed = vi.fn();
    const { container } = render(<CompactConverter onGoHome={() => undefined} onProcessed={onProcessed} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const markdown = new File(['# First'], 'first.md', { type: 'text/markdown', lastModified: 1 });
    const text = new File(['Second'], 'second.txt', { type: 'text/plain', lastModified: 2 });
    const audio = new File(['audio'], 'track.mp3', { type: 'audio/mpeg', lastModified: 3 });

    fireEvent.change(input, { target: { files: [markdown, text] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /convert 2 to pdf/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /convert every file to/i }));
    expect(screen.getByRole('option', { name: 'PDF' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DOCX' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'PDF' }));

    fireEvent.change(input, { target: { files: [audio] } });
    expect(await screen.findByText(/does not share a conversion target/i)).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /convert 2 to pdf/i })); });
    await waitFor(() => expect(convertUniversalFile).toHaveBeenCalledTimes(2));
    expect(vi.mocked(convertUniversalFile).mock.calls.map(call => call[0].name)).toEqual(['first.md', 'second.txt']);
    expect(onProcessed).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: /download 2 files as zip/i })).toBeEnabled();
  });
});
