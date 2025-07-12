import { NostrService, nostrServiceInstance } from './NostrService'; // Assuming nostrServiceInstance is the exported singleton
import { DBService } from './db';
import { generatePrivateKey, getPublicKey, nip04, SimplePool } from 'nostr-tools';
import { Note } from '../../shared/types';

import { NostrService, nostrServiceInstance } from './NostrService';
import { DBService } from './db';
import { Note } from '../../shared/types';

// Mock DBService
vi.mock('./db');

// Centralized Mocks for nostr-tools
const mockSubInstance = {
  on: vi.fn(),
  unsub: vi.fn(),
};

const mockPoolInstance = {
  publish: vi.fn(),
  sub: vi.fn(() => mockSubInstance),
  list: vi.fn(),
  get: vi.fn(),
  close: vi.fn(),
};

const mockGenerateSecretKey = vi.fn(() => new Uint8Array(Array(32).fill(0xaa)));
const mockGetPublicKey = vi.fn(() => 'mockPublicKey_for_aa_bytes');
const mockEncrypt = vi.fn(async (privkeyHex, pubkeyHex, text) => `encrypted_${text}_by_${privkeyHex}_for_${pubkeyHex}`);
const mockDecrypt = vi.fn(async (privkeyHex, pubkeyHex, payload) => payload.replace(`encrypted_`, '').replace(/_by_.*_for_.*/, ''));
const mockFinalizeEvent = vi.fn((unsignedEvent, privateKeyHex) => ({
  ...unsignedEvent,
  id: `mockEventId_${unsignedEvent.created_at}_${Math.random()}`,
  sig: `mockSig_for_${privateKeyHex}`,
}));

vi.mock('nostr-tools', () => ({
  generateSecretKey: mockGenerateSecretKey,
  getPublicKey: mockGetPublicKey,
  nip04: {
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  },
  SimplePool: vi.fn(() => mockPoolInstance),
  finalizeEvent: mockFinalizeEvent,
}));


