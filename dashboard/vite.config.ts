import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server for the command dashboard. Proxies /api to the Node backend so the
// browser and API share an origin (avoids CORS during local demos).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
