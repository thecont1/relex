import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Intranet deployment. Use relative base so the app works under any mount path.
// Data file lives in /public/data and is fetched at runtime.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: '127.0.0.1',
    // When testing via docker host, allow the docker bridge hostname too.
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  }
});