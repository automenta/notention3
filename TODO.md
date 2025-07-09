# Notention Development Plan

This development plan organizes the Notention specification into implementation phases, prioritizing modularity, privacy, and core functionality before optional enhancements. Each phase focuses on delivering functional components, building incrementally toward the full Progressive Web App (PWA).

## Phase 1: Core Setup and Infrastructure
- **Objective**: Establish the foundation for the client-side PWA with essential tooling and architecture.
- **Tasks**:
  - Set up TypeScript, React, and Vite for the frontend.
  - Configure Zustand for state management.
  - Initialize localforage for IndexedDB storage (DBService).
  - Implement Service Workers for offline-first caching.
  - Define data models for `Note`, `OntologyNode`, and `UserProfile`.
  - Create basic UI layout: single-column (mobile), two-column (desktop) with sidebar placeholder.
  - Apply custom CSS with Flexbox, 5 primary colors, and light/dark themes.
  - Set up Vitest for unit testing.
  - Configure static CDN deployment (e.g., Vercel).

## Phase 2: Note-Taking and Rich Text Editor
- **Objective**: Build the core note-taking functionality with semantic structure.
- **Tasks**:
  - Integrate Tiptap for the rich text editor (NoteEditor component).
  - Support bold, italic, lists, hyperlinks, and Markdown-like syntax.
  - Implement semantic elements:
    - Inline tags (`#Topic`, `@Person`) with autocomplete on `#` or `@`.
    - Key-value pairs (`due::2025-06-01`) via inline or sidebar.
    - Template-defined fields (e.g., `Status: In Progress`) in sidebar.
    - Template dropdown for predefined structures (e.g., “Meeting Note”).
  - Develop NoteService for CRUD operations (create, edit, delete, archive, pin).
  - Implement note metadata: UUID, title, content, tags, values, fields, status, timestamps.
  - Create sidebar NoteList component with list view, sortable by title, date, or tags.
  - Enable local storage of notes via localforage.
  - Add DOMPurify for XSS sanitization in the editor.

## Phase 3: Ontology System
- **Objective**: Develop the user-editable ontology for semantic organization.
- **Tasks**:
  - Implement OntologyService for creating and managing JSON-based taxonomy.
  - Support concepts (`label`, `attributes`) and parent-child relationships.
  - Build OntologyEditor component:
    - Drag-and-drop tree editor for concepts and hierarchies.
    - Form for defining concept attributes (e.g., `type: date`).
  - Integrate ontology with NoteEditor for tag and value suggestions via autocomplete.
  - Enable semantic search using ontology relationships (e.g., `#NLP` finds `#AI` notes).
  - Store ontology in IndexedDB via localforage.
  - Add export/import for ontology as JSON.

## Phase 4: Organization and Search
- **Objective**: Enhance note organization and retrieval.
- **Tasks**:
  - Implement hierarchical folders for grouping notes in NoteList.
  - Enable ontology-linked tag categorization.
  - Develop full-text search with filters for tags, values, and fields.
  - Enhance NoteService to support search queries with ontology traversal.
  - Update NoteList UI to reflect folders, tags, and search results.
  - Test search accuracy for ontology-based relationships (e.g., `#NLP` matches `#AI`).

## Phase 5: Nostr Integration and Network Matching
- **Objective**: Enable decentralized collaboration and matching via Nostr.
- **Tasks**:
  - Integrate nostr-tools for NostrService (event publishing/receiving).
  - Implement user identity with locally stored Nostr keypair (generated during onboarding).
  - Support publishing notes as public Nostr events or encrypted private shares (NIP-04).
  - Create topic-based channels (e.g., `#Notes`) for sharing and discovery.
  - Build NetworkPanel component:
    - Display matches based on shared tags/values and ontology relationships.
    - Show links to view matched notes or contact authors.
  - Implement client-side graph traversal for ontology-based matching.
  - Add privacy controls: UI toggles for sharing notes, tags, or values.
  - Display “Public” badges on shared notes.
  - Store Nostr keypair securely with backup prompt.

