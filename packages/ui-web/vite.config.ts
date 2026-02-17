import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.join(dir, "src/dashboard"),
  build: {
    outDir: path.join(dir, "dist/dashboard"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.join(dir, "src/dashboard"),
    },
  },
});
