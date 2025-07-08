import { create, StoreApi, UseBoundStore } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Note, OntologyTree, UserProfile, Folder, NotentionTemplate, SearchFilters, Match, DirectMessage, NostrEvent } from '../../shared/types';
import { DBService } from '../services/db';
import { FolderService } from '../services/FolderService';
import { NoteService } from '../services/NoteService';
import { nostrService, NostrService } from '../services/NostrService'; // Import NostrService
import { Filter } from 'nostr-tools';


interface AppActions {
  // Initialization
  initializeApp: () => Promise<void>;
  
  // Notes actions
  createNote: (partialNote?: Partial<Note>) => Promise<string>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (id: string | undefined) => void;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  moveNoteToFolder: (noteId: string, folderId: string | undefined) => Promise<void>;
  
  // Ontology actions
  setOntology: (ontology: OntologyTree) => Promise<void>;
  
  // User profile actions
  updateUserProfile: (profileUpdates: Partial<UserProfile>) => Promise<void>; // Allow partial updates
  generateAndStoreNostrKeys: (privateKey?: string, publicKey?: string) => Promise<string | null>; // Added optional keys
  logoutFromNostr: () => Promise<void>;

  // Folders actions
  createFolder: (name: string, parentId?: string) => Promise<string | undefined>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  
  // Templates actions
  createTemplate: (templateData: Omit<NotentionTemplate, 'id'>) => Promise<string>;
  updateTemplate: (id: string, updates: Partial<NotentionTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  // UI actions
  setSidebarTab: (tab: AppState['sidebarTab']) => void;
  setEditorContent: (content: string) => void;
  setIsEditing: (editing: boolean) => void;
  
  // Loading and error actions
  setLoading: (key: keyof AppState['loading'], loading: boolean) => void;
  setError: (key: keyof AppState['errors'], error: string | undefined) => void;

  // Nostr specific actions
  initializeNostr: () => Promise<void>; // Renamed from initializeNostrService
  setNostrConnected: (status: boolean) => void; // Renamed from connected for clarity
  publishCurrentNoteToNostr: (options: {
    encrypt?: boolean;
    recipientPk?: string;
    relays?: string[];
  }) => Promise<void>;
  subscribeToPublicNotes: (relays?: string[]) => string | null; // Returns subscription ID or null
  subscribeToTopic: (topic: string, relays?: string[]) => string | null; // Returns subscription ID
  unsubscribeFromNostr: (subscriptionId: string | any) => void; // Accepts ID or subscription object
  addNostrMatch: (match: Match) => void;
  addDirectMessage: (message: DirectMessage) => void;
  setNostrRelays: (relays: string[]) => Promise<void>;
  addNostrRelay: (relay: string) => Promise<void>;
  removeNostrRelay: (relay: string) => Promise<void>;
  handleIncomingNostrEvent: (event: NostrEvent) => void; // Central handler for events

  // DM specific actions
  sendDirectMessage: (recipientPk: string, content: string) => Promise<void>;
  subscribeToDirectMessages: (relays?: string[]) => string | null; // Returns subscription ID

  // Topic subscription actions
  addTopicSubscription: (topic: string, subscriptionId: string) => void;
  removeTopicSubscription: (topic: string) => void;
  addNoteToTopic: (topic: string, note: NostrEvent) => void;
}

type AppStore = AppState & AppActions;

// Define a type for the Nostr subscription store
type NostrSubscriptionStore = {
  [id: string]: any; // nostr-tools subscription object
};


export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  notes: {},
  ontology: { nodes: {}, rootIds: [] },
  userProfile: undefined, // Will be populated during initializeApp or initializeNostr
  folders: {},
  templates: {},
  
  currentNoteId: undefined,
  sidebarTab: 'notes',
  searchQuery: '',
  searchFilters: {},
  
  matches: [],
  directMessages: [],
  // Default relays, user can override via settings
  nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social'], // This will be synced with userProfile.nostrRelays
  nostrConnected: false, // Explicitly for Nostr connection status
  activeNostrSubscriptions: {} as NostrSubscriptionStore, // General subscriptions like public notes, DMs

  // New state for topic-specific subscriptions and notes
  activeTopicSubscriptions: {}, // Maps topic string to its specific subscription ID
  topicNotes: {}, // Maps topic string to an array of NostrEvent
  
  editorContent: '',
  isEditing: false,
  
  loading: {
    notes: false,
    ontology: false,
    network: false,
  },
  
  errors: {},

