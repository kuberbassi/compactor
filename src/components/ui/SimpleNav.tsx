import React, { useState, useEffect } from 'react';
import { BrandMark } from '../Common/BrandMark';

export interface SimpleNavLink {
  label: string;
  href: string;
}

export interface SimpleNavProps {
  onBrandClick?: () => void;
  onLinkClick?: (href: string) => void;
  forceBg?: boolean;
  activeToolId?: string | null;
}

const Logo: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 group focus:outline-none"
    aria-label="Compactor home"
  >
    <BrandMark className="brand-mark" />
    <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50 group-hover:opacity-70 transition-opacity duration-150">
      compactor
    </span>
  </button>
);

const TOOL_LINKS = [
  { label: 'images', href: 'image-optimizer' },
  { label: 'video', href: 'video-compressor' },
  { label: 'pdf', href: 'pdf-organize' },
  { label: 'audio', href: 'audio-optimizer' },
  { label: 'convert', href: 'universal-converter' },
  { label: 'poster', href: 'rasterbator' },
];

const SimpleNav: React.FC<SimpleNavProps> = ({
  onBrandClick,
  onLinkClick,
  activeToolId,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#simple-nav')) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      id="simple-nav"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[99] w-[92%] max-w-2xl h-12 rounded-full border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-lg flex items-center justify-between px-5 transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
    >
      <Logo onClick={onBrandClick} />

      {/* Desktop links */}
      <nav className="hidden md:flex items-center gap-1.5" aria-label="Tools navigation">
        {TOOL_LINKS.map((link) => {
          const isActive = activeToolId?.startsWith(link.href.split('-')[0]);
          return (
            <button
              key={link.href}
              onClick={() => onLinkClick?.(link.href)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold lowercase tracking-wider transition-all duration-150 ${
                isActive
                  ? 'text-white bg-zinc-900 border border-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="hidden md:block">
        <span className="nav-note">Files stay on your device</span>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden flex flex-col gap-1 p-2 rounded hover:bg-zinc-900 transition-colors"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        <span
          className={`block w-4 h-0.5 bg-zinc-200 transition-all duration-150 ${
            menuOpen ? 'translate-y-1.5 rotate-45' : ''
          }`}
        />
        <span
          className={`block w-4 h-0.5 bg-zinc-200 transition-all duration-150 ${
            menuOpen ? 'opacity-0' : ''
          }`}
        />
        <span
          className={`block w-4 h-0.5 bg-zinc-200 transition-all duration-150 ${
            menuOpen ? '-translate-y-1.5 -rotate-45' : ''
          }`}
        />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-[52px] left-0 right-0 border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-1 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          {TOOL_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => {
                onLinkClick?.(link.href);
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold lowercase text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimpleNav;
