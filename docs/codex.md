# Compactor — Working Guide for AI Collaborators

This file explains how to work on Compactor with the same product judgment, communication style, and engineering standards established during the workspace upgrade. Read it before making a broad UI, export, processing, or documentation change.

## The product in one sentence

Compactor is a private, browser-first file workspace. It should feel like a focused native editor: upload files, configure a clear operation, watch an honest local process, review the result, and export a file that is actually usable.

The product should never pretend to support a format, processing mode, file size, preview, or quality guarantee that the browser implementation cannot deliver.

## How to understand the user's requests

The user often writes quickly, informally, and iteratively. Interpret the intent, not the spelling.

- “Optimize,” “make it stronger,” or “polish” means improve the whole interaction surface around the named issue: hierarchy, spacing, overflow, responsive behavior, states, accessibility, labels, and the real processing path.
- “Check all features” means inspect the control-to-export path, not only whether the control renders. Look for misleading options, unsupported formats, state mismatches, incorrect filenames/MIME types, and preview/export divergence.
- “Like Premiere Pro” means a professional editor hierarchy: preview gets primary space; timeline/controls are compact and spatially stable; panels use the remaining viewport intelligently; dense actions remain discoverable.
- “Same as [another workspace]” means reuse the established component geometry and interaction patterns rather than making a visually similar new version.
- Screenshots are bug reports and design specifications. Match the concrete issue shown, then account for the larger state it implies (long queues, portrait media, processing, results, mobile, and errors).
- Do not over-question straightforward product requests. Make a safe, scoped interpretation, implement it, and clearly state the assumption only if it materially changes behavior.

## Product principles

1. Reliability beats feature count.
   - Remove, disable, or honestly label an option when the browser cannot produce a correct result.
   - A downloadable file is not proof of a successful operation. Verify its MIME type, bytes, readability, size, and representative visual output where relevant.

2. Keep processing local where it is credible.
   - Explain browser memory and codec limits instead of masking failures behind blank processing screens.
   - Use browser-safe limits for heavyweight media. Reject impossible inputs before beginning a job.
   - Do not add browser-only features such as a video merger unless the memory/codec/error path is designed and tested first.

3. The loaded file is the main object.
   - Empty states can be calm and centered.
   - Loaded states should become a workspace: persistent identity, contextual tools, large preview, honest progress, and results in context.
   - Do not trap the preview in a decorative card that crops it or gives it less space than unused background.

4. Every state needs honest language.
   - Never show a per-file percentage when the underlying API only reports completion.
   - Prefer `Encoding` plus a real batch percentage over a permanent fake `0%`.
   - A disabled action must say why it is unavailable.

5. Use progressive disclosure.
   - Common actions first; advanced controls are available without overwhelming the initial view.
   - Remove duplicate controls, explanatory cards, and modes once their purpose is already represented in the active workspace.

## Workspace design rules

### Shared structure

- Use the shared tool header and workspace shell when a file session is active.
- Preserve the project’s viewport-frame geometry. Check final CSS overrides before changing layout; later overrides in `src/index.css` and `src/styles/workbench.css` can defeat an apparently correct selector.
- Desktop workspaces fill the available application surface. Mobile must deliberately stack rather than accidentally inherit desktop dimensions.
- Protect every grid/flex child that can shrink with `min-width: 0` and `min-height: 0`.
- Keep scroll ownership explicit. One region should own each axis; avoid nested raw scrollbars and accidental page scrolling.

### Image Optimizer

- The right queue rail is intentionally separate from the file identity bar. The header bar identifies the active file; the rail manages the queue.
- Keep the add-image tile at the top, the same size as a thumbnail, outside the scrolling thumbnail list. The thumbnails alone scroll vertically on desktop.
- Start image previews at 80% zoom so the image and queue rail fit together. The checkerboard must span the complete preview viewport with no unexplained gap at the queue boundary.
- A long queue must not create a bottom dead zone, horizontal scrollbar, or hidden add action.
- Image canvas processing supports JPEG, PNG, and WebP outputs. Do not expose GIF output/input in Image Optimizer: canvas cannot faithfully recreate animated GIFs.
- Normalize historical `original` settings to `preserve`; both must resolve to the input MIME type before the supported-output fallback is applied.
- The metadata switch must not imply that EXIF can be preserved through a canvas re-encode. Canvas output strips metadata as a consequence of processing.
- Compression presets are product-facing promises. Their quality values and any target-size/resolution behavior must be traceable to the encoder options.
- Preview filters may use CSS for responsiveness, but exported filters use canvas algorithms. Do not claim pixel-perfect preview parity without rendered output comparison.

### Video Studio

