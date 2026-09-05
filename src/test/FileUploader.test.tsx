import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileUploader } from '../components/Common/FileUploader';

describe('FileUploader', () => {
  it('presents the file opener as an accessible keyboard action', () => {
    render(<FileUploader accept=".pdf" label="Select PDF file" onFilesSelected={() => undefined} />);
    const opener = screen.getByRole('button', { name: 'Select PDF file' });
    expect(opener).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is uploaded/i)).toBeInTheDocument();
  });

  it('passes a supported selected file to the tool', () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<FileUploader accept=".pdf" label="Select PDF file" onFilesSelected={onFilesSelected} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf'], 'document.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });
});
