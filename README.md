# Three.js WebGPU + TSL Starter

Minimal Vite + TypeScript scene with:

- `WebGPURenderer`
- `MeshStandardNodeMaterial`
- one cube
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

`bun run init-template` is the one-shot bootstrap for a local copy of the template. It only runs if `origin` still points at `ngwnos/vite-three-template` and the local folder is no longer named `vite-three-template`, then it runs `setup`, removes the inherited git history, and creates a fresh local `main` repo with one `Initial commit` and no remote.

`bun run setup` updates `.tmuxp`, the page title, and `public/favicon.svg` to match the current folder name. If `~/.tmuxp-projects` already exists, it also adds the repo for [`tmux-launch`](https://github.com/ngwnos/tmux-launch). Otherwise it leaves that alone.

`bun run test:e2e:webgpu` launches Chromium with WebGPU flags, opens the app, and fails on page errors, console errors, or WebGPU/WGSL warnings. It prefers `/snap/bin/chromium` if present. Otherwise set `PLAYWRIGHT_CHROMIUM_PATH` or install Playwright's Chromium browser.

## Requirement

Use a browser with WebGPU support enabled.
