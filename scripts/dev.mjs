import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Set();
let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

function start(script) {
  const child = spawn(npmCommand, ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.add(child);
  child.once("error", (error) => {
    console.error(`Impossible de lancer npm run ${script} : ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    if (code !== 0 || signal) {
      console.error(`npm run ${script} s'est arrêté (${signal ?? `code ${code}`} ).`);
    }
    stop(code ?? (signal ? 1 : 0));
  });
  return child;
}

async function apiIsReady() {
  try {
    const response = await fetch("http://localhost:8080/api/health", {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi(child) {
  const deadline = Date.now() + 15000;
  let lastFailure = "aucune réponse";
  while (!stopping && Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    try {
      const response = await fetch("http://localhost:8080/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return true;
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "erreur inconnue";
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!stopping) {
    console.error(`L'API locale ne répond pas sur le port 8080 : ${lastFailure}. Vérifie .env et les identifiants ADC Google Cloud.`);
    stop(1);
  }
  return false;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

if (!(await apiIsReady())) {
  const api = start("dev:server");
  if (!(await waitForApi(api))) {
    stop(1);
    process.exitCode = 1;
  }
}

if (!stopping) start("dev:web");
