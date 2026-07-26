import React from 'react';

interface FooterProps {
  onNavigate?: (href: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="site-footer w-full py-6 sm:py-8 px-4 sm:px-6 border-t border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)] space-y-2.5 mt-12">
      <p className="font-medium text-[11px] sm:text-xs">Made for simpler, 100% private client-side file work.</p>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] font-medium text-zinc-400">
        <button 
          onClick={() => {
            window.location.hash = 'privacy';
            onNavigate?.('privacy');
          }}
          className="hover:text-white transition-colors cursor-pointer py-1 px-2 rounded hover:bg-zinc-800/50 min-h-[32px] flex items-center"
        >
          Privacy Policy
        </button>
        <span className="text-zinc-600">&bull;</span>
        <button 
          onClick={() => {
            window.location.hash = 'terms';
            onNavigate?.('terms');
          }}
          className="hover:text-white transition-colors cursor-pointer py-1 px-2 rounded hover:bg-zinc-800/50 min-h-[32px] flex items-center"
        >
          Terms &amp; Conditions
        </button>
      </div>

      <p className="font-mono pt-0.5 text-[10px] sm:text-[11px] leading-relaxed">
        &copy; {new Date().getFullYear()} Compactor &bull; Designed &amp; Developed by{' '}
        <span className="relative inline-block group/author">
          <a 
            href="https://kuberbassi.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            aria-label="Visit Kuber Bassi's portfolio website"
            className="text-[var(--text-primary)] font-bold underline underline-offset-4 transition-all duration-300 hover:text-white hover:[text-shadow:0_0_8px_rgba(255,255,255,0.9),0_0_20px_rgba(255,255,255,0.5),0_0_40px_rgba(255,255,255,0.2)]"
          >
            Kuber Bassi
          </a>
          {/* Tooltip */}
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 whitespace-nowrap rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-1.5 text-[10px] font-medium text-zinc-200 shadow-xl backdrop-blur-sm opacity-0 scale-95 translate-y-1 transition-all duration-200 group-hover/author:opacity-100 group-hover/author:scale-100 group-hover/author:translate-y-0"
          >
            🌐 Visit kuberbassi.com
            {/* Arrow */}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700/80" />
          </span>
        </span>
      </p>
    </footer>
  );
};
