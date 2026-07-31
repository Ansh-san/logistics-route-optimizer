import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy /api requests to the Express backend during development
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // es2019 is intentional — keeps the output compatible with slightly older
    // browsers while still being fully supported by Rolldown/OXC.
    target: "es2019",
    // "oxc" is Vite 8's native Rust-based minifier (no extra dependency needed).
    // "esbuild" still works but requires esbuild as an explicit devDependency
    // and triggers a deprecation warning in Vite 8.
    minify: "oxc",
    // Vite 8 replaced Rollup with Rolldown; use rolldownOptions going forward.
    // rollupOptions is accepted as a deprecated alias and still works, but
    // rolldownOptions is the canonical key and avoids the compat warning.
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/leaflet") ||
            id.includes("node_modules/react-leaflet")
          ) {
            return "leaflet";
          }
        },
      },
    },
  },
});