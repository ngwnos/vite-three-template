import { access, readFile, writeFile } from "node:fs/promises";
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
const registryPath = process.env.TMUXP_PROJECTS_PATH ?? join(homedir(), ".tmuxp-projects");

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
  await ensureRegistryEntry();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
