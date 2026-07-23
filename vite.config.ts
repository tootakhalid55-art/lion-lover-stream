import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { rmSync } from "node:fs";
import { defineConfig, loadEnv, mergeConfig, type PluginOption, type UserConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const NODE_NITRO_PRESET = "node-server" as const;

const nodeNitroConfig = {
  preset: NODE_NITRO_PRESET,
  output: {
    dir: ".output",
    serverDir: ".output/server",
    publicDir: ".output/client",
  },
} satisfies UserConfig["nitro"];

function forceNodeNitroBuild(): PluginOption {
  return {
    name: "force-node-nitro-build",
    enforce: "pre",
    apply: "build",
    config(_config, { command }) {
      process.env.NITRO_PRESET = NODE_NITRO_PRESET;
      process.env.SERVER_PRESET = NODE_NITRO_PRESET;

      if (command === "build") {
        rmSync(".output", { recursive: true, force: true });
        rmSync("dist", { recursive: true, force: true });
      }

      return { nitro: nodeNitroConfig };
    },
  };
}

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");

  return mergeConfig(
    {
      define: Object.fromEntries(
        Object.entries(loadedEnv).map(([key, value]) => [
          `import.meta.env.${key}`,
          JSON.stringify(value),
        ]),
      ),
      css: { transformer: "lightningcss" },
      nitro: nodeNitroConfig,
      resolve: {
        alias: { "@": `${process.cwd()}/src` },
        dedupe: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@tanstack/react-query",
          "@tanstack/query-core",
        ],
      },
      server: {
        host: "::",
        port: 8080,
        strictPort: true,
      },
      plugins: [
        forceNodeNitroBuild(),
        tailwindcss(),
        tsConfigPaths({ projects: ["./tsconfig.json"] }),
        tanstackStart({
          importProtection: {
            behavior: "error",
            client: {
              files: ["**/server/**"],
              specifiers: ["server-only"],
            },
          },
          server: { entry: "server" },
        }),
        nitro(nodeNitroConfig),
        viteReact(),
      ],
    },
    {},
  );
});

