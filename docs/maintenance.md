# Maintenance Guide

Use the locked Node.js and npm versions from CI when reproducing failures. On Windows, run the `.cmd` npm launcher if PowerShell blocks `npm.ps1`.

## Required quality gate

Before every pull request, run:

```powershell
npm.cmd ci
npm.cmd run quality
```

`quality` runs lint, the complete Vitest suite, strict TypeScript compilation, and the Vite production build. The pull-request and `main` workflows run the same command with Node.js 24.

For quick iteration, use the narrowest relevant command first, then finish with the complete gate:

```powershell
npm.cmd run lint
npm.cmd test -- --run src/test/example.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Passing automated checks confirms static analysis, test behavior, compilation, and bundling. It does not prove browser interaction, responsive layout, accessibility, conversion fidelity, or the contents of exported files. Check affected workflows manually in a supported browser and record that evidence separately.

## Dependency maintenance

The scheduled dependency-health workflow runs weekly and can also be started manually. It installs the lockfile, audits production dependencies at high severity, and runs the complete quality gate.

Before committing dependency changes:

```powershell
npm.cmd outdated
npm.cmd audit --omit=dev --audit-level=high
npm.cmd run quality
```

Commit `package.json` and `package-lock.json` together whenever dependency versions change. Do not suppress an audit or type error merely to make the gate green; document and review any accepted risk.

## Release check

Before release, confirm the quality workflow passed for the exact commit, then manually exercise changed upload, processing, preview, and download flows. Verify that user files remain in the browser and that deployment headers still support the required browser APIs.
