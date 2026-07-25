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
        <a 
          href="https://kuberbassi.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[var(--text-primary)] hover:text-white font-bold underline underline-offset-4 transition-colors"
        >
          Kuber Bassi
        </a>
      </p>
    </footer>
  );
};
