import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dashboard } from '../pages/Dashboard';

describe('Dashboard Component', () => {
  it('renders the product headline and privacy positioning', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    expect(screen.getByText(/Your private file workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Every file.*Under control/i })).toBeInTheDocument();
  });

  it('shows popular tools first and expands the complete library on request', () => {
    render(<Dashboard onSelectTool={vi.fn()} processedCount={{ count: 1500000, scope: 'global' }} />);
    expect(screen.getByText('Compress a video')).toBeInTheDocument();
    expect(screen.queryByText('Page Organizer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View all/i }));
    expect(screen.getByText('Page Organizer')).toBeInTheDocument();
    expect(screen.getByText('Merge PDF')).toBeInTheDocument();
    expect(screen.getByText('Edit PDF')).toBeInTheDocument();
    expect(screen.getByText('Markdown Workspace')).toBeInTheDocument();
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
    expect(screen.getByText('Page Organizer')).toBeInTheDocument();
    expect(screen.getByText('Edit PDF')).toBeInTheDocument();
    expect(screen.getByText('Markdown Workspace')).toBeInTheDocument();
  });
});
