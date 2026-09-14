# Plan 005: Make the processed-file metric honest

> **Drift check (run first)**:
> `git diff --stat 1749226..HEAD -- api/processed-count.js src/utils/counterStorage.ts src/test/apiProcessedCount.test.ts src/pages/Dashboard.tsx README.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-enforce-strict-quality-gate.md`
- **Category**: security
- **Planned at**: commit `1749226`, 2026-09-14

## Why this matters

The public counter accepts arbitrary browser-generated event IDs. Rate limiting
and replay prevention reduce casual duplication but do not prove that work was
completed, so distributed callers can inflate a number users may interpret as
trusted usage. Because processing is deliberately private and client-side, the
server cannot honestly verify completion without adding surveillance or a
bounded grant protocol.

## Current state

- `src/utils/counterStorage.ts:57-60` creates completion IDs in the browser.
- `api/processed-count.js:103-108` validates only the ID shape and batch size.
- `api/processed-count.js:110-124` rate-limits by apparent IP, deduplicates each
  caller-chosen ID, then increments the persistent global count.
- `src/test/apiProcessedCount.test.ts` already covers method, CORS, rate, and
  Redis behavior and is the required test style.
- The privacy architecture in `README.md` promises that files never leave the
  device; preserve that boundary.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| API tests | `npm.cmd test -- --run src/test/apiProcessedCount.test.ts` | all pass |
| Gate | `npm.cmd run quality` | exit 0 |

## Scope

**In scope**:
- `api/processed-count.js`
- `src/utils/counterStorage.ts`
- `src/test/apiProcessedCount.test.ts`
- dashboard/README copy that describes this metric

**Out of scope**:
- Uploading file names, sizes, contents, hashes, or conversion details.
- User accounts, fingerprinting, CAPTCHAs, analytics replacement, or a database
  migration unrelated to this counter.

## Steps

### Step 1: Decide and document the honest contract

Default to the privacy-preserving option: call this an anonymous, best-effort
activity estimate and ensure UI/accessibility copy does not imply verified
users or conversions. Record that client-side completion cannot be proven by
the server. If the maintainer requires a verified metric, STOP and obtain an
explicit product decision before designing grants.

**Verify**: tests or copy assertions use the selected contract consistently.

### Step 2: Minimize abuse within that contract

Keep strict schema, batch cap, replay TTL, and IP rate limiting. Reject a body
containing invalid entries rather than silently filtering them into a smaller
accepted set. Bound stored pending events client-side. Keep Redis updates
failure-closed and avoid recording sensitive request data.

**Verify**: tests cover malformed arrays, mixed valid/invalid entries, replay,
batch maximum, rate maximum, and Redis failure.

### Step 3: Separate local truth from public estimate

Preserve the device-local count as the trustworthy value for the current
browser. Treat the remote response only as an optional public estimate, with a
graceful local fallback. Do not block processing or success UI on the API.

**Verify**: counter tests cover offline/API failure and never reject a completed
local operation.

### Step 4: Run the gate

**Verify**: API tests and the full quality gate pass.

## Done criteria

- [ ] UI and docs do not overclaim the public counter's trust level.
- [ ] No file-derived or identifying processing data crosses the network.
- [ ] Malformed, replayed, oversized, excessive, and failed requests are tested.
- [ ] Processing completion does not depend on counter availability.
- [ ] Full quality gate passes.

## STOP conditions

- Product requirements demand a cryptographically verified completion count;
  that is a different design decision with privacy and infrastructure costs.
- A proposed fix transmits file-derived data or introduces user tracking.
- Redis semantics in production differ from the tested atomic operations.

## Maintenance notes

Rate limiting makes abuse more expensive; it does not make an untrusted client
event true. Future copy and analytics decisions must preserve that distinction.

