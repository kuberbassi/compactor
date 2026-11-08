import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MergePanel } from '../pages/PdfTools/components/MergePanel';
import { PageOrganizer } from '../pages/PdfTools/components/PageOrganizer';
import type { PdfFileInfo } from '../pages/PdfTools/components/LivePdfPreview';
import type { PageItem } from '../pages/PdfTools/components/PageOrganizer';

describe('PDF Reordering (Drag and Drop + Arrow controls)', () => {
  const dummyFile1 = new File(['%PDF-1.7...1'], 'doc1.pdf', { type: 'application/pdf' });
  const dummyFile2 = new File(['%PDF-1.7...2'], 'doc2.pdf', { type: 'application/pdf' });
  const dummyFile3 = new File(['%PDF-1.7...3'], 'doc3.pdf', { type: 'application/pdf' });

  const multipleFiles: PdfFileInfo[] = [
    { file: dummyFile1, pageCount: 2 },
    { file: dummyFile2, pageCount: 4 },
    { file: dummyFile3, pageCount: 1 },
  ];

  it('supports arrow button reordering in MergePanel', () => {
    const onMoveQueueItem = vi.fn();
    render(
      <MergePanel
        multipleFiles={multipleFiles}
        onMoveQueueItem={onMoveQueueItem}
        onRemoveQueueItem={vi.fn()}
        onAddFiles={vi.fn()}
        onClearQueue={vi.fn()}
        onRunMerge={vi.fn()}
      />
    );

    // Click move down on first item
    const moveDownButtons = screen.getAllByTitle('Move down');
    fireEvent.click(moveDownButtons[0]);
    expect(onMoveQueueItem).toHaveBeenCalledWith(0, 1);

    // Click move up on second item
    const moveUpButtons = screen.getAllByTitle('Move up');
    fireEvent.click(moveUpButtons[1]);
    expect(onMoveQueueItem).toHaveBeenCalledWith(1, 0);
  });

  it('supports drag and drop reordering in MergePanel', () => {
    const onMoveQueueItem = vi.fn();
    render(
      <MergePanel
        multipleFiles={multipleFiles}
        onMoveQueueItem={onMoveQueueItem}
        onRemoveQueueItem={vi.fn()}
        onAddFiles={vi.fn()}
        onClearQueue={vi.fn()}
        onRunMerge={vi.fn()}
      />
    );

    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(3);

    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(format: string, data: string) { this.data[format] = data; },
      getData(format: string) { return this.data[format] || ''; },
      effectAllowed: '',
      dropEffect: '',
    };

    // Drag item 0 over item 2 and drop
    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[2], { dataTransfer });
    fireEvent.drop(items[2], { dataTransfer });

    expect(onMoveQueueItem).toHaveBeenCalledWith(0, 2);
  });

  it('supports both arrow buttons and drag and drop reordering in PageOrganizer', () => {
    const onMovePage = vi.fn();
    const pages: PageItem[] = [
      { id: 'p-1', originalIndex: 0, rotation: 0, width: 612, height: 792 },
      { id: 'p-2', originalIndex: 1, rotation: 0, width: 612, height: 792 },
      { id: 'p-3', originalIndex: 2, rotation: 0, width: 612, height: 792 },
    ];

    render(
      <PageOrganizer
        singleFile={{ file: dummyFile1, pageCount: 3 }}
        pagesList={pages}
        onRotatePage={vi.fn()}
        onRotateAll={vi.fn()}
        onMovePage={onMovePage}
        onDeletePage={vi.fn()}
        onPeekPage={vi.fn()}
        onReset={vi.fn()}
        onRunOrganize={vi.fn()}
        onRemoveBlankPages={vi.fn()}
        blankPageStatus="idle"
        blankPageCount={0}
        addPageNumbers={false}
        onAddPageNumbersChange={vi.fn()}
        pageNumberPosition="bottom"
        onPageNumberPositionChange={vi.fn()}
        cropEnabled={false}
        onCropEnabledChange={vi.fn()}
        cropMarginsPct={0}
        onCropMarginsChange={vi.fn()}
      />
    );

    // Check thumbnail arrows
    const moveEarlierButtons = screen.getAllByTitle('Move page earlier');
    expect(moveEarlierButtons[0]).toBeDisabled();
    fireEvent.click(moveEarlierButtons[1]);
    expect(onMovePage).toHaveBeenCalledWith(1, 0);

    const moveLaterButtons = screen.getAllByTitle('Move page later');
    expect(moveLaterButtons[2]).toBeDisabled();
    fireEvent.click(moveLaterButtons[0]);
    expect(onMovePage).toHaveBeenCalledWith(0, 1);

    // Test drag and drop reordering
    const thumbnails = screen.getAllByLabelText(/Drag to reorder/i);
    expect(thumbnails.length).toBe(3);

    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(format: string, data: string) { this.data[format] = data; },
      getData(format: string) { return this.data[format] || ''; },
      effectAllowed: '',
      dropEffect: '',
    };

    // Drag page 0 over page 2 and drop
    fireEvent.dragStart(thumbnails[0], { dataTransfer });
    fireEvent.dragOver(thumbnails[2], { dataTransfer });
    fireEvent.drop(thumbnails[2], { dataTransfer });

    expect(onMovePage).toHaveBeenCalledWith(0, 2);
  });
});
