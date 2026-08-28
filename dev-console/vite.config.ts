import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only ever calls this app's own /api/* routes. In dev (and preview)
// Vite proxies those to the curro-ai backend, so the browser never talks to
// localhost directly — that keeps streaming (SSE) and CORS working from the proxy URL.
const CURRO_API_URL = process.env.CURRO_API_URL ?? "http://localhost:8787";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    cors: true,
    proxy: {
      "/api": {
        target: CURRO_API_URL,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      "/api": {
        target: CURRO_API_URL,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(fileURLToPath(new URL(".", import.meta.url)), "./src"),
    },
  },
});
