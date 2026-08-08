import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SimpleNav from '../components/ui/SimpleNav';

describe('SimpleNav Component', () => {
  it('renders brand logo brandmark text', () => {
    render(<SimpleNav />);
    expect(screen.getByText('compactor')).toBeInTheDocument();
  });

  it('triggers onBrandClick when logo is clicked', () => {
    const handleBrandClick = vi.fn();
    render(<SimpleNav onBrandClick={handleBrandClick} />);
    const logoButton = screen.getByRole('button', { name: /compactor home/i });
    fireEvent.click(logoButton);
    expect(handleBrandClick).toHaveBeenCalledTimes(1);
  });

  it('renders mobile menu button on small screens', () => {
    render(<SimpleNav />);
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('links the new PDF tools to their real routes', () => {
    const handleLinkClick = vi.fn();
    render(<SimpleNav onLinkClick={handleLinkClick} />);

    fireEvent.click(screen.getByRole('button', { name: /^pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /Edit PDF/i }));
    expect(handleLinkClick).toHaveBeenCalledWith('pdf-edit');

    fireEvent.click(screen.getByRole('button', { name: /^pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /Markdown Workspace/i }));
    expect(handleLinkClick).toHaveBeenCalledWith('pdf-word-to-pdf');
  });

  it('keeps PDF navigation in the same order as the PDF tools page', () => {
    render(<SimpleNav />);
    fireEvent.click(screen.getByRole('button', { name: /^pdf/i }));

    const labels = Array.from(document.querySelectorAll('[data-nav-group-items="pdf"] button'))
      .map(button => button.textContent?.trim());

    expect(labels).toEqual([
      'Edit PDF',
      'Page Organizer',
      'Merge PDF',
      'Split PDF',
      'Crop Margins',
      'Compress PDF',
      'Document Stamps',
      'Redact & Annotate',
      'Flatten Forms',
      'Sign Document',
      'Add Watermark',
      'Protect Password',
      'Unlock PDF',
      'Page Numbers',
      'PDF to Images',
      'Images to PDF',
      'Markdown Workspace',
      'PDF to Markdown',
    ]);
  });
});
