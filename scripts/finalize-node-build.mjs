import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";

const nitroJsonPath = ".output/nitro.json";
const serverEntryPath = ".output/server/index.mjs";
const allowedNodePresets = new Set(["node-server", "node"]);

if (!existsSync(nitroJsonPath)) {
  throw new Error(`Missing ${nitroJsonPath}; Nitro did not generate a server output.`);
}

const nitroInfo = JSON.parse(readFileSync(nitroJsonPath, "utf8"));

if (!allowedNodePresets.has(nitroInfo.preset)) {
  throw new Error(
    `Expected a Node-compatible Nitro preset, got ${JSON.stringify(nitroInfo.preset)}. ` +
      `Check vite.config.ts and the NITRO_PRESET/SERVER_PRESET build environment.`,
  );
}

if (!existsSync(serverEntryPath)) {
  throw new Error(`Missing ${serverEntryPath}; node .output/server/index.mjs cannot start this build.`);
}

rmSync("dist", { recursive: true, force: true });
cpSync(".output", "dist", { recursive: true });

console.log(`Verified Nitro ${nitroInfo.preset} build at ${serverEntryPath}`);