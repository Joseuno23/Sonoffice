import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React + Vite (TS). Dev server on 5173, proxies API and uploaded assets to NestJS on 3001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
