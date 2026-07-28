import React, { useEffect, useState } from 'react';

export const EmbedWatermark: React.FC = () => {
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.self !== window.top) {
        setIsEmbedded(true);
      }
    } catch {
      // Cross-origin iframe security restriction caught
      setIsEmbedded(true);
    }
  }, []);

  if (!isEmbedded) return null;

  return (
    <aside
      aria-label="Embedded Compactor Suite"
      className="fixed bottom-3 right-3 z-[99999] flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/90 border border-zinc-800 text-white text-[11px] font-mono shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform hover:scale-105"
    >
      <img
        src="/compactor-embed.png"
        alt="Compactor"
        className="w-5 h-5 rounded-full object-cover border border-zinc-700 shrink-0"
      />
      <span className="font-semibold text-zinc-300">
        Powered by <strong className="text-white">Compactor</strong>
      </span>
      <a
        href="https://compactor.kuberbassi.com"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
      >
        Open Site ↗
      </a>
    </aside>
  );
};
