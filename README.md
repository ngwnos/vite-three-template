# Three.js WebGPU + TSL Starter

Minimal Vite + TypeScript scene with:

- `WebGPURenderer`
- TSL node material
- one cube
- `PerspectiveCamera`
- `OrbitControls`
- no animation loop (render on control changes and resize only)

## Commands

```bash
bun run setup
bun run dev
bun run build
```

`bun run setup` updates `.tmuxp`, the page title, and `public/favicon.svg` to match the current folder name. If `~/.tmuxp-projects` already exists, it also adds the repo for [`tmux-launch`](https://github.com/ngwnos/tmux-launch). Otherwise it leaves that alone.

## Requirement

Use a browser with WebGPU support enabled.
