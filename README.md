<p align="center">
  <img src="public/logo.svg" width="96" alt="Compactor Logo" />
</p>

<h1 align="center">Compactor</h1>

<p align="center">
  <b>100% Client-Side · Private · Zero Upload · Media Compressor, PDF Studio & Verified File Converter</b><br />
  <i>Designed & Developed by <a href="https://kuberbassi.com">Kuber Bassi</a></i>
</p>

<p align="center">
  <a href="https://compactor.kuberbassi.com"><strong>⚡ Open Live Web Application »</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/FFmpeg-WASM-orange?style=flat-square" alt="FFmpeg WASM" />
  <img src="https://img.shields.io/badge/Tests-56%20passing-22c55e?style=flat-square&logo=vitest" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-zinc?style=flat-square" alt="MIT License" />
</p>

---

## 🔒 100% Client-Side Privacy Architecture

**Compactor** is built on a privacy-first, zero-server-upload architecture. Every video compression, PDF edit, audio transcode, image optimization, and format conversion happens **directly inside your browser** using client-side WebAssembly and HTML5 processing engines.

- **Zero Server Uploads** — Files, videos, and documents never leave your local device.
- **Offline & Sandbox Ready** — Executes locally inside browser sandboxes without reliance on backend APIs.
- **High-Performance Multithreading** — Utilises WebAssembly `SharedArrayBuffer` with COOP/COEP headers for hardware-accelerated parallel encoding.

---

## ✨ Feature Suites

### 🎬 Video Suite
- **Target Size Clamping** — Preset compressor for **Discord (≤10 MB)**, **WhatsApp (≤16 MB)**, **TikTok (≤70 MB)**, and **Instagram (≤95 MB)** with 2-pass size bounds.
- **Video to Audio** — Extract high-bitrate MP3, AAC, or WAV audio tracks.
- **Video to GIF** — Convert video clips into smooth 24/15/10 FPS animated GIFs.
- **Mute Video** — Strip audio channels instantly with zero re-encoding loss.

### 📄 PDF Studio Pro & Markdown Workspace
- **Markdown Studio** — Rich GFM editor workspace with syntax toolbar, live split preview, templates (GitHub README, Tech Spec, Meeting Notes) & 100% selectable vector PDF compiler.
- **PDF Annotate & Edit** — Add text, signatures, highlights, and custom shapes directly onto PDF pages.
- **Document Scan Filters** — Smart Magic Color, Whiteboard Clean, B&W Binary Thresholding, and Vibrant Diagram filters.
- **Page Organisation** — Drag-and-drop page reordering, rotation, extraction, and deletion.
- **Merge & Split** — Combine multiple PDFs into one, or extract specific page ranges.
- **Crop Margins** — Interactive trim percentage control for clean printable layouts.
- **Sign & Stamp** — Vector approval stamps (`APPROVED`, `CONFIDENTIAL`, `FINAL DRAFT`) and digital signatures.
- **Security** — AES-128/256 password encryption and password removal.
- **PDF to Word conversion modes** — Preserve images, columns, tables, and page formatting visually, or create editable DOCX/TXT text with private OCR for scanned pages.

### 🖼️ Image Optimizer
- Multi-format lossy and lossless compression (PNG, JPG, WebP, GIF, AVIF).
- Multi-color raster-to-SVG vectorization with color quantization, layered edge tracing, line fitting, and quadratic spline fitting.
- Aspect ratio cropping (`1:1`, `16:9`, `4:3`, `9:16`), rotation, horizontal/vertical flipping.
- Interactive pixelation censorship brush for obscuring sensitive document regions.

### 🎵 Audio Suite & Converter
- **Compress Audio** — High-efficiency WASM audio compressor with trim range timeline & waveform previews.
- **Audio Joiner** — Merge & concatenate multiple audio tracks into a single seamless audio file.
- **Key & BPM Finder** — 100% in-browser Web Audio API detection of tempo (BPM), musical key & Camelot wheel code.
- **Pitch & Speed Changer** — Transpose key pitch (-12 to +12 semitones) & adjust playback tempo (0.5× to 2.0×).
- **Verified File Converter** — Strict engine-backed conversions for PDF, DOCX, text, data, common raster images, SVG, audio, and video. Unsupported pairs are disabled rather than fabricated.
- **Metadata Editor** — Inspect and edit EXIF, ID3, and PDF tags directly in-browser.
- **Poster Maker** — Multi-page printable wall poster grid generator.

---

## 🛠️ Technology Stack & Architecture

| Layer | Technology |
|---|---|
| **Core** | React 19, TypeScript 5, Vite 8 |
| **Styling & UI** | TailwindCSS v4, Base UI, Custom Glassmorphism Design Tokens |
| **Icons** | Lucide React |
| **Processing Engines** | `@ffmpeg/ffmpeg` (WASM), `@ffmpeg/util`, `pdf-lib`, `pdfjs-dist`, `docx`, `mammoth`, Tesseract.js OCR, ImageTracerJS, HTML5 Canvas 2D |
| **Testing** | Vitest + Testing Library + JSDOM (55 tests, 14 test files) |
| **Deployment** | Vercel with COOP/COEP security headers & immutable asset caching |

### Module Architecture

```
src/
├── pages/
│   ├── Dashboard/          # Modular dashboard (ToolCard, IllustrationBanner, data, types)
│   ├── VideoCompressor/
│   ├── PdfTools/
│   ├── AudioTools/
│   ├── ImageTools/
│   └── ...
├── utils/
│   └── ffmpeg/             # Modular FFmpeg WASM layer
│       ├── core.ts         # Worker init & lifecycle
│       ├── video.ts        # Compression, GIF, mute, audio extraction
│       ├── audio.ts        # Audio processing
│       └── index.ts        # Re-exports
└── components/
    ├── Common/             # Footer, ToolHeader, FileUploader, TrimTimeline
    └── ui/                 # Design system primitives
```

---

## 🚀 Quick Start & Development

```bash
# 1. Clone repository
git clone https://github.com/kuberbassi/compactor.git
cd compactor

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Run Vitest test suite
npm run test

# 5. Verify FFmpeg compressors & diagnostics
npm run check:compressors

# 6. Build for production
npm run build
```

---

## 📲 Progressive Web App (PWA)

Compactor is configured as a standalone Web App. It can be installed directly onto iOS, Android, or desktop devices with standalone app window support and quick shortcuts.

---

## 👤 Author & License

Designed & Developed with ❤️ by **[Kuber Bassi](https://kuberbassi.com)**.

License: MIT
