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
            name: "codex",
            percent: 90,
            command: "codex resume",
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

function buildFaviconSvg(repoName: string) {
  const baseHue = hashNumber(`${repoName}:base`, 0, 8) % 360;
  const accentHue = (baseHue + 110 + (hashNumber(`${repoName}:accent`, 0, 4) % 80)) % 360;
  const rotation = hashNumber(`${repoName}:rotate`, 0, 4) % 360;
  const pattern = hashNumber(`${repoName}:pattern`, 0, 2) % 4;

  const bgOuter = hsl(baseHue, 58, 8);
  const bgInner = hsl((baseHue + 18) % 360, 62, 14);
  const primary = hsl(baseHue, 82, 58);
  const secondary = hsl(accentHue, 90, 68);
  const shadow = hsl((baseHue + 220) % 360, 45, 6);
  const label = escapeXml(repoName);

  const shapes = [
    `
      <rect x="8" y="8" width="48" height="48" rx="14" fill="${primary}" opacity="0.94" />
      <path d="M16 42L42 16H52L26 42H16Z" fill="${secondary}" />
      <circle cx="46" cy="46" r="8" fill="${shadow}" opacity="0.35" />
    `,
    `
      <circle cx="32" cy="32" r="19" fill="${primary}" />
      <path d="M32 10C44 10 54 20 54 32H46C46 24.3 39.7 18 32 18V10Z" fill="${secondary}" />
      <rect x="13" y="36" width="38" height="8" rx="4" fill="${secondary}" opacity="0.9" />
    `,
    `
      <path d="M32 10L54 32L32 54L10 32L32 10Z" fill="${primary}" />
      <path d="M32 18L46 32L32 46L18 32L32 18Z" fill="${bgOuter}" />
      <path d="M32 14L50 32L44 38L26 20L32 14Z" fill="${secondary}" />
    `,
    `
      <rect x="10" y="10" width="20" height="20" rx="6" fill="${primary}" />
      <rect x="34" y="10" width="20" height="20" rx="6" fill="${secondary}" />
      <rect x="10" y="34" width="20" height="20" rx="6" fill="${secondary}" opacity="0.92" />
      <rect x="34" y="34" width="20" height="20" rx="6" fill="${primary}" opacity="0.88" />
    `,
  ][pattern];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">${label}</title>
  <desc id="desc">Hash-based favicon generated from the repository name.</desc>
  <defs>
    <linearGradient id="bg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${bgInner}" />
      <stop offset="100%" stop-color="${bgOuter}" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="18" fill="url(#bg)" />
  <g transform="rotate(${rotation} 32 32)">
    ${shapes.trim()}
  </g>
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
