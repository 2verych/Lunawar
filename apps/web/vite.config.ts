import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: ['VITE_', 'GOOGLE_'],
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/lobby': 'http://localhost:3000',
      '/rooms': 'http://localhost:3000',
      '/me': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
});
