import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, mergeConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const isSandbox = Boolean(
  process.env.__LOVABLE_JWKS_URL ||
    process.env.LOVABLE_ASSETS_ENDPOINT_URL ||
    process.env.LOVABLE_BROWSER_AUTH_STATUS,
);

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
        nitro(
          isSandbox
            ? {
                preset: "cloudflare-module",
                output: {
                  dir: "dist",
                  serverDir: "dist/server",
                  publicDir: "dist/client",
                },
              }
            : {
                preset: "node-server",
                output: {
                  dir: ".output",
                  serverDir: ".output/server",
                  publicDir: ".output/public",
                },
              },
        ),
        viteReact(),
      ],
    },
    {},
  );
});

