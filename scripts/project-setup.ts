import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

type TmuxpWindow = {
  name?: string;
  [key: string]: unknown;
};

type TmuxpConfig = {
  session?: string;
  root?: string;
  windows?: TmuxpWindow[];
  [key: string]: unknown;
};

export type ProjectSetupContext = {
  repoRoot: string;
  repoName: string;
  packageJsonPath: string;
  tmuxpPath: string;
  indexHtmlPath: string;
  publicDirPath: string;
  faviconPath: string;
  faviconPngPath: string;
};

export function createProjectSetupContext(repoRoot = process.cwd()): ProjectSetupContext {
  const repoName = basename(repoRoot);

  return {
    repoRoot,
    repoName,
    packageJsonPath: join(repoRoot, "package.json"),
    tmuxpPath: join(repoRoot, ".tmuxp"),
    indexHtmlPath: join(repoRoot, "index.html"),
    publicDirPath: join(repoRoot, "public"),
    faviconPath: join(repoRoot, "public", "favicon.svg"),
    faviconPngPath: join(repoRoot, "public", "favicon-128.png"),
  };
}

function buildDefaultTmuxpConfig(context: ProjectSetupContext): TmuxpConfig {
  return {
    session: context.repoName,
    root: ".",
    windows: [
      {
        name: context.repoName,
        layout: "vertical",
        panes: [
          {
            name: "start",
            percent: 10,
            command: "bun run dev",
            cwd: ".",
          },
          {
            name: "work",
            percent: 90,
            cwd: ".",
          },
        ],
      },
    ],
  };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function hashNumber(seed: string, start: number, length: number) {
  const digest = createHash("sha256").update(seed).digest("hex");
  return Number.parseInt(digest.slice(start, start + length), 16);
}

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function normalizePackageName(repoName: string) {
  const normalized = repoName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (!normalized) {
    throw new Error(`Unable to derive a valid package name from ${repoName}.`);
  }

  return normalized;
}

function createRng(seed: string) {
  let state = hashNumber(seed, 0, 8) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function choose<T>(rng: () => number, values: readonly T[]) {
  return values[Math.floor(rng() * values.length)] ?? values[0];
}

function buildFaviconSvg(repoName: string) {
  const rng = createRng(repoName);
  const baseHue = hashNumber(`${repoName}:base`, 0, 8) % 360;
  const accentHue = (baseHue + 110 + (hashNumber(`${repoName}:accent`, 0, 4) % 80)) % 360;

  const background = hsl(baseHue, 34, 7);
  const panelBase = hsl((baseHue + 10) % 360, 42, 14);
  const primary = hsl(baseHue, 82, 58);
  const secondary = hsl(accentHue, 90, 68);
  const accent = hsl((accentHue + 42) % 360, 94, 78);
  const colors = [primary, secondary, accent, panelBase] as const;
  const label = escapeXml(repoName);
  const origin = 2;
  const cellSize = 15;

  const panels = Array.from({ length: 16 }, (_, index) => {
    const row = Math.floor(index / 4);
    const column = index % 4;
    const x = origin + column * cellSize;
    const y = origin + row * cellSize;
    const fill = choose(rng, colors);
    const mode = Math.floor(rng() * 4);

    if (mode === 0) {
      return `<rect x="${x + 1}" y="${y + 1}" width="${cellSize - 2}" height="${cellSize - 2}" rx="3.5" fill="${fill}" />`;
    }

    if (mode === 1) {
      return `<path d="M${x + 1} ${y + 1}H${x + cellSize - 1}L${x + 1} ${y + cellSize - 1}Z" fill="${fill}" />`;
    }

    if (mode === 2) {
      return `<path d="M${x + cellSize - 1} ${y + 1}V${y + cellSize - 1}L${x + 1} ${y + cellSize - 1}Z" fill="${fill}" />`;
    }

    return `<rect x="${x + 3}" y="${y + 3}" width="${cellSize - 6}" height="${cellSize - 6}" rx="2.5" fill="${fill}" />`;
  }).join("\n    ");

  const diagonals = Array.from({ length: 2 + (hashNumber(`${repoName}:diagonals`, 0, 2) % 2) }, (_, index) => {
    const offset = 10 + index * 16 + (hashNumber(`${repoName}:diag:${index}`, 0, 2) % 5);
    const stroke = index % 2 === 0 ? accent : secondary;
    return `<path d="M${offset} 64L64 ${offset}" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" opacity="0.85" />`;
  }).join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">${label}</title>
  <desc id="desc">Seeded split-panel favicon generated from the repository name.</desc>
  <rect width="64" height="64" fill="${background}" />
  ${panels}
  ${diagonals}
</svg>
`;
}

async function buildFaviconPng(svg: string) {
  const { Resvg } = await import("@resvg/resvg-js");
  const image = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 128,
    },
  }).render();

  return image.asPng();
}

export async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureTmuxpConfig(context: ProjectSetupContext) {
  if (!(await exists(context.tmuxpPath))) {
    const config = buildDefaultTmuxpConfig(context);
    await writeFile(context.tmuxpPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Created .tmuxp for ${context.repoName}.`);
    return;
  }

  const rawConfig = await readFile(context.tmuxpPath, "utf8");
  let config: TmuxpConfig;

  try {
    config = JSON.parse(rawConfig) as TmuxpConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse ${context.tmuxpPath}: ${message}`);
  }

  let changed = false;

  if (config.session !== context.repoName) {
    config.session = context.repoName;
    changed = true;
  }

  if (config.root !== ".") {
    config.root = ".";
    changed = true;
  }

  const firstWindow = config.windows?.[0];
  if (firstWindow && firstWindow.name !== context.repoName) {
    firstWindow.name = context.repoName;
    changed = true;
  }

  const panes = Array.isArray(firstWindow?.panes) ? (firstWindow?.panes as Array<Record<string, unknown>>) : null;
  const secondPane = panes?.[1];

  if (!panes) {
    config.windows = buildDefaultTmuxpConfig(context).windows;
    changed = true;
  } else if (!secondPane) {
    panes[1] = {
      name: "work",
      percent: 90,
      cwd: ".",
    };
    changed = true;
  } else {
    if (secondPane.name !== "work") {
      secondPane.name = "work";
      changed = true;
    }

    if (secondPane.cwd !== ".") {
      secondPane.cwd = ".";
      changed = true;
    }

    if ("command" in secondPane) {
      delete secondPane.command;
      changed = true;
    }
  }

  if (!changed) {
    console.log(`.tmuxp already matches ${context.repoName}.`);
    return;
  }

  await writeFile(context.tmuxpPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Updated .tmuxp for ${context.repoName}.`);
}

