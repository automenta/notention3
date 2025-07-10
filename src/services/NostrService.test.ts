import { NostrService, nostrServiceInstance } from './NostrService';
import { DBService } from './db';
// Import the functions we intend to spy on from the path the SUT uses
import { generatePrivateKey as generatePrivateKeyFromPure, getPublicKey as getPublicKeyFromPure } from 'nostr-tools/pure';
import { Note, UserProfilePrivacySettings, OntologyTree, Filter, Event } from '../../shared/types';
import { vi } from 'vitest';
import { SimplePool, nip04 } from 'nostr-tools'; // For mock type hinting

vi.mock('./db');

// Define constants for mock keys to be used consistently IN THE TEST FILE SCOPE
const TEST_MOCK_SK_HEX = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const TEST_MOCK_PK_HEX = 'mockValidPublicKeyHex';

// Mock for 'nostr-tools/pure'
vi.mock('nostr-tools/pure', async () => {
  const actualPure = await vi.importActual('nostr-tools/pure') as any;
  // Define constants *inside* the mock factory scope
  const PURE_MOCK_SK_HEX = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
  const PURE_MOCK_PK_HEX = 'mockValidPublicKeyHex';

  const skBytes = new Uint8Array(PURE_MOCK_SK_HEX.length / 2);
  for (let i = 0; i < PURE_MOCK_SK_HEX.length; i += 2) {
    skBytes[i / 2] = parseInt(PURE_MOCK_SK_HEX.substring(i, i + 2), 16);
  }
  return {
    ...actualPure,
    generatePrivateKey: vi.fn(() => skBytes), // Returns Uint8Array
    getPublicKey: vi.fn((privateKeyBytes: Uint8Array) => PURE_MOCK_PK_HEX), // Expects Uint8Array
  };
});

// Mock for the main 'nostr-tools' module
vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual('nostr-tools') as any;

  const mockSubInstanceForPool = {
    on: vi.fn((event, callback) => {}),
    unsub: vi.fn(),
  };

  const fullyMockedPool = {
    publish: vi.fn((relays, event) => [Promise.resolve()]),
    sub: vi.fn((relays, filters, opts) => mockSubInstanceForPool),
    list: vi.fn((relays, filters, opts) => Promise.resolve([])),
    get: vi.fn((relays, filter, opts) => Promise.resolve(null)),
    close: vi.fn((relays) => {}),
  };

  return {
    ...actual,
    nip04: {
      encrypt: vi.fn(async (privkey, pubkey, text) => `encrypted_${text}_by_${privkey}_for_${pubkey}`),
      decrypt: vi.fn(async (privkey, pubkey, payload) => payload.replace(`encrypted_`, '').replace(`_by_${privkey}_for_${pubkey}`, '')),
    },
    SimplePool: vi.fn(() => fullyMockedPool),
    getEventHash: vi.fn((event) => `mockEventHash_${event.created_at}`), // Return a string
    finalizeEvent: vi.fn((unsignedEvent, sk) => { // sk is hex string from our mock
      const pubkey = (vi.mocked(getPublicKeyFromPure) as any)(sk); // Use the mocked getPublicKeyFromPure
      return {
        ...unsignedEvent,
        id: `mockId_${unsignedEvent.created_at}`,
        sig: `mockSig_for_${sk.substring(0,5)}`,
        pubkey: pubkey || 'mocked_pk_in_finalize', // Ensure pubkey is present
      } as Event;
    }),
  };
});


