import React, { useState, useEffect } from 'react';
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
    className="flex items-center gap-2 group focus:outline-none cursor-pointer"
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
  const [activeHoverGroup, setActiveHoverGroup] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('pdf');

  // Sync expanded group with active tool
  useEffect(() => {
    if (activeToolId) {
      const match = NAV_GROUPS.find(g => g.items.some(i => i.href === activeToolId));
      if (match) setExpandedGroup(match.label);
    }
  }, [activeToolId]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#simple-nav')) {
        setMenuOpen(false);
        setActiveHoverGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      id="simple-nav"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[99] w-[94%] max-w-4xl h-12 rounded-full border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-5 transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      onMouseLeave={() => setActiveHoverGroup(null)}
    >
      <Logo onClick={onBrandClick} />

      {/* Desktop Navigation Links */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Tools navigation">
        {NAV_GROUPS.map((group) => {
          const isActive = activeToolId?.startsWith(group.label) || activeHoverGroup === group.label;
          const hasMultipleItems = group.items.length > 1;

          return (
            <div 
              key={group.label}
              className="relative"
              onMouseEnter={() => setActiveHoverGroup(group.label)}
            >
              <button
                onClick={() => {
                  onLinkClick?.(group.defaultHref);
                  setActiveHoverGroup(null);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold lowercase tracking-wider transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                  isActive
                    ? 'text-white bg-zinc-800 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                }`}
              >
                <span>{group.label}</span>
                {hasMultipleItems && (
                  <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${
                    activeHoverGroup === group.label ? 'rotate-180 text-white' : ''
                  }`} />
                )}
              </button>

              {/* Charcoal Gray Dropdown Popup */}
              {hasMultipleItems && activeHoverGroup === group.label && (
                <div className="absolute top-[36px] left-1/2 -translate-x-1/2 w-48 p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 backdrop-blur-xl shadow-2xl space-y-0.5 z-[100] animate-in fade-in zoom-in-95 duration-150">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive = activeToolId === item.href;
                    return (
                      <button
                        key={item.href}
                        onClick={() => {
                          onLinkClick?.(item.href);
                          setActiveHoverGroup(null);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                          isItemActive
                            ? 'bg-zinc-800 text-white font-extrabold border border-zinc-700'
                            : 'hover:bg-zinc-800/80 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <ItemIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
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

      {/* Right Privacy Indicator Badge */}
      <div className="hidden md:flex items-center gap-2">
        <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300 flex items-center gap-1.5 shadow-sm">
          <span className="dot-glow-white shrink-0" />
          <span>100% Client-Side</span>
        </div>
      </div>

      {/* Mobile Hamburger (Perfect Centering) */}
      <button
        className="md:hidden w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-200 transition-colors cursor-pointer shrink-0"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Dropdown Menu Sheet */}
      {menuOpen && (
        <div className="absolute top-[54px] left-0 right-0 max-h-[82vh] overflow-y-auto border border-zinc-800 bg-zinc-950/98 backdrop-blur-2xl p-4 flex flex-col gap-3 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[100] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
            <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">All Tools Navigation</span>
            <div className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 flex items-center gap-1.5">
              <span className="dot-glow-white shrink-0" />
              <span>100% Client-Side</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pb-1">
            {NAV_GROUPS.map((group) => {
              const isExpanded = expandedGroup === group.label;
              return (
                <div key={group.label} className="bg-zinc-900/60 rounded-2xl border border-zinc-800/80 overflow-hidden">
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span>{group.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold">
                        {group.items.length}
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-white' : ''
                    }`} />
                  </button>

                  {isExpanded && (
                    <div className="p-1.5 border-t border-zinc-800/60 space-y-0.5 animate-in fade-in duration-150">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = activeToolId === item.href;
                        return (
                          <button
                            key={item.href}
                            onClick={() => {
                              onLinkClick?.(item.href);
                              setMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                              isItemActive
                                ? 'bg-zinc-800 text-white font-black border border-zinc-700'
                                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                            }`}
                          >
                            <ItemIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleNav;
