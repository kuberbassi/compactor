import type { MouseEvent } from 'react';
import { ArrowUpRight, Check, LockKeyhole } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { pathForTool } from '../../config/toolRoutes';
import { TOOLS } from '../../pages/Dashboard/data';

interface FooterProps { onNavigate?: (href: string) => void }

const FOOTER_GROUPS = [
  { title: 'PDF', toolIds: ['pdf-edit', 'pdf-compress', 'pdf-organize', 'pdf-protect'] },
  { title: 'Create & convert', toolIds: ['pdf-jpg-to-pdf', 'pdf-word-to-pdf', 'rasterbator', 'universal-converter'] },
  { title: 'Media', toolIds: ['image-optimizer', 'video-compressor', 'audio-optimizer', 'metadata-editor'] },
] as const;

export function Footer({ onNavigate }: FooterProps) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => { event.preventDefault(); onNavigate?.(id); };
  return <footer className="footer-v2">
    <div className="footer-v2__inner">
      <div className="footer-v2__lead">
        <div className="footer-v2__logo"><BrandMark /><strong>compactor</strong></div>
        <h2>Useful file tools.<br />Ready when you are.</h2>
        <p>Edit, convert, compress, organize, and protect everyday files directly in your browser.</p>
        <div className="footer-v2__local"><LockKeyhole /><div><strong>Private by default</strong><span>Supported files are processed on your device.</span></div></div>
      </div>
      <nav className="footer-v2__nav" aria-label="Footer tools">
        {FOOTER_GROUPS.map(group => <div key={group.title}><h3>{group.title}</h3>{group.toolIds.map(id => TOOLS.find(tool => tool.id === id)).filter((tool): tool is (typeof TOOLS)[number] => Boolean(tool)).map(tool => <a key={tool.id} href={pathForTool(tool.id)} onClick={event => navigate(event, tool.id)}>{tool.title}<ArrowUpRight /></a>)}</div>)}
      </nav>
    </div>
    <div className="footer-v2__bottom">
      <p>© {new Date().getFullYear()} Compactor</p>
      <div><span><Check /> No uploads</span><span><Check /> No account</span></div>
      <nav aria-label="Legal"><a href="/privacy" onClick={event => navigate(event, 'privacy')}>Privacy</a><a href="/terms" onClick={event => navigate(event, 'terms')}>Terms</a><a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer">Built by Kuber Bassi <ArrowUpRight /></a></nav>
    </div>
  </footer>;
}
