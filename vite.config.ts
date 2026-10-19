import { defineConfig } from 'vite';
import { playgamaBridge } from '@playgama/bridge/vite';

export default defineConfig({
  base: './',
  plugins: [
    playgamaBridge({ mode: 'local' })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  }
});
