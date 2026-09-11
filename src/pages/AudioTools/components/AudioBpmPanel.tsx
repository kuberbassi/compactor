import React from 'react';
import { Disc3, Gauge } from 'lucide-react';
import { CustomAudioPlayer } from '../../../components/Common/CustomAudioPlayer';
import type { AudioAnalysisResult } from '../../../utils/audioAnalysis';
import { formatBytes } from '../../../utils/image';
import { AudioEditorFrame } from './AudioEditorFrame';

export interface AudioBpmPanelProps {
  file: File;
  analyzingBpm: boolean;
  analysisResult: AudioAnalysisResult | null;
  previewUrl: string | null;
  onReset: () => void;
  activeTool: string;
  onSelectTool: (toolId: string) => void;
}

export const AudioBpmPanel: React.FC<AudioBpmPanelProps> = ({
  file, analyzingBpm, analysisResult, previewUrl, onReset, activeTool, onSelectTool,
}) => (
  <AudioEditorFrame
    file={file}
    activeTool={activeTool}
    onSelectTool={onSelectTool}
    onChangeFile={onReset}
    className="audio-analysis-editor"
    controls={
      <section className="audio-analysis-controls" aria-label="Analysis status">
        <div className="audio-analysis-status">
          <span className="audio-section-label">Track analysis</span>
          <strong aria-live="polite">{analyzingBpm ? 'Analyzing…' : analysisResult ? 'Ready' : 'Waiting'}</strong>
        </div>
        <p>Tempo, key and Camelot code appear in the preview.</p>
      </section>
    }
  >
    <section className="audio-analysis-preview" aria-live="polite">
      {analyzingBpm ? (
        <div className="audio-preview-empty">
          <span className="audio-analysis-spinner" aria-hidden="true" />
          <strong>Analyzing track</strong>
          <p>Finding the tempo and musical key.</p>
        </div>
      ) : analysisResult ? (
        <>
          <div className="audio-preview-heading">
            <div><span>Track analysis</span><h2>Key and tempo</h2></div>
            <Disc3 aria-hidden="true" />
          </div>
          <div className="audio-analysis-results">
            <article><span>Tempo</span><strong>{analysisResult.bpm}</strong><small>BPM</small></article>
            <article><span>Musical key</span><strong>{analysisResult.key}</strong><small>Detected tonality</small></article>
            <article><span>Camelot</span><strong>{analysisResult.camelot}</strong><small>Harmonic mixing code</small></article>
            <article><span>Scale</span><strong>{analysisResult.mode}</strong><small>{analysisResult.sampleRate} Hz source</small></article>
          </div>
        </>
      ) : (
        <div className="audio-preview-empty"><Gauge aria-hidden="true" /><strong>Preparing analysis</strong><p>The result will appear here when ready.</p></div>
      )}
      {previewUrl ? <CustomAudioPlayer className="audio-preview-player" src={previewUrl} title={file.name} subtitle={`${file.name.split('.').pop()?.toUpperCase()} Audio Track · ${formatBytes(file.size)}`} /> : null}
    </section>
  </AudioEditorFrame>
);
