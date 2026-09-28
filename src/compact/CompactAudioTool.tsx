import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, X } from 'lucide-react';
import type { AudioAnalysisResult } from '../utils/audioAnalysis';
import { type DownloadableResult } from '../utils/batch';
import { formatBytes } from '../utils/image';
import type { CompactToolCapability } from './compactTools';
import { CompactShell } from './components/CompactShell';
import { CompactResultScreen } from './components/CompactResultScreen';
import { CompactFilePreview } from './components/CompactFilePreview';
import { CustomAudioPlayer } from '../components/Common/CustomAudioPlayer';
import { assertExportLooksValid } from '../utils/exportValidation';

interface Props { tool: CompactToolCapability; onGoHome: () => void; onProcessed: (count: number) => void }

export function CompactAudioTool({ tool, onGoHome, onProcessed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DownloadableResult | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const isJoin = tool.id === 'audio-joiner';
  const isBpm = tool.id === 'audio-bpm-finder';
  const isPitch = tool.id === 'audio-pitch-speed';
  useEffect(() => {
    if (!files[0]) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(files[0]);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);
  const reset = () => { setFiles([]); setResult(null); setAnalysis(null); setError(''); setProgress(0); };
  const addFiles = (incoming: File[]) => {
    const audio = incoming.filter(file => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name));
    setFiles(current => isJoin ? [...current, ...audio] : audio.slice(0, 1)); setResult(null); setAnalysis(null); setError(audio.length === incoming.length ? '' : 'Only supported audio files were added.');
  };
  const move = (from: number, to: number) => setFiles(current => { const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  const ready = isJoin ? files.length >= 2 : files.length === 1;
  const run = async () => {
    if (!ready) return; setBusy(true); setError(''); setProgress(5);
    try {
      if (isJoin) {
        const { joinAudioFiles } = await import('../utils/audioJoiner');
        const joined = await joinAudioFiles(files, setProgress); URL.revokeObjectURL(joined.url);
        await assertExportLooksValid(joined.blob, 'joined-audio.wav');
        setResult({ blob: joined.blob, url: '', name: 'joined-audio.wav' });
      } else if (isBpm) {
        const { analyzeAudioBPMAndKey } = await import('../utils/audioAnalysis'); setAnalysis(await analyzeAudioBPMAndKey(files[0]));
      } else {
        if (pitch === 0 && speed === 1) throw new Error('Adjust pitch or speed before exporting.');
        const { processPitchAndSpeed } = await import('../utils/audioPitchSpeed');
        const changed = await processPitchAndSpeed(files[0], { pitchSemitones: pitch, speedRatio: speed }, setProgress); URL.revokeObjectURL(changed.url);
        const name = `${files[0].name.replace(/\.[^/.]+$/, '')}-pitch-speed.wav`;
        await assertExportLooksValid(changed.blob, name);
        setResult({ blob: changed.blob, url: '', name });
      }
      setProgress(100); onProcessed(1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Audio processing failed.'); } finally { setBusy(false); }
  };
  if (result) return <CompactResultScreen title={tool.route.title} results={[result]} originalSize={files.reduce((total, file) => total + file.size, 0)} outputSize={result.blob?.size ?? 0} zipName="audio-result.zip" onNewBatch={reset} onGoHome={onGoHome} />;
  if (analysis) return <CompactShell title={tool.route.title} onBack={reset}><section className="compact-audio-result"><p className="compact-kicker">Analysis complete</p><div className="compact-audio-result__tempo"><strong>{analysis.bpm}</strong><span>BPM</span></div><p>{files[0]?.name}</p></section><section className="compact-audio-analysis"><article><span>Musical key</span><strong>{analysis.key}</strong><small>{analysis.mode} scale</small></article><article><span>Camelot</span><strong>{analysis.camelot}</strong><small>DJ notation</small></article></section>{files[0] ? <CompactFilePreview file={files[0]} kind="audio" title="Source audio" /> : null}<div className="compact-result-actions"><button className="compact-secondary-action" type="button" onClick={reset}><FilePlus2 /> Analyze another file</button><button className="compact-link-action" type="button" onClick={onGoHome}>Choose another tool</button></div></CompactShell>;
  return <CompactShell title={tool.route.title} onBack={onGoHome} action={files.length ? <button className="compact-primary-action" type="button" disabled={!ready || busy} onClick={() => void run()}>{busy ? `Processing ${Math.round(progress)}%` : isJoin ? 'Join audio' : isBpm ? 'Analyze key & BPM' : 'Export changed audio'}</button> : undefined}>
    <input ref={inputRef} className="compact-file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" multiple={isJoin} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
    <section className="compact-compressor-hero"><p className="compact-kicker">Mobile audio tool</p><h1>{tool.route.title}</h1><p>{tool.shortDescription} Processing stays on this device.</p></section>
    {!files.length ? <button className="compact-file-picker" type="button" onClick={() => inputRef.current?.click()}><span><FilePlus2 /></span><strong>Add audio {isJoin ? 'files' : 'file'}</strong><small>{isJoin ? 'Select at least two tracks' : 'MP3, WAV, M4A, AAC, OGG, or FLAC'}</small></button> : null}
    {error ? <p className="compact-queue-notice compact-queue-notice--error" role="alert">{error}</p> : null}
    {files[0] && isPitch && previewUrl ? <section className="compact-live-audio-preview" aria-label="Live transformed audio preview"><div className="compact-section-title"><div><span>Live preview</span><h2>Hear current pitch and speed</h2></div></div><CustomAudioPlayer className="compact-live-audio-player" src={previewUrl} file={files[0]} title={files[0].name} subtitle={`${pitch > 0 ? '+' : ''}${pitch} st · ${speed.toFixed(2)}× speed`} pitchSemitones={pitch} speedRatio={speed} /></section> : files[0] ? <CompactFilePreview file={files[0]} kind="audio" title={isJoin ? 'First track preview' : 'Audio preview'} /> : null}
    {files.length ? <section className="compact-queue"><div className="compact-section-title"><div><span>Queue</span><h2>{files.length} selected</h2></div><div className="compact-section-title__actions"><button type="button" onClick={() => inputRef.current?.click()}><FilePlus2 /> {isJoin ? 'Add audio' : 'Change'}</button><button type="button" onClick={reset}>Clear</button></div></div><div className="compact-queue__list">{files.map((file, index) => <article className="compact-queue-item" key={`${file.name}-${index}`}><div className="compact-queue-item__copy"><strong>{file.name}</strong><small>{formatBytes(file.size)}{isJoin ? ` · position ${index + 1}` : ''}</small></div><div className="compact-queue-item__actions">{isJoin && index > 0 ? <button type="button" aria-label={`Move ${file.name} earlier`} onClick={() => move(index, index - 1)}><ArrowUp /></button> : null}{isJoin && index < files.length - 1 ? <button type="button" aria-label={`Move ${file.name} later`} onClick={() => move(index, index + 1)}><ArrowDown /></button> : null}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X /></button></div></article>)}</div></section> : null}
    {!isJoin && !isBpm && files.length ? <section className="compact-settings"><div className="compact-section-title"><div><span>Transform</span><h2>Pitch and speed</h2></div></div><label><span>Pitch <b>{pitch > 0 ? '+' : ''}{pitch} semitones</b></span><input type="range" min="-12" max="12" step="1" value={pitch} onChange={event => setPitch(Number(event.target.value))} /></label><label><span>Speed <b>{speed.toFixed(2)}×</b></span><input type="range" min="0.5" max="2" step="0.05" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label><button type="button" className="compact-link-action" onClick={() => { setPitch(0); setSpeed(1); }}>Reset controls</button></section> : null}
  </CompactShell>;
}
