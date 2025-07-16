# Developer Guide

## Architecture

### System Components

- **Frontend**:
  - Framework: TypeScript, Web Components.
  - State Management: Zustand.
  - Components:
    - NoteEditor: Tiptap-based with toolbar/autocomplete.
    - NoteList: List view with search, filters, and special views (ex: Buddy List view).
    - OntologyEditor: Text editor, drag-and-drop tree.
    - NetworkPanel: Matches and channels, connectivity
    - Settings: Preferences, User Profile, AI, and sharing options.
  - Styling: Custom CSS.
- **Services**:
  - NoteService: Note CRUD, search, metadata.
  - OntologyService: Ontology creation, traversal, matching.
  - NostrService: Event publishing/receiving.
  - DBService: localforage wrapper.
- **AI (Optional)**:
  - LangChain and Ollama for enhancements.
- **Networking**:
  - nostr-tools for Nostr.
  - Service Workers for offline caching.

### Data Model

- **Note**:
  ```typescript
  interface Note {
  	id: string;
  	title: string;
  	content: string;
  	tags: string[];
  	values: { [key: string]: string };
  	fields: { [key: string]: string };
  	status: 'draft' | 'published';
  	createdAt: Date;
  	updatedAt: Date;
  }
  ```
- **Ontology**:
  ```typescript
  interface OntologyNode {
  	id: string;
  	label: string;
  	attributes?: { [key: string]: string };
  	parentId?: string;
  }
  ```
- **User Profile**:
  ```typescript
  interface UserProfile {
  	nostrPubkey: string;
  	sharedTags: string[];
  	sharedValues?: string[];
  }
  ```

### Architectural Patterns

- Component-based architecture for modular UI.
- Centralized state with Zustand.
- Service-oriented logic abstraction.
- Offline-first with local storage and lazy Nostr syncing.
- Modular AI layer, disabled by default.

## Implementation Details

### Example Workflow

1. **Create Note**:
   - Type title and content in editor.
   - Insert `#NLP` via autocomplete (ontology suggests `#AI`).
   - Add `due::2025-06-01` inline or via sidebar.
   - Apply “Meeting Note” template for `Attendees`, `Action Items`.
   - Save as draft.
2. **Organize**:
   - Move to “Projects” folder.
   - Search `#AI` to find related notes (includes `#NLP`).
3. **Share**:
   - Publish to `#Notes` channel on Nostr.
   - Share privately with `@Bob` (encrypted).
4. **Match**:
   - View “Matches” panel for `#AI` or `#MachineLearning` notes.
   - Get notified of new `#AI` note.
5. **Optional AI**:
   - Enable Ollama in settings.
   - AI suggests `#DeepLearning` for ontology.
   - Auto-tags note with `#MachineLearning`.

### Development Guidelines

- Modular services and components.
- Vitest unit tests for services and UI.
- Latest TypeScript and library versions.
- Compact, deduplicated code with clear naming.

### Deployment

- Host on static CDN (e.g., Vercel) with Service Workers.
- Connect to public Nostr relays (e.g., wss://relay.damus.io); guide for user-run relays.
- Provide Ollama setup instructions for AI features.

## 1. Introduction

    - Project Overview and Goals
    - Technology Stack (TypeScript, WebComponents, Vite, Zustand, Nostr, Tiptap, LocalForage)

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

### Styling

- Custom CSS for editor, sidebar, buttons, inputs, lists, notifications.
- Flexbox layout, minimal typography, 5 primary colors, light/dark themes.
- Example:
  ```css
  body {
  	font-family: Arial, sans-serif;
  	margin: 0;
  }
  .editor {
  	padding: 16px;
  	border: 1px solid #ccc;
  }
  .tag {
  	background: #e0f7fa;
  	padding: 2px 8px;
  	border-radius: 4px;
  }
  .sidebar {
  	width: 280px;
  	border-left: 1px solid #eee;
  	padding: 8px;
  }
  .button {
  	background: #007bff;
  	color: white;
  	padding: 8px;
  	border-radius: 4px;
  }
  ```
