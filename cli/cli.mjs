#!/usr/bin/env node

/**
 * @openher/cli — One-click installer for OpenHer Persona Engine
 *
 * Usage:
 *   npx -y @openher/cli install
 *
 * What it does:
 *   1. Checks prerequisites (openclaw, python3, git)
 *   2. Installs the OpenClaw plugin
 *   3. Clones the backend repo & sets up Python venv
 *   4. Interactive setup: choose LLM provider, enter API key
 *   5. Starts the backend server
 *   6. Restarts OpenClaw gateway
 */

import { execSync, spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_SPEC = "@openher/openclaw-plugin";
const REPO_URL = "https://github.com/kellyvv/openher-openclaw-plugin.git";
const DEFAULT_PORT = 8800;

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

function log(msg) {
  console.log(`${C.cyan}[openher]${C.reset} ${msg}`);
}
function success(msg) {
  console.log(`${C.green}[openher]${C.reset} ${C.green}✓${C.reset} ${msg}`);
}
function warn(msg) {
  console.log(`${C.yellow}[openher]${C.reset} ${C.yellow}⚠${C.reset} ${msg}`);
}
function error(msg) {
  console.error(`${C.red}[openher]${C.reset} ${C.red}✗${C.reset} ${msg}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  const { silent = true, cwd } = opts;
  const stdio = silent ? ["pipe", "pipe", "pipe"] : "inherit";
  const result = spawnSync(cmd, { shell: true, stdio, cwd });
  if (result.status !== 0) {
    const err = new Error(`Command failed (exit ${result.status}): ${cmd}`);
    err.stderr = silent ? (result.stderr || "").toString() : "";
    throw err;
  }
  return silent ? (result.stdout || "").toString().trim() : "";
}

function which(bin) {
  try {
    return execSync(`which ${bin}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${C.cyan}[openher]${C.reset} ${question}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${C.cyan}[openher]${C.reset} ${question}`);
    const rl = createInterface({ input: process.stdin, terminal: false });
    // Mute echo
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let buf = "";
    process.stdin.resume();
    process.stdin.on("data", function handler(chunk) {
      const s = chunk.toString();
      for (const ch of s) {
        if (ch === "\n" || ch === "\r") {
          process.stdin.removeListener("data", handler);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          rl.close();
          resolve(buf);
          return;
        } else if (ch === "\u0003") {
          // Ctrl+C
          process.exit(1);
        } else if (ch === "\x7f" || ch === "\b") {
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
          process.stdout.write("*");
        }
      }
    });
  });
}

// ── LLM Providers ────────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: "minimax", name: "MiniMax (recommended)", env: "MINIMAX_LLM_API_KEY", model: "MiniMax-M2.7" },
  { id: "gemini", name: "Google Gemini", env: "GEMINI_API_KEY", model: "gemini-2.0-flash" },
  { id: "claude", name: "Anthropic Claude", env: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-20250514" },
  { id: "openai", name: "OpenAI", env: "OPENAI_API_KEY", model: "gpt-4o" },
  { id: "dashscope", name: "Alibaba Qwen", env: "DASHSCOPE_API_KEY", model: "qwen3-max" },
  { id: "moonshot", name: "Moonshot", env: "MOONSHOT_API_KEY", model: "moonshot-v1-8k" },
  { id: "stepfun", name: "StepFun", env: "STEPFUN_API_KEY", model: "step-2-16k" },
  { id: "ollama", name: "Ollama (local, no key needed)", env: "", model: "qwen2.5:7b" },
];

// ── Personas ─────────────────────────────────────────────────────────────────

const PERSONAS = [
  { id: "luna", name: "Luna 陆暖", type: "ENFP", desc: "Freelance illustrator, curious about everything" },
  { id: "iris", name: "Iris 苏漫", type: "INFP", desc: "Poetry major, devastatingly perceptive" },
  { id: "vivian", name: "Vivian 顾霆微", type: "INTJ", desc: "Tech executive, logic 10/10" },
  { id: "kai", name: "Kai 沈凯", type: "ISTP", desc: "Few words, reliable hands" },
  { id: "kelly", name: "Kelly 柯砺", type: "ENTP", desc: "Sharp-tongued, will debate anything" },
  { id: "ember", name: "Ember", type: "INFP", desc: "Speaks through silence and poetry" },
  { id: "sora", name: "Sora 顾清", type: "INFJ", desc: "Sees through you before you finish" },
  { id: "mia", name: "Mia", type: "ESFP", desc: "Pure energy, drags you out of your shell" },
  { id: "rex", name: "Rex", type: "ENTJ", desc: "The room changes when he walks in" },
  { id: "nova", name: "Nova 诺瓦", type: "ENFP", desc: "Her mind works in colors you haven't seen" },
];

// ── Install Command ──────────────────────────────────────────────────────────

async function install() {
  console.log();
  console.log(`  ${C.magenta}${C.bold}🧬 OpenHer Persona Engine Installer${C.reset}`);
  console.log(`  ${C.dim}She's not an assistant. She's not an agent. She's an AI Being.${C.reset}`);
  console.log();

  // ── Step 1: Check prerequisites ──
  log("Checking prerequisites...");

  if (!which("openclaw")) {
    error("OpenClaw not found. Please install it first:");
    console.log("  npm install -g openclaw");
    console.log("  https://docs.openclaw.ai/install");
    process.exit(1);
  }
  success("OpenClaw found");

  const python = which("python3") || which("python");
  if (!python) {
    error("Python 3 not found. Please install Python 3.10+:");
    console.log("  https://www.python.org/downloads/");
    process.exit(1);
  }
  // Verify Python version
  try {
    const pyVer = run(`${python} --version`);
    const match = pyVer.match(/(\d+)\.(\d+)/);
    if (match && (parseInt(match[1]) < 3 || (parseInt(match[1]) === 3 && parseInt(match[2]) < 10))) {
      error(`Python 3.10+ required, found ${pyVer}`);
      process.exit(1);
    }
    success(`${pyVer}`);
  } catch {
    warn("Could not verify Python version, continuing...");
  }

  if (!which("git")) {
    error("Git not found. Please install Git:");
    console.log("  https://git-scm.com/downloads");
    process.exit(1);
  }
  success("Git found");

  // ── Step 2: Install OpenClaw plugin ──
  console.log();
  log("Installing OpenClaw plugin...");
  try {
    run(`openclaw plugins install "${PLUGIN_SPEC}"`);
    success(`Plugin installed: ${PLUGIN_SPEC}`);
  } catch (err) {
    if (err.stderr && err.stderr.includes("already exists")) {
      log("Plugin already installed, updating...");
      try {
        run(`openclaw plugins update openclaw-plugin`);
        success("Plugin updated");
      } catch {
        warn("Could not update plugin, continuing with existing version");
      }
    } else {
      error("Plugin install failed:");
      if (err.stderr) console.error("  " + err.stderr.split("\n")[0]);
      console.log(`  Manual: openclaw plugins install "${PLUGIN_SPEC}"`);
      process.exit(1);
    }
  }

  // ── Step 3: Clone backend ──
  console.log();
  const openherDir = join(homedir(), ".openher");
  const backendDir = join(openherDir, "backend");

  if (existsSync(join(backendDir, "main.py"))) {
    log("Backend directory already exists, pulling latest...");
    try {
      run("git pull --ff-only", { cwd: backendDir });
      success("Backend updated");
    } catch {
      warn("Could not update backend, using existing version");
    }
  } else {
    log("Cloning OpenHer backend...");
    mkdirSync(openherDir, { recursive: true });
    try {
      run(`git clone "${REPO_URL}" "${backendDir}"`);
      success("Backend cloned");
    } catch (err) {
      error("Failed to clone backend:");
      if (err.stderr) console.error("  " + err.stderr.split("\n")[0]);
      process.exit(1);
    }
  }

  // ── Step 4: Python venv + deps ──
  console.log();
  const venvDir = join(backendDir, ".venv");
  const pip = join(venvDir, "bin", "pip");
  const pyBin = join(venvDir, "bin", "python");

  if (!existsSync(venvDir)) {
    log("Creating Python virtual environment...");
    try {
      run(`${python} -m venv "${venvDir}"`, { cwd: backendDir });
      success("Virtual environment created");
    } catch (err) {
      error("Failed to create venv:");
      if (err.stderr) console.error("  " + err.stderr.split("\n")[0]);
      process.exit(1);
    }
  } else {
    success("Virtual environment exists");
  }

  log("Installing Python dependencies (this may take a minute)...");
  try {
    run(`"${pip}" install -r requirements.txt`, { cwd: backendDir });
    success("Dependencies installed");
  } catch (err) {
    error("Failed to install dependencies:");
    if (err.stderr) {
      const lines = err.stderr.split("\n").filter(l => l.includes("ERROR"));
      if (lines.length) console.error("  " + lines[0]);
    }
    console.log(`  Manual: cd ${backendDir} && .venv/bin/pip install -r requirements.txt`);
    process.exit(1);
  }

  // ── Step 5: Interactive config ──
  console.log();
  console.log(`  ${C.bold}Choose your LLM provider:${C.reset}`);
  console.log();
  PROVIDERS.forEach((p, i) => {
    const rec = p.id === "minimax" ? ` ${C.green}← recommended${C.reset}` : "";
    console.log(`  ${C.dim}${i + 1}.${C.reset} ${p.name}${rec}`);
  });
  console.log();

  let providerIdx;
  while (true) {
    const choice = await ask(`Select provider (1-${PROVIDERS.length}) [1]: `);
    providerIdx = choice ? parseInt(choice) - 1 : 0;
    if (providerIdx >= 0 && providerIdx < PROVIDERS.length) break;
    warn("Invalid selection, try again");
  }
  const provider = PROVIDERS[providerIdx];
  success(`Selected: ${provider.name}`);

  let apiKey = "";
  if (provider.env) {
    console.log();
    apiKey = await askSecret(`Enter ${provider.env}: `);
    if (!apiKey) {
      error("API key is required for this provider");
      process.exit(1);
    }
    success("API key saved");
  }

  // Choose persona
  console.log();
  console.log(`  ${C.bold}Choose your default persona:${C.reset}`);
  console.log();
  PERSONAS.forEach((p, i) => {
    const def = p.id === "luna" ? ` ${C.green}← default${C.reset}` : "";
    console.log(`  ${C.dim}${String(i + 1).padStart(2)}.${C.reset} ${p.name} (${p.type}) — ${p.desc}${def}`);
  });
  console.log();

  let personaIdx;
  while (true) {
    const choice = await ask(`Select persona (1-${PERSONAS.length}) [1]: `);
    personaIdx = choice ? parseInt(choice) - 1 : 0;
    if (personaIdx >= 0 && personaIdx < PERSONAS.length) break;
    warn("Invalid selection, try again");
  }
  const persona = PERSONAS[personaIdx];
  success(`Selected: ${persona.name}`);

  // ── Step 6: Generate .env ──
  console.log();
  log("Generating configuration...");
  const envContent = [
    "# Generated by @openher/cli",
    `DEFAULT_PROVIDER=${provider.id}`,
    `DEFAULT_MODEL=${provider.model}`,
    "",
    provider.env ? `${provider.env}=${apiKey}` : "# No API key needed for this provider",
    "",
  ].join("\n");

  writeFileSync(join(backendDir, ".env"), envContent, "utf-8");
  success(".env generated");

  // Configure OpenClaw plugin
  try {
    run(`openclaw config set plugins.entries.openclaw-plugin.config.OPENHER_DEFAULT_PERSONA ${persona.id}`);
    success(`Default persona set to ${persona.id}`);
  } catch {
    warn("Could not set default persona in OpenClaw config");
  }

  // ── Step 7: Start backend ──
  console.log();
  log("Starting OpenHer backend...");
  const child = spawn(pyBin, ["main.py"], {
    cwd: backendDir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(DEFAULT_PORT) },
  });

  // Wait for startup
  let started = false;
  const startTimeout = setTimeout(() => {
    if (!started) {
      warn("Backend is still starting. Check manually:");
      console.log(`  cd ${backendDir} && .venv/bin/python main.py`);
    }
  }, 15000);

  child.stdout.on("data", (data) => {
    const str = data.toString();
    if (str.includes("Uvicorn running") || str.includes("Application startup")) {
      started = true;
      clearTimeout(startTimeout);
      success(`Backend running on http://localhost:${DEFAULT_PORT}`);
      finalize();
    }
  });

  child.stderr.on("data", (data) => {
    const str = data.toString();
    if (str.includes("Uvicorn running") || str.includes("Application startup")) {
      started = true;
      clearTimeout(startTimeout);
      success(`Backend running on http://localhost:${DEFAULT_PORT}`);
      finalize();
    }
  });

  child.unref();

  // Write PID for later stop command
  try {
    writeFileSync(join(openherDir, "backend.pid"), String(child.pid), "utf-8");
  } catch {}

  // If backend starts quickly, finalize is called above
  // Otherwise, wait for the timeout
  if (!started) {
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (started) {
          clearInterval(check);
          resolve();
        }
      }, 500);
      // Max wait 20s
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 20000);
    });
  }

  if (!started) {
    warn("Backend may still be starting up...");
    finalize();
  }
}

