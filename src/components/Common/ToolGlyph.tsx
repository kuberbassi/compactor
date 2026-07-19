import type { ReactNode, SVGProps } from 'react';

export type ToolGlyphName = 'video' | 'audio' | 'pdf' | 'scan' | 'sign' | 'text' | 'image' | 'poster' | 'convert';
export function ToolGlyph({ name, ...props }: { name: ToolGlyphName } & SVGProps<SVGSVGElement>) {
  const lines = { stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const drawing: Record<ToolGlyphName, ReactNode> = {
    video: <><rect x="4" y="7" width="17" height="15" rx="3" {...lines}/><path d="m21 12 7-3v11l-7-3" {...lines}/><path d="M9 12h7M9 17h4" {...lines}/></>,
    audio: <><path d="M7 17v-3M11 22V9M15 18v-8M19 25V6M23 19v-9M27 16v-3" {...lines}/></>,
    pdf: <><path d="M9 4h11l7 7v19H9z" {...lines}/><path d="M20 4v8h7M13 17h10M13 21h10" {...lines}/></>,
    scan: <><path d="M11 5H6v5M21 5h5v5M26 22v5h-5M6 22v5h5" {...lines}/><rect x="10" y="10" width="12" height="12" rx="1" {...lines}/></>,
    sign: <><path d="M6 7h23v22H6zM10 23c4-6 6 2 10-4 2-3 3-1 5-4" {...lines}/></>,
    text: <><path d="M7 6h18M16 6v20M10 26h12" {...lines}/><path d="m22 18 2 2 4-5" {...lines}/></>,
    image: <><rect x="5" y="5" width="22" height="22" rx="3" {...lines}/><circle cx="11" cy="11" r="2" {...lines}/><path d="m7 23 6-6 4 4 3-3 5 5" {...lines}/></>,
    poster: <><path d="M6 6h9v9H6zM21 6h9v9h-9zM6 21h9v9H6zM21 21h9v9h-9z" {...lines}/></>,
    convert: <><path d="M8 12h15l-4-4M24 20H9l4 4" {...lines}/><path d="M25 12v5a7 7 0 0 1-7 7M7 20v-5a7 7 0 0 1 7-7" {...lines}/></>,
  };
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" {...props}>{drawing[name]}</svg>;
}
