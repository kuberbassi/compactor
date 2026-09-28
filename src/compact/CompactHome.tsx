import { useMemo, useState } from 'react';
import { ArrowRight, Search, ShieldCheck, X } from 'lucide-react';
import { COMPACT_TOOL_GROUPS, COMPACT_TOOLS } from './compactTools';
import { CompactShell } from './components/CompactShell';
import { isDirectToolSearchMatch, searchTools } from '../utils/toolSearch';

interface CompactHomeProps {
  onSelectTool: (toolId: string) => void;
}

export function CompactHome({ onSelectTool }: CompactHomeProps) {
  const [query, setQuery] = useState('');
  const searchableTools = useMemo(() => COMPACT_TOOLS.map(tool => ({
    ...tool,
    title: tool.route.title,
    description: tool.shortDescription,
    category: tool.group,
  })), []);
  const visibleTools = useMemo(() => searchTools(searchableTools, query), [query, searchableTools]);
  const smartMatch = Boolean(query.trim() && visibleTools[0] && !isDirectToolSearchMatch(visibleTools[0], query));

  return (
    <CompactShell title="File tools for your phone" eyebrow="Compactor">
      <section className="compact-hero" aria-labelledby="compact-home-title">
        <span className="compact-kicker"><ShieldCheck aria-hidden="true" /> Files stay on this device</span>
        <h1 id="compact-home-title">Quick file work, without the desktop editor.</h1>
        <p>Compress, convert, and handle common PDF jobs in a simpler touch-first workspace.</p>
      </section>

      <label className="compact-tool-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search phone tools</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “word to pdf” or “compress image”" />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear tool search"><X aria-hidden="true" /></button> : null}
      </label>
      {smartMatch ? <p className="compact-search-hint" role="status">Closest match: <strong>{visibleTools[0].route.title}</strong></p> : null}

      {COMPACT_TOOL_GROUPS.map(group => {
        const tools = visibleTools.filter(tool => tool.group === group.id);
        if (tools.length === 0) return null;
        return (
          <section className="compact-section" key={group.id} aria-labelledby={`compact-group-${group.id}`}>
            <div className="compact-section__heading">
              <h2 id={`compact-group-${group.id}`}>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className="compact-tool-grid">
              {tools.map(tool => <CompactToolCard key={tool.id} tool={tool} onSelectTool={onSelectTool} />)}
            </div>
          </section>
        );
      })}

      {query.trim() && visibleTools.length === 0 ? <div className="compact-search-empty"><Search aria-hidden="true" /><strong>No supported phone tool found</strong><span>Try a shorter action or file type.</span></div> : null}

      <footer className="compact-home-footer">
        <button type="button" onClick={() => onSelectTool('privacy')}>Privacy</button>
        <button type="button" onClick={() => onSelectTool('terms')}>Terms</button>
        <a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer">Kuber Bassi</a>
      </footer>
    </CompactShell>
  );
}

function CompactToolCard({ tool, onSelectTool }: { tool: (typeof COMPACT_TOOLS)[number]; onSelectTool: (toolId: string) => void }) {
  const { Icon } = tool;
  return (
    <button type="button" className="compact-tool-card" onClick={() => onSelectTool(tool.id)}>
      <span className="compact-tool-card__icon"><Icon aria-hidden="true" /></span>
      <span className="compact-tool-card__copy"><strong>{tool.route.title}</strong><small>{tool.shortDescription}</small></span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
