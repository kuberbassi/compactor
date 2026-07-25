import { useState, useRef, useEffect } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { readMediaMetadata, writeMediaMetadata, stripMediaMetadata, terminateFFmpeg } from '../../utils/ffmpeg';
import type { MetadataTags } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { 
  PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiCheckCircleLight as CheckCircle, PiTagLight as TagIcon,
  PiImageLight as ImageIcon, PiArrowLeftLight as ArrowLeft,
  PiShieldCheckLight as ShieldIcon
} from 'react-icons/pi';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { ToolHeader } from '../../components/Common/ToolHeader';

export function MetadataEditor({ onGoHome, onUploadSuccess }: { onGoHome: () => void; onUploadSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
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

  // FFmpeg cleanup on unmount
  useEffect(() => {
    return () => {
      terminateFFmpeg().catch(() => {});
    };
  }, []);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
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
      const url = URL.createObjectURL(file);
      setNewCoverPreview(url);
    }
  };

  const handleRemoveCoverToggle = () => {
    setRemoveCover(!removeCover);
    if (!removeCover) {
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
      alert('Error updating metadata: ' + (e.message || e));
    } finally {
      setProcessing(false);
    }
  };

  const stripAllTags = async () => {
    if (!file) return;
    if (!confirm("Are you sure you want to strip all EXIF / ID3 metadata tags from this file for privacy?")) return;

    setProcessing(true);
    setProgress(0);
    setStatusText('Stripping all metadata tags...');

    try {
      const res = await stripMediaMetadata(
        file,
        (msg) => setStatusText(msg),
        (prog) => setProgress(prog)
      );

      setResult(res);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      alert('Error stripping metadata: ' + (e.message || e));
    } finally {
      setProcessing(false);
    }
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

  return (
    <div className="tool-layout">
      <ToolHeader 
        title="File Metadata Editor" 
        description="Edit titles, artist tags, album details, and artwork directly in your browser with zero server uploads." 
        icon={TagIcon} 
        onGoHome={() => {
          if (file || result || processing || reading) {
            reset();
          } else {
            onGoHome();
          }
        }} 
      />

      {reading && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={50} statusText="Reading file tags & artwork..." subText="Extracting media headers client-side" />
        </div>
      )}

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} subText="Rebuilding file containers with updated tags" />
        </div>
      )}

      {/* Upload Zone */}
      {!file && !reading && !processing && (
        <div className="max-w-2xl mx-auto py-6">
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
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm p-6 space-y-6">
            
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3 truncate min-w-0">
                <button onClick={reset} className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900 border border-zinc-800">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="truncate min-w-0">
                  <span className="block text-xs font-bold text-[var(--text-primary)] truncate">{file.name}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block font-medium">
                    {formatBytes(file.size)} &bull; {file.type || 'Media Asset'}
                  </span>
                </div>
              </div>

              {/* Strip All Metadata Action */}
              <Button
                onClick={stripAllTags}
                variant="outline"
                className="h-8 text-[11px] font-bold text-rose-400 hover:text-rose-300 border-rose-900/40 hover:bg-rose-950/30 rounded-lg flex items-center gap-1.5"
                title="Remove all EXIF and ID3 tags for privacy"
              >
                <ShieldIcon className="w-3.5 h-3.5" /> Strip All Tags
              </Button>
            </div>

            {/* Layout grid containing Cover Image and Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              
              {/* Cover Art Box (visible for audio formats) */}
              {isAudioFile ? (
                <div className="flex flex-col items-center space-y-3 bg-zinc-950/40 p-4 border border-[var(--border-color)] rounded-xl">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Album Cover Art</span>
                  
                  <div 
                    onClick={handleCoverClick}
                    className="w-36 h-36 border border-dashed border-[var(--border-color)] bg-zinc-950 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 group relative transition-colors shadow-inner"
                  >
                    {!removeCover && newCoverPreview ? (
                      <img src={newCoverPreview} alt="New cover" className="w-full h-full object-cover" />
                    ) : !removeCover && coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-zinc-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 group-hover:scale-105 transition-transform text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-300 block">
                          {removeCover ? 'Cover Removed' : 'Upload Cover'}
                        </span>
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[10px] text-white font-bold bg-zinc-900/90 border border-zinc-700 px-3 py-1 rounded-full">Change Image</span>
                    </div>
                  </div>

                  <input 
                    type="file" 
                    ref={coverInputRef}
                    onChange={handleCoverFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden" 
                  />

                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <Button
                      onClick={handleCoverClick}
                      variant="outline"
                      className="w-full h-7 text-[10px] font-bold border-[var(--border-color)] text-zinc-300"
                    >
                      Browse Cover Image
                    </Button>
                    {(coverUrl || newCoverPreview) && (
                      <button
                        onClick={handleRemoveCoverToggle}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold transition-colors mt-0.5"
                      >
                        {removeCover ? 'Restore Cover' : 'Remove Cover Art'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="md:col-span-3 text-xs text-zinc-300 bg-zinc-950/40 border border-[var(--border-color)] p-3.5 rounded-xl flex items-center gap-2">
                  <TagIcon className="w-4 h-4 text-zinc-400" />
                  <span>Media tags are saved directly into the header metadata streams of your file.</span>
                </div>
              )}

              {/* Input Forms */}
              <div className={`space-y-4 ${isAudioFile ? 'md:col-span-2' : 'md:col-span-3'}`}>
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Title / Track Name</label>
                  <Input 
                    value={tags.title || ''} 
                    onChange={e => setTags({ ...tags, title: e.target.value })} 
                    placeholder="Track or Asset Title"
                    className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-semibold"
                  />
                </div>

                {/* Artist */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Artist / Creator</label>
                  <Input 
                    value={tags.artist || ''} 
                    onChange={e => setTags({ ...tags, artist: e.target.value })} 
                    placeholder="Artist, Band, or Author"
                    className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                  />
                </div>

                {/* Album */}
                {isAudioFile && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Album Name</label>
                    <Input 
                      value={tags.album || ''} 
                      onChange={e => setTags({ ...tags, album: e.target.value })} 
                      placeholder="Album or Collection Title"
                      className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Year */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Release Year</label>
                    <Input 
                      value={tags.year || ''} 
                      onChange={e => setTags({ ...tags, year: e.target.value })} 
                      placeholder="e.g. 2026"
                      className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>

                  {/* Genre */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Genre</label>
                    <Input 
                      value={tags.genre || ''} 
                      onChange={e => setTags({ ...tags, genre: e.target.value })} 
                      placeholder="e.g. Electronic, Synthwave, Classical"
                      className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Comment */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Description / Comment</label>
                  <Input 
                    value={tags.comment || ''} 
                    onChange={e => setTags({ ...tags, comment: e.target.value })} 
                    placeholder="Notes, copyright, or metadata description"
                    className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-color)]">
              <Button onClick={reset} variant="outline" className="flex-1 rounded-full h-10 text-xs border-[var(--border-color)]">
                Reset Form
              </Button>
              <Button 
                onClick={saveMetadata} 
                className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-10 text-xs cursor-pointer shadow-sm"
              >
                Save Metadata Tags
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Done Screen */}
      {result && !reading && !processing && (
        <div className="max-w-md mx-auto py-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-[var(--text-primary)]">Metadata Processed!</h3>
              <p className="text-xs text-[var(--text-secondary)]">Your updated file has been compiled cleanly.</p>
            </div>

            <div className="p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl text-left truncate flex items-center gap-3">
              <div className="p-2.5 bg-zinc-900/10 dark:bg-white/5 border border-[var(--border-color)] rounded-lg">
                <TagIcon className="w-6 h-6 text-[var(--text-secondary)]" />
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{result.name}</span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block font-semibold">
                  {formatBytes(result.blob.size)} &bull; {tags.title || 'No Title'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <a 
                href={result.url} 
                download={result.name}
                className="inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download File
              </a>
              <Button onClick={reset} variant="outline" className="rounded-full h-10 text-xs border-[var(--border-color)]">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Edit Another File
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