describe('NostrService', () => {
  let serviceInstance: NostrService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Reset the state of the singleton instance by clearing its keys
    nostrServiceInstance.clearKeyPair();

    // Setup default mock behaviors for services
    vi.mocked(DBService.getNostrPrivateKey).mockResolvedValue(null);
    vi.mocked(DBService.getNostrPublicKey).mockResolvedValue(null);
    vi.mocked(mockPoolInstance.list).mockResolvedValue([]);
    vi.mocked(mockPoolInstance.get).mockResolvedValue(null);
    vi.mocked(mockPoolInstance.publish).mockImplementation(() => [Promise.resolve()]);

    // Re-assign the singleton instance for clarity in tests
    serviceInstance = nostrServiceInstance;
  });

  describe('Key Management', () => {
    it('should generate a new key pair', () => {
      const keys = serviceInstance.generateNewKeyPair();
      expect(mockGenerateSecretKey).toHaveBeenCalled();
      expect(mockGetPublicKey).toHaveBeenCalledWith(new Uint8Array(Array(32).fill(0xaa)));
      expect(keys.privateKey).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(keys.publicKey).toBe('mockPublicKey_for_aa_bytes');
    });

    it('should store a key pair using DBService', async () => {
      const sk = 'testPrivKey';
      const pk = 'testPubKey';
      await serviceInstance.storeKeyPair(sk, pk);
      expect(DBService.saveNostrPrivateKey).toHaveBeenCalledWith(sk);
      expect(DBService.saveNostrPublicKey).toHaveBeenCalledWith(pk);
      expect(serviceInstance.getPrivateKey()).toBe(sk);
      expect(serviceInstance.getPublicKey()).toBe(pk);
    });

    it('should load a key pair from DBService', async () => {
      // We directly use the vi.mocked versions which are guaranteed to be mock functions.
      vi.mocked(DBService.getNostrPrivateKey).mockResolvedValue('loadedPrivKey');
      vi.mocked(DBService.getNostrPublicKey).mockResolvedValue('loadedPubKey');

      const loaded = await serviceInstance.loadKeyPair();
      expect(loaded).toBe(true);
      expect(serviceInstance.getPrivateKey()).toBe('loadedPrivKey');
      expect(serviceInstance.getPublicKey()).toBe('loadedPubKey');
    });

    it('should return false if key pair not found in DBService', async () => {
      const loaded = await serviceInstance.loadKeyPair();
      expect(loaded).toBe(false);
      expect(serviceInstance.getPrivateKey()).toBeNull();
      expect(serviceInstance.getPublicKey()).toBeNull();
    });

    it('should clear a key pair from DBService and instance', async () => {
      await serviceInstance.storeKeyPair('testSk', 'testPk'); // Store first
      await serviceInstance.clearKeyPair();
      expect(DBService.removeNostrPrivateKey).toHaveBeenCalled();
      expect(DBService.removeNostrPublicKey).toHaveBeenCalled();
      expect(serviceInstance.getPrivateKey()).toBeNull();
      expect(serviceInstance.getPublicKey()).toBeNull();
    });

    it('isLoggedIn should return true if keys are loaded', async () => {
        await serviceInstance.storeKeyPair('testSk', 'testPk');
        expect(serviceInstance.isLoggedIn()).toBe(true);
    });

    it('isLoggedIn should return false if keys are not loaded', () => {
        // The beforeEach block already ensures keys are cleared
        expect(serviceInstance.isLoggedIn()).toBe(false);
    });
  });

  describe('Note Publishing', () => {
    const mockNote: Note = {
      id: 'note1',
      title: 'Test Note',
      content: 'Hello Nostr!',
      tags: ['#test', '#nostr'],
      values: { project: 'notention' },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      fields: {},
    };
    const defaultRelays = ['wss://relay.example.com'];

    beforeEach(async () => {
      // Ensure user is "logged in" for these tests
      await serviceInstance.storeKeyPair('mySkHex', 'myPkHex');
      (serviceInstance as any).defaultRelays = defaultRelays;
    });

    it('should throw error if trying to publish when not logged in', async () => {
      await serviceInstance.clearKeyPair(); // Logout
      await expect(serviceInstance.publishNote(mockNote)).rejects.toThrow('User not logged in');
    });

    it('should publish a public note correctly', async () => {
      const privacyAllowPublic = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyAllowPublic);

      expect(mockPoolInstance.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];

      expect(publishedEvent.kind).toBe(1);
      expect(publishedEvent.pubkey).toBe('myPkHex');
      expect(publishedEvent.content).toBe(mockNote.content);
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([
        ['d', 'note1'],
        ['title', 'Test Note'],
        ['t', 'test'],
        ['t', 'nostr'],
        ['param', 'project', 'notention'],
        expect.arrayContaining(['published_at', expect.any(String)]),
      ]));
    });

    it('should publish an encrypted note correctly', async () => {
      const recipientPkHex = 'recipientPkHex';
      await serviceInstance.publishNote(mockNote, undefined, true, recipientPkHex, undefined);

      expect(mockEncrypt).toHaveBeenCalledWith('mySkHex', recipientPkHex, mockNote.content);
      expect(mockPoolInstance.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];

      expect(publishedEvent.kind).toBe(4);
      expect(publishedEvent.pubkey).toBe('myPkHex');
      expect(publishedEvent.content).toBe(`encrypted_${mockNote.content}_by_mySkHex_for_${recipientPkHex}`);
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([
        ['p', recipientPkHex]
      ]));
    });

    it('should respect privacy settings: no tags for public notes', async () => {
      const privacyNoTags = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: false, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyNoTags);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([['t', 'test']]));
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([['param', 'project', 'notention']]));
    });

    it('should respect privacy settings: no values for public notes', async () => {
      const privacyNoValues = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: false, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyNoValues);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([['t', 'test']]));
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([['param', 'project', 'notention']]));
    });

    it('should include embedding tag if public, enabled, and present', async () => {
      const noteWithEmbedding = { ...mockNote, embedding: [0.1, 0.2, 0.3] };
      const privacyAllowEmbeddings = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: true };
      await serviceInstance.publishNote(noteWithEmbedding, undefined, false, undefined, privacyAllowEmbeddings);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([
        ['embedding', JSON.stringify([0.1, 0.2, 0.3])]
      ]));
    });

    it('should NOT include embedding tag if public but sharing disabled', async () => {
      const noteWithEmbedding = { ...mockNote, embedding: [0.1, 0.2, 0.3] };
      const privacyDisallowEmbeddings = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(noteWithEmbedding, undefined, false, undefined, privacyDisallowEmbeddings);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([
        expect.arrayContaining(['embedding'])
      ]));
    });

    // Test for sharePublicNotesGlobally: false is tricky here as the service currently proceeds
    // The store action `publishCurrentNoteToNostr` is responsible for blocking based on this setting.
    // If NostrService were to strictly block, that could be tested here.
  });

  describe('Event Subscription', () => {
    const mockFilters = [{ kinds: [1] }];
    const onEventCallback = vi.fn();

    beforeEach(async () => {
      await serviceInstance.storeKeyPair('mySkHex', 'myPkHex');
      (serviceInstance as any).defaultRelays = ['wss://default.relay'];
      vi.mocked(mockSubInstance.on).mockClear();
      vi.mocked(mockSubInstance.unsub).mockClear();
      vi.mocked(mockPoolInstance.sub).mockClear();
    });

    it('should subscribe to events using SimplePool', () => {
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback, undefined, 'sub1');
      expect(mockPoolInstance.sub).toHaveBeenCalledWith(['wss://default.relay'], mockFilters, { id: 'sub1' });
      expect(mockSubInstance.on).toHaveBeenCalledWith('event', expect.any(Function));
      expect(mockSubInstance.on).toHaveBeenCalledWith('eose', expect.any(Function));
    });

    it('should use target relays if provided for subscription', () => {
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback, ['wss://custom.relay'], 'sub2');
      expect(mockPoolInstance.sub).toHaveBeenCalledWith(['wss://custom.relay'], mockFilters, { id: 'sub2' });
    });

    it('should call onEvent callback when an event is received', () => {
      let eventCb: Function | undefined;
      vi.mocked(mockSubInstance.on).mockImplementation((eventKind, cb) => {
        if (eventKind === 'event') {
          eventCb = cb;
        }
      });

      serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      expect(eventCb).toBeDefined();
      if (eventCb) {
        eventCb({ id: 'event1', content: 'test event' });
      }
      expect(onEventCallback).toHaveBeenCalledWith({ id: 'event1', content: 'test event' });
    });

    it('should unsubscribe correctly', () => {
      const subReturnedByService = serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      serviceInstance.unsubscribe(subReturnedByService);
      expect(mockSubInstance.unsub).toHaveBeenCalled();
    });
  });

  describe('Message Decryption', () => {
    beforeEach(async () => {
      await serviceInstance.storeKeyPair('mySkHex', 'myPkHex');
    });

    it('should decrypt a message using nip04.decrypt', async () => {
      const encryptedPayload = 'encrypted_message_by_senderSkHex_for_myPkHex';
      const senderPkHex = 'senderPkHex';
      const decrypted = await serviceInstance.decryptMessage(encryptedPayload, senderPkHex);

      expect(mockDecrypt).toHaveBeenCalledWith('mySkHex', senderPkHex, encryptedPayload);
      expect(decrypted).toBe('message'); // Adjusted to match the simplified mockDecrypt
    });

    it('should throw if not logged in when trying to decrypt', async () => {
      await serviceInstance.clearKeyPair(); // Logout
      await expect(serviceInstance.decryptMessage('payload', 'otherPkHex')).rejects.toThrow('User not logged in or private key not available for decryption.');
    });
  });

  // --- Tests for Sync Specific Methods ---
  describe('Sync Methods', () => {
    const mockNote: Note = {
      id: 'syncNote1',
      title: 'Sync Test Note',
      content: 'Content to be synced',
      tags: ['#sync'],
      values: { status: 'pending' },
      status: 'draft',
      createdAt: new Date(2023, 0, 10, 10, 0, 0),
      updatedAt: new Date(2023, 0, 10, 11, 0, 0),
      fields: {},
    };
    const mockOntology = { // Type any for simplicity in test, real type is OntologyTree
      nodes: { root: { id: 'root', label: '#Root', children: [] } },
      rootIds: ['root'],
      updatedAt: new Date(2023, 0, 11, 10, 0, 0),
    };
    const defaultRelays = ['wss://sync.relay.example'];

    beforeEach(async () => {
      await serviceInstance.storeKeyPair('syncSkHex', 'syncPkHex');
      (serviceInstance as any).defaultRelays = defaultRelays;
      vi.mocked(mockPoolInstance.list).mockClear();
      vi.mocked(mockPoolInstance.get).mockClear();
      vi.mocked(mockPoolInstance.publish).mockClear();
    });

    describe('publishNoteForSync', () => {
      it('should publish a note encrypted to self for sync', async () => {
        await serviceInstance.publishNoteForSync(mockNote);
        expect(mockEncrypt).toHaveBeenCalledWith('syncSkHex', 'syncPkHex', JSON.stringify(mockNote));
        expect(mockPoolInstance.publish).toHaveBeenCalledTimes(1);
        const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];

        expect(publishedEvent.kind).toBe(4);
        expect(publishedEvent.pubkey).toBe('syncPkHex');
        expect(publishedEvent.content).toBe(`encrypted_${JSON.stringify(mockNote)}_by_syncSkHex_for_syncPkHex`);
        expect(publishedEvent.tags).toEqual(expect.arrayContaining([
          ['p', 'syncPkHex'],
          ['d', `notention-note-sync:${mockNote.id}`],
        ]));
        expect(publishedEvent.created_at).toBe(Math.floor(mockNote.updatedAt.getTime() / 1000));
      });

      it('should throw error if not logged in', async () => {
        await serviceInstance.clearKeyPair();
        await expect(serviceInstance.publishNoteForSync(mockNote)).rejects.toThrow('User not logged in');
      });
    });

    describe('fetchSyncedNotes', () => {
      it('should fetch and decrypt synced notes', async () => {
        const remoteEvent = {
          kind: 4,
          pubkey: 'syncPkHex',
          created_at: Math.floor(mockNote.updatedAt.getTime() / 1000),
          tags: [['p', 'syncPkHex'], ['d', `notention-note-sync:${mockNote.id}`]],
          content: `encrypted_${JSON.stringify(mockNote)}_by_syncSkHex_for_syncPkHex`,
          id: 'event1',
          sig: 'sig1',
        };
        vi.mocked(mockPoolInstance.list).mockResolvedValue([remoteEvent]);
        mockDecrypt.mockResolvedValue(JSON.stringify(mockNote)); // Ensure decrypt returns the stringified note

        const fetchedNotes = await serviceInstance.fetchSyncedNotes();

        expect(mockPoolInstance.list).toHaveBeenCalledWith(defaultRelays, [expect.objectContaining({
          kinds: [4],
          authors: ['syncPkHex'],
          '#p': ['syncPkHex'],
        })]);
        expect(mockDecrypt).toHaveBeenCalledWith('syncSkHex', 'syncPkHex', remoteEvent.content);
        expect(fetchedNotes).toHaveLength(1);
        expect(fetchedNotes[0].id).toBe(mockNote.id);
        expect(fetchedNotes[0].content).toBe(mockNote.content);
        expect(fetchedNotes[0].createdAt.toISOString()).toBe(mockNote.createdAt.toISOString());
        expect(fetchedNotes[0].updatedAt.toISOString()).toBe(mockNote.updatedAt.toISOString());
      });

       it('should filter events not matching the sync d tag', async () => {
        const note1Data = {id: "note1", content:"content1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
        const dm1Data = {id: "dm1", content:"dm content", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
        const syncEvent = {
          kind: 4, pubkey: 'syncPkHex', created_at: 1000,
          tags: [['p', 'syncPkHex'], ['d', `notention-note-sync:note1`]],
          content: `encrypted_${JSON.stringify(note1Data)}_by_syncSkHex_for_syncPkHex`,
          id: 'event1', sig: 'sig1'
        };
        const otherDMEvent = {
          kind: 4, pubkey: 'syncPkHex', created_at: 1001,
          tags: [['p', 'syncPkHex'], ['d', 'some-other-identifier']],
          content: `encrypted_${JSON.stringify(dm1Data)}_by_syncSkHex_for_syncPkHex`,
          id: 'event2', sig: 'sig2'
        };
        vi.mocked(mockPoolInstance.list).mockResolvedValue([syncEvent, otherDMEvent]);
        // Mock decrypt to return the content for each specific call
        mockDecrypt
          .mockResolvedValueOnce(JSON.stringify(note1Data))
          .mockResolvedValueOnce(JSON.stringify(dm1Data));


        const fetchedNotes = await serviceInstance.fetchSyncedNotes();
        expect(fetchedNotes).toHaveLength(1);
        expect(fetchedNotes[0].id).toBe("note1");
      });

      it('should throw if not logged in when fetching notes', async () => {
        await serviceInstance.clearKeyPair();
        await expect(serviceInstance.fetchSyncedNotes()).rejects.toThrow('User not logged in');
      });
    });

    describe('publishOntologyForSync', () => {
      it('should publish ontology as a replaceable event (Kind 30001)', async () => {
        await serviceInstance.publishOntologyForSync(mockOntology);

        expect(mockPoolInstance.publish).toHaveBeenCalledTimes(1);
        const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];

        expect(publishedEvent.kind).toBe(30001);
        expect(publishedEvent.pubkey).toBe('syncPkHex');
        expect(publishedEvent.content).toBe(JSON.stringify(mockOntology));
        expect(publishedEvent.tags).toEqual([['d', 'notention-ontology-sync']]);
        expect(publishedEvent.created_at).toBe(Math.floor(mockOntology.updatedAt.getTime() / 1000));
      });

      it('should throw error if not logged in', async () => {
        await serviceInstance.clearKeyPair();
        await expect(serviceInstance.publishOntologyForSync(mockOntology)).rejects.toThrow('User not logged in');
      });
    });

    describe('fetchSyncedOntology', () => {
      it('should fetch and parse synced ontology', async () => {
        const remoteOntologyEvent = {
          kind: 30001,
          pubkey: 'syncPkHex',
          created_at: Math.floor(mockOntology.updatedAt.getTime() / 1000),
          tags: [['d', 'notention-ontology-sync']],
          content: JSON.stringify(mockOntology),
          id: 'eventOntology',
          sig: 'sigOntology',
        };
        vi.mocked(mockPoolInstance.list).mockResolvedValue([remoteOntologyEvent]);

        const fetchedOntology = await serviceInstance.fetchSyncedOntology();

        expect(mockPoolInstance.list).toHaveBeenCalledWith(defaultRelays, [expect.objectContaining({
          kinds: [30001],
          authors: ['syncPkHex'],
          '#d': ['notention-ontology-sync'],
          limit: 1,
        })]);
        expect(fetchedOntology).toEqual(mockOntology);
        expect(fetchedOntology.updatedAt.toISOString()).toBe(mockOntology.updatedAt.toISOString());
      });

      it('should return null if no ontology event is found', async () => {
        vi.mocked(mockPoolInstance.list).mockResolvedValue([]);
        const fetchedOntology = await serviceInstance.fetchSyncedOntology();
        expect(fetchedOntology).toBeNull();
      });

      it('should throw if not logged in when fetching ontology', async () => {
        await serviceInstance.clearKeyPair();
        await expect(serviceInstance.fetchSyncedOntology()).rejects.toThrow('User not logged in');
      });

      it('should sort multiple ontology events and return the latest', async () => {
        const olderOntology = { ...mockOntology, updatedAt: new Date(2023,0,1) };
        const newerOntology = { ...mockOntology, updatedAt: new Date(2023,0,15) }; // newer
        const event1 = { kind: 30001, pubkey: 'syncPkHex', created_at: Math.floor(olderOntology.updatedAt.getTime() / 1000), tags: [['d', 'notention-ontology-sync']], content: JSON.stringify(olderOntology), id: 'e1', sig: 's1'};
        const event2 = { kind: 30001, pubkey: 'syncPkHex', created_at: Math.floor(newerOntology.updatedAt.getTime() / 1000), tags: [['d', 'notention-ontology-sync']], content: JSON.stringify(newerOntology), id: 'e2', sig: 's2'};

        vi.mocked(mockPoolInstance.list).mockResolvedValue([event1, event2]);

        const fetchedOntology = await serviceInstance.fetchSyncedOntology();
        expect(fetchedOntology.updatedAt.toISOString()).toBe(newerOntology.updatedAt.toISOString());
      });
    });
  });

  describe('Event Deletion (Kind 5)', () => {
    const eventIdsToDelete = ['event1', 'event2'];
    beforeEach(async () => {
      await serviceInstance.storeKeyPair('delSkHex', 'delPkHex');
      (serviceInstance as any).defaultRelays = ['wss://relay.example.com'];
    });

    it('should publish a Kind 5 event deletion', async () => {
      await serviceInstance.publishDeletionEvent(eventIdsToDelete, "Test deletion");
      expect(mockPoolInstance.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = vi.mocked(mockPoolInstance.publish).mock.calls[0][1];

      expect(publishedEvent.kind).toBe(5);
      expect(publishedEvent.pubkey).toBe('delPkHex');
      expect(publishedEvent.content).toBe("Test deletion");
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([
        ['e', 'event1'],
        ['e', 'event2'],
        ['reason', "Test deletion"]
      ]));
    });

    it('should fetch own Kind 5 deletion events', async () => {
      const deletionEvent = {
        kind: 5, pubkey: 'delPkHex', created_at: Date.now()/1000,
        tags: [['e', 'someOldEventId']], content: 'Reason', id: 'kind5_event1', sig: 'sigDel1'
      };
      vi.mocked(mockPoolInstance.list).mockResolvedValue([deletionEvent]);
      const fetchedDeletionEvents = await serviceInstance.fetchOwnDeletionEvents();

      expect(mockPoolInstance.list).toHaveBeenCalledWith(
        ['wss://relay.example.com'],
        [expect.objectContaining({ kinds: [5], authors: ['delPkHex'] })]
      );
      expect(fetchedDeletionEvents).toHaveLength(1);
      expect(fetchedDeletionEvents[0].id).toBe('kind5_event1');
    });
  });
});
