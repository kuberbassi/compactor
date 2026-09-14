import { useState, useRef, useEffect } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { readMediaMetadata, writeMediaMetadata } from '../../utils/ffmpeg';
import type { MetadataTags } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { getFileFormatLabel } from '../../utils/conversionCapabilities';
import { 
  RefreshCw,
  CheckCircle, Tag as TagIcon,
  Image as ImageIcon,
  Trash2,
  FileText,
  Music
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ToolModeSwitcher } from '../../components/Common/ToolModeSwitcher';
import { ErrorBanner } from '../../components/Common/ErrorBanner';
import { ResultDownloadButton } from '../../components/Common/ResultDownloadButton';

export function MetadataEditor({ onGoHome, onSelectTool = () => undefined, onUploadSuccess }: { onGoHome: () => void; onSelectTool?: (toolId: string) => void; onUploadSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; name: string } | null>(null);

  // Form fields
  const [tags, setTags] = useState<MetadataTags>({
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: '',
    comment: ''
  });

  // Cover image states
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState<boolean>(false);
  
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Object URL & FFmpeg cleanup on unmount/change
  useEffect(() => {
    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
      if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [coverUrl, newCoverPreview, result?.url]);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(f);
    setResult(null);
    setNewCoverFile(null);
    setNewCoverPreview(null);
    setCoverUrl(null);
    setCoverBlob(null);
    setRemoveCover(false);
    setReading(true);

    try {
      const readResult = await readMediaMetadata(f, setStatusText);
      setTags({
        title: readResult.tags.title || f.name.replace(/\.[^/.]+$/, ""),
        artist: readResult.tags.artist || '',
        album: readResult.tags.album || '',
        year: readResult.tags.year || '',
        genre: readResult.tags.genre || '',
        comment: readResult.tags.comment || ''
      });
      if (readResult.coverUrl) {
        setCoverUrl(readResult.coverUrl);
        setCoverBlob(readResult.coverBlob);
      }
    } catch (e) {
      console.error(e);
      setTags({
        title: f.name.replace(/\.[^/.]+$/, ""),
        artist: '',
        album: '',
        year: '',
        genre: '',
        comment: ''
      });
    } finally {
      setReading(false);
    }
  };

  const handleCoverClick = () => {
    if (coverInputRef.current) {
      coverInputRef.current.click();
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewCoverFile(file);
      setRemoveCover(false);
      if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
      const url = URL.createObjectURL(file);
      setNewCoverPreview(url);
    }
  };

  const handleRemoveCoverToggle = () => {
    setRemoveCover(!removeCover);
    if (!removeCover) {
      if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
      setNewCoverFile(null);
      setNewCoverPreview(null);
    }
  };

  const saveMetadata = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setStatusText('Compiling metadata changes...');

    try {
      const coverToUse = removeCover ? null : (newCoverFile || coverBlob || null);
      const res = await writeMediaMetadata(
        file,
        tags,
        coverToUse,
        (msg) => setStatusText(msg),
        (prog) => setProgress(prog)
      );

      setResult(res);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage('Error updating metadata: ' + (e.message || e));
    } finally {
      setProcessing(false);
    }
  };

  const clearAllFields = () => {
    setTags({
      title: '',
      artist: '',
      album: '',
      year: '',
      genre: '',
      comment: ''
    });
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setTags({
      title: '',
      artist: '',
      album: '',
      year: '',
      genre: '',
      comment: ''
    });
    setCoverUrl(null);
    setCoverBlob(null);
    setNewCoverFile(null);
    setNewCoverPreview(null);
    setRemoveCover(false);
  };

  const isAudioFile = file ? file.type.startsWith('audio/') || ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus'].some(ext => file.name.toLowerCase().endsWith(ext)) : false;
  const fileFormat = file ? getFileFormatLabel(file) : '';

  return (
    <div className={`tool-layout metadata-tool-layout ${file || result || processing || reading ? 'has-active-session' : 'is-empty-session'}`}>
      <ToolHeader 
        title="File Details"
        description="Edit titles, artist tags, album details, and artwork directly in your browser with zero server uploads." 
        icon={TagIcon} 
        fileName={file?.name || result?.name}
        fileMeta={file ? `${formatBytes(file.size)} · ${fileFormat}` : result ? formatBytes(result.blob.size) : undefined}
        actions={!processing && !reading && !result ? <ToolModeSwitcher
          label="File tools"
          activeId="metadata-editor"
          options={[
            { id: 'universal-converter', label: 'Convert' },
            { id: 'metadata-editor', label: 'Details' },
          ]}
          onSelect={onSelectTool}
        /> : undefined}
        onGoHome={() => {
          if (file || result || processing || reading) {
            reset();
          } else {
            onGoHome();
          }
        }} 
      />

      {reading && (
        <div className="tool-processing-stage">
          <ProgressBar progress={50} statusText="Reading file tags & artwork..." subText="Extracting media headers client-side" />
        </div>
      )}

      {processing && (
        <div className="tool-processing-stage">
          <ProgressBar progress={progress} statusText={statusText} subText="Rebuilding file containers with updated tags" />
        </div>
      )}

      {/* Upload Zone */}
      {!file && !reading && !processing && (
        <div className="tool-upload-frame max-w-2xl mx-auto py-6">
          <FileUploader
            accept="audio/*,video/*,image/*"
            onFilesSelected={handleFileSelected}
            label="Upload media file to inspect & edit metadata"
            subLabel="Drag & drop MP3, M4A, FLAC, WAV, MP4, MOV, PNG, JPG files"
          />
        </div>
      )}

      {/* Editor Panel */}
      {file && !reading && !processing && !result && (
        <div className="image-workbench flex-1 flex h-full overflow-hidden bg-[#111216]">
          {/* Left Sidebar Rail */}
          <aside className="image-workbench__sidebar w-[18.5rem] bg-[#18191e] border-r border-white/10 flex flex-col shrink-0 h-full overflow-hidden">
            <div className="h-11 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-transparent">
              <span className="text-xs font-bold text-white uppercase tracking-wider">File & Artwork</span>
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-zinc-300 font-mono">{fileFormat}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center space-y-4">
              {/* Cover Art Box (visible for audio formats) */}
              {isAudioFile ? (
                <div className="flex flex-col items-center space-y-3 w-full">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Album Cover Art</span>
                  
                  <div 
                    onClick={handleCoverClick}
                    className="w-36 h-36 border border-dashed border-white/20 bg-zinc-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-white/40 group relative transition-colors shadow-inner"
                  >
                    {!removeCover && newCoverPreview ? (
                      <img src={newCoverPreview} alt="New cover" className="w-full h-full object-cover" />
                    ) : !removeCover && coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-zinc-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 group-hover:scale-105 transition-transform text-zinc-400" />
                        <span className="text-[10px] font-bold block text-zinc-400">Click to upload</span>
                        <span className="text-[9px] text-zinc-600 block">JPG or PNG</span>
                      </div>
                    )}
                    <input 
                      ref={coverInputRef} 
                      type="file" 
                      accept="image/jpeg,image/png" 
                      className="hidden" 
                      onChange={handleCoverFileChange} 
                    />
                  </div>

                  <div className="flex gap-2 w-full max-w-[144px]">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleCoverClick} 
                      className="flex-1 text-xs h-8 px-2 font-bold border-white/10 hover:border-white/30 rounded-xl cursor-pointer text-white"
                    >
                      Change
                    </Button>
                    {(coverUrl || newCoverPreview) && !removeCover && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={handleRemoveCoverToggle} 
                        className="text-rose-400 hover:text-rose-300 text-xs h-8 px-2 font-bold rounded-xl cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-3 w-full">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
                    <TagIcon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white block">Standard Metadata</span>
                    <p className="text-[10px] text-zinc-400">Custom embedded tags for {fileFormat} stream.</p>
                  </div>
                </div>
              )}

              <div className="w-full bg-zinc-950/50 border border-white/10 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>File Name</span>
                  <span className="text-white font-medium truncate max-w-[140px]">{file.name}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Size</span>
                  <span className="text-white font-medium">{formatBytes(file.size)}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Type</span>
                  <span className="text-white font-medium">{fileFormat}</span>
                </div>
              </div>
            </div>

            {/* Bottom Action Button */}
            <div className="p-3.5 border-t border-white/10 bg-[#18191e] mt-auto shrink-0">
              <button
                type="button"
                onClick={saveMetadata}
                className="workspace-primary-action w-full h-11 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>Save File</span>
                <span className="text-sm font-black">→</span>
              </button>
            </div>
          </aside>

          {/* Right Main Stage */}
          <main className="image-workbench__main flex-1 bg-[#111216] flex flex-col h-full overflow-y-auto p-6">
            <div className="max-w-2xl w-full mx-auto space-y-5">
              {errorMessage && (
                <ErrorBanner 
                  message={errorMessage} 
                  onDismiss={() => setErrorMessage(null)} 
                  onRetry={saveMetadata} 
                />
              )}

              <div className="bg-[#18191e] border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="border-b border-white/10 pb-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Music className="w-4 h-4 text-zinc-400" />
                      Container Properties
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Edit metadata attributes before compiling your output file.</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAllFields}
                    className="text-[11px] font-semibold text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear fields
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Track / Media Title</label>
                    <Input 
                      value={tags.title || ''} 
                      onChange={e => setTags({ ...tags, title: e.target.value })} 
                      placeholder="e.g. Symphony No. 5" 
                      className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Artist / Creator</label>
                      <Input 
                        value={tags.artist || ''} 
                        onChange={e => setTags({ ...tags, artist: e.target.value })} 
                        placeholder="e.g. Ludwig van Beethoven" 
                        className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Album / Collection</label>
                      <Input 
                        value={tags.album || ''} 
                        onChange={e => setTags({ ...tags, album: e.target.value })} 
                        placeholder="e.g. Classical Masterpieces" 
                        className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Release Year</label>
                      <Input 
                        value={tags.year || ''} 
                        onChange={e => setTags({ ...tags, year: e.target.value })} 
                        placeholder="e.g. 1808" 
                        className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Genre</label>
                      <Input 
                        value={tags.genre || ''} 
                        onChange={e => setTags({ ...tags, genre: e.target.value })} 
                        placeholder="e.g. Classical" 
                        className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Comment / Notes</label>
                    <Input 
                      value={tags.comment || ''} 
                      onChange={e => setTags({ ...tags, comment: e.target.value })} 
                      placeholder="e.g. Remastered 2026" 
                      className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Done Screen */}
      {result && !reading && !processing && (
        <div className="max-w-md mx-auto py-10 px-4">
          <Card className="border border-white/10 bg-[#18191e] shadow-2xl text-center p-8 space-y-6 rounded-2xl">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">Metadata Processed!</h3>
              <p className="text-xs text-zinc-400">Your updated file has been compiled cleanly without loss.</p>
            </div>

            <div className="p-4 bg-zinc-950/60 border border-white/10 rounded-2xl text-left truncate flex items-center gap-3.5">
              <div className="w-11 h-11 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-zinc-400">
                {(!removeCover && (newCoverPreview || coverUrl)) ? (
                  <img src={newCoverPreview || coverUrl || ''} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-white">{result.name}</span>
                <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
                  {formatBytes(result.blob.size)} &bull; {tags.title || 'No Title'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <ResultDownloadButton
                result={result}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-6 py-3 rounded-xl text-xs shadow-lg cursor-pointer transition-all active:scale-[0.98]"
              >
                Download File
              </ResultDownloadButton>
              <Button 
                onClick={reset} 
                variant="outline" 
                className="rounded-xl h-11 text-xs font-bold border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Edit Another File
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
