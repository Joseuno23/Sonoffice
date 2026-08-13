import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React + Vite (TS). Dev server on 5173, proxies /api to the NestJS API on 3001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
