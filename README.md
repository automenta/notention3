# Notention

A lightweight, client-side Progressive Web App (PWA) for decentralized note-taking and network matching. It enables users to capture, organize, and share notes with embedded semantic structure (tags, values, fields, templates) within freeform text, using a user-editable, shareable ontology to drive structured organization and semantic matching. The Nostr protocol powers secure, peer-to-peer collaboration, allowing users to publish notes and discover related content across a decentralized network. Core functionality requires no language model, ensuring accessibility, while an optional local language model enhances ontology suggestions, auto-tagging, and summarization. Netention prioritizes privacy with local-first storage, end-to-end encryption, and minimal dependencies, targeting universal adoption on web and mobile devices.

## Features

### Instant Messaging
- Using secure Nostr Direct Messages (DM)
- Buddy list
- Discussions
- User Profiles
- Account creation wizard

### Note-Taking with Semantic Structure
- **Rich Text Editor**:
  - Powered by Tiptap for extensible editing.
  - Supports bold, italic, bulleted/numbered lists, and hyperlinks.
  - Markdown-like syntax (e.g., `*text*` for italic).
  - Semantic elements:
    - **Tags**: Inline `#Topic` or `@Person`, linked to ontology, inserted via autocomplete or toolbar.
    - **Values**: Key-value pairs (e.g., `due::2025-06-01`) for metadata, added inline or via sidebar.
    - **Fields**: Template-defined fields (e.g., `Status: In Progress`), editable in sidebar.
    - **Templates**: Predefined note structures (e.g., “Meeting Note” with `Date`, `Attendees`), applied via dropdown.
  - Insertion interface:
    - Autocomplete on `#` or `@` with ontology-based suggestions.
    - Toolbar for inserting tags, values, fields, or templates.
    - Sidebar form for metadata editing with real-time editor preview.
- **Active Notes**:
  - Notes include metadata: UUID `id`, `title`, `content`, `tags`, `values`, `fields`, `status` (draft/published), `createdAt`, `updatedAt`.
  - Operations: create, edit, delete, archive, pin.
  - Search: full-text with filters for tags, values, fields, using ontology relationships (e.g., `#NLP` finds `#AI` notes).
- **Organization**:
  - Hierarchical folders for grouping notes.
  - Ontology-linked tags for categorization.
  - List view, sortable by title, date, or tags.
- **Persistence**:
  - Stored locally in IndexedDB via localforage.
  - Export/import notes as JSON for backups or migration.

### Ontology System
- **Definition**:
  - User-editable taxonomy of concepts and relationships (e.g., `#AI > #MachineLearning > #NLP`), stored as a JSON tree.
  - Concepts have `label` (e.g., `#Project`) and optional `attributes` (e.g., `due::date`).
  - Relationships include parent-child links (e.g., `#NLP` under `#AI`).
  - Loose, tolerating fuzzy/partial matching and vague/missing data
- **Interface**:
  - Drag-and-drop tree editor for concepts and hierarchies.
  - Form for defining concept attributes (e.g., `type: date`).
  - Accessible via “Ontology” sidebar tab.
- **Role**:
  - Links tags, values, fields to concepts for semantic consistency.
  - Enables semantic search (e.g., `#NLP` matches `#AI` notes).
  - Drives network matching via relationship traversal (e.g., `#NLP` matches `#AI` on Nostr).
- **Persistence and Sharing**:
  - Stored in IndexedDB.
  - Shareable via Nostr as public or private events; importable by other users.

### Network Matching
- **Nostr Integration**:
  - Publish notes as public Nostr events or encrypted private shares (NIP-04).
  - User identity via locally stored Nostr keypair, generated during onboarding.
  - Topic-based channels (e.g., `#Notes`) for sharing and discovery.
  - Accessible via “Network” sidebar tab.
- **Ontology-Based Matching**:
  - Matches notes by shared tags/values and ontology relationships.
  - Example: `#NLP` note matches public `#AI` or `#MachineLearning` notes.
  - Uses client-side graph traversal for matching.
  - Matches shown in “Matches” panel with links to view notes or contact authors.
- **Privacy Controls**:
  - Users choose which notes, tags, or values to share (public, private, none).
  - UI indicators (e.g., “Public” badge on shared notes).
- **Notifications**:
  - Real-time alerts for matches or channel activity in a notification bar.

