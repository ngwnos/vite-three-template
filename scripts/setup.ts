import { createProjectSetupContext, runProjectSetup } from "./project-setup";

try {
  await runProjectSetup(createProjectSetupContext());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
