import { useState, useMemo } from 'react';
import type { CategoryType } from './Dashboard/types';
import { CATEGORIES } from './Dashboard/types';
import { TOOLS } from './Dashboard/data';
import { ToolCard } from './Dashboard/ToolCard';
import type { ProcessedCountSnapshot } from '../utils/counterStorage';

export function Dashboard({ 
  onSelectTool, 
  processedCount
}: { 
  onSelectTool: (toolId: string) => void; 
  processedCount: ProcessedCountSnapshot;
}) {
  const [selectedCat, setSelectedCat] = useState<CategoryType>('ALL');

  const filteredTools = useMemo(() => {
    if (selectedCat === 'ALL') return TOOLS;
    return TOOLS.filter(t => t.category === selectedCat);
  }, [selectedCat]);

  return (
    <div className="max-w-6xl mx-auto px-2 xs:px-3 sm:px-6 py-4 xs:py-6 sm:py-8 space-y-4 xs:space-y-6 sm:space-y-8">
      
      {/* HERO HEADER */}
      <header className="text-center space-y-2.5 xs:space-y-3 sm:space-y-4 pt-18 xs:pt-20 sm:pt-20 px-1">
        <div className="inline-flex items-center gap-1.5 xs:gap-2 px-2 xs:px-2.5 sm:px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900 shadow-sm max-w-full">
          <span className="status-dot-glow shrink-0" />
          <span className="text-[8.5px] xs:text-[9px] sm:text-[10px] md:text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider truncate">
            EVERYTHING IN ONE PLACE
          </span>
        </div>

        <h1 className="text-[clamp(1.5rem,7.5vw,4rem)] sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[0.95] px-1">
          Less file fuss.<br />
          <em className="not-italic text-zinc-400 font-serif italic">More flow.</em>
        </h1>

        <p className="text-[10.5px] xs:text-[11px] sm:text-sm md:text-base text-zinc-400 max-w-xs xs:max-w-sm sm:max-w-xl mx-auto leading-relaxed px-1">
          Thoughtful tools to make your files lighter, tidier, and ready to share.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-mono text-zinc-400 pt-0.5 max-w-full px-1">
          <div className="px-2 xs:px-2.5 sm:px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 font-medium text-zinc-200 flex items-center gap-1.5 max-w-[240px] xs:max-w-[260px] sm:max-w-full truncate">
            <span className="dot-glow-white shrink-0" />
            <span className="truncate text-[9.5px] xs:text-[10px] sm:text-xs">
              {processedCount.count.toLocaleString()} files finished {processedCount.scope === 'global' ? 'globally' : 'on this device'}
            </span>
          </div>
          <span className="text-zinc-600 font-bold hidden sm:inline">&bull;</span>
          <div className="px-2.5 sm:px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-[10px] sm:text-xs truncate hidden xs:block">
            Pick a tool to begin
          </div>
        </div>
      </header>

      {/* CONCENTRIC RADII CATEGORY TABS */}
      <div className="w-full flex justify-center my-2.5 sm:my-6">
        <div className="dashboard-category-tabs flex items-center gap-0.5 sm:gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm w-full overflow-x-auto no-scrollbar scrollbar-none" style={{WebkitOverflowScrolling: 'touch'}}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCat === cat;
            const count = cat === 'ALL' ? TOOLS.length : TOOLS.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-1.5 xs:px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 min-h-[32px] xs:min-h-[36px] ${
                  isActive
                    ? 'bg-zinc-800 text-white font-extrabold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span className="whitespace-nowrap">{cat === 'ALL' ? 'ALL' : cat === 'AUDIO & CONVERT' ? 'AUDIO' : cat}</span>
                <span className={`text-[8px] xs:text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 rounded-md font-bold ${
                  isActive ? 'bg-zinc-950 text-white' : 'bg-zinc-900 text-zinc-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SHOWCASE GRID SECTION */}
      <section aria-label="Media Tools Suite">
        <h2 className="sr-only">Available Media Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onSelectTool={onSelectTool} />
          ))}
        </div>
      </section>
    </div>
  );
}
