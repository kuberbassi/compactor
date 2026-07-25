import React from 'react';

interface FooterProps {
  onNavigate?: (href: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="site-footer py-8 border-t border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)] space-y-2 mt-12">
      <p className="font-medium">Made for simpler, 100% private client-side file work.</p>

      <div className="flex items-center justify-center gap-3 text-[11px] font-medium text-zinc-400">
        <button 
          onClick={() => {
            window.location.hash = 'privacy';
            onNavigate?.('privacy');
          }}
          className="hover:text-white transition-colors cursor-pointer"
        >
          Privacy Policy
        </button>
        <span>&bull;</span>
        <button 
          onClick={() => {
            window.location.hash = 'terms';
            onNavigate?.('terms');
          }}
          className="hover:text-white transition-colors cursor-pointer"
        >
          Terms & Conditions
        </button>
      </div>

      <p className="font-mono pt-1 text-[11px]">
        &copy; {new Date().getFullYear()} Compactor &bull; Designed & Developed by{' '}
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
