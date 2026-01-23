import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'main.tsx'),
      fileName: () => 'client.js',
      formats: ['iife'],
      name: 'TeemuxClient',
    },
    minify: true,
    outDir: resolve(__dirname, '../../dist/client'),
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react(), cssInjectedByJsPlugin()],
});
