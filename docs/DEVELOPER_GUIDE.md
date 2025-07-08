# Notention Developer Guide

This guide provides information for developers looking to understand, contribute to, or extend Notention.

## 1. Introduction
    - Project Overview and Goals
    - Technology Stack (TypeScript, React, Vite, Zustand, Nostr, Tiptap, LocalForage)

## 2. Project Structure
    - Overview of key directories (`src/`, `public/`, `docs/`, etc.)
    - `src/components/`: UI Components
    - `src/services/`: Core logic (DB, Nostr, AI, Notes, Ontology, etc.)
    - `src/store/`: Zustand store for state management
    - `src/lib/`: Utility functions
    - `shared/`: TypeScript types shared between components/services

## 3. Getting Started (Development Environment)
    - Prerequisites (Node.js, npm/yarn)
    - Cloning the Repository
    - Installing Dependencies (`npm install` or `yarn install`)
    - Running the Development Server (`npm run dev` or `yarn dev`)
    - Building for Production (`npm run build` or `yarn build`)

## 4. Core Concepts and Architecture
    - State Management (Zustand)
        - Key stores and actions
        - Async operations
    - Data Persistence (LocalForage via `DBService`)
        - Data models (`Note`, `OntologyNode`, `UserProfile`, etc. in `shared/types.ts`)
        - Sync queue for offline operations
    - Nostr Integration (`NostrService`)
        - Key management
        - Event publishing and subscription
        - Syncing notes and ontology (Kind 4, Kind 30001)
    - Rich Text Editor (`NoteEditor.tsx` with Tiptap)
        - Custom extensions (SemanticTag)
        - Autocomplete for tags/mentions
    - Ontology System (`OntologyService`)
        - Structure and manipulation
        - Semantic matching
    - PWA and Service Workers (`vite-plugin-pwa`, Workbox)

## 5. Coding Conventions and Style
    - Linting and Formatting (ESLint, Prettier - if configured)
    - TypeScript Best Practices
    - Naming Conventions

## 6. Testing
    - Unit Tests (Vitest)
        - Running tests (`npm run test` or `yarn test`)
        - Test file locations (e.g., `*.test.ts`)
        - Mocking dependencies
    - End-to-End Testing (Not currently set up, potential future addition)

## 7. Key Services Deep Dive
    - `NoteService.ts`: CRUD, semantic search for notes.
    - `OntologyService.ts`: Managing the ontology tree, semantic matching.
    - `NostrService.ts`: Interacting with Nostr relays, encryption, syncing.
    - `DBService.ts`: Abstraction over LocalForage for IndexedDB storage.
    - `AIService.ts`: Optional AI features (auto-tagging, summarization).

## 8. Contributing
    - Reporting Bugs (GitHub Issues)
    - Suggesting Features
    - Pull Request Process (Fork, Branch, Commit, PR)

## 9. Deployment
    - The application is a static PWA, buildable with `npm run build`.
    - Deploy the contents of the `dist/` folder to any static web hosting service (e.g., Vercel, Netlify, GitHub Pages).
    - Ensure Service Workers are correctly served and configured on the hosting platform.

## 10. Future Development / Roadmap
    - (Link to TODO.md or high-level future plans)

This project adheres to the instructions in `AGENTS.md` where applicable.
Please ensure any contributions also follow these guidelines.
