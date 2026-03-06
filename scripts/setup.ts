import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";

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

const repoRoot = process.cwd();
const repoName = basename(repoRoot);
const tmuxpPath = join(repoRoot, ".tmuxp");
const indexHtmlPath = join(repoRoot, "index.html");
const publicDirPath = join(repoRoot, "public");
const faviconPath = join(publicDirPath, "favicon.svg");
const registryPath = process.env.TMUXP_PROJECTS_PATH ?? join(homedir(), ".tmuxp-projects");

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

function buildFaviconSvg() {
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

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureTmuxpConfig() {
  if (!(await exists(tmuxpPath))) {
    throw new Error(`Missing tmuxp config at ${tmuxpPath}`);
  }

  const rawConfig = await readFile(tmuxpPath, "utf8");
  let config: TmuxpConfig;

  try {
    config = JSON.parse(rawConfig) as TmuxpConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse ${tmuxpPath}: ${message}`);
  }

  let changed = false;

  if (config.session !== repoName) {
    config.session = repoName;
    changed = true;
  }

  if (config.root !== repoRoot) {
    config.root = repoRoot;
    changed = true;
  }

  const firstWindow = config.windows?.[0];
  if (firstWindow && firstWindow.name !== repoName) {
    firstWindow.name = repoName;
    changed = true;
  }

  if (!changed) {
    console.log(`.tmuxp already matches ${repoName}.`);
    return;
  }

  await writeFile(tmuxpPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Updated .tmuxp for ${repoName}.`);
}

async function ensureHtmlTitle() {
  if (!(await exists(indexHtmlPath))) {
    throw new Error(`Missing HTML entry at ${indexHtmlPath}`);
  }

  const rawHtml = await readFile(indexHtmlPath, "utf8");
  const titlePattern = /<title>[\s\S]*?<\/title>/i;
  const faviconLink = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';

  if (!titlePattern.test(rawHtml)) {
    throw new Error(`Missing <title> tag in ${indexHtmlPath}`);
  }

  const withTitle = rawHtml.replace(titlePattern, `<title>${repoName}</title>`);
  let nextHtml = withTitle;

  if (/<link\s+rel=["']icon["'][^>]*href=["']\/favicon\.svg["'][^>]*>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(
      /<link\s+rel=["']icon["'][^>]*href=["']\/favicon\.svg["'][^>]*>/i,
      faviconLink,
    );
  } else if (/<\/head>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<\/head>/i, `    ${faviconLink}\n  </head>`);
  } else {
    throw new Error(`Missing </head> tag in ${indexHtmlPath}`);
  }

  if (nextHtml === rawHtml) {
    console.log(`index.html metadata already matches ${repoName}.`);
    return;
  }

  await writeFile(indexHtmlPath, nextHtml);
  console.log(`Updated index.html metadata for ${repoName}.`);
}

async function ensureFavicon() {
  await mkdir(publicDirPath, { recursive: true });

  const svg = buildFaviconSvg();
  const current = (await exists(faviconPath)) ? await readFile(faviconPath, "utf8") : null;

  if (current === svg) {
    console.log(`favicon already matches ${repoName}.`);
    return;
  }

  await writeFile(faviconPath, svg);
  console.log(`Updated favicon for ${repoName}.`);
}

async function ensureRegistryEntry() {
  if (!(await exists(registryPath))) {
    console.log(`Skipped tmux-launch registry: ${registryPath} does not exist.`);
    return;
  }

  const entry = tmuxpPath;
  const rawRegistry = await readFile(registryPath, "utf8");
  const lines = rawRegistry.split(/\r?\n/);

  if (lines.includes(entry)) {
    console.log(`Registry already contains ${entry}.`);
    return;
  }

  const prefix = rawRegistry.length === 0 || rawRegistry.endsWith("\n") ? rawRegistry : `${rawRegistry}\n`;
  await writeFile(registryPath, `${prefix}${entry}\n`);
  console.log(`Added ${entry} to ${registryPath}.`);
}

try {
  await ensureTmuxpConfig();
  await ensureHtmlTitle();
  await ensureFavicon();
  await ensureRegistryEntry();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
