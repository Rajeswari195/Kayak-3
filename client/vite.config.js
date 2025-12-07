/**
 * @file client/vite.config.js
 * @description Vite configuration for the Kayak-like Travel Platform client.
 *
 * Features:
 * - React plugin for Fast Refresh and JSX transformation.
 * - Path alias '@' mapping to './src'.
 * - Proxy configuration for /api requests to the backend core-api service.
 */

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/ws/concierge": {
        target: "http://127.0.0.1:8001",
        ws: true,
        changeOrigin: true,
      }
    },
  },
});