import React, { useState, useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';

interface ToolItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'VIDEO' | 'PDF' | 'IMAGE' | 'AUDIO & CONVERT';
  tags: string[];
  illustrationType: string;
}

const TOOLS: ToolItem[] = [
  // VIDEO
  {
    id: 'video-compressor',
    title: 'Compress a video',
    subtitle: 'Smaller file size for sharing',
    description: 'Make video files lighter for WhatsApp (≤16MB), Discord (≤10MB), TikTok, or Instagram.',
    category: 'VIDEO',
    tags: ['Discord ≤10MB', 'WhatsApp ≤16MB', 'TikTok & Insta'],
    illustrationType: 'video-compress'
  },
  {
    id: 'video-to-audio',
    title: 'Video to audio',
    subtitle: 'Extract sound from video',
    description: 'Convert any video file into a standalone MP3 or AAC sound track.',
    category: 'VIDEO',
    tags: ['MP3 / AAC Output', 'Strip Video Track', 'High Quality'],
    illustrationType: 'video-audio'
  },
  {
    id: 'video-to-gif',
    title: 'Video to GIF',
    subtitle: 'Convert clips to animated GIFs',
    description: 'Turn video clips or segments into smooth, lightweight animated GIFs.',
    category: 'VIDEO',
    tags: ['Animated GIF', 'High Quality Palette', 'Fps Control'],
    illustrationType: 'video-gif'
  },
  {
    id: 'video-mute',
    title: 'Mute video',
    subtitle: 'Strip audio channel',
    description: 'Remove background audio from video files with zero re-encoding loss.',
    category: 'VIDEO',
    tags: ['Strip Audio', 'Zero Loss', 'Fast Save'],
    illustrationType: 'video-mute'
  },

  // PDF
  {
    id: 'pdf-organize',
    title: 'Organize PDF Pages',
    subtitle: 'Reorder & rotate pages',
    description: 'Rearrange, rotate, or delete PDF pages visually with clear thumbnails.',
    category: 'PDF',
    tags: ['Visual Page Grid', 'Rotate Pages', 'Extract Selection'],
    illustrationType: 'pdf-organize'
  },
  {
    id: 'pdf-merge',
    title: 'Merge PDFs',
    subtitle: 'Combine multiple PDF files',
    description: 'Stitch multiple PDF documents together into a single organized file.',
    category: 'PDF',
    tags: ['Combine Files', 'Drag Reorder', 'Fast Merge'],
    illustrationType: 'pdf-merge'
  },
  {
    id: 'pdf-split',
    title: 'Split PDF',
    subtitle: 'Extract page ranges',
    description: 'Extract specific page ranges or split a large PDF into individual documents.',
    category: 'PDF',
    tags: ['Extract Ranges', 'Split by Pages', 'Instant Export'],
    illustrationType: 'pdf-split'
  },
  {
    id: 'pdf-crop-tool',
    title: 'Crop PDF Margins',
    subtitle: 'Trim white margins',
    description: 'Crop unnecessary white borders off PDF pages for cleaner viewing.',
    category: 'PDF',
    tags: ['Crop Margins', 'Custom Bounding', 'All Pages'],
    illustrationType: 'pdf-crop'
  },
  {
    id: 'pdf-compress',
    title: 'Compress PDF',
    subtitle: 'Reduce document file size',
    description: 'Shrink PDF file sizes while keeping embedded image & text quality sharp.',
    category: 'PDF',
    tags: ['DPI Control', 'Shrink MB Size', 'Vector Quality'],
    illustrationType: 'pdf-compress'
  },
  {
    id: 'pdf-stamps',
    title: 'Sign & Stamp PDF',
    subtitle: 'Stamps, signatures & censorship',
    description: 'Add APPROVED stamps, draw signatures, or black-out confidential text.',
    category: 'PDF',
    tags: ['Vector Stamps', 'Blackout Redact', 'Flatten Form Fields'],
    illustrationType: 'pdf-stamps'
  },
  {
    id: 'pdf-redact',
    title: 'Redact & Censor PDF',
    subtitle: 'Blackout sensitive text',
    description: 'Draw black censorship boxes to permanently redact confidential info.',
    category: 'PDF',
    tags: ['Blackout Text', 'Censor Info', 'Permanent Redact'],
    illustrationType: 'pdf-redact'
  },
  {
    id: 'pdf-flatten',
    title: 'Flatten Form Fields',
    subtitle: 'Lock interactive PDF forms',
    description: 'Convert interactive form fields & signatures into uneditable vector graphics.',
    category: 'PDF',
    tags: ['Lock Forms', 'Uneditable Text', 'Vector Security'],
    illustrationType: 'pdf-flatten'
  },
  {
    id: 'pdf-sign',
    title: 'Sign Document',
    subtitle: 'Draw or insert digital signature',
    description: 'Place your handwritten signature or custom logo stamp anywhere on PDF pages.',
    category: 'PDF',
    tags: ['Digital Signature', 'Draw Signature', 'Easy Placement'],
    illustrationType: 'pdf-sign'
  },
  {
    id: 'pdf-watermark',
    title: 'Add Watermark',
    subtitle: 'Custom text or logo watermark',
    description: 'Overlay diagonal or header watermarks across document pages.',
    category: 'PDF',
    tags: ['Diagonal Text', 'Opacity Control', 'Batch Watermark'],
    illustrationType: 'pdf-watermark'
  },
  {
    id: 'pdf-protect',
    title: 'Password Protect PDF',
    subtitle: 'Encrypt document with password',
    description: 'Lock PDF files with AES password encryption to restrict unauthorized opening.',
    category: 'PDF',
    tags: ['AES Encryption', 'Password Protect', 'Secure Data'],
    illustrationType: 'pdf-protect'
  },
  {
    id: 'pdf-unlock',
    title: 'Unlock Password PDF',
    subtitle: 'Remove PDF password restriction',
    description: 'Decrypt password-protected PDFs to restore unrestricted printing & copying.',
    category: 'PDF',
    tags: ['Remove Password', 'Decrypt PDF', 'Instant Access'],
    illustrationType: 'pdf-unlock'
  },
  {
    id: 'pdf-page-numbers',
    title: 'Insert Page Numbers',
    subtitle: 'Add header or footer numbering',
    description: 'Number PDF pages automatically with customizable position and font style.',
    category: 'PDF',
    tags: ['Header/Footer', 'Custom Start', 'Page Count'],
    illustrationType: 'pdf-numbers'
  },
  {
    id: 'pdf-to-image',
    title: 'PDF to High-Res Images',
    subtitle: 'Export 300 DPI PNG/JPG',
    description: 'Render PDF pages into crystal-clear 300 DPI images for printing or presentation.',
    category: 'PDF',
    tags: ['300 DPI Images', 'PNG / JPG Export', 'Batch Render'],
    illustrationType: 'pdf-images'
  },
  {
    id: 'pdf-jpg-to-pdf',
    title: 'Images to PDF & Scanner',
    subtitle: 'Scan photos to PDF',
    description: 'Combine photos into one PDF document with Smart Magic Color scan filters.',
    category: 'PDF',
    tags: ['Document Scan', 'Merge Photos', 'Clean Whiteboard'],
    illustrationType: 'pdf-images'
  },
  {
    id: 'pdf-word-to-pdf',
    title: 'Markdown to PDF',
    subtitle: 'Compile Markdown to PDF',
    description: 'Convert raw Markdown syntax (# headings, code blocks, lists) into clean PDFs.',
    category: 'PDF',
    tags: ['Markdown Syntax', 'Code Highlighting', 'Clean Layout'],
    illustrationType: 'pdf-text'
  },
  {
    id: 'pdf-to-word',
    title: 'PDF to Markdown Text',
    subtitle: 'Extract real text layer',
    description: 'Extract text layer from PDF documents directly to Markdown (.md).',
    category: 'PDF',
    tags: ['Markdown Text', 'Extract Text Layer', 'Real Text'],
    illustrationType: 'pdf-text'
  },

  // IMAGE
  {
    id: 'image-optimizer',
    title: 'Edit an image',
    subtitle: 'Resize & compress images',
    description: 'Compress photos, resize dimensions, or blur private details with split-screen preview.',
    category: 'IMAGE',
    tags: ['AVIF / WebP / PNG', 'Split Comparison', 'Pixelating Brush'],
    illustrationType: 'image-edit'
  },
  {
    id: 'rasterbator',
    title: 'Make a poster (Rasterbator)',
    subtitle: 'Print big wall posters',
    description: 'Split one photo across multiple printable A4 or A3 grid pages.',
    category: 'IMAGE',
    tags: ['Multi-Page Grid', 'A4 / A3 Tiles', 'Print Crop Guides'],
    illustrationType: 'poster'
  },

  // AUDIO & CONVERT
  {
    id: 'audio-optimizer',
    title: 'Compress audio',
    subtitle: 'Reduce audio file size',
    description: 'Compress MP3, WAV, or FLAC audio files without losing sound quality.',
    category: 'AUDIO & CONVERT',
    tags: ['MP3 / WAV / FLAC', 'Bitrate Control', 'Stereo to Mono'],
    illustrationType: 'audio-compress'
  },
  {
    id: 'universal-converter',
    title: 'Convert a file',
    subtitle: 'Universal format converter',
    description: 'Convert files between 212+ formats directly inside your browser.',
    category: 'AUDIO & CONVERT',
    tags: ['212+ Formats', '100% Private', 'Zero Uploads'],
    illustrationType: 'convert'
  },
  {
    id: 'metadata-editor',
    title: 'Edit metadata',
    subtitle: 'Camera EXIF & music tags',
    description: 'Edit camera details, artist info, or strip private location metadata.',
    category: 'AUDIO & CONVERT',
    tags: ['Camera EXIF', 'Music ID3 Tags', 'Privacy Stripper'],
    illustrationType: 'metadata'
  }
];

