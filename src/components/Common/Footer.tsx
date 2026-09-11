import type { MouseEvent } from 'react';
import { ArrowUpRight, Check, LockKeyhole } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { pathForTool } from '../../config/toolRoutes';

interface FooterProps { onNavigate?: (href: string) => void }

const FOOTER_GROUPS = [
  { title: 'Popular', links: [['Compress PDF', 'pdf-compress'], ['Edit PDF', 'pdf-edit'], ['Convert files', 'universal-converter'], ['Compress video', 'video-compressor']] },
  { title: 'Create', links: [['Edit an image', 'image-optimizer'], ['Markdown to PDF', 'pdf-word-to-pdf'], ['Make a poster', 'rasterbator'], ['Join audio', 'audio-joiner']] },
  { title: 'Utilities', links: [['Organize PDF', 'pdf-organize'], ['PDF to Markdown', 'pdf-to-word'], ['Edit metadata', 'metadata-editor'], ['Key & BPM finder', 'audio-bpm-finder']] },
] as const;

export function Footer({ onNavigate }: FooterProps) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => { event.preventDefault(); onNavigate?.(id); };
  return <footer className="footer-v2">
    <div className="footer-v2__inner">
      <div className="footer-v2__lead">
        <div className="footer-v2__logo"><BrandMark /><strong>compactor</strong></div>
        <h2>File work, without<br />the busywork.</h2>
        <p>A focused suite of browser-based tools for everyday documents and media.</p>
        <div className="footer-v2__local"><LockKeyhole /><div><strong>Private by default</strong><span>Supported files are processed on your device.</span></div></div>
      </div>
      <nav className="footer-v2__nav" aria-label="Footer tools">
        {FOOTER_GROUPS.map(group => <div key={group.title}><h3>{group.title}</h3>{group.links.map(([label, id]) => <a key={id} href={pathForTool(id)} onClick={event => navigate(event, id)}>{label}<ArrowUpRight /></a>)}</div>)}
      </nav>
    </div>
    <div className="footer-v2__bottom">
      <p>© {new Date().getFullYear()} Compactor</p>
      <div><span><Check /> No uploads</span><span><Check /> No account</span></div>
      <nav aria-label="Legal"><a href="/privacy" onClick={event => navigate(event, 'privacy')}>Privacy</a><a href="/terms" onClick={event => navigate(event, 'terms')}>Terms</a><a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer">Built by Kuber Bassi <ArrowUpRight /></a></nav>
    </div>
  </footer>;
}
