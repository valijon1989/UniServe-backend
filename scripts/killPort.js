"use strict";

const { killPort, parsePort } = require("./portUtils");

async function main() {
  const port = parsePort(process.argv[2] || process.env.PORT, 5001);
  const result = await killPort(port, { logger: console });

  if (result.alreadyFree) {
    console.log(`[port-cleanup] Nothing to kill on port ${port}.`);
  }
}

main().catch((error) => {
  console.error("[port-cleanup] Failed to clear port:", error);
  process.exit(1);
});
