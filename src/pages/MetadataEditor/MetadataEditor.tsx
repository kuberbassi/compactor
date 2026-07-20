import { useState, useRef, useEffect } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { readMediaMetadata, writeMediaMetadata, terminateFFmpeg } from '../../utils/ffmpeg';
import type { MetadataTags } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { 
  PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiCheckCircleLight as CheckCircle, PiTagLight as TagIcon,
  PiImageLight as ImageIcon, PiArrowLeftLight as ArrowLeft
} from 'react-icons/pi';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

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
  
  const coverInputRef = useRef<HTMLInputElement>(null);

  // FFmpeg cleanup on unmount
  useEffect(() => {
    return () => {
      terminateFFmpeg();
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
    setReading(true);

    try {
      const extracted = await readMediaMetadata(f, (msg) => console.log('FFmpeg metadata extraction log:', msg));
      setTags({
        title: extracted.tags.title || '',
        artist: extracted.tags.artist || '',
        album: extracted.tags.album || '',
        year: extracted.tags.year || '',
        genre: extracted.tags.genre || '',
        comment: extracted.tags.comment || ''
      });
      if (extracted.coverUrl) {
        setCoverUrl(extracted.coverUrl);
        setCoverBlob(extracted.coverBlob);
      }
    } catch (err: any) {
      console.warn("Failed to extract tags automatically:", err);
      // Initialize with name-based defaults
      const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.'));
      setTags({
        title: nameWithoutExt,
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
      const url = URL.createObjectURL(file);
      setNewCoverPreview(url);
    }
  };

  const saveMetadata = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setStatusText('Compiling metadata changes...');

    try {
      const targetCover = newCoverFile || coverBlob;
      const response = await writeMediaMetadata(
        file,
        tags,
        targetCover,
        (msg) => console.log('FFmpeg write log:', msg),
        setProgress
      );

      setResult(response);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      alert(`Tag update failed: ${e.message || 'Verification Error'}`);
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
  };

  const isAudioFile = file ? file.type.startsWith('audio/') || ['.mp3', '.m4a', '.flac', '.wav', '.ogg'].some(ext => file.name.toLowerCase().endsWith(ext)) : false;

  return (
    <div className="tool-layout">
      {/* Header */}
      <div className="tool-layout__header">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <TagIcon className="w-6 h-6 text-zinc-400" /> File Metadata Editor
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Edit titles, artist tags, album details, and covers directly in your browser.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGoHome} className="h-9">
          All tools
        </Button>
      </div>

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
            label="Upload media file to edit tags"
            subLabel="Drag or select MP3, M4A, FLAC, WAV, MP4, MOV, PNG, JPG etc."
          />
        </div>
      )}

      {/* Editor Panel */}
      {file && !reading && !processing && !result && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm p-6 space-y-6">
            
            {/* Header info */}
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-color)]/30">
              <button onClick={reset} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 rounded-full hover:bg-zinc-900/60">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="truncate">
                <span className="block text-xs font-black text-zinc-400 truncate">{file.name}</span>
                <span className="text-[10px] text-zinc-500 mt-0.5 block">{formatBytes(file.size)} &bull; {file.type || 'Media file'}</span>
              </div>
            </div>

            {/* Layout grid containing Cover Image and Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Cover Art Box (visible for audio formats) */}
              {isAudioFile ? (
                <div className="flex flex-col items-center space-y-3">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Cover Art</span>
                  
                  <div 
                    onClick={handleCoverClick}
                    className="w-36 h-36 border border-dashed border-[var(--border-color)] bg-[var(--bg-color)]/30 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 group relative transition-colors shadow-inner"
                  >
                    {newCoverPreview ? (
                      <img src={newCoverPreview} alt="New cover" className="w-full h-full object-cover" />
                    ) : coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-zinc-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 group-hover:scale-105 transition-transform" />
                        <span className="text-[10px] font-bold">Upload Cover</span>
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[10px] text-white font-bold bg-zinc-900/80 px-2.5 py-1 rounded-full">Change Image</span>
                    </div>
                  </div>

                  <input 
                    type="file" 
                    ref={coverInputRef}
                    onChange={handleCoverFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden" 
                  />
                  <span className="text-[10px] text-zinc-500 text-center leading-relaxed">
                    JPG or PNG images
                  </span>
                </div>
              ) : (
                <div className="md:col-span-3 text-xs text-zinc-500 bg-zinc-950/20 border border-[var(--border-color)] p-3 rounded-lg flex items-center gap-2">
                  <TagIcon className="w-4 h-4 text-zinc-400" />
                  <span>Cover artwork tags are supported for audio file formats.</span>
                </div>
              )}

              {/* Input Forms */}
              <div className={`space-y-4 ${isAudioFile ? 'md:col-span-2' : 'md:col-span-3'}`}>
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Title</label>
                  <Input 
                    value={tags.title} 
                    onChange={e => setTags({ ...tags, title: e.target.value })} 
                    placeholder="Song, Video, or Image Title"
                    className="h-8 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                  />
                </div>

                {/* Artist */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Artist / Creator</label>
                  <Input 
                    value={tags.artist} 
                    onChange={e => setTags({ ...tags, artist: e.target.value })} 
                    placeholder="Artist, Album Artist, or Author"
                    className="h-8 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                  />
                </div>

                {/* Album */}
                {isAudioFile && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Album</label>
                    <Input 
                      value={tags.album} 
                      onChange={e => setTags({ ...tags, album: e.target.value })} 
                      placeholder="Album Name"
                      className="h-8 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Year */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Year / Date</label>
                    <Input 
                      value={tags.year} 
                      onChange={e => setTags({ ...tags, year: e.target.value })} 
                      placeholder="e.g. 2026"
                      className="h-8 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>

                  {/* Genre */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Genre</label>
                    <Input 
                      value={tags.genre} 
                      onChange={e => setTags({ ...tags, genre: e.target.value })} 
                      placeholder="e.g. Pop, Jazz, Synthwave"
                      className="h-8 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Comment */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Description / Comment</label>
                  <Input 
                    value={tags.comment} 
                    onChange={e => setTags({ ...tags, comment: e.target.value })} 
                    placeholder="Short notes or description tags"
                    className="h-8 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-color)]/30">
              <Button onClick={reset} variant="outline" className="flex-1 rounded-full h-10 text-xs">
                Clear
              </Button>
              <Button 
                onClick={saveMetadata} 
                className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-10 text-xs cursor-pointer shadow-sm"
              >
                Save Metadata
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
              <h3 className="text-xl font-black text-[var(--text-primary)]">Metadata Saved!</h3>
              <p className="text-xs text-[var(--text-secondary)]">Your updated file is ready to download.</p>
            </div>

            <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/10 border rounded-xl text-left truncate flex items-center gap-3">
              <div className="p-2.5 bg-zinc-900/10 dark:bg-white/5 border border-[var(--border-color)] rounded-lg">
                <TagIcon className="w-6 h-6 text-[var(--text-secondary)]" />
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{result.name}</span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block">
                  {formatBytes(result.blob.size)} &bull; {tags.title || 'No Title'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <a 
                href={result.url} 
                download={result.name}
                className="inline-flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-bold px-6 py-2.5 rounded-full text-xs shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download File
              </a>
              <Button onClick={reset} variant="outline" className="rounded-full h-9 text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Edit Another File
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
