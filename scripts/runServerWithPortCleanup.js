"use strict";

const path = require("path");
const { spawn } = require("child_process");
const { killPort, parsePort } = require("./portUtils");

const resolveLocalBin = (name) => {
  const ext = process.platform === "win32" ? ".cmd" : "";
  return path.join(process.cwd(), "node_modules", ".bin", `${name}${ext}`);
};

async function main() {
  const mode = process.argv[2] === "dev" ? "dev" : "start";
  const forceClean = process.argv.includes("--force-clean");
  const port = parsePort(process.env.PORT, 5001);

  if (mode === "dev" || mode === "start" || forceClean) {
    await killPort(port, { logger: console, silent: false });
  }

  const command = mode === "dev" ? resolveLocalBin("nodemon") : resolveLocalBin("ts-node");
  const args =
    mode === "dev"
      ? ["--signal", "SIGTERM", "--exec", "ts-node", "src/server.ts"]
      : ["src/server.ts"];

  console.log(`[startup] Launching UniServe backend in ${mode} mode on preferred port ${port}.`);

  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });

  child.on("error", (error) => {
    console.error("[startup] Failed to launch backend process:", error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("[startup] Pre-start cleanup failed:", error);
  process.exit(1);
});
