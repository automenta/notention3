import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from './index'; // Assuming default export from store/index.ts
import { DBService } from '../services/db';
import { NoteService } from '../services/NoteService';
import { NostrService, nostrService } from '../services/NostrService'; // Import instance too
import { OntologyService } from '../services/ontology';
import { Note, OntologyTree, UserProfile } from '../../shared/types';

// Mock services
vi.mock('../services/db');
vi.mock('../services/NoteService');
vi.mock('../services/NostrService');
vi.mock('../services/ontology');

const initialNotes: Record<string, Note> = {};
const initialOntology: OntologyTree = { nodes: {}, rootIds: [], updatedAt: new Date() };
const initialUserProfile: UserProfile = {
  nostrPubkey: '',
  sharedTags: [],
  preferences: { theme: 'light', aiEnabled: false, defaultNoteStatus: 'draft' },
  nostrRelays: ['wss://relay.example.com'],
  privacySettings: { sharePublicNotesGlobally: false, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true }
};

describe('App Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      notes: initialNotes,
      ontology: initialOntology,
      userProfile: initialUserProfile,
      folders: {},
      templates: {},
      currentNoteId: undefined,
      sidebarTab: 'notes',
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
    });
    vi.clearAllMocks(); // Clear all mock function calls

    // Mock service method implementations
    (DBService.getAllNotes as vi.Mock).mockResolvedValue([]);
    (DBService.getOntology as vi.Mock).mockResolvedValue(initialOntology);
    (DBService.getUserProfile as vi.Mock).mockResolvedValue(initialUserProfile);
    (DBService.getAllFolders as vi.Mock).mockResolvedValue([]);
    (DBService.getAllTemplates as vi.Mock).mockResolvedValue([]);
    (DBService.getDefaultOntology as vi.Mock).mockResolvedValue(initialOntology);
    (DBService.saveNote as vi.Mock).mockResolvedValue(undefined);
    (DBService.addNoteToSyncQueue as vi.Mock).mockResolvedValue(undefined);


    (NoteService.createNote as vi.Mock).mockImplementation(async (partialNote) => {
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

    (nostrService.publishNoteForSync as vi.Mock).mockResolvedValue(['event123']);
    (nostrService.isLoggedIn as vi.Mock).mockReturnValue(true); // Assume logged in for some tests
    (nostrService.loadKeyPair as vi.Mock).mockResolvedValue(true);
    (nostrService.getPublicKey as vi.Mock).mockReturnValue('testpubkey');
    (DBService.saveUserProfile as vi.Mock).mockResolvedValue(undefined);


  });

  it('should initialize the app state', async () => {
    const { initializeApp } = useAppStore.getState();
    await initializeApp();

    expect(DBService.getAllNotes).toHaveBeenCalled();
    expect(DBService.getOntology).toHaveBeenCalled();
    expect(DBService.getUserProfile).toHaveBeenCalled();
    // Add more assertions based on what initializeApp does
    const state = useAppStore.getState();
    expect(state.notes).toEqual({}); // Assuming mock DBService.getAllNotes returns []
    expect(state.userProfile).toEqual(initialUserProfile); // Assuming mock DBService.getUserProfile returns initialUserProfile
  });

  it('should create a new note and update state', async () => {
    const { createNote } = useAppStore.getState();
    const partialNote: Partial<Note> = { title: 'My New Note', content: 'Test content' };

    const newNoteId = await createNote(partialNote);

    const state = useAppStore.getState();
    expect(state.notes[newNoteId]).toBeDefined();
    expect(state.notes[newNoteId].title).toBe('My New Note');
    expect(state.currentNoteId).toBe(newNoteId);
    expect(state.isEditing).toBe(true);
    expect(NoteService.createNote).toHaveBeenCalledWith(partialNote);
    expect(DBService.addNoteToSyncQueue).toHaveBeenCalled(); // Or publishNoteForSync if online
  });

  it('should update an existing note', async () => {
    // First, create a note to update
    const { createNote, updateNote, notes } = useAppStore.getState();
    const noteId = await createNote({ title: 'Original Title' });

    // Mock NoteService.updateNote to return the updated note
    (NoteService.updateNote as vi.Mock).mockImplementation(async (id, updates) => {
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

    (NoteService.deleteNote as vi.Mock).mockResolvedValue(undefined); // Mock the service call
    (DBService.removeNoteFromSyncQueue as vi.Mock).mockResolvedValue(undefined);
    (nostrService.publishDeletionEvent as vi.Mock).mockResolvedValue(['deletionEventId']);


    await deleteNote(noteId);

    const state = useAppStore.getState();
    expect(state.notes[noteId]).toBeUndefined();
    expect(state.currentNoteId).toBeUndefined(); // If it was the current note
    expect(NoteService.deleteNote).toHaveBeenCalledWith(noteId);
  });

  it('setCurrentNote should update currentNoteId and editorContent', () => {
    const { createNote, setCurrentNote } = useAppStore.getState();
    // Manually add a note to the store for this test as createNote is async and might interfere with direct state check
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
    expect(state.isEditing).toBe(true);

    setCurrentNote(undefined);
    state = useAppStore.getState();
    expect(state.currentNoteId).toBeUndefined();
    expect(state.editorContent).toBe('');
    expect(state.isEditing).toBe(false);
  });

  // TODO: Add more tests for other actions like:
  // - setOntology
  // - updateUserProfile
  // - folder actions
  // - template actions
  // - Nostr actions (publish, subscribe, sync) - these will need more involved mocking

  describe('syncWithNostr', () => {
    let state: ReturnType<typeof useAppStore.getState>;

    beforeEach(() => {
      state = useAppStore.getState();
      // Ensure user is "logged in" to Nostr for these tests by default
      state.userProfile = {
        ...initialUserProfile,
        nostrPubkey: 'test-sync-pubkey',
      };
      state.nostrConnected = true; // Assume connected
      (nostrService.isLoggedIn as vi.Mock).mockReturnValue(true);
      (nostrService.getPublicKey as vi.Mock).mockReturnValue('test-sync-pubkey');

      // Mock DBService methods used by sync
      (DBService.getOntologyNeedsSync as vi.Mock).mockResolvedValue(false);
      (DBService.getPendingNoteSyncOps as vi.Mock).mockResolvedValue([]);
      (DBService.getOntology as vi.Mock).mockResolvedValue(initialOntology); // Default local ontology
      (DBService.getNote as vi.Mock).mockImplementation(async (id) => state.notes[id] || null);


      // Mock NostrService methods used by sync
      (nostrService.fetchSyncedOntology as vi.Mock).mockResolvedValue(null); // Default: no remote ontology
      (nostrService.fetchSyncedNotes as vi.Mock).mockResolvedValue([]); // Default: no remote notes
      (nostrService.publishOntologyForSync as vi.Mock).mockResolvedValue(['eventOntologySyncId']);
      (nostrService.publishNoteForSync as vi.Mock).mockResolvedValue(['eventNoteSyncId']);
      (nostrService.publishDeletionEvent as vi.Mock).mockResolvedValue(['eventDeletionSyncId']);

      // Mock navigator.onLine
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    });

    it('should not run if offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      await state.syncWithNostr();
      expect(state.errors.sync).toBe('Cannot sync: Application is offline.');
      expect(nostrService.fetchSyncedOntology).not.toHaveBeenCalled();
    });

    it('should not run if not logged into Nostr', async () => {
      state.userProfile!.nostrPubkey = ''; // Not logged in
      (nostrService.isLoggedIn as vi.Mock).mockReturnValue(false);
      await state.syncWithNostr();
      expect(state.errors.sync).toBe('Cannot sync: User not logged into Nostr.');
      expect(nostrService.fetchSyncedOntology).not.toHaveBeenCalled();
    });

    it('should fetch remote ontology and update local if remote is newer', async () => {
      const remoteOntologyNewer: OntologyTree = {
        nodes: { 'remoteNode': { id: 'remoteNode', label: '#Remote' } },
        rootIds: ['remoteNode'],
        updatedAt: new Date(Date.now() + 10000), // Newer than initialOntology.updatedAt
      };
      (nostrService.fetchSyncedOntology as vi.Mock).mockResolvedValue(remoteOntologyNewer);
      (DBService.saveOntology as vi.Mock).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.fetchSyncedOntology).toHaveBeenCalled();
      expect(DBService.saveOntology).toHaveBeenCalledWith(remoteOntologyNewer);
      expect(useAppStore.getState().ontology).toEqual(remoteOntologyNewer);
    });

    it('should publish local ontology if local is newer than remote', async () => {
      const localOntologyNewer: OntologyTree = {
        ...initialOntology,
        updatedAt: new Date(Date.now() + 20000), // Newer
      };
      useAppStore.setState({ ontology: localOntologyNewer }); // Set local ontology to be newer

      const remoteOntologyOlder: OntologyTree = { // Remote is older
        nodes: { 'remoteNode': { id: 'remoteNode', label: '#Remote' } },
        rootIds: ['remoteNode'],
        updatedAt: new Date(Date.now() - 10000),
      };
      (nostrService.fetchSyncedOntology as vi.Mock).mockResolvedValue(remoteOntologyOlder);
      (DBService.setOntologyNeedsSync as vi.Mock).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.publishOntologyForSync).toHaveBeenCalledWith(localOntologyNewer, state.userProfile?.nostrRelays);
      expect(DBService.setOntologyNeedsSync).toHaveBeenCalledWith(false);
    });

    it('should publish local ontology if no remote ontology and local needs sync', async () => {
      (nostrService.fetchSyncedOntology as vi.Mock).mockResolvedValue(null); // No remote
      (DBService.getOntologyNeedsSync as vi.Mock).mockResolvedValue(true); // Local needs sync
      const localOntologyToSync = { ...initialOntology, updatedAt: new Date() };
      useAppStore.setState({ ontology: localOntologyToSync });

      await state.syncWithNostr();
      expect(nostrService.publishOntologyForSync).toHaveBeenCalledWith(localOntologyToSync, state.userProfile?.nostrRelays);
      expect(DBService.setOntologyNeedsSync).toHaveBeenCalledWith(false);
    });

    it('should fetch remote notes and update local if remote is newer', async () => {
      const localNoteOld: Note = { id: 'note1', title: 'Local Old', content: 'v1', status: 'draft', tags:[], values:{}, fields:{}, createdAt: new Date('2023-01-01'), updatedAt: new Date('2023-01-01') };
      useAppStore.setState({ notes: { 'note1': localNoteOld } });

      const remoteNoteNew: Note = { ...localNoteOld, content: 'v2', updatedAt: new Date('2023-01-02') };
      (nostrService.fetchSyncedNotes as vi.Mock).mockResolvedValue([remoteNoteNew]);
      (DBService.saveNote as vi.Mock).mockResolvedValue(undefined);
      // Mock DOMPurify if it's used within the sync flow (it is)
      const mockSanitize = vi.fn(html => html); // Simple passthrough mock
      vi.mock('dompurify', () => ({ default: { sanitize: mockSanitize } }));


      await state.syncWithNostr();

      expect(nostrService.fetchSyncedNotes).toHaveBeenCalled();
      expect(DBService.saveNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'note1', content: 'v2' }));
      expect(useAppStore.getState().notes['note1'].content).toBe('v2');
      expect(mockSanitize).toHaveBeenCalledWith('v2');
    });

    it('should process pending local note saves (publish to Nostr)', async () => {
      const noteToSync: Note = { id: 'pending1', title: 'Pending Sync', content: 'content', status:'draft', tags:[], values:{}, fields:{}, createdAt: new Date(), updatedAt: new Date(), nostrSyncEventId: undefined };
      const pendingOp: SyncQueueNoteOp = { noteId: 'pending1', action: 'save', timestamp: new Date() };

      (DBService.getPendingNoteSyncOps as vi.Mock).mockResolvedValue([pendingOp]);
      (DBService.getNote as vi.Mock).mockResolvedValue(noteToSync); // DBService returns the note to sync
      (DBService.removeNoteFromSyncQueue as vi.Mock).mockResolvedValue(undefined);
      (DBService.saveNote as vi.Mock).mockResolvedValue(undefined); // For updating nostrSyncEventId

      // Assume no conflicting remote note from fetchSyncedNotes (which returns [] by default mock)
      await state.syncWithNostr();

      expect(nostrService.publishNoteForSync).toHaveBeenCalledWith(noteToSync, state.userProfile?.nostrRelays);
      expect(DBService.removeNoteFromSyncQueue).toHaveBeenCalledWith('pending1');
      // Check if note was updated with nostrSyncEventId
      expect(DBService.saveNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'pending1', nostrSyncEventId: 'eventNoteSyncId' }));
      expect(useAppStore.getState().notes['pending1']?.nostrSyncEventId).toBe('eventNoteSyncId');
    });

    it('should process pending local note deletions (publish Kind 5 to Nostr)', async () => {
      const noteToDeleteEventId = 'eventToDelete123';
      const pendingOp: SyncQueueNoteOp = {
        noteId: 'deletedNote1',
        action: 'delete',
        timestamp: new Date(),
        nostrEventId: noteToDeleteEventId
      };
      (DBService.getPendingNoteSyncOps as vi.Mock).mockResolvedValue([pendingOp]);
      (DBService.removeNoteFromSyncQueue as vi.Mock).mockResolvedValue(undefined);

      await state.syncWithNostr();

      expect(nostrService.publishDeletionEvent).toHaveBeenCalledWith([noteToDeleteEventId], "Note deleted by user during sync.", state.userProfile?.nostrRelays);
      expect(DBService.removeNoteFromSyncQueue).toHaveBeenCalledWith('deletedNote1');
    });

    it('should correctly use lastSyncTimestamp for fetching notes if not forceFullSync', async () => {
      const lastSync = new Date('2023-06-15T10:00:00Z');
      useAppStore.setState({ lastSyncTimestamp: lastSync });
      const expectedSince = Math.floor(lastSync.getTime() / 1000);

      await state.syncWithNostr(false); // Not a force sync

      expect(nostrService.fetchSyncedNotes).toHaveBeenCalledWith(expectedSince, state.userProfile?.nostrRelays);
    });

    it('should fetch all notes (since=undefined) if forceFullSync is true', async () => {
      const lastSync = new Date('2023-06-15T10:00:00Z');
      useAppStore.setState({ lastSyncTimestamp: lastSync });

      await state.syncWithNostr(true); // Force full sync

      expect(nostrService.fetchSyncedNotes).toHaveBeenCalledWith(undefined, state.userProfile?.nostrRelays);
    });

  });
});
