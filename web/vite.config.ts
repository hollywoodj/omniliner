import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "web",
  server: {
    port: 5174,
    host: true,
    proxy: {
      "/api": "http://127.0.0.1:4466",
      "/automation": "http://127.0.0.1:4466",
      "/bridge": "http://127.0.0.1:4466",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
