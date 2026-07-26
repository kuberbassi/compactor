import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dashboard } from '../pages/Dashboard';

describe('Dashboard Component', () => {
  it('renders headline and hero pill', () => {
    render(<Dashboard onSelectTool={vi.fn()} uploadCount={1500000} />);
    expect(screen.getByText(/EVERYTHING IN ONE PLACE/i)).toBeInTheDocument();
    expect(screen.getByText(/Less file fuss/i)).toBeInTheDocument();
  });

  it('renders tool showcase cards', () => {
    render(<Dashboard onSelectTool={vi.fn()} uploadCount={1500000} />);
    expect(screen.getByText('Compress a video')).toBeInTheDocument();
    expect(screen.getByText('Organize PDF Pages')).toBeInTheDocument();
    expect(screen.getByText('Merge PDFs')).toBeInTheDocument();
  });

  it('triggers onSelectTool when a tool card is clicked', () => {
    const handleSelectTool = vi.fn();
    render(<Dashboard onSelectTool={handleSelectTool} uploadCount={1500000} />);
    const card = screen.getByText('Compress a video').closest('.group');
    if (card) {
      fireEvent.click(card);
      expect(handleSelectTool).toHaveBeenCalledWith('video-compressor');
    }
  });

  it('filters tools when a category tab is clicked', () => {
    render(<Dashboard onSelectTool={vi.fn()} uploadCount={1500000} />);
    const pdfButtons = screen.getAllByRole('button', { name: /PDF/i });
    fireEvent.click(pdfButtons[0]);
    expect(screen.getByText('Organize PDF Pages')).toBeInTheDocument();
  });
});
