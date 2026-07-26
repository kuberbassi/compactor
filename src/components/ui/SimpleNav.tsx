import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrandMark } from '../Common/BrandMark';
import { 
  ChevronDown, 
  Video, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  RefreshCw, 
  Grid, 
  Tag, 
  Zap,
  VolumeX,
  FileCode,
  Lock,
  Stamp,
  Crop,
  Layers,
  Scissors,
  Key,
  FilePlus,
  Sliders,
  ShieldOff,
  Menu,
  X
} from 'lucide-react';

export interface SimpleNavProps {
  onBrandClick?: () => void;
  onLinkClick?: (href: string) => void;
  forceBg?: boolean;
  activeToolId?: string | null;
}

interface NavGroup {
  label: string;
  defaultHref: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'video',
    defaultHref: 'video-compressor',
    items: [
      { label: 'Compress Video', href: 'video-compressor', icon: Video },
      { label: 'Video to Audio', href: 'video-to-audio', icon: Music },
      { label: 'Video to GIF', href: 'video-to-gif', icon: Zap },
      { label: 'Mute Video', href: 'video-mute', icon: VolumeX }
    ]
  },
  {
    label: 'pdf',
    defaultHref: 'pdf-organize',
    items: [
      { label: 'Organize Pages', href: 'pdf-organize', icon: Layers },
      { label: 'Merge PDFs', href: 'pdf-merge', icon: FilePlus },
      { label: 'Split PDF', href: 'pdf-split', icon: Scissors },
      { label: 'Crop Margins', href: 'pdf-crop-tool', icon: Crop },
      { label: 'Compress PDF', href: 'pdf-compress', icon: Sliders },
      { label: 'Sign & Stamp PDF', href: 'pdf-stamps', icon: Stamp },
      { label: 'Redact & Censor', href: 'pdf-redact', icon: ShieldOff },
      { label: 'Flatten Form Fields', href: 'pdf-flatten', icon: Lock },
      { label: 'Sign Document', href: 'pdf-sign', icon: Stamp },
      { label: 'Add Watermark', href: 'pdf-watermark', icon: FileText },
      { label: 'Protect Password', href: 'pdf-protect', icon: Lock },
      { label: 'Unlock PDF', href: 'pdf-unlock', icon: Key },
      { label: 'Page Numbers', href: 'pdf-page-numbers', icon: FileCode },
      { label: 'PDF to Images', href: 'pdf-to-image', icon: ImageIcon },
      { label: 'Images to PDF', href: 'pdf-jpg-to-pdf', icon: ImageIcon },
      { label: 'Markdown to PDF', href: 'pdf-word-to-pdf', icon: FileCode },
      { label: 'PDF to Markdown', href: 'pdf-to-word', icon: FileText }
    ]
  },
  {
    label: 'images',
    defaultHref: 'image-optimizer',
    items: [
      { label: 'Edit an Image', href: 'image-optimizer', icon: ImageIcon },
      { label: 'Make a Poster', href: 'rasterbator', icon: Grid }
    ]
  },
  {
    label: 'audio',
    defaultHref: 'audio-optimizer',
    items: [
      { label: 'Compress Audio', href: 'audio-optimizer', icon: Music }
    ]
  },
  {
    label: 'convert',
    defaultHref: 'universal-converter',
    items: [
      { label: 'Universal Converter', href: 'universal-converter', icon: RefreshCw }
    ]
  },
  {
    label: 'metadata',
    defaultHref: 'metadata-editor',
    items: [
      { label: 'Edit Metadata', href: 'metadata-editor', icon: Tag }
    ]
  }
];

const Logo: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 group focus:outline-none cursor-pointer shrink-0"
    aria-label="Compactor home"
  >
    <BrandMark className="brand-mark" />
    <span className="text-sm font-black tracking-tight text-white group-hover:text-zinc-300 transition-colors">
      compactor
    </span>
  </button>
);

const SimpleNav: React.FC<SimpleNavProps> = ({
  onBrandClick,
  onLinkClick,
  activeToolId,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuState, setMenuState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  // Desktop: toggled group (click/touch-friendly for tablets)
  const [activeDesktopGroup, setActiveDesktopGroup] = useState<string | null>(null);
  // Mobile accordion expanded group
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [sheetPos, setSheetPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  // Sync expanded group with active tool
  useEffect(() => {
    if (activeToolId) {
      const match = NAV_GROUPS.find(g => g.items.some(i => i.href === activeToolId));
      if (match) setExpandedGroup(match.label);
    }
  }, [activeToolId]);

  // Open menu: calculate position, mount sheet, then transition to open
  const openMenu = () => {
    if (navRef.current) {
      const r = navRef.current.getBoundingClientRect();
      setSheetPos({ top: r.bottom + 8, left: r.left, width: r.width });
    }
    setMenuOpen(true);
    setMenuState('opening');
    // Two rAFs ensure the DOM is painted in 'opening' state before transitioning
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuState('open')));
  };

  // Close menu: play exit animation, then unmount
  const closeMenu = () => {
    setMenuState('closing');
    setTimeout(() => {
      setMenuOpen(false);
      setMenuState('closed');
    }, 230); // slightly longer than CSS duration so animation completes
  };

  // Calculate sheet position whenever menuOpen changes
  useEffect(() => {
    if (menuOpen && navRef.current) {
      const r = navRef.current.getBoundingClientRect();
      setSheetPos({ top: r.bottom + 8, left: r.left, width: r.width });
    }
  }, [menuOpen]);

  // Lock body scroll while sheet is open â€” prevents page scrolling behind the menu
  useEffect(() => {
    if (menuOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const top = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (top) window.scrollTo(0, -parseInt(top, 10));
    }
    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [menuOpen]);

  // Recalculate sheet position on resize only
  useEffect(() => {
    if (!menuOpen) return;
    const update = () => {
      if (navRef.current) {
        const r = navRef.current.getBoundingClientRect();
        setSheetPos({ top: r.bottom + 8, left: r.left, width: r.width });
      }
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [menuOpen]);

  // Close on outside click/touch
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#simple-nav') && !target.closest('#simple-nav-sheet')) {
        if (menuState === 'open' || menuState === 'opening') closeMenu();
        setActiveDesktopGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuState]);

  // Close dropdowns on route change
  useEffect(() => {
    if (menuState === 'open' || menuState === 'opening') closeMenu();
    setActiveDesktopGroup(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToolId]);

  return (
    <>
      <div
        id="simple-nav"
        ref={navRef}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-[94%] max-w-4xl h-12 rounded-full border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl flex items-center justify-between px-4 sm:px-5 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        onMouseLeave={() => setActiveDesktopGroup(null)}
      >
        <Logo onClick={onBrandClick} />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5" aria-label="Tools navigation">
          {NAV_GROUPS.map((group) => {
            const isActive = (activeToolId && NAV_GROUPS.find(g => g.label === group.label)?.items.some(i => i.href === activeToolId)) || activeDesktopGroup === group.label;
            const hasMultipleItems = group.items.length > 1;
            const isOpen = activeDesktopGroup === group.label;

            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => hasMultipleItems && setActiveDesktopGroup(group.label)}
              >
                <button
                  onClick={() => {
                    if (hasMultipleItems) {
                      setActiveDesktopGroup(prev => prev === group.label ? null : group.label);
                    } else {
                      onLinkClick?.(group.defaultHref);
                      setActiveDesktopGroup(null);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold lowercase tracking-wider transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'text-white bg-zinc-800 border border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
                >
                  <span>{group.label}</span>
                  {hasMultipleItems && (
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-white' : 'text-zinc-500'
                    }`} />
                  )}
                </button>

                {/* Desktop Dropdown â€” site charcoal colors */}
                {hasMultipleItems && isOpen && (
                  <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 min-w-[11rem] p-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)] shadow-[0_16px_40px_rgba(0,0,0,0.25)] space-y-0.5 z-[1000] animate-in fade-in zoom-in-95 duration-150">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = activeToolId === item.href;
                      return (
                        <button
                          key={item.href}
                          onClick={() => {
                            onLinkClick?.(item.href);
                            setActiveDesktopGroup(null);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-100 flex items-center gap-2 cursor-pointer ${
                            isItemActive
                              ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold border border-[var(--border-color)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right Privacy Badge */}
        <div className="hidden md:flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300 flex items-center gap-1.5 shadow-sm">
            <span className="dot-glow-white shrink-0" />
            <span>100% Client-Side</span>
          </div>
        </div>

        {/* Mobile Hamburger â€” perfectly centered */}
        <button
          className="md:hidden w-8 h-8 rounded-lg hover:bg-zinc-800/70 flex items-center justify-center text-zinc-200 transition-colors cursor-pointer shrink-0"
          onClick={() => menuOpen ? closeMenu() : openMenu()}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <div className={`transition-all duration-200 ${menuOpen ? 'rotate-90 scale-110' : 'rotate-0 scale-100'}`}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </div>
        </button>
      </div>

      {/* Mobile Sheet â€” portaled to body, with smooth open/close animation */}
      {menuOpen && typeof document !== 'undefined' && createPortal(
        <div
          id="simple-nav-sheet"
          style={{
            position: 'fixed',
            top: sheetPos.top,
            left: sheetPos.left,
            width: sheetPos.width,
            zIndex: 9998,
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            // State-driven transition classes applied via inline for reliable triggering
            opacity: menuState === 'open' ? 1 : 0,
            transform: menuState === 'open'
              ? 'translateY(0) scale(1)'
              : menuState === 'closing'
              ? 'translateY(-6px) scale(0.97)'
              : 'translateY(-10px) scale(0.96)',
            transition: 'opacity 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)',
          }}
          className="max-h-[78vh] overflow-y-auto overscroll-contain rounded-3xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          {/* Header â€” sticky, same glass as pill */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl">
            <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              All Tools
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-300">
              <span className="dot-glow-white shrink-0" />
              <span>100% Private</span>
            </div>
          </div>

          {/* Accordion Groups */}
          <div className="p-2 flex flex-col gap-1 pb-3">
            {NAV_GROUPS.map((group) => {
              const isExpanded = expandedGroup === group.label;
              return (
                <div
                  key={group.label}
                  className="rounded-2xl border border-zinc-800/70 overflow-hidden bg-zinc-800/20"
                >
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span>{group.label}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold">
                        {group.items.length}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isExpanded ? 'rotate-180 text-zinc-200' : ''
                      }`}
                    />
                  </button>

                  {/* CSS grid-rows trick: animates height without knowing exact px */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-1.5 pb-1.5 border-t border-zinc-800/60 space-y-0.5 pt-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          const isItemActive = activeToolId === item.href;
                          return (
                            <button
                              key={item.href}
                              onClick={() => {
                                onLinkClick?.(item.href);
                                closeMenu();
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                                isItemActive
                                  ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                              }`}
                            >
                              <ItemIcon className="w-4 h-4 shrink-0 text-zinc-500" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SimpleNav;
