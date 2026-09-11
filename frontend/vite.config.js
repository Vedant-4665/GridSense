import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same variable the Flask app reads. On macOS, AirPlay Receiver holds 5000.
const apiPort = process.env.API_PORT ?? "5000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Lets the frontend call /api/* without CORS juggling during development,
    // and keeps the session cookie same-origin.
    proxy: { "/api": `http://localhost:${apiPort}` },
  },
});
