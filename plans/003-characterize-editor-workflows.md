# Plan 003: Characterize critical editor workflows

> **Drift check (run first)**:
> `git diff --stat 1749226..HEAD -- src/pages/PdfTools src/pages/ImageTools src/test package.json vitest.config.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-fix-object-url-ownership.md`, `plans/002-enforce-strict-quality-gate.md`
- **Category**: tests
- **Planned at**: commit `1749226`, 2026-09-14

## Why this matters

The largest components own upload, configuration, processing, result, retry,
cleanup, and tool-switch behavior, but most existing tests exercise utilities
or reproduce calculations rather than render those orchestrators. Behavioral
coverage is required before moving state across component boundaries.

## Current state

- `src/pages/PdfTools/PdfTools.tsx:73` starts a roughly 1,500-line component
  with 53 state declarations and many processing handlers.
- `src/pages/PdfTools/PdfEditor.tsx:119` starts a roughly 2,800-line component
  with 51 state declarations and pointer/export behavior.
- `src/pages/ImageTools/ImageTools.tsx:148` combines queue, per-file settings,
  crop, processing, retry, results, and cleanup.
- `src/test/pdfTools.test.ts` largely checks PDF library behavior rather than
  rendering `PdfTools`.
- `src/test/pdfEditor.test.ts` tests extracted helpers rather than the editor.
- Existing component-test conventions are available in
  `src/test/VideoCompressor.processing.test.tsx` and
  `src/test/UniversalConverterBulk.test.tsx`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Focused | `npm.cmd test -- --run src/test/PdfTools.workflows.test.tsx src/test/PdfEditor.workflows.test.tsx src/test/ImageTools.workflows.test.tsx` | all new tests pass |
| Gate | `npm.cmd run quality` | exit 0 |

## Scope

**In scope**:
- three new workflow test files under `src/test/`
- minimal accessibility/test seams in the three components only when a user-
  meaningful role/name cannot be selected reliably

**Out of scope**:
- Production refactoring, snapshots, pixel-perfect assertions, real FFmpeg/OCR,
  or broad test-only IDs.

## Steps

### Step 1: Add PDF Tools workflow characterization

Mock processor modules at their boundaries. Cover one single-file success, one
failure with recoverable UI, one compression partial failure plus retry, one
tool switch/reset, and URL cleanup. Assert accessible UI, result name/size,
download availability, and callback counts rather than implementation state.

**Verify**: the focused PDF Tools test passes and fails if its mocked processor
result is not surfaced.

### Step 2: Add PDF Editor characterization

Use a deterministic tiny PDF fixture or stable PDF.js mock. Cover load, tool
selection, one annotation interaction, save/export, and error recovery. Avoid
testing PDF.js itself.

**Verify**: the focused PDF Editor test passes without canvas-not-implemented
noise specific to the covered flow.

### Step 3: Add Image Tools characterization

Cover multi-file selection, per-file/global setting selection, successful
processing, partial failure/retry, queue removal, and retained URL ownership.

**Verify**: focused image workflow tests pass.

### Step 4: Run the gate and record the new count

**Verify**: `npm.cmd run quality` exits 0. Do not hardcode the count in README.

## Done criteria

- [ ] All three major orchestrators have rendered behavior tests.
- [ ] Success, failure, retry, switching/reset, and cleanup are represented.
- [ ] Tests mock expensive engines only at module boundaries.
- [ ] Tests assert user-observable behavior, not internal state or snapshots.
- [ ] Full quality gate passes.

## STOP conditions

- Tests require weakening production behavior or exporting internal state.
- JSDOM cannot represent a browser boundary without extensive emulation; defer
  that case to browser coverage and retain only stable characterization here.
- Existing plan 001 behavior is not present.

## Maintenance notes

These tests are refactor shields, not exhaustive feature duplication. Reviewers
should reject assertions coupled to exact DOM nesting or incidental CSS classes.

