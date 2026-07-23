import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { cpSync, existsSync, rmSync } from "node:fs";
import { defineConfig, loadEnv, mergeConfig, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

function mirrorNodeOutputForDistCheck(): PluginOption {
  return {
    name: "mirror-node-output-for-dist-check",
    apply: "build",
    closeBundle() {
      if (!existsSync(".output")) {
        return;
      }

      rmSync("dist", { recursive: true, force: true });
      cpSync(".output", "dist", { recursive: true });
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
        nitro({
          preset: "node-server",
          output: {
            dir: ".output",
            serverDir: ".output/server",
            publicDir: ".output/client",
          },
        }),
        mirrorNodeOutputForDistCheck(),
        viteReact(),
      ],
    },
    {},
  );
});