  // Actions
  initializeApp: async () => {
    const state = get();
    
    try {
      // Load all data from IndexedDB
      state.setLoading('notes', true);
      state.setLoading('ontology', true);
      
      // Load notes
      const notes = await NoteService.getNotes(); // Use NoteService
      const notesMap: { [id: string]: Note } = {};
      notes.forEach(note => notesMap[note.id] = note);
      
      let ontologyData = await DBService.getOntology();
      if (!ontologyData) {
        ontologyData = await DBService.getDefaultOntology();
        await DBService.saveOntology(ontologyData);
      }
      
      // User Profile and Relays Initialization
      let userProfileData = await DBService.getUserProfile();
      const defaultRelays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social'];
      let relaysToUseInStore = defaultRelays;

      if (!userProfileData) {
        userProfileData = {
          nostrPubkey: '',
          sharedTags: [],
          preferences: { theme: 'system', aiEnabled: false, defaultNoteStatus: 'draft' },
          nostrRelays: defaultRelays,
          privacySettings: { // Add default privacy settings
            sharePublicNotesGlobally: false,
            shareTagsWithPublicNotes: true,
            shareValuesWithPublicNotes: true,
          }
        };
      } else {
        if (!userProfileData.nostrRelays || userProfileData.nostrRelays.length === 0) {
          userProfileData.nostrRelays = defaultRelays;
        }
        if (!userProfileData.privacySettings) { // Ensure existing profiles get defaults
          userProfileData.privacySettings = {
            sharePublicNotesGlobally: false,
            shareTagsWithPublicNotes: true,
            shareValuesWithPublicNotes: true,
          };
        }
        relaysToUseInStore = userProfileData.nostrRelays;
      }
      
      const folders = await FolderService.getAllFolders(); // Use FolderService
      const foldersMap: { [id: string]: Folder } = {};
      folders.forEach(folder => foldersMap[folder.id] = folder);
      
      let templates = await DBService.getAllTemplates(); // This can remain DBService for now
      if (templates.length === 0) {
        const defaultTemplates = await DBService.getDefaultTemplates();
        for (const template of defaultTemplates) {
          await DBService.saveTemplate(template);
        }
        templates = defaultTemplates;
      }
      const templatesMap: { [id: string]: NotentionTemplate } = {};
      templates.forEach(template => {
        templatesMap[template.id] = template;
      });
      
      set({
        notes: notesMap,
        ontology: ontologyData,
        userProfile: userProfileData, // userProfileData is now guaranteed to exist with at least default relays
        folders: foldersMap,
        templates: templatesMap,
        nostrRelays: relaysToUseInStore, // Set top-level nostrRelays from profile or defaults
      });

      // Initialize Nostr service (loads keys, potentially updates profile with pubkey)
      await get().initializeNostr();
      
    } catch (error: any) {
      console.error('Failed to initialize app:', error);
      (get() as AppStore).setError('notes', `Failed to load data: ${error.message}`);
    } finally {
      (get() as AppStore).setLoading('notes', false);
      (get() as AppStore).setLoading('ontology', false);
    }
  },

  createNote: async (partialNote?: Partial<Note>) => {
    const newNote = await NoteService.createNote(partialNote || {});
    set(state => ({
      notes: { ...state.notes, [newNote.id]: newNote },
      currentNoteId: newNote.id,
      editorContent: newNote.content,
      isEditing: true,
    }));
    return newNote.id;
  },

  updateNote: async (id: string, updates: Partial<Note>) => {
    const updatedNote = await NoteService.updateNote(id, updates);
    if (updatedNote) {
      set(state => ({
        notes: { ...state.notes, [id]: updatedNote },
        // If current note is updated, update editor content if it's different
        ...(state.currentNoteId === id && state.editorContent !== updatedNote.content && { editorContent: updatedNote.content }),
      }));
    }
  },

  deleteNote: async (id: string) => {
    const state = get();
    const noteToDelete = state.notes[id];

    await NoteService.deleteNote(id);
    
    // If note was in a folder, remove it from folder's noteIds
    if (noteToDelete && noteToDelete.folderId) {
      const folder = state.folders[noteToDelete.folderId];
      if (folder) {
        const updatedFolder = {
          ...folder,
          noteIds: folder.noteIds.filter(noteId => noteId !== id),
          updatedAt: new Date()
        };
        await FolderService.updateFolder(folder.id, { noteIds: updatedFolder.noteIds }); // Persist only changed field
        set(s => ({
          folders: { ...s.folders, [folder.id]: updatedFolder }
        }));
      }
    }

    set(s => {
      const newNotes = { ...s.notes };
      delete newNotes[id];
      return {
        notes: newNotes,
        currentNoteId: s.currentNoteId === id ? undefined : s.currentNoteId,
      };
    });
  },

  moveNoteToFolder: async (noteId: string, folderId: string | undefined) => {
    const state = get();
    const note = state.notes[noteId];
    if (!note) return;

    const oldFolderId = note.folderId;

    // Update note's folderId
    const updatedNote = await NoteService.updateNote(noteId, { folderId });
    if (!updatedNote) return; // Should not happen if note exists

    let newFoldersState = { ...state.folders };

    // Remove from old folder's noteIds
    if (oldFolderId) {
      const oldFolder = state.folders[oldFolderId];
      if (oldFolder) {
        const updatedOldFolder = {
          ...oldFolder,
          noteIds: oldFolder.noteIds.filter(id => id !== noteId),
          updatedAt: new Date(),
        };
        await FolderService.updateFolder(oldFolderId, { noteIds: updatedOldFolder.noteIds });
        newFoldersState = { ...newFoldersState, [oldFolderId]: updatedOldFolder };
      }
    }

    // Add to new folder's noteIds
    if (folderId) {
      const newFolder = state.folders[folderId];
      if (newFolder) {
        const updatedNewFolder = {
          ...newFolder,
          noteIds: [...new Set([...newFolder.noteIds, noteId])], // Avoid duplicates
          updatedAt: new Date(),
        };
        await FolderService.updateFolder(folderId, { noteIds: updatedNewFolder.noteIds });
        newFoldersState = { ...newFoldersState, [folderId]: updatedNewFolder };
      }
    }

    set(s => ({
      notes: { ...s.notes, [noteId]: updatedNote },
      folders: newFoldersState,
    }));
  },


