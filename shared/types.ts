// Core data models for Notention
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  values: { [key: string]: string };
  fields: { [key: string]: string };
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
  folderId?: string;
  pinned?: boolean;
  archived?: boolean;
  isSharedPublicly?: boolean; // Indicates if the note has been published publicly to Nostr
  embedding?: number[]; // Optional embedding vector for semantic search/matching
  nostrSyncEventId?: string; // ID of the Nostr event used for syncing this note (Kind 4)
}

export interface OntologyNode {
  id: string;
  label: string;
  attributes?: { [key: string]: string };
  parentId?: string;
  children?: string[];
}

export interface OntologyTree {
  nodes: { [id: string]: OntologyNode };
  rootIds: string[];
  updatedAt?: Date; // Added for sync purposes
}

export interface UserProfile {
  nostrPubkey: string;
  nostrPrivkey?: string; // stored locally for convenience
  sharedTags: string[];
  sharedValues?: string[];
  preferences: {
    theme: "light" | "dark" | "system";
    aiEnabled: boolean;
    defaultNoteStatus: "draft" | "published";
    ollamaApiEndpoint?: string;
    ollamaEmbeddingModel?: string; // e.g., 'nomic-embed-text', 'mxbai-embed-large'
    ollamaChatModel?: string; // e.g., 'llama3', 'mistral'
    geminiApiKey?: string;
    geminiEmbeddingModel?: string; // e.g., 'embedding-001', 'text-embedding-004'
    geminiChatModel?: string; // e.g., 'gemini-pro', 'gemini-1.5-flash'
    aiProviderPreference?: 'ollama' | 'gemini'; // User preference for which provider to use if both configured
  };
  nostrRelays?: string[]; // User's preferred relays
  privacySettings?: {
    sharePublicNotesGlobally: boolean; // A master switch for all public sharing
    shareTagsWithPublicNotes: boolean;
    shareValuesWithPublicNotes: boolean;
    // More granular settings could be added, e.g., per note or per contact
  };
  contacts?: Contact[]; // Optional list of contacts
}

export interface Contact {
  pubkey: string;
  alias?: string;
  lastContact?: Date; // Timestamp of last interaction, useful for sorting
  // Could add other metadata like petname, relay hints, etc.
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  children?: string[];
  noteIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Match {
  id: string;
  targetNoteId: string;
  targetAuthor: string;
  similarity: number;
  sharedTags: string[];
  sharedValues: string[];
  timestamp: Date;
  localNoteId?: string; // ID of the local note if it's an embedding match against local data
  matchType?: 'nostr' | 'embedding'; // To differentiate match origins
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface DirectMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  encrypted: boolean;
}

export interface NotentionTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  defaultTags: string[];
  defaultValues: { [key: string]: string };
}

export interface TemplateField {
  name: string;
  type: "text" | "number" | "date" | "select" | "multiselect";
  required: boolean;
  options?: string[]; // for select/multiselect
  defaultValue?: string;
}

export interface SearchFilters {
  tags?: string[];
  values?: { [key: string]: string };
  fields?: { [key: string]: string };
  status?: "draft" | "published";
  folderId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface AppState {
  // Core state
  notes: { [id: string]: Note };
  ontology: OntologyTree;
  userProfile?: UserProfile;
  folders: { [id: string]: Folder };
  templates: { [id: string]: NotentionTemplate };
  
  // UI state
  currentNoteId?: string;
  sidebarTab: "notes" | "ontology" | "network" | "settings" | "contacts"; // Added 'contacts'
  searchQuery: string;
  searchFilters: SearchFilters;
  
  // Network state
  matches: Match[];
  directMessages: DirectMessage[];
  nostrRelays: string[];
  connected: boolean;
  
  // Editor state
  editorContent: string;
  isEditing: boolean;
  
  // Loading states
  loading: {
    notes: boolean;
    ontology: boolean;
    network: boolean;
  };
  
  // Error states
  errors: {
    notes?: string;
    ontology?: string;
    network?: string;
  };
}