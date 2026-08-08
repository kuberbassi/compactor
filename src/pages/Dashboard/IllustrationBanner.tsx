import React from 'react';

/**
 * Visual Vector Illustration Card Banners
 */
export const IllustrationBanner: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'video-compress':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-purple-500/30 bg-purple-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="absolute inset-x-3 inset-y-2.5 rounded-lg border border-purple-400/20 flex items-center justify-between px-3">
              <div className="w-7 h-7 rounded-lg bg-purple-500/30 border border-purple-400/50 flex items-center justify-center shadow">
                <span className="text-[10px] text-purple-200 font-mono font-bold">4K</span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="w-12 h-1 bg-purple-400/40 rounded-full" />
              </div>
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shadow">
                <span className="text-[9px] text-purple-300 font-mono font-bold">720p</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'video-audio':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-blue-500/30 bg-blue-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900 border border-blue-400/40 flex items-center justify-center text-[10px] font-mono text-blue-200 font-bold shadow">
                MP4
              </div>
              <span className="text-blue-400 text-xs font-mono font-bold animate-pulse">➔</span>
              <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center text-[10px] font-mono text-blue-200 font-bold shadow-lg shadow-blue-500/20">
                MP3
              </div>
            </div>
          </div>
        </div>
      );

    case 'video-gif':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-pink-500/30 bg-pink-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="px-3 py-1.5 rounded-lg border border-pink-400/40 bg-pink-900/50 flex items-center gap-2 shadow">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
              <span className="text-xs font-mono font-bold text-pink-200 uppercase tracking-wider">GIF LOOP</span>
            </div>
          </div>
        </div>
      );

    case 'video-mute':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-zinc-700 bg-zinc-900/60 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 shadow">
              <span className="text-xs text-red-400 font-mono font-bold">🔇 MUTE</span>
              <span className="text-[10px] text-zinc-400 font-mono">0 Kbps Audio</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-edit':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="relative w-16 h-18 rounded-md bg-zinc-100 border border-violet-300/70 shadow-lg p-2">
              <div className="h-1 w-9 rounded bg-zinc-400/60 mb-1.5" />
              <div className="h-1 w-11 rounded bg-zinc-300 mb-1" />
              <div className="h-1 w-8 rounded bg-zinc-300" />
              <div className="absolute left-3 bottom-3 w-7 h-4 border-2 border-violet-500 rounded-sm bg-violet-200/40" />
              <div className="absolute -right-2 top-4 w-6 h-6 rounded-full bg-violet-500 border-2 border-zinc-950 text-white text-xs font-black flex items-center justify-center shadow-lg">
                T
              </div>
            </div>
          </div>
        </div>
      );

    case 'pdf-organize':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-emerald-500/30 bg-emerald-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="grid grid-cols-3 gap-1.5 p-2 bg-zinc-900/80 border border-emerald-500/30 rounded-lg">
              <div className="w-6 h-8 bg-emerald-500/20 border border-emerald-400/50 rounded flex items-center justify-center text-[9px] font-mono text-emerald-300 font-bold">1</div>
              <div className="w-6 h-8 bg-emerald-500/30 border border-emerald-400 rounded flex items-center justify-center text-[9px] font-mono text-white font-bold shadow-md">2</div>
              <div className="w-6 h-8 bg-emerald-500/20 border border-emerald-400/50 rounded flex items-center justify-center text-[9px] font-mono text-emerald-300 font-bold">3</div>
            </div>
          </div>
        </div>
      );

    case 'pdf-merge':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-950/60 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            {/* ambient glow */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-10 rounded-full bg-teal-500/10 blur-xl" />
            <div className="flex items-center gap-2">
              {/* Doc A */}
              <div className="w-8 h-10 rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-900 border border-teal-500/50 flex flex-col items-center justify-center gap-0.5 shadow-md">
                <div className="w-4 h-0.5 rounded-full bg-teal-400/60" />
                <div className="w-4 h-0.5 rounded-full bg-teal-400/40" />
                <div className="w-4 h-0.5 rounded-full bg-teal-400/25" />
                <span className="text-[7px] font-mono text-teal-300 font-bold mt-0.5">A</span>
              </div>
              {/* Plus */}
              <span className="text-teal-400 font-black text-sm leading-none">+</span>
              {/* Doc B */}
              <div className="w-8 h-10 rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-900 border border-teal-500/50 flex flex-col items-center justify-center gap-0.5 shadow-md">
                <div className="w-4 h-0.5 rounded-full bg-teal-400/60" />
                <div className="w-4 h-0.5 rounded-full bg-teal-400/40" />
                <div className="w-4 h-0.5 rounded-full bg-teal-400/25" />
                <span className="text-[7px] font-mono text-teal-300 font-bold mt-0.5">B</span>
              </div>
              {/* Arrow */}
              <span className="text-teal-400 font-bold text-sm animate-pulse">→</span>
              {/* Combined */}
              <div className="w-10 h-12 rounded-lg bg-gradient-to-b from-teal-600/40 to-teal-900/60 border border-teal-400 flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-teal-500/20">
                <div className="w-5 h-0.5 rounded-full bg-teal-300/80" />
                <div className="w-5 h-0.5 rounded-full bg-teal-300/60" />
                <div className="w-5 h-0.5 rounded-full bg-teal-300/40" />
                <div className="w-5 h-0.5 rounded-full bg-teal-300/25" />
                <span className="text-[6px] font-mono text-white font-black mt-0.5 tracking-wide">MERGED</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'pdf-split':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            {/* ambient glow */}
            <div className="absolute -bottom-4 left-1/4 w-20 h-10 rounded-full bg-cyan-500/10 blur-xl" />
            <div className="flex items-center gap-2.5">
              {/* Source doc */}
              <div className="w-10 h-12 rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-900 border border-cyan-400/60 flex flex-col items-center justify-center gap-0.5 shadow-md shadow-cyan-500/10">
                <div className="w-5 h-0.5 rounded-full bg-cyan-300/80" />
                <div className="w-5 h-0.5 rounded-full bg-cyan-300/60" />
                <div className="w-5 h-0.5 rounded-full bg-cyan-300/40" />
                <div className="w-5 h-0.5 rounded-full bg-cyan-300/25" />
                <span className="text-[6px] font-mono text-cyan-300 font-bold mt-0.5">DOC</span>
              </div>
              {/* Scissor SVG icon */}
              <svg width="14" height="18" viewBox="0 0 14 18" fill="none" className="text-cyan-400 shrink-0" aria-hidden="true">
                <circle cx="3" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="3" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5.5" y1="5.5" x2="13" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5.5" y1="12.5" x2="13" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {/* Output pages */}
              <div className="flex flex-col gap-1">
                <div className="w-9 h-4 rounded-md bg-gradient-to-r from-cyan-900/80 to-cyan-950 border border-cyan-400/60 text-[7px] font-mono text-cyan-200 font-bold flex items-center justify-center shadow shadow-cyan-500/10">
                  p 1–3
                </div>
                <div className="w-9 h-4 rounded-md bg-gradient-to-r from-cyan-900/60 to-cyan-950 border border-cyan-400/40 text-[7px] font-mono text-cyan-300 flex items-center justify-center">
                  p 4–8
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'pdf-crop':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-blue-500/30 bg-blue-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-16 h-14 border-2 border-dashed border-blue-400 bg-zinc-900/80 rounded flex items-center justify-center">
              <span className="text-[9px] font-mono text-blue-300 font-bold">CROP</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-compress':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-sky-500/30 bg-sky-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-zinc-400 line-through">12 MB</span>
              <span className="text-sky-400 font-bold">➔</span>
              <span className="text-white font-bold bg-sky-900/80 border border-sky-400/50 px-2 py-0.5 rounded shadow">2.4 MB</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-stamp':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-rose-500/30 bg-rose-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="border-2 border-rose-500/60 bg-zinc-900 px-3 py-1 rounded rotate-[-6deg] shadow-lg">
              <span className="text-xs font-mono font-black text-rose-400 tracking-wider">APPROVED</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-protect':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/50 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="absolute -top-4 right-0 w-16 h-16 rounded-full bg-amber-500/5 blur-xl" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shadow-md shadow-amber-500/10">
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
                  <rect x="1" y="7" width="14" height="10" rx="2" stroke="#fbbf24" strokeWidth="1.4"/>
                  <path d="M4 7V5a4 4 0 0 1 8 0v2" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="8" cy="12" r="1.5" fill="#fbbf24" opacity="0.8"/>
                </svg>
              </div>
              <span className="text-[9px] font-mono font-black text-amber-300 tracking-widest uppercase">AES-256</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-unlock':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="absolute -top-4 left-0 w-16 h-16 rounded-full bg-emerald-500/5 blur-xl" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shadow-md shadow-emerald-500/10">
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
                  <rect x="1" y="7" width="14" height="10" rx="2" stroke="#34d399" strokeWidth="1.4"/>
                  <path d="M4 7V5a4 4 0 0 1 8 0" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 1" opacity="0.5"/>
                  <circle cx="8" cy="12" r="1.5" fill="#34d399" opacity="0.8"/>
                  <line x1="11" y1="4" x2="13" y2="2" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
                </svg>
              </div>
              <span className="text-[9px] font-mono font-black text-emerald-300 tracking-widest uppercase">Unlocked</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-numbers':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-indigo-500/30 bg-indigo-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="font-mono text-xs text-indigo-200 bg-zinc-900 px-3 py-1 rounded border border-indigo-500/40 shadow">
              Page 1 of 24
            </div>
          </div>
        </div>
      );

    case 'pdf-images':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-amber-500/30 bg-amber-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-36 h-14 rounded-lg border border-amber-400/40 bg-zinc-900 p-2 flex items-center justify-between shadow-xl">
              <div className="w-9 h-9 rounded bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[10px] text-amber-200 font-mono font-black">
                JPG
              </div>
              <span className="text-amber-400 text-sm font-mono font-bold animate-pulse">➔</span>
              <div className="w-11 h-9 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[9px] text-white font-mono font-bold shadow">
                PDF
              </div>
            </div>
          </div>
        </div>
      );

    case 'pdf-text':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-sky-500/30 bg-sky-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-38 h-14 bg-zinc-900 border border-sky-400/40 rounded-lg p-2 space-y-1 shadow-xl">
              <div className="text-[9px] font-mono text-sky-300 font-bold flex justify-between">
                <span>### Document Notes</span>
                <span className="text-[7px] bg-sky-950 border border-sky-800 text-sky-200 px-1 rounded">300 DPI</span>
              </div>
              <div className="text-[8px] font-mono text-zinc-400 truncate">- Real text layer extracted</div>
            </div>
          </div>
        </div>
      );

    case 'image-edit':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-lime-500/30 bg-lime-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-36 h-14 rounded-lg border border-lime-400/40 bg-zinc-900 relative overflow-hidden flex items-center justify-between p-2 shadow-xl">
              <span className="text-[8px] font-mono text-zinc-400">ORIGINAL</span>
              <div className="w-0.5 h-full bg-lime-400 shadow-[0_0_10px_#a3e635]" />
              <span className="text-[8px] font-mono text-lime-300 font-bold bg-lime-950/60 px-1 py-0.5 rounded border border-lime-800">
                WEBP
              </span>
            </div>
          </div>
        </div>
      );

    case 'poster':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-orange-500/30 bg-orange-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="grid grid-cols-3 gap-1 w-28 h-14 bg-zinc-900 border border-orange-400/40 p-1 rounded-lg shadow-xl">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="bg-zinc-800 hover:bg-zinc-700 rounded-sm border border-zinc-700 flex items-center justify-center text-[7px] font-mono font-bold text-zinc-300">
                  A{n}
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'audio-compress':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-8 rounded-full bg-indigo-500/10 blur-xl" />
            <div className="flex flex-col items-center gap-1">
              {/* Waveform bars */}
              <div className="flex items-end gap-0.5 h-8 mb-1">
                {[3,5,7,9,6,8,5,3].map((h, i) => (
                  <div key={i} style={{height: `${h * 3}px`}} className="w-1 rounded-sm bg-indigo-400/50" />
                ))}
              </div>
              <div className="flex items-center gap-2 font-mono text-[9px]">
                <span className="text-zinc-400 line-through">320 kbps</span>
                <span className="text-indigo-400 font-bold animate-pulse">→</span>
                <span className="text-indigo-200 font-black bg-indigo-900/60 border border-indigo-500/50 px-1.5 py-0.5 rounded shadow">128 kbps</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'audio-joiner':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-zinc-950/80 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-8 rounded-full bg-violet-500/10 blur-xl" />
            <div className="flex flex-col gap-1.5">
              {/* Track bars */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 bg-zinc-900 border border-violet-500/40 rounded px-1.5 py-1">
                  {[2,4,6,4,3,5,3].map((h, i) => (
                    <div key={i} style={{height: `${h * 2}px`}} className="w-0.5 rounded-sm bg-violet-400/70" />
                  ))}
                </div>
                <span className="text-violet-400 font-bold text-sm">+</span>
                <div className="flex items-center gap-0.5 bg-zinc-900 border border-violet-500/40 rounded px-1.5 py-1">
                  {[3,5,4,6,3,4,2].map((h, i) => (
                    <div key={i} style={{height: `${h * 2}px`}} className="w-0.5 rounded-sm bg-violet-300/70" />
                  ))}
                </div>
              </div>
              {/* Arrow + merged */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-violet-400 font-bold text-xs animate-pulse">→</span>
                <div className="flex items-center gap-0.5 bg-violet-900/40 border border-violet-400/60 rounded px-2 py-1">
                  {[2,3,5,7,5,6,4,5,3,4,2].map((h, i) => (
                    <div key={i} style={{height: `${h * 2}px`}} className="w-0.5 rounded-sm bg-violet-300" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'audio-bpm-finder':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-emerald-500/30 bg-emerald-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2.5 bg-zinc-900 border border-emerald-500/40 px-3 py-1.5 rounded-lg shadow">
              <div className="text-center font-mono">
                <span className="text-[9px] text-zinc-400 font-bold block uppercase">BPM</span>
                <span className="text-sm font-black text-emerald-400">148</span>
              </div>
              <div className="w-px h-6 bg-zinc-700" />
              <div className="text-center font-mono">
                <span className="text-[9px] text-zinc-400 font-bold block uppercase">KEY</span>
                <span className="text-xs font-black text-indigo-300">G Minor <span className="text-[9px] text-indigo-400 font-bold">6A</span></span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'audio-pitch-speed':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-indigo-500/30 bg-indigo-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2.5 font-mono bg-zinc-900 border border-indigo-500/40 px-3 py-1.5 rounded-lg shadow">
              <span className="text-xs font-extrabold text-indigo-300">+2 st</span>
              <span className="text-zinc-600 font-bold">•</span>
              <span className="text-xs font-extrabold text-emerald-300">1.25x</span>
            </div>
          </div>
        </div>
      );

    case 'convert':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-cyan-500/30 bg-cyan-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
              <span className="px-2 py-1 bg-zinc-900 rounded border border-zinc-700 text-[10px]">PNG</span>
              <span className="text-cyan-400 font-bold animate-pulse">➔</span>
              <span className="px-2.5 py-1 bg-zinc-900 rounded border border-cyan-500/50 text-cyan-300 text-[10px] font-bold shadow">WEBP</span>
            </div>
          </div>
        </div>
      );

    case 'metadata':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-amber-500/30 bg-amber-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-38 h-13 bg-zinc-900 border border-amber-400/40 rounded-lg p-2 text-[8px] font-mono space-y-1 text-zinc-300 shadow-xl">
              <div className="flex justify-between"><span className="text-zinc-500">EXIF</span><span className="text-amber-300 font-bold">ISO 100 • f/2.8</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">ID3</span><span className="text-white font-bold">Album Artwork</span></div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};
