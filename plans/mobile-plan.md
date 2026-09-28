# Mobile and Tablet Plan: Responsive Compactor and a purpose-built compact interface

> **Executor instructions**: This is the product and implementation plan for
> bringing Compactor to tablets and phones. Read the entire plan before editing
> code. Implement it phase by phase; do not attempt one large responsive CSS
> patch across the existing pages. Run the verification gate at the end of each
> phase and complete the named viewport checks before starting the next phase.
> If a STOP condition occurs, stop and report it rather than inventing a new
> architecture.
>
> **Drift check (run first)**:
> `git diff --stat 210840b..HEAD -- src/App.tsx src/index.css src/components src/config src/pages src/utils src/test`
> If these paths changed after this plan was written, compare the live code with
> the current-state notes below and update this plan before implementation.

## Status

- **Priority**: P1
- **Effort**: L, delivered as six independently shippable phases
- **Risk**: HIGH if attempted as one rewrite; MED when delivered in phases
- **Depends on**: the completed plans 001–005 in `plans/README.md`
- **Category**: direction / responsive product architecture
- **Planned at**: commit `210840b`, 2026-09-20
- **Status**: COMPLETE — implementation and desktop-browser acceptance passed as of 2026-09-25; physical Android/iOS validation remains documented follow-up evidence

## Outcome

Compactor will have two presentation modes backed by the same private,
browser-only processing engines:

1. **Full workspace** for tablets and laptop/desktop screens. Existing editor
   capabilities remain available, but rails, toolbars, previews, dialogs, and
   controls reflow cleanly instead of requiring a very wide desktop.
2. **Compact Compactor** for phones and unusually narrow windows. It uses one
   consistent, touch-first flow—choose a task, add files, adjust a short set of
   settings, process, then download/share—rather than shrinking the desktop
   editor workspace.

The temporary “Use Compactor on a desktop” screen is removed only after the
compact home and first useful compact tools pass the acceptance matrix. Routes,
SEO URLs, privacy guarantees, result names, and processing behavior stay shared
between full and compact modes.

## Product principles

- Do not build a second app or duplicate conversion/compression engines.
- Choose the interface from available layout width, not user-agent detection.
- A tablet is a supported full-workspace device. A narrow tablet window may use
  compact mode because usable width, not the hardware label, is what matters.
- Keep all file bytes in the browser. No server upload or cloud-processing
  fallback may be added for mobile.
- Compact does not mean “hide settings at random.” Keep the useful controls,
  choose safe defaults, group advanced controls in a disclosure, and describe
  actual limitations honestly.
- Long work must survive normal React rerenders, report progress, support cancel
  where the engine supports cancellation, and never silently discard a partial
  batch.
- Touch targets must be at least 44 by 44 CSS pixels. There must be no horizontal
  page scroll at any supported viewport.
- Preserve the “Visit Kuber Bassi” link and existing legal/privacy navigation.

## Current state

### App and responsive gate

- `src/App.tsx:113-150` owns route-to-page rendering. It lazily loads the large
  desktop page components and passes the processed-file callback to them.
- `src/App.tsx:158-169` renders the temporary compact-screen notice.
- `src/index.css:7177-7230` activates that notice at `max-width: 1100px`, hides
  every following app child with `.compact-screen-notice~*`, locks `body`
  scrolling, and therefore blocks phones and tablets from all tools.
- `src/config/toolRouteData.ts:11-46` is the canonical route registry. Compact
  tools must retain these URLs rather than create `/mobile/...` duplicates.

### Reusable processing and UI foundations

- `src/components/Common/FileUploader.tsx` already supports validation,
  multiple selection, drag/drop, paste, and input reset.
- `src/components/Common/CompressionPresetSelector.tsx` supplies reusable
  compression presets.
- `src/components/Common/ProgressBar.tsx`, `ErrorBanner.tsx`,
  `ResultDownloadButton.tsx`, and `ExportNotice.tsx` cover shared job feedback.
- `src/utils/batch.ts` already supplies duplicate filtering, safe unique names,
  local preference storage, sharing, individual downloads, Download All, and
  ZIP export.