const CATEGORIES = ['ALL', 'VIDEO', 'PDF', 'IMAGE', 'AUDIO & CONVERT'] as const;

/**
 * Visual Vector Illustration Card Banners
 */
const IllustrationBanner: React.FC<{ type: string }> = ({ type }) => {
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
                <div className="w-1.5 h-6 bg-purple-400/60 rounded-full animate-pulse" />
                <div className="w-1.5 h-10 bg-purple-300 rounded-full shadow-[0_0_8px_#c084fc]" />
                <div className="w-1.5 h-5 bg-purple-500/50 rounded-full" />
              </div>
              <span className="text-[9px] font-mono font-black text-purple-200 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-500/50 shadow">
                -75%
              </span>
            </div>
          </div>
        </div>
      );

    case 'video-audio':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-teal-500/30 bg-teal-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-teal-500/30 rounded-lg">
              {[45, 85, 55, 95, 70, 40, 90, 60].map((h, i) => (
                <div 
                  key={i} 
                  className="w-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf]" 
                  style={{ height: `${h * 0.35}px` }} 
                />
              ))}
            </div>
          </div>
        </div>
      );

    case 'video-gif':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-pink-500/30 bg-pink-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-pink-200 bg-zinc-900 border border-pink-500/40 px-3 py-1.5 rounded-lg shadow">
              <span className="font-extrabold text-pink-400">GIF</span>
              <span className="text-[10px] text-zinc-400 font-bold">24 FPS</span>
            </div>
          </div>
        </div>
      );

    case 'video-mute':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-rose-500/30 bg-rose-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="px-3 py-1 bg-rose-900/60 border border-rose-500/50 rounded-lg text-rose-200 font-mono text-xs font-bold shadow">
              [MUTED AUDIO]
            </div>
          </div>
        </div>
      );

    case 'video-social':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-sky-500/30 bg-sky-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-200 bg-zinc-900 px-3 py-1.5 rounded-lg border border-sky-500/40 shadow">
              <span>SOCIAL READY</span>
              <span className="text-sky-400">HQ</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-organize':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-rose-500/30 bg-rose-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="relative w-40 h-16 flex items-center justify-center">
              <div className="absolute left-2 top-2 w-16 h-12 rounded border border-rose-500/30 bg-rose-900/40 transform -rotate-12" />
              <div className="absolute right-2 top-1 w-18 h-13 rounded-lg border border-rose-400/50 bg-zinc-900 p-1.5 flex flex-col justify-between shadow-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-mono text-rose-300 font-bold bg-rose-950 px-1 rounded border border-rose-800">#1</span>
                  <span className="text-[8px] font-bold text-zinc-300">↺ 90°</span>
                </div>
                <div className="w-3/4 h-1 bg-zinc-500 rounded" />
              </div>
            </div>
          </div>
        </div>
      );

    case 'pdf-merge':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-indigo-500/30 bg-indigo-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-1.5 font-mono text-xs text-indigo-200 bg-zinc-900 border border-indigo-500/40 px-3 py-1.5 rounded-lg shadow">
              <span>PDF #1 + #2</span>
              <span className="text-indigo-400 font-bold">➔ 1 PDF</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-split':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-amber-500/30 bg-amber-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-amber-200 bg-zinc-900 border border-amber-500/40 px-3 py-1.5 rounded-lg shadow">
              <span>Pages 1-5</span>
              <span className="text-amber-400">✂</span>
              <span>Pages 6-10</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-crop':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-emerald-500/30 bg-emerald-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-32 h-14 border-2 border-dashed border-emerald-400 bg-zinc-900/80 rounded flex items-center justify-center text-[10px] font-mono text-emerald-300 font-bold shadow">
              TRIM MARGINS
            </div>
          </div>
        </div>
      );

    case 'pdf-compress':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-blue-500/30 bg-blue-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-blue-200 bg-zinc-900 border border-blue-500/40 px-3 py-1.5 rounded-lg shadow">
              <span>15.4 MB</span>
              <span className="text-blue-400 font-bold">➔ 2.1 MB</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-stamps':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-emerald-500/30 bg-emerald-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex flex-col gap-1.5 items-center">
              <span className="px-2.5 py-0.5 rounded border-2 border-white text-white font-mono font-black text-[9px] bg-zinc-900 shadow-xl tracking-wider">
                APPROVED
              </span>
              <div className="w-32 h-4 bg-black border border-zinc-800 rounded flex items-center justify-center text-white font-mono text-[7px] font-bold tracking-widest shadow-inner">
                [REDACTED CENSORSHIP]
              </div>
            </div>
          </div>
        </div>
      );

    case 'pdf-redact':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-zinc-500/30 bg-zinc-950 relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="w-36 h-8 bg-black border border-zinc-700 rounded flex items-center justify-center text-white font-mono text-[9px] font-bold tracking-widest shadow-inner">
              ██████ BLACKOUT ██████
            </div>
          </div>
        </div>
      );

    case 'pdf-flatten':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-violet-500/30 bg-violet-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="px-3 py-1 bg-zinc-900 border border-violet-500/40 rounded-lg text-violet-200 font-mono text-xs font-bold shadow">
              LOCKED VECTOR GRAPHICS
            </div>
          </div>
        </div>
      );

    case 'pdf-sign':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-teal-500/30 bg-teal-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="font-serif italic text-lg text-teal-200 bg-zinc-900 px-4 py-1 rounded-lg border border-teal-500/40 shadow">
              John Doe
            </div>
          </div>
        </div>
      );

    case 'pdf-watermark':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-sky-500/30 bg-sky-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="transform -rotate-12 text-xs font-mono font-black text-sky-400/80 tracking-widest bg-zinc-900 px-3 py-1 rounded border border-sky-500/30 shadow">
              CONFIDENTIAL WATERMARK
            </div>
          </div>
        </div>
      );

    case 'pdf-protect':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-amber-500/30 bg-amber-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-amber-200 bg-zinc-900 border border-amber-500/40 px-3 py-1.5 rounded-lg shadow">
              <span>🔒 AES ENCRYPTED</span>
            </div>
          </div>
        </div>
      );

    case 'pdf-unlock':
      return (
        <div className="w-full h-full flex items-center justify-center relative p-3 select-none">
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-emerald-500/30 bg-emerald-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-200 bg-zinc-900 border border-emerald-500/40 px-3 py-1.5 rounded-lg shadow">
              <span>🔓 PASSWORD REMOVED</span>
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
          <div className="w-full max-w-[210px] h-24 rounded-xl border border-indigo-500/30 bg-indigo-950/30 backdrop-blur-md relative overflow-hidden flex items-center justify-center shadow-xl">
            <span className="text-[10px] font-mono text-indigo-200 bg-zinc-900 border border-indigo-500/50 px-3 py-1 rounded-full font-bold shadow-lg">
              320 kbps ➔ 128 kbps
            </span>
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

export function Dashboard({ 
  onSelectTool, 
  uploadCount 
}: { 
  onSelectTool: (toolId: string) => void; 
  uploadCount: number;
}) {
  const [selectedCat, setSelectedCat] = useState<typeof CATEGORIES[number]>('ALL');

  const filteredTools = useMemo(() => {
    if (selectedCat === 'ALL') return TOOLS;
    return TOOLS.filter(t => t.category === selectedCat);
  }, [selectedCat]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* HERO HEADER */}
      <header className="text-center space-y-3 sm:space-y-4 pt-14 sm:pt-16 px-1">
        <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900 shadow-sm max-w-full">
          <span className="status-dot-glow shrink-0" />
          <span className="text-[9px] sm:text-[10px] md:text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider truncate">
            EVERYTHING IN ONE PLACE
          </span>
        </div>

        <h1 className="text-[clamp(1.75rem,8vw,4rem)] sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[0.95] px-1">
          Less file fuss.<br />
          <em className="not-italic text-zinc-400 font-serif italic">More flow.</em>
        </h1>

        <p className="text-[11px] sm:text-sm md:text-base text-zinc-400 max-w-sm sm:max-w-xl mx-auto leading-relaxed px-2">
          Thoughtful tools to make your files lighter, tidier, and ready to share.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-mono text-zinc-400 pt-1 max-w-full px-1">
          <div className="px-2.5 sm:px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 font-medium text-zinc-200 flex items-center gap-1.5 max-w-[260px] sm:max-w-full truncate">
            <span className="dot-glow-white shrink-0" />
            <span className="truncate text-[10px] sm:text-xs">{uploadCount.toLocaleString()} files finished</span>
          </div>
          <span className="text-zinc-600 font-bold hidden sm:inline">&bull;</span>
          <div className="px-2.5 sm:px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-[10px] sm:text-xs truncate hidden xs:block">
            Pick a tool to begin
          </div>
        </div>
      </header>

      {/* CONCENTRIC RADII CATEGORY TABS */}
      <div className="w-full flex justify-center my-3 sm:my-6">
        <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm w-full sm:w-auto overflow-x-auto no-scrollbar scrollbar-none" style={{WebkitOverflowScrolling: 'touch'}}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCat === cat;
            const count = cat === 'ALL' ? TOOLS.length : TOOLS.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 min-h-[36px] ${
                  isActive
                    ? 'bg-zinc-800 text-white font-extrabold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span className="whitespace-nowrap">{cat === 'ALL' ? 'ALL' : cat === 'AUDIO & CONVERT' ? 'AUDIO' : cat}</span>
                <span className={`text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 rounded-md font-bold ${
                  isActive ? 'bg-zinc-950 text-white' : 'bg-zinc-900 text-zinc-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SHOWCASE GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            className="group bg-zinc-900/70 border border-zinc-800/90 hover:border-zinc-500 hover:bg-zinc-900/95 rounded-2xl overflow-hidden hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.98]"
          >
            {/* Visual Vector Illustration Banner */}
            <div className="w-full h-28 sm:h-32 lg:h-36 bg-gradient-to-b from-zinc-900 to-zinc-950/80 border-b border-zinc-800 relative overflow-hidden flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-200">
              <IllustrationBanner type={tool.illustrationType} />
              
              <span className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[8px] sm:text-[9px] font-mono font-bold px-2 sm:px-2.5 py-0.5 rounded-full shadow-sm tracking-wider uppercase">
                {tool.category === 'AUDIO & CONVERT' ? 'AUDIO' : tool.category}
              </span>
            </div>

            {/* Card Content & Feature Tags */}
            <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-1 sm:space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] sm:text-sm font-bold text-white group-hover:text-zinc-100 transition-colors leading-snug flex-1 min-w-0 pr-2">
                    {tool.title}
                  </h3>
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-800/90 group-hover:!bg-white flex items-center justify-center transition-all duration-200 shadow-sm border border-zinc-700 group-hover:!border-white shrink-0">
                    <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400 group-hover:!text-black transition-colors stroke-[2.5]" />
                  </div>
                </div>

                <span className="text-[10px] sm:text-[11px] font-bold text-zinc-300 block">
                  {tool.subtitle}
                </span>

                <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed font-normal line-clamp-2 sm:line-clamp-none">
                  {tool.description}
                </p>
              </div>

              {/* Micro Feature Tags */}
              <div className="pt-2 sm:pt-2.5 border-t border-zinc-800/80 flex flex-wrap gap-1 sm:gap-1.5 max-w-full overflow-hidden">
                {tool.tags.slice(0, 3).map((tag, i) => (
                  <span 
                    key={i} 
                    className="px-1.5 sm:px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[9px] sm:text-[10px] font-mono text-zinc-300 font-medium flex items-center gap-1 sm:gap-1.5 shadow-sm group-hover:border-zinc-600 transition-colors max-w-full"
                  >
                    <span className="w-1 h-1 rounded-full bg-zinc-400 group-hover:bg-white transition-colors shrink-0" />
                    <span className="truncate">{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
