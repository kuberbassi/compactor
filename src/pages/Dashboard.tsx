import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowRight, Check, Clock3, Command, LockKeyhole, Search, ShieldCheck, Zap } from 'lucide-react';
import type { CategoryType } from './Dashboard/types';
import { CATEGORIES } from './Dashboard/types';
import { TOOLS } from './Dashboard/data';
import { ToolCard } from './Dashboard/ToolCard';
import type { ProcessedCountSnapshot } from '../utils/counterStorage';
import { searchTools } from '../utils/toolSearch';
import type { ToolItem } from './Dashboard/types';

const POPULAR_TOOL_IDS = ['pdf-compress', 'universal-converter', 'pdf-edit', 'image-optimizer', 'video-compressor', 'pdf-to-word'];
const ALL_TOOLS: ToolItem[] = TOOLS;

export function Dashboard({ onSelectTool, processedCount, recentToolIds = [], onOpenSearch = () => undefined }: { onSelectTool: (toolId: string) => void; processedCount: ProcessedCountSnapshot; recentToolIds?: string[]; onOpenSearch?: () => void }) {
  const [selectedCat, setSelectedCat] = useState<CategoryType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTools, setShowAllTools] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredTools = useMemo(() => {
    const matches = searchTools(ALL_TOOLS, deferredQuery);
    return selectedCat === 'ALL' ? matches : matches.filter(tool => tool.category === selectedCat);
  }, [deferredQuery, selectedCat]);
  const visibleTools = useMemo(() => {
    if (deferredQuery.trim() || showAllTools || selectedCat !== 'ALL') return filteredTools;
    return POPULAR_TOOL_IDS.map(id => ALL_TOOLS.find(tool => tool.id === id)).filter((tool): tool is ToolItem => Boolean(tool));
  }, [deferredQuery, filteredTools, selectedCat, showAllTools]);
  const recentTools = recentToolIds.map(id => ALL_TOOLS.find(tool => tool.id === id)).filter((tool): tool is ToolItem => Boolean(tool));
  const isLibraryOpen = showAllTools || Boolean(searchQuery.trim()) || selectedCat !== 'ALL';

  return <div className="dashboard-v2">
    <section className="dashboard-v2__hero" aria-labelledby="home-title">
      <div className="dashboard-v2__ambient" aria-hidden="true"><span /><span /><span /></div>
      <div className="dashboard-v2__hero-copy">
        <h1 id="home-title">Edit, convert,<br /><span>and keep control.</span></h1>
        <p>Work with PDFs, images, video, and audio directly in your browser—without uploading personal files to a processing server.</p>
        <div className="dashboard-v2__hero-actions"><button type="button" className="dashboard-v2__primary" onClick={() => document.getElementById('tool-library')?.scrollIntoView({ behavior: 'smooth' })}>Explore tools <ArrowRight /></button><button type="button" className="dashboard-v2__secondary" onClick={onOpenSearch}><Search /> Find anything <kbd>Ctrl K</kbd></button></div>
        <div className="dashboard-v2__proof" aria-label="Product benefits"><span><Check /> No uploads</span><span><Check /> No account</span><span><Check /> Works locally</span></div>
      </div>
      <div className="dashboard-v2__stage" aria-hidden="true">
        <div className="stage-orbit stage-orbit--one" /><div className="stage-orbit stage-orbit--two" />
        <div className="stage-file stage-file--back"><span>WAV</span><i /></div><div className="stage-file stage-file--side"><span>MP4</span><i /></div>
        <div className="stage-file stage-file--main"><div className="stage-file__top"><span>PDF</span><small>12.8 MB</small></div><div className="stage-file__lines"><i /><i /><i /><i /></div><div className="stage-file__result"><Zap /> Optimized <b>2.4 MB</b></div></div>
        <div className="stage-security"><ShieldCheck /><div><b>Processed locally</b><span>Your file never leaves this device</span></div></div>
      </div>
    </section>
    <section className="dashboard-v2__metrics" aria-label="Compactor statistics"><div><strong>{processedCount.count.toLocaleString()}</strong><span>{processedCount.scope === 'global' ? 'anonymous activity estimate' : 'files finished on this device'}</span></div><div><strong>{ALL_TOOLS.length}</strong><span>focused file tools</span></div><div><strong>Local</strong><span>browser processing</span></div><div><strong>0</strong><span>accounts required</span></div></section>
    <section className="dashboard-v2__finder" aria-labelledby="finder-title"><div><span><Command /> QUICK FINDER</span><h2 id="finder-title">What do you need to do?</h2><p>Search by action, file type, or outcome. Natural phrases work too.</p></div><label className="dashboard-v2__search"><Search /><span className="sr-only">Search all tools</span><input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && visibleTools[0]) onSelectTool(visibleTools[0].id); if (event.key === 'Escape') setSearchQuery(''); }} placeholder="Try “add text to PDF” or “remove photo location”" />{searchQuery ? <button type="button" onClick={() => setSearchQuery('')}>Clear</button> : <kbd>Ctrl K</kbd>}</label></section>
    {recentTools.length > 0 && !searchQuery && selectedCat === 'ALL' ? <section className="dashboard-v2__recent" aria-label="Recently used tools"><span><Clock3 /> Recent</span>{recentTools.map(tool => <button key={tool.id} type="button" onClick={() => onSelectTool(tool.id)}>{tool.title}</button>)}</section> : null}
    <section id="tool-library" className="dashboard-v2__library" aria-labelledby="library-title">
      <div className="dashboard-v2__section-heading"><div><span>THE TOOLKIT</span><h2 id="library-title">{searchQuery ? `${visibleTools.length} results` : isLibraryOpen ? 'All tools' : 'Start with the essentials'}</h2><p>{isLibraryOpen ? 'Everything you need, organized by the job.' : 'The tools people reach for most.'}</p></div><button type="button" onClick={() => { setSelectedCat('ALL'); setShowAllTools(value => !value); }}>{showAllTools ? 'Show essentials' : `View all ${ALL_TOOLS.length}`} <ArrowRight /></button></div>
      {isLibraryOpen ? <div className="dashboard-v2__filters" role="group" aria-label="Filter tools by category">{CATEGORIES.map(cat => <button key={cat} type="button" aria-pressed={selectedCat === cat} onClick={() => setSelectedCat(cat)}>{cat === 'AUDIO & CONVERT' ? 'AUDIO' : cat}<span>{cat === 'ALL' ? ALL_TOOLS.length : ALL_TOOLS.filter(tool => tool.category === cat).length}</span></button>)}</div> : null}
      <div className="dashboard-v2__grid">{visibleTools.map((tool, index) => <ToolCard key={tool.id} tool={tool} index={index} onSelectTool={onSelectTool} />)}</div>
      {visibleTools.length === 0 ? <div className="dashboard-v2__empty"><Search /><h3>No tool found</h3><p>Try a shorter task like “PDF”, “audio”, or “compress”.</p></div> : null}
    </section>
    <section className="dashboard-v2__privacy"><div className="dashboard-v2__privacy-mark"><LockKeyhole /></div><div><span>PRIVACY, BUILT IN</span><h2>Your files stay on your device.</h2><p>Supported processing runs locally in your browser. There is no upload queue, account requirement, or server-side file history.</p></div><div className="dashboard-v2__privacy-list"><span><Check /> Browser processing</span><span><Check /> No file retention</span><span><Check /> Download when ready</span></div></section>
  </div>;
}
