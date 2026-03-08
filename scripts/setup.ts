import { basename } from "node:path";
import { createProjectSetupContext, runProjectSetup } from "./project-setup";

const defaultTemplateDirName = "vite-three-template";

try {
  const context = createProjectSetupContext();
  const expectedTemplateDir = process.env.TEMPLATE_DIR_NAME ?? defaultTemplateDirName;

  if (
    process.env.ALLOW_TEMPLATE_SETUP !== "1" &&
    basename(context.repoRoot) === expectedTemplateDir
  ) {
    throw new Error(
      `Refusing to run setup in ${context.repoRoot} while the folder is still named ${expectedTemplateDir}. Rename the copied repo first, or set ALLOW_TEMPLATE_SETUP=1 if you intentionally want to update the template repo.`,
    );
  }

  await runProjectSetup(context);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
