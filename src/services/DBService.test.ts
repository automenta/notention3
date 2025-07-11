import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DBService } from './db';
import { Note, Folder, OntologyTree, UserProfile, NotentionTemplate, SyncQueueItem } from '../../shared/types'; // Assuming SyncQueueItem is defined
import localforage from 'localforage';

// Define mockStore and mockLocalforageInstance as const with initial values
// This ensures they are always defined when the vi.mock factory is evaluated.


vi.mock('localforage', () => {
  const mockStore: Record<string, any> = {};
  const mockLocalforageInstance = {
    getItem: vi.fn(key => Promise.resolve(mockStore[key] !== undefined ? mockStore[key] : null)),
    setItem: vi.fn((key, value) => {
      mockStore[key] = value;
      return Promise.resolve(value);
    }),
    removeItem: vi.fn(key => {
      delete mockStore[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(mockStore).forEach(k => delete mockStore[k]);
      return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve(Object.keys(mockStore))),
    iterate: vi.fn((iterator: (value: any, key: string, iterationNumber: number) => any) => {
      let i = 0;
      for (const key in mockStore) {
        if (Object.prototype.hasOwnProperty.call(mockStore, key)) {
          const result = iterator(mockStore[key], key, i++);
          if (result !== undefined) { // Stop iteration if iterator returns a value
            return Promise.resolve(result);
          }
        }
      }
      return Promise.resolve();
    }),
  };

  return {
    default: {
      createInstance: vi.fn(() => mockLocalforageInstance),
    },
    _resetMockStore: () => {
      Object.keys(mockStore).forEach(k => delete mockStore[k]);
    },
    _getMockStore: () => mockStore,
    _getMockInstance: () => mockLocalforageInstance,
  };
});


describe('DBService', () => {
  beforeEach(() => {
    // Reset the state of the shared mock for each test
    localforage._resetMockStore(); // Clear the internal store
    vi.clearAllMocks(); // Clear calls on mockLocalforageInstance methods

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
    updatedAt: new Date(), // DBService.saveOntology will overwrite this with current time
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

  const sampleMessage: DirectMessage = {
    id: 'dm1',
    from: 'pubkeyFrom',
    to: 'pubkeyTo',
    content: 'Hello there',
    timestamp: new Date(),
    encrypted: true,
  };


  describe('Notes Operations', () => {
    it('should save a note', async () => {
      await DBService.saveNote(sampleNote);
      // notesStore.setItem(note.id, note) is called in DBService
      // Our mock means mockLocalforageInstance.setItem is called
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleNote.id, sampleNote);
      expect(mockStore[sampleNote.id]).toEqual(sampleNote);
    });

    it('should get a note by ID', async () => {
      mockStore[sampleNote.id] = sampleNote; // Pre-populate
      const note = await DBService.getNote(sampleNote.id);
      expect(mockLocalforageInstance.getItem).toHaveBeenCalledWith(sampleNote.id);
      expect(note).toEqual(sampleNote);
    });

    it('should get all notes, sorted by updatedAt descending', async () => {
      const note1 = { ...sampleNote, id: 'n1', title:"N1", updatedAt: new Date('2023-01-01T10:00:00Z') };
      const note2 = { ...sampleNote, id: 'n2', title:"N2", updatedAt: new Date('2023-01-01T12:00:00Z') }; // Newer
      mockStore[note1.id] = note1;
      mockStore[note2.id] = note2;
      // simulate some other non-note data that iterate might see if not careful with keys()
      mockStore['ontology_tree'] = { nodes: {} };


      // DBService.getAllNotes uses iterate without pre-filtering keys,
      // so the mock for iterate needs to correctly simulate only passing Note objects.
      // However, DBService.getAllNotes pushes all iterated items into an array.
      // The test should ensure that only actual notes are returned.
      // The current iterate mock iterates over everything in mockStore.
      // Let's adjust mockIterate for getAllNotes to be more specific or filter in test.
      const mockIterateNotes = vi.fn((iterator: (value: any, key: string) => void) => {
        if (mockStore[note1.id]) iterator(mockStore[note1.id], note1.id);
        if (mockStore[note2.id]) iterator(mockStore[note2.id], note2.id);
        return Promise.resolve();
      });
      const originalIterate = mockLocalforageInstance.iterate;
      mockLocalforageInstance.iterate = mockIterateNotes;


      const notes = await DBService.getAllNotes();
      expect(mockIterateNotes).toHaveBeenCalled();
      expect(notes.length).toBe(2);
      expect(notes[0].id).toBe('n2'); // note2 should be first (more recent updatedAt)
      expect(notes[1].id).toBe('n1');

      mockLocalforageInstance.iterate = originalIterate; // Restore original mock
    });

    it('should delete a note', async () => {
      mockStore[sampleNote.id] = sampleNote;
      await DBService.deleteNote(sampleNote.id);
      expect(mockLocalforageInstance.removeItem).toHaveBeenCalledWith(sampleNote.id);
      expect(mockStore[sampleNote.id]).toBeUndefined();
    });
  });

  describe('Ontology Operations', () => {
    it('should save ontology and set updatedAt to current time', async () => {
      const initialOntology = { ...sampleOntology, updatedAt: new Date('2000-01-01') };
      const beforeSaveTime = new Date();

      await DBService.saveOntology(initialOntology);

      const savedItem = mockStore['tree'] as OntologyTree; // Key 'tree' is used in DBService.ts
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith('tree', expect.objectContaining({
        nodes: initialOntology.nodes,
        rootIds: initialOntology.rootIds,
      }));
      expect(savedItem.updatedAt).toBeInstanceOf(Date);
      expect(savedItem.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeSaveTime.getTime());
    });

    it('should get ontology, parsing string date to Date object if needed', async () => {
      const dateString = new Date().toISOString();
      mockStore['tree'] = { ...sampleOntology, updatedAt: dateString };
      const ontologyData = await DBService.getOntology();
      expect(mockLocalforageInstance.getItem).toHaveBeenCalledWith('tree');
      expect(ontologyData?.updatedAt).toBeInstanceOf(Date);
      expect(ontologyData?.updatedAt?.toISOString()).toEqual(dateString);
    });

    it('should get default ontology if none exists', async () => {
      mockLocalforageInstance.getItem.mockResolvedValueOnce(null); // Simulate no ontology in store
      const defaultOntologyData = await DBService.getDefaultOntology(); // This is a static method, doesn't use store

      // Call getOntology again, which should now trigger fetching default IF it saved it.
      // DBService.getOntology does not save default, it just returns null if nothing is found.
      // The store (useAppStore) is responsible for saving default if getOntology returns null.
      const ontologyData = await DBService.getOntology();
      expect(ontologyData).toBeNull(); // getOntology itself returns null if not found

      // To test the default structure:
      expect(defaultOntologyData.nodes).toBeDefined();
      expect(defaultOntologyData.rootIds).toBeDefined();
    });
  });

  describe('User Profile Operations', () => {
    it('should save and get user profile', async () => {
      await DBService.saveUserProfile(sampleUserProfile);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith('profile', sampleUserProfile);

      mockStore['profile'] = sampleUserProfile; // Simulate save for getItem call
      const profile = await DBService.getUserProfile();
      expect(mockLocalforageInstance.getItem).toHaveBeenCalledWith('profile');
      expect(profile).toEqual(sampleUserProfile);
    });
  });

  describe('Nostr Keys Operations (within User Store context)', () => {
    const sk = 'nsec1testprivatekey';
    const pk = 'npub1testpublickey';

    it('should save and get Nostr private key', async () => {
      await DBService.saveNostrPrivateKey(sk);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith('nostrPrivateKey', sk);
      mockStore['nostrPrivateKey'] = sk;
      const retrievedSk = await DBService.getNostrPrivateKey();
      expect(retrievedSk).toBe(sk);
    });
    it('should remove Nostr private key', async () => {
      mockStore['nostrPrivateKey'] = sk;
      await DBService.removeNostrPrivateKey();
      expect(mockLocalforageInstance.removeItem).toHaveBeenCalledWith('nostrPrivateKey');
      expect(mockStore['nostrPrivateKey']).toBeUndefined();
    });
    it('should save and get Nostr public key', async () => {
      await DBService.saveNostrPublicKey(pk);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith('nostrPublicKey', pk);
      mockStore['nostrPublicKey'] = pk;
      const retrievedPk = await DBService.getNostrPublicKey();
      expect(retrievedPk).toBe(pk);
    });
    it('should remove Nostr public key', async () => {
      mockStore['nostrPublicKey'] = pk;
      await DBService.removeNostrPublicKey();
      expect(mockLocalforageInstance.removeItem).toHaveBeenCalledWith('nostrPublicKey');
      expect(mockStore['nostrPublicKey']).toBeUndefined();
    });
  });

  describe('Folders Operations', () => {
    it('should save and get a folder', async () => {
      await DBService.saveFolder(sampleFolder);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleFolder.id, sampleFolder);
      mockStore[sampleFolder.id] = sampleFolder;
      const folder = await DBService.getFolder(sampleFolder.id);
      expect(folder).toEqual(sampleFolder);
    });
  });

  describe('Templates Operations', () => {
    it('should save and get a template', async () => {
      await DBService.saveTemplate(sampleTemplate);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleTemplate.id, sampleTemplate);
      mockStore[sampleTemplate.id] = sampleTemplate;
      const template = await DBService.getTemplate(sampleTemplate.id);
      expect(template).toEqual(sampleTemplate);
    });
  });

  describe('Direct Messages Operations', () => {
    it('should save and get a message', async () => {
      await DBService.saveMessage(sampleMessage);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleMessage.id, sampleMessage);
      mockStore[sampleMessage.id] = sampleMessage;
      const message = await DBService.getMessage(sampleMessage.id);
      expect(message).toEqual(sampleMessage);
    });
  });

  describe('Sync Queue Operations (Notes)', () => {
    const op1: SyncQueueNoteOp = { noteId: 'syncNote1', action: 'save', timestamp: new Date('2023-01-01T10:00:00Z') };
    const op2: SyncQueueNoteOp = { noteId: 'syncNote2', action: 'delete', timestamp: new Date('2023-01-01T09:00:00Z'), nostrEventId: 'eventXYZ' };

    it('addNoteToSyncQueue should store operation with a new current timestamp', async () => {
      const originalTimestamp = new Date('2000-01-01');
      const opToAdd: SyncQueueNoteOp = { noteId: 'qnote1', action: 'save', timestamp: originalTimestamp };
      const timeBeforeAdding = new Date();

      await DBService.addNoteToSyncQueue(opToAdd);

      const callArg = (mockLocalforageInstance.setItem as vi.Mock).mock.calls[0][1] as SyncQueueNoteOp;
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith('qnote1', expect.any(Object));
      expect(callArg.noteId).toBe('qnote1');
      expect(callArg.action).toBe('save');
      expect(new Date(callArg.timestamp).getTime()).toBeGreaterThanOrEqual(timeBeforeAdding.getTime());
      expect(new Date(callArg.timestamp).getTime()).not.toBe(originalTimestamp.getTime());
    });

    it('getPendingNoteSyncOps should return sorted operations by timestamp (oldest first)', async () => {
      // Note: addNoteToSyncQueue overwrites timestamp, so we set them directly in mockStore for this test
      mockStore[op1.noteId] = op1; // timestamp: 2023-01-01T10:00:00Z
      mockStore[op2.noteId] = op2; // timestamp: 2023-01-01T09:00:00Z (older)

      // Simulate iterate for getPendingNoteSyncOps
      const mockIterateSyncOps = vi.fn((iterator: (value: any, key: string) => void) => {
        if (mockStore[op1.noteId]) iterator(mockStore[op1.noteId], op1.noteId);
        if (mockStore[op2.noteId]) iterator(mockStore[op2.noteId], op2.noteId);
        return Promise.resolve();
      });
      const originalIterate = mockLocalforageInstance.iterate;
      mockLocalforageInstance.iterate = mockIterateSyncOps;

      const ops = await DBService.getPendingNoteSyncOps();

      expect(ops.length).toBe(2);
      expect(ops[0].noteId).toBe(op2.noteId); // op2 is older, so should be first
      expect(ops[1].noteId).toBe(op1.noteId);

      mockLocalforageInstance.iterate = originalIterate;
    });

    it('getPendingNoteSyncOps should parse string timestamps in stored ops to Date objects', async () => {
      const opWithStringDate: SyncQueueNoteOp = { noteId: 'syncNote3', action: 'save', timestamp: new Date().toISOString() as any };
      mockStore[opWithStringDate.noteId] = opWithStringDate;

      const mockIterateSyncOps = vi.fn((iterator: (value: any, key: string) => void) => {
        if (mockStore[opWithStringDate.noteId]) iterator(mockStore[opWithStringDate.noteId], opWithStringDate.noteId);
        return Promise.resolve();
      });
      const originalIterate = mockLocalforageInstance.iterate;
      mockLocalforageInstance.iterate = mockIterateSyncOps;

      const ops = await DBService.getPendingNoteSyncOps();
      const retrievedOp = ops.find(o => o.noteId === 'syncNote3');
      expect(retrievedOp?.timestamp).toBeInstanceOf(Date);

      mockLocalforageInstance.iterate = originalIterate;
    });

    it('removeNoteFromSyncQueue should remove the specified operation', async () => {
      mockStore[op1.noteId] = op1;
      await DBService.removeNoteFromSyncQueue(op1.noteId);
      expect(mockLocalforageInstance.removeItem).toHaveBeenCalledWith(op1.noteId);
      expect(mockStore[op1.noteId]).toBeUndefined();
    });

    it('clearNoteSyncQueue should clear all pending note operations', async () => {
      mockStore[op1.noteId] = op1;
      mockStore[op2.noteId] = op2;
      // clearNoteSyncQueue calls syncQueueNotesStore.clear()
      // Our mock structure means this calls mockLocalforageInstance.clear()
      // This will clear EVERYTHING in mockStore, which is too broad for this specific test.
      // This highlights a limitation of the shared mockStore for testing targeted clears.
      // For this test, we'll assume it works if clear() is called on the correct conceptual store.

      // We can check if items are removed by directly checking mockStore IF clear was more targeted.
      // Since it's a global clear in the mock, we just check if clear was called.
      await DBService.clearNoteSyncQueue();
      expect(mockLocalforageInstance.clear).toHaveBeenCalled();
      // After a global clear, specific items would be undefined.
      // This test is fine if we assume syncQueueNotesStore is one of the stores cleared.
      // If we wanted to test that *only* syncQueueNotesStore was cleared, the mock needs adjustment.
    });
  });

  describe('Ontology Sync Flag Operations', () => {
    const ONTOLOGY_NEEDS_SYNC_KEY = 'ontology_needs_sync'; // As used in DBService

    it('setOntologyNeedsSync should save the flag', async () => {
      await DBService.setOntologyNeedsSync(true);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(ONTOLOGY_NEEDS_SYNC_KEY, true);
      await DBService.setOntologyNeedsSync(false);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(ONTOLOGY_NEEDS_SYNC_KEY, false);
    });

    it('getOntologyNeedsSync should retrieve the flag, defaulting to false if not set', async () => {
      mockStore[ONTOLOGY_NEEDS_SYNC_KEY] = true;
      let needsSync = await DBService.getOntologyNeedsSync();
      expect(needsSync).toBe(true);

      delete mockStore[ONTOLOGY_NEEDS_SYNC_KEY]; // Simulate not set
      needsSync = await DBService.getOntologyNeedsSync();
      expect(needsSync).toBe(false); // Default

      mockStore[ONTOLOGY_NEEDS_SYNC_KEY] = false;
      needsSync = await DBService.getOntologyNeedsSync();
      expect(needsSync).toBe(false);
    });
  });

  describe('Export/Import Operations', () => {
    it('exportData should gather all relevant data', async () => {
      // Populate some data
      mockStore[sampleNote.id] = sampleNote;
      mockStore['tree'] = sampleOntology; // Ontology key
      mockStore[sampleFolder.id] = sampleFolder;
      mockStore[sampleTemplate.id] = sampleTemplate;

      // Mock iterate for each getAll method
      const originalIterate = mockLocalforageInstance.iterate;
      mockLocalforageInstance.iterate = vi.fn((iterator) => {
        // This generic iterate needs to be smart or tests need to mock specific store contents
        // For simplicity, assume it iterates over relevant items for each type when called
        if (mockStore[sampleNote.id]) iterator(mockStore[sampleNote.id], sampleNote.id);
        if (mockStore[sampleFolder.id]) iterator(mockStore[sampleFolder.id], sampleFolder.id);
        if (mockStore[sampleTemplate.id]) iterator(mockStore[sampleTemplate.id], sampleTemplate.id);
        return Promise.resolve();
      });

      const exported = await DBService.exportData();

      expect(exported.notes).toEqual([sampleNote]);
      expect(exported.ontology).toEqual(sampleOntology);
      expect(exported.folders).toEqual([sampleFolder]);
      expect(exported.templates).toEqual([sampleTemplate]);

      mockLocalforageInstance.iterate = originalIterate;
    });

    it('importData should save all provided data', async () => {
      const dataToImport = {
        notes: [sampleNote],
        ontology: sampleOntology,
        folders: [sampleFolder],
        templates: [sampleTemplate],
      };
      await DBService.importData(dataToImport);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleNote.id, sampleNote);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith('tree', expect.objectContaining({nodes: sampleOntology.nodes})); // saveOntology updates timestamp
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleFolder.id, sampleFolder);
      expect(mockLocalforageInstance.setItem).toHaveBeenCalledWith(sampleTemplate.id, sampleTemplate);
    });
  });

  describe('Clear All Data', () => {
    it('should call clear on all localforage instances via the shared mock', async () => {
      mockStore['somekey'] = 'somevalue'; // Add some data to the shared mock store

      await DBService.clearAllData();

      // Since all createInstance calls return the same mockLocalforageInstance,
      // its clear method will be called multiple times (once for each conceptual store being cleared).
      // The important part is that the underlying shared mockStore becomes empty.
      expect(mockLocalforageInstance.clear).toHaveBeenCalled();
      // The number of times clear is called would be equal to the number of stores DBService.clearAllData tries to clear.
      // notes, ontology, user, folders, templates, messages, syncQueueNotes, syncFlags = 8 stores
      expect(mockLocalforageInstance.clear).toHaveBeenCalledTimes(8);
      expect(Object.keys(mockStore).length).toBe(0); // The shared store should be empty
    });
  });

});
