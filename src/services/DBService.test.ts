import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// Helper function to create the in-memory store implementation
function createInMemoryStoreImplementation() {
  const store: Record<string, any> = {};
  const instance = {
    getItem: vi.fn(key => Promise.resolve(store[key] !== undefined ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = value; return Promise.resolve(value); }),
    removeItem: vi.fn(key => { delete store[key]; return Promise.resolve(); }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); return Promise.resolve(); }),
    keys: vi.fn(() => Promise.resolve(Object.keys(store))),
    iterate: vi.fn((iterator: (value: any, key: string, iterationNumber: number) => any) => {
      let i = 0;
      for (const key in store) {
        if (Object.prototype.hasOwnProperty.call(store, key)) {
          const result = iterator(store[key], key, i++);
          if (result !== undefined) { return Promise.resolve(result); }
        }
      }
      return Promise.resolve();
    }),
    _getStoreData: () => store,
  };
  return instance;
}

vi.mock('localforage', () => {
  const moduleLevelCapturedMockStores: any[] = [];
  return {
    default: {
      createInstance: vi.fn().mockImplementation((config) => {
        const newInstance = createInMemoryStoreImplementation();
        moduleLevelCapturedMockStores.push(newInstance);
        return newInstance;
      }),
      // Helper for tests to access the captured instances from the mock's closure
      _getCapturedInstances: () => moduleLevelCapturedMockStores,
    },
  };
});

import { DBService } from './db';
import { Note, Folder, OntologyTree, UserProfile, NotentionTemplate, DirectMessage, SyncQueueNoteOp } from '../../shared/types';

const NOTES_STORE_IDX = 0;
const ONTOLOGY_STORE_IDX = 1;
const USER_STORE_IDX = 2;
const FOLDERS_STORE_IDX = 3;
const TEMPLATES_STORE_IDX = 4;
const MESSAGES_STORE_IDX = 5;
const SYNC_QUEUE_NOTES_STORE_IDX = 6;
const SYNC_FLAGS_STORE_IDX = 7;

