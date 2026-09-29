# Production readiness

Run `npm.cmd ci` followed by `npm.cmd run check:production` for the primary local release gate. This unified command validates linting (`oxlint`), unit/workflow tests (`vitest`), TypeScript typechecking, production build bundling, SEO prerender/sitemap parity, FFmpeg compressor diagnostics, and production dependency advisories.

Run the automated browser test suites:
- `npm run test:browser:smoke`: 9-point fast core workflow test (homepage, fuzzy search, dashboard card navigation, clean URLs, tablet layout, converter scroll container, image readiness, PDF export, and fake PDF-to-Word rejection).
- `npm run test:browser:responsive`: Multi-viewport responsive suite across Chromium and WebKit (320px, 360px, 390px, 430px, 768px, 820px, 1024px).
- `npm run test:browser:exports`: Independent parser verification of real exported PDF (page counts, AES encryption) and image containers.

Before deployment, manually verify representative video, audio, image, PDF, and Office exports in a supported browser. Verify Vercel response headers and clean URLs on the deployed commit. Physical mobile file pickers, memory pressure, backgrounding, share sheets, and install behavior require real-device checks; responsive desktop emulation is not equivalent.

Conversion surfaces must expose only engine-backed pairs; PDF-to-Word is intentionally unsupported until a fidelity-capable LibreOffice/server backend exists.
