import { defineConfig } from "vite";

// 5174 is the port the debug "JAMAA Proto" TV activity opens by default (http://<server host>:5174/).
export default defineConfig({
  base: "./", // static dist works from any path (Cloudflare Pages, a USB stick, file server)
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: {
    target: "es2020", // Android TV WebView on old Google TV firmware can lag behind; keep the syntax conservative
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
