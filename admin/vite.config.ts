import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri expects fixed ports + relative asset paths.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 1420, strictPort: true },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