- `src/utils/image.ts`, `src/utils/ffmpeg/video.ts`,
  `src/utils/ffmpeg/audio.ts`, `src/utils/pdf.ts`, and
  `src/utils/universalConversion.ts` are processing-layer entry points. Compact
  pages must call these (or extracted orchestration hooks), never copy them.
- `src/pages/ImageTools/ImageTools.tsx` and PDF compression already have mature
  multi-file behavior. `src/pages/UniversalConverter/UniversalConverter.tsx`
  already has a sequential bulk queue. Audio and video remain largely
  single-file and need a real queue before compact bulk export can be claimed.
- `src/pages/PdfTools/components/ImagesToPdfPanel.tsx` already accepts multiple
  PNG/JPEG/WebP files and supports ordering. Its engine is reusable, but the
  desktop panel styling is not the target compact interface.

### Existing full-workspace pressure points

- `src/pages/PdfTools/PdfEditor.tsx` is about 2,800 lines;
  `ImageTools.tsx` about 1,500; `PdfTools.tsx` about 1,400; `AudioTools.tsx` and
  `VideoCompressor.tsx` about 800 each. Adding scattered mobile branches inside
  those files would make them harder to verify and would couple compact and
  desktop layouts.
- `src/index.css` is over 7,200 lines and contains legacy responsive overrides.
  New compact UI styles need a dedicated stylesheet and clear ownership; do not
  append another large mixed block to the end of the global file.
- Existing workflow tests under `src/test` cover the engines and desktop
  orchestrators. They do not prove real touch interaction, browser workers,
  downloads, orientation changes, or mobile memory behavior.

## Supported layout contract

Use a shared `useLayoutMode` hook backed by `matchMedia`, with the breakpoint
also exported as a CSS custom property or documented token so JavaScript and CSS
cannot drift.

| Mode | Width target | Intended experience |
|---|---:|---|
| Compact | below 768px | Purpose-built one-column phone/narrow-window UI |
| Full tablet | 768–1099px | Existing full tools with collapsible rails, wrapping controls, stacked preview where needed |
| Full desktop | 1100px and above | Current editor-first layout, preserving established geometry |

The breakpoint is an initial contract, not proof that every device fits. Test
content at 320, 360, 390, 430, 768, 820, 1024, 1280, and 1440 CSS pixels.
If a full tool cannot remain usable at 768px after a reasonable reflow, give
that individual tool a documented compact presentation below its own measured
minimum width. Do not raise the global phone cutoff merely to protect one tool.

Orientation changes must switch layouts without losing selected files, queue
state, results, or settings. Layout mode is presentation state, not job state.

## Compact information architecture

### Compact home

Use a small mobile header, privacy statement, recent tools, and searchable tool
groups. The first screen should emphasize the three common jobs:

1. **Compress files**
2. **Convert files**
3. **PDF quick tools**

Below those, show direct task cards for supported compact tools. Do not show
desktop-only cards that lead to a dead end. A desktop-only route opened directly
on a phone should show a useful explanation plus relevant compact alternatives,
not the old app-wide blocking screen.

### One central compact tool shell

Create a reusable shell with this stable sequence:

1. Compact header: back, task title, privacy indicator.
2. Step/status header: Add files → Options → Process → Results.
3. Content card for the current step.
4. Sticky bottom action bar above the safe-area inset.
5. Inline progress and per-file queue status.

Suggested ownership:

```text
src/compact/
├── CompactApp.tsx
├── CompactHome.tsx
├── compactTools.ts
├── hooks/
│   ├── useLayoutMode.ts
│   └── useCompactJobQueue.ts
├── components/
│   ├── CompactShell.tsx
│   ├── CompactFileQueue.tsx
│   ├── CompactOptions.tsx
│   ├── CompactProgress.tsx
│   ├── CompactResults.tsx
│   └── CompactUnsupported.tsx
├── tools/
│   ├── CompactCompressor.tsx
│   ├── CompactConverter.tsx
│   ├── CompactPdfTool.tsx
│   └── CompactImagesToPdf.tsx
└── compact.css
```

`compactTools.ts` is a typed capability registry, not a second route registry.
Each entry references a canonical `TOOL_ROUTES` ID and declares compact support,
accepted file types, single/bulk mode, available option schema, engine adapter,
result type, and capability notes. Tests must fail if a compact ID has no
canonical route or if the home exposes an unsupported entry.

