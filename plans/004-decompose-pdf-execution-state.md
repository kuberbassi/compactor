# Plan 004: Centralize the simple PDF result lifecycle

> **Drift check (run first)**:
> `git diff --stat 1749226..HEAD -- src/pages/PdfTools src/components src/utils src/test`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/003-characterize-editor-workflows.md`
- **Category**: tech-debt
- **Planned at**: commit `1749226`, 2026-09-14

## Why this matters

`PdfTools` represents file queues, more than a dozen feature configurations,
processing lifecycle, and results as dozens of independent state variables.
Nearly every `run...` handler manually repeats start, status, transform, Blob
URL, result metadata, callback, error, and finalization logic. A first execution
attempt proved that moving all shared state into a hook would conflict with the
organizer, compression, OCR, and multi-result domains. Keep state in
`PdfTools`; delete repeated simple-action lifecycle branches with one local
typed runner.

## Current state

- `src/pages/PdfTools/PdfTools.tsx:76-170` initializes global execution, file,
  organizer, security, image-to-PDF, export, and flatten state in one component.
- `runOrganize` begins at line 490, `runMerge` at 521, `runSplit` at 541, and
  similar single-result handlers continue through `runPdfToMd` near line 959.
- Batch compression has legitimate partial-success/retry behavior and must not
  be forced through a single-result abstraction.
- Feature panels already exist in `src/pages/PdfTools/components/`; preserve
  their public behavior and follow their focused ownership pattern.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| PDF tests | `npm.cmd test -- --run src/test/PdfTools.workflows.test.tsx src/test/pdfTools.test.ts src/test/pdfSecurity.test.ts` | all pass |
| Gate | `npm.cmd run quality` | exit 0 |

## Scope

**In scope**:
- `src/pages/PdfTools/PdfTools.tsx`
- new typed controller/reducer modules under `src/pages/PdfTools/`
- affected PDF panels and focused tests

**Out of scope**:
- `PdfEditor.tsx` decomposition; plan it separately after this pattern proves
  itself.
- PDF transformation algorithms in `src/utils/pdf.ts`.
- UI redesign, new features, CSS migration, or universal media abstraction.

## Steps

### Step 1: Define typed task and error contracts

Add a small `PdfResultTask` contract returning `{ blob, name }` and an
`errorMessage(unknown)` normalizer. Keep existing state in `PdfTools`; keep
batch compression, organizer, OCR, image-to-PDF, and image export outside this
contract.

**Verify**: unit tests cover `Error` and non-Error normalization; strict typecheck passes.

### Step 2: Add one local simple-result runner

Inside `PdfTools`, add a typed `runResultTask` that captures the existing
setters and accepts initial progress, status, failure prefix, and an async task
returning `{ blob, name }`. It owns start, URL/size/name success, callback,
normalized failure, and `finally`. It must not accept setters, tool IDs, or
feature switches.

**Verify**: focused tests cover success, thrown `Error`, thrown non-Error, and
finalization; existing URL-owner tests cover replacement/unmount cleanup.

### Step 3: Migrate simple PDF actions incrementally

Move merge, split, stamp, metadata removal, watermark, page numbers, crop,
sign, protect, unlock, and Markdown extraction to the executor. Preserve exact
result names, status copy, progress milestones, and callback counts locked by
plan 003. Commit/migrate in small logical groups.

**Verify after each group**: focused PDF tests pass.

### Step 4: Leave complex domains explicit

Do not migrate organizer, compression/retry, OCR, PDF-to-images, or image-to-PDF
in this plan. Their partial-progress or multi-result semantics intentionally
remain explicit until separately planned.

**Verify**: focused workflow, PDF utility, and security tests pass.

### Step 5: Verify measurable simplification

Migrated actions must no longer repeat try/catch/finalize blocks. Delete
obsolete branches only when unused. Do not claim the whole component is
decomposed; this is the safe first structural reduction.

**Verify**: `rg -n "catch \(e: any\)" src/pages/PdfTools` returns no matches;
the full quality gate passes.

## Done criteria

- [ ] Repeated simple-result execution lifecycle exists in one tested runner.
- [ ] Batch, OCR, organizer, image-to-PDF, and multi-image differences remain explicit.
- [ ] Result URL replacement/unmount ownership is centralized and tested.
- [ ] PDF tool behavior and visible copy remain unchanged.
- [ ] `PdfTools.tsx` loses the migrated repeated branches and no new large module is created.
- [ ] Strict typecheck, lint, full tests, and build pass.

## STOP conditions

- Plan 003 tests are absent or unstable.
- The proposed helper needs feature-ID switches or many optional callbacks;
  stop because the abstraction is becoming a second god object.
- Migration changes PDF bytes, security behavior, output names, or UI design.
- An in-scope dirty edit conflicts with the current-state description.

## Maintenance notes

The success metric is deleted concepts and repeated branches, not merely a
smaller top-level file. A reviewer should scrutinize optional parameters and
feature switches as signs that domain state was over-generalized.
