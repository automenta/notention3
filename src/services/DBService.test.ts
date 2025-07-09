import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DBService } from './db';
import { Note, Folder, OntologyTree, UserProfile, NotentionTemplate, SyncQueueItem } from '../../shared/types'; // Assuming SyncQueueItem is defined
import localforage from 'localforage';

// Mock localforage
vi.mock('localforage', () => {
  const store: Record<string, any> = {};
  return {
    default: {
      getItem: vi.fn(key => Promise.resolve(store[key] !== undefined ? store[key] : null)),
      setItem: vi.fn((key, value) => {
        store[key] = value;
        return Promise.resolve(value);
      }),
      removeItem: vi.fn(key => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
        return Promise.resolve();
      }),
      keys: vi.fn(() => Promise.resolve(Object.keys(store))),
      iterate: vi.fn((iterator: (value: any, key: string, iterationNumber: number) => any) => {
        let i = 0;
        for (const key in store) {
          iterator(store[key], key, i++);
        }
        return Promise.resolve();
      }),
      createInstance: vi.fn().mockReturnThis(), // Mock createInstance to return the mock itself
      config: vi.fn(), // Mock config if it's called
    }
  };
});


describe('DBService', () => {
  beforeEach(async () => {
    // Clear the mock store before each test
    await localforage.clear();
    vi.clearAllMocks(); // Clear mock call counts etc.
  });

  const sampleNote: Note = {
    id: 'note1',
    title: 'Test Note',
    content: 'This is a test note.',
    tags: ['test', 'sample'],
    values: { priority: 'high' },
    fields: {},
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleFolder: Folder = {
    id: 'folder1',
    name: 'Test Folder',
    noteIds: ['note1'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleOntology: OntologyTree = {
    nodes: {
      node1: { id: 'node1', label: '#TestTopic', children: [] },
    },
    rootIds: ['node1'],
    updatedAt: new Date(),
  };

  const sampleUserProfile: UserProfile = {
    nostrPubkey: 'testpubkey',
    sharedTags: [],
    preferences: { theme: 'light', aiEnabled: false, defaultNoteStatus: 'draft' },
    nostrRelays: ['wss://relay.example.com'],
  };

  const sampleTemplate: NotentionTemplate = {
    id: 'template1',
    name: 'Meeting Notes',
    description: 'Template for meeting notes',
    fields: [{ name: 'Attendees', type: 'text', required: true }],
    defaultTags: ['#meeting'],
    defaultValues: { location: 'Online' },
  };


  it('should save and get a note', async () => {
    await DBService.saveNote(sampleNote);
    const retrievedNote = await DBService.getNote('note1');
    expect(localforage.setItem).toHaveBeenCalledWith('note-note1', sampleNote);
    expect(retrievedNote).toEqual(sampleNote);
  });

  it('should delete a note', async () => {
    await DBService.saveNote(sampleNote);
    await DBService.deleteNote('note1');
    const retrievedNote = await DBService.getNote('note1');
    expect(localforage.removeItem).toHaveBeenCalledWith('note-note1');
    expect(retrievedNote).toBeNull();
  });

  it('should get all notes', async () => {
    const note2: Note = { ...sampleNote, id: 'note2' };
    await DBService.saveNote(sampleNote);
    await DBService.saveNote(note2);
    // Need to set up the store for keys() and iterate() mocks for getAllNotes
    (localforage.keys as vi.Mock).mockResolvedValue(['note-note1', 'note-note2', 'some-other-key']);
    (localforage.getItem as vi.Mock)
        .mockImplementation(key => {
            if (key === 'note-note1') return Promise.resolve(sampleNote);
            if (key === 'note-note2') return Promise.resolve(note2);
            return Promise.resolve(null);
        });

    const allNotes = await DBService.getAllNotes();
    expect(allNotes).toHaveLength(2);
    expect(allNotes).toEqual(expect.arrayContaining([sampleNote, note2]));
  });

  it('should save and get a folder', async () => {
    await DBService.saveFolder(sampleFolder);
    const retrievedFolder = await DBService.getFolder('folder1');
    expect(localforage.setItem).toHaveBeenCalledWith('folder-folder1', sampleFolder);
    expect(retrievedFolder).toEqual(sampleFolder);
  });

  it('should save and get ontology', async () => {
    await DBService.saveOntology(sampleOntology);
    const retrievedOntology = await DBService.getOntology();
    expect(localforage.setItem).toHaveBeenCalledWith(DBService['ONTOLOGY_KEY'], sampleOntology);
    expect(retrievedOntology).toEqual(sampleOntology);
  });

  it('should save and get user profile', async () => {
    await DBService.saveUserProfile(sampleUserProfile);
    const retrievedProfile = await DBService.getUserProfile();
    expect(localforage.setItem).toHaveBeenCalledWith(DBService['USER_PROFILE_KEY'], sampleUserProfile);
    expect(retrievedProfile).toEqual(sampleUserProfile);
  });

  it('should save and get a template', async () => {
    await DBService.saveTemplate(sampleTemplate);
    const retrievedTemplate = await DBService.getTemplate('template1');
    expect(localforage.setItem).toHaveBeenCalledWith('template-template1', sampleTemplate);
    expect(retrievedTemplate).toEqual(sampleTemplate);
  });

  it('should get default ontology if none exists', async () => {
    (localforage.getItem as vi.Mock).mockResolvedValueOnce(null); // No ontology in store
    const defaultOntology = await DBService.getDefaultOntology();
    const ontology = await DBService.getOntology(); // This would fetch the (mocked) null then default

    expect(ontology).toEqual(defaultOntology);
    expect(ontology.nodes).toBeDefined();
    expect(ontology.rootIds).toBeDefined();
  });

  // Sync Queue Tests
  const sampleSyncOp: SyncQueueItem = {
    noteId: 'note1',
    action: 'save',
    timestamp: new Date(),
  };

  it('should add and get pending note sync operations', async () => {
    await DBService.addNoteToSyncQueue(sampleSyncOp);
    // Mock getItem for the sync queue key
    (localforage.getItem as vi.Mock).mockImplementation(key => {
      if (key === DBService['SYNC_QUEUE_NOTES_KEY']) return Promise.resolve([sampleSyncOp]);
      return Promise.resolve(null);
    });
    const ops = await DBService.getPendingNoteSyncOps();
    expect(ops).toEqual([sampleSyncOp]);
  });

  it('should remove a note from sync queue', async () => {
    const op2: SyncQueueItem = { noteId: 'note2', action: 'delete', timestamp: new Date() };
    // Mock getItem to return a queue with two items
    (localforage.getItem as vi.Mock).mockResolvedValueOnce([sampleSyncOp, op2]);
    // Mock setItem to capture the updated queue
    const setItemMock = localforage.setItem as vi.Mock;

    await DBService.removeNoteFromSyncQueue('note1');

    expect(setItemMock).toHaveBeenCalledWith(DBService['SYNC_QUEUE_NOTES_KEY'], [op2]);
  });

  it('should clear all data', async () => {
    await DBService.saveNote(sampleNote); // Add some data
    await DBService.clearAllData();
    expect(localforage.clear).toHaveBeenCalled();
    // To be more thorough, you might check if specific items are gone,
    // but localforage.clear() mock handles the expectation.
  });

});
