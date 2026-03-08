# Three.js WebGPU + TSL Starter

Minimal Vite + TypeScript scene with:

- `WebGPURenderer`
- one textured cube
- `PerspectiveCamera`
- `OrbitControls`
- simple requestAnimationFrame render loop

## Commands

```bash
bun run init-template
bun run setup
bun run dev
bun run build
bun run test:e2e:webgpu
```

For a new project copied or cloned from this template, run `bun run init-template`. It installs dependencies with `bun install`, runs the full `setup` flow, then removes the inherited `.git` directory and leaves the project without a git repo. It only runs if `origin` still points at the expected template source and the local folder is no longer named `vite-three-template`.

`bun run setup` is just the rerunnable sync step for copied projects. It refuses to run while the folder is still named `vite-three-template` unless you set `ALLOW_TEMPLATE_SETUP=1`. After you rename or move a copied repo, use it to create or sync the local gitignored `.tmuxp`, `package.json.name`, the page title, `public/favicon.svg`, and `public/favicon-128.png` to the current folder name again. The cube uses `public/favicon-128.png` as its texture on every face.

`bun run test:e2e:webgpu` launches Chromium with WebGPU flags, opens the app, and fails on page errors, console errors, or WebGPU/WGSL warnings. It prefers `/snap/bin/chromium` if present. Otherwise set `PLAYWRIGHT_CHROMIUM_PATH` or install Playwright's Chromium browser.

## Requirement

Use a browser with WebGPU support enabled.
