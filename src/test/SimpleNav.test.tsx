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

  it('opens a tool family in one click without a desktop dropdown', () => {
    const handleLinkClick = vi.fn();
    render(<SimpleNav onLinkClick={handleLinkClick} />);

    fireEvent.click(screen.getByRole('button', { name: /^pdf/i }));
    expect(handleLinkClick).toHaveBeenCalledWith('pdf-edit');
  });

  it('does not render duplicate desktop dropdown tool lists', () => {
    render(<SimpleNav />);
    expect(document.querySelector('[data-nav-group-items="pdf"]')).not.toBeInTheDocument();
  });
});
