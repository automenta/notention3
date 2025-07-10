// vitest.setup.ts
import '@testing-library/jest-dom';
import DOMPurify from 'dompurify';

// Make DOMPurify available globally in the JSDOM environment
if (typeof window !== 'undefined') {
  (window as any).DOMPurify = DOMPurify;
} else if (typeof global !== 'undefined') {
  // Fallback for environments where window might not be the primary global (less common for jsdom)
  (global as any).DOMPurify = DOMPurify;
}


// You can add other global setup here if needed, for example:
// - Mocking global objects (localStorage, fetch)
// - Setting up a global MSW (Mock Service Worker) server for network requests

// Example: Mocking localStorage
// const localStorageMock = (() => {
//   let store: { [key: string]: string } = {};
//   return {
//     getItem: (key: string) => store[key] || null,
//     setItem: (key: string, value: string) => {
//       store[key] = value.toString();
//     },
//     removeItem: (key: string) => {
//       delete store[key];
//     },
//     clear: () => {
//       store = {};
//     },
//   };
// })();
// Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Make sure to run `npm install --save-dev @testing-library/jest-dom` if you haven't already.
// (Which we did in the package.json modification)
