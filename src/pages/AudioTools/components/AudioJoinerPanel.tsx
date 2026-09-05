import React from 'react';
import { Layers, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { FileUploader } from '../../../components/Common/FileUploader';
import { formatBytes } from '../../../utils/image';

export interface AudioJoinerPanelProps {
  joinFiles: File[];
  setJoinFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onFilesSelected: (files: File[]) => void;
  onRunJoin: () => void;
}

export const AudioJoinerPanel: React.FC<AudioJoinerPanelProps> = ({
  joinFiles,
  setJoinFiles,
  onFilesSelected,
  onRunJoin,
}) => {
  return (
    <div className="audio-mode-workbench audio-joiner-workbench w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
      {joinFiles.length === 0 ? (
        <FileUploader
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus"
          multiple={true}
          label="Select multiple audio tracks to combine"
          subLabel="Arrange tracks in custom sequence & join without quality degradation"
          onFilesSelected={onFilesSelected}
          maxSizeMB={150}
        />
      ) : (
        <div className="audio-append-box mb-3">
          <FileUploader
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus"
            multiple={true}
            label="Append more tracks to merge"
            subLabel="Supported: MP3, WAV, M4A, FLAC, OGG, AAC, OPUS"
            onFilesSelected={onFilesSelected}
            maxSizeMB={150}
            compact={true}
          />
        </div>
      )}

      {joinFiles.length > 0 && (
        <Card className="audio-editor-panel audio-joiner-panel border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-6 space-y-4 sm:space-y-5 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Audio Queue ({joinFiles.length} Tracks)
            </span>
            <Button variant="ghost" onClick={() => setJoinFiles([])} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold cursor-pointer">
              Clear All
            </Button>
          </div>

          <div className="audio-joiner-queue space-y-2 max-h-64 overflow-y-auto pr-1">
            {joinFiles.map((f, idx) => (
              <div key={idx} className="audio-joiner-track flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 border border-[var(--border-color)] text-xs text-[var(--text-primary)] min-w-0 gap-2">
                <div className="flex items-center gap-2 sm:gap-3 truncate flex-1 min-w-0 pr-1">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <span className="truncate font-semibold text-xs block max-w-[140px] xs:max-w-xs">{f.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono block sm:hidden">{formatBytes(f.size)}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0 hidden sm:inline">{formatBytes(f.size)}</span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {idx > 0 && (
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const copy = [...joinFiles];
                        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                        setJoinFiles(copy);
                      }}
                      className="h-7 w-7 text-zinc-400 hover:text-white cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {idx < joinFiles.length - 1 && (
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const copy = [...joinFiles];
                        [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                        setJoinFiles(copy);
                      }}
                      className="h-7 w-7 text-zinc-400 hover:text-white cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => setJoinFiles(joinFiles.filter((_, i) => i !== idx))}
                    className="h-7 w-7 text-zinc-500 hover:text-rose-400 cursor-pointer"
                    title="Remove Track"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={onRunJoin} 
            disabled={joinFiles.length < 2}
            className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-4 h-4 mr-2" />
            <span>Merge {joinFiles.length} Audio Tracks</span>
          </Button>
        </Card>
      )}
    </div>
  );
};

