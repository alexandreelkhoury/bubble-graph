import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
export default defineConfig({
  plugins: [preact()],
  server: { host: true, port: 5173, strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8787", "/healthz": "http://127.0.0.1:8787",
             "/parties": { target: "ws://127.0.0.1:8787", ws: true } } },
  build: { outDir: "dist", target: "es2022" },
});
