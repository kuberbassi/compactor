import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UniversalConverter } from '../pages/UniversalConverter/UniversalConverter';
import { convertUniversalFile } from '../utils/universalConversion';

vi.mock('../utils/universalConversion', () => ({
  convertUniversalFile: vi.fn(),
}));

describe('UniversalConverter bulk queue', () => {
  beforeEach(() => {
    vi.mocked(convertUniversalFile).mockImplementation(async (file, target, _mode, onProgress) => {
      onProgress(50, `Converting ${file.name}`);
      return {
        blob: new Blob([`converted:${file.name}`], { type: 'application/pdf' }),
        name: `${file.name.replace(/\.[^/.]+$/, '')}.${target}`,
      };
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => `blob:result-${blob.size}-${Math.random()}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('queues compatible mixed files and converts them sequentially', async () => {
    const onUploadSuccess = vi.fn();
    const { container } = render(
      <UniversalConverter onGoHome={vi.fn()} onUploadSuccess={onUploadSuccess} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const markdown = new File(['# First'], 'first.md', { type: 'text/markdown', lastModified: 1 });
    const text = new File(['Second'], 'second.txt', { type: 'text/plain', lastModified: 2 });

    fireEvent.change(input, { target: { files: [markdown, text] } });

    expect(await screen.findByText('2 files · 13 Bytes')).toBeInTheDocument();
    const convertButton = screen.getByRole('button', { name: 'Convert 2 files to PDF' });
    fireEvent.click(convertButton);

    expect(await screen.findByText('Batch conversion complete')).toBeInTheDocument();
    await waitFor(() => expect(convertUniversalFile).toHaveBeenCalledTimes(2));
    expect(vi.mocked(convertUniversalFile).mock.calls.map(call => call[0].name)).toEqual(['first.md', 'second.txt']);
    expect(onUploadSuccess).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Download all (2)' })).toBeInTheDocument();
  });
});
