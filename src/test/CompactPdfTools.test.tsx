import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompactPdfTool } from '../compact/CompactPdfTool';
import { CompactImagesToPdf } from '../compact/CompactImagesToPdf';
import { compactToolForId } from '../compact/compactTools';
import { compactPdfJobs } from '../compact/pdf/compactPdfJobs';

vi.mock('../compact/pdf/compactPdfJobs', async importOriginal => {
  const original = await importOriginal<typeof import('../compact/pdf/compactPdfJobs')>();
  return {
    ...original,
    getCompactPdfPageCount: vi.fn(async () => 5),
    getCompactPdfSecurityStatus: vi.fn(async () => ({ isEncrypted: false, pageCount: 1 })),
    renderCompactPdfPages: vi.fn(async () => [{ blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]), name: 'source-page-2.png' }]),
    compactPdfJobs: {
      merge: vi.fn(async () => new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' })),
      protect: vi.fn(async () => new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' })),
      unlock: vi.fn(async () => new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' })),
      imagesToPdf: vi.fn(async () => new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' })),
    },
  };
});

const tool = (id: string) => compactToolForId(id)!;

describe('compact PDF quick tools', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('merges files in the accessible reordered sequence', async () => {
    const { container } = render(<CompactPdfTool tool={tool('pdf-merge')} onGoHome={() => undefined} onProcessed={() => undefined} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File(['a'], 'first.pdf', { type: 'application/pdf' });
    const second = new File(['b'], 'second.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [first, second] } });
    fireEvent.click(screen.getByRole('button', { name: /move second.pdf earlier/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^merge pdfs$/i })); });
    await waitFor(() => expect(compactPdfJobs.merge).toHaveBeenCalled());
    expect(vi.mocked(compactPdfJobs.merge).mock.calls.at(-1)?.[0].map(file => file.name)).toEqual(['second.pdf', 'first.pdf']);
  });

  it('requires matching protection passwords and clears them after processing', async () => {
    const { container } = render(<CompactPdfTool tool={tool('pdf-protect')} onGoHome={() => undefined} onProcessed={() => undefined} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['pdf'], 'private.pdf', { type: 'application/pdf' })] } });
    await screen.findByLabelText(/^password$/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmationInput = screen.getByLabelText(/confirm password/i);
    fireEvent.change(passwordInput, { target: { value: 'secret-one' } });
    fireEvent.change(confirmationInput, { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /protect pdf/i }));
    expect(await screen.findByText(/does not match/i)).toBeInTheDocument();
    fireEvent.change(confirmationInput, { target: { value: 'secret-one' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /protect pdf/i })); });
    await waitFor(() => expect(compactPdfJobs.protect).toHaveBeenCalledWith(expect.any(File), 'secret-one'));
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /1 file is ready/i })).toBeInTheDocument();
  });

  it('does not offer unlock controls for a PDF that is already unlocked', async () => {
    const { container } = render(<CompactPdfTool tool={tool('pdf-unlock')} onGoHome={() => undefined} onProcessed={() => undefined} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['pdf'], 'public.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText(/already unlocked/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock pdf/i })).toBeDisabled();
    expect(compactPdfJobs.unlock).not.toHaveBeenCalled();
  });

  it('reorders and rotates images while cleaning preview object URLs', () => {
    const { container, unmount } = render(<CompactImagesToPdf onGoHome={() => undefined} onProcessed={() => undefined} />);
    const first = new File(['a'], 'one.png', { type: 'image/png' });
    const second = new File(['b'], 'two.jpg', { type: 'image/jpeg' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [first, second] } });
    fireEvent.click(screen.getByRole('button', { name: /move two.jpg earlier/i }));
    fireEvent.click(screen.getByRole('button', { name: /rotate two.jpg clockwise/i }));
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('two.jpg');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('90°');
    unmount();
    expect(vi.mocked(URL.revokeObjectURL).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
