import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from './index'; // Assuming default export from store/index.ts
import { DBService } from '../services/db';
import { NoteService } from '../services/NoteService';
import { NostrService, nostrService } from '../services/NostrService'; // Import instance too
import { OntologyService } from '../services/ontology';
import { Note, OntologyTree, UserProfile, Folder, NotentionTemplate, SyncQueueNoteOp } from '../../shared/types'; // Added Folder, Template, SyncQueueNoteOp
import { FolderService } from '../services/FolderService'; // Import FolderService for mocking

const mockNewFolderData: Folder = {
  id: 'folder-123',
  name: "My Test Folder",
  parentId: undefined,
  noteIds: [],
  children: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock services
vi.mock('../services/db');
vi.mock('../services/NoteService');
vi.mock('../services/NostrService');
vi.mock('../services/ontology');
// Mock DOMPurify as it's used in syncWithNostr
const mockSanitize = vi.fn(html => html);
vi.mock('dompurify', () => ({
  default: {
    sanitize: mockSanitize,
  }
}));

vi.mock('../services/FolderService', () => {
  return {
    FolderService: {
      createFolder: vi.fn().mockResolvedValue(mockNewFolderData),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn(),
      getAllFolders: vi.fn().mockResolvedValue([]),
    }
  };
});


const initialNotes: Record<string, Note> = {};
const initialOntology: OntologyTree = { nodes: {}, rootIds: [], updatedAt: new Date() }; // Added updatedAt
const initialUserProfile: UserProfile = {
  nostrPubkey: '',
  sharedTags: [],
  preferences: { theme: 'light', aiEnabled: false, defaultNoteStatus: 'draft' },
  nostrRelays: ['wss://relay.example.com'],
  privacySettings: {
    sharePublicNotesGlobally: false,
    shareTagsWithPublicNotes: true,
    shareValuesWithPublicNotes: true,
    shareEmbeddingsWithPublicNotes: false, // Added default for new field
  }
};

describe('App Store', () => {
  const baseInitialState = {
    notes: initialNotes,
    ontology: initialOntology,
    userProfile: initialUserProfile,
    folders: {},
    templates: {},
    currentNoteId: undefined,
    sidebarTab: 'notes' as const,
    searchQuery: '',
    searchFilters: {},
    matches: [],
    directMessages: [],
    embeddingMatches: [],
    nostrRelays: ['wss://relay.example.com'],
    nostrConnected: false,
    activeNostrSubscriptions: {},
    activeTopicSubscriptions: {},
    topicNotes: {},
    editorContent: '',
    isEditing: false,
    loading: { notes: false, ontology: false, network: false, sync: false },
    errors: { sync: undefined },
    lastSyncTimestamp: undefined,
  };


  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState(JSON.parse(JSON.stringify(baseInitialState))); // Deep clone for full reset
    vi.clearAllMocks();

    // Default mock implementations for services
    vi.mocked(DBService.getAllNotes).mockResolvedValue([]);
    vi.mocked(DBService.getOntology).mockResolvedValue(initialOntology);
    vi.mocked(DBService.getUserProfile).mockResolvedValue(initialUserProfile);
    vi.mocked(DBService.getAllFolders).mockResolvedValue([]);
    vi.mocked(DBService.getAllTemplates).mockResolvedValue([]);
    vi.mocked(DBService.getDefaultOntology).mockResolvedValue(initialOntology);
    vi.mocked(DBService.getDefaultTemplates).mockResolvedValue([]);
    vi.mocked(DBService.saveNote).mockResolvedValue(undefined);
    vi.mocked(DBService.saveOntology).mockResolvedValue(undefined);
    vi.mocked(DBService.saveUserProfile).mockResolvedValue(undefined);
    vi.mocked(DBService.saveFolder).mockResolvedValue(undefined);
    vi.mocked(DBService.saveTemplate).mockResolvedValue(undefined);
    vi.mocked(DBService.deleteNote).mockResolvedValue(undefined);
    vi.mocked(DBService.addNoteToSyncQueue).mockResolvedValue(undefined);
    vi.mocked(DBService.removeNoteFromSyncQueue).mockResolvedValue(undefined);
    vi.mocked(DBService.setOntologyNeedsSync).mockResolvedValue(undefined);
    vi.mocked(DBService.getNote).mockResolvedValue(null); // Default to null, specific tests can override

    vi.mocked(NoteService.createNote).mockImplementation(async (partialNote) => {
      const id = `note-${Date.now()}`;
      const newNote: Note = {
        id,
        title: 'Untitled Note',
        content: '',
        tags: [],
        values: {},
        fields: {},
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...partialNote,
      };
      return newNote;
    });

    vi.mocked(nostrService.publishNoteForSync).mockResolvedValue(['event123']);
    vi.mocked(nostrService.isLoggedIn).mockReturnValue(true);
    vi.mocked(nostrService.loadKeyPair).mockResolvedValue(true);
    vi.mocked(nostrService.getPublicKey).mockReturnValue('testpubkey');
    vi.mocked(DBService.saveUserProfile).mockResolvedValue(undefined);
    vi.mocked(FolderService.createFolder).mockResolvedValue(mockNewFolderData); // Ensure FolderService mock is used

    // Mock navigator.onLine for tests that depend on it
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); // Default to online
  });

  it('should initialize the app state, including Nostr and initial sync if online', async () => {
    const { initializeApp } = useAppStore.getState();
    // Setup mocks for initializeNostr and syncWithNostr if they are called
    vi.mocked(nostrService.loadKeyPair).mockResolvedValue(true); // Assume keys are loaded
    vi.mocked(nostrService.getPublicKey).mockReturnValue('testLoadedPk');
    vi.mocked(DBService.saveUserProfile).mockResolvedValue(undefined);
    vi.mocked(nostrService.fetchSyncedOntology).mockResolvedValue(null);
    vi.mocked(nostrService.fetchSyncedNotes).mockResolvedValue([]);
    vi.mocked(DBService.getPendingNoteSyncOps).mockResolvedValue([]);


    await initializeApp();

    expect(DBService.getAllNotes).toHaveBeenCalled();
    expect(DBService.getOntology).toHaveBeenCalled();
    expect(DBService.getUserProfile).toHaveBeenCalled();
    expect(DBService.getAllFolders).toHaveBeenCalled();
    expect(DBService.getAllTemplates).toHaveBeenCalled();

    // Check if initializeNostr part ran
    expect(nostrService.loadKeyPair).toHaveBeenCalled();
    const finalState = useAppStore.getState();
    expect(finalState.userProfile?.nostrPubkey).toBe('testLoadedPk');
    expect(finalState.nostrConnected).toBe(true);

    // Check if initial sync was attempted
    expect(nostrService.fetchSyncedOntology).toHaveBeenCalled(); // Part of syncWithNostr
    expect(nostrService.fetchSyncedNotes).toHaveBeenCalled();   // Part of syncWithNostr
  });

  it('should create a new note, update state, and attempt sync if online', async () => {
    const { createNote } = useAppStore.getState();
    useAppStore.setState({ userProfile: { ...initialUserProfile, nostrPubkey: 'user123' } }); // Ensure user is "logged in"
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const partialNote: Partial<Note> = { title: 'My New Note', content: 'Test content' };
    const newNoteId = await createNote(partialNote);

    const state = useAppStore.getState();
    expect(state.notes[newNoteId]).toBeDefined();
    expect(state.notes[newNoteId].title).toBe('My New Note');
    expect(state.currentNoteId).toBe(newNoteId);
    expect(state.isEditing).toBe(true);
    expect(NoteService.createNote).toHaveBeenCalledWith(partialNote);
    expect(nostrService.publishNoteForSync).toHaveBeenCalled();
    expect(DBService.addNoteToSyncQueue).not.toHaveBeenCalled(); // Should not queue if sync succeeds
  });

  it('should create a new note and queue for sync if offline', async () => {
    const { createNote } = useAppStore.getState();
    useAppStore.setState({ userProfile: { ...initialUserProfile, nostrPubkey: 'user123' } });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); // Offline

    const partialNote: Partial<Note> = { title: 'Offline Note' };
    await createNote(partialNote);

    expect(nostrService.publishNoteForSync).not.toHaveBeenCalled();
    expect(DBService.addNoteToSyncQueue).toHaveBeenCalled();
  });


  it('should update an existing note and attempt sync if online', async () => {
    const { createNote, updateNote } = useAppStore.getState();
    useAppStore.setState({ userProfile: { ...initialUserProfile, nostrPubkey: 'user123' } });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const noteId = await createNote({ title: 'Original Title' });
    vi.mocked(NoteService.updateNote).mockImplementation(async (id, updates) => {
        const originalNote = useAppStore.getState().notes[id];
        if (!originalNote) return null;
        return { ...originalNote, ...updates, updatedAt: new Date() };
    });

    const updates: Partial<Note> = { title: 'Updated Title', content: 'Updated content' };
    await updateNote(noteId, updates);

    const state = useAppStore.getState();
    expect(state.notes[noteId].title).toBe('Updated Title');
    expect(state.notes[noteId].content).toBe('Updated content');
    expect(NoteService.updateNote).toHaveBeenCalledWith(noteId, updates);
  });

  it('should delete a note', async () => {
    const { createNote, deleteNote } = useAppStore.getState();
    const noteId = await createNote({ title: 'To Be Deleted' });

    vi.mocked(NoteService.deleteNote).mockResolvedValue(undefined);
    vi.mocked(DBService.getNote).mockResolvedValue({ // Mock getNote to return the note being deleted
        id: noteId, title: 'To Be Deleted', content: '', tags: [], values: {}, fields: {}, status: 'draft',
        createdAt: new Date(), updatedAt: new Date(), nostrSyncEventId: 'eventToDelete123'
    });
    vi.mocked(DBService.removeNoteFromSyncQueue).mockResolvedValue(undefined);
    vi.mocked(nostrService.publishDeletionEvent).mockResolvedValue(['deletionEventId']);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    useAppStore.setState({ userProfile: { ...initialUserProfile, nostrPubkey: 'user123' } });


    await deleteNote(noteId);

    const state = useAppStore.getState();
    expect(state.notes[noteId]).toBeUndefined();
    expect(state.currentNoteId).toBeUndefined();
    expect(NoteService.deleteNote).toHaveBeenCalledWith(noteId);
    expect(nostrService.publishDeletionEvent).toHaveBeenCalledWith(['eventToDelete123'], expect.any(String), expect.any(Array));
  });

  it('setOntology should update ontology state and call DB/Nostr services if online', async () => {
    const { setOntology, userProfile } = useAppStore.getState(); // Get userProfile from store state
    const newOntologyData: OntologyTree = {
      nodes: { 'node1': { id: 'node1', label: '#NewConcept', children: [] } },
      rootIds: ['node1'],
      updatedAt: new Date(),
    };

    vi.mocked(DBService.saveOntology).mockResolvedValue(undefined);
    vi.mocked(DBService.getOntology).mockResolvedValue(newOntologyData); // Mock re-fetch
    vi.mocked(nostrService.publishOntologyForSync).mockResolvedValue(['ontologyEventId']);

    const profileWithKey = { ...initialUserProfile, nostrPubkey: 'testpubkey' };
    useAppStore.setState({ userProfile: profileWithKey }); // Ensure user has pubkey
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    await setOntology(newOntologyData);

    expect(DBService.saveOntology).toHaveBeenCalledWith(newOntologyData);
    expect(useAppStore.getState().ontology).toEqual(newOntologyData); // Check store state
    expect(nostrService.publishOntologyForSync).toHaveBeenCalledWith(newOntologyData, profileWithKey.nostrRelays);
  });

  it('setOntology should queue sync if offline', async () => {
    const { setOntology } = useAppStore.getState();
    const newOntologyData: OntologyTree = {
      nodes: { 'node1': { id: 'node1', label: '#OfflineConcept', children: [] } },
      rootIds: ['node1'],
      updatedAt: new Date(),
    };
    vi.mocked(DBService.saveOntology).mockResolvedValue(undefined);
    vi.mocked(DBService.getOntology).mockResolvedValue(newOntologyData);
    vi.mocked(DBService.setOntologyNeedsSync).mockResolvedValue(undefined);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await setOntology(newOntologyData);

    expect(DBService.saveOntology).toHaveBeenCalledWith(newOntologyData);
    expect(useAppStore.getState().ontology).toEqual(newOntologyData);
    expect(nostrService.publishOntologyForSync).not.toHaveBeenCalled();
    expect(DBService.setOntologyNeedsSync).toHaveBeenCalledWith(true);
  });

  it('updateUserProfile should update userProfile state and call DBService', async () => {
    const { updateUserProfile } = useAppStore.getState(); // This is the action
    const profileUpdates: Partial<UserProfile> = {
      preferences: {
        ...initialUserProfile.preferences,
        theme: 'dark',
        aiEnabled: true,
      },
      nostrRelays: ['wss://new.relay.example.com'],
    };

    // DBService.saveUserProfile is already mocked to resolve undefined
    // The action directly calls DBService.saveUserProfile and then set({ userProfile })

    await updateUserProfile(profileUpdates as UserProfile); // Cast as UserProfile as the action expects full

    const state = useAppStore.getState();
    expect(DBService.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({
        preferences: expect.objectContaining({ theme: 'dark', aiEnabled: true }),
        nostrRelays: ['wss://new.relay.example.com'],
    }));
    expect(state.userProfile?.preferences.theme).toBe('dark');
    expect(state.userProfile?.preferences.aiEnabled).toBe(true);
    expect(state.userProfile?.nostrRelays).toEqual(['wss://new.relay.example.com']);
  });

  it('createFolder should add a new folder and update state', async () => {
    const { createFolder } = useAppStore.getState();
    const folderName = "My Test Folder";
    const newFolderId = await createFolder(folderName, undefined);

    expect(newFolderId).toBe(mockNewFolderData.id);
    const state = useAppStore.getState();
    expect(state.folders[mockNewFolderData.id]).toBeDefined();
    expect(state.folders[mockNewFolderData.id].name).toBe(folderName);
    expect(FolderService.createFolder).toHaveBeenCalledWith(folderName, undefined);
  });


  it('setCurrentNote should update currentNoteId and editorContent', () => {
    const { setCurrentNote } = useAppStore.getState();
    const noteId = 'test-note-for-setcurrent';
    const testNote: Note = {
      id: noteId, title: 'Test Note', content: '<p>Test HTML Content</p>',
      tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date()
    };
    useAppStore.setState(state => ({ notes: { ...state.notes, [noteId]: testNote } }));

    setCurrentNote(noteId);
    let state = useAppStore.getState();
    expect(state.currentNoteId).toBe(noteId);
    expect(state.editorContent).toBe('<p>Test HTML Content</p>');
    expect(state.isEditing).toBe(true); // Should set isEditing to true

    setCurrentNote(undefined);
    state = useAppStore.getState();
    expect(state.currentNoteId).toBeUndefined();
    expect(state.editorContent).toBe('');
    expect(state.isEditing).toBe(false); // Should set isEditing to false
  });


  describe('syncWithNostr', () => {
    // No changes needed inside this describe block based on the diff,
    // but keeping it here to show the full structure.
    // Tests within this block should be reviewed for correctness after unskipping.
    let state: ReturnType<typeof useAppStore.getState>;

    beforeEach(() => {
      state = useAppStore.getState();
      state.userProfile = {
        ...initialUserProfile,
        nostrPubkey: 'test-sync-pubkey',
      };
      state.nostrConnected = true;
      vi.mocked(nostrService.isLoggedIn).mockReturnValue(true);
      vi.mocked(nostrService.getPublicKey).mockReturnValue('test-sync-pubkey');
      vi.mocked(DBService.getOntologyNeedsSync).mockResolvedValue(false);
      vi.mocked(DBService.getPendingNoteSyncOps).mockResolvedValue([]);
      vi.mocked(DBService.getOntology).mockResolvedValue(initialOntology);
      vi.mocked(DBService.getNote).mockImplementation(async (id) => state.notes[id] || null);
      vi.mocked(nostrService.fetchSyncedOntology).mockResolvedValue(null);
      vi.mocked(nostrService.fetchSyncedNotes).mockResolvedValue([]);
      vi.mocked(nostrService.publishOntologyForSync).mockResolvedValue(['eventOntologySyncId']);
      vi.mocked(nostrService.publishNoteForSync).mockResolvedValue(['eventNoteSyncId']);
      vi.mocked(nostrService.publishDeletionEvent).mockResolvedValue(['eventDeletionSyncId']);
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    });

    it('should not run if offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      await state.syncWithNostr();
      expect(useAppStore.getState().errors.sync).toBe('Cannot sync: Application is offline.');
      expect(nostrService.fetchSyncedOntology).not.toHaveBeenCalled();
    });

    it('should not run if not logged into Nostr', async () => {
      useAppStore.setState(prevState => ({
        userProfile: prevState.userProfile ? { ...prevState.userProfile, nostrPubkey: '' } : undefined
      }));
      vi.mocked(nostrService.isLoggedIn).mockReturnValue(false);
      await state.syncWithNostr();
      expect(useAppStore.getState().errors.sync).toBe('Cannot sync: User not logged into Nostr.');
      expect(nostrService.fetchSyncedOntology).not.toHaveBeenCalled();
    });

    it('should fetch remote ontology and update local if remote is newer', async () => {
      const remoteOntologyNewer: OntologyTree = {
        nodes: { 'remoteNode': { id: 'remoteNode', label: '#Remote', children: [] } },
        rootIds: ['remoteNode'],
        updatedAt: new Date(initialOntology.updatedAt.getTime() + 10000),
      };
      vi.mocked(nostrService.fetchSyncedOntology).mockResolvedValue(remoteOntologyNewer);
      vi.mocked(DBService.saveOntology).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.fetchSyncedOntology).toHaveBeenCalled();
      expect(DBService.saveOntology).toHaveBeenCalledWith(remoteOntologyNewer);
      expect(useAppStore.getState().ontology).toEqual(remoteOntologyNewer);
    });

    it('should publish local ontology if local is newer than remote', async () => {
      const localOntologyNewer: OntologyTree = {
        ...initialOntology,
        updatedAt: new Date(Date.now() + 20000),
      };
      useAppStore.setState({ ontology: localOntologyNewer });

      const remoteOntologyOlder: OntologyTree = {
        nodes: { 'remoteNode': { id: 'remoteNode', label: '#Remote', children: [] } },
        rootIds: ['remoteNode'],
        updatedAt: new Date(initialOntology.updatedAt.getTime() - 10000),
      };
      vi.mocked(nostrService.fetchSyncedOntology).mockResolvedValue(remoteOntologyOlder);
      vi.mocked(DBService.setOntologyNeedsSync).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.publishOntologyForSync).toHaveBeenCalledWith(localOntologyNewer, state.userProfile?.nostrRelays);
      expect(DBService.setOntologyNeedsSync).toHaveBeenCalledWith(false);
    });
     it('should publish local ontology if no remote ontology and local needs sync or forceFullSync', async () => {
      vi.mocked(nostrService.fetchSyncedOntology).mockResolvedValue(null);
      vi.mocked(DBService.getOntologyNeedsSync).mockResolvedValue(true);
      const localOntologyToSync = { ...initialOntology, updatedAt: new Date() };
      useAppStore.setState({ ontology: localOntologyToSync });

      await state.syncWithNostr(true); // Test with forceFullSync
      expect(nostrService.publishOntologyForSync).toHaveBeenCalledWith(localOntologyToSync, state.userProfile?.nostrRelays);
      expect(DBService.setOntologyNeedsSync).toHaveBeenCalledWith(false);
    });


    it('should fetch remote notes and update local if remote is newer', async () => {
      const localNoteOld: Note = { id: 'note1', title: 'Local Old', content: 'v1', status: 'draft', tags:[], values:{}, fields:{}, createdAt: new Date('2023-01-01'), updatedAt: new Date('2023-01-01') };
      useAppStore.setState({ notes: { 'note1': localNoteOld } });

      const remoteNoteNew: Note = { ...localNoteOld, content: 'v2', updatedAt: new Date('2023-01-02') };
      vi.mocked(nostrService.fetchSyncedNotes).mockResolvedValue([remoteNoteNew]);
      vi.mocked(DBService.saveNote).mockResolvedValue(undefined);
      mockSanitize.mockClear(); // Clear for this specific test

      await state.syncWithNostr();

      expect(nostrService.fetchSyncedNotes).toHaveBeenCalled();
      expect(DBService.saveNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'note1', content: 'v2' }));
      expect(useAppStore.getState().notes['note1'].content).toBe('v2');
      expect(mockSanitize).toHaveBeenCalledWith('v2');
    });

    it('should process pending local note saves (publish to Nostr)', async () => {
      const noteToSync: Note = { id: 'pending1', title: 'Pending Sync', content: 'content', status:'draft', tags:[], values:{}, fields:{}, createdAt: new Date(), updatedAt: new Date(), nostrSyncEventId: undefined };
      const pendingOp: SyncQueueNoteOp = { noteId: 'pending1', action: 'save', timestamp: new Date() };

      vi.mocked(DBService.getPendingNoteSyncOps).mockResolvedValue([pendingOp]);
      vi.mocked(DBService.getNote).mockResolvedValue(noteToSync);
      vi.mocked(DBService.removeNoteFromSyncQueue).mockResolvedValue(undefined);
      vi.mocked(DBService.saveNote).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.publishNoteForSync).toHaveBeenCalledWith(noteToSync, state.userProfile?.nostrRelays);
      expect(DBService.removeNoteFromSyncQueue).toHaveBeenCalledWith('pending1');
      expect(DBService.saveNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'pending1', nostrSyncEventId: 'eventNoteSyncId' }));
      expect(useAppStore.getState().notes['pending1']?.nostrSyncEventId).toBe('eventNoteSyncId');
    });

    it('should process pending local note deletions (publish Kind 5 to Nostr)', async () => {
      const noteToDeleteEventId = 'eventToDelete123';
      const pendingOp: SyncQueueNoteOp = {
        noteId: 'deletedNote1', action: 'delete', timestamp: new Date(), nostrEventId: noteToDeleteEventId
      };
      vi.mocked(DBService.getPendingNoteSyncOps).mockResolvedValue([pendingOp]);
      vi.mocked(DBService.removeNoteFromSyncQueue).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.publishDeletionEvent).toHaveBeenCalledWith([noteToDeleteEventId], "Note deleted by user during sync.", state.userProfile?.nostrRelays);
      expect(DBService.removeNoteFromSyncQueue).toHaveBeenCalledWith('deletedNote1');
    });

    it('should correctly use lastSyncTimestamp for fetching notes if not forceFullSync', async () => {
      const lastSync = new Date('2023-06-15T10:00:00Z');
      useAppStore.setState({ lastSyncTimestamp: lastSync });
      const expectedSince = Math.floor(lastSync.getTime() / 1000);

      await state.syncWithNostr(false);

      expect(nostrService.fetchSyncedNotes).toHaveBeenCalledWith(expectedSince, state.userProfile?.nostrRelays);
    });

    it('should fetch all notes (since=undefined) if forceFullSync is true', async () => {
      const lastSync = new Date('2023-06-15T10:00:00Z');
      useAppStore.setState({ lastSyncTimestamp: lastSync });

      await state.syncWithNostr(true);

      expect(nostrService.fetchSyncedNotes).toHaveBeenCalledWith(undefined, state.userProfile?.nostrRelays);
    });
  });
});