## Compact launch scope

### Tier A — required for the first public mobile release

#### 1. Compression hub

- **Images**: multiple import; balanced/smaller/best-quality presets; output
  format; optional resize; metadata removal; per-file progress and failure;
  retry; remove/reorder; Download All/ZIP; share one result where Web Share is
  available.
- **PDFs**: multiple import; the existing safe compression presets; metadata
  removal; per-file output; partial-success summary; retry; Download All/ZIP.
- **Audio**: multiple import; quality/bitrate preset; output format; retain the
  useful trim and metadata options in an Advanced section; sequential queue;
  cancel current item; retry failures; individual and bulk export.
- **Video**: multiple import; balanced/smaller/best-quality and existing target
  presets where valid; output format; optional mute; sequential queue; cancel
  current item; retry failures; individual and bulk export.

For audio/video, first extract job orchestration from the page component into a
tested hook/service. FFmpeg should load once and process sequentially. Do not run
multiple heavyweight FFmpeg encodes concurrently on phones.

#### 2. File converter

Reuse the verified capability registry and `convertUniversalFile` dispatch.
Keep mixed-file bulk conversion, shared-target filtering, per-file progress,
retry, cancel when supported, safe filenames, individual download, and
Download All/ZIP. Disable impossible format pairs before processing and explain
why. Do not advertise “any file” literally; say “supported files” and show the
formats derived from `conversionCapabilities.ts`.

#### 3. PDF quick tools

- Merge PDFs: add, remove, and reorder documents; merge; download.
- Protect PDF: password + confirmation, clear error states, never persist the
  password.
- Unlock PDF: only for files the user is authorized to modify; password field;
  clear unsupported-encryption messaging.
- PDF to images: PNG/JPEG selection, sensible quality, page range, page-level
  progress, per-page or ZIP export.
- Images to PDF: import PNG/JPEG/WebP, thumbnail list, reorder, rotate, optional
  simple scan filters, page size/fit choice, export. Deliberately omit the full
  desktop image editor, freeform cropping, layers, and advanced canvas tools.

### Tier B — add after launch data and device testing

- Split PDF with page ranges and thumbnail selection.
- Organize PDF pages with reorder/rotate/delete if thumbnail memory use is safe.
- Remove PDF metadata and remove blank pages.
- Extract PDF text / PDF to Markdown.
- Audio joiner, BPM/key detection, and pitch/speed controls using the same
  compact shell.
- Video to audio, mute video, and short video-to-GIF flows.

### Desktop-only at initial mobile launch

- Full PDF annotate/redact/sign/stamp/watermark canvas workspace.
- Markdown split editor and live paginated PDF preview.
- Rasterbator/poster visual workspace.
- Metadata editor until per-format compact forms are designed.
- Advanced image editor features such as crop canvas, censorship brush,
  vectorization, and watermark positioning.

These are not removed from tablets/desktops. On phones, direct routes use
`CompactUnsupported` with a short reason and links to the closest useful compact
tasks. Add a compact feature only when it can fit the central shell and pass the
same quality gates; do not grow a second editor framework.

## Commands required throughout implementation

| Purpose | Command | Expected on success |
|---|---|---|
| Lint | `npm.cmd run lint` | exit 0, no reported errors |
| Tests | `npm.cmd run test` | exit 0, all existing and new tests pass |
| Build | `npm.cmd run build` | exit 0, production bundle completes |
| Full gate | `npm.cmd run quality` | lint, tests, and build all exit 0 |
| Compressor diagnostics | `npm.cmd run check:compressors` | exit 0 with supported compressor diagnostics |
| Patch hygiene | `git diff --check` | exit 0, no whitespace errors |

Use `npm.cmd`, not `npm`, on this Windows checkout because PowerShell can block
`npm.ps1`.

## Git workflow

- Suggested branch: `codex/mobile-compactor`
- Use small logical commits. The repository commonly uses short imperative
  subjects such as `fix: tame oversized home hero heading` and
  `refactor: centralize PDF result tasks`.
- Do not push or open a pull request unless the operator explicitly requests it.
- Do not mix dependency upgrades or unrelated desktop redesigns into these
  phases.

