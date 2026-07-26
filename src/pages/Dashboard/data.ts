import type { ToolItem } from './types';

export const TOOLS: ToolItem[] = [
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
    title: 'Add Stamp or Watermark',
    subtitle: 'Brand PDF with watermark',
    description: 'Apply text or image stamps (APPROVED, CONFIDENTIAL) with opacity control.',
    category: 'PDF',
    tags: ['Watermark Text', 'Image Stamp', 'Opacity Control'],
    illustrationType: 'pdf-stamp'
  },
  {
    id: 'pdf-protect',
    title: 'Protect PDF Password',
    subtitle: 'Encrypt PDF with AES',
    description: 'Encrypt PDF files with passwords to prevent unauthorized viewing.',
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
    tags: ['MP3 / WAV / FLAC', 'Bitrate Control', 'Lossless Compression', 'Audio Trimming'],
    illustrationType: 'audio-compress'
  },
  {
    id: 'audio-joiner',
    title: 'Audio Joiner',
    subtitle: 'Merge multiple audio files',
    description: 'Combine and merge multiple audio tracks sequentially into a single track.',
    category: 'AUDIO & CONVERT',
    tags: ['Merge Audio Tracks', 'Reorder Queue', 'WAV / MP3 Output'],
    illustrationType: 'audio-joiner'
  },
  {
    id: 'audio-bpm-finder',
    title: 'Key & BPM Finder',
    subtitle: 'Detect Musical Key & Tempo',
    description: 'Analyze tempo (BPM), musical key and Camelot wheel code 100% client-side.',
    category: 'AUDIO & CONVERT',
    tags: ['BPM Detector', 'Key Identification', 'Camelot Wheel'],
    illustrationType: 'audio-bpm-finder'
  },
  {
    id: 'audio-pitch-speed',
    title: 'Pitch & Speed Changer',
    subtitle: 'Transpose Pitch & Tempo',
    description: 'Adjust pitch (-12 to +12 semitones) and playback speed (0.5x to 2.0x).',
    category: 'AUDIO & CONVERT',
    tags: ['Pitch Shift', 'Speed 0.5x-2.0x', 'Semitone Transpose'],
    illustrationType: 'audio-pitch-speed'
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
    tags: ['Album Artwork', 'Music ID3 Tags', 'Privacy Stripper'],
    illustrationType: 'metadata'
  }
];
