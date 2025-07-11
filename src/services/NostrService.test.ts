import { NostrService, nostrServiceInstance } from './NostrService'; // Assuming nostrServiceInstance is the exported singleton
import { DBService } from './db';
import { generatePrivateKey, getPublicKey, nip04, SimplePool } from 'nostr-tools';
import { Note } from '../../shared/types';

// Mocks
vi.mock('./db'); // Mock DBService

// Declare mock variables at the top level so they can be accessed by beforeEach and the mock factory
vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual('nostr-tools') as any;

  // Declare and initialize mock variables within the mock factory
  // Ensure these mock instances are recreated or reset properly if tests modify their state.
  // For SimplePool methods, they are typically reset in beforeEach of the test suite.
  const mockPublishResult = Promise.resolve(); // Represents a single relay's promise
  const mockSubInstance = {
    on: vi.fn(),
    unsub: vi.fn(),
  };
  const mockPoolInstance = { // Renamed to mockPoolInstance for clarity
    publish: vi.fn().mockImplementation(() => [mockPublishResult]), // publish returns an array of promises
    sub: vi.fn().mockReturnValue(mockSubInstance),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    close: vi.fn(), // Mock for close if it's ever called
  };

  return {
    ...actual,
    // generateSecretKey is used by NostrService, not generatePrivateKey directly from 'nostr-tools'
    // generateSecretKey returns Uint8Array. We'll mock it to return a fixed Uint8Array.
    // The bytesToHex function will then convert this.
    // Let's make 'a'.repeat(64) the hex representation. So Uint8Array should be 32 bytes of 0xaa.
    generateSecretKey: vi.fn(() => new Uint8Array(Array(32).fill(0xaa))), // Mock for generateSecretKey
    getPublicKey: vi.fn(skBytes => {
      // skBytes would be the Uint8Array from generateSecretKey.
      // We need a consistent mock public key.
      // If skBytes is our mocked new Uint8Array(Array(32).fill(0xaa)), return a fixed PK.
      // Otherwise, handle other cases or make it simpler.
      // For simplicity here, let's assume it's always called with the mocked secret key bytes.
      return 'mockPublicKey_for_aa_bytes';
    }),
    nip04: {
      encrypt: vi.fn(async (privkeyHex, pubkeyHex, text) => `encrypted_${text}_by_${privkeyHex}_for_${pubkeyHex}`),
      decrypt: vi.fn(async (privkeyHex, pubkeyHex, payload) => payload.replace(`encrypted_`, '').replace(`_by_${privkeyHex}_for_${pubkeyHex}`, '')),
    },
    SimplePool: vi.fn(() => mockPoolInstance), // Use mockPoolInstance
    finalizeEvent: vi.fn((unsignedEvent, privateKeyHex) => {
      // A more complete mock for finalizeEvent:
      // It should add id, pubkey, sig to the event.
      // For testing, we can use a simplified version.
      return {
        ...unsignedEvent,
        id: `mockEventId_${unsignedEvent.created_at}_${Math.random()}`,
        sig: `mockSig_for_${privateKeyHex}`,
        // pubkey should already be on unsignedEvent if service sets it.
        // If not, finalizeEvent adds it. For this service, pubkey is set before calling.
      };
    }),
    // Keep other mocks if they are directly used by the service or its dependencies in tests
    getEventHash: vi.fn((event) => `hash_${JSON.stringify(event.created_at)}`),
    // signEvent is not directly used by the service (it uses finalizeEvent)
  };
});


