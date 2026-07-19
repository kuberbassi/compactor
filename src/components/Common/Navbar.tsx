import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Sparkles, LayoutDashboard, Video, FileText, Image as ImageIcon, Music } from 'lucide-react';

interface NavbarProps {
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onGoHome, onSelectTool }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="glass-nav flex items-center justify-between px-6 z-[100]">
      {/* Brand Logo */}
      <div 
        className="flex items-center gap-2.5 font-extrabold text-sm select-none cursor-pointer text-zinc-900 dark:text-zinc-50 tracking-tight hover:opacity-90 transition-opacity"
        onClick={onGoHome}
      >
        <img src="/logo.png" className="w-5 h-5 object-contain" alt="Compactor Logo" />
        <span className="text-base font-black bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">Compactor</span>
        <span className="hidden sm:inline-flex text-[9px] bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded-full font-bold items-center gap-0.5 border border-sky-200/50">
          <Sparkles className="w-2.5 h-2.5" /> Client Sandbox
        </span>
      </div>

      {/* Nav Links */}
      <nav className="hidden md:flex items-center gap-1">
        <button
          onClick={onGoHome}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer"
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
        </button>
        <button
          onClick={() => onSelectTool('video-compressor')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer"
        >
          <Video className="w-3.5 h-3.5 text-blue-500" /> Video
        </button>
        <button
          onClick={() => onSelectTool('pdf-merge')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-pink-500" /> PDF
        </button>
        <button
          onClick={() => onSelectTool('image-optimizer')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer"
        >
          <ImageIcon className="w-3.5 h-3.5 text-teal-500" /> Image
        </button>
        <button
          onClick={() => onSelectTool('audio-optimizer')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer"
        >
          <Music className="w-3.5 h-3.5 text-lime-500" /> Audio
        </button>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <button 
          className="icon-btn w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer" 
          onClick={toggleTheme} 
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
