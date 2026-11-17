import lockfile from "proper-lockfile";
import { open } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = resolve(frontendDir, "node_modules/@playwright/test/cli.js");
const repoDir = resolve(frontendDir, "..");
const projectName = "split-bill-e2e";
const lockPath = resolve(tmpdir(), "split-bill-playwright-e2e");
const composeArgs = [
  "compose",
  "--project-name",
  projectName,
  "--project-directory",
  repoDir,
  "-f",
  resolve(repoDir, "compose.yaml"),
];
const runId = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}`;
const env = {
  ...process.env,
  API_PORT: "8001",
  FRONTEND_PORT: "3001",
  CORS_ORIGINS: "http://127.0.0.1:3001",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:8001",
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3001",
  PLAYWRIGHT_HTML_OPEN: "never",
  PLAYWRIGHT_OUTPUT_DIR: resolve(frontendDir, "test-results", runId),
};
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };
let activeChild;
let receivedSignal;
let cleaningUp = false;

function handleSignal(signal) {
  receivedSignal ??= signal;
  if (!cleaningUp) activeChild?.kill(signal);
}

function run(command, args, cwd, allowAfterInterrupt = false) {
  if (receivedSignal && !allowAfterInterrupt) {
    return Promise.resolve(signalExitCodes[receivedSignal] ?? 1);
  }
  return new Promise((resolveCode, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    activeChild = child;
    child.once("error", (error) => {
      if (activeChild === child) activeChild = undefined;
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (activeChild === child) activeChild = undefined;
      resolveCode(code ?? signalExitCodes[signal] ?? 1);
    });
  });
}

async function requireSuccess(command, args, cwd, allowAfterInterrupt = false) {
  const code = await run(command, args, cwd, allowAfterInterrupt);
  if (code !== 0) throw new Error(`${command} exited with status ${code}`);
}

const cleanupArgs = [...composeArgs, "down", "--volumes", "--remove-orphans"];
let releaseLock;
let exitCode = 1;
try {
  const lockTarget = await open(lockPath, "a");
  await lockTarget.close();
  releaseLock = await lockfile.lock(lockPath, {
    retries: 0,
    stale: 5_000,
    update: 2_000,
  });
  const handleSigint = () => handleSignal("SIGINT");
  const handleSigterm = () => handleSignal("SIGTERM");
  process.on("SIGINT", handleSigint);
  process.on("SIGTERM", handleSigterm);

  try {
    await requireSuccess("docker", cleanupArgs, repoDir);
    await requireSuccess(process.execPath, [playwrightCli, "install", "chromium"], frontendDir);
    await requireSuccess("docker", [...composeArgs, "up", "--build", "--detach", "--wait", "--wait-timeout", "600"], repoDir);
    exitCode = await run(process.execPath, [playwrightCli, "test"], frontendDir);
  } catch (error) {
    console.error(error);
    exitCode = error.exitCode ?? 1;
  } finally {
    cleaningUp = true;
    try {
      await requireSuccess("docker", cleanupArgs, repoDir, true);
    } catch (error) {
      console.error(`E2E Compose cleanup failed: ${error}`);
      if (exitCode === 0) exitCode = error.exitCode ?? 1;
    }
    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
  }
} catch (error) {
  if (error.code === "ELOCKED") {
    console.error("Another Playwright E2E runner is active; refusing to use ports 3001 and 8001.");
  } else {
    console.error(error);
  }
  exitCode = 1;
} finally {
  if (releaseLock) {
    try {
      await releaseLock();
    } catch (error) {
      console.error(`E2E lock release failed: ${error}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
}

process.exitCode = receivedSignal ? signalExitCodes[receivedSignal] : exitCode;
