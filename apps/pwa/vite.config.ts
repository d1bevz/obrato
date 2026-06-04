import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Сгенерённый wasm-pack пакет ядра (crates/compute-wasm/pkg) — вне корня
// приложения; собрать: npm run build:wasm (см. README монорепо).
const computeWasmPkg = fileURLToPath(
  new URL('../../crates/compute-wasm/pkg', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      'compute-wasm': computeWasmPkg,
    },
  },
  server: {
    fs: {
      // dev-сервер должен уметь отдать pkg из монорепо выше корня apps/pwa
      allow: ['..', computeWasmPkg],
    },
  },
  worker: {
    format: 'es',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // .wasm — precached asset: расчёт работает полностью офлайн (гл.09 ③)
        globPatterns: ['**/*.{js,css,html,svg,wasm}'],
      },
      manifest: {
        name: 'Obrato — ассистент прораба',
        short_name: 'Obrato',
        description: 'Замеры → нормы → список закупок по этапам',
        lang: 'ru',
        theme_color: '#1f9d57',
        background_color: '#f3efe6',
        display: 'standalone',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
