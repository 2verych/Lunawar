import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: ['VITE_', 'GOOGLE_'],
  plugins: [react()],
  server: {
    port: Number(process.env.ADMIN_PORT) || 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
});
