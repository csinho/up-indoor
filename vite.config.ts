// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

const devHttps = process.env.VITE_DEV_HTTPS === "true";
const isProductionBuild = process.argv.includes("build");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: true,
      port: 8080,
      strictPort: true,
      // Permite abrir pelo IP da rede (ex.: 192.168.x.x no celular)
      allowedHosts: true,
      ...(devHttps
        ? {
            ws: {
              protocol: "wss",
              clientPort: 8080,
            },
          }
        : {
            hmr: {
              clientPort: 8080,
            },
          }),
    },
    plugins: [
      ...(devHttps ? [basicSsl()] : []),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          enabled: true,
          type: "module",
        },
        includeAssets: ["logo.svg", "logo.png", "favicon.ico", "apple-touch-icon.png"],
        manifest: false,
        workbox: isProductionBuild
          ? {
              globDirectory: ".output/public",
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
              navigateFallback: null,
            }
          : {
              // Em dev não existe .output/public — usa cache em runtime
              navigateFallback: "/",
              runtimeCaching: [
                {
                  urlPattern: ({ request }) => request.mode === "navigate",
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "dev-pages",
                    networkTimeoutSeconds: 10,
                  },
                },
                {
                  urlPattern: ({ request }) =>
                    ["style", "script", "worker"].includes(request.destination),
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "dev-assets",
                  },
                },
              ],
            },
      }),
    ],
  },
});