## Phase 1 — Establish responsive foundations and tablet support

**Progress (2026-09-24): COMPLETE.** The shared `useLayoutMode` contract is in
place, the temporary gate applies only below 768px, and tablet workbench
docks/toolbars have responsive constraints. All 42 public tool routes passed at
portrait- and landscape-tablet widths (84 loaded-route checks) with no document
or main-content horizontal overflow. Real small-file image, PDF, audio, video,
and universal-converter flows produced downloadable results at tablet width.
The video evidence is repeatable through `npm.cmd run check:tablet-video` while
the dev server is running; it generates a non-personal H.264 fixture in-browser.

### Files in scope

- `src/App.tsx`
- `src/index.css`
- `src/styles/workbench.css`
- `src/components/Workspace/*`
- relevant desktop page styles/components only where a measured 768–1099px
  failure exists
- new `src/compact/hooks/useLayoutMode.ts`
- new layout-mode and responsive tests under `src/test`

### Work

1. Add `useLayoutMode` with `matchMedia`, change listeners, SSR/test fallback,
   and cleanup. Keep job state above the presentation branch.
2. Change the global temporary gate so it blocks only compact widths during
   this phase. Tablets at 768px and wider enter the real app.
3. At tablet widths, convert fixed side rails to collapsible drawers or top
   control sections; allow command bars and tabs to wrap or scroll internally;
   stack preview/settings only when side-by-side panels become unusable.
4. Audit the true scroll owner for each workspace. Preserve `min-height: 0` in
   flex chains and use `.workbench-scroll-region` for the element that actually
   scrolls. Never solve overflow by clipping the page.
5. Move new tablet rules beside their owning workspace styles. Do not add more
   broad `!important` overrides to the end of `index.css`.
6. Make dialogs, dropdowns, and sticky bars respect `100dvh`/`100svh`, keyboard
   space, and safe-area insets.

### Verify

- Automated: `npm.cmd run quality` and `git diff --check`.
- Browser matrix: 768×1024, 820×1180, 1024×768, 1280×800, and 1440×900.
- On every public route: no page-level horizontal scrollbar; nav remains usable;
  upload can be reached; primary action is visible; dialogs fit the viewport;
  focused controls are not covered by sticky UI.
- Run at least one real small-file happy path for image, PDF, audio, video, and
  universal conversion at 768px and 1024px.

## Phase 2 — Build Compact App shell and replace the temporary screen

**Progress (2026-09-24): COMPLETE.** The Compact App shell, searchable home,
canonical capability registry, planned-workflow introduction, and useful
desktop-only alternatives are implemented. The temporary phone blocker and its
global body lock are removed. Browser checks cover 320–430px compact layouts,
supported and unsupported routes, search, legal pages, and switching back to
the full workspace at tablet width. The tablet hamburger menu was also rebuilt
as a compact right-aligned panel and verified at 768x1024 and 1024x768.

### Files in scope

- `src/App.tsx`
- `src/config/toolRoutes.ts` only if a helper is needed; do not duplicate routes
- new `src/compact/CompactApp.tsx`, `CompactHome.tsx`, `compactTools.ts`
- new shared compact components and `compact.css`
- `src/test/toolRoutes.test.ts` plus new compact navigation/shell tests

### Work

1. Render `CompactApp` below the compact breakpoint while keeping routing,
   processed count, recent tools, theme, metadata, and legal links shared.
2. Build the compact home and common shell. Use normal document scrolling and a
   safe-area-aware sticky action bar; do not lock `body` globally.
3. Add typed compact capability entries for Tier A tools. Derive titles,
   descriptions, and paths from `TOOL_ROUTES`.
4. Add `CompactUnsupported` for known desktop-only routes and keep `NotFound`
   for genuinely unknown routes.
5. Remove the old notice markup and its CSS only when the compact home works at
   every compact test width.
6. Preserve application state across orientation/breakpoint changes. If moving
   state above the branch is not sufficient for `File` objects and object URLs,
   establish a scoped job provider with explicit URL ownership and cleanup.

### Verify

- Unit tests cover matchMedia changes, canonical route parity, supported and
  unsupported route rendering, browser back/forward, and orientation changes.
