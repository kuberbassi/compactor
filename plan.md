# plan.md — Master Media Optimizer & Converter Suite

This plan details the design and implementation roadmap for integrating advanced compression modules, document enhancements, vectorizers, and a complete Bhuvan-style dark charcoal minimalist frontend design overhaul.

---

## 1. Core Technical Features

### A. Image Editor & Optimizer
- **Interactive Split-Screen Slider**: An interactive vertical divider overlays the preview. Original uncompressed image sits on the left, optimized/compressed image sits on the right. Dragging the slider dynamically updates the CSS `clip-path` bounding box at 60fps.
- **Advanced Codec Control**: Expose MozJPEG, WebP, AVIF, and OxiPNG options.
- **Advanced Resizers**: Support Lanczos3 (sinc filter) and bilinear/bicubic resizing algorithms.
- **Dithering & Color Quantization**: Reduce colors count (2-256) for GIF/PNG compressions.

### B. CamScanner Scan Engine (Image to PDF Scanner)
- **Automated Crops**: Run an automatic document edge-detection algorithm on canvas pixels (e.g. Sobel intensity gradients or threshold contours) to snap crop corners automatically to the document boundaries.
- **Document Enhancement Filters**:
  - *Magic Color:* Brightens backgrounds, boosts contrast, and sharpens texts.
  - *Binarization (Pure Black & White):* Adaptive local thresholding to convert gray noise to clean white backgrounds and text pixels to pure dark black.
  - *Grayscale Scan:* Crisp monochrome enhancement.
- **Optical Character Recognition (OCR)**: Integrates pure client-side text extraction. Parse text layers and output editable text zones.

### C. Rasterbator (Tiled Poster Printer)
- **Grid Poster Splitter**: Enable uploading an image, choosing standard tile formats (A4, A3, Letter, Legal), grid columns/rows layout count, and compiling a single multi-page PDF where each page constitutes one section of the poster.

### D. Universal Converter Dashboard (CloudConvert Level)
- **212 Format Categories Matrix**: Support structured inputs across 11 categories.
- **Unlimited Audio File Upload**: Lift upload limitations to `Infinity` for heavy audio processing workloads.

---

## 2. Reusability, Centralized Styling, and Simple Copy Overhaul
- **Notion-Style Simplified Copy**:
  - Strip technical/AI-heavy jargon like "secure sandbox" and "core modules". Use clean, human-centric descriptions ("A simple space to optimize and convert your files. No servers, no uploads. Everything runs locally in your browser.").
  - Remove numerical section counters like `/01` and `/02`.
- **Reusable Component Architecture**:
  - **ToolLayout**: Create a standard page wrapper for all tools, managing the header, description, and glassmorphic layout wrappers.
  - **Favicon Overhaul**: Set a clean, emoji-based SVG favicon.
  - **Footer Overhaul**: Implement a simple, centered minimal copyright line.
- **Liquid Glassmorphism styling**: Ensure all pages share cohesive dark charcoal variables, input outlines, and blur filters.

### Progress — July 19, 2026
- [x] Replaced the dashboard copy, category counters, and technical status language with short, plain labels.
- [x] Added shared styling primitives for buttons, cards, page headers, upload areas, footer, navigation, and responsive layout.
- [x] Updated the main media, PDF, converter, and poster pages to use the shared page layout classes and simple descriptions.
- [x] Replaced the favicon and simplified the footer.
- [ ] Continue consolidating the remaining per-tool controls into the shared component primitives as new features are added.

### Design pass — July 19, 2026
- [x] Created a single minimal Compactor mark for the app favicon and navigation.
- [x] Added custom vector glyphs for every dashboard tool and an elevated glass card system.
- [x] Added lightweight ambient and entrance motion, including a reduced-motion fallback.
- [x] Added a custom 404 state for invalid tool links.
- [x] Replaced the fixed image screen with a reusable responsive workbench shell and refreshed the PDF tool menu.
- [x] Rebuilt dashboard cards around color-coded visual scenes, with less copy and a clear visual identity per tool.