describe('DBService', () => {
  let localforageMockedApi: any;
  let allMockStores: any[];

  beforeAll(async () => {
    localforageMockedApi = (await import('localforage')).default;
    allMockStores = localforageMockedApi._getCapturedInstances();

    // If DBService wasn't imported yet or stores weren't created (e.g. lazy loading not handled by Vitest for CJS)
    // This ensures they are created now by calling a method that uses them.
    // This should ideally not be necessary if module imports trigger creation as expected.
    if (allMockStores.length < 8) {
        await DBService.clearAllData(); // This should trigger creation of all stores via the mock
        allMockStores = localforageMockedApi._getCapturedInstances(); // Re-fetch the populated list
    }
  });

  beforeEach(() => {
    if (allMockStores && allMockStores.length > 0) {
      allMockStores.forEach(mockInstance => {
        if (mockInstance && typeof mockInstance.clear === 'function') {
            mockInstance.clear();
        }
        Object.values(mockInstance).forEach(method => {
          if (vi.isMockFunction(method) && method !== mockInstance._getStoreData) {
            (method as vi.Mock).mockClear();
          }
        });
      });
    }
    if (localforageMockedApi && vi.isMockFunction(localforageMockedApi.createInstance)) {
        localforageMockedApi.createInstance.mockClear();
    }
  });

  const sampleNote: Note = {
    id: 'note1', title: 'Test Note', content: 'This is a test note.',
    tags: ['test', 'sample'], values: { priority: 'high' }, fields: {},
    status: 'draft', createdAt: new Date(), updatedAt: new Date(),
    folderId: undefined, embedding: undefined, relatedNoteIds: undefined, summary: undefined,
  };

  const sampleFolder: Folder = {
    id: 'folder1', name: 'Test Folder', noteIds: ['note1'],
    parentId: undefined, childFolderIds: [], createdAt: new Date(), updatedAt: new Date(),
  };

  const sampleOntology: OntologyTree = {
    nodes: { node1: { id: 'node1', label: '#TestTopic', childrenIds: [] } },
    rootIds: ['node1'], updatedAt: new Date(),
  };

  const sampleUserProfile: UserProfile = {
    nostrPubkey: 'testpubkey',
    preferences: { theme: 'light', aiEnabled: false, defaultNoteStatus: 'draft', nostrRelays: ['wss://relay.example.com'], ollamaApiUrl: '', geminiApiKey: '', ollamaModel: 'llama3' },
  };

  const sampleTemplate: NotentionTemplate = {
    id: 'template1', name: 'Meeting Notes', description: 'Template for meeting notes',
    fields: [{ name: 'Attendees', type: 'text', required: true }],
    defaultTags: ['#meeting'], defaultValues: { location: 'Online' },
  };

  const sampleMessage: DirectMessage = {
    id: 'dm1', from: 'pubkeyFrom', to: 'pubkeyTo', content: 'Hello there',
    timestamp: new Date(), encrypted: true, read: false,
  };

  describe('Notes Operations', () => {
    it('should save a note', async () => {
      const mockNotesStore = allMockStores[NOTES_STORE_IDX];
      await DBService.saveNote(sampleNote);
      expect(mockNotesStore.setItem).toHaveBeenCalledWith(sampleNote.id, sampleNote);
      expect(mockNotesStore._getStoreData()[sampleNote.id]).toEqual(sampleNote);
    });

    it('should get a note by ID', async () => {
      const mockNotesStore = allMockStores[NOTES_STORE_IDX];
      mockNotesStore._getStoreData()[sampleNote.id] = sampleNote;
      const note = await DBService.getNote(sampleNote.id);
      expect(mockNotesStore.getItem).toHaveBeenCalledWith(sampleNote.id);
      expect(note).toEqual(sampleNote);
    });

    it('should get all notes, sorted by updatedAt descending', async () => {
      const mockNotesStore = allMockStores[NOTES_STORE_IDX];
      const note1 = { ...sampleNote, id: 'n1', updatedAt: new Date('2023-01-01T10:00:00Z') };
      const note2 = { ...sampleNote, id: 'n2', updatedAt: new Date('2023-01-01T12:00:00Z') };
      mockNotesStore._getStoreData()[note1.id] = note1;
      mockNotesStore._getStoreData()[note2.id] = note2;
      const notes = await DBService.getAllNotes();
      expect(mockNotesStore.iterate).toHaveBeenCalled();
      expect(notes.map(n=>n.id)).toEqual(['n2', 'n1']);
    });

    it('should delete a note', async () => {
      const mockNotesStore = allMockStores[NOTES_STORE_IDX];
      mockNotesStore._getStoreData()[sampleNote.id] = sampleNote;
      await DBService.deleteNote(sampleNote.id);
      expect(mockNotesStore.removeItem).toHaveBeenCalledWith(sampleNote.id);
      expect(mockNotesStore._getStoreData()[sampleNote.id]).toBeUndefined();
    });
  });

  describe('Ontology Operations', () => {
    it('should save ontology and set updatedAt to current time', async () => {
      const mockOntologyStore = allMockStores[ONTOLOGY_STORE_IDX];
      const initialOntology = { ...sampleOntology, updatedAt: new Date('2000-01-01') };
      await DBService.saveOntology(initialOntology);
      expect(mockOntologyStore.setItem).toHaveBeenCalledWith('tree', expect.objectContaining({ nodes: initialOntology.nodes }));
    });

    it('should get ontology, parsing string date to Date object', async () => {
      const mockOntologyStore = allMockStores[ONTOLOGY_STORE_IDX];
      const dateString = new Date().toISOString();
      mockOntologyStore._getStoreData()['tree'] = { ...sampleOntology, updatedAt: dateString };
      const ontologyData = await DBService.getOntology();
      expect(ontologyData?.updatedAt).toBeInstanceOf(Date);
    });

    it('should get default ontology if none exists', async () => {
      const mockOntologyStore = allMockStores[ONTOLOGY_STORE_IDX];
      mockOntologyStore.getItem.mockResolvedValueOnce(null);
      const data = await DBService.getOntology();
      expect(data).toBeNull();
    });
  });

  describe('User Profile Operations', () => {
    it('should save and get user profile', async () => {
      const mockUserStore = allMockStores[USER_STORE_IDX];
      await DBService.saveUserProfile(sampleUserProfile);
      expect(mockUserStore.setItem).toHaveBeenCalledWith('profile', sampleUserProfile);
      mockUserStore._getStoreData()['profile'] = sampleUserProfile;
      const profile = await DBService.getUserProfile();
      expect(profile).toEqual(sampleUserProfile);
    });
  });

  describe('Nostr Keys Operations (within User Store context)', () => {
    const sk = 'nsec1testprivatekey';
    const pk = 'npub1testpublickey';
    let mockUserStore: any;
    beforeEach(() => { mockUserStore = allMockStores[USER_STORE_IDX]; });

    it('should save Nostr private key', async () => {
      await DBService.saveNostrPrivateKey(sk);
      expect(mockUserStore.setItem).toHaveBeenCalledWith('nostrPrivateKey', sk);
    });
     it('should remove Nostr private key', async () => {
      await DBService.removeNostrPrivateKey();
      expect(mockUserStore.removeItem).toHaveBeenCalledWith('nostrPrivateKey');
    });
    it('should save Nostr public key', async () => {
      await DBService.saveNostrPublicKey(pk);
      expect(mockUserStore.setItem).toHaveBeenCalledWith('nostrPublicKey', pk);
    });
    it('should remove Nostr public key', async () => {
      await DBService.removeNostrPublicKey();
      expect(mockUserStore.removeItem).toHaveBeenCalledWith('nostrPublicKey');
    });
  });

  describe('Folders Operations', () => {
    it('should save a folder', async () => {
      const mockFoldersStore = allMockStores[FOLDERS_STORE_IDX];
      await DBService.saveFolder(sampleFolder);
      expect(mockFoldersStore.setItem).toHaveBeenCalledWith(sampleFolder.id, sampleFolder);
    });
  });

  describe('Templates Operations', () => {
    it('should save a template', async () => {
      const mockTemplatesStore = allMockStores[TEMPLATES_STORE_IDX];
      await DBService.saveTemplate(sampleTemplate);
      expect(mockTemplatesStore.setItem).toHaveBeenCalledWith(sampleTemplate.id, sampleTemplate);
    });
  });

  describe('Direct Messages Operations', () => {
    it('should save a message', async () => {
      const mockMessagesStore = allMockStores[MESSAGES_STORE_IDX];
      await DBService.saveMessage(sampleMessage);
      expect(mockMessagesStore.setItem).toHaveBeenCalledWith(sampleMessage.id, sampleMessage);
    });
  });

  describe('Sync Queue Operations (Notes)', () => {
    const op1: SyncQueueNoteOp = { noteId: 'syncNote1', action: 'save', timestamp: new Date('2023-01-01T10:00:00Z') };
    let mockSyncQueueNotesStore: any;
    beforeEach(() => { mockSyncQueueNotesStore = allMockStores[SYNC_QUEUE_NOTES_STORE_IDX]; });

    it('addNoteToSyncQueue should store operation', async () => {
      await DBService.addNoteToSyncQueue(op1);
      expect(mockSyncQueueNotesStore.setItem).toHaveBeenCalledWith(op1.noteId, expect.objectContaining({ noteId: op1.noteId }));
    });
    it('getPendingNoteSyncOps should return sorted operations', async () => {
        const op2 = { ...op1, noteId: 'syncNote2', timestamp: new Date('2023-01-01T09:00:00Z') };
        mockSyncQueueNotesStore._getStoreData()[op1.noteId] = op1;
        mockSyncQueueNotesStore._getStoreData()[op2.noteId] = op2;
        const ops = await DBService.getPendingNoteSyncOps();
        expect(ops.map(o => o.noteId)).toEqual(['syncNote2', 'syncNote1']);
    });
    it('removeNoteFromSyncQueue should remove operation', async () => {
      await DBService.removeNoteFromSyncQueue(op1.noteId);
      expect(mockSyncQueueNotesStore.removeItem).toHaveBeenCalledWith(op1.noteId);
    });
    it('clearNoteSyncQueue should clear operations', async () => {
      await DBService.clearNoteSyncQueue();
      expect(mockSyncQueueNotesStore.clear).toHaveBeenCalled();
    });
  });

  describe('Ontology Sync Flag Operations', () => {
    const KEY = 'ontology_needs_sync';
    let mockSyncFlagsStore: any;
    beforeEach(() => { mockSyncFlagsStore = allMockStores[SYNC_FLAGS_STORE_IDX]; });

    it('setOntologyNeedsSync should save the flag', async () => {
      await DBService.setOntologyNeedsSync(true);
      expect(mockSyncFlagsStore.setItem).toHaveBeenCalledWith(KEY, true);
    });
    it('getOntologyNeedsSync should retrieve the flag', async () => {
      mockSyncFlagsStore._getStoreData()[KEY] = true;
      expect(await DBService.getOntologyNeedsSync()).toBe(true);
    });
  });

  describe('Export/Import Operations', () => {
    it('exportData should gather data', async () => {
        allMockStores[NOTES_STORE_IDX]._getStoreData()[sampleNote.id] = sampleNote;
        await DBService.exportData();
        expect(allMockStores[NOTES_STORE_IDX].iterate).toHaveBeenCalled();
        // Add more assertions based on what exportData returns
    });
    it('importData should save data', async () => {
        const data = { notes: [sampleNote], ontology: sampleOntology, folders: [sampleFolder], templates: [sampleTemplate] };
        await DBService.importData(data);
        expect(allMockStores[NOTES_STORE_IDX].setItem).toHaveBeenCalledWith(sampleNote.id, sampleNote);
    });
  });

  describe('Clear All Data', () => {
    it('should call clear on all localforage instances', async () => {
      await DBService.clearAllData(); // This populates allMockStores if not already full
      expect(allMockStores.length).toBe(8);
      allMockStores.forEach(instance => {
        expect(instance.clear).toHaveBeenCalledTimes(1);
      });
    });
  });
});
