/// <reference types="vitest" />
import path from 'path'; // Added path import
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'; // Ensure react plugin is used if not already in vite.config

export default defineConfig({
  plugins: [react()], // Required for JSX transformation if not using Vite's main config
  test: {
    globals: true, // Makes describe, it, expect, etc. globally available
    environment: 'jsdom', // Use JSDOM for tests that need a browser-like environment
    setupFiles: './vitest.setup.ts', // Optional: For global test setup (e.g., jest-dom matchers)
    // coverage: {
    //   provider: 'v8', // or 'istanbul'
    //   reporter: ['text', 'json', 'html'],
    //   reportsDirectory: './coverage',
    // },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    testTimeout: 600000, // 10 minutes per test file
    hookTimeout: 600000, // 10 minutes for hooks per test file
    // Explicitly define where to find tests and what to exclude
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,eslint,esbuild}.config.*',
      'tests-e2e/**' // Keep existing exclusion for e2e tests
    ],
  },
});