### AI Enhancements (Optional)

Notention can leverage local or cloud-based AI models to provide intelligent features. This is entirely optional and the application is fully functional without it.

- **Integration**: Uses LangChain.js to connect with AI providers like a local Ollama instance or Google Gemini.
- **Enabling AI**:
  - Navigate to `Settings > AI Features`.
  - Toggle "Enable AI" on.
- **Configuration**:
  - **Ollama**:
    - Install Ollama on your local machine by following the instructions at [https://ollama.com](https://ollama.com).
    - Once Ollama is running (e.g., `ollama serve`), ensure you have pulled a model (e.g., `ollama pull llama3`).
    - In Notention's AI settings, enter your Ollama API endpoint (e.g., `http://localhost:11434`).
  - **Google Gemini**:
    - Obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    - In Notention's AI settings, enter your Gemini API Key.
  - *Note*: You can configure one or both. The application may prioritize Gemini if both are available, unless otherwise specified.
- **Features**:
  - **Ontology Suggestions**: In the Ontology Editor, use the "AI Suggest" button to get ideas for new concepts or relationships based on your existing ontology and optional context you provide.
  - **Auto-tagging**: While editing a note, use the "Auto-tag" button in the toolbar to let AI suggest relevant tags based on the note's content and your ontology.
  - **Summarization**: Use the "Summarize" button in the Note Editor toolbar to generate a concise summary of the current note. The summary can be reviewed and optionally inserted into the note.
  - **Embedding Vectors (Future)**: Future updates will explore using embedding vectors for enhanced semantic search and network matching.
- **Fallback**: If AI is not enabled or configured, these features will be unavailable, but the application remains fully functional for manual note-taking and organization.
- **Sharing AI Results**: Users with AI support can share usable results (e.g., AI-assisted tags on a published note) with other users, even those not using AI features.

### Client-Side PWA
- **Offline-First**:
  - Service Workers cache assets for offline use.
  - Notes and ontology saved locally, synced to Nostr when online.
- **User Interface**:
  - Layout: single-column (mobile), two-column (desktop, editor + sidebar).
  - Components:
    - Tiptap-based note editor with toolbar and autocomplete.
    - Sidebar tabs: Notes (list, search), Ontology (tree editor), Network (matches, channels), Settings.
    - Notification bar for alerts.
  - Styling: custom CSS with light/dark themes.
- **Installation**:
  - Installable as PWA via browser prompts on web and mobile.
- **Syncing**:
  - Notes and ontology synced to Nostr relays as events.
  - Timestamps for conflict-free versioning.

### Privacy and Security
- **Local Storage**: Notes and ontology in IndexedDB via localforage.
- **Encryption**: Private Nostr shares encrypted with NIP-04 (secp256k1).
- **Sanitization**: DOMPurify prevents XSS in rich text.
- **Data Sharing**:
  - Only explicitly shared data sent to Nostr.
  - Granular UI controls (e.g., “Share Tags” toggle).
- **Key Management**: Nostr keypair stored locally with backup prompt.

## Architecture

### System Components
- **Frontend**:
  - Framework: TypeScript, React.
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
    status: "draft" | "published";
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
- Component-based React for modular UI.
- Centralized state with Zustand.
- Service-oriented logic abstraction.
- Offline-first with local storage and lazy Nostr syncing.
- Modular AI layer, disabled by default.

## Implementation Details

### Technology Stack
- **Frontend**: TypeScript, React, Zustand, Tiptap, Vite.
- **Persistence**: localforage (IndexedDB).
- **Networking**: nostr-tools.
- **Security**: DOMPurify.
- **AI (Optional)**: LangChain, Ollama.
- **Testing**: Vitest.

### Styling
- Custom CSS for editor, sidebar, buttons, inputs, lists, notifications.
- Flexbox layout, minimal typography, 5 primary colors, light/dark themes.
- Example:
  ```css
  body { font-family: Arial, sans-serif; margin: 0; }
  .editor { padding: 16px; border: 1px solid #ccc; }
  .tag { background: #e0f7fa; padding: 2px 8px; border-radius: 4px; }
  .sidebar { width: 280px; border-left: 1px solid #eee; padding: 8px; }
  .button { background: #007bff; color: white; padding: 8px; border-radius: 4px; }
  ```

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
