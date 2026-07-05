import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: (id) => {
                if (id.startsWith("@story-studio/")) return false;
                if (id.startsWith(".") || id.startsWith("/")) return false;
                return true;
              },
            },
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@story-studio/shared": resolve(__dirname, "../../packages/shared/src"),
      "@story-studio/workspace-fs": resolve(
        __dirname,
        "../../packages/workspace-fs/src",
      ),
    },
  },
  server: {
    port: 5175,
  },
});
