# Production readiness

Run `npm.cmd ci` followed by `npm.cmd run check:production` for the release candidate. A passing result covers lint, tests, TypeScript, the production bundle, SEO route parity, FFmpeg diagnostics, and known production dependency advisories.

Before deployment, manually verify representative video, audio, image, PDF, and Office exports in a supported browser, including opening each downloaded result. Verify Vercel response headers and clean URLs on the deployed commit. Physical mobile file pickers, memory pressure, backgrounding, share sheets, and install behavior require real-device checks; responsive desktop emulation is not equivalent.

Current architectural risks are the large PDF/image orchestration components, global responsive CSS override density, and browser checks that are not yet a portable end-to-end CI suite. These are tracked debt, not evidence that generated files are corrupt. Conversion surfaces must expose only engine-backed pairs; PDF-to-Word is intentionally unsupported until a fidelity-capable backend exists.