- At 320, 360, 390, and 430px: no horizontal overflow, no clipped focus rings,
  44px touch targets, visible error text, keyboard-accessible file selection,
  and sticky action bar above the safe area.
- `npm.cmd run quality` and `git diff --check` pass.

## Phase 3 — Launch compact image and PDF compression

**Progress (2026-09-24): COMPLETE.** Image and PDF compression now use a
shared sequential compact queue with duplicate skipping, reordering, removal,
cancel-before-start, partial success, retry, owned object-URL cleanup, saved
settings, individual downloads, and ZIP export. Both adapters call the existing
desktop processing engines. Real PNG and PDF flows passed in Chrome at 360px
and 430px without horizontal overflow.

### Files in scope

- new `CompactCompressor.tsx` and shared queue components/hooks
- small processing adapters that call `processImage` and `compressPdf`
- existing shared batch utilities; extend them only when behavior is general
- focused tests for compact compression and queue behavior

### Work

1. Define a generic queue state contract for pending, processing, complete,
   failed, and cancelled jobs. The contract may be shared; engine-specific
   settings and execution remain separate adapters.
2. Implement image and PDF modes with multiple selection, duplicate skipping,
   reorder/removal before processing, sequential jobs, retry, partial success,
   settings persistence, metadata controls, and bulk export.
3. Keep processing after one file fails. Summarize completed, failed, original,
   and output sizes without promising an estimate the engine cannot know.
4. Revoke only owned object URLs when a job/result is replaced or unmounted.
5. Record processed-file activity only after successful outputs, using the same
   semantics as the desktop pages.

### Verify

- Tests cover empty selection, duplicate files, mixed success/failure, retry,
  cancel-before-start, unique names, object URL cleanup, preference restoration,
  individual download, ZIP/Download All, and processed-count accuracy.
- Real-browser checks use small PNG/JPEG/WebP and PDF fixtures at 360 and 430px.
- `npm.cmd run quality` and `git diff --check` pass.

## Phase 4 — Add compact audio/video compression with true bulk queues

**Progress (2026-09-24): COMPLETE.** Compact audio and video compression now
share the sequential queue and dynamically load the existing FFmpeg engines.
The flows include output, quality, resolution/channel, metadata, mute, and
advanced audio controls; active cancellation terminates only the FFmpeg worker
and leaves the queue recoverable. FFmpeg core is bundled locally instead of
depending on a runtime CDN. Real WAV and generated video jobs passed at 360px,
including orientation preservation and actual ZIP downloads.

### Files in scope

- extracted audio/video job services or hooks
- `CompactCompressor.tsx` adapters
- existing desktop audio/video pages only to adopt the shared orchestration
- focused queue, cancellation, and regression tests

### Work

1. Extract engine invocation, settings mapping, progress, result naming,
   cancellation, and cleanup from the desktop page components. Keep visual
   state in each presentation.
2. Implement sequential audio and video queues. Reuse a loaded FFmpeg instance;
   never run parallel encodes on compact devices.
3. Provide the Tier A controls. Put trim, metadata, mute, and advanced format
   options in accessible disclosures without removing them.
4. Add clear resource messages before large jobs. Set limits from measured
   device/browser behavior, not an invented universal number. Allow users to
   remove oversized queue items without losing the rest.
5. Ensure cancel terminates only the active job, leaves completed results
   downloadable, and lets remaining jobs resume or be cancelled.

### Verify

- Tests cover ordered execution, progress isolation, engine init failure,
  mid-job cancel, retry, partial batch, and unmount cleanup.
- Run `npm.cmd run check:compressors` plus the full quality gate.
- Real-device or browser checks cover a small MP3/WAV and MP4/WebM at 360px,
  orientation change during an idle configured job, screen lock/background
  interruption messaging, download/share, and queue recovery.

## Phase 5 — Add compact universal converter

**Progress (2026-09-24): COMPLETE.** The compact converter shares the canonical
source/target registry and preferred-target decisions with desktop. It supports
compatible mixed files, target filtering, reordering, sequential progress,
retry, partial results, cancellation where the engine permits, safe result
names, individual downloads, and ZIP export. The heavy conversion engine stays
behind a dynamic import. Real document, image, audio/video, text, and data flows
passed at 360px, with unsupported targets blocked before processing.

