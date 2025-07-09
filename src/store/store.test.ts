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
});
