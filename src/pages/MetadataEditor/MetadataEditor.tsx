import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { formatBytes } from '../../utils/image';
import { getFileFormatLabel } from '../../utils/conversionCapabilities';
import {
  readAnyMetadata,
  writeAnyMetadata,
  stripAnyMetadata,
  verifySavedMetadata,
} from '../../utils/metadata';
import type {
  MetadataTagEntry,
  FriendlyMetadataValues,
  FormatMetadataCapabilities,
  MetadataVerificationResult,
} from '../../utils/metadata';
import {
  RefreshCw,
  CheckCircle,
  Tag as TagIcon,
  Image as ImageIcon,
  Trash2,
  FileText,
  Music,
  ShieldCheck,
  Search,
  Lock,
  Edit3,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ToolModeSwitcher } from '../../components/Common/ToolModeSwitcher';
import { ErrorBanner } from '../../components/Common/ErrorBanner';
import { ResultDownloadButton } from '../../components/Common/ResultDownloadButton';

export function MetadataEditor({
  onGoHome,
  onSelectTool = () => undefined,
  onUploadSuccess,
}: {
  onGoHome: () => void;
  onSelectTool?: (toolId: string) => void;
  onUploadSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{
    blob: Blob;
    url: string;
    name: string;
    action: 'save' | 'strip';
    verification?: MetadataVerificationResult;
  } | null>(null);

  // Metadata inventory & capabilities
  const [entries, setEntries] = useState<MetadataTagEntry[]>([]);
  const [capabilities, setCapabilities] = useState<FormatMetadataCapabilities | null>(null);
  const [initialFriendly, setInitialFriendly] = useState<FriendlyMetadataValues>({});
  const [friendly, setFriendly] = useState<FriendlyMetadataValues>({});

  // Cover image states
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState<boolean>(false);

  // UI tabs & search
  const [activeTab, setActiveTab] = useState<'edit' | 'inventory'>('edit');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemovalModal, setShowRemovalModal] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const activeReadJobIdRef = useRef(0);

  // Cleanup object URLs on unmount / replacement
  useEffect(() => {
    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
      if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [coverUrl, newCoverPreview, result?.url]);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];

    // Clean up previous URLs
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
    if (result?.url) URL.revokeObjectURL(result.url);

    const jobId = ++activeReadJobIdRef.current;

    setFile(selectedFile);
    setResult(null);
    setErrorMessage(null);
    setNewCoverFile(null);
    setNewCoverPreview(null);
    setCoverUrl(null);
    setCoverBlob(null);
    setRemoveCover(false);
    setEntries([]);
    setSearchQuery('');
    setReading(true);
    setStatusText('Inspecting file metadata client-side...');

    try {
      const readResult = await readAnyMetadata(selectedFile, (msg) => {
        if (activeReadJobIdRef.current === jobId) {
          setStatusText(msg);
        }
      });

      // Avoid race conditions if user rapidly selected another file
      if (activeReadJobIdRef.current !== jobId) return;

      setCapabilities(readResult.capabilities);
      setEntries(readResult.entries);

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const initValues: FriendlyMetadataValues = {
        title: readResult.friendlyValues.title || (readResult.formatCategory === 'audio' ? baseName : ''),
        artist: readResult.friendlyValues.artist || '',
        album: readResult.friendlyValues.album || '',
        year: readResult.friendlyValues.year || '',
        genre: readResult.friendlyValues.genre || '',
        comment: readResult.friendlyValues.comment || '',
        copyright: readResult.friendlyValues.copyright || '',
        track: readResult.friendlyValues.track || '',
        imageDescription: readResult.friendlyValues.imageDescription || '',
        make: readResult.friendlyValues.make || '',
        model: readResult.friendlyValues.model || '',
        software: readResult.friendlyValues.software || '',
        dateTime: readResult.friendlyValues.dateTime || '',
        artistCreator: readResult.friendlyValues.artistCreator || '',
        copyrightNotice: readResult.friendlyValues.copyrightNotice || '',
      };

      setInitialFriendly(initValues);
      setFriendly(initValues);

      if (readResult.coverUrl) {
        setCoverUrl(readResult.coverUrl);
        setCoverBlob(readResult.coverBlob);
      }
    } catch (e: any) {
      if (activeReadJobIdRef.current !== jobId) return;
      console.error(e);
      setErrorMessage(`Failed to read file metadata: ${e.message || e}`);
    } finally {
      if (activeReadJobIdRef.current === jobId) {
        setReading(false);
      }
    }
  };

  const handleCoverClick = () => {
    coverInputRef.current?.click();
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setNewCoverFile(selected);
      setRemoveCover(false);
      if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
      const url = URL.createObjectURL(selected);
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

  // Check whether any supported editable changes were made
  const hasChanges = useMemo(() => {
    if (!capabilities?.canWrite) return false;
    if (removeCover) return true;
    if (newCoverFile !== null) return true;

    const keys: (keyof FriendlyMetadataValues)[] = [
      'title',
      'artist',
      'album',
      'year',
      'genre',
      'comment',
      'copyright',
      'track',
      'imageDescription',
      'make',
      'model',
      'software',
      'dateTime',
      'artistCreator',
      'copyrightNotice',
    ];

    return keys.some((k) => (friendly[k] || '') !== (initialFriendly[k] || ''));
  }, [friendly, initialFriendly, removeCover, newCoverFile, capabilities]);

  // Validation
  const validationError = useMemo(() => {
    if (friendly.year && friendly.year.trim()) {
      const val = friendly.year.trim();
      // Year or date format: 4-digit year, or YYYY-MM-DD
      if (!/^\d{4}(-\d{2}-\d{2})?$/.test(val)) {
        return 'Release Date / Year should be a 4-digit year (e.g. 2026) or YYYY-MM-DD.';
      }
    }
    return null;
  }, [friendly.year]);

  const saveMetadata = async () => {
    if (!file || !capabilities?.canWrite || validationError) return;
    setProcessing(true);
    setProgress(0);
    setStatusText('Applying metadata changes client-side...');
    setErrorMessage(null);

    try {
      const coverToUse = removeCover
        ? null
        : newCoverFile || (coverBlob ? coverBlob : undefined);

      const writeRes = await writeAnyMetadata(
        file,
        friendly,
        coverToUse,
        (msg) => setStatusText(msg),
        (p) => setProgress(p)
      );

      setStatusText('Re-reading output file to verify metadata persistence...');
      const savedFile = new File([writeRes.blob], writeRes.name, {
        type: writeRes.blob.type,
      });
      const verification = await verifySavedMetadata(savedFile, friendly);

      setResult({
        blob: writeRes.blob,
        url: writeRes.url,
        name: writeRes.name,
        action: 'save',
        verification,
      });

      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Error updating metadata: ${e.message || e}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleStripMetadata = async () => {
    if (!file || !capabilities?.canStrip) return;
    setShowRemovalModal(false);
    setProcessing(true);
    setProgress(0);
    setStatusText('Stripping identifying metadata tags...');
    setErrorMessage(null);

    try {
      const strippedRes = await stripAnyMetadata(
        file,
        (msg) => setStatusText(msg),
        (p) => setProgress(p)
      );

      setResult({
        blob: strippedRes.blob,
        url: strippedRes.url,
        name: strippedRes.name,
        action: 'strip',
      });

      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Error removing metadata: ${e.message || e}`);
    } finally {
      setProcessing(false);
    }
  };

  const clearAllFields = () => {
    setFriendly({
      title: '',
      artist: '',
      album: '',
      year: '',
      genre: '',
      comment: '',
      copyright: '',
      track: '',
      imageDescription: '',
      make: '',
      model: '',
      software: '',
      dateTime: '',
      artistCreator: '',
      copyrightNotice: '',
    });
  };

  const reset = () => {
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
    if (result?.url) URL.revokeObjectURL(result.url);

    setFile(null);
    setResult(null);
    setEntries([]);
    setCapabilities(null);
    setFriendly({});
    setInitialFriendly({});
    setCoverUrl(null);
    setCoverBlob(null);
    setNewCoverFile(null);
    setNewCoverPreview(null);
    setRemoveCover(false);
    setErrorMessage(null);
    setShowRemovalModal(false);
  };

  const fileFormat = file ? getFileFormatLabel(file) : '';
  const isAudioFile = capabilities?.canEditCoverArt;
  const isImageFile =
    file &&
    (file.type.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'tiff'].some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      ));

  // Filter inventory
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.rawKey.toLowerCase().includes(q) ||
        e.value.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  return (
    <div
      className={`tool-layout metadata-tool-layout ${
        file || result || processing || reading ? 'has-active-session' : 'is-empty-session'
      }`}
    >
      <ToolHeader
        title="File Details"
        description="Inspect, edit, or strip file metadata and camera tags directly in your browser with zero server uploads."
        icon={TagIcon}
        fileName={file?.name || result?.name}
        fileMeta={
          file
            ? `${formatBytes(file.size)} · ${fileFormat}`
            : result
            ? formatBytes(result.blob.size)
            : undefined
        }
        actions={
          !processing && !reading && !result ? (
            <ToolModeSwitcher
              label="File tools"
              activeId="metadata-editor"
              options={[
                { id: 'universal-converter', label: 'Convert' },
                { id: 'metadata-editor', label: 'Details' },
              ]}
              onSelect={onSelectTool}
            />
          ) : undefined
        }
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
          <ProgressBar
            progress={50}
            statusText={statusText || 'Reading file tags client-side...'}
            subText="Extracting media headers and metadata dictionary"
          />
        </div>
      )}

      {processing && (
        <div className="tool-processing-stage">
          <ProgressBar
            progress={progress}
            statusText={statusText}
            subText="Processing file locally on your device without server upload"
          />
        </div>
      )}

      {/* Upload Zone */}
      {!file && !reading && !processing && (
        <div className="tool-upload-frame max-w-2xl mx-auto py-6">
          <FileUploader
            accept="audio/*,video/*,image/*"
            onFilesSelected={handleFileSelected}
            label="Upload media or image file to inspect & edit metadata"
            subLabel="Drag & drop MP3, M4A, FLAC, WAV, OGG, OPUS, MP4, MOV, MKV, JPG, PNG, WEBP"
          />
        </div>
      )}

      {/* Editor Panel */}
      {file && !reading && !processing && !result && (
        <div className="image-workbench flex-1 flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden bg-[#111216]">
          {/* Left Sidebar Rail */}
          <aside className="image-workbench__sidebar w-full lg:w-[19.5rem] bg-[#18191e] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col shrink-0 lg:h-full overflow-visible lg:overflow-hidden">
            <div className="h-11 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-transparent">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                File & Capabilities
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-zinc-300 font-mono">
                {fileFormat}
              </span>
            </div>

            <div className="flex-1 lg:overflow-y-auto p-4 flex flex-col items-center space-y-4">
              {/* Cover Art Box (visible when audio format supports cover art) */}
              {isAudioFile ? (
                <div className="flex flex-col items-center space-y-3 w-full">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Album Cover Art
                  </span>

                  <div
                    onClick={handleCoverClick}
                    className="w-36 h-36 border border-dashed border-white/20 bg-zinc-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-white/40 group relative transition-colors shadow-inner"
                  >
                    {!removeCover && newCoverPreview ? (
                      <img
                        src={newCoverPreview}
                        alt="New cover"
                        className="w-full h-full object-cover"
                      />
                    ) : !removeCover && coverUrl ? (
                      <img
                        src={coverUrl}
                        alt="Cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-3 text-zinc-500">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 group-hover:scale-105 transition-transform text-zinc-400" />
                        <span className="text-[10px] font-bold block text-zinc-400">
                          Click to upload
                        </span>
                        <span className="text-[9px] text-zinc-600 block">
                          JPG or PNG
                        </span>
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
                <div className="flex flex-col items-center justify-center p-3 text-center space-y-2 w-full">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
                    <TagIcon className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">
                      {capabilities?.canWrite ? 'Editable Metadata' : 'Read-Only Format'}
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      {capabilities?.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Capability Summary Badge */}
              <div className="w-full bg-zinc-950/50 border border-white/10 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between gap-2 text-zinc-400 text-[11px]">
                  <span className="shrink-0">File Name</span>
                  <span className="text-white font-medium truncate max-w-[160px]">
                    {file.name}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Size</span>
                  <span className="text-white font-medium">{formatBytes(file.size)}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Discovered Tags</span>
                  <span className="text-white font-medium">{entries.length} fields</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Writing Support</span>
                  <span
                    className={`font-semibold ${
                      capabilities?.canWrite ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {capabilities?.canWrite ? 'Supported (Lossless)' : 'Read-Only in Browser'}
                  </span>
                </div>
              </div>

              {/* Explanatory notice when write is unsupported */}
              {capabilities && !capabilities.canWrite && (
                <div className="w-full p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200/90 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Lock className="w-3.5 h-3.5" /> Read-Only Format
                  </div>
                  <p>{capabilities.writeLimitations || 'Writing is not safely supported client-side without re-encoding.'}</p>
                </div>
              )}

              {/* Strip metadata action button */}
              {capabilities?.canStrip && (
                <div className="w-full pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRemovalModal(true)}
                    className="w-full h-9 rounded-xl border border-rose-500/20 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Strip Identifying Metadata</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Action Button */}
            <div className="p-3.5 border-t border-white/10 bg-[#18191e] mt-auto shrink-0 space-y-2">
              <button
                type="button"
                disabled={!capabilities?.canWrite || !hasChanges || Boolean(validationError)}
                onClick={saveMetadata}
                className="workspace-primary-action w-full h-11 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <span>Save File</span>
                <span className="text-sm font-black">→</span>
              </button>
              {!capabilities?.canWrite ? (
                <p className="text-[10px] text-zinc-500 text-center">Save disabled (read-only format)</p>
              ) : !hasChanges ? (
                <p className="text-[10px] text-zinc-500 text-center">No changes to save</p>
              ) : null}
            </div>
          </aside>

          {/* Right Main Stage */}
          <main className="image-workbench__main flex-1 bg-[#111216] flex flex-col lg:h-full lg:overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl w-full mx-auto space-y-5">
              {errorMessage && (
                <ErrorBanner
                  message={errorMessage}
                  onDismiss={() => setErrorMessage(null)}
                  onRetry={saveMetadata}
                />
              )}

              {validationError && (
                <div className="p-3 bg-amber-950/80 border border-amber-800 text-amber-200 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* View Switcher Tabs: Common Fields vs All Discovered Identifiers */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'edit'
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Common Fields</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'inventory'
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>All Tags Inventory ({entries.length})</span>
                  </button>
                </div>

                {activeTab === 'edit' && capabilities?.canWrite && (
                  <button
                    type="button"
                    onClick={clearAllFields}
                    className="text-[11px] font-semibold text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear fields
                  </button>
                )}
              </div>

              {/* Active Tab: Common Editable Fields */}
              {activeTab === 'edit' && (
                <div className="bg-[#18191e] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl">
                  <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {isImageFile ? (
                          <ImageIcon className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <Music className="w-4 h-4 text-zinc-400" />
                        )}
                        {isImageFile ? 'Image & EXIF Attributes' : 'Container & Media Properties'}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {capabilities?.canWrite
                          ? 'Edit properties below before saving your updated file.'
                          : 'Fields are displayed read-only as client-side writing is unavailable for this format.'}
                      </p>
                    </div>
                  </div>

                  {/* Form fields: Image Mode */}
                  {isImageFile ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Image Description / Title
                        </label>
                        <Input
                          disabled={!capabilities?.canWrite}
                          value={friendly.imageDescription || ''}
                          onChange={(e) =>
                            setFriendly({ ...friendly, imageDescription: e.target.value })
                          }
                          placeholder="e.g. Mountain sunset"
                          className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Camera Make
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.make || ''}
                            onChange={(e) => setFriendly({ ...friendly, make: e.target.value })}
                            placeholder="e.g. Sony, Canon, Apple"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Camera Model
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.model || ''}
                            onChange={(e) => setFriendly({ ...friendly, model: e.target.value })}
                            placeholder="e.g. ILCE-7RM4"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Artist / Photographer
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.artistCreator || ''}
                            onChange={(e) =>
                              setFriendly({ ...friendly, artistCreator: e.target.value })
                            }
                            placeholder="e.g. Ansel Adams"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Software / Processing
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.software || ''}
                            onChange={(e) =>
                              setFriendly({ ...friendly, software: e.target.value })
                            }
                            placeholder="e.g. Compactor Studio"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Date / Time
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.dateTime || ''}
                            onChange={(e) =>
                              setFriendly({ ...friendly, dateTime: e.target.value })
                            }
                            placeholder="e.g. 2026:10:10 12:00:00"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Copyright Notice
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.copyrightNotice || ''}
                            onChange={(e) =>
                              setFriendly({ ...friendly, copyrightNotice: e.target.value })
                            }
                            placeholder="e.g. © 2026 All Rights Reserved"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Audio & Video Form */
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Track / Media Title
                        </label>
                        <Input
                          disabled={!capabilities?.canWrite}
                          value={friendly.title || ''}
                          onChange={(e) => setFriendly({ ...friendly, title: e.target.value })}
                          placeholder="e.g. Symphony No. 5"
                          className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Artist / Creator
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.artist || ''}
                            onChange={(e) => setFriendly({ ...friendly, artist: e.target.value })}
                            placeholder="e.g. Ludwig van Beethoven"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Album / Collection
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.album || ''}
                            onChange={(e) => setFriendly({ ...friendly, album: e.target.value })}
                            placeholder="e.g. Classical Masterpieces"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Release Year / Date
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.year || ''}
                            onChange={(e) => setFriendly({ ...friendly, year: e.target.value })}
                            placeholder="e.g. 1808 or 2026"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Genre
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.genre || ''}
                            onChange={(e) => setFriendly({ ...friendly, genre: e.target.value })}
                            placeholder="e.g. Classical"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Track Number
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.track || ''}
                            onChange={(e) => setFriendly({ ...friendly, track: e.target.value })}
                            placeholder="e.g. 1/12"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Copyright
                          </label>
                          <Input
                            disabled={!capabilities?.canWrite}
                            value={friendly.copyright || ''}
                            onChange={(e) => setFriendly({ ...friendly, copyright: e.target.value })}
                            placeholder="e.g. © 2026 Label Records"
                            className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Comment / Notes
                        </label>
                        <Input
                          disabled={!capabilities?.canWrite}
                          value={friendly.comment || ''}
                          onChange={(e) => setFriendly({ ...friendly, comment: e.target.value })}
                          placeholder="e.g. Remastered 2026"
                          className="bg-zinc-950/50 border-white/10 text-xs h-10 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Tab: Searchable Identifier Inventory */}
              {activeTab === 'inventory' && (
                <div className="bg-[#18191e] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-white/10 pb-3.5">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Search className="w-4 h-4 text-zinc-400" />
                        Discovered Tag Inventory
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Raw file headers, EXIF/ID3 keys, and technical container properties discovered in this file.
                      </p>
                    </div>

                    <div className="w-full sm:w-64">
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tags, keys, values..."
                        className="bg-zinc-950/50 border-white/10 text-xs h-8 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">
                      {entries.length === 0
                        ? 'No metadata tags found in this file.'
                        : 'No tags match your search query.'}
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                      {Array.from(
                        filteredEntries.reduce((acc, entry) => {
                          const grp = entry.group || 'GENERAL METADATA';
                          if (!acc.has(grp)) acc.set(grp, []);
                          acc.get(grp)!.push(entry);
                          return acc;
                        }, new Map<string, MetadataTagEntry[]>())
                      ).map(([groupTitle, groupItems]) => (
                        <div key={groupTitle} className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              {groupTitle}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {groupItems.length} {groupItems.length === 1 ? 'tag' : 'tags'}
                            </span>
                          </div>
                          {groupItems.map((entry) => (
                            <div
                              key={entry.id}
                              className="p-3 bg-zinc-950/50 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs hover:border-white/20 transition-colors"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white">{entry.label}</span>
                                  <span className="font-mono text-[10px] text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">
                                    {entry.rawKey}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">
                                    {entry.source}
                                  </span>
                                  {entry.isEditable ? (
                                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      Editable
                                    </span>
                                  ) : (
                                    <span
                                      title={entry.readOnlyReason}
                                      className="text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded"
                                    >
                                      Read-only
                                    </span>
                                  )}
                                </div>
                                <div className="text-zinc-300 font-mono text-[11px] whitespace-pre-wrap break-words bg-zinc-950/60 p-2 rounded-lg border border-white/5">
                                  {entry.value}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Confirmation Modal for Metadata Removal */}
      {showRemovalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18191e] border border-white/10 max-w-lg w-full rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Strip Identifying Metadata</h3>
                <p className="text-xs text-zinc-400">
                  Define and verify the exact scope of metadata removal for this file.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-950/60 border border-white/10 rounded-xl space-y-2 text-xs">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Verified Removal Scope for {fileFormat}
              </span>
              <p className="text-zinc-300 leading-relaxed">
                {capabilities?.stripScope || 'Removes container tags and identifying header information.'}
              </p>
              <div className="pt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Lossless stream copy (no audio or video re-encoding loss)</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRemovalModal(false)}
                className="text-xs rounded-xl border-white/10"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleStripMetadata}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Confirm & Strip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {result && !reading && !processing && (
        <div className="max-w-xl mx-auto py-10 px-4">
          <Card className="border border-white/10 bg-[#18191e] shadow-2xl text-center p-8 space-y-6 rounded-2xl">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">
                {result.action === 'strip' ? 'Metadata Stripped!' : 'Metadata Processed!'}
              </h3>
              <p className="text-xs text-zinc-400">
                {result.action === 'strip'
                  ? 'All identifying tags and artwork have been removed cleanly.'
                  : 'Your updated file has been compiled cleanly without quality loss.'}
              </p>
            </div>

            {/* Post-Save Verification Summary */}
            {result.verification && (
              <div className="p-4 bg-zinc-950/60 border border-white/10 rounded-2xl text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Round-Trip Verification Report
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      result.verification.verified
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {result.verification.verified ? 'All Changes Verified' : 'Partial Retention'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-white/5">
                    <span className="block text-xs font-bold text-emerald-400">
                      {result.verification.persistedCount}
                    </span>
                    <span className="text-[10px] text-zinc-500">Persisted</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <span className="block text-xs font-bold text-amber-400">
                      {result.verification.normalizedCount}
                    </span>
                    <span className="text-[10px] text-zinc-500">Normalized</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <span className="block text-xs font-bold text-rose-400">
                      {result.verification.droppedCount}
                    </span>
                    <span className="text-[10px] text-zinc-500">Dropped</span>
                  </div>
                </div>

                {result.verification.details.retained.length > 0 && (
                  <p className="text-[11px] text-zinc-400">
                    Retained tags: {result.verification.details.retained.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* File Result Info */}
            <div className="p-4 bg-zinc-950/60 border border-white/10 rounded-2xl text-left truncate flex items-center gap-3.5">
              <div className="w-11 h-11 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-zinc-400">
                {!removeCover && (newCoverPreview || coverUrl) ? (
                  <img
                    src={newCoverPreview || coverUrl || ''}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-white">
                  {result.name}
                </span>
                <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
                  {formatBytes(result.blob.size)} &bull;{' '}
                  {friendly.title || friendly.imageDescription || 'Cleaned File'}
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
