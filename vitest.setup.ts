// vitest.setup.ts
import '@testing-library/jest-dom';

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
