import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// Served from a GitHub Pages project subpath in production, root in dev.
export default defineConfig(({ command }) => {
  const base = command === "build" ? "/fitness-tracker/" : "/";
  return {
    base,
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        manifest: {
          name: "Hypertrophy",
          short_name: "Hypertrophy",
          description: "Personal strength & protein tracker",
          theme_color: "#0f1115",
          background_color: "#0f1115",
          display: "standalone",
          orientation: "portrait",
          scope: base,
          start_url: base,
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
  };
});
