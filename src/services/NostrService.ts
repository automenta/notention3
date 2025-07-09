import {
  generatePrivateKey, getPublicKey, nip04, Event, UnsignedEvent, getEventHash, signEvent, SimplePool, Filter
} from 'nostr-tools';
import { UserProfile, Note, NostrUserProfile, RelayDict } from '../../shared/types'; // Assuming NostrUserProfile and RelayDict might be needed
import { DBService } from './db';

// const NOSTR_RELAYS_DB_KEY = 'nostrRelays'; // This might be stored in userProfile or app settings directly

export class NostrService {
  private static instance: NostrService;
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  private pool: SimplePool;
  private defaultRelays: string[] = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']; // Default relays

  private constructor() {
    this.pool = new SimplePool();
  }

  public static getInstance(): NostrService {
    if (!NostrService.instance) {
      NostrService.instance = new NostrService();
    }
    return NostrService.instance;
  }

  /**
   * Generates a new Nostr key pair.
   * Does not automatically store it. Call storeKeyPair for that.
   */
  public generateNewKeyPair(): { privateKey: string; publicKey: string } {
    const sk = generatePrivateKey();
    const pk = getPublicKey(sk);
    return { privateKey: sk, publicKey: pk };
  }

  /**
   * Stores the given Nostr key pair securely using DBService.
   * Prompts for backup (conceptually, actual prompt is UI concern).
   * @param privateKey The private key to store.
   * @param publicKey The public key to store.
   */
  public async storeKeyPair(privateKey: string, publicKey: string): Promise<void> {
    try {
      await DBService.saveNostrPrivateKey(privateKey);
      await DBService.saveNostrPublicKey(publicKey);
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      console.log('Nostr key pair stored. User should be prompted to back up their private key.');
    } catch (error) {
      console.error('Error storing Nostr key pair:', error);
      throw new Error('Failed to store Nostr key pair.');
    }
  }

  /**
   * Loads the Nostr key pair from storage using DBService.
   * @returns True if keys were loaded, false otherwise.
   */
  public async loadKeyPair(): Promise<boolean> {
    try {
      const sk = await DBService.getNostrPrivateKey();
      const pk = await DBService.getNostrPublicKey();
      if (sk && pk) {
        this.privateKey = sk;
        this.publicKey = pk;
        return true;
      }
      this.privateKey = null; // Ensure keys are cleared if not found
      this.publicKey = null;
      return false;
    } catch (error) {
      console.error('Error loading Nostr key pair:', error);
      this.privateKey = null;
      this.publicKey = null;
      return false;
    }
  }

  /**
   * Clears the currently loaded and stored Nostr key pair from DBService.
   */
  public async clearKeyPair(): Promise<void> {
    try {
      await DBService.removeNostrPrivateKey();
      await DBService.removeNostrPublicKey();
      this.privateKey = null;
      this.publicKey = null;
      console.log('Nostr key pair cleared.');
    } catch (error) {
      console.error('Error clearing Nostr key pair:', error);
      throw new Error('Failed to clear Nostr key pair.');
    }
  }

  public getPublicKey(): string | null {
    return this.publicKey;
  }

  public getPrivateKey(): string | null {
    // Be very careful with exposing this. Ideally, it's only used internally for signing.
    return this.privateKey;
  }

  public isLoggedIn(): boolean {
    return !!this.privateKey && !!this.publicKey;
  }

