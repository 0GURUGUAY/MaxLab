import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "favicon-redirect",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/favicon.ico") {
            next();
            return;
          }
          response.writeHead(302, { Location: "/favicon.svg" });
          response.end();
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    headers: { "Cross-Origin-Opener-Policy": "same-origin-allow-popups" },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Le serveur API MaxLab (port 8080) n'est pas démarré. Utilisez 'npm run dev' pour démarrer simultanément l'API et Vite." }));
            }
          });
        },
      },
    },
  },
});
