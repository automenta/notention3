import localforage from 'localforage';
import { Note, OntologyTree, UserProfile, Folder, NotentionTemplate, DirectMessage } from '../../shared/types';

// Configure localforage instances for different data types
const notesStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'notes',
  version: 1.0,
  description: 'Notes storage'
});

const ontologyStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'ontology',
  version: 1.0,
  description: 'Ontology storage'
});

const userStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'user',
  version: 1.0,
  description: 'User profile storage'
});

const foldersStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'folders',
  version: 1.0,
  description: 'Folders storage'
});

const templatesStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'templates',
  version: 1.0,
  description: 'Templates storage'
});

const messagesStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'messages',
  version: 1.0,
  description: 'Direct messages storage'
});

// Stores for sync queue
const syncQueueNotesStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'syncQueueNotes',
  version: 1.0,
  description: 'Queue for notes pending synchronization'
});

const syncFlagsStore = localforage.createInstance({
  name: 'Notention',
  storeName: 'syncFlags',
  version: 1.0,
  description: 'Simple flags for synchronization status'
});

export interface SyncQueueNoteOp {
  noteId: string;
  action: 'save' | 'delete'; // 'save' implies create or update
  timestamp: Date; // Timestamp of the operation
  nostrEventId?: string; // The ID of the Nostr event (e.g., Kind 4 for note, or the event to be deleted by Kind 5)
}

const ONTOLOGY_NEEDS_SYNC_KEY = 'ontology_needs_sync';


export class DBService {
  // Notes operations
  static async saveNote(note: Note): Promise<void> {
    await notesStore.setItem(note.id, note);
  }

  static async getNote(id: string): Promise<Note | null> {
    return await notesStore.getItem(id);
  }

