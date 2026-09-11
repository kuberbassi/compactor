import type { CSSProperties } from 'react';
import { ArrowUpRight, FileAudio, FileImage, FileText, FileVideo, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ToolItem } from './types';
import { pathForTool } from '../../config/toolRoutes';

const TOOL_ACCENT = '#f4f4f5';

function ToolIcon({ tool }: { tool: ToolItem }) {
  if (tool.id === 'metadata-editor') return <ShieldCheck />;
  if (tool.id === 'universal-converter') return <RefreshCw />;
  if (tool.category === 'PDF') return <FileText />;
  if (tool.category === 'IMAGE') return <FileImage />;
  if (tool.category === 'VIDEO') return <FileVideo />;
  return <FileAudio />;
}

export function ToolCard({ tool, onSelectTool }: { tool: ToolItem; onSelectTool: (toolId: string) => void; index?: number }) {
  return <a href={pathForTool(tool.id)} onClick={event => { event.preventDefault(); onSelectTool(tool.id); }} className="tool-card-v2" style={{ '--tool-accent': TOOL_ACCENT } as CSSProperties}>
    <div className="tool-card-v2__top"><div className="tool-card-v2__icon"><ToolIcon tool={tool} /></div><span>{tool.category === 'AUDIO & CONVERT' ? 'AUDIO' : tool.category}</span><ArrowUpRight className="tool-card-v2__arrow" /></div>
    <div><h3>{tool.title}</h3><p>{tool.description}</p></div>
    <div className="tool-card-v2__meta"><span>{tool.subtitle}</span><span>Open tool <ArrowUpRight /></span></div>
  </a>;
}
