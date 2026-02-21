import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const DASHBOARD_API_PORT = Number(process.env.DASHBOARD_API_PORT) || 3400;
const DASHBOARD_API = `http://127.0.0.1:${DASHBOARD_API_PORT}`;

export default defineConfig({
  plugins: [react()],
  root: path.join(dir, "src/dashboard"),
  resolve: {
    alias: {
      "@": path.join(dir, "src/dashboard"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["lucide-react", "react", "react-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: DASHBOARD_API,
        changeOrigin: true,
        secure: false,
      },
      "/dependency-graph.html": {
        target: DASHBOARD_API,
        changeOrigin: true,
      },
      "/migration-audit.html": {
        target: DASHBOARD_API,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(dir, "dist/dashboard"),
    emptyOutDir: true,
  },
});