- The user-facing product name is Video Studio, not merely “Compressor,” because it now contains compression, format conversion, audio extraction, trimming, and GIF output.
- Default into the Compress settings. Never leave Audio extraction selected when opening a normal video workflow.
- Audio extraction belongs inside the video workflow as an explicit toggle. When enabled, visually dim or disable incompatible video controls and say that only audio will download.
- GIF is an output format inside Format, not a separate top-level application mode.
- Use FFmpeg WASM for exports. Do not revive the MediaRecorder/captureStream “Native” path: it caused dropped frames, torn/distorted audio, and timestamp issues during real-time recording.
- The preview must preserve the full video edges with `object-fit: contain`; account for portrait video and dynamically reduce preview height when the timeline opens.
- Place the trimmer below the preview. Allow the panel to grow for multi-segment controls without covering the preview or causing arbitrary gaps.
- Validate FFmpeg output before presenting results: delete stale output, reject non-zero exit codes, and reject missing/empty output bytes.
- Use browser-device-aware media limits before `fetchFile`. A large file that cannot be read by WASM must produce a clear in-workspace error, never a blank page.

### Rasterbator / Poster

- The preview must use the real visual operation, especially Classic Halftone Dot Art—not a CSS approximation.
- PDF accuracy is a higher bar than successful generation. Preview and export should eventually use a canonical processed master image/coordinate system.
- Check portrait and landscape, crop marks, tile order, page count, seams, print margins, and style-specific output. A build passing does not prove printable parity.

## Code practices

- Prefer small, reusable components with readable class names. Do not turn a local layout correction into an abstract framework.
- Keep processing engines in `src/utils`; keep UI state and user messaging in the page/components.
- Derive simple values during render instead of duplicating them in state. Example: derive `batchProgress` from current index and completed work once, then use it in all processing surfaces.
- Use functional state updates when updates depend on prior state.
- Revoke every object URL when a file/result is removed, reset, or unmounted.
- Use direct imports rather than broad barrel imports where practical.
- Do not put expensive synchronous image/video work directly in high-frequency React render paths.
- Do not advertise input formats or output extensions that are only superficially accepted. The output data signature, filename extension, and UI label must agree.
- Avoid forceful `!important` additions unless working within the existing workspace override layer and there is a documented selector conflict. Prefer a precise final selector.
- Preserve user changes in a dirty worktree. Do not reset, checkout, or mass-format unrelated files.

## Export and quality checklist

Before calling an export feature reliable, trace this exact chain:

1. The UI exposes the setting.
2. The setting reaches the processing function.
3. The processing function supports it for this input type.
4. The generated bytes are non-empty and use the claimed format.
5. The filename extension matches the actual output.
6. The downloaded result re-opens correctly.
7. Dimensions, transparency, duration, audio, trim range, visual effect, and size align with the selected settings.

Use representative samples, not only one easy file:

- JPEG photo, transparent PNG, WebP, large/detailed image, portrait image.
- Image resize, crop, rotation, mirror, grayscale, contrast, B&W, halftone, watermark positions, all presets, and target size mode.
- Video landscape/portrait, short/long duration, audio/no audio, trim/split, normal video, audio-only, and GIF output.
- Poster light/dark/color/monochrome/halftone, portrait/landscape, multi-page layouts.

When browser automation is unavailable, do not claim visual or end-to-end verification. State exactly what was checked by lint/tests/build and what requires a manual exported-file comparison.

## Validation commands

Use Windows PowerShell and `npm.cmd` (not `npm`, because PowerShell may block `npm.ps1`).

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

- Use focused tests while iterating, then run the complete test suite for a broad feature pass.
- `git diff --check` can reveal pre-existing whitespace in a dirty tree. Do not rewrite unrelated user files just to silence it; report the scope clearly.
- jsdom may log canvas `getContext` limitations while tests pass. This is not visual-output proof.
- Browser automation should be used for actual interaction/visual checks when available. If the local automation CLI is unavailable, say so plainly.

## Documentation standard

- Keep `docs/product-upgrade-roadmap.md` current after meaningful changes.
- Record: what changed, current constraints, non-ideal shortcuts, known issues, and the difference between automated validation and visual/output-fidelity evidence.
- Use plain, human-readable language. The roadmap is a product ledger, not just a technical changelog.
- Do not call a capability “perfect,” “native,” “lossless,” or “accurate” unless the implementation and validation meet that claim.

## Communication style

- Start with the outcome, not a list of internal steps.
- While working, send short commentary updates that explain the active assumption or finding.
- In the final response, be concise and concrete: what changed, what was verified, and the remaining real limitation if any.
- Match the user’s direct, collaborative tone. Be decisive when evidence supports a fix; do not use empty praise or vague assurances.
- Use local file links when handing off important edits.

## Safety and scope

- Never make destructive repository changes without explicit authorization.
- Do not publish, commit, push, install dependencies, or change external services unless requested.
- Do not invent cloud/server processing to bypass a browser limitation. Explain the needed authority, infrastructure, or user choice first.
- Keep new work within the user’s request, but take adjacent low-risk fixes when they are necessary for the requested experience to work correctly.

## Current known limitations worth preserving in future chats

- Browser image canvas export cannot faithfully output animated GIFs.
- Browser FFmpeg/WASM has finite memory and codec limits; large uploads must be rejected before processing instead of failing blankly.
- Rasterbator preview/PDF visual parity needs real rendered-output comparison, especially at tile seams.
- CSS filter previews and canvas export filters are not automatically pixel-identical.
- Automated lint, tests, and builds establish code health; they do not replace manual visual/export verification.