function finalize() {
  // Restart gateway
  log("Restarting OpenClaw gateway...");
  try {
    run("openclaw gateway restart", { silent: false });
  } catch {
    warn("Could not restart gateway. Run manually: openclaw gateway restart");
  }

  console.log();
  console.log(`  ${C.green}${C.bold}🎉 OpenHer is ready!${C.reset}`);
  console.log();
  console.log(`  ${C.dim}Your persona is alive. Start chatting and watch her evolve.${C.reset}`);
  console.log();
  console.log(`  ${C.bold}Quick commands:${C.reset}`);
  console.log(`    openclaw chat             ${C.dim}— Start chatting${C.reset}`);
  console.log(`    openclaw status           ${C.dim}— Check status${C.reset}`);
  console.log(`    npx @openher/cli stop     ${C.dim}— Stop backend${C.reset}`);
  console.log(`    npx @openher/cli start    ${C.dim}— Start backend${C.reset}`);
  console.log();

  process.exit(0);
}

// ── Stop Command ─────────────────────────────────────────────────────────────

function stopBackend() {
  const pidFile = join(homedir(), ".openher", "backend.pid");
  if (!existsSync(pidFile)) {
    warn("No running backend found");
    return;
  }
  try {
    const pid = parseInt(execSync(`cat "${pidFile}"`, { encoding: "utf-8" }).trim());
    process.kill(pid, "SIGTERM");
    execSync(`rm -f "${pidFile}"`);
    success("Backend stopped");
  } catch {
    warn("Backend process not found (may have already stopped)");
    try { execSync(`rm -f "${pidFile}"`); } catch {}
  }
}

