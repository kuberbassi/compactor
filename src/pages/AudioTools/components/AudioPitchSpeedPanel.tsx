import React from 'react';
import { Minus, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { CustomAudioPlayer } from '../../../components/Common/CustomAudioPlayer';
import { CAMELOT_MAP } from '../../../utils/audioAnalysis';
import { formatBytes } from '../../../utils/image';
import { AudioEditorFrame } from './AudioEditorFrame';

export interface AudioPitchSpeedPanelProps {
  file: File;
  pitchSemitones: number;
  setPitchSemitones: (st: number | ((prev: number) => number)) => void;
  speedRatio: number;
  setSpeedRatio: (ratio: number | ((prev: number) => number)) => void;
  analyzingBpm: boolean;
  transposedKey: { root: string; mode: string; camelot?: string; baseCamelot?: string | null };
  currentBpm: number | null;
  baseKey?: string | null;
  baseBpm?: number | null;
  previewUrl: string | null;
  onReset: () => void;
  onRunProcess: () => void;
  activeTool: string;
  onSelectTool: (toolId: string) => void;
}

export const AudioPitchSpeedPanel: React.FC<AudioPitchSpeedPanelProps> = ({
  file, pitchSemitones, setPitchSemitones, speedRatio, setSpeedRatio, analyzingBpm,
  transposedKey, currentBpm, baseKey = null, baseBpm = null, previewUrl, onReset, onRunProcess, activeTool, onSelectTool,
}) => {
  const pitchLabel = `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`;
  const speedLabel = `${speedRatio.toFixed(2)}×`;
  const formattedMode = transposedKey.mode.charAt(0).toUpperCase() + transposedKey.mode.slice(1).toLowerCase();
  const liveKeyFull = `${transposedKey.root} ${formattedMode}`;
  const liveCamelot = transposedKey.camelot || CAMELOT_MAP[liveKeyFull] || null;
  const baseCamelot = transposedKey.baseCamelot || (baseKey ? CAMELOT_MAP[baseKey] || null : null);

  const keyTransitionDetail = analyzingBpm
    ? 'Analyzing key…'
    : baseKey && pitchSemitones !== 0
    ? `${baseKey} → ${liveKeyFull}`
    : `${transposedKey.root} ${transposedKey.mode}`;

  const bpmTransitionDetail = currentBpm
    ? baseBpm && Math.abs(speedRatio - 1) >= 0.01
      ? `${baseBpm} → ${currentBpm} BPM`
      : `${currentBpm} BPM`
    : analyzingBpm
    ? 'Analyzing BPM…'
    : 'Tempo preview';

  const camelotTransitionDetail = analyzingBpm
    ? 'Detecting tonality…'
    : baseCamelot && liveCamelot && pitchSemitones !== 0
    ? `Camelot ${baseCamelot} → ${liveCamelot}`
    : liveCamelot
    ? `Camelot ${liveCamelot}`
    : 'Harmonic notation';

  return (
    <AudioEditorFrame
      file={file}
      activeTool={activeTool}
      onSelectTool={onSelectTool}
      onChangeFile={onReset}
      className="audio-pitch-editor"
      controls={
        <div className="audio-adjustment-controls">
          <section>
            <div className="audio-control-label"><span>Pitch</span><strong>{pitchLabel}</strong></div>
            <div className="audio-stepper">
              <button type="button" onClick={() => setPitchSemitones(value => Math.max(-12, value - 1))} aria-label="Lower pitch"><Minus /></button>
              <input type="range" min="-12" max="12" step="1" value={pitchSemitones} onChange={event => setPitchSemitones(Number(event.target.value))} />
              <button type="button" onClick={() => setPitchSemitones(value => Math.min(12, value + 1))} aria-label="Raise pitch"><Plus /></button>
            </div>
            <div className="audio-choice-row">
              {[-12, -2, 0, 2, 12].map(value => <button key={value} type="button" onClick={() => setPitchSemitones(value)} aria-pressed={pitchSemitones === value}>{value > 0 ? `+${value}` : value}</button>)}
            </div>
          </section>
          <section>
            <div className="audio-control-label"><span>Speed</span><strong>{speedLabel}</strong></div>
            <div className="audio-stepper">
              <button type="button" onClick={() => setSpeedRatio(value => Math.max(0.5, Math.round((value - .05) * 100) / 100))} aria-label="Slow down"><Minus /></button>
              <input type="range" min="0.5" max="2" step=".05" value={speedRatio} onChange={event => setSpeedRatio(Number(event.target.value))} />
              <button type="button" onClick={() => setSpeedRatio(value => Math.min(2, Math.round((value + .05) * 100) / 100))} aria-label="Speed up"><Plus /></button>
            </div>
            <div className="audio-choice-row">
              {[.5, .75, 1, 1.25, 1.5, 2].map(value => <button key={value} type="button" onClick={() => setSpeedRatio(value)} aria-pressed={Math.abs(speedRatio - value) < .01}>{value}×</button>)}
            </div>
          </section>
          <button type="button" className="audio-reset-adjustments" onClick={() => { setPitchSemitones(0); setSpeedRatio(1); }}><RotateCcw /> Reset adjustments</button>
        </div>
      }
      action={<Button type="button" onClick={onRunProcess} className="audio-editor-primary-action">Apply changes <span>→</span></Button>}
    >
      <section className="audio-pitch-preview">
        <div className="audio-preview-heading">
          <div><span>Live settings</span><h2>Preview the transformed track</h2></div>
          <SlidersHorizontal aria-hidden="true" />
        </div>
        <div className="audio-transform-summary">
          <article><span>Pitch</span><strong>{pitchLabel}</strong><small>{keyTransitionDetail}</small></article>
          <article><span>Speed</span><strong>{speedLabel}</strong><small>{bpmTransitionDetail}</small></article>
          <article><span>Live key</span><strong>{analyzingBpm ? 'Analyzing…' : liveKeyFull}</strong><small>{camelotTransitionDetail}</small></article>
          <article><span>Live tempo</span><strong>{currentBpm ? `${currentBpm} BPM` : analyzingBpm ? 'Analyzing…' : '—'}</strong><small>{baseBpm ? `Source ${baseBpm} BPM` : 'Real-time BPM'}</small></article>
        </div>
        {previewUrl ? (
          <CustomAudioPlayer
            className="audio-preview-player"
            src={previewUrl}
            file={file}
            title={file.name}
            subtitle={`${pitchLabel} · ${speedLabel} speed · ${formatBytes(file.size)}`}
            pitchSemitones={pitchSemitones}
            speedRatio={speedRatio}
            liveKey={analyzingBpm ? null : liveKeyFull}
            liveCamelot={analyzingBpm ? null : liveCamelot}
            liveBpm={currentBpm}
          />
        ) : null}
      </section>
    </AudioEditorFrame>
  );
};