### Files in scope

- `CompactConverter.tsx`
- shared/extracted universal-conversion queue orchestration
- `conversionCapabilities.ts`, only if the registry needs presentation metadata
- compact converter tests and existing universal converter regressions

### Work

1. Make the capability registry the single source for source/target pairs and
   human-readable limitations.
2. Extract the current bulk orchestration from the desktop component so desktop
   and compact presentations use identical conversion decisions.
3. Support mixed compatible files, shared-target filtering, sequential progress,
   remove/reorder, retry, cancel where possible, partial results, safe names,
   and Download All/ZIP.
4. Lazy-load heavy conversion engines only after the user selects a compatible
   conversion and starts it. Do not make the compact landing bundle absorb the
   current large converter route chunk.

### Verify

- Extend `universalConverter.test.ts`, `UniversalConverterBulk.test.tsx`, and
  capability tests for parity between desktop and compact.
- Browser-check representative document, image, audio, video, text, and data
  pairs. Verify unsupported pairs are disabled before processing.
- Confirm route-level chunking in the production build output, then run the full
  quality gate.

## Phase 6 — Add compact PDF quick tools

**Progress (2026-09-25): COMPLETE.** Merge, Protect, Unlock, PDF to images,
and the deliberately simpler Images to PDF workflow now run in the compact
shell through shared PDF engines. The mobile presentations add accessible
ordering, confirmed and non-persisted passwords, precise page ranges,
page-by-page canvas disposal, thumbnail URL cleanup, rotation, filters, and
ZIP export. Real protected-PDF round trips and every compact PDF flow passed
in Chromium and WebKit at 360px without horizontal overflow.

### Files in scope

- `CompactPdfTool.tsx`, `CompactImagesToPdf.tsx`
- extracted headless PDF job adapters
- existing PDF engines and small reusable logic extracted from desktop panels
- PDF compact workflow tests

### Work

1. Implement Merge PDF with accessible move earlier/later controls in addition
   to drag reordering.
2. Implement Protect and Unlock with password visibility toggle, confirmation
   for protection, no persistence/logging, and precise error states.
3. Implement PDF to images with page range, PNG/JPEG, page progress, and ZIP.
4. Implement the deliberately simpler Images to PDF workflow: thumbnail list,
   accessible reorder, per-image rotation, simple filters, page size/fit, and
   export. Reuse `imagesToPdf`; do not embed the full image editor.
5. Add task-specific cleanup and memory safeguards for rendered page canvases
   and thumbnails.

### Verify

- Tests cover merge order, encrypted inputs, incorrect passwords, password
  non-persistence, page range parsing, multi-page export names, image order,
  rotation/filter mapping, object URL cleanup, and partial failures.
- Browser-check multi-file pickers and downloads on Chromium plus one WebKit
  browser if available; document any engine limitation rather than hiding it.
- Run the full quality gate and `git diff --check`.

## Accessibility, performance, and browser acceptance

These requirements apply to every phase:

- Semantic headings and landmarks; one `main` per rendered presentation.
- Full keyboard operation, including visible focus, queue reorder controls, and
  disclosures. Dragging is never the only reorder method.
- Progress uses `role="progressbar"` or appropriate status/live regions without
  announcing every tiny update.
- Errors identify the file and a recovery action. Color is not the sole signal.
- Respect reduced motion, text zoom to 200%, high contrast/forced colors where
  practical, and light/dark theme tokens.
- Use `dvh`/`svh` carefully, safe-area insets, and scroll focused form controls
  above the on-screen keyboard.
- Lazy-load tools and engines. Compact home must not eagerly load FFmpeg,
  PDF.js, OCR, or office-conversion bundles.
- Sequentialize memory-heavy work and dispose canvases, audio buffers, worker
  state, and object URLs promptly.
- Provide fallback download when Web Share or multi-file sharing is unavailable.

Minimum browser matrix before declaring compact production-ready:

- Android Chrome: current stable, real device if available.
- iOS Safari: current stable, real device if available.
- Desktop Chrome responsive mode for 320/360/390/430/768/820/1024 widths.
- Desktop Firefox and Safari/WebKit for at least one compression and one PDF
  flow, where available.