  setCurrentNote: (id: string | undefined) => {
    const state = get();
    const note = id ? state.notes[id] : undefined;
    set({
      currentNoteId: id,
      editorContent: note?.content || '',
      isEditing: !!id, // Automatically enter editing mode when a note is selected
      // searchQuery: '', // Optionally clear search on note selection
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSearchFilters: (filters: Partial<SearchFilters>) => {
    set(state => ({ searchFilters: { ...state.searchFilters, ...filters } }));
  },

  setOntology: async (ontology: OntologyTree) => {
    await DBService.saveOntology(ontology); // Persist
    set({ ontology }); // Update store
  },

  updateUserProfile: async (profile: UserProfile) => {
    await DBService.saveUserProfile(profile);
    set({ userProfile: profile });
  },

  createFolder: async (name: string, parentId?: string) => {
    try {
      const newFolder = await FolderService.createFolder(name, parentId);
      set(state => ({
        folders: { ...state.folders, [newFolder.id]: newFolder },
      }));
      // If parentId, update parent in store as well
      if (parentId && get().folders[parentId]) {
        const parentFolder = get().folders[parentId];
        const updatedParent = {
            ...parentFolder,
            children: [...(parentFolder.children || []), newFolder.id],
            updatedAt: new Date()
        };
        set(state => ({
            folders: { ...state.folders, [parentId]: updatedParent}
        }))
      }
      return newFolder.id;
    } catch (error) {
      console.error("Failed to create folder:", error);
      (get() as AppStore).setError('notes', `Failed to create folder: ${(error as Error).message}`);
      return undefined;
    }
  },

  },

  updateFolder: async (id: string, updates: Partial<Folder>) => {
    const state = get();
    const oldFolder = state.folders[id];
    if (!oldFolder) return;

    const updatedFolder = await FolderService.updateFolder(id, updates);
    if (updatedFolder) {
      let newFoldersState = { ...state.folders, [id]: updatedFolder };

      // Handle parent change logic for store state
      const oldParentId = oldFolder.parentId;
      const newParentId = updatedFolder.parentId;

      if (newParentId !== oldParentId) {
        // Remove from old parent's children in store
        if (oldParentId && newFoldersState[oldParentId]) {
          const oldParent = newFoldersState[oldParentId];
          newFoldersState[oldParentId] = {
            ...oldParent,
            children: (oldParent.children || []).filter(childId => childId !== id),
            updatedAt: new Date(),
          };
        }
        // Add to new parent's children in store
        if (newParentId && newFoldersState[newParentId]) {
          const newParent = newFoldersState[newParentId];
          newFoldersState[newParentId] = {
            ...newParent,
            children: [...new Set([...(newParent.children || []), id])],
            updatedAt: new Date(),
          };
        }
      }
      set({ folders: newFoldersState });
    }
  },

  deleteFolder: async (id: string) => {
    const state = get();
    const folderToDelete = state.folders[id];
    if (!folderToDelete) return;

    // Create a flat map of all folders for FolderService to use
    const allFoldersMap = { ...state.folders };

    await FolderService.deleteFolder(id, allFoldersMap); // This handles DB updates

    // Update store state based on what FolderService did (could be complex)
    // For simplicity, re-fetch or derive new state. Here we manually update.
    const newFolders = { ...state.folders };
    const notesToUpdate = { ...state.notes };

    // Collect all child folder IDs to delete from store state
    const folderIdsToDelete: string[] = [id];
    const collectChildren = (folderId: string) => {
        const children = newFolders[folderId]?.children;
        if (children) {
            children.forEach(childId => {
                folderIdsToDelete.push(childId);
                collectChildren(childId);
            });
        }
    };
    collectChildren(id);

    folderIdsToDelete.forEach(fid => delete newFolders[fid]);
    
    // Unassign notes from deleted folders in the store
    Object.values(state.notes).forEach(note => {
      if (note.folderId && folderIdsToDelete.includes(note.folderId)) {
        notesToUpdate[note.id] = { ...note, folderId: undefined, updatedAt: new Date() };
      }
    });

    // Remove from parent's children list in store state
    if (folderToDelete.parentId && newFolders[folderToDelete.parentId]) {
        const parentFolder = newFolders[folderToDelete.parentId];
        newFolders[folderToDelete.parentId] = {
            ...parentFolder,
            children: (parentFolder.children || []).filter(childId => childId !== id),
            updatedAt: new Date()
        };
    }

    set({ folders: newFolders, notes: notesToUpdate });
  },

  createTemplate: async (templateData: Omit<NotentionTemplate, 'id'>) => { // Ensure param name matches
    const id = uuidv4();
    const template: NotentionTemplate = {
      ...templateData,
      id,
    };
    
    await DBService.saveTemplate(template);
    
    set(state => ({
      templates: { ...state.templates, [id]: template },
    }));
    
    return id;
  },

  updateTemplate: async (id: string, updates: Partial<NotentionTemplate>) => {
    const state = get();
    const existingTemplate = state.templates[id];
    if (!existingTemplate) return;
    
    const updatedTemplate: NotentionTemplate = {
      ...existingTemplate,
      ...updates,
    };
    
    await DBService.saveTemplate(updatedTemplate);
    
    set(state => ({
      templates: { ...state.templates, [id]: updatedTemplate },
    }));
  },

  deleteTemplate: async (id: string) => {
    await DBService.deleteTemplate(id);
    
    set(state => {
      const newTemplates = { ...state.templates };
      delete newTemplates[id];
      
      return { templates: newTemplates };
    });
  },

  setSidebarTab: (tab: AppState['sidebarTab']) => {
    set({ sidebarTab: tab });
  },

  setEditorContent: (content: string) => {
    set({ editorContent: content });
  },

  setIsEditing: (editing: boolean) => {
    set({ isEditing: editing });
  },

  setLoading: (key: keyof AppState['loading'], loading: boolean) => {
    set(state => ({
      loading: { ...state.loading, [key]: loading },
    }));
  },

  setError: (key: keyof AppState['errors'], error: string | undefined) => {
    set(state => ({
      errors: { ...state.errors, [key]: error },
    }));
  },

  // Nostr Actions Implementation
  initializeNostr: async () => {
    get().setLoading('network', true);
    let userProfile = get().userProfile; // Get current profile, which should be initialized by initializeApp
    const defaultRelays = get().nostrRelays; // These are the current store defaults or from initial load

    try {
      const loaded = await nostrService.loadKeyPair();
      if (loaded) {
        const pk = nostrService.getPublicKey();
        if (userProfile) {
          userProfile.nostrPubkey = pk!;
          // Ensure relays in profile are synced if they were somehow missed or if profile was minimal
          if (!userProfile.nostrRelays || userProfile.nostrRelays.length === 0) {
            userProfile.nostrRelays = defaultRelays;
          }
          await DBService.saveUserProfile(userProfile); // Save updated profile with pubkey and potentially relays
          set({ userProfile, nostrConnected: true, nostrRelays: userProfile.nostrRelays });
        } else {
          // This case should ideally not happen if initializeApp correctly creates a default profile
          const newProfile: UserProfile = {
            nostrPubkey: pk!,
            sharedTags: [],
            preferences: { theme: 'system', aiEnabled: false, defaultNoteStatus: 'draft' },
            nostrRelays: defaultRelays,
            privacySettings: { // Default privacy settings
              sharePublicNotesGlobally: false,
              shareTagsWithPublicNotes: true,
              shareValuesWithPublicNotes: true,
            }
          };
          await DBService.saveUserProfile(newProfile);
          set({ userProfile: newProfile, nostrConnected: true, nostrRelays: newProfile.nostrRelays });
        }
      } else {
        // Keys not found, ensure profile reflects this if it exists
        if (userProfile && userProfile.nostrPubkey) {
            userProfile.nostrPubkey = ''; // Clear pubkey if keys are not loaded
             if (!userProfile.privacySettings) { // Ensure privacy settings exist
                userProfile.privacySettings = { sharePublicNotesGlobally: false, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true };
            }
            await DBService.saveUserProfile(userProfile);
            set({ userProfile, nostrConnected: false });
        } else if (userProfile && !userProfile.privacySettings) {
            // Profile exists but no pubkey and no privacy settings (e.g. fresh default from initializeApp before key load attempt)
            userProfile.privacySettings = { sharePublicNotesGlobally: false, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true };
            await DBService.saveUserProfile(userProfile);
            set({ userProfile, nostrConnected: false });
        }
         else {
            set({ nostrConnected: false });
        }
      }
    } catch (error: any) {
      get().setError('network', `Failed to initialize Nostr: ${error.message}`);
      set({ nostrConnected: false });
    } finally {
      get().setLoading('network', false);
    }
  },

  setNostrConnected: (status: boolean) => {
    set({ nostrConnected: status });
  },

  generateAndStoreNostrKeys: async (providedSk?: string, providedPk?: string) => {
    get().setLoading('network', true);
    let userProfile = get().userProfile;
    const currentRelaysInStore = get().nostrRelays;
    const defaultPrivacySettings = {
        sharePublicNotesGlobally: false,
        shareTagsWithPublicNotes: true,
        shareValuesWithPublicNotes: true,
    };

    let skToStore: string;
    let pkToStore: string;

    try {
      if (providedSk && providedPk) {
        skToStore = providedSk;
        pkToStore = providedPk;
      } else {
        const { privateKey, publicKey } = nostrService.generateNewKeyPair();
        skToStore = privateKey;
        pkToStore = publicKey;
      }

      await nostrService.storeKeyPair(skToStore, pkToStore);

      if (userProfile) {
        userProfile.nostrPubkey = pkToStore;
        userProfile.nostrRelays = userProfile.nostrRelays && userProfile.nostrRelays.length > 0
            ? userProfile.nostrRelays
            : currentRelaysInStore;
        userProfile.privacySettings = userProfile.privacySettings || defaultPrivacySettings;
      } else {
        userProfile = {
          nostrPubkey: pkToStore,
          sharedTags: [],
          preferences: { theme: 'system', aiEnabled: false, defaultNoteStatus: 'draft' },
          nostrRelays: currentRelaysInStore,
          privacySettings: defaultPrivacySettings,
        };
      }

      await DBService.saveUserProfile(userProfile); // Save the updated/new profile
      set({
        userProfile,
        nostrConnected: true,
        nostrRelays: userProfile.nostrRelays // Sync store's top-level relays
      });
      get().setError('network', undefined); // Clear previous errors
      return pkToStore;
    } catch (error: any) {
      get().setError('network', `Failed to generate/store Nostr keys: ${error.message}`);
      return null;
    } finally {
      get().setLoading('network', false);
    }
  },

  logoutFromNostr: async () => {
    get().setLoading('network', true);
    try {
      // Unsubscribe all active subscriptions
      const subs = get().activeNostrSubscriptions;
      Object.values(subs).forEach(sub => nostrService.unsubscribe(sub));

      await nostrService.clearKeyPair();
      set(state => ({
        userProfile: state.userProfile ? { ...state.userProfile, nostrPubkey: '', nostrPrivkey: undefined } : undefined,
        nostrConnected: false,
        activeNostrSubscriptions: {},
        matches: [], // Clear matches on logout
        directMessages: [], // Clear DMs on logout
      }));
      get().setError('network', undefined);
    } catch (error: any) {
      get().setError('network', `Error logging out from Nostr: ${error.message}`);
    } finally {
      get().setLoading('network', false);
    }
  },

  publishCurrentNoteToNostr: async (options: {
    encrypt?: boolean;
    recipientPk?: string;
    relays?: string[];
  }) => {
    const { currentNoteId, notes, nostrRelays, userProfile } = get();
    if (!currentNoteId || !notes[currentNoteId]) {
      get().setError('network', 'No current note selected to publish.');
      return;
    }
    if (!userProfile || !userProfile.nostrPubkey || !nostrService.isLoggedIn()) {
      get().setError('network', 'Not logged in to Nostr. Please generate or load keys.');
      return;
    }

    // Ensure privacySettings are available, using defaults if somehow missing
    const privacySettings = userProfile.privacySettings || {
        sharePublicNotesGlobally: false,
        shareTagsWithPublicNotes: true, // Default to true if settings object is missing
        shareValuesWithPublicNotes: true, // Default to true if settings object is missing
    };

    // Prevent public publish if globally disabled
    if (!options.encrypt && !privacySettings.sharePublicNotesGlobally) {
        get().setError('network', 'Public sharing is disabled in your privacy settings.');
        // toast.error('Cannot publish note publicly.', { description: 'Public sharing is disabled in your privacy settings.' });
        // Removed toast from here as it might not be available in all contexts store is used.
        // UI should handle user feedback for this error.
        console.error('Cannot publish note publicly: Public sharing is disabled in your privacy settings.');
        return;
    }

    get().setLoading('network', true);
    get().setError('network', undefined);
    try {
      const noteToPublish = notes[currentNoteId];
      const relaysToUse = options.relays || nostrRelays;

      const recipient = options.encrypt
        ? options.recipientPk || userProfile.nostrPubkey
        : undefined;

      if (options.encrypt && !recipient) {
        // This should ideally be caught earlier or recipient should always be valid for encrypt=true
        throw new Error("Recipient public key is required for encryption.");
      }

      await nostrService.publishNote(
        noteToPublish,
        relaysToUse,
        options.encrypt,
        recipient,
        privacySettings // Pass the privacy settings
      );

      // Update local note state if published publicly
      if (!options.encrypt && privacySettings.sharePublicNotesGlobally) {
        get().updateNote(currentNoteId, { status: 'published', isSharedPublicly: true });
      } else if (options.encrypt) {
        get().updateNote(currentNoteId, { status: 'published' });
      }
      // toast.success("Note published to Nostr!"); // UI should handle this
      console.log("Note published to Nostr successfully (details depend on relays).");
    } catch (error: any) {
      get().setError('network', `Failed to publish note: ${error.message}`);
      // toast.error("Failed to publish note.", { description: error.message }); // UI should handle this
      console.error(`Failed to publish note: ${error.message}`);
    } finally {
      get().setLoading('network', false);
    }
  },

  subscribeToPublicNotes: (relays?: string[]) => {
    if (!nostrService.isLoggedIn()) { // User should ideally be logged in to interact
      // console.warn("Nostr user not fully initialized for subscribing.");
      // Allow anonymous subscriptions for browsing public notes
    }
    const relaysToUse = relays || get().nostrRelays;
    const filters: Filter[] = [{ kinds: [1], limit: 20 }]; // Example: Get last 20 public text notes
    const subId = `public_notes_${Date.now()}`;

    try {
      const subscription = nostrService.subscribeToEvents(
        filters,
        (event) => get().handleIncomingNostrEvent(event as NostrEvent),
        relaysToUse,
        subId
      );
      if (subscription) {
        set(state => ({
          activeNostrSubscriptions: { ...state.activeNostrSubscriptions, [subId]: subscription },
        }));
        return subId;
      }
      return null;
    } catch (error: any) {
      get().setError('network', `Error subscribing to public notes: ${error.message}`);
      return null;
    }
  },

  subscribeToTopic: (topic: string, relays?: string[]) => {
    if (!nostrService.isLoggedIn()) {
       get().setError('network', 'Login to Nostr to subscribe to topics.');
       return null;
    }
    const relaysToUse = relays || get().nostrRelays;
    const filters: Filter[] = [{ kinds: [1], "#t": [topic.startsWith('#') ? topic.substring(1) : topic], limit: 50 }];
    const subId = `topic_${topic.replace('#', '')}_${Date.now()}`;

    try {
      const subscription = nostrService.subscribeToEvents(
        filters,
        (event) => get().handleIncomingNostrEvent(event as NostrEvent),
        relaysToUse,
        subId
      );
       if (subscription) {
        set(state => ({
          activeNostrSubscriptions: { ...state.activeNostrSubscriptions, [subId]: subscription },
        }));
        return subId;
      }
      return null;
    } catch (error: any) {
      get().setError('network', `Error subscribing to topic ${topic}: ${error.message}`);
      return null;
    }
  },

  unsubscribeFromNostr: (subscriptionIdOrObject: string | any) => {
    const state = get();
    let subObject;
    let subKey = '';

    if (typeof subscriptionIdOrObject === 'string') {
      subKey = subscriptionIdOrObject;
      subObject = state.activeNostrSubscriptions[subKey];
    } else if (subscriptionIdOrObject && typeof subscriptionIdOrObject.unsub === 'function') {
      // Try to find by object instance if it's passed directly (less reliable)
      subObject = subscriptionIdOrObject;
      const entry = Object.entries(state.activeNostrSubscriptions).find(([, s]) => s === subObject);
      if (entry) subKey = entry[0];
    }

    if (subObject) {
      nostrService.unsubscribe(subObject);
      if (subKey) {
        set(s => {
          const newSubs = { ...s.activeNostrSubscriptions };
          delete newSubs[subKey];
          return { activeNostrSubscriptions: newSubs };
        });
      }
    } else {
      console.warn("Subscription not found or already unsubscribed:", subscriptionIdOrObject);
    }
  },

  addNostrMatch: (match: Match) => {
    set(state => ({ matches: [...state.matches, match] })); // Basic add, consider deduplication or sorting
  },

  addDirectMessage: (message: DirectMessage) => {
    set(state => ({ directMessages: [...state.directMessages, message] })); // Basic add
     // TODO: Decrypt if necessary and if keys are available
  },

  setNostrRelays: async (newRelays: string[]) => {
    const state = get();
    let userProfile = state.userProfile;

    if (userProfile) {
      // Update the nostrRelays in the userProfile object
      const updatedProfile = { ...userProfile, nostrRelays: newRelays };
      // Persist the entire updated profile
      await state.updateUserProfile(updatedProfile); // This calls DBService.saveUserProfile internally
      // updateUserProfile will also call set({ userProfile: updatedProfile })
      // So, we just need to ensure the top-level nostrRelays is also updated here.
      set({ nostrRelays: newRelays });
    } else {
      // If no user profile, this scenario is less likely given initializeApp,
      // but update store's relays anyway. Persistence would be an issue here.
      console.warn("Attempted to set Nostr relays without an active user profile. Relays not persisted to profile.");
      set({ nostrRelays: newRelays });
    }
    // TODO: Consider logic to reconnect/resubscribe if relays change significantly.
    // For now, subscriptions use the relays active at the time of subscription.
  },

  addNostrRelay: async (relayUrl: string) => {
    if (!get().nostrRelays.includes(relayUrl)) {
      const newRelays = [...get().nostrRelays, relayUrl];
      await get().setNostrRelays(newRelays);
    }
  },

  removeNostrRelay: async (relayUrl: string) => {
    const newRelays = get().nostrRelays.filter(r => r !== relayUrl);
    await get().setNostrRelays(newRelays);
  },

  handleIncomingNostrEvent: async (event: NostrEvent) => {
    console.log('Received Nostr Event:', event);
    const state = get();
    const currentUserPubkey = state.userProfile?.nostrPubkey;

    // Kind 4: Encrypted Direct Message
    if (event.kind === 4 && currentUserPubkey) {
      // Check if this user is the recipient
      const recipientTag = event.tags.find(tag => tag[0] === 'p' && tag[1] === currentUserPubkey);
      if (recipientTag) {
        try {
          const decryptedContent = await nostrService.decryptMessage(event.content, event.pubkey);
          const dm: DirectMessage = {
            id: event.id,
            from: event.pubkey,
            to: currentUserPubkey,
            content: decryptedContent,
            timestamp: new Date(event.created_at * 1000),
            encrypted: true, // was encrypted
          };
          state.addDirectMessage(dm);
          // TODO: Persist DM to DBService
          await DBService.saveMessage(dm);
        } catch (error) {
          console.error('Failed to decrypt DM:', error, event);
        }
      }
    }
    // Kind 1: Public Note (can be for general browsing, matching, or topic feeds)
    else if (event.kind === 1) {
        // 1. Check if it belongs to any subscribed topics
        const eventTags = event.tags.filter(t => t[0] === 't').map(t => `#${t[1]}`);
        const subscribedTopics = Object.keys(get().activeTopicSubscriptions);

        let matchedTopic: string | null = null;
        for (const topic of subscribedTopics) {
            // Simple match: if topic is #AI, event tag #AI matches.
            // More complex matching (e.g. ontology-based) could be added here if desired for topic feeds.
            if (eventTags.includes(topic) || eventTags.includes(topic.substring(1))) { // Check with and without #
                matchedTopic = topic;
                break;
            }
        }

        if (matchedTopic) {
            get().addNoteToTopic(matchedTopic, event as NostrEvent);
            // Note: A single event might match multiple subscribed topics.
            // Current addNoteToTopic will add it to the first matched one.
            // Could be extended to add to all matched topics if needed.
        }


        // 2. Perform general matching logic (existing)
        const potentialNote: Partial<Note & { originalEvent: NostrEvent }> = {
            id: `nostr-${event.id}`,
            title: event.tags.find(t => t[0] === 'title')?.[1] || event.content.substring(0,30),
            content: event.content,
            tags: eventTags,
            status: 'published',
            createdAt: new Date(event.created_at * 1000),
            updatedAt: new Date(event.created_at * 1000),
            originalEvent: event as NostrEvent,
        };
        // console.log("Potential public note from network:", potentialNote); // Already logged by subscribeToPublicNotes

        if (currentUserPubkey && event.pubkey !== currentUserPubkey && potentialNote.tags && potentialNote.tags.length > 0) {
            const localNotesArray = Object.values(state.notes);
            let matched = false;
            let sharedTagsResult: string[] = [];

            for (const localNote of localNotesArray) {
                if (localNote.tags && localNote.tags.length > 0) {
                    const localNoteTagsLower = localNote.tags.map(t => t.toLowerCase());
                    const incomingNoteTagsLower = (potentialNote.tags || []).map(t => t.toLowerCase());
                    const commonTags = localNoteTagsLower.filter(t => incomingNoteTagsLower.includes(t));
                    if (commonTags.length > 0) {
                        matched = true;
                        sharedTagsResult = [...new Set([...sharedTagsResult, ...commonTags.map(t => {
                            return (potentialNote.tags || []).find(orig => orig.toLowerCase() === t) || t;
                        })])];
                    }
                }
            }

            if (matched) {
                const newMatch: Match = {
                    id: `match-${event.id}`,
                    targetNoteId: event.id,
                    targetAuthor: event.pubkey,
                    similarity: 0.1,
                    sharedTags: sharedTagsResult.slice(0, 5),
                    sharedValues: [],
                    timestamp: new Date(event.created_at * 1000),
                };
                state.addNostrMatch(newMatch);
                // console.log("New match found and added:", newMatch); // Already logged by addNostrMatch
            }
        }
    }
    // TODO: Handle other event kinds
  },

  updateUserProfile: async (profileUpdates: Partial<UserProfile>) => {
    const currentProfile = get().userProfile ||
        { nostrPubkey: '', sharedTags: [], preferences: { theme: 'system', aiEnabled: false, defaultNoteStatus: 'draft' }};

    const updatedProfile = {
        ...currentProfile,
        ...profileUpdates,
        preferences: {
            ...currentProfile.preferences,
            ...profileUpdates.preferences,
        },
        // Ensure privacySettings and nostrRelays are preserved if not explicitly in profileUpdates
        privacySettings: {
          ...(currentProfile.privacySettings || { sharePublicNotesGlobally: false, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true }),
          ...profileUpdates.privacySettings,
        },
        nostrRelays: profileUpdates.nostrRelays || currentProfile.nostrRelays || [],
    };
    await DBService.saveUserProfile(updatedProfile);
    set({ userProfile: updatedProfile });
  },

  sendDirectMessage: async (recipientPk: string, content: string) => {
    const { userProfile, nostrRelays, addDirectMessage } = get();
    if (!userProfile || !userProfile.nostrPubkey || !nostrService.isLoggedIn()) {
      throw new Error('User not logged in or Nostr keys not available.');
    }
    if (!recipientPk || !content.trim()) {
      throw new Error('Recipient public key and message content are required.');
    }

    get().setLoading('network', true);
    get().setError('network', undefined);

    try {
      // Create a temporary Note-like object for publishNote
      // The actual event ID will come from nostrService.publishNote
      const tempNoteForDM: Note = {
        id: `dm-temp-${Date.now()}`, // Temporary ID, not the actual event ID
        title: '', // DMs don't typically have titles in this context
        content: content.trim(),
        tags: [], // NIP-04 'p' tag is added by nostrService
        values: {},
        fields: {},
        status: 'draft', // Does not apply directly to DMs in the same way as notes
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // publishNote with encrypt=true handles Kind 4 event creation
      const publishedEventIds = await nostrService.publishNote(
        tempNoteForDM,
        nostrRelays, // Use user's configured relays
        true,        // Encrypt
        recipientPk  // Recipient's public key
      );

      if (publishedEventIds.length === 0) {
        // This might happen if all relays fail, or no relays configured.
        // nostrService.publishNote might throw an error before this in some cases.
        throw new Error("Message failed to publish to any relay.");
      }
      const eventId = publishedEventIds[0]; // Assuming we use the first successful event ID

      // Add to local store and DB after successful publish
      const sentDm: DirectMessage = {
        id: eventId, // Use the actual event ID from Nostr
        from: userProfile.nostrPubkey,
        to: recipientPk,
        content: content.trim(),
        timestamp: new Date(), // Timestamp of sending
        encrypted: true,
      };
      addDirectMessage(sentDm); // Add to Zustand state
      await DBService.saveMessage(sentDm); // Persist to IndexedDB

    } catch (error: any) {
      console.error('Failed to send direct message:', error);
      get().setError('network', `Failed to send DM: ${error.message}`);
      throw error; // Re-throw for UI to handle
    } finally {
      get().setLoading('network', false);
    }
  },

  subscribeToDirectMessages: (relays?: string[]) => {
    const { userProfile, nostrRelays, handleIncomingNostrEvent } = get();
    if (!userProfile || !userProfile.nostrPubkey || !nostrService.isLoggedIn()) {
      get().setError('network', 'Cannot subscribe to DMs: User not logged in.');
      return null;
    }

    const relaysToUse = relays || nostrRelays;
    if (relaysToUse.length === 0) {
      get().setError('network', 'Cannot subscribe to DMs: No relays configured.');
      return null;
    }

    const filters: Filter[] = [
      { kinds: [4], '#p': [userProfile.nostrPubkey], limit: 50 },
      { kinds: [4], authors: [userProfile.nostrPubkey], limit: 50 }
    ];
    const subId = `direct_messages_${userProfile.nostrPubkey.substring(0,8)}_${Date.now()}`;

    try {
      const subscription = nostrService.subscribeToEvents(
        filters,
        (event) => handleIncomingNostrEvent(event as NostrEvent),
        relaysToUse,
        subId
      );
      if (subscription) {
        // Use the general activeNostrSubscriptions for actual nostr-tool sub objects
        set(state => ({
          activeNostrSubscriptions: { ...state.activeNostrSubscriptions, [subId]: subscription },
        }));
        console.log(`Subscribed to Direct Messages with ID: ${subId}`);
        return subId; // Return the ID for the UI to potentially track if needed, though not strictly necessary for DMs if panel just reads from directMessages array
      }
      return null;
    } catch (error: any) {
      get().setError('network', `Error subscribing to direct messages: ${error.message}`);
      console.error(`Error subscribing to direct messages: ${error.message}`);
      return null;
    }
  },

  // Topic Subscription Management
  addTopicSubscription: (topic: string, subscriptionId: string) => {
    set(state => ({
      activeTopicSubscriptions: {
        ...state.activeTopicSubscriptions,
        [topic]: subscriptionId,
      },
      // Initialize an empty array for notes if this is a new topic
      topicNotes: {
        ...state.topicNotes,
        [topic]: state.topicNotes[topic] || [],
      }
    }));
  },

  removeTopicSubscription: (topic: string) => {
    set(state => {
      const newActiveTopicSubscriptions = { ...state.activeTopicSubscriptions };
      delete newActiveTopicSubscriptions[topic];
      // Optionally, clear notes for this topic or keep them
      // const newTopicNotes = { ...state.topicNotes };
      // delete newTopicNotes[topic];
      return {
        activeTopicSubscriptions: newActiveTopicSubscriptions,
        // topicNotes: newTopicNotes, // if clearing notes
      };
    });
  },

  addNoteToTopic: (topic: string, note: NostrEvent) => {
    set(state => {
      const currentNotesForTopic = state.topicNotes[topic] || [];
      // Avoid duplicates by checking event ID
      if (currentNotesForTopic.find(n => n.id === note.id)) {
        return state; // Already have this note for this topic
      }
      return {
        topicNotes: {
          ...state.topicNotes,
          [topic]: [note, ...currentNotesForTopic].slice(0, 100), // Add to start, limit to 100 notes per topic
        },
      };
    });
  },

}));
