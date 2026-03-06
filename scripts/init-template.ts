import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createProjectSetupContext, exists, runProjectSetup } from "./project-setup";

const execFileAsync = promisify(execFile);
const defaultTemplateRepoSlug = "ngwnos/vite-three-template";
const defaultTemplateDirName = "vite-three-template";

function normalizeGithubRepo(value: string) {
  return value
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/^(?:ssh|https?|git):\/\/(?:git@)?github\.com\//i, "");
}

async function runCommand(command: string, args: string[], cwd: string) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      maxBuffer: 1024 * 1024,
    });

    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run ${command} ${args.join(" ")}: ${message}`);
  }
}

async function verifyBootstrapPreconditions(repoRoot: string) {
  await runCommand("git", ["--version"], repoRoot);

  const gitPath = join(repoRoot, ".git");
  if (!(await exists(gitPath))) {
    throw new Error(`Missing .git at ${gitPath}. Run this in a cloned repo, not an already detached copy.`);
  }

  const { stdout: topLevel } = await runCommand("git", ["rev-parse", "--show-toplevel"], repoRoot);
  if (topLevel !== repoRoot) {
    throw new Error(`Run bun run init-template from the repo root: expected ${topLevel}, got ${repoRoot}.`);
  }

  const expectedTemplateDir = process.env.TEMPLATE_DIR_NAME ?? defaultTemplateDirName;
  const localDirName = basename(repoRoot);
  if (localDirName === expectedTemplateDir) {
    throw new Error(
      `Refusing to run init-template in ${repoRoot}. Rename the folder before running it.`,
    );
  }

  const remoteName = process.env.TEMPLATE_REMOTE_NAME ?? "origin";
  const expectedTemplateRepo = normalizeGithubRepo(
    process.env.TEMPLATE_REPO_SLUG ?? defaultTemplateRepoSlug,
  );
  let remoteUrl = "";

  try {
    ({ stdout: remoteUrl } = await runCommand("git", ["remote", "get-url", remoteName], repoRoot));
  } catch {
    throw new Error(
      `Refusing to run init-template without a ${remoteName} remote pointing at ${expectedTemplateRepo}.`,
    );
  }

  const actualTemplateRepo = normalizeGithubRepo(remoteUrl);
  if (actualTemplateRepo !== expectedTemplateRepo) {
    throw new Error(
      `Refusing to run init-template because ${remoteName} points to ${remoteUrl}, not ${expectedTemplateRepo}.`,
    );
  }

  await runCommand("git", ["var", "GIT_AUTHOR_IDENT"], repoRoot);
}

async function initializeFreshGitRepo(repoRoot: string) {
  const gitPath = join(repoRoot, ".git");
  await rm(gitPath, { recursive: true, force: true });
  console.log("Removed existing git history.");

  await runCommand("git", ["init"], repoRoot);
  await runCommand("git", ["branch", "-M", "main"], repoRoot);
  await runCommand("git", ["add", "."], repoRoot);
  await runCommand("git", ["commit", "-m", "Initial commit"], repoRoot);

  console.log("Created a fresh local git repo on main with an Initial commit.");
}

try {
  const context = createProjectSetupContext();

  await verifyBootstrapPreconditions(context.repoRoot);
  await runProjectSetup(context);
  await initializeFreshGitRepo(context.repoRoot);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
