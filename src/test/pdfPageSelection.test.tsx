import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LivePdfPreview } from '../pages/PdfTools/components/LivePdfPreview';
import { parsePageRanges } from '../pages/PdfTools/pdfToolsConfig';

describe('PDF page selection', () => {
  it('does not reselect gaps when a page chip is removed', () => {
    const onChange = vi.fn();
    render(<LivePdfPreview activeTool="pdf-split" singleFile={{ file: new File([], 'test.pdf'), pageCount: 6 }} pageRangeText="1, 3, 5-6" setPageRangeText={onChange} watermarkText="" watermarkPos="header" watermarkColor="black" watermarkOpacity={1} pageNumberPosition="bottom" cropMarginsPct={0} signatureText="" signaturePos="center" signatureColor="black" signatureTargetPages="all-pages" />);
    fireEvent.click(screen.getByTitle('Remove Page 6'));
    expect(parsePageRanges(onChange.mock.calls[0][0], 6)).toEqual([1, 3, 5]);
  });
  it('bounds huge ranges before iterating', () => {
    expect(parsePageRanges('1-999999999999', 3)).toEqual([1, 2, 3]);
    expect(parsePageRanges('5-2', 6)).toEqual([2, 3, 4, 5]);
  });
});
