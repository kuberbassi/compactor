import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompactAudioTool } from '../compact/CompactAudioTool';
import { compactToolForId } from '../compact/compactTools';

const playerProps = vi.hoisted(() => vi.fn());

vi.mock('../components/Common/CustomAudioPlayer', () => ({
  CustomAudioPlayer: (props: { pitchSemitones?: number; speedRatio?: number; title?: string }) => {
    playerProps(props);
    return <div data-testid="live-audio-player">{props.title}</div>;
  },
}));

vi.mock('../utils/audioAnalysis', () => ({
  analyzeAudioBPMAndKey: vi.fn(async () => ({ bpm: 78, key: 'E♭ Major', mode: 'Major', camelot: '5B', confidence: 14, sampleRate: 44100 })),
}));

const tool = (id: string) => compactToolForId(id)!;

describe('compact audio parity', () => {
  beforeEach(() => {
    playerProps.mockClear();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:audio-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('uses the shared live player with current pitch and speed settings', async () => {
    const { container } = render(<CompactAudioTool tool={tool('audio-pitch-speed')} onGoHome={() => undefined} onProcessed={() => undefined} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })] } });
    expect(await screen.findByTestId('live-audio-player')).toBeInTheDocument();
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '3' } });
    fireEvent.change(sliders[1], { target: { value: '1.25' } });
    await waitFor(() => expect(playerProps).toHaveBeenLastCalledWith(expect.objectContaining({ pitchSemitones: 3, speedRatio: 1.25 })));
  });

  it('matches the desktop key result fields and omits confidence', async () => {
    const { container } = render(<CompactAudioTool tool={tool('audio-bpm-finder')} onGoHome={() => undefined} onProcessed={() => undefined} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })] } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /analyze key & bpm/i })); });
    expect(await screen.findByText('78')).toBeInTheDocument();
    expect(screen.getByText('E♭ Major')).toBeInTheDocument();
    expect(screen.getByText('5B')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });
});