describe('NostrService', () => {
  let serviceInstance: NostrService;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Get the service instance. vi.resetModules() should ensure it's "fresh" regarding its own module scope and imports.
    serviceInstance = NostrService.getInstance();

    // Reset state on the singleton instance
    (serviceInstance as any).privateKey = null;
    (serviceInstance as any).publicKey = null;
    (serviceInstance as any).pool = new (vi.mocked(SimplePool))();

    (DBService.getNostrPrivateKey as vi.Mock).mockResolvedValue(null);
    (DBService.getNostrPublicKey as vi.Mock).mockResolvedValue(null);
  });

  describe('Key Management', () => {
    it('should generate a new key pair', () => {
      const keys = serviceInstance.generateNewKeyPair();
      expect(generatePrivateKeyFromPure).toHaveBeenCalled();
      expect(keys.privateKey).toBe(TEST_MOCK_SK_HEX); // Assert against the test-scope constant
      expect(keys.publicKey).toBe(TEST_MOCK_PK_HEX);  // Assert against the test-scope constant
    });

    it('should store a key pair using DBService', async () => {
      await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX);
      expect(DBService.saveNostrPrivateKey).toHaveBeenCalledWith(TEST_MOCK_SK_HEX);
      expect(DBService.saveNostrPublicKey).toHaveBeenCalledWith(TEST_MOCK_PK_HEX);
    });
     it('isLoggedIn should return true if keys are loaded', async () => {
        await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX);
        expect(serviceInstance.isLoggedIn()).toBe(true);
    });
    it('should load a key pair from DBService', async () => {
      (DBService.getNostrPrivateKey as vi.Mock).mockResolvedValue(TEST_MOCK_SK_HEX);
      (DBService.getNostrPublicKey as vi.Mock).mockResolvedValue(TEST_MOCK_PK_HEX);
      const loaded = await serviceInstance.loadKeyPair();
      expect(loaded).toBe(true);
      expect(serviceInstance.getPrivateKey()).toBe(TEST_MOCK_SK_HEX);
      expect(serviceInstance.getPublicKey()).toBe(TEST_MOCK_PK_HEX);
    });
    it('should clear a key pair', async () => {
      await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX);
      await serviceInstance.clearKeyPair();
      expect(DBService.removeNostrPrivateKey).toHaveBeenCalled();
      expect(DBService.removeNostrPublicKey).toHaveBeenCalled();
      expect(serviceInstance.isLoggedIn()).toBe(false);
    });
  });

  describe('Note Publishing', () => {
    const mockNote: Note = {
      id: 'note1', title: 'Test Note', content: 'Hello Nostr!',
      tags: ['#test', '#nostr'], values: { project: 'notention' }, status: 'draft',
      createdAt: new Date(), updatedAt: new Date(), fields: {},
    };
    const defaultRelays = ['wss://relay.example.com'];
    const privacySettingsAllowPublic: UserProfilePrivacySettings = {
        sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true, shareEmbeddingsWithPublicNotes: true
    };

    beforeEach(async () => {
      await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX);
      (serviceInstance as any).defaultRelays = defaultRelays;
    });

    it('should throw error if trying to publish when not logged in', async () => {
      await serviceInstance.clearKeyPair();
      await expect(serviceInstance.publishNote(mockNote, defaultRelays, false, undefined, privacySettingsAllowPublic)).rejects.toThrow('User not logged in');
    });

    it('should publish a public note correctly', async () => {
      await serviceInstance.publishNote(mockNote, defaultRelays, false, undefined, privacySettingsAllowPublic);
      expect((serviceInstance as any).pool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = ((serviceInstance as any).pool.publish as vi.Mock).mock.calls[0][1];
      expect(publishedEvent.kind).toBe(1);
      expect(publishedEvent.pubkey).toBe(TEST_MOCK_PK_HEX);
    });

    it('should publish an encrypted note correctly', async () => {
      const recipientPk = 'recipientPk';
      await serviceInstance.publishNote(mockNote, defaultRelays, true, recipientPk, privacySettingsAllowPublic);
      expect(nip04.encrypt).toHaveBeenCalledWith(TEST_MOCK_SK_HEX, recipientPk, mockNote.content);
      expect((serviceInstance as any).pool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = ((serviceInstance as any).pool.publish as vi.Mock).mock.calls[0][1];
      expect(publishedEvent.kind).toBe(4);
    });
  });

  describe('Event Subscription', () => {
    const mockFilters: Filter[] = [{ kinds: [1] }];
    const onEventCallback = vi.fn();
     beforeEach(async () => {
      await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX);
      (serviceInstance as any).defaultRelays = ['wss://default.relay'];
    });

    it('should subscribe to events using SimplePool', () => {
      const subResult = serviceInstance.subscribeToEvents(mockFilters, onEventCallback, undefined, 'sub1');
      expect((serviceInstance as any).pool.sub).toHaveBeenCalledWith(['wss://default.relay'], mockFilters, {id: 'sub1'});
      expect(subResult!.on).toHaveBeenCalledWith('event', expect.any(Function));
    });

    it('should call onEvent callback when an event is received', () => {
      const mockReturnedSubInstance = { on: vi.fn(), unsub: vi.fn() };
      ((serviceInstance as any).pool.sub as vi.Mock).mockReturnValue(mockReturnedSubInstance);
      mockReturnedSubInstance.on.mockImplementation((eventKind, cb) => {
        if (eventKind === 'event') cb({ id: 'event1', content: 'test event' } as Event);
      });
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      expect(onEventCallback).toHaveBeenCalledWith({ id: 'event1', content: 'test event' });
    });

    it('should unsubscribe correctly', () => {
      const subResult = serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      serviceInstance.unsubscribe(subResult);
      expect(subResult!.unsub).toHaveBeenCalled();
    });
  });

  describe('Message Decryption', () => {
    beforeEach(async () => { await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX); });
    it('should decrypt a message using nip04.decrypt', async () => {
      const encryptedPayload = `encrypted_message_by_senderSk_for_${TEST_MOCK_PK_HEX}`;
      const senderPk = 'senderPk';
      await serviceInstance.decryptMessage(encryptedPayload, senderPk);
      expect(nip04.decrypt).toHaveBeenCalledWith(TEST_MOCK_SK_HEX, senderPk, encryptedPayload);
    });
  });

  describe('Sync Methods', () => {
    const mockNoteForSync: Note = { id: 'syncNote1', title: 'Sync Test', content: 'Sync Content', tags: [], values: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date(), fields: {} };
    const mockOntologyForSync: OntologyTree = { nodes: {}, rootIds: [], updatedAt: new Date() };
    const defaultSyncRelays = ['wss://sync.relay.example'];

    beforeEach(async () => {
      await serviceInstance.storeKeyPair(TEST_MOCK_SK_HEX, TEST_MOCK_PK_HEX);
      (serviceInstance as any).defaultRelays = defaultSyncRelays;
      const pool = (serviceInstance as any).pool;
      if (pool && vi.isMockFunction(pool.list)) (pool.list as vi.Mock).mockReset().mockResolvedValue([]);
      if (pool && vi.isMockFunction(pool.get)) (pool.get as vi.Mock).mockReset().mockResolvedValue(null);
      if (pool && vi.isMockFunction(pool.publish)) (pool.publish as vi.Mock).mockReset().mockReturnValue([Promise.resolve()]);
    });

    describe('publishNoteForSync', () => {
      it('should publish a note encrypted to self for sync', async () => {
        await serviceInstance.publishNoteForSync(mockNoteForSync, defaultSyncRelays);
        expect((serviceInstance as any).pool.publish).toHaveBeenCalledTimes(1);
        const publishedEvent = ((serviceInstance as any).pool.publish as vi.Mock).mock.calls[0][1];
        expect(publishedEvent.kind).toBe(4);
      });
    });
    describe('fetchSyncedNotes', () => {
      it('should fetch and decrypt synced notes', async () => {
        const remoteEventContent = { ...mockNoteForSync, content: "remote content" };
        const remoteEvent = { kind: 4, pubkey: TEST_MOCK_PK_HEX, tags: [['p', TEST_MOCK_PK_HEX], ['d', `notention-note-sync:${mockNoteForSync.id}`]], content: `encrypted_${JSON.stringify(remoteEventContent)}_by_${TEST_MOCK_SK_HEX}_for_${TEST_MOCK_PK_HEX}` };
        ((serviceInstance as any).pool.list as vi.Mock).mockResolvedValue([remoteEvent]);
        const notes = await serviceInstance.fetchSyncedNotes(undefined, defaultSyncRelays);
        expect((serviceInstance as any).pool.list).toHaveBeenCalled();
        expect(nip04.decrypt).toHaveBeenCalled();
        expect(notes[0].content).toBe("remote content");
      });
    });
     describe('publishOntologyForSync', () => {
      it('should publish ontology as a replaceable event (Kind 30001)', async () => {
        await serviceInstance.publishOntologyForSync(mockOntologyForSync, defaultSyncRelays);
        expect((serviceInstance as any).pool.publish).toHaveBeenCalledTimes(1);
        const publishedEvent = ((serviceInstance as any).pool.publish as vi.Mock).mock.calls[0][1];
        expect(publishedEvent.kind).toBe(30001);
      });
    });
    describe('fetchSyncedOntology', () => {
      it('should fetch and parse synced ontology', async () => {
        const remoteEvent = { kind: 30001, content: JSON.stringify(mockOntologyForSync) };
        ((serviceInstance as any).pool.list as vi.Mock).mockResolvedValue([remoteEvent]);
        await serviceInstance.fetchSyncedOntology(defaultSyncRelays);
        expect((serviceInstance as any).pool.list).toHaveBeenCalled();
      });
    });
  });
});

export const nostrServiceInstance = NostrService.getInstance();
