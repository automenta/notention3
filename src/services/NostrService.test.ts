import { NostrService, nostrServiceInstance } from './NostrService'; // Assuming nostrServiceInstance is the exported singleton
import { DBService } from './db';
import { generatePrivateKey, getPublicKey, nip04, SimplePool } from 'nostr-tools';
import { Note } from '../../shared/types';

// Mocks
vi.mock('./db'); // Mock DBService

// Mock nostr-tools functions used by NostrService if they are not part of the test's focus
// For SimplePool, we'll mock its methods.
const mockPublishResult = Promise.resolve(); // Simulate successful publish
const mockSubInstance = {
  on: vi.fn(),
  unsub: vi.fn(),
};
const mockPool = {
  publish: vi.fn().mockReturnValue([mockPublishResult]), // publish returns an array of promises
  sub: vi.fn().mockReturnValue(mockSubInstance),
  close: vi.fn(),
};
vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual('nostr-tools') as any;
  return {
    ...actual,
    generatePrivateKey: vi.fn(() => 'mockPrivateKey'),
    getPublicKey: vi.fn(sk => `mockPublicKey_for_${sk}`),
    nip04: {
      encrypt: vi.fn(async (privkey, pubkey, text) => `encrypted_${text}_by_${privkey}_for_${pubkey}`),
      decrypt: vi.fn(async (privkey, pubkey, payload) => payload.replace(`encrypted_`, '').replace(`_by_${privkey}_for_${pubkey}`, '')),
    },
    SimplePool: vi.fn(() => mockPool),
    getEventHash: vi.fn((event) => `hash_${JSON.stringify(event.created_at)}`),
    signEvent: vi.fn((event, sk) => `signed_${event.id}_by_${sk}`),
  };
});


