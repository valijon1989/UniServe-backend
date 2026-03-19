"use strict";

const { spawn } = require("child_process");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (!options.allowNonZero && code !== 0) {
        const error = new Error(`${command} exited with code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });

const parsePort = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code !== "ESRCH";
  }
};

const listPortPidsUnix = async (port) => {
  try {
    const result = await runCommand(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { allowNonZero: true }
    );

    return String(result.stdout || "")
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const listPortPidsWindows = async (port) => {
  const result = await runCommand("netstat", ["-ano", "-p", "tcp"], { allowNonZero: true });
  const lines = String(result.stdout || "").split(/\r?\n/);
  const pids = new Set();
  const portPattern = new RegExp(`[:.]${port}$`);

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const protocol = String(parts[0] || "").toUpperCase();
    const localAddress = String(parts[1] || "");
    const state = String(parts[3] || "").toUpperCase();
    const pid = Number(parts[4]);
    if (!protocol.startsWith("TCP")) continue;
    if (state !== "LISTENING") continue;
    if (!portPattern.test(localAddress)) continue;
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }

  return Array.from(pids);
};

const listPortPids = async (port) => {
  if (process.platform === "win32") {
    return listPortPidsWindows(port);
  }
  return listPortPidsUnix(port);
};

const terminatePid = async (pid) => {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;

  if (process.platform === "win32") {
    await runCommand("taskkill", ["/PID", String(pid), "/T", "/F"], { allowNonZero: true });
    return true;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error && error.code === "ESRCH") return false;
    throw error;
  }

  await wait(400);
  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (!error || error.code !== "ESRCH") throw error;
    }
  }

  return true;
};

const killPort = async (port, options = {}) => {
  const normalizedPort = parsePort(port, 5001);
  const logger = options.logger || console;
  const pids = (await listPortPids(normalizedPort)).filter((pid) => pid !== process.pid);

  if (!pids.length) {
    if (!options.silent) {
      logger.log(`[port-cleanup] Port ${normalizedPort} is already free.`);
    }
    return { port: normalizedPort, alreadyFree: true, killedPids: [] };
  }

  for (const pid of pids) {
    await terminatePid(pid);
  }

  logger.log(
    `[port-cleanup] Freed port ${normalizedPort}. Terminated PID${pids.length > 1 ? "s" : ""}: ${pids.join(", ")}`
  );

  return { port: normalizedPort, alreadyFree: false, killedPids: pids };
};

module.exports = {
  killPort,
  listPortPids,
  parsePort
};
