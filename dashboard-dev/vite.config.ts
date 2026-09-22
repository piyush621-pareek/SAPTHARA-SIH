import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server for the command dashboard. Proxies /api to the Node backend so the
// browser and API share an origin (avoids CORS during local demos).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/bhuvan-api": {
        target: "https://bhuvan-app1.nrsc.gov.in",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bhuvan-api/, "/api"),
        secure: false,
      },
      "/osrm-api": {
        target: "https://router.project-osrm.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osrm-api/, ""),
        secure: false,
      },
    },
  },
});