describe('NostrService', () => {
  let serviceInstance: NostrService;

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
  });

  describe('Key Management', () => {
    it('should generate a new key pair', () => {
      const keys = serviceInstance.generateNewKeyPair();
      expect(generatePrivateKey).toHaveBeenCalled();
      expect(getPublicKey).toHaveBeenCalledWith('mockPrivateKey');
      expect(keys.privateKey).toBe('mockPrivateKey');
      expect(keys.publicKey).toBe('mockPublicKey_for_mockPrivateKey');
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
      // Ensure DBService methods are mock functions before calling mockResolvedValue
      if (typeof (DBService.getNostrPrivateKey as any).mockResolvedValue === 'function') {
        (DBService.getNostrPrivateKey as any).mockResolvedValue('loadedPrivKey');
      }
      if (typeof (DBService.getNostrPublicKey as any).mockResolvedValue === 'function') {
        (DBService.getNostrPublicKey as any).mockResolvedValue('loadedPubKey');
      }

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
      await serviceInstance.storeKeyPair('mySk', 'myPk');
      (serviceInstance as any).defaultRelays = defaultRelays; // Set default relays for testing
    });

    it('should throw error if trying to publish when not logged in', async () => {
      await serviceInstance.clearKeyPair(); // Logout
      await expect(serviceInstance.publishNote(mockNote)).rejects.toThrow('User not logged in');
    });

    it('should publish a public note correctly', async () => {
      const privacyAllowPublic = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyAllowPublic);

      expect(mockPool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPool.publish.mock.calls[0][1];

      expect(publishedEvent.kind).toBe(1);
      expect(publishedEvent.pubkey).toBe('myPk');
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
      const recipientPk = 'recipientPk';
      await serviceInstance.publishNote(mockNote, undefined, true, recipientPk, undefined); // Privacy settings less relevant for encrypted

      expect(nip04.encrypt).toHaveBeenCalledWith('mySk', recipientPk, mockNote.content);
      expect(mockPool.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPool.publish.mock.calls[0][1];

      expect(publishedEvent.kind).toBe(4);
      expect(publishedEvent.pubkey).toBe('myPk');
      expect(publishedEvent.content).toBe(`encrypted_${mockNote.content}_by_mySk_for_${recipientPk}`);
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([
        ['p', recipientPk]
      ]));
    });

    it('should respect privacy settings: no tags for public notes', async () => {
      const privacyNoTags = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: false, shareValuesWithPublicNotes: true };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyNoTags);
      const publishedEvent = mockPool.publish.mock.calls[0][1];
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([['t', 'test']]));
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([['param', 'project', 'notention']]));
    });

    it('should respect privacy settings: no values for public notes', async () => {
      const privacyNoValues = { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: false };
      await serviceInstance.publishNote(mockNote, undefined, false, undefined, privacyNoValues);
      const publishedEvent = mockPool.publish.mock.calls[0][1];
      expect(publishedEvent.tags).toEqual(expect.arrayContaining([['t', 'test']]));
      expect(publishedEvent.tags).not.toEqual(expect.arrayContaining([['param', 'project', 'notention']]));
    });

    // Test for sharePublicNotesGlobally: false is tricky here as the service currently proceeds
    // The store action `publishCurrentNoteToNostr` is responsible for blocking based on this setting.
    // If NostrService were to strictly block, that could be tested here.
  });

  describe('Event Subscription', () => {
    const mockFilters = [{ kinds: [1] }];
    const onEventCallback = vi.fn();

    beforeEach(async () => {
      await serviceInstance.storeKeyPair('mySk', 'myPk');
      (serviceInstance as any).defaultRelays = ['wss://default.relay'];
    });

    it('should subscribe to events using SimplePool', () => {
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback, undefined, 'sub1');
      expect(mockPool.sub).toHaveBeenCalledWith(['wss://default.relay'], mockFilters, {id: 'sub1'});
      expect(mockSubInstance.on).toHaveBeenCalledWith('event', expect.any(Function));
      expect(mockSubInstance.on).toHaveBeenCalledWith('eose', expect.any(Function));
    });

    it('should use target relays if provided for subscription', () => {
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback, ['wss://custom.relay'], 'sub2');
      expect(mockPool.sub).toHaveBeenCalledWith(['wss://custom.relay'], mockFilters, {id: 'sub2'});
    });

    it('should call onEvent callback when an event is received', () => {
      // Simulate event emission by directly calling the mocked 'on' handler's argument
      mockSubInstance.on.mockImplementation((eventKind, cb) => {
        if (eventKind === 'event') {
          cb({ id: 'event1', content: 'test event' }); // Simulate an event
        }
      });
      serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      expect(onEventCallback).toHaveBeenCalledWith({ id: 'event1', content: 'test event' });
    });

    it('should unsubscribe correctly', () => {
      const sub = serviceInstance.subscribeToEvents(mockFilters, onEventCallback);
      serviceInstance.unsubscribe(sub);
      expect(mockSubInstance.unsub).toHaveBeenCalled();
    });
  });

  describe('Message Decryption', () => {
    beforeEach(async () => {
      await serviceInstance.storeKeyPair('mySk', 'myPk');
    });

    it('should decrypt a message using nip04.decrypt', async () => {
      const encryptedPayload = 'encrypted_message_by_senderSk_for_myPk';
      const senderPk = 'senderPk';
      const decrypted = await serviceInstance.decryptMessage(encryptedPayload, senderPk);

      expect(nip04.decrypt).toHaveBeenCalledWith('mySk', senderPk, encryptedPayload);
      expect(decrypted).toBe('message_by_senderSk_for_myPk'); // Based on mock
    });

    it('should throw if not logged in when trying to decrypt', async () => {
      await serviceInstance.clearKeyPair(); // Logout
      await expect(serviceInstance.decryptMessage('payload', 'otherPk')).rejects.toThrow('User not logged in or private key not available for decryption.');
    });
  });
});

// Helper to access the singleton instance for testing, assuming it's exported as `nostrService`
// and its class is NostrService. This is a bit of a workaround for testing singletons.
export const nostrServiceInstance = NostrService.getInstance();
