const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

function executableName() {
  return process.platform === "win32" ? "codex.exe" : "codex";
}

function platformFolder() {
  const platform = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  return `${platform}-${arch}`;
}

function resolveCodexPath(configuredPath = "") {
  if (configuredPath.trim()) {
    const expanded = configuredPath.replace(/^~(?=$|\/|\\)/, os.homedir());
    return expanded;
  }

  const extensionRoots = [
    path.join(os.homedir(), ".vscode", "extensions"),
    path.join(os.homedir(), ".vscode-insiders", "extensions"),
  ];

  for (const root of extensionRoots) {
    try {
      const installs = fs.readdirSync(root)
        .filter((name) => name.startsWith("openai.chatgpt-"))
        .sort()
        .reverse();
      for (const install of installs) {
        const candidate = path.join(root, install, "bin", platformFolder(), executableName());
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {
      // The editor or extension directory may not exist.
    }
  }

  return "codex";
}

class CodexUsageClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.codexPath = resolveCodexPath(options.codexPath);
    this.process = null;
    this.pending = new Map();
    this.nextId = 1;
    this.ready = null;
  }

  async start() {
    if (this.ready) return this.ready;
    this.ready = this.startProcess();
    return this.ready;
  }

  async startProcess() {
    this.process = spawn(this.codexPath, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.process.once("error", (error) => this.failAll(error));
    this.process.once("exit", (code) => {
      this.failAll(new Error(`Codex App Server exited (${code ?? "unknown"}).`));
      this.emit("exit");
    });

    readline.createInterface({ input: this.process.stdout }).on("line", (line) => {
      try {
        this.handleMessage(JSON.parse(line));
      } catch {
        // Ignore non-protocol output.
      }
    });

    let stderr = "";
    this.process.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    this.process.stderr.on("end", () => {
      if (stderr.trim()) this.emit("diagnostic", stderr.trim());
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex_usage_status",
        title: "Codex Usage Status",
        version: "0.1.0",
      },
    });
    this.notify("initialized", {});
  }

  handleMessage(message) {
    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || "Codex request failed."));
      else pending.resolve(message.result);
      return;
    }

    if (message.method === "account/rateLimits/updated") {
      this.emit("rateLimits", message.params);
    }
  }

  request(method, params) {
    if (!this.process?.stdin?.writable) return Promise.reject(new Error("Codex App Server is not running."));
    const id = this.nextId++;
    const message = params === undefined ? { method, id } : { method, id, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  notify(method, params) {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(`${JSON.stringify({ method, params })}\n`);
    }
  }

  async readRateLimits() {
    await this.start();
    return this.request("account/rateLimits/read");
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  dispose() {
    this.failAll(new Error("Codex Usage Status was disposed."));
    this.process?.kill();
    this.process = null;
    this.ready = null;
  }
}

module.exports = { CodexUsageClient, resolveCodexPath };
