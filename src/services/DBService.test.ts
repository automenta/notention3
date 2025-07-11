import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DBService, SyncQueueNoteOp } from './db'; // Import DBService and SyncQueueNoteOp
import { Note, OntologyTree, UserProfile, Folder, NotentionTemplate, DirectMessage } from '../../shared/types';

// Mock localforage
const mockLocalForageStore: Record<string, any> = {};
const mockLocalForageInstance = {
  setItem: vi.fn(async (key, value) => {
    mockLocalForageStore[key] = value;
    return value;
  }),
  getItem: vi.fn(async (key) => mockLocalForageStore[key] || null),
  removeItem: vi.fn(async (key) => {
    delete mockLocalForageStore[key];
  }),
  clear: vi.fn(async () => {
    for (const key in mockLocalForageStore) {
      delete mockLocalForageStore[key];
    }
  }),
  iterate: vi.fn(async (iterator: (value: any, key: string, iterationNumber: number) => any) => {
    let i = 0;
    for (const key in mockLocalForageStore) {
      iterator(mockLocalForageStore[key], key, i++);
    }
  }),
  // createInstance: vi.fn(() => mockLocalForageInstance), // This was causing issues, direct use is fine for mock
};

vi.mock('localforage', () => ({
  default: {
    createInstance: () => mockLocalForageInstance,
  },
}));


