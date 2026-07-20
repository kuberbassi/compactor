import { ArrowUpRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ToolGlyph, type ToolGlyphName } from '../components/Common/ToolGlyph';

interface Tool { id: string; title: string; description: string; icon: ToolGlyphName; tone: 'violet' | 'cyan' | 'rose' | 'amber' | 'lime'; category: 'Video' | 'PDF' | 'Image' | 'Audio'; }
const tools: Tool[] = [
  { id: 'video-compressor', title: 'Compress a video', description: 'Make videos lighter for sharing.', icon: 'video', tone: 'violet', category: 'Video' },
  { id: 'video-to-audio', title: 'Video to audio', description: 'Keep the sound. Leave the picture.', icon: 'audio', tone: 'cyan', category: 'Video' },
  { id: 'pdf-organize', title: 'Organize a PDF', description: 'Put every page in its place.', icon: 'pdf', tone: 'rose', category: 'PDF' },
  { id: 'pdf-jpg-to-pdf', title: 'Images to PDF', description: 'Turn photos into one document.', icon: 'scan', tone: 'amber', category: 'PDF' },
  { id: 'pdf-sign', title: 'Sign a PDF', description: 'Add your mark and send it on.', icon: 'sign', tone: 'violet', category: 'PDF' },
  { id: 'pdf-ai-summarizer', title: 'PDF text tools', description: 'Pull useful text from a document.', icon: 'text', tone: 'cyan', category: 'PDF' },
  { id: 'image-optimizer', title: 'Edit an image', description: 'Make each image ready to share.', icon: 'image', tone: 'lime', category: 'Image' },
  { id: 'rasterbator', title: 'Make a poster', description: 'Turn one image into a big print.', icon: 'poster', tone: 'amber', category: 'Image' },
  { id: 'audio-optimizer', title: 'Compress audio', description: 'Trim the size, keep the feeling.', icon: 'audio', tone: 'rose', category: 'Audio' },
  { id: 'universal-converter', title: 'Convert a file', description: 'Give a file a new format.', icon: 'convert', tone: 'cyan', category: 'Audio' },
  { id: 'metadata-editor', title: 'Edit metadata', description: 'Modify file tags, details and covers.', icon: 'text', tone: 'amber', category: 'Audio' },
];
const categories: Tool['category'][] = ['Video', 'PDF', 'Image', 'Audio'];

export function Dashboard({ onSelectTool, uploadCount }: { onSelectTool: (toolId: string) => void; uploadCount: number }) {
  return <div className="dashboard">
    <header className="dashboard__intro">
      <div className="dashboard__eyebrow"><i /> Everything in one place</div>
      <h1>Less file fuss.<br /><em>More flow.</em></h1>
      <p>Thoughtful tools to make your files lighter, tidier, and ready to share.</p>
      <div className="dashboard__meta"><span>{uploadCount} files finished</span><span>Pick a tool to begin</span></div>
    </header>
    <div className="dashboard__groups">
      {categories.map((category) => <section key={category} className="tool-group">
        <div className="category-heading"><span>{category}</span><small>{tools.filter((tool) => tool.category === category).length} tools</small></div>
        <div className="tool-grid">
          {tools.filter((tool) => tool.category === category).map((tool, index) => <button key={tool.id} className={`tool-card tool-card--${tool.tone}`} style={{ '--card-index': index } as CSSProperties} onClick={() => onSelectTool(tool.id)}>
            <span className="tool-card__scene" aria-hidden="true"><span /><span /><span /></span>
            <span className="tool-card__icon"><ToolGlyph name={tool.icon} /></span>
            <span className="tool-card__content"><strong>{tool.title}</strong><small>{tool.description}</small></span>
            <span className="tool-card__action">Open tool <ArrowUpRight size={14} /></span>
          </button>)}
        </div>
      </section>)}
    </div>
  </div>;
}
