import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register the service worker
if ('serviceWorker' in navigator) {
  // && !/localhost/.test(window.location.toString())) { // Optional: disable on localhost
  registerSW({ immediate: true });
}

// Initialize AI Service and its store listener after app setup
import { aiService, setupAiServiceStoreListener } from './services/AIService.ts';
import { useAppStore } from './store/index.ts'; // To ensure store is initialized

// We need to ensure the store's own initialization logic (initializeApp) has run.
// A common way is to call it here or ensure App.tsx does it.
// For AIService, let's initialize it after the main store initialization.

const root = createRoot(document.getElementById('root')!);

// Asynchronously initialize application services and then render the app
const startApp = async () => {
  try {
    // First, ensure the main application store is initialized
    await useAppStore.getState().initializeApp();
    console.log("App store initialized.");

    // Then, initialize AI Service and its store listener
    aiService.initializeAiModels();
    setupAiServiceStoreListener();
    console.log("AIService models and store listener initialized from main.tsx after app store init.");

  } catch (error) {
    console.error("Failed to initialize application services:", error);
    // Optionally render an error message to the user
  }

  // Render the app
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

startApp();