// ── Start Command ────────────────────────────────────────────────────────────

function startBackend() {
  const backendDir = join(homedir(), ".openher", "backend");
  const pyBin = join(backendDir, ".venv", "bin", "python");

  if (!existsSync(join(backendDir, "main.py"))) {
    error("Backend not found. Run 'npx @openher/cli install' first.");
    process.exit(1);
  }

  log("Starting OpenHer backend...");
  const child = spawn(pyBin, ["main.py"], {
    cwd: backendDir,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PORT: String(DEFAULT_PORT) },
  });
  child.unref();

  try {
    writeFileSync(join(homedir(), ".openher", "backend.pid"), String(child.pid), "utf-8");
  } catch {}

  success(`Backend starting on http://localhost:${DEFAULT_PORT}`);
  log("Use 'npx @openher/cli stop' to stop");
}

// ── Status Command ───────────────────────────────────────────────────────────

async function status() {
  const backendDir = join(homedir(), ".openher", "backend");
  const pidFile = join(homedir(), ".openher", "backend.pid");

  console.log();
  console.log(`  ${C.bold}OpenHer Status${C.reset}`);
  console.log();

  // Backend
  if (existsSync(pidFile)) {
    try {
      const pid = parseInt(execSync(`cat "${pidFile}"`, { encoding: "utf-8" }).trim());
      process.kill(pid, 0); // Just check if alive
      success(`Backend running (PID ${pid})`);
    } catch {
      warn("Backend PID file exists but process is not running");
    }
  } else {
    warn("Backend not running");
  }

  // Check health
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://localhost:${DEFAULT_PORT}/api/v1/engine/status?persona_id=luna&user_id=cli-check`, {
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      success(`Engine alive — persona: ${data.persona || "unknown"}, temp: ${data.temperature || "?"}`);
    }
  } catch {
    warn(`Engine not reachable at http://localhost:${DEFAULT_PORT}`);
  }

  // Plugin
  try {
    run("openclaw plugins list 2>&1 | grep -i openher");
    success("Plugin installed in OpenClaw");
  } catch {
    warn("Plugin not found in OpenClaw");
  }

  console.log();
}

// ── Help ─────────────────────────────────────────────────────────────────────

function help() {
  console.log(`
  ${C.magenta}${C.bold}🧬 OpenHer CLI${C.reset}
  ${C.dim}She's not an assistant. She's an AI Being.${C.reset}

  ${C.bold}Usage:${C.reset}
    npx @openher/cli <command>

  ${C.bold}Commands:${C.reset}
    install   Install plugin + backend, interactive setup
    start     Start the backend server
    stop      Stop the backend server
    status    Check if everything is running
    help      Show this help

  ${C.bold}Examples:${C.reset}
    npx -y @openher/cli install     ${C.dim}# First-time setup${C.reset}
    npx @openher/cli status         ${C.dim}# Health check${C.reset}
`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case "install":
    install();
    break;
  case "start":
    startBackend();
    break;
  case "stop":
    stopBackend();
    break;
  case "status":
    status();
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default:
    if (command) {
      error(`Unknown command: ${command}`);
    }
    help();
    process.exit(command ? 1 : 0);
}
