import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dashboard } from '../pages/Dashboard';
import { TOOL_ROUTES, pathForTool } from '../config/toolRoutes';
import { TOOLS } from '../pages/Dashboard/data';

describe('Dashboard Component', () => {
  it('renders the product headline and privacy positioning', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    expect(screen.getByRole('heading', { name: /Edit, convert,.*and keep control/i })).toBeInTheDocument();
  });

  it('shows popular tools first and expands the complete library on request', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    expect(screen.getByText('Compress a video')).toBeInTheDocument();
    expect(screen.queryByText('Organize Pages')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View all/i }));
    expect(screen.getByText('Organize Pages')).toBeInTheDocument();
    expect(screen.getByText('Merge PDF')).toBeInTheDocument();
    expect(screen.getByText('Edit PDF')).toBeInTheDocument();
    expect(screen.getByText('Markdown to PDF')).toBeInTheDocument();
  });

  it('keeps one working homepage card for every public tool route', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    fireEvent.click(screen.getByRole('button', { name: /View all/i }));

    expect(new Set(TOOLS.map(tool => tool.id))).toEqual(new Set(TOOL_ROUTES.map(route => route.id)));
    const cardDestinations = new Set(Array.from(document.querySelectorAll<HTMLAnchorElement>('.tool-card-v2'), card => card.getAttribute('href')));
    TOOL_ROUTES.forEach(route => expect(cardDestinations.has(pathForTool(route.id))).toBe(true));
  });

  it('triggers onSelectTool when a tool card is clicked', () => {
    const handleSelectTool = vi.fn();
    render(<Dashboard onSelectTool={handleSelectTool} processedCount={{ count: 1500000, scope: 'global' }} />);
    fireEvent.click(screen.getByText('Compress a video').closest('a')!);
    expect(handleSelectTool).toHaveBeenCalledWith('video-compressor');
  });

  it('filters tools when a category tab is clicked', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    fireEvent.click(screen.getByRole('button', { name: /View all/i }));
    const pdfButtons = screen.getAllByRole('button', { name: /PDF/i });
    fireEvent.click(pdfButtons[0]);
    expect(screen.getByText('Organize Pages')).toBeInTheDocument();
    expect(screen.getByText('Edit PDF')).toBeInTheDocument();
    expect(screen.getByText('Markdown to PDF')).toBeInTheDocument();
  });

  it('finds tools by action aliases and opens the top result with Enter', () => {
    const handleSelectTool = vi.fn();
    render(<Dashboard onSelectTool={handleSelectTool} processedCount={{ count: 1500000, scope: 'global' }} />);
    const search = screen.getByRole('searchbox', { name: /Search all tools/i });
    fireEvent.change(search, { target: { value: 'add text to pdf' } });
    expect(screen.getByText('Edit PDF')).toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(handleSelectTool).toHaveBeenCalledWith('pdf-edit');
  });

  it('recovers from close spelling mistakes and explains the smart match', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    fireEvent.change(screen.getByRole('searchbox', { name: /Search all tools/i }), { target: { value: 'imgae comrpessor' } });
    expect(screen.getByRole('heading', { name: 'Image Compressor' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Closest match: Image Compressor');
  });
});
