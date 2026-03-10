import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { realpathSync } from "fs";

const __dirname = realpathSync(fileURLToPath(new URL(".", import.meta.url)));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  cacheDir: resolve(__dirname, "node_modules", ".vite"),
  build: {
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
});