  static async getAllNotes(): Promise<Note[]> {
    const notes: Note[] = [];
    // PERFORMANCE TODO: For very large numbers of notes, notesStore.iterate() loads all notes into memory.
    // This can be slow and memory-intensive. Consider pagination or indexed queries if performance becomes an issue.
    await notesStore.iterate((note: Note) => {
      notes.push(note);
    });
    return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static async deleteNote(id: string): Promise<void> {
    await notesStore.removeItem(id);
  }

  static async searchNotes(query: string): Promise<Note[]> {
    const allNotes = await this.getAllNotes();
    const lowercaseQuery = query.toLowerCase();
    
    return allNotes.filter(note => 
      note.title.toLowerCase().includes(lowercaseQuery) ||
      note.content.toLowerCase().includes(lowercaseQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Ontology operations
  static async saveOntology(ontology: OntologyTree): Promise<void> {
    // Ensure updatedAt is set/updated.
    const ontologyToSave = {
      ...ontology,
      updatedAt: new Date() // Always set to now on local save
    };
    await ontologyStore.setItem('tree', ontologyToSave);
  }

  static async getOntology(): Promise<OntologyTree | null> {
    const data = await ontologyStore.getItem<OntologyTree>('tree');
    // Ensure updatedAt is a Date object if it exists
    if (data && data.updatedAt && typeof data.updatedAt === 'string') {
      return { ...data, updatedAt: new Date(data.updatedAt) };
    }
    return data;
  }

  static async getDefaultOntology(): Promise<OntologyTree> {
    return {
      nodes: {
        'ai': {
          id: 'ai',
          label: '#AI',
          children: ['ml', 'nlp']
        },
        'ml': {
          id: 'ml',
          label: '#MachineLearning',
          parentId: 'ai'
        },
        'nlp': {
          id: 'nlp',
          label: '#NLP',
          parentId: 'ai'
        },
        'project': {
          id: 'project',
          label: '#Project',
          attributes: { 'due': 'date', 'status': 'text' }
        },
        'person': {
          id: 'person',
          label: '@Person'
        }
      },
      rootIds: ['ai', 'project', 'person']
    };
  }

  // User profile operations
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    await userStore.setItem('profile', profile);
  }

  static async getUserProfile(): Promise<UserProfile | null> {
    return await userStore.getItem('profile');
  }

  // Nostr keys operations (scoped to userStore)
  static async saveNostrPrivateKey(sk: string): Promise<void> {
    await userStore.setItem('nostrPrivateKey', sk);
  }

  static async getNostrPrivateKey(): Promise<string | null> {
    return await userStore.getItem('nostrPrivateKey');
  }

  static async removeNostrPrivateKey(): Promise<void> {
    await userStore.removeItem('nostrPrivateKey');
  }

  static async saveNostrPublicKey(pk: string): Promise<void> {
    await userStore.setItem('nostrPublicKey', pk);
  }

  static async getNostrPublicKey(): Promise<string | null> {
    return await userStore.getItem('nostrPublicKey');
  }

  static async removeNostrPublicKey(): Promise<void> {
    await userStore.removeItem('nostrPublicKey');
  }

  // Folders operations
  static async saveFolder(folder: Folder): Promise<void> {
    await foldersStore.setItem(folder.id, folder);
  }

  static async getFolder(id: string): Promise<Folder | null> {
    return await foldersStore.getItem(id);
  }

  static async getAllFolders(): Promise<Folder[]> {
    const folders: Folder[] = [];
    await foldersStore.iterate((folder: Folder) => {
      folders.push(folder);
    });
    return folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  static async deleteFolder(id: string): Promise<void> {
    await foldersStore.removeItem(id);
  }

  // Templates operations
  static async saveTemplate(template: NotentionTemplate): Promise<void> {
    await templatesStore.setItem(template.id, template);
  }

  static async getTemplate(id: string): Promise<NotentionTemplate | null> {
    return await templatesStore.getItem(id);
  }

  static async getAllTemplates(): Promise<NotentionTemplate[]> {
    const templates: NotentionTemplate[] = [];
    await templatesStore.iterate((template: NotentionTemplate) => {
      templates.push(template);
    });
    return templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  static async deleteTemplate(id: string): Promise<void> {
    await templatesStore.removeItem(id);
  }

  static async getDefaultTemplates(): Promise<NotentionTemplate[]> {
    return [
      {
        id: 'meeting-note',
        name: 'Meeting Note',
        description: 'Template for meeting notes',
        fields: [
          { name: 'Date', type: 'date', required: true },
          { name: 'Attendees', type: 'text', required: false },
          { name: 'Action Items', type: 'text', required: false }
        ],
        defaultTags: ['#Meeting'],
        defaultValues: {}
      },
      {
        id: 'project-note',
        name: 'Project Note',
        description: 'Template for project-related notes',
        fields: [
          { name: 'Status', type: 'select', required: true, options: ['Planning', 'In Progress', 'Completed', 'On Hold'] },
          { name: 'Due Date', type: 'date', required: false },
          { name: 'Priority', type: 'select', required: false, options: ['Low', 'Medium', 'High'] }
        ],
        defaultTags: ['#Project'],
        defaultValues: { 'status': 'Planning' }
      }
    ];
  }

  // Direct messages operations
  static async saveMessage(message: DirectMessage): Promise<void> {
    await messagesStore.setItem(message.id, message);
  }

  static async getMessage(id: string): Promise<DirectMessage | null> {
    return await messagesStore.getItem(id);
  }

  static async getAllMessages(): Promise<DirectMessage[]> {
    const messages: DirectMessage[] = [];
    await messagesStore.iterate((message: DirectMessage) => {
      messages.push(message);
    });
    return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  static async getMessagesForUser(userPubkey: string): Promise<DirectMessage[]> {
    const allMessages = await this.getAllMessages();
    return allMessages.filter(msg => msg.from === userPubkey || msg.to === userPubkey);
  }

  // Import/Export operations
  static async exportData(): Promise<{
    notes: Note[];
    ontology: OntologyTree | null;
    folders: Folder[];
    templates: NotentionTemplate[];
  }> {
    return {
      notes: await this.getAllNotes(),
      ontology: await this.getOntology(),
      folders: await this.getAllFolders(),
      templates: await this.getAllTemplates()
    };
  }

  static async importData(data: {
    notes?: Note[];
    ontology?: OntologyTree;
    folders?: Folder[];
    templates?: NotentionTemplate[];
  }): Promise<void> {
    if (data.notes) {
      for (const note of data.notes) {
        await this.saveNote(note);
      }
    }
    if (data.ontology) {
      await this.saveOntology(data.ontology);
    }
    if (data.folders) {
      for (const folder of data.folders) {
        await this.saveFolder(folder);
      }
    }
    if (data.templates) {
      for (const template of data.templates) {
        await this.saveTemplate(template);
      }
    }
  }

  // Clear all data (for testing or reset)
  static async clearAllData(): Promise<void> {
    await Promise.all([
      notesStore.clear(),
      ontologyStore.clear(),
      userStore.clear(),
      foldersStore.clear(),
      templatesStore.clear(),
      messagesStore.clear()
    ]);
    // Also clear sync queue stores
    await Promise.all([
      syncQueueNotesStore.clear(),
      syncFlagsStore.clear()
    ]);
  }

  // Sync Queue for Notes
  static async addNoteToSyncQueue(op: SyncQueueNoteOp): Promise<void> {
    // Store ops by noteId. If an op for a noteId already exists, this will overwrite it.
    // This is suitable for a LWW strategy where only the latest state matters.
    // Ensure timestamp is current for the operation.
    await syncQueueNotesStore.setItem(op.noteId, {...op, timestamp: new Date()});
  }

  static async getPendingNoteSyncOps(): Promise<SyncQueueNoteOp[]> {
    const ops: SyncQueueNoteOp[] = [];
    await syncQueueNotesStore.iterate<SyncQueueNoteOp, void>((value) => {
      // Ensure timestamp is a Date object
      if (value.timestamp && typeof value.timestamp === 'string') {
        value.timestamp = new Date(value.timestamp);
      }
      ops.push(value);
    });
    // Sort by timestamp to process older operations first, though with LWW overwrite, this might be less critical.
    return ops.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  static async removeNoteFromSyncQueue(noteId: string): Promise<void> {
    await syncQueueNotesStore.removeItem(noteId);
  }

  static async clearNoteSyncQueue(): Promise<void> {
    await syncQueueNotesStore.clear();
  }

  // Sync Flag for Ontology
  static async setOntologyNeedsSync(needsSync: boolean): Promise<void> {
    await syncFlagsStore.setItem(ONTOLOGY_NEEDS_SYNC_KEY, needsSync);
  }

  static async getOntologyNeedsSync(): Promise<boolean> {
    const needsSync = await syncFlagsStore.getItem<boolean>(ONTOLOGY_NEEDS_SYNC_KEY);
    return needsSync === null ? false : needsSync; // Default to false if not set
  }
}