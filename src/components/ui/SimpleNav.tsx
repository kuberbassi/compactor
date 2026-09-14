import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrandMark } from '../Common/BrandMark';
import { pathForTool } from '../../config/toolRoutes';
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
  Lock,
  Layers,
  Scissors,
  FilePlus,
  Sliders,
  Disc,
  ShieldOff,
  Search,
  Menu,
  X,
  ArrowUpRight,
  Home,
  ShieldCheck
} from 'lucide-react';
import { TOOLS } from '../../pages/Dashboard/data';

export interface SimpleNavProps {
  onBrandClick?: () => void;
  onLinkClick?: (href: string) => void;
  forceBg?: boolean;
  activeToolId?: string | null;
  onOpenSearch?: () => void;
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
    label: 'Video',
    defaultHref: 'video-compressor',
    items: [
      { label: 'Compress Video', href: 'video-compressor', icon: Video },
      { label: 'Video to Audio', href: 'video-to-audio', icon: Music },
      { label: 'Video to GIF', href: 'video-to-gif', icon: Zap },
      { label: 'Mute Video', href: 'video-mute', icon: VolumeX }
    ]
  },
  {
    label: 'PDF',
    defaultHref: 'pdf-edit',
    items: [
      { label: 'Edit PDF', href: 'pdf-edit', icon: FileText },
      { label: 'Compress PDF', href: 'pdf-compress', icon: Sliders },
      { label: 'Organize Pages', href: 'pdf-organize', icon: Layers },
      { label: 'Merge PDF', href: 'pdf-merge', icon: FilePlus },
      { label: 'Split PDF', href: 'pdf-split', icon: Scissors },
      { label: 'PDF Security', href: 'pdf-protect', icon: ShieldOff },
      { label: 'PDF to Images', href: 'pdf-to-image', icon: ImageIcon },
      { label: 'Markdown to PDF', href: 'pdf-word-to-pdf', icon: FileText },
    ]
  },
  {
    label: 'Images',
    defaultHref: 'image-optimizer',
    items: [
      { label: 'Edit an Image', href: 'image-optimizer', icon: ImageIcon },
      { label: 'Images to PDF', href: 'pdf-jpg-to-pdf', icon: FilePlus },
      { label: 'Make a Poster', href: 'rasterbator', icon: Grid }
    ]
  },
  {
    label: 'Audio',
    defaultHref: 'audio-optimizer',
    items: [
      { label: 'Compress Audio', href: 'audio-optimizer', icon: Music },
      { label: 'Join Audio', href: 'audio-joiner', icon: Layers },
      { label: 'Key & BPM Finder', href: 'audio-bpm-finder', icon: Disc },
      { label: 'Pitch & Speed', href: 'audio-pitch-speed', icon: Sliders }
    ]
  },
  {
    label: 'Convert',
    defaultHref: 'universal-converter',
    items: [
      { label: 'Convert Files', href: 'universal-converter', icon: RefreshCw },
      { label: 'Edit Metadata', href: 'metadata-editor', icon: Tag }
    ]
  }
];

const Logo: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="nav-brand group"
    aria-label="Compactor home"
  >
    <BrandMark className="brand-mark" />
    <span><strong>compactor</strong><small>FILE WORKSPACE</small></span>
  </button>
);

const SimpleNav: React.FC<SimpleNavProps> = ({
  onBrandClick,
  onLinkClick,
  activeToolId,
  onOpenSearch,
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

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className="app-nav"
        onMouseLeave={() => setActiveDesktopGroup(null)}
      >
        <Logo onClick={onBrandClick} />

        {/* Desktop Navigation */}
        <nav className="nav-desktop hidden md:flex" aria-label="Primary tools navigation">
          {NAV_GROUPS.map((group) => {
            const isActive = Boolean(activeToolId && group.items.some(item => item.href === activeToolId));
            const hasMultipleItems = group.items.length > 1;
            const isOpen = activeDesktopGroup === group.label;

            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setActiveDesktopGroup(null)}
              >
                <button
                  onClick={() => {
                    onLinkClick?.(group.defaultHref);
                    setActiveDesktopGroup(null);
                  }}
                  className={`nav-desktop__trigger ${
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
                  <div data-nav-group-items={group.label} className="nav-dropdown">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = activeToolId === item.href;
                      return (
                        <a
                          key={item.href}
                          href={pathForTool(item.href)}
                          onClick={(event) => {
                            event.preventDefault();
                            onLinkClick?.(item.href);
                            setActiveDesktopGroup(null);
                          }}
                          className={`nav-dropdown__item ${
                            isItemActive
                              ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold border border-[var(--border-color)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          <span className="truncate">{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right Privacy Badge */}
        <div className="nav-actions hidden md:flex">
          <button type="button" onClick={onOpenSearch} className="app-nav__search" aria-label="Search all tools">
            <Search aria-hidden="true" />
            <span>Find a tool</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="nav-private">
            <Lock className="w-3.5 h-3.5" />
            <span>Private</span>
          </div>
        </div>

        {/* Mobile Hamburger â€” perfectly centered */}
        <button
          className="nav-mobile-toggle md:hidden"
          onClick={() => menuOpen ? closeMenu() : openMenu()}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="simple-nav-sheet"
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
          className="nav-mobile-sheet max-h-[78vh] overflow-y-auto overscroll-contain"
        >
          <div className="nav-mobile-sheet__header">
            <div><strong>Explore Compactor</strong><span>{TOOLS.length} focused browser tools</span></div>
            <span className="nav-mobile-sheet__privacy"><ShieldCheck /> Local file processing</span>
          </div>

          <div className="nav-mobile-sheet__quick-actions">
            <button type="button" onClick={() => { closeMenu(); onBrandClick?.(); }}><Home /><span>Home</span></button>
            <button type="button" onClick={() => { closeMenu(); onOpenSearch?.(); }}><Search /><span>Find a tool</span></button>
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
                    aria-expanded={isExpanded}
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
                            <a
                              key={item.href}
                              href={pathForTool(item.href)}
                              onClick={(event) => {
                                event.preventDefault();
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
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="nav-mobile-sheet__footer">
            <button type="button" onClick={() => { closeMenu(); onLinkClick?.('privacy'); }}>Privacy</button>
            <button type="button" onClick={() => { closeMenu(); onLinkClick?.('terms'); }}>Terms</button>
            <a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer">About <ArrowUpRight /></a>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SimpleNav;