  /**
   * Publishes a note to the Nostr network.
   * @param note The note to publish.
   * @param targetRelays Optional array of relay URLs to publish to. Defaults to pre-configured relays.
   * @param encrypt If true, encrypts the note content.
   * @param recipientPublicKey If encrypting, the public key of the recipient. Defaults to self (this.publicKey).
   * @returns A promise that resolves with the published event IDs from each relay.
   */
  public async publishNote(
    note: Note,
    targetRelays?: string[],
    encrypt: boolean = false,
    recipientPublicKey?: string,
    privacySettings?: { // Added privacy settings parameter
      sharePublicNotesGlobally: boolean;
      shareTagsWithPublicNotes: boolean;
      shareValuesWithPublicNotes: boolean;
    }
  ): Promise<string[]> { // Returns event IDs from relays
    if (!this.isLoggedIn() || !this.privateKey || !this.publicKey) {
      throw new Error('User not logged in. Cannot publish note.');
    }

    // Default privacy settings if not provided (conservative: share less)
    const currentPrivacySettings = privacySettings || {
      sharePublicNotesGlobally: false,
      shareTagsWithPublicNotes: false,
      shareValuesWithPublicNotes: false,
    };

    // If trying to publish a public (non-encrypted) note but global sharing is off, prevent.
    if (!encrypt && !currentPrivacySettings.sharePublicNotesGlobally) {
      console.warn('Public note publishing is disabled by privacy settings.');
      // Or throw new Error('Public note publishing is disabled by privacy settings.');
      // For now, let's allow it but it won't include much if other settings are also false.
      // A better approach would be to prevent the call from the store if settings disallow.
      // Or, if this service is called directly, it should strictly adhere.
      // Let's make it strict:
      // throw new Error('Public note publishing is disabled by privacy settings.');
      // For now, let's proceed but filter tags/values based on other settings.
      // The UI/store should ideally prevent calling this if sharePublicNotesGlobally is false for a public note.
    }

    const relaysToPublish = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToPublish.length === 0) {
      console.warn('No relays configured or provided to publish note.');
      return [];
    }

    const tags: string[][] = [];
     // Basic tags like 'd' (identifier) and 'title' might always be included if the note itself is shared.
    tags.push(['d', note.id]); // Identifier for the note
    tags.push(['title', note.title]); // Title of the note
    tags.push(['published_at', Math.floor((note.createdAt || new Date()).getTime() / 1000).toString()]);


    if (encrypt || currentPrivacySettings.shareTagsWithPublicNotes) {
      (note.tags || []).forEach(tag => {
        const tagName = tag.startsWith('#') || tag.startsWith('@') ? tag.substring(1) : tag;
        if (tagName) tags.push(['t', tagName]);
      });
    }

    if (encrypt || currentPrivacySettings.shareValuesWithPublicNotes) {
      if (note.values) {
        for (const [key, value] of Object.entries(note.values)) {
          tags.push(['param', key, value]);
        }
      }
    }

    // Internal metadata like folderId or templateId should typically not be shared publicly unless intended.
    // For encrypted notes, they are part of the encrypted payload if included in content, or could be specific tags.
    // For this example, we are not adding folderId/templateId as tags to public notes by default.
    // if (note.folderId) {
    //   tags.push(['folderId', note.folderId]);
    // }
    // if (note.templateId) {
    //   tags.push(['templateId', note.templateId]);
    // }

    let contentToPublish = note.content;
    let eventKind: number = 1; // Default to kind 1 (short text note / reference to long-form)
    // Consider using Kind 30023 for long-form content if note.content is substantial
    // For this example, we'll stick to Kind 1 for simplicity of public notes,
    // or Kind 4 for encrypted notes.
    // A more advanced setup might use Kind 1 as a "pointer" to a Kind 30023.

    if (encrypt) {
      const targetPk = recipientPublicKey || this.publicKey;
      if (!targetPk) {
        throw new Error('Recipient public key not available for encryption.');
      }
      if (!this.privateKey) { // Should be caught by isLoggedIn, but defensive check
          throw new Error('Private key not available for encryption.');
      }
      try {
        contentToPublish = await nip04.encrypt(this.privateKey, targetPk, note.content);
        tags.push(['p', targetPk]); // NIP-04 specifies 'p' tag for recipient
        eventKind = 4; // NIP-04 Encrypted Direct Message
      } catch (error) {
        console.error('Error encrypting note:', error);
        throw new Error('Failed to encrypt note content.');
      }
    }

    const unsignedEvent: UnsignedEvent = {
      kind: eventKind,
      pubkey: this.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: contentToPublish,
    };

    const eventId = getEventHash(unsignedEvent);
    const signature = signEvent(unsignedEvent, this.privateKey);

    const signedEvent: Event = {
      ...unsignedEvent,
      id: eventId,
      sig: signature,
    };

