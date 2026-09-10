import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Permite abrir o front em qualquer subdominio .localhost - e assim que se
    // escolhe a escola em desenvolvimento (ceti.localhost:5174, escolab.localhost:5174).
    allowedHosts: [".localhost"],
    proxy: {
      "/api": {
        target: "http://localhost:3401",
        // changeOrigin: false DE PROPOSITO - e o Host que identifica o tenant
        // (shared/middlewares/tenant.ts). Mesmo comportamento do Traefik em producao
        // (passHostHeader). Ver vite.config.ts do modulo Restaurante.
        changeOrigin: false,
      },
      "/uploads": {
        target: "http://localhost:3401",
        changeOrigin: false,
      },
    },
  },
});