Responsive emulation is necessary but does not prove mobile memory, file picker,
share sheet, backgrounding, or download behavior. Record which checks were real
device versus emulated.

## Test plan

### New unit/component coverage

- `useLayoutMode`: initial state, listener updates, cleanup, fallback.
- Capability registry: canonical route parity and unique IDs.
- Compact shell: navigation, step state, back behavior, focus management,
  sticky action availability, unsupported route alternative.
- Queue reducer/hook: all status transitions, sequential order, cancel/retry,
  partial success, and state preservation across layout changes.
- Each adapter: settings-to-engine mapping and result/error normalization.
- Security: password fields never enter saved settings or logs.

### Browser workflow coverage

Automate representative small-fixture flows after the shell stabilizes:

1. Compact image batch compression and ZIP.
2. Compact PDF compression with one failure and successful retry.
3. Compact universal conversion with an unsupported pair blocked.
4. Compact Merge PDF ordering.
5. Compact Images to PDF reorder/rotate/export.
6. Tablet full-workspace upload, configure, process, and download.
7. Rotate/rescale during a configured job without losing files or results.

Do not mark touch, worker, download, or visual behavior verified from JSDOM unit
tests alone.

## Done criteria

All must hold before the overall plan is DONE:

- [x] The temporary compact-screen notice and its global body lock are removed.
- [x] Full tools are usable from 768px upward, subject only to documented
      per-tool measured exceptions.
- [x] Compact home and Tier A tools work from 320px upward without page-level
      horizontal overflow.
- [x] Image, PDF, audio, and video compact compressors support real bulk queues,
      partial results, retry, and bulk export.
- [x] Compact converter supports the same verified pairs and bulk reliability as
      desktop without duplicating conversion logic.
- [x] Merge, Protect, Unlock, PDF to images, and simple Images to PDF are present
      in the compact shell.
- [x] Desktop-only mobile routes explain the limitation and link to useful
      compact alternatives.
- [x] Orientation/layout changes do not lose selected files, queue state,
      settings, or completed results.
- [x] No file bytes are uploaded to a server and no password is persisted.
- [x] Compact home does not eagerly load heavyweight processing engines.
- [x] New automated tests pass alongside all existing tests.
- [x] `npm.cmd run quality`, `npm.cmd run check:compressors`, and
      `git diff --check` pass.
- [x] The viewport and browser matrix is recorded with real-device versus
      emulated evidence clearly distinguished.
- [x] Maintained README/PWA documentation accurately lists compact-supported and
      desktop-only tools without claiming untested browser behavior.
- [x] The plan status in `plans/README.md` is updated phase by phase and marked
      DONE only after every criterion above is met.

## STOP conditions

Stop and report instead of improvising if:

- Compact support appears to require copying an engine or route registry.
- A processing engine requires file upload/server processing to work on mobile.
- Moving between full and compact presentation would revoke or lose live result
  URLs; resolve ownership/state architecture before continuing.
- FFmpeg bulk processing cannot reliably cancel and restart with the current
  lifecycle; isolate that lifecycle before exposing bulk controls.
- A tool exceeds measured mobile memory limits even with sequential work and
  prompt cleanup; keep it desktop-only and document the evidence.
- Tablet fixes require broad late-file `!important` overrides or break the
  desktop geometry; establish a clearer style owner first.
- A phase changes output format, compression semantics, password behavior, or
  conversion capability instead of only presentation/orchestration; split that
  engine change into a separately reviewed task.
- The full quality gate fails twice after a reasonable correction, or browser
  testing reveals data loss, stale downloads, or inaccessible primary actions.

## Maintenance notes

- Every new tool route must declare its compact support in `compactTools.ts` and
  have a parity test.
- Keep the compact shell intentionally linear. A feature that needs a freeform
  canvas, multi-pane editor, or precision timeline belongs to the full workspace
  until a distinct compact interaction is designed and tested.
- Review mobile memory budgets whenever PDF.js, FFmpeg, OCR, or office-conversion
  dependencies change.
- Treat 768px as a tested starting contract. Adjust only from measured failures
  across the full route matrix, never from a single screenshot.
- Future Tier B additions should reuse the queue, options, progress, and result
  primitives established here instead of adding tool-specific page shells.
