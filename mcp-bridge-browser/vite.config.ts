import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import manifest from './manifest.json';
import path from 'path';

export default defineConfig({
  plugins: [
    preact(),
    crx({ manifest })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  // @ts-ignore - Vitest config
  test: {
    globals: true,
    environment: 'jsdom'
  }
});