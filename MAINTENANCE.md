# Simple Dependency Maintenance

Compactor's dependency versions are recorded in `package-lock.json`, so a new
library release does not automatically change the live app. Use these steps
when GitHub reports a dependency problem, or whenever you want to check it.

## Quick check (does not update anything)

Open PowerShell in the Compactor folder and paste:

```powershell
npm.cmd ci
npm.cmd outdated
npm.cmd audit
npm.cmd test
npm.cmd run build
```

`npm.cmd outdated` may return a non-zero status when updates exist. That alone
does not mean Compactor is broken.

## Safe routine update

This installs compatible updates allowed by `package.json`, then verifies them:

```powershell
git pull
npm.cmd update
npm.cmd test
npm.cmd run build
git diff -- package.json package-lock.json
```

If the tests and build pass, commit `package-lock.json` with the update. Test a
few real PDF, OCR, image, audio, and video files before deploying.

## When GitHub reports a security issue

First try the normal, non-forced fix:

```powershell
npm.cmd audit
npm.cmd audit fix
npm.cmd test
npm.cmd run build
```

Do **not** use `npm audit fix --force` as a quick fix. It can install breaking
major versions. If the normal fix cannot resolve the alert, update the named
package separately and test the affected tool.

## Where notifications appear

- **Dependabot pull requests:** weekly proposed dependency updates. Nothing is
  merged automatically.
- **Actions > Dependency health:** weekly and manual checks. A failed run shows
  which audit, test, or build step failed. GitHub can email you about failures
  according to your notification settings.
- **Security > Dependabot alerts:** known vulnerabilities. If this page is not
  active, enable Dependabot alerts in the repository's **Settings > Security**.

You can also run the check at any time from **Actions > Dependency health > Run
workflow**.