export async function ensureHtmlTitle(context: ProjectSetupContext) {
  if (!(await exists(context.indexHtmlPath))) {
    throw new Error(`Missing HTML entry at ${context.indexHtmlPath}`);
  }

  const rawHtml = await readFile(context.indexHtmlPath, "utf8");
  const titlePattern = /<title>[\s\S]*?<\/title>/i;
  const faviconLink = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';

  if (!titlePattern.test(rawHtml)) {
    throw new Error(`Missing <title> tag in ${context.indexHtmlPath}`);
  }

  const withTitle = rawHtml.replace(titlePattern, `<title>${context.repoName}</title>`);
  let nextHtml = withTitle;

  if (/<link\s+rel=["']icon["'][^>]*href=["']\/favicon\.svg["'][^>]*>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(
      /<link\s+rel=["']icon["'][^>]*href=["']\/favicon\.svg["'][^>]*>/i,
      faviconLink,
    );
  } else if (/<\/head>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<\/head>/i, `    ${faviconLink}\n  </head>`);
  } else {
    throw new Error(`Missing </head> tag in ${context.indexHtmlPath}`);
  }

  if (nextHtml === rawHtml) {
    console.log(`index.html metadata already matches ${context.repoName}.`);
    return;
  }

  await writeFile(context.indexHtmlPath, nextHtml);
  console.log(`Updated index.html metadata for ${context.repoName}.`);
}

export async function ensurePackageName(context: ProjectSetupContext) {
  if (!(await exists(context.packageJsonPath))) {
    throw new Error(`Missing package.json at ${context.packageJsonPath}`);
  }

  const rawPackageJson = await readFile(context.packageJsonPath, "utf8");
  let packageJson: {
    name?: unknown;
    [key: string]: unknown;
  };

  try {
    packageJson = JSON.parse(rawPackageJson) as typeof packageJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse ${context.packageJsonPath}: ${message}`);
  }

  const nextName = normalizePackageName(context.repoName);
  if (packageJson.name === nextName) {
    console.log(`package.json name already matches ${nextName}.`);
    return;
  }

  packageJson.name = nextName;
  await writeFile(context.packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log(`Updated package.json name to ${nextName}.`);
}

export async function ensureFavicon(context: ProjectSetupContext) {
  await mkdir(context.publicDirPath, { recursive: true });

  const svg = buildFaviconSvg(context.repoName);
  const png = await buildFaviconPng(svg);
  const current = (await exists(context.faviconPath)) ? await readFile(context.faviconPath, "utf8") : null;
  const currentPng = (await exists(context.faviconPngPath)) ? await readFile(context.faviconPngPath) : null;

  if (current === svg && currentPng?.equals(png)) {
    console.log(`favicon assets already match ${context.repoName}.`);
    return;
  }

  await writeFile(context.faviconPath, svg);
  await writeFile(context.faviconPngPath, png);
  console.log(`Updated favicon assets for ${context.repoName}.`);
}

export async function runProjectSetup(context = createProjectSetupContext()) {
  await ensureTmuxpConfig(context);
  await ensurePackageName(context);
  await ensureHtmlTitle(context);
  await ensureFavicon(context);
}
