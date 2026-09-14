import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Command, FileAudio, FileImage, FileText, FileVideo, RefreshCw, Search, ShieldCheck, Tags, X } from 'lucide-react';
import { searchTools } from '../../utils/toolSearch';
import { TOOLS } from '../../pages/Dashboard/data';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
}

function iconForTool(id: string) {
  if (id.startsWith('video-')) return FileVideo;
  if (id.startsWith('audio-')) return FileAudio;
  if (id.startsWith('image-') || id === 'rasterbator') return FileImage;
  if (id === 'universal-converter') return RefreshCw;
  if (id === 'metadata-editor') return Tags;
  return FileText;
}

export function CommandPalette({ open, onClose, onSelectTool }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return TOOLS.slice(0, 8);
    return searchTools(TOOLS, query).slice(0, 12);
  }, [query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="command-palette-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        <div className="command-palette__search">
          <Search aria-hidden="true" />
          <div>
            <span id="command-palette-title" className="sr-only">Find a Compactor tool</span>
            <input
              type="search"
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActiveIndex(index => Math.min(results.length - 1, index + 1)); }
                if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(0, index - 1)); }
                if (event.key === 'Enter' && results[activeIndex]) {
                  onSelectTool(results[activeIndex].id);
                  onClose();
                }
              }}
              placeholder="What do you want to do?"
              aria-label="Search tools and actions"
            />
            <small>Try “lock PDF”, “remove location”, or “Word to PDF”</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close tool search"><X aria-hidden="true" /></button>
        </div>

        <div className="command-palette__body">
          <p>{query ? `${results.length} matching tools` : 'Suggested tools'}</p>
          <div className="command-palette__results">
            {results.map((tool, index) => {
              const ToolIcon = iconForTool(tool.id);
              return <button
                type="button"
                key={tool.id}
                onClick={() => { onSelectTool(tool.id); onClose(); }}
                className={index === activeIndex ? 'is-primary-result' : ''}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className={`command-palette__icon command-palette__icon--${tool.id.split('-')[0]}`}><ToolIcon aria-hidden="true" /></span>
                <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
                <ArrowRight aria-hidden="true" />
              </button>;
            })}
            {results.length === 0 ? <div className="command-palette__empty">No exact match. Try a file type or simpler action.</div> : null}
          </div>
        </div>

        <footer className="command-palette__footer">
          <span><ShieldCheck aria-hidden="true" /> Files stay on this device</span>
          <span><kbd>Enter</kbd> open <kbd>Esc</kbd> close <Command aria-hidden="true" /></span>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
