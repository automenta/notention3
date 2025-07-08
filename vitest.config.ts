/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'; // Ensure react plugin is used if not already in vite.config

export default defineConfig({
  plugins: [react()], // Required for JSX transformation if not using Vite's main config
  test: {
    globals: true, // Makes describe, it, expect, etc. globally available
    environment: 'jsdom', // Use JSDOM for tests that need a browser-like environment
    setupFiles: './vitest.setup.ts', // Optional: For global test setup (e.g., jest-dom matchers)
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
    // If your main vite.config.ts has aliases, replicate them here or import from it
    // resolve: {
    //   alias: {
    //     '@': path.resolve(__dirname, './src'),
    //   },
    // },
  },
});
