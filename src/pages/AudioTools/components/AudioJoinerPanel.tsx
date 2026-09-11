import React from 'react';
import { ArrowDown, ArrowUp, Layers, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FileUploader } from '../../../components/Common/FileUploader';
import { formatBytes } from '../../../utils/image';
import { AudioEditorFrame } from './AudioEditorFrame';

export interface AudioJoinerPanelProps {
  file: File;
  joinFiles: File[];
  setJoinFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onFilesSelected: (files: File[]) => void;
  onRunJoin: () => void;
  onReset: () => void;
  activeTool: string;
  onSelectTool: (toolId: string) => void;
}

export const AudioJoinerPanel: React.FC<AudioJoinerPanelProps> = ({
  file, joinFiles, setJoinFiles, onFilesSelected, onRunJoin, onReset, activeTool, onSelectTool,
}) => {
  const totalSize = joinFiles.reduce((total, track) => total + track.size, 0);
  const sequenceTitle = joinFiles.length === 0
    ? 'Select tracks to start a sequence'
    : joinFiles.length === 1
      ? 'Add one more track'
      : `${joinFiles.length} tracks ready to join`;
  const moveTrack = (index: number, direction: -1 | 1) => {
    const next = [...joinFiles];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setJoinFiles(next);
  };

  return (
    <AudioEditorFrame
      file={file}
      activeTool={activeTool}
      onSelectTool={onSelectTool}
      onChangeFile={onReset}
      className="audio-join-editor"
      controls={
        <section className="audio-join-controls">
          <div className="audio-join-controls__heading"><span className="audio-section-label">Track queue</span><strong>{joinFiles.length}</strong></div>
          <div className="audio-join-controls__list">
            {joinFiles.map((track, index) => (
              <article key={`${track.name}:${track.size}:${track.lastModified}:${index}`}>
                <span className="audio-queue-index">{index + 1}</span>
                <div><strong title={track.name}>{track.name}</strong><small>{formatBytes(track.size)}</small></div>
                <nav aria-label={`Reorder ${track.name}`}>
                  <button type="button" disabled={index === 0} onClick={() => moveTrack(index, -1)} aria-label="Move up"><ArrowUp /></button>
                  <button type="button" disabled={index === joinFiles.length - 1} onClick={() => moveTrack(index, 1)} aria-label="Move down"><ArrowDown /></button>
                  <button type="button" onClick={() => setJoinFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove track"><Trash2 /></button>
                </nav>
              </article>
            ))}
          </div>
        </section>
      }
      action={<Button type="button" disabled={joinFiles.length < 2} onClick={onRunJoin} className="audio-editor-primary-action">{joinFiles.length < 2 ? 'Join tracks' : `Join ${joinFiles.length} tracks`} <span>→</span></Button>}
    >
      <section className="audio-join-preview">
        <div className="audio-preview-heading">
          <div><span>Merge sequence</span><h2>{sequenceTitle}</h2></div>
          <Layers aria-hidden="true" />
        </div>
        <div className="audio-join-summary">
          <article><span>Tracks</span><strong>{joinFiles.length}</strong><small>In playback order</small></article>
          <article><span>Source size</span><strong>{formatBytes(totalSize)}</strong><small>Before joining</small></article>
        </div>
        <FileUploader
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus"
          multiple
          compact
          label={joinFiles.length ? 'Add another track' : 'Select audio tracks'}
          subLabel="Choose files or drop them here"
          onFilesSelected={onFilesSelected}
          maxSizeMB={150}
        />
      </section>
    </AudioEditorFrame>
  );
};
