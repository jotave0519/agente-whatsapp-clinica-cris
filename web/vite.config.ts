import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" (nao "autoUpdate"): nunca troca a versao debaixo do usuario
      // sem avisar - o UpdatePrompt.tsx mostra o aviso discreto e so atualiza
      // quando ele clicar "Atualizar agora".
      registerType: "prompt",
      // null: o registro do service worker e feito manualmente pelo hook
      // useRegisterSW (UpdatePrompt.tsx), que controla o aviso de atualizacao -
      // evita registrar a SW duas vezes (uma pelo plugin, outra pelo hook).
      injectRegister: null,
      includeAssets: ["icons/favicon-16.png", "icons/favicon-32.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Clínica Zangelmi",
        short_name: "CRM Clínica",
        description: "Sistema de gestão da Clínica Zangelmi",
        theme_color: "#a76b63",
        background_color: "#f7f5f2",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "pt-BR",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // So os arquivos estaticos do build (JS/CSS/HTML/icones/fontes) entram
        // no precache - nunca respostas de /api/* (dados de pacientes,
        // financeiro etc). Sem nenhuma regra de runtimeCaching para /api,
        // essas chamadas continuam indo direto pra rede, sempre.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/webhook/, /^\/health/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
  build: {
    outDir: "dist",
  },
});