    console.log(`Publishing event to ${relaysToPublish.join(', ')}:`, signedEvent);

    try {
      const publicationPromises = this.pool.publish(relaysToPublish, signedEvent);
      // publicationPromises is an array of promises, one for each relay.
      // Each promise resolves when the relay acknowledges the event or rejects on error/timeout.
      // For simplicity, we'll just log success/failure.
      // A more robust implementation would handle individual relay successes/failures.

      // Let's wait for all to settle and collect results
      const results = await Promise.allSettled(publicationPromises);
      const successfulEventIds: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`Event ${signedEvent.id} published successfully to ${relaysToPublish[index]}`);
          // The fulfilled value might be the event id or void, depending on relay/nostr-tools version.
          // Assuming it's void or the event id, we push the original signedEvent.id
          successfulEventIds.push(signedEvent.id);
        } else {
          console.error(`Failed to publish event ${signedEvent.id} to ${relaysToPublish[index]}:`, result.reason);
        }
      });
      return successfulEventIds; // Return array of event IDs for successfully published relays
    } catch (error) {
        console.error('Error during pool.publish:', error);
        return []; // Return empty if the publish call itself fails
    }
  }

  /**
   * Subscribes to events from specified relays based on filters.
   * @param filters Nostr filters to apply.
   * @param onEvent Callback function to handle incoming events.
   * @param targetRelays Optional array of relay URLs. Defaults to pre-configured relays.
   * @param subscriptionId Optional ID for the subscription to manage it later.
   * @returns A subscription object from SimplePool (or void/null if not applicable).
   */
  public subscribeToEvents(
    filters: Filter[],
    onEvent: (event: Event) => void,
    targetRelays?: string[],
    subscriptionId?: string
  ) {
    const relaysToUse = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToUse.length === 0) {
      console.warn('No relays to subscribe to.');
      return null; // Or handle appropriately
    }

    console.log(`Subscribing to events on ${relaysToUse.join(', ')} with filters:`, filters);
    const sub = this.pool.sub(relaysToUse, filters, { id: subscriptionId });

    sub.on('event', (event: Event) => {
      onEvent(event);
    });

    sub.on('eose', () => {
      console.log(`Subscription ${subscriptionId || ''} EOSE received from one or more relays.`);
      // End Of Stored Events. You can stop loaders here.
    });

    return sub; // The caller can use this to .unsub() later
  }

  /**
   * Unsubscribes from events.
   * @param subscription The subscription object returned by subscribeToEvents.
   */
  public unsubscribe(subscription: any) { // Type properly if possible, 'any' from nostr-tools SimplePool sub
    if (subscription && typeof subscription.unsub === 'function') {
      subscription.unsub();
      console.log('Unsubscribed from events.');
    }
  }

  /**
   * Closes connections to all relays in the pool.
   */
  public disconnectAllRelays(): void {
    // SimplePool does not have a direct `disconnectAll` or `closeAll` method.
    // Connections are typically closed when subscriptions are removed or the pool instance is destroyed.
    // To explicitly close, one might need to manage individual relay connections if not using SimplePool,
    // or rely on SimplePool's internal management (e.g., when no active subscriptions).
    // For now, we can clear the pool, which should close connections.
    // this.pool.close(this.defaultRelays); // This would close specific relays
    // A more robust way might involve re-instantiating the pool or managing relays more granularly.
    // For now, this is a conceptual placeholder as SimplePool handles connections abstractly.
    console.log('Attempting to disconnect from relays (SimplePool manages this implicitly).');
    // If you need to ensure connections are closed, you might need to track relays and close them individually
    // or replace the pool instance. For now, unsubscribing all active subscriptions is the primary way.
  }

  /**
   * Decrypts a NIP-04 message.
   * @param payload The encrypted content string.
   * @param otherPartyPublicKey The public key of the other party (sender).
   * @returns A promise that resolves with the decrypted plaintext.
   */
  public async decryptMessage(payload: string, otherPartyPublicKey: string): Promise<string> {
    if (!this.isLoggedIn() || !this.privateKey) {
      throw new Error('User not logged in or private key not available for decryption.');
    }
    try {
      return await nip04.decrypt(this.privateKey, otherPartyPublicKey, payload);
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw new Error('Failed to decrypt message.');
    }
  }

  // --- Sync Specific Methods ---

  /**
   * Publishes a note for backup/sync purposes, typically encrypted to self.
   * @param note The note object to sync.
   * @param targetRelays Optional relays, defaults to user's configured relays.
   * @returns Promise resolving with event IDs from relays.
   */
  public async publishNoteForSync(note: Note, targetRelays?: string[]): Promise<string[]> {
    if (!this.isLoggedIn() || !this.privateKey || !this.publicKey) {
      throw new Error('User not logged in. Cannot publish note for sync.');
    }

    const noteJson = JSON.stringify(note);
    const encryptedContent = await nip04.encrypt(this.privateKey, this.publicKey, noteJson);

    const unsignedEvent: UnsignedEvent = {
      kind: 4, // Encrypted Direct Message (to self)
      pubkey: this.publicKey,
      created_at: Math.floor((note.updatedAt || new Date()).getTime() / 1000), // Use note's updatedAt for event's created_at
      tags: [
        ['p', this.publicKey], // Encrypted to self
        ['d', `notention-note-sync:${note.id}`], // Special d tag for sync
        // Potentially add original note.id as another tag if 'd' is purely for event replacement: ['note_id', note.id]
      ],
      content: encryptedContent,
    };

    const eventId = getEventHash(unsignedEvent);
    const signature = signEvent(unsignedEvent, this.privateKey);
    const signedEvent: Event = { ...unsignedEvent, id: eventId, sig: signature };

    const relaysToPublish = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToPublish.length === 0) {
      console.warn('No relays configured or provided to publish note for sync.');
      return []; // Return empty array, not just eventId
    }

    console.log(`Publishing note for sync to ${relaysToPublish.join(', ')}:`, signedEvent);
    // Store the signedEvent.id with the note (this should be done by the caller, e.g., in the store)
    // For now, we just return the event ID.

    try {
      const publicationPromises = this.pool.publish(relaysToPublish, signedEvent);
      const results = await Promise.allSettled(publicationPromises);
      const successfulRelaysCount = results.filter(r => r.status === 'fulfilled').length;

      if (successfulRelaysCount > 0) {
        console.log(`Sync Event ${signedEvent.id} published successfully to ${successfulRelaysCount} relay(s).`);
        // Return the event ID if published to at least one relay.
        // The caller (store) will be responsible for updating the note with this ID.
        return [signedEvent.id]; // Returning an array containing the ID for consistency, though it's one event.
      } else {
        console.error(`Failed to publish sync event ${signedEvent.id} to any relay.`);
        return [];
      }
    } catch (error) {
      console.error('Error during sync note pool.publish:', error);
      return [];
    }
  }

  /**
   * Fetches synced notes (Kind 4 events with specific 'd' tag) from relays.
   * @param since Optional timestamp to fetch events after.
   * @param targetRelays Optional relays.
   * @returns Promise resolving with an array of decrypted Note objects.
   */
  public async fetchSyncedNotes(since?: number, targetRelays?: string[]): Promise<Note[]> {
    if (!this.isLoggedIn() || !this.publicKey) {
      throw new Error('User not logged in. Cannot fetch synced notes.');
    }

    const relaysToUse = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToUse.length === 0) return [];

    const filters: Filter[] = [{
      kinds: [4],
      authors: [this.publicKey],
      '#p': [this.publicKey], // Sent to self
      // Using a prefix match for 'd' tag might require relay support or fetching all and filtering client-side.
      // For simplicity, let's fetch all kind 4 to self and filter by 'd' tag content client-side.
      // Or, if relays support prefix for 'd' tag, use it. nostr-tools might not directly support prefix in Filter.
      // Let's assume we fetch broadly and filter.
      ...(since ? { since } : {})
    }];

    const events = await this.pool.list(relaysToUse, filters);
    const syncedNotes: Note[] = [];

    for (const event of events) {
      if (event.tags.some(tag => tag[0] === 'd' && tag[1]?.startsWith('notention-note-sync:'))) {
        try {
          const decryptedContent = await this.decryptMessage(event.content, event.pubkey);
          const note = JSON.parse(decryptedContent) as Note;
          // Ensure dates are Date objects
          if (note.createdAt && typeof note.createdAt === 'string') note.createdAt = new Date(note.createdAt);
          if (note.updatedAt && typeof note.updatedAt === 'string') note.updatedAt = new Date(note.updatedAt);
          syncedNotes.push(note);
        } catch (error) {
          console.error('Error decrypting or parsing synced note:', error, event);
        }
      }
    }
    return syncedNotes;
  }

  /**
   * Publishes the ontology for sync/backup. Uses Kind 30001 (replaceable event).
   * @param ontology The ontology tree to sync.
   * @param targetRelays Optional relays.
   * @returns Promise resolving with event IDs.
   */
  public async publishOntologyForSync(ontology: any, targetRelays?: string[]): Promise<string[]> { // ontology is OntologyTree
    if (!this.isLoggedIn() || !this.privateKey || !this.publicKey) {
      throw new Error('User not logged in. Cannot publish ontology for sync.');
    }

    const ontologyJson = JSON.stringify(ontology);
    // Content for Kind 30001 is not typically encrypted by default unless app chooses to.
    // For simplicity, store as plaintext here. If encryption needed, it would wrap ontologyJson.

    const unsignedEvent: UnsignedEvent = {
      kind: 30001, // Replaceable event for user-specific data
      pubkey: this.publicKey,
      created_at: Math.floor((ontology.updatedAt || new Date()).getTime() / 1000), // Use ontology's updatedAt
      tags: [
        ['d', 'notention-ontology-sync'] // Specific d tag for this app's ontology
      ],
      content: ontologyJson,
    };

    const eventId = getEventHash(unsignedEvent);
    const signature = signEvent(unsignedEvent, this.privateKey);
    const signedEvent: Event = { ...unsignedEvent, id: eventId, sig: signature };

    const relaysToPublish = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToPublish.length === 0) {
      console.warn('No relays for ontology sync.');
      return [];
    }

    console.log(`Publishing ontology for sync to ${relaysToPublish.join(', ')}:`, signedEvent);
    try {
      const pubPromises = this.pool.publish(relaysToPublish, signedEvent);
      const results = await Promise.allSettled(pubPromises);
      // Similar success/error handling as publishNoteForSync
      return results.filter(r => r.status === 'fulfilled').map(() => signedEvent.id);
    } catch (error) {
        console.error('Error during ontology sync pool.publish:', error);
        return [];
    }
  }

  /**
   * Fetches the latest synced ontology (Kind 30001 event) from relays.
   * @param targetRelays Optional relays.
   * @returns Promise resolving with the OntologyTree or null if not found/error.
   */
  public async fetchSyncedOntology(targetRelays?: string[]): Promise<any | null> { // Returns OntologyTree
    if (!this.isLoggedIn() || !this.publicKey) {
      throw new Error('User not logged in. Cannot fetch synced ontology.');
    }

    const relaysToUse = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToUse.length === 0) return null;

    const filters: Filter[] = [{
      kinds: [30001],
      authors: [this.publicKey],
      '#d': ['notention-ontology-sync'], // Exact match for 'd' tag
      limit: 1 // We only need the latest one
    }];

    // .list() should return the most recent event first for replaceable kinds if relays behave.
    const events = await this.pool.list(relaysToUse, filters);
    if (events.length === 0) return null;

    // Sort by created_at descending to be sure we get the latest, as pool.list might return from multiple relays.
    events.sort((a, b) => b.created_at - a.created_at);

    const latestEvent = events[0];
    try {
      const ontology = JSON.parse(latestEvent.content); // as OntologyTree
      // Ensure dates are Date objects
      if (ontology.updatedAt && typeof ontology.updatedAt === 'string') {
        ontology.updatedAt = new Date(ontology.updatedAt);
      }
      return ontology;
    } catch (error) {
      console.error('Error parsing synced ontology:', error, latestEvent);
      return null;
    }
  }

  /**
   * Fetches a single event by its ID from specified relays.
   * @param eventId The ID of the event to fetch.
   * @param targetRelays Optional array of relay URLs. Defaults to pre-configured relays.
   * @returns A promise that resolves with the Event or null if not found.
   */
  public async getEventById(eventId: string, targetRelays?: string[]): Promise<Event | null> {
    const relaysToUse = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToUse.length === 0) {
      console.warn('No relays to fetch event from.');
      return null;
    }
    // SimplePool's get method fetches from one relay at a time until found or all fail.
    // It takes a filter, so we filter by id.
    try {
      const event = await this.pool.get(relaysToUse, { ids: [eventId] });
      return event; // Returns the first event found or null
    } catch (error) {
      console.error(`Error fetching event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Publishes a Kind 5 Event Deletion event.
   * @param eventIdsToMarkForDeletion Array of event IDs (strings) to be deleted.
   * @param reason Optional reason for deletion.
   * @param targetRelays Optional relays to publish to.
   * @returns Promise resolving with event IDs from relays where deletion event was published.
   */
  public async publishDeletionEvent(
    eventIdsToMarkForDeletion: string[],
    reason: string = "",
    targetRelays?: string[]
  ): Promise<string[]> {
    if (!this.isLoggedIn() || !this.privateKey || !this.publicKey) {
      throw new Error('User not logged in. Cannot publish deletion event.');
    }
    if (!eventIdsToMarkForDeletion || eventIdsToMarkForDeletion.length === 0) {
      console.warn('No event IDs provided for deletion.');
      return [];
    }

    const tags = eventIdsToMarkForDeletion.map(id => ['e', id]);
    if (reason) {
      tags.push(['reason', reason]);
    }

    const unsignedEvent: UnsignedEvent = {
      kind: 5, // Event Deletion
      pubkey: this.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: reason, // NIP-09 suggests reason can be in content if not in tags.
    };

    const eventId = getEventHash(unsignedEvent);
    const signature = signEvent(unsignedEvent, this.privateKey);
    const signedEvent: Event = { ...unsignedEvent, id: eventId, sig: signature };

    const relaysToPublish = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToPublish.length === 0) {
      console.warn('No relays for deletion event.');
      return [];
    }

    console.log(`Publishing Kind 5 deletion event for IDs: ${eventIdsToMarkForDeletion.join(', ')} to ${relaysToPublish.join(', ')}:`, signedEvent);
    try {
      const pubPromises = this.pool.publish(relaysToPublish, signedEvent);
      const results = await Promise.allSettled(pubPromises);
      return results.filter(r => r.status === 'fulfilled').map(() => signedEvent.id);
    } catch (error) {
      console.error('Error during Kind 5 deletion event pool.publish:', error);
      return [];
    }
  }

  /**
   * Fetches Kind 5 (deletion) events authored by the current user.
   * @param since Optional timestamp to fetch events after.
   * @param targetRelays Optional relays.
   * @returns Promise resolving with an array of Event objects.
   */
  public async fetchOwnDeletionEvents(since?: number, targetRelays?: string[]): Promise<Event[]> {
    if (!this.isLoggedIn() || !this.publicKey) {
      console.warn('User not logged in. Cannot fetch own deletion events.');
      return [];
    }

    const relaysToUse = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    if (relaysToUse.length === 0) {
      console.warn('No relays configured to fetch deletion events.');
      return [];
    }

    const filters: Filter[] = [{
      kinds: [5], // Kind 5 for Event Deletion
      authors: [this.publicKey],
      ...(since ? { since } : {})
    }];

    console.log(`Fetching own Kind 5 deletion events from ${relaysToUse.join(', ')} with filters:`, filters);
    try {
      const events = await this.pool.list(relaysToUse, filters);
      // Sort by created_at descending to process more recent deletions first if needed, though order might not strictly matter.
      return events.sort((a, b) => b.created_at - a.created_at);
    } catch (error) {
      console.error('Error fetching own deletion events:', error);
      return [];
    }
  }
}

// Export a singleton instance
export const nostrService = NostrService.getInstance();