## Phase 6: Instant Messaging and User Profiles
- **Objective**: Add secure messaging and user management features.
- **Tasks**:
  - Implement Nostr Direct Messages (DM) for secure instant messaging.
  - Build buddy list and discussion views in NoteList (special views).
  - Create UserProfile component for viewing and editing profiles (`nostrPubkey`, `sharedTags`, `sharedValues`).
  - Develop account creation wizard to guide keypair generation and profile setup.
  - Add notification bar for real-time DM and channel activity alerts.
  - Ensure NIP-04 encryption for private DMs.

## Phase 7: AI Enhancements (Optional)
- **Objective**: Integrate optional local language model for ontology and note enhancements.
- **Tasks**:
  - Add settings toggle for enabling Ollama/Google Gemini integration.
  - Integrate LangChain.js for AI features.
  - Implement AI-driven features:
    - Ontology suggestions (e.g., propose `#DeepLearning` for `#AI`).
    - Auto-tagging with ontology-aligned tags.
    - Summarization for concise note summaries.
    - Embedding vectors for alternative matching.
  - Ensure fallback: manual ontology/tags without AI; no summarization.
  - Provide user instructions for installing Ollama locally.
  - Enable sharing of AI-generated results with other users.

## Phase 8: PWA Features and Syncing
- **Objective**: Finalize PWA functionality and Nostr syncing.
- **Tasks**:
  - Enhance Service Workers for robust offline support.
  - Implement PWA installability via browser prompts.
  - Develop syncing logic:
    - Notes and ontology synced to Nostr relays as events.
    - Timestamps for conflict-free versioning.
  - Test offline note creation/editing and online sync.
  - Connect to public Nostr relays (e.g., wss://relay.damus.io).
  - Provide guide for user-run relays.

## Phase 9: Testing and Polish
- **Objective**: Ensure quality, accessibility, and usability.
- **Tasks**:
  - Write Vitest unit tests for services (NoteService, OntologyService, NostrService) and UI components.
  - Test edge cases: fuzzy ontology matching, offline/online transitions, large note sets.
  - Optimize performance for low-end devices.
  - Ensure accessibility (e.g., keyboard navigation, screen reader support).
  - Polish UI: refine typography, button styles, and sidebar transitions.
  - Validate encryption (NIP-04) and XSS prevention (DOMPurify).

## Phase 10: Deployment and Documentation
- **Objective**: Launch the PWA and support users.
- **Tasks**:
  - Deploy to static CDN with Service Workers enabled.
  - Write user documentation: onboarding, note-taking, ontology, Nostr, AI setup.
  - Provide developer documentation: architecture, services, components.
  - Publish guide for connecting to Nostr relays and running local Ollama.
  - Announce availability on web and mobile via browser PWA prompts.

## Remaining Work for Future Iteration
- **AI Enhancements**:
    - Integrate existing AI embedding vector generation (from `AIService.ts`) into the note matching logic. This includes how embeddings are stored/retrieved with notes (locally and potentially via Nostr) and how they are compared for similarity.
- **Testing**:
    - Write comprehensive UI component tests using Vitest and `@testing-library/react` for currently untested or minimally tested components (e.g., `NoteEditor.tsx`, `OntologyEditor.tsx` (beyond basic DnD), `NotesList.tsx` (interactions), `SettingsPanel.tsx` (detailed functionality)).
    - Expand Playwright E2E test coverage for more key user flows (e.g., ontology manipulation, Nostr publishing/DMing, AI feature usage, contact management).
    - Investigate and resolve Vitest execution timeouts in the development/testing environment to enable reliable local and CI test runs.
    - Complete and expand unit test coverage for `AIService.ts` (mocking LangChain components effectively) and ensure high coverage for other services/store, focusing on complex interactions and edge cases.
- **Performance**:
    - Profile application for performance bottlenecks on low-end devices, particularly with large numbers of notes, complex ontologies, or frequent Nostr activity.
