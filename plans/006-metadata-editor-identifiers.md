# Upgrade the metadata editor with format-aware identifiers

## Goal

Make the Metadata Editor useful for both media tags and image metadata while
preserving Compactor's promise that files stay on the user's device. Users
should be able to identify the actual tags present in a file, understand which
ones can be safely edited, make common changes, and verify the downloaded
result.

## Current behavior and evidence

- `src/pages/MetadataEditor/MetadataEditor.tsx` accepts audio, video, and image
  files, but renders one shared six-field form (`title`, `artist`, `album`,
  `year`, `genre`, `comment`). It only shows cover-art controls for audio.
- `src/utils/ffmpeg/audio.ts` defines the six-field `MetadataTags` type and
  `parseMediaTagsFromFFmpegLog`, which extracts a small set of aliases from
  FFmpeg's input log. `readMediaMetadata` extracts audio cover art; it does not
  expose a complete inventory of tags, stream identifiers, or image EXIF/IPTC/
  XMP fields.
- `writeMediaMetadata` uses stream copy and `-map_metadata -1`, then writes the
  six form fields back. It returns an output file without re-reading it to
  confirm which tags the selected container retained.
- The upload zone explicitly accepts `audio/*,video/*,image/*`, so presenting
  the shared media-tag form for every accepted image creates a misleading
  editing promise.
- The app's README states that files are never uploaded. Server-side wrappers
  such as ExifTool services would violate that product boundary; any new
  metadata engine must execute in-browser.
- `src/test/metadataTools.test.ts` and `src/test/audioTools.test.ts` already
  include parser smoke coverage, but do not cover a full identifier inventory,
  multiline values, stream-scoped identifiers, capability decisions, or the
  MetadataEditor read/edit/save workflow.

## Scope and decisions

1. Keep parsing and writing local in the browser. Do not add an API endpoint or
   upload path. Define the initial exact input/output format and operation
   matrix before changing the UI. Use FFmpeg for formats and fields it can
   demonstrably preserve.
2. Add a format-aware metadata adapter. Audio/video use a richer FFmpeg probe;
   image files use a client-side parser/writer only if it supports the exact
   formats and tags claimed by the UI. Before selecting a dependency, check its
   current browser support, write support, licensing, bundle cost, and format
   limits. A read-only parser must not be presented as an image editor.
3. Model metadata as discovered entries with a stable identifier, display
   label, value, source (container/stream/EXIF/IPTC/XMP), and editability. Keep
   the common form for supported friendly fields; provide a searchable
   identifier view for all discovered fields. Unknown identifiers remain
   read-only unless a format-specific writer can safely preserve them.
4. Make support explicit by format. Do not silently claim that image EXIF,
   GPS, or arbitrary XMP can be written when the selected writer cannot do so.
5. Inspect and either reuse or replace `stripMediaMetadata` before adding a
   “remove identifying metadata” action. Define its proven removal scope for
   global/container tags, per-stream tags, attached artwork, and image
   EXIF/IPTC/XMP/chunk metadata; stream copy alone must not be assumed to strip
   every class. Preview removable identifiers, state any unverified or
   unsupported classes, and distinguish metadata removal from pixel/media
   re-encoding. Correct the helper's broad removal claim if evidence shows it
   exceeds its behavior. Preserve stream-copy behavior where possible.

## Implementation steps

1. Define typed metadata models and a format capability registry near the
   existing metadata utilities. Include format, identifier, source, value,
   editability, and write support. Keep aliases centralized so identifiers such
   as `date`/`year`, `author`/`artist`, and stream-scoped tags map consistently.
2. Improve audio/video probing. First establish whether a browser-available
   ffprobe or structured JSON probe is included in the shipped bundle. Do not
   assume FFmpeg's `-i` command accepts ffprobe output options. If no suitable
   probe exists, harden the existing FFmpeg log parser and normalize its output
   into the typed model while retaining raw identifiers and stream indexes.
   Parse multiline values safely and never construct a regular expression from
   an unescaped identifier. Keep actionable probe errors distinct from “no
   metadata found.”
3. Select a browser-compatible image metadata dependency only after validating
   browser read/write support for the app's stated image formats. Implement it
   behind the same adapter. If safe writing is unavailable for a format, show
   the discovered identifiers read-only with a clear unsupported-write message
   unless a concrete supported alternative exists.
4. Update `MetadataEditor.tsx` to show a file-type-aware editor, a searchable
   identifier inventory grouped by source, support badges, and editable common
   fields. Show empty values distinctly from missing/unreadable values. Add
   validation for year/date and appropriate field lengths, and only enable Save
   when an actual supported change exists.
5. Add a pre-save review of changed and removed fields. After writing, re-read
   the result and report retained, dropped, or normalized identifiers. Keep the
   generated file downloadable if verification is partial, but label the result
   accurately and keep the source file intact.
6. Harden lifecycle handling for rapid file replacement, parser/writer errors,
   reset, retry, and cover previews. Revoke object URLs exactly once and ensure
   stale asynchronous reads cannot overwrite the current file's state.
7. Update route descriptions/search terms and user-facing help only to match
   verified format capabilities. Preserve the “zero server uploads” promise.

## Verification and done criteria

- Add unit tests for identifier normalization, aliases, multiline values,
  malformed logs, stream-scoped identifiers, and format capability decisions.
- Add component workflow tests for read-only formats, editable formats, no-op
  Save disabling, validation, removal review, verification results, retry, and
  selecting a second file before the first read completes.
- Add fixture-based tests for each format and operation advertised as
  supported. Assert the output's identifiers by re-reading it; do not count a
  successful FFmpeg exit as proof that a tag persisted.
- Confirm file bytes are never uploaded to a server during inspection or save.
  Account separately for fetching FFmpeg/WASM runtime assets and any local
  worker messages so those do not create false positives in the privacy check.
- Run `npm.cmd run quality` and `npm.cmd run check:responsive`. Check the empty,
  active, and result states at phone, tablet, and desktop widths, including the
  searchable identifier inventory and keyboard navigation.
- Done means every advertised editable field has round-trip evidence for its
  supported format, unsupported identifiers are clearly read-only, the local
  privacy boundary remains intact, and the full quality and responsive checks
  pass.

## Constraints

- Match the existing React/TypeScript patterns, shared UI components, and
  responsive workbench layout.
- Do not install ExifTool on a server or add backend metadata endpoints.
- Do not expand the UI's support claims based solely on library marketing;
  validate real input/output fixtures in-browser.
- Keep the change scoped to the Metadata Editor and shared metadata utilities.
