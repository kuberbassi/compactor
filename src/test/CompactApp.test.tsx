import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompactApp } from '../compact/CompactApp';
import { COMPACT_TOOLS } from '../compact/compactTools';
import { routeForTool } from '../config/toolRoutes';

describe('CompactApp', () => {
  it('keeps every compact capability tied to a canonical route', () => {
    expect(COMPACT_TOOLS.length).toBeGreaterThan(0);
    COMPACT_TOOLS.forEach(tool => expect(routeForTool(tool.id)).toEqual(tool.route));
    expect(new Set(COMPACT_TOOLS.map(tool => tool.id)).size).toBe(COMPACT_TOOLS.length);
  });

  it('renders the compact home and selects a supported tool', () => {
    const onSelectTool = vi.fn();
    render(<CompactApp activeToolId={null} onGoHome={() => undefined} onSelectTool={onSelectTool} />);

    expect(screen.getByRole('heading', { name: /quick file work/i })).toBeInTheDocument();
    expect(screen.queryByText('Recent', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /audio tools/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /image compressor/i }));
    expect(onSelectTool).toHaveBeenCalledWith('image-optimizer');
  });

  it('offers typo-tolerant search over real compact workflows', () => {
    const onSelectTool = vi.fn();
    render(<CompactApp activeToolId={null} onGoHome={() => undefined} onSelectTool={onSelectTool} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search phone tools' }), { target: { value: 'wrod to pdf' } });
    expect(screen.getByRole('button', { name: /Word to PDF Converter/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Closest match: Word to PDF Converter');
  });

  it('shows the working compact compressor for a phase-three route', () => {
    render(<CompactApp activeToolId="pdf-compress" onGoHome={() => undefined} onSelectTool={() => undefined} />);

    expect(screen.getByRole('heading', { name: /compress pdfs in a simple queue/i })).toBeInTheDocument();
    expect(screen.getByText(/files never leave this device/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add pdf files/i })).toBeEnabled();
  });

  it('offers compact alternatives for a desktop-only route', () => {
    render(<CompactApp activeToolId="pdf-edit" onGoHome={() => undefined} onSelectTool={() => undefined} />);

    expect(screen.getByRole('heading', { name: /edit pdf needs a larger editing workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /try a compact alternative/i })).toBeInTheDocument();
  });

  it('renders the compact media queue without loading an editor workspace', () => {
    render(<CompactApp activeToolId="audio-optimizer" onGoHome={() => undefined} onSelectTool={() => undefined} />);
    expect(screen.getByRole('heading', { name: /compress audio without the editor layout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add audio files/i })).toBeEnabled();
    expect(screen.queryByText(/phase 4/i)).not.toBeInTheDocument();
  });

  it('renders the compact universal converter instead of a phase placeholder', () => {
    render(<CompactApp activeToolId="universal-converter" onGoHome={() => undefined} onSelectTool={() => undefined} />);
    expect(screen.getByRole('heading', { name: /choose files, then one shared output/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add files to convert/i })).toBeEnabled();
  });

  it('routes the dedicated Word converter entry to the compact converter engine', () => {
    render(<CompactApp activeToolId="convert-word-to-pdf" onGoHome={() => undefined} onSelectTool={() => undefined} />);
    expect(screen.getByRole('button', { name: /add files to convert/i })).toBeEnabled();
  });

  it('renders every phase-six PDF quick workflow', () => {
    const cases = [
      ['pdf-merge', /merge pdf/i],
      ['pdf-protect', /protect pdf/i],
      ['pdf-unlock', /unlock pdf/i],
      ['pdf-to-image', /pdf to images/i],
      ['pdf-jpg-to-pdf', /images to pdf/i],
      ['pdf-watermark', /watermark pdf/i],
      ['pdf-flatten', /flatten pdf/i],
    ] as const;
    for (const [id, heading] of cases) {
      const view = render(<CompactApp activeToolId={id} onGoHome={() => undefined} onSelectTool={() => undefined} />);
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('renders the compact audio utility pages', () => {
    for (const id of ['audio-joiner', 'audio-bpm-finder', 'audio-pitch-speed']) {
      const view = render(<CompactApp activeToolId={id} onGoHome={() => undefined} onSelectTool={() => undefined} />);
      expect(screen.getByText(/processing stays on this device/i)).toBeInTheDocument();
      view.unmount();
    }
  });
});
