# Code quality assessment

Compactor is a credible, maintainable application with a strong automated baseline, but it is not “finished” architecture. Its strict TypeScript build, linting, unit/component tests, centralized route metadata, lazy conversion engines, explicit export validation, and browser-local privacy boundary are meaningful strengths.

The main debt is concentration: `PdfEditor.tsx`, `ImageTools.tsx`, `PdfTools.tsx`, `src/index.css`, and `src/styles/workbench.css` own too many responsibilities. They should be split only behind behavior tests and visual baselines; a rushed rewrite would create more risk than it removes. Browser scripts also remain supplementary local checks rather than a single portable end-to-end CI suite.

AI-generated code is not inherently less maintainable than human-written code. Both fail when changes are accepted without ownership, small interfaces, deletion, review, or feedback from real tests. AI increases output speed, so it can amplify either disciplined engineering or unchecked duplication. The practical standard is therefore evidence: understandable boundaries, explicit invariants, narrow diffs, reproducible gates, and a maintainer who can explain and safely change the result.

## Rules for future changes

- Reuse the existing processing engines; responsive interfaces should map to them rather than fork business logic.
- Reject unsupported conversions instead of producing plausible-looking but invalid files.
- Validate exported containers and required Office entries before offering a download.
- Add behavior coverage before splitting large orchestration components.
- Keep production claims separate from local automation, browser emulation, and real-device verification.
- Delete obsolete paths and documentation when a capability is intentionally removed.
