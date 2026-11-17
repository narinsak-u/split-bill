import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = resolve(frontendDir, "node_modules/@playwright/test/cli.js");
const repoDir = resolve(frontendDir, "..");
const projectName = `splitbill-playwright-e2e-${randomUUID().replaceAll("-", "")}`;
const composeArgs = [
  "compose",
  "--project-name",
  projectName,
  "--project-directory",
  repoDir,
  "-f",
  resolve(repoDir, "compose.yaml"),
];
const env = {
  ...process.env,
  API_PORT: "8001",
  FRONTEND_PORT: "3001",
  CORS_ORIGINS: "http://127.0.0.1:3001",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:8001",
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3001",
  PLAYWRIGHT_HTML_OPEN: "never",
};

function run(command, args, cwd) {
  return new Promise((resolveCode, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => resolveCode(code ?? (signal ? 128 : 1)));
  });
}

async function requireSuccess(command, args, cwd) {
  const code = await run(command, args, cwd);
  if (code !== 0) throw new Error(`${command} exited with status ${code}`);
}

let exitCode = 1;
try {
  await requireSuccess(process.execPath, [playwrightCli, "install", "chromium"], frontendDir);
  await requireSuccess("docker", [...composeArgs, "up", "--build", "--detach", "--wait", "--wait-timeout", "600"], repoDir);
  exitCode = await run(process.execPath, [playwrightCli, "test"], frontendDir);
} catch (error) {
  console.error(error);
} finally {
  const cleanupCode = await run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], repoDir);
  if (cleanupCode !== 0) {
    console.error(`E2E Compose cleanup exited with status ${cleanupCode}`);
    if (exitCode === 0) exitCode = cleanupCode;
  }
}

process.exitCode = exitCode;
