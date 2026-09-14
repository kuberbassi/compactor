# Plan 002: Enforce one strict quality gate

> **Executor instructions**: Preserve the current dirty working tree and avoid
> repository-wide formatting or line-ending churn.
>
> **Drift check (run first)**:
> `git diff --stat 1749226..HEAD -- package.json package-lock.json tsconfig.app.json .github README.md CONTRIBUTING.md docs`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `1749226`, 2026-09-14

## Why this matters

Lint, tests, and build work locally but ordinary pull requests are not checked;
the only workflow is manual/weekly and omits lint. TypeScript strict checking
already passes in the inspected tree, so failing to enable it leaves free
compiler protection unused. Documentation also points to a missing maintenance
guide and embeds stale test/toolchain totals.

## Current state

- `package.json:6-13` exposes separate `build`, `test`, and `lint` commands.
- `.github/workflows/dependency-health.yml:3-6` runs only manually/weekly;
  steps run audit, test, and build but not lint.
- `tsconfig.app.json:2-20` has selected safety flags but no `strict: true`.
- `README.md:76,80` says TypeScript 5 and 62 tests/16 files; the current package
  uses TypeScript 6 and the verified suite has 165 tests in 45 files.
- `README.md:112` and `docs/README.md:7` link to missing
  `docs/maintenance.md`.
- Contributor commands in `CONTRIBUTING.md:11-17` are the convention to retain.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Strict trial | `node_modules\.bin\tsc.cmd -p tsconfig.app.json --strict --pretty false` | exit 0 |
| Quality | `npm.cmd run quality` | lint, 45+ test files, build; exit 0 |
| Audit | `npm.cmd audit --omit=dev --audit-level=high` | zero high vulnerabilities |

## Scope

**In scope**:
- `package.json`, `package-lock.json`
- `tsconfig.app.json`
- `.github/workflows/quality.yml` (new)
- `.github/workflows/dependency-health.yml`
- `.gitattributes`, `.editorconfig` (new, prospective only)
- `README.md`, `CONTRIBUTING.md`, `.github/pull_request_template.md`
- `docs/README.md`, `docs/maintenance.md` (new)

**Out of scope**:
- Source refactors or dependency upgrades.
- Reformatting existing source files.
- Adding coverage thresholds before coverage is measured.

## Steps

### Step 1: Make the local gate canonical

Add `typecheck` and `quality` scripts. `quality` must run lint, tests, and build
in that order using existing scripts; avoid duplicating their command bodies.
Enable `strict: true` in `tsconfig.app.json`.

**Verify**: `npm.cmd run quality` exits 0.

### Step 2: Enforce the gate on pull requests

Create `.github/workflows/quality.yml` triggered by `pull_request` and pushes to
`main`. Use checkout, Node 24 with npm cache, `npm ci`, then
`npm run quality`. Keep the scheduled production audit in the dependency
workflow and add lint there or call the canonical gate without duplicating the
audit.

**Verify**: inspect the YAML and confirm triggers, locked install, and quality
command are present; do not claim remote CI passed until it runs remotely.

### Step 3: Set a prospective text policy

Add minimal `.editorconfig` and `.gitattributes` rules for UTF-8, final newline,
and LF for repository text. Do not mechanically rewrite existing files.

**Verify**: `git diff --numstat` shows no mass line-ending-only rewrite.

### Step 4: Repair contributor documentation

Replace mutable test totals with the command contributors should run. Correct
the TypeScript version, create the referenced maintenance guide, and make the
README, contributing guide, PR template, and docs index point to
`npm.cmd run quality` while noting the cross-platform `npm run quality` form.

**Verify**: `rg -n "62 tests|16 test files|TypeScript 5" README.md docs` returns
no matches, and both maintenance links resolve.

## Done criteria

- [ ] Strict TypeScript compilation is enabled and passes.
- [ ] One local quality command runs lint, tests, and build.
- [ ] Pull requests and main pushes run the quality command.
- [ ] Dependency audit remains scheduled/manual.
- [ ] Maintenance links and version claims are current.
- [ ] No bulk formatting or source changes are included.

## STOP conditions

- Strict compilation fails in the live tree; report errors rather than adding
  casts or weakening individual flags.
- CI requires secrets or paid services.
- Git attributes cause a mass source rewrite.

## Maintenance notes

CI command knowledge should remain in `package.json`; workflows and docs should
call that command rather than copying its internal sequence.

