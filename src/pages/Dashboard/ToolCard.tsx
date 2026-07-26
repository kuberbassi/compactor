import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { ToolItem } from './types';
import { IllustrationBanner } from './IllustrationBanner';

interface ToolCardProps {
  tool: ToolItem;
  onSelectTool: (toolId: string) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onSelectTool }) => {
  return (
    <div
      onClick={() => onSelectTool(tool.id)}
      className="group bg-zinc-900/70 border border-zinc-800/90 hover:border-zinc-500 hover:bg-zinc-900/95 rounded-2xl overflow-hidden hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.98]"
    >
      {/* Visual Vector Illustration Banner */}
      <div className="w-full h-26 xs:h-28 sm:h-32 lg:h-36 bg-gradient-to-b from-zinc-900 to-zinc-950/80 border-b border-zinc-800 relative overflow-hidden flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-200">
        <IllustrationBanner type={tool.illustrationType} />
        
        <span className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[8px] sm:text-[9px] font-mono font-bold px-2 sm:px-2.5 py-0.5 rounded-full shadow-sm tracking-wider uppercase">
          {tool.category === 'AUDIO & CONVERT' ? 'AUDIO' : tool.category}
        </span>
      </div>

      {/* Card Content & Feature Tags */}
      <div className="p-2.5 xs:p-3 sm:p-4 space-y-2 sm:space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1 sm:space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs xs:text-[13px] sm:text-sm font-bold text-white group-hover:text-zinc-100 transition-colors leading-snug flex-1 min-w-0 pr-2">
              {tool.title}
            </h3>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-800/90 group-hover:!bg-white flex items-center justify-center transition-all duration-200 shadow-sm border border-zinc-700 group-hover:!border-white shrink-0">
              <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400 group-hover:!text-black transition-colors stroke-[2.5]" />
            </div>
          </div>

          <span className="text-[9.5px] xs:text-[10px] sm:text-[11px] font-bold text-zinc-300 block">
            {tool.subtitle}
          </span>

          <p className="text-[10.5px] xs:text-[11px] sm:text-xs text-zinc-400 leading-relaxed font-normal line-clamp-2 sm:line-clamp-none">
            {tool.description}
          </p>
        </div>

        {/* Micro Feature Tags */}
        <div className="pt-2 sm:pt-2.5 border-t border-zinc-800/80 flex flex-wrap gap-1 sm:gap-1.5 max-w-full overflow-hidden">
          {tool.tags.slice(0, 3).map((tag, i) => (
            <span 
              key={i} 
              className="px-1.5 sm:px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[8.5px] xs:text-[9px] sm:text-[10px] font-mono text-zinc-300 font-medium flex items-center gap-1 sm:gap-1.5 shadow-sm group-hover:border-zinc-600 transition-colors max-w-full min-w-0"
            >
              <span className="w-1 h-1 rounded-full bg-zinc-400 group-hover:bg-white transition-colors shrink-0" />
              <span className="truncate max-w-[130px] xs:max-w-[170px] sm:max-w-full">{tag}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