describe('DBService', () => {
  // Helper to clear the mock store before each test specific to a localforage instance
  const clearMockStoreForInstance = () => {
    for (const key in mockLocalForageStore) {
      delete mockLocalForageStore[key];
    }
    mockLocalForageInstance.setItem.mockClear();
    mockLocalForageInstance.getItem.mockClear();
    mockLocalForageInstance.removeItem.mockClear();
    mockLocalForageInstance.clear.mockClear();
    mockLocalForageInstance.iterate.mockClear();
  };


  describe('Notes Operations', () => {
    const testNote: Note = {
      id: 'note1',
      title: 'Test Note',
      content: 'This is a test note.',
      tags: [],
      values: {},
      fields: {},
      status: 'draft',
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T11:00:00Z'),
    };

    beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should save and get a note', async () => {
      await DBService.saveNote(testNote);
      const retrievedNote = await DBService.getNote('note1');
      expect(retrievedNote).toEqual(testNote);
      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith('note1', testNote);
    });

    it('should get all notes, sorted by updatedAt descending', async () => {
      const note1 = { ...testNote, id: 'n1', updatedAt: new Date('2023-01-01') };
      const note2 = { ...testNote, id: 'n2', updatedAt: new Date('2023-01-03') };
      const note3 = { ...testNote, id: 'n3', updatedAt: new Date('2023-01-02') };
      // Simulating multiple saves to the same "store" instance
      mockLocalForageStore['n1'] = note1;
      mockLocalForageStore['n2'] = note2;
      mockLocalForageStore['n3'] = note3;


      const allNotes = await DBService.getAllNotes();
      expect(allNotes).toHaveLength(3);
      expect(allNotes[0].id).toBe('n2'); // Most recent
      expect(allNotes[1].id).toBe('n3');
      expect(allNotes[2].id).toBe('n1');
      expect(mockLocalForageInstance.iterate).toHaveBeenCalled();
    });

    it('should delete a note', async () => {
      mockLocalForageStore['note1'] = testNote;
      await DBService.deleteNote('note1');
      const retrievedNote = await DBService.getNote('note1');
      expect(retrievedNote).toBeNull();
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('note1');
    });

    it('should search notes by query (title, content, tags)', async () => {
      const note1: Note = { ...testNote, id: 's1', title: 'Apple Pie Recipe', content: 'Delicious apples.', tags: ['#dessert'] };
      const note2: Note = { ...testNote, id: 's2', title: 'Banana Bread', content: 'Sweet bananas.', tags: ['#baking', '#dessert'] };
      mockLocalForageStore['s1'] = note1;
      mockLocalForageStore['s2'] = note2;

      let results = await DBService.searchNotes('apple');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s1');

      results = await DBService.searchNotes('dessert');
      expect(results).toHaveLength(2);

      results = await DBService.searchNotes('banana');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s2');
    });
  });

  describe('Ontology Operations', () => {
    const testOntology: OntologyTree = {
      nodes: { 'node1': { id: 'node1', label: '#Test', children: [] } },
      rootIds: ['node1'],
      updatedAt: new Date('2023-02-01T10:00:00Z'),
    };

    beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should save and get ontology', async () => {
      await DBService.saveOntology(testOntology);
      const savedItem = mockLocalForageStore['tree'];
      expect(savedItem.nodes).toEqual(testOntology.nodes);
      expect(savedItem.updatedAt).toBeInstanceOf(Date);
      expect(savedItem.updatedAt.getTime()).toBeGreaterThanOrEqual(testOntology.updatedAt.getTime());

      const retrievedOntology = await DBService.getOntology();
      expect(retrievedOntology).toEqual(savedItem);
    });

    it('should convert string updatedAt to Date object when getting ontology', async () => {
        const ontologyWithStringDate = {
            ...testOntology,
            updatedAt: new Date().toISOString(),
        };
        mockLocalForageStore['tree'] = ontologyWithStringDate;

        const retrieved = await DBService.getOntology();
        expect(retrieved?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return default ontology if none exists', async () => {
      const defaultOnto = await DBService.getDefaultOntology();
      expect(defaultOnto.nodes['ai']).toBeDefined();
      expect(defaultOnto.nodes['project']).toBeDefined();
    });
  });

  describe('User Profile & Nostr Keys Operations', () => {
    const testProfile: UserProfile = {
      nostrPubkey: 'pk123',
      sharedTags: [],
      preferences: { theme: 'dark', aiEnabled: true, defaultNoteStatus: 'published' },
    };

    beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should save and get user profile', async () => {
      await DBService.saveUserProfile(testProfile);
      const retrievedProfile = await DBService.getUserProfile();
      expect(retrievedProfile).toEqual(testProfile);
    });

    it('should save, get, and remove Nostr private key', async () => {
      await DBService.saveNostrPrivateKey('sk123');
      expect(await DBService.getNostrPrivateKey()).toBe('sk123');
      await DBService.removeNostrPrivateKey();
      expect(await DBService.getNostrPrivateKey()).toBeNull();
    });

    it('should save, get, and remove Nostr public key', async () => {
      await DBService.saveNostrPublicKey('pk123');
      expect(await DBService.getNostrPublicKey()).toBe('pk123');
      await DBService.removeNostrPublicKey();
      expect(await DBService.getNostrPublicKey()).toBeNull();
    });
  });

  describe('Folders Operations', () => {
    const testFolder: Folder = {
      id: 'folder1', name: 'Test Folder', noteIds: [], children: [], createdAt: new Date(), updatedAt: new Date()
    };
     beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should save and get a folder', async () => {
      await DBService.saveFolder(testFolder);
      const retrieved = await DBService.getFolder('folder1');
      expect(retrieved).toEqual(testFolder);
    });

    it('should get all folders sorted by name', async () => {
      const folderA = { ...testFolder, id: 'fA', name: 'Alpha' };
      const folderC = { ...testFolder, id: 'fC', name: 'Charlie' };
      const folderB = { ...testFolder, id: 'fB', name: 'Bravo' };
      mockLocalForageStore['fA'] = folderA;
      mockLocalForageStore['fC'] = folderC;
      mockLocalForageStore['fB'] = folderB;
      const allFolders = await DBService.getAllFolders();
      expect(allFolders).toHaveLength(3);
      expect(allFolders[0].name).toBe('Alpha');
      expect(allFolders[1].name).toBe('Bravo');
      expect(allFolders[2].name).toBe('Charlie');
    });

    it('should delete a folder', async () => {
      mockLocalForageStore['folder1'] = testFolder;
      await DBService.deleteFolder('folder1');
      expect(await DBService.getFolder('folder1')).toBeNull();
    });
  });

  describe('Templates Operations', () => {
    const testTemplate: NotentionTemplate = {
      id: 'template1', name: 'Test Template', description: '', fields: [], defaultTags: [], defaultValues: {}
    };
    beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should save and get a template', async () => {
      await DBService.saveTemplate(testTemplate);
      const retrieved = await DBService.getTemplate('template1');
      expect(retrieved).toEqual(testTemplate);
    });

    it('should get all templates sorted by name', async () => {
      const templateA = { ...testTemplate, id: 'tA', name: 'Alpha Template' };
      const templateC = { ...testTemplate, id: 'tC', name: 'Charlie Template' };
      const templateB = { ...testTemplate, id: 'tB', name: 'Bravo Template' };
      mockLocalForageStore['tA'] = templateA;
      mockLocalForageStore['tC'] = templateC;
      mockLocalForageStore['tB'] = templateB;
      const allTemplates = await DBService.getAllTemplates();
      expect(allTemplates).toHaveLength(3);
      expect(allTemplates[0].name).toBe('Alpha Template');
      expect(allTemplates[1].name).toBe('Bravo Template');
      expect(allTemplates[2].name).toBe('Charlie Template');
    });

    it('should delete a template', async () => {
      mockLocalForageStore['template1'] = testTemplate;
      await DBService.deleteTemplate('template1');
      expect(await DBService.getTemplate('template1')).toBeNull();
    });

    it('should return default templates', async () => {
        const defaultTemplates = await DBService.getDefaultTemplates();
        expect(defaultTemplates.length).toBeGreaterThan(0);
        expect(defaultTemplates.find(t => t.id === 'meeting-note')).toBeDefined();
    });
  });

  describe('Direct Messages Operations', () => {
    const testMessage: DirectMessage = {
      id: 'dm1', from: 'userA', to: 'userB', content: 'Hello', timestamp: new Date(), encrypted: true
    };
    beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should save and get a message', async () => {
      await DBService.saveMessage(testMessage);
      const retrieved = await DBService.getMessage('dm1');
      expect(retrieved).toEqual(testMessage);
    });

    it('should get all messages sorted by timestamp descending', async () => {
      const msg1 = { ...testMessage, id: 'm1', timestamp: new Date('2023-03-01') };
      const msg3 = { ...testMessage, id: 'm3', timestamp: new Date('2023-03-03') };
      const msg2 = { ...testMessage, id: 'm2', timestamp: new Date('2023-03-02') };
      mockLocalForageStore['m1'] = msg1;
      mockLocalForageStore['m3'] = msg3;
      mockLocalForageStore['m2'] = msg2;
      const allMessages = await DBService.getAllMessages();
      expect(allMessages).toHaveLength(3);
      expect(allMessages[0].id).toBe('m3');
      expect(allMessages[1].id).toBe('m2');
      expect(allMessages[2].id).toBe('m1');
    });

    it('should get messages for a specific user', async () => {
      const msgToUserA = { ...testMessage, id: 'm_to_A', to: 'userA', from: 'userC' };
      const msgFromUserA = { ...testMessage, id: 'm_from_A', from: 'userA', to: 'userD' };
      const msgOther = { ...testMessage, id: 'm_other', from: 'userX', to: 'userY' };
      mockLocalForageStore['m_to_A'] = msgToUserA;
      mockLocalForageStore['m_from_A'] = msgFromUserA;
      mockLocalForageStore['m_other'] = msgOther;

      const userAMessages = await DBService.getMessagesForUser('userA');
      expect(userAMessages).toHaveLength(2);
      expect(userAMessages.some(m => m.id === 'm_to_A')).toBe(true);
      expect(userAMessages.some(m => m.id === 'm_from_A')).toBe(true);
    });
  });

  describe('Import/Export Operations', () => {
     beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should export data from all stores', async () => {
      const note: Note = { id: 'expN1', title: 'Export Note', content: '', tags:[], values:{}, fields:{}, status: 'draft', createdAt: new Date(), updatedAt: new Date() };
      const ontology: OntologyTree = { nodes: { 'expO1': { id: 'expO1', label: '#ExportOnto', children:[]} }, rootIds: ['expO1'], updatedAt: new Date() };
      const folder: Folder = { id: 'expF1', name: 'Export Folder', noteIds:[], children:[], createdAt: new Date(), updatedAt: new Date() };
      const template: NotentionTemplate = { id: 'expT1', name: 'Export Template', description:'', fields:[], defaultTags:[], defaultValues:{} };

      // Populate the mock store
      mockLocalForageStore['expN1'] = note;
      mockLocalForageStore['tree'] = ontology;
      mockLocalForageStore['expF1'] = folder;
      mockLocalForageStore['expT1'] = template;

      const exportedData = await DBService.exportData();

      expect(exportedData.notes.find(n => n.id === 'expN1')).toBeDefined();
      expect(exportedData.ontology?.nodes['expO1']).toBeDefined();
      expect(exportedData.folders.find(f => f.id === 'expF1')).toBeDefined();
      expect(exportedData.templates.find(t => t.id === 'expT1')).toBeDefined();
    });

    it('should import data into respective stores', async () => {
      const importDataPayload = {
        notes: [{ id: 'impN1', title: 'Imported Note', content: '', tags:[], values:{}, fields:{}, status: 'draft', createdAt: new Date(), updatedAt: new Date() }],
        ontology: { nodes: { 'impO1': {id: 'impO1', label: '#ImportedOnto', children:[]} }, rootIds: ['impO1'], updatedAt: new Date() },
        folders: [{ id: 'impF1', name: 'Imported Folder', noteIds:[], children:[], createdAt: new Date(), updatedAt: new Date() }],
        templates: [{ id: 'impT1', name: 'Imported Template', description:'', fields:[], defaultTags:[], defaultValues:{} }],
      };

      await DBService.importData(importDataPayload);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith('impN1', importDataPayload.notes[0]);
      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith('tree', expect.objectContaining({ nodes: importDataPayload.ontology.nodes }));
      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith('impF1', importDataPayload.folders[0]);
      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith('impT1', importDataPayload.templates[0]);
    });
  });

  describe('Clear All Data', () => {
    it('should clear all data from all stores', async () => {
      mockLocalForageStore['notesKey'] = {data: 'note data'};
      mockLocalForageStore['ontologyKey'] = {data: 'ontology data'};

      await DBService.clearAllData();
      // DBService.clearAllData calls .clear() on each store instance.
      // Since our mock uses one shared backing store (mockLocalForageStore) and one shared mockInstance,
      // the mockLocalForageStore will be empty after the first .clear() call on the mockInstance.
      // The number of times mockLocalForageInstance.clear() is called depends on how many
      // store instances DBService.clearAllData() iterates over.
      // Based on db.ts, it's 7 stores (notes, ontology, user, folders, templates, messages, syncQueueNotes, syncFlags).
      // However, the mock setup for localforage.createInstance might always return the SAME mockLocalForageInstance.
      // If localforage.createInstance always returns the same mock instance, then .clear() is called on that same instance multiple times.
      // Let's check the current mock: vi.mock('localforage', () => ({ default: { createInstance: () => mockLocalForageInstance } }));
      // This means .clear() will be called multiple times on the *same* mock instance.
      const numberOfStoresCleared = 8; // notes, ontology, user, folders, templates, messages, syncQueueNotesStore, syncFlagsStore
      expect(mockLocalForageInstance.clear).toHaveBeenCalledTimes(numberOfStoresCleared);
      expect(Object.keys(mockLocalForageStore)).toHaveLength(0); // The backing store should be empty
    });
  });


  describe('Sync Queue Operations', () => {
    const op1: SyncQueueNoteOp = { noteId: 'qn1', action: 'save', timestamp: new Date('2023-04-01') };
    const op2: SyncQueueNoteOp = { noteId: 'qn2', action: 'delete', timestamp: new Date('2023-04-02'), nostrEventId: 'evt123' };

    beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should add, get, and remove note operations from sync queue', async () => {
      await DBService.addNoteToSyncQueue(op1);
      const currentOp1 = mockLocalForageStore[op1.noteId];
      expect(currentOp1.noteId).toBe(op1.noteId);
      expect(currentOp1.action).toBe(op1.action);
      expect(currentOp1.timestamp).toBeInstanceOf(Date);

      await DBService.addNoteToSyncQueue(op2);
      const currentOp2 = mockLocalForageStore[op2.noteId];
      expect(currentOp2.noteId).toBe(op2.noteId);
      expect(currentOp2.action).toBe(op2.action);
      expect(currentOp2.nostrEventId).toBe(op2.nostrEventId);

      const pendingOps = await DBService.getPendingNoteSyncOps();
      expect(pendingOps).toHaveLength(2);
      expect(pendingOps.find(p => p.noteId === 'qn1')).toBeDefined();
      expect(pendingOps.find(p => p.noteId === 'qn2')).toBeDefined();

      await DBService.removeNoteFromSyncQueue('qn1');
      const remainingOps = await DBService.getPendingNoteSyncOps();
      expect(remainingOps).toHaveLength(1);
      // The order after removal depends on how iterate works and if only 'qn2' remains.
      // If 'qn2' is the only one, it will be the first.
      expect(remainingOps[0].noteId).toBe('qn2');


      await DBService.clearNoteSyncQueue();
      expect(await DBService.getPendingNoteSyncOps()).toHaveLength(0);
    });

     it('getPendingNoteSyncOps should convert string timestamps to Date objects and sort correctly', async () => {
      const opStrDateEarly: SyncQueueNoteOp = {
        noteId: 'q_str_early', action: 'save', timestamp: new Date('2023-01-01T00:00:00.000Z').toISOString() as any,
      };
      const opStrDateLate: SyncQueueNoteOp = {
        noteId: 'q_str_late', action: 'save', timestamp: new Date('2023-01-03T00:00:00.000Z').toISOString() as any,
      };
       const opDateMiddle = {
        noteId: 'q_date_middle', action: 'save', timestamp: new Date('2023-01-02T00:00:00.000Z'),
      };

      mockLocalForageStore[opStrDateEarly.noteId] = opStrDateEarly;
      mockLocalForageStore[opStrDateLate.noteId] = opStrDateLate;
      mockLocalForageStore[opDateMiddle.noteId] = opDateMiddle;


      const pendingOps = await DBService.getPendingNoteSyncOps();
      expect(pendingOps).toHaveLength(3);
      expect(pendingOps[0].timestamp).toBeInstanceOf(Date);
      expect(pendingOps[1].timestamp).toBeInstanceOf(Date);
      expect(pendingOps[2].timestamp).toBeInstanceOf(Date);

      // Check sorting (oldest first)
      expect(pendingOps[0].noteId).toBe('q_str_early');
      expect(pendingOps[1].noteId).toBe('q_date_middle');
      expect(pendingOps[2].noteId).toBe('q_str_late');
    });
  });

  describe('Ontology Sync Flag Operations', () => {
     beforeEach(() => {
      clearMockStoreForInstance();
    });

    it('should set and get ontology needs sync flag', async () => {
      expect(await DBService.getOntologyNeedsSync()).toBe(false);

      await DBService.setOntologyNeedsSync(true);
      expect(await DBService.getOntologyNeedsSync()).toBe(true);

      await DBService.setOntologyNeedsSync(false);
      expect(await DBService.getOntologyNeedsSync()).toBe(false);
    });
  });
});
