import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../components/Common/CommandPalette';

describe('CommandPalette', () => {
  it('finds tools using plain-language aliases', () => {
    render(<CommandPalette open onClose={() => undefined} onSelectTool={() => undefined} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tools and actions' }), { target: { value: 'make pdf uneditable' } });
    const matchingButtons = screen.getAllByRole('button', { name: /Flatten PDF/i });
    expect(matchingButtons.length).toBeGreaterThanOrEqual(1);
    expect(matchingButtons[0]).toBeInTheDocument();
  });

  it('opens the first result with Enter', () => {
    const onSelectTool = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onSelectTool={onSelectTool} />);
    const search = screen.getByRole('searchbox', { name: 'Search tools and actions' });
    fireEvent.change(search, { target: { value: 'remove location' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelectTool).toHaveBeenCalledWith('metadata-editor');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onSelectTool={() => undefined} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
