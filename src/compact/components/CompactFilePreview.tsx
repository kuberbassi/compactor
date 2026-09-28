import { useEffect, useState } from 'react';
import { FileAudio, FileImage, FileVideo } from 'lucide-react';

interface Props { file: File; kind: 'image' | 'audio' | 'video'; title?: string; overlayText?: string; overlayOpacity?: number }

export function CompactFilePreview({ file, kind, title = 'Preview', overlayText = '', overlayOpacity = .35 }: Props) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const Icon = kind === 'image' ? FileImage : kind === 'video' ? FileVideo : FileAudio;
  return <section className={`compact-file-preview is-${kind}`} aria-label={`${kind} preview`}>
    <header><span><Icon aria-hidden="true" /> {title}</span><small>{file.name}</small></header>
    {url && kind === 'image' ? <div className="compact-file-preview__visual"><img src={url} alt={`Preview of ${file.name}`} />{overlayText.trim() ? <b style={{ opacity: overlayOpacity }}>{overlayText}</b> : null}</div> : null}
    {url && kind === 'video' ? <div className="compact-file-preview__visual"><video src={url} controls preload="metadata" playsInline />{overlayText.trim() ? <b style={{ opacity: overlayOpacity }}>{overlayText}</b> : null}</div> : null}
    {url && kind === 'audio' ? <audio src={url} controls preload="metadata" /> : null}
  </section>;
}
