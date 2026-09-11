import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AudioBpmPanel } from '../pages/AudioTools/components/AudioBpmPanel';
import { AudioPitchSpeedPanel } from '../pages/AudioTools/components/AudioPitchSpeedPanel';
import { TrimTimeline } from '../components/Common/TrimTimeline';

const sourceFile = new File(['audio'], 'source.opus', { type: 'audio/opus' });

function PitchHarness({ onRun = vi.fn(), onMode = vi.fn() }) {
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1);
  return (
    <AudioPitchSpeedPanel
      file={sourceFile}
      pitchSemitones={pitch}
      setPitchSemitones={setPitch}
      speedRatio={speed}
      setSpeedRatio={setSpeed}
      analyzingBpm={false}
      transposedKey={{ root: 'C', mode: 'Major' }}
      currentBpm={120}
      previewUrl={null}
      onReset={vi.fn()}
      onRunProcess={onRun}
      activeTool="audio-pitch-speed"
      onSelectTool={onMode}
    />
  );
}

describe('Audio editor panels', () => {
  it('hides timeline fades for Audio and emits no duplicate fade flags', () => {
    const onChange = vi.fn();
    render(
      <TrimTimeline
        duration={60}
        currentTime={0}
        onSeek={vi.fn()}
        onChange={onChange}
        showFadeControls={false}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Audio fade controls' })).not.toBeInTheDocument();
    const [segments] = onChange.mock.calls.at(-1) ?? [];
    expect(segments?.[0]).not.toHaveProperty('fadeIn');
    expect(segments?.[0]).not.toHaveProperty('fadeOut');
  });

  it('updates and resets pitch and speed controls', () => {
    render(<PitchHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Raise pitch' }));
    expect(screen.getAllByText('+1 st').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '2×' }));
    expect(screen.getAllByText('2.00×').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset adjustments' }));
    expect(screen.getAllByText('0 st').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.00×').length).toBeGreaterThan(0);
  });

  it('runs processing and switches modes from the shared navigation', () => {
    const onRun = vi.fn();
    const onMode = vi.fn();
    render(<PitchHarness onRun={onRun} onMode={onMode} />);

    fireEvent.click(screen.getByRole('button', { name: /Apply changes/i }));
    expect(onRun).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Key & BPM' }));
    expect(onMode).toHaveBeenCalledWith('audio-bpm-finder');
  });

  it('shows a compact ready status and analysis results', () => {
    render(
      <AudioBpmPanel
        file={sourceFile}
        analyzingBpm={false}
        analysisResult={{ bpm: 120, key: 'C Major', camelot: '8B', confidence: 94, mode: 'Major', sampleRate: 48000, duration: 60 }}
        previewUrl={null}
        onReset={vi.fn()}
        activeTool="audio-bpm-finder"
        onSelectTool={vi.fn()}
      />,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('C Major')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('8B')).toBeInTheDocument();
    expect(screen.getByText('Camelot')).toBeInTheDocument();
    expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Size')).not.toBeInTheDocument();
  });
});
