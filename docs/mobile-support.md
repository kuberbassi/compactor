# Responsive and compact-device support

Compactor uses two responsive presentations backed by the same routes and
processing engines:

- **768px and wider:** the complete workspace UI, including multi-pane editors.
- **Below 768px:** Compact Compactor, a linear interface for useful file tasks
  that do not fit safely into a narrow editor workspace.

Crossing the breakpoint keeps any presentation that has already been used
mounted but hidden, so selected files, settings, queues, and completed results
survive an orientation or window-size change. Processing remains local to the
browser in both presentations.

## Compact tools

The compact shell currently provides:

- image, PDF, audio, and video compression with sequential bulk queues;
- the verified universal converter with compatible mixed-file queues;
- Merge PDF, Protect PDF, Unlock PDF, and PDF-to-PNG/JPEG;
- a simplified Images-to-PDF flow with ordering, rotation, filters, and page
  sizing.

Compact queues support accessible reordering, removal, progress, partial
results, retry, individual downloads, and ZIP export where multiple outputs
are produced. Passwords are kept only in component memory and are cleared
after processing, replacement, or queue clearing.

Freeform editors, precision timelines, complex page organizers, OCR workspaces,
and other multi-pane tools remain desktop/tablet-only. On a narrow screen their
routes explain the limitation and link to relevant compact alternatives rather
than shrinking the full editor.

## Recorded validation

The following checks were automated on Windows desktop browser engines. They
are responsive emulation, not physical-device evidence.

| Surface | Browser engine | Viewports | Evidence |
|---|---|---|---|
| Compact home | Chromium and WebKit | 320, 360, 390, 430px | No page overflow; no eager PDF.js, FFmpeg, PDFMake, or office-converter engine request |
| Breakpoint state | Chromium and WebKit | 360 → 800 → 360px | Selected compact file retained after switching to the full presentation and back |
| Desktop-only handoff | Chromium and WebKit | 360px | Explanation and compact alternatives visible; no page overflow |
| Full video workspace | Chromium and WebKit | 768, 820, 1024px | Full presentation visible; no page overflow |
| Published route sweep | Chromium | 768px | 43 sitemap routes loaded in the full presentation with no page-level overflow |
| Compact compressors | Chromium | 360 and 430px | Real image/PDF jobs, audio/video jobs, queue and download checks |
| Compact converter | Chromium | 360px | Real document, image, media, text, and data conversion matrix |
| Compact PDF tools | Chromium and WebKit | 360px | Merge ordering, real protect/unlock round-trip, selected-page images, and Images-to-PDF export |

The automated commands are:

```bash
npm run check:responsive
npm run check:tablet-routes
npm run check:compact-compressors
npm run check:compact-media
npm run check:compact-converter
npm run check:compact-pdf
```

Physical Android Chrome and iOS Safari file pickers, share sheets, background
interruptions, memory ceilings, and installed-PWA behavior have not been tested
in this repository run. Those checks should be completed on current real
devices before making device-specific reliability claims.

## Maintenance contract

Every new route must declare whether it is compact-supported in
`src/compact/compactTools.ts` and retain canonical route parity tests. Keep
processing engines behind user-initiated dynamic imports so the compact home
does not load PDF.js, FFmpeg, OCR, or office-conversion bundles.
