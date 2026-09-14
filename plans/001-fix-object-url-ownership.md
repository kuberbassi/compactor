# Plan 001: Fix object-URL ownership and failure cleanup

> **Executor instructions**: Follow each step and run every verification. This
> plan was written from a dirty working tree. Preserve all unrelated edits.
>
> **Drift check (run first)**:
> `git diff --stat 1749226..HEAD -- src/pages/PdfTools/PdfTools.tsx src/pages/ImageTools/ImageTools.tsx src/utils/nativeCompressor.ts src/test`
> Then compare the current-state locations below against the live working tree.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `1749226`, 2026-09-14

## Why this matters

Batch retries currently replace an array while retaining successful result
objects. Effect cleanup revokes every URL from the previous array, including
URLs retained by the new array, so earlier download buttons can silently stop
working. Native video metadata failure also leaves a potentially large input
Blob alive for the page lifetime.

## Current state

- `src/pages/PdfTools/PdfTools.tsx:197-205` has an effect depending on
  `resultUrl` and `compressionResults`; every dependency change revokes the
  previous collection.
- `src/pages/PdfTools/PdfTools.tsx:611-633` retries one failed compression by
  mapping a replacement into the existing array, retaining other URLs.
- `src/pages/ImageTools/ImageTools.tsx:265-273` repeats the array-dependent
  cleanup pattern for image results.
- `src/pages/ImageTools/ImageTools.tsx:677` appends retry results to retained
  results.
- `src/utils/nativeCompressor.ts:78-90` creates `fileUrl` before metadata load;
  `tempVideo.onerror` rejects without revoking it.
- Follow the stable-ref cleanup pattern already used for preview URLs at
  `src/pages/ImageTools/ImageTools.tsx:255-263`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `npm.cmd test -- --run src/test/imagePdfQueue.test.ts src/test/VideoCompressor.processing.test.tsx` | exit 0 |
| Full tests | `npm.cmd run test` | 45+ files pass |
| Lint | `npm.cmd run lint` | exit 0 |
| Build | `npm.cmd run build` | exit 0 |

## Scope

**In scope**:
- `src/pages/PdfTools/PdfTools.tsx`
- `src/pages/ImageTools/ImageTools.tsx`
- `src/utils/nativeCompressor.ts`
- focused tests under `src/test/`

**Out of scope**:
- Changing conversion output, compression algorithms, progress semantics, or UI.
- Broad component decomposition.
- Reformatting any touched file.

## Steps

### Step 1: Characterize retained-result ownership

Add focused tests that install spies for `URL.createObjectURL` and
`URL.revokeObjectURL`. Prove that replacing/retrying one result does not revoke
URLs still present in the next state, while reset/unmount revokes all owned
URLs exactly once.

**Verify**: run the new focused test file; it must fail against the current
dependency-based cleanup and pass only after step 2.

### Step 2: Make result collections own URLs until removal or unmount

Track the latest PDF compression and image results in refs. Use an empty-
dependency unmount effect for blanket cleanup. Revoke an individual URL only
when that result is actually removed or replaced. Keep reset explicit and make
duplicate revocation harmless but avoid it where ownership is clear.

**Verify**: focused URL tests pass.

### Step 3: Close the native metadata failure path

Give the temporary metadata element a cleanup function that clears handlers,
detaches its source if appropriate, and revokes `fileUrl` on metadata failure.
Ensure the URL remains valid for the later recording promise on success and is
still revoked by its existing idempotent cleanup.

**Verify**: add a test that fires the metadata error callback and observes one
revocation and a rejected promise.

### Step 4: Run the repository gate

**Verify**: lint, all tests, and build all exit 0.

## Done criteria

- [ ] Retrying one item leaves all retained successful result URLs valid.
- [ ] Removing, resetting, or unmounting revokes URLs that leave ownership.
- [ ] Metadata failure revokes the native compressor input URL exactly once.
- [ ] Lint, full tests, and build pass.
- [ ] No out-of-scope files changed.

## STOP conditions

- The live cleanup or retry logic no longer matches the current-state summary.
- Correct ownership requires changing a public result type or conversion API.
- A focused regression test cannot observe ownership without rewriting a whole
  editor component; stop and propose a smaller pure ownership helper instead.

## Maintenance notes

Every object URL needs one explicit owner. Review future retry/remove paths for
the difference between replacing the array identity and removing an owned URL.

