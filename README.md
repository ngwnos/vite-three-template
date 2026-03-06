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

`bun run setup` updates the checked-in `.tmuxp` file to the current repo name/path and adds it to `~/.tmuxp-projects` when that registry file already exists.
It is meant for [`tmux-launch`](https://github.com/ngwnos/tmux-launch).

## Requirement

Use a browser with WebGPU support enabled.
