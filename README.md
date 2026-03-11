# Three.js WebGPU + TSL Starter

Minimal Vite + TypeScript scene with:

- `WebGPURenderer`
- one textured cube
- `PerspectiveCamera`
- `OrbitControls`
- simple requestAnimationFrame render loop

## Commands

```bash
bun install
bun run dev
bun run build
bun run test:e2e:webgpu
bun run test:e2e:webgpu:orca
```

Idea Orca materializes new repos from this template by exporting the tracked scaffold files and then applying Orca-owned project bootstrap. That bootstrap sets the repo-specific package name, page title, and seeded favicon assets. The template repo itself stays a plain scaffold and does not contain copy/clone bootstrap commands.

`bun run test:e2e:webgpu` launches Chromium with WebGPU flags, starts `bun run dev`, opens the app, and fails on page errors, console errors, or WebGPU/WGSL warnings. It prefers `/snap/bin/chromium` if present. Otherwise set `PLAYWRIGHT_CHROMIUM_PATH` or install Playwright's Chromium browser.

`bun run test:e2e:webgpu:orca` is the Orca validation path. It requires `ORCA_PREVIEW_URL` and runs the same Playwright smoke test against the already-running Orca candidate preview instead of starting a second local dev server.

## Requirement

Use a browser with WebGPU support enabled.
