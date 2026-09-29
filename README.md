<p align="center">
  <img src="public/logo.svg" width="96" alt="Compactor Logo" />
</p>

<h1 align="center">Compactor</h1>

<p align="center">
  <b>100% Private In-Browser Media Compressor, PDF Studio &amp; Universal File Converter</b>
</p>

<p align="center">
  <a href="https://compactor.kuberbassi.com"><strong>⚡ Open Live App »</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/FFmpeg-WASM-orange?style=flat-square" alt="FFmpeg WASM" />
  <img src="https://img.shields.io/badge/Tests-58%20passed-22c55e?style=flat-square&logo=vitest" alt="Vitest 58 passed" />
  <img src="https://img.shields.io/badge/License-MIT-zinc?style=flat-square" alt="MIT License" />
</p>

---

## 🔒 100% Private, Zero Server Uploads

**Compactor** runs completely inside your browser. No files, media, or documents are ever uploaded to any backend server.

- **Zero Server Uploads** — Your videos, photos, and documents never leave your device.
- **Client-Side WASM Engines** — FFmpeg WASM, PDF.js, PDF-Lib, Rubberband, and Tesseract OCR run locally in web workers.
- **Strict Verification** — Real file conversion and compression. Unsupported formats (like PDF-to-Word) are explicitly disabled rather than producing fake or low-fidelity files.

---

## ✨ Features

### 🎬 Video Suite
- **Target Size Preset Compressor** — One-click compression tailored for Discord (≤10 MB), WhatsApp (≤16 MB), TikTok (≤70 MB), and Instagram (≤95 MB) with 2-pass bitrate matching.
- **Trim & Timeline** — Precise visual timeline scrubbing and sub-second trimming.
- **Video to Audio & GIF** — Extract crystal-clear MP3, WAV, or AAC audio tracks; generate smooth animated GIFs.
- **Mute Video** — Instant zero-re-encoding audio stripping.

### 📄 PDF Studio & Markdown
- **PDF Annotation & Editor** — Add vector text, stamps, signatures, freehand drawings, shapes, and permanent redactions.
- **Page Organizer** — Drag-and-drop page reordering, rotation, deletion, and split extraction.
- **Merge, Split, Protect & Unlock** — Client-side AES-128/256 encryption, password removal, and document joining.
- **Markdown Workspace** — Full GFM editor with split live preview, templates, and high-fidelity PDF rendering.
- **Document Scan Filters** — Whiteboard Clean, Magic Color, B&W Binary Thresholding, and Vibrant Diagram filters.

### 🖼️ Image Optimizer
- **Multi-Format Compression** — Lossless & lossy optimization for PNG, JPG, WebP, GIF, and AVIF.
- **Raster to SVG Vectorizer** — Color quantization, layered edge tracing, line fitting, and spline generation.
- **Censorship Brush** — Interactive canvas pixelation and blurring for redacting sensitive documents and photos.

### 🎵 Audio Suite & Universal Converter
- **Compress Audio & Joiner** — High-efficiency WASM compression and seamless multi-track audio concatenation.
- **Pitch & Speed Transposer** — Real-time tempo adjustment (0.5×–2.0×) and musical key transposing (-12 to +12 semitones).
- **Key & BPM Detection** — 100% in-browser Web Audio API musical key, Camelot wheel, and tempo analyzer.
- **Universal Batch Converter** — Strict engine-backed format conversions for documents, images, audio, video, and tabular data. Mixed files convert sequentially with shared-target filtering, per-file retry, and one-click ZIP download.

---

## 📱 Responsive & Mobile First

Compactor provides a tailored dual-presentation experience:
- **Desktop & Tablet Workspaces (≥768px)**: Immersive studio layouts with collapsible sidebars, multi-row command bars, canvas editors, and live audio/video players.
- **Compact Phone App (<768px)**: Purpose-built mobile touch interfaces for fast on-the-go compression, file conversions, and PDF actions without cluttered desktop toolbars.

---

## 🛠️ Tech Stack

- **Framework**: React 19, TypeScript 6, Vite 8, Rolldown
- **Styles**: TailwindCSS v4, Base UI, custom dark-charcoal glassmorphism design tokens
- **Engines**: `@ffmpeg/ffmpeg` (WASM), `pdf-lib`, `pdfjs-dist`, `docx`, `mammoth`, `tesseract.js`
- **Testing**: Vitest, Playwright (Chromium & WebKit), Testing Library, JSDOM
- **Hosting**: Vercel with strict security headers (COOP, CORP, HSTS, frame-ancestors CSP) and clean pre-rendered SEO entry pages

---

## 🚀 Getting Started

### Local Setup

```bash
# Clone the repository
git clone https://github.com/kuberbassi/compactor.git
cd compactor

# Install dependencies
npm ci

# Start local development server
npm run dev
```

### Automated Testing & Verification

Compactor features a complete, zero-configuration automated test harness:

```bash
# Fast 9-point browser smoke test (cross-platform, auto-starts preview server)
npm run test:browser:smoke

# Multi-viewport responsive suite across Chromium & WebKit (320px to 1024px)
npm run test:browser:responsive

# Real export-fidelity verification (independent PDF & image parser validation)
npm run test:browser:exports

# Comprehensive production release gate (lint, tests, typecheck, build, SEO, compressors, audit)
npm run check:production
```

---

## 📚 Documentation

Detailed architectural and operational documentation is located in [`docs/`](docs/):

- [`docs/production-readiness.md`](docs/production-readiness.md) — Release gate standards, browser verification, and operational guidance.
- [`docs/code-quality.md`](docs/code-quality.md) — Architecture principles, engineering invariants, and modularity guidelines.
- [`docs/mobile-support.md`](docs/mobile-support.md) — Responsive breakpoint contract and device support matrix.
- [`docs/maintenance.md`](docs/maintenance.md) — Dependency hygiene, routine maintenance, and update workflows.
- [`docs/seo-routing.md`](docs/seo-routing.md) — Prerendered static routes, clean URL resolution, and sitemap parity.

---

## 👤 Author & License

Designed & Developed with ❤️ by **[Kuber Bassi](https://kuberbassi.com)**.

License: [MIT](LICENSE)