describe('NostrService', () => {
  let serviceInstance: NostrService;
  let mockPool: any; // To hold the mockPoolInstance for easier access in tests

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Re-initialize the singleton or get a fresh instance for testing if possible.
    // For this structure, we'll use the exported singleton and manage its state.
    // It might be better if NostrService was not a singleton for easier testing,
    // or had a reset method for tests.
    serviceInstance = nostrServiceInstance;
    // Manually reset internal state of the singleton for test isolation
    (serviceInstance as any).privateKey = null;
    (serviceInstance as any).publicKey = null;
    // Mock that DBService returns null initially for keys
    // Ensure DBService methods are mock functions. If vi.mock('./db') is effective, they should be.
    if (typeof (DBService.getNostrPrivateKey as any).mockResolvedValue === 'function') {
      (DBService.getNostrPrivateKey as any).mockResolvedValue(null);
    }
    if (typeof (DBService.getNostrPublicKey as any).mockResolvedValue === 'function') {
      (DBService.getNostrPublicKey as any).mockResolvedValue(null);
    }

    // Reset mocks before each test
    vi.clearAllMocks();

    // Get the mocked SimplePool instance for manipulation/assertion in tests
    // This assumes the mock factory for 'nostr-tools' has run and SimplePool is mocked.
    // We need to access the specific instance `mockPoolInstance` created in the mock factory.
    // One way is to have the factory assign it to an exported variable from the mock module,
    // or, more simply, re-fetch it via the mocked constructor if it always returns the same instance.
    // For this setup, the factory's `mockPoolInstance` is the one used.
    // We can access its methods directly via the SimplePool constructor mock if it's stable.
    // Let's get a reference to the mock pool instance used by SimplePool mock
    const NostrToolsMocks = await vi.importActual('nostr-tools') as any; // To get the mocked SimplePool
    mockPool = NostrToolsMocks.SimplePool(); // This should return our mockPoolInstance


    // Re-initialize the singleton or get a fresh instance for testing if possible.
    serviceInstance = NostrService.getInstance(); // Use the actual getInstance method
    // Manually reset internal state of the singleton for test isolation
    (serviceInstance as any).privateKey = null;
    (serviceInstance as any).publicKey = null;

    // Ensure DBService methods are mock functions and reset them
    vi.mocked(DBService.getNostrPrivateKey).mockResolvedValue(null);
    vi.mocked(DBService.getNostrPublicKey).mockResolvedValue(null);
    vi.mocked(DBService.saveNostrPrivateKey).mockClear();
    vi.mocked(DBService.saveNostrPublicKey).mockClear();
    vi.mocked(DBService.removeNostrPrivateKey).mockClear();
    vi.mocked(DBService.removeNostrPublicKey).mockClear();


    // Reset our direct mockPool instance's methods (if not already covered by vi.clearAllMocks for its functions)
    // This is important because mockPool is an object with methods that are vi.fn()
    if (mockPool && mockPool.publish && typeof mockPool.publish.mockClear === 'function') {
      mockPool.publish.mockClear();
      mockPool.sub.mockClear();
      mockPool.list.mockClear();
      mockPool.get.mockClear();
      // mockPool.close.mockClear(); // close is not typically called by the service
      // For sub-objects like mockSubInstance, if their methods are vi.fn(), clearAllMocks should handle them.
      // If mockSubInstance itself is recreated, then its methods are fresh.
      // In our mock, mockSubInstance is shared, so its methods need reset if they were called.
      // However, mockPool.sub() itself is cleared, so the `on` and `unsub` calls are on a "fresh" mockSubInstance conceptually for each sub call.
    }
  });

  describe('Key Management', () => {
    it('should generate a new key pair', () => {
      const keys = serviceInstance.generateNewKeyPair();
      // generateSecretKey is from nostr-tools/pure, imported as generateSecretKey
      // getPublicKey is also from nostr-tools/pure
      const NostrTools = require('nostr-tools'); // Access the mocked module

      expect(NostrTools.generateSecretKey).toHaveBeenCalled();
      // The argument to getPublicKey is a Uint8Array in the actual code
      expect(NostrTools.getPublicKey).toHaveBeenCalledWith(new Uint8Array(Array(32).fill(0xaa)));
      expect(keys.privateKey).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); // bytesToHex(new Uint8Array(Array(32).fill(0xaa)))
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
      await serviceInstance.storeKeyPair('mySkHex', 'myPkHex'); // Use hex keys for consistency with finalizeEvent mock
      (serviceInstance as any).defaultRelays = defaultRelays;
    });

    it('should throw error if trying to publish when not logged in', async () => {
      await serviceInstance.clearKeyPair(); // Logout
      await expect(serviceInstance.publishNote(mockNote)).rejects.toThrow('User not logged in');
    });

    it('should publish a public note correctly', async () => {
      const privacyAllowPublic = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyAllowPublic);

      expect(mockPool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPool.publish.mock.calls[0][1]; // Second argument to pool.publish

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

      const NostrTools = require('nostr-tools');
      expect(NostrTools.nip04.encrypt).toHaveBeenCalledWith('mySkHex', recipientPkHex, mockNote.content);
      expect(mockPool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPool.publish.mock.calls[0][1];

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
      const publishedEvent = mockPool.publish.mock.calls[0][1];
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([['t', 'test']]));
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([['param', 'project', 'notention']]));
    });

    it('should respect privacy settings: no values for public notes', async () => {
      const privacyNoValues = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: false, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyNoValues);
      const publishedEvent = mockPool.publish.mock.calls[0][1];
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([['t', 'test']]));
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([['param', 'project', 'notention']]));
    });

    it('should include embedding tag if public, enabled, and present', async () => {
      const noteWithEmbedding = { ...mockNote, embedding: [0.1, 0.2, 0.3] };
      const privacyAllowEmbeddings = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: true };
      await serviceInstance.publishNote(noteWithEmbedding, undefined, false, undefined, privacyAllowEmbeddings);
      const publishedEvent = mockPool.publish.mock.calls[0][1];
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([
        ['embedding', JSON.stringify([0.1, 0.2, 0.3])]
      ]));
    });

    it('should NOT include embedding tag if public but sharing disabled', async () => {
      const noteWithEmbedding = { ...mockNote, embedding: [0.1, 0.2, 0.3] };
      const privacyDisallowEmbeddings = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: false };
      await serviceInstance.publishNote(noteWithEmbedding, undefined, false, undefined, privacyDisallowEmbeddings);
      const publishedEvent = mockPool.publish.mock.calls[0][1];
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
    const mockFilters = [{ kinds: [1] }] as Filter[]; // Use Filter type
    const onEventCallback = vi.fn();
    let mockSub: any; // To hold the subscription object returned by pool.sub

    beforeEach(async () => {
      await serviceInstance.storeKeyPair('mySkHex', 'myPkHex');
      (serviceInstance as any).defaultRelays = ['wss://default.relay'];
      // Ensure the mock for pool.sub() returns a fresh mockSubInstance or reset its methods
      mockSub = mockPool.sub(); // Get the mocked subscription instance
      vi.mocked(mockSub.on).mockClear();
      vi.mocked(mockSub.unsub).mockClear();
    });

    it('should subscribe to events using SimplePool', () => {
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback, undefined, 'sub1');
      expect(mockPool.sub).toHaveBeenCalledWith(['wss://default.relay'], mockFilters, { id: 'sub1' });
      expect(mockSub.on).toHaveBeenCalledWith('event', expect.any(Function));
      expect(mockSub.on).toHaveBeenCalledWith('eose', expect.any(Function));
    });

    it('should use target relays if provided for subscription', () => {
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback, ['wss://custom.relay'], 'sub2');
      expect(mockPool.sub).toHaveBeenCalledWith(['wss://custom.relay'], mockFilters, { id: 'sub2' });
    });

    it('should call onEvent callback when an event is received', () => {
      // Simulate event emission by directly calling the mocked 'on' handler's argument
      // Need to get the actual callback passed to mockSub.on
      let eventCb: Function | undefined;
      vi.mocked(mockSub.on).mockImplementation((eventKind, cb) => {
        if (eventKind === 'event') {
          eventCb = cb;
        }
      });

      serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      if (eventCb) {
        eventCb({ id: 'event1', content: 'test event' }); // Simulate an event
      }
      expect(onEventCallback).toHaveBeenCalledWith({ id: 'event1', content: 'test event' });
    });

    it('should unsubscribe correctly', () => {
      const subReturnedByService = serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      serviceInstance.unsubscribe(subReturnedByService); // subReturnedByService is mockSub
      expect(mockSub.unsub).toHaveBeenCalled();
    });
  });

  describe('Message Decryption', () => {
    beforeEach(async () => {
      await serviceInstance.storeKeyPair('mySk', 'myPk');
    });

    it('should decrypt a message using nip04.decrypt', async () => {
      const encryptedPayload = 'encrypted_message_by_senderSkHex_for_myPkHex';
      const senderPkHex = 'senderPkHex';
      const decrypted = await serviceInstance.decryptMessage(encryptedPayload, senderPkHex);

      const NostrTools = require('nostr-tools');
      expect(NostrTools.nip04.decrypt).toHaveBeenCalledWith('mySkHex', senderPkHex, encryptedPayload);
      expect(decrypted).toBe('message_by_senderSkHex_for_myPkHex');
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
      vi.mocked(mockPool.list).mockReset();
      vi.mocked(mockPool.get).mockReset();
    });

    describe('publishNoteForSync', () => {
      it('should publish a note encrypted to self for sync', async () => {
        await serviceInstance.publishNoteForSync(mockNote);
        const NostrTools = require('nostr-tools');
        expect(NostrTools.nip04.encrypt).toHaveBeenCalledWith('syncSkHex', 'syncPkHex', JSON.stringify(mockNote));
        expect(mockPool.publish).toHaveBeenCalledTimes(1);
        const publishedEvent = mockPool.publish.mock.calls[0][1];

        expect(publishedEvent.kind).toBe(4); // Encrypted DM
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
        const NostrTools = require('nostr-tools');
        const remoteEvent = {
          kind: 4,
          pubkey: 'syncPkHex',
          created_at: Math.floor(mockNote.updatedAt.getTime() / 1000),
          tags: [['p', 'syncPkHex'], ['d', `notention-note-sync:${mockNote.id}`]],
          content: `encrypted_${JSON.stringify(mockNote)}_by_syncSkHex_for_syncPkHex`,
          id: 'event1',
          sig: 'sig1',
        };
        vi.mocked(mockPool.list).mockResolvedValue([remoteEvent]);

        const fetchedNotes = await serviceInstance.fetchSyncedNotes();

        expect(mockPool.list).toHaveBeenCalledWith(defaultRelays, [expect.objectContaining({
          kinds: [4],
          authors: ['syncPkHex'],
          '#p': ['syncPkHex'],
        })]);
        expect(NostrTools.nip04.decrypt).toHaveBeenCalledWith('syncSkHex', 'syncPkHex', remoteEvent.content);
        expect(fetchedNotes).toHaveLength(1);
        expect(fetchedNotes[0].id).toBe(mockNote.id);
        expect(fetchedNotes[0].content).toBe(mockNote.content);
        expect(fetchedNotes[0].createdAt.toISOString()).toBe(mockNote.createdAt.toISOString());
        expect(fetchedNotes[0].updatedAt.toISOString()).toBe(mockNote.updatedAt.toISOString());
      });

       it('should filter events not matching the sync d tag', async () => {
        const syncEvent = {
          kind: 4, pubkey: 'syncPkHex', created_at: 1000,
          tags: [['p', 'syncPkHex'], ['d', `notention-note-sync:note1`]],
          content: `encrypted_${JSON.stringify({id: "note1", content:"content1"})}_by_syncSkHex_for_syncPkHex`,
          id: 'event1', sig: 'sig1'
        };
        const otherDMEvent = {
          kind: 4, pubkey: 'syncPkHex', created_at: 1001,
          tags: [['p', 'syncPkHex'], ['d', 'some-other-identifier']],
          content: `encrypted_${JSON.stringify({id: "dm1", content:"dm content"})}_by_syncSkHex_for_syncPkHex`,
          id: 'event2', sig: 'sig2'
        };
        vi.mocked(mockPool.list).mockResolvedValue([syncEvent, otherDMEvent]);

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

        expect(mockPool.publish).toHaveBeenCalledTimes(1);
        const publishedEvent = mockPool.publish.mock.calls[0][1];

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
        vi.mocked(mockPool.list).mockResolvedValue([remoteOntologyEvent]);

        const fetchedOntology = await serviceInstance.fetchSyncedOntology();

        expect(mockPool.list).toHaveBeenCalledWith(defaultRelays, [expect.objectContaining({
          kinds: [30001],
          authors: ['syncPkHex'],
          '#d': ['notention-ontology-sync'],
          limit: 1,
        })]);
        expect(fetchedOntology).toEqual(mockOntology);
        expect(fetchedOntology.updatedAt.toISOString()).toBe(mockOntology.updatedAt.toISOString());
      });

      it('should return null if no ontology event is found', async () => {
        vi.mocked(mockPool.list).mockResolvedValue([]);
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

        vi.mocked(mockPool.list).mockResolvedValue([event1, event2]);

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
      expect(mockPool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPool.publish.mock.calls[0][1];

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
      vi.mocked(mockPool.list).mockResolvedValue([deletionEvent]);
      const fetchedDeletionEvents = await serviceInstance.fetchOwnDeletionEvents();

      expect(mockPool.list).toHaveBeenCalledWith(
        ['wss://relay.example.com'],
        [expect.objectContaining({ kinds: [5], authors: ['delPkHex'] })]
      );
      expect(fetchedDeletionEvents).toHaveLength(1);
      expect(fetchedDeletionEvents[0].id).toBe('kind5_event1');
    });
  });
});

// Export the singleton instance for potential use in other tests if needed,
// though direct import from NostrService.ts is preferred.
export const nostrServiceTestInstance = NostrService.getInstance();
