import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfEditor } from '../pages/PdfTools/PdfEditor';

const getDocument = vi.fn();
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => getDocument(...args),
  TextLayer: class { render = vi.fn(async () => undefined); cancel = vi.fn(); },
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf-worker.js' }));
vi.mock('pdf-lib', () => ({ PDFDocument: { load: vi.fn(), create: vi.fn() } }));

describe('PdfEditor workflow', () => {
  beforeEach(() => {
    const viewport = { width: 612, height: 792, clone: vi.fn() };
    viewport.clone.mockReturnValue(viewport);
    const sourcePage = {
      getViewport: vi.fn(() => viewport),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
      getTextContent: vi.fn(async () => ({ items: [], styles: {}, lang: null })),
    };
    getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: vi.fn(async () => sourcePage) }),
      destroy: vi.fn(async () => undefined),
    });
    const outputPage = { getSize: vi.fn(() => ({ width: 612, height: 792 })), drawImage: vi.fn() };
    vi.mocked(PDFDocument.load).mockResolvedValue({
      getPages: vi.fn(() => [outputPage]),
      embedPng: vi.fn(async () => ({})),
      save: vi.fn(async () => new Uint8Array([1, 2, 3])),
    } as never);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:edited-pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class { observe() {} disconnect() {} },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
      get: (target, property) => property in target ? target[property as keyof typeof target] : vi.fn(),
      set: (target, property, value) => { Reflect.set(target, property, value); return true; },
    }) as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('loads a PDF, switches document mode, inserts an annotation, and exports it', async () => {
    const onSaveSuccess = vi.fn();
    const onSelectTool = vi.fn();
    const file = new File(['pdf'], 'source.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: vi.fn(async () => new ArrayBuffer(8)) });
    render(<PdfEditor file={file} onSaveSuccess={onSaveSuccess} onSelectTool={onSelectTool} />);

    expect(await screen.findByText('Page 1 of 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /redact/i }));
    expect(onSelectTool).toHaveBeenCalledWith('pdf-redact');
    fireEvent.click(screen.getByRole('button', { name: /signature/i }));
    const download = screen.getByRole('button', { name: /download pdf/i });
    expect(download).toBeEnabled();
    fireEvent.click(download);

    await waitFor(() => expect(onSaveSuccess).toHaveBeenCalledOnce());
    expect(await screen.findByText(/edited_source.pdf/i)).toBeVisible();
    expect(PDFDocument.load).toHaveBeenCalledOnce();
  });
});
