import { create, StoreApi, UseBoundStore } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';
import {
	AppState,
	Note,
	OntologyTree,
	UserProfile,
	Folder,
	NotentionTemplate,
	SearchFilters,
	Match,
	DirectMessage,
	NostrEvent,
	Contact,
} from '../../shared/types';
import { DBService } from '../services/db';
import { FolderService } from '../services/FolderService';
import { OntologyService } from '../services/ontology'; // Added OntologyService import
import { NoteService } from '../services/NoteService';
import { nostrService, NostrService } from '../services/NostrService'; // Import NostrService
import { Filter } from 'nostr-tools';

interface AppActions {
	// Initialization
	initializeApp: () => Promise<void>;

	// Notes actions
	createNote: (partialNote?: Partial<Note>) => Promise<string>;
	updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
	deleteNote: (id: string) => Promise<void>;
	setCurrentNote: (id: string | undefined) => void;
	setSearchQuery: (query: string) => void;
	setSearchFilters: (filters: Partial<SearchFilters>) => void;
	moveNoteToFolder: (
		noteId: string,
		folderId: string | undefined
	) => Promise<void>;

	// Ontology actions
	setOntology: (ontology: OntologyTree) => Promise<void>;

	// User profile actions
	updateUserProfile: (profileUpdates: Partial<UserProfile>) => Promise<void>;
	generateAndStoreNostrKeys: (
		privateKey?: string,
		publicKey?: string
	) => Promise<{ publicKey: string | null; privateKey?: string }>; // Returns sk if newly generated
	logoutFromNostr: () => Promise<void>;

	// Folders actions
	loadFolders: () => Promise<void>;
	createFolder: (
		name: string,
		parentId?: string
	) => Promise<string | undefined>;
	updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
	deleteFolder: (id: string) => Promise<void>;

	// Templates actions
	createTemplate: (
		templateData: Omit<NotentionTemplate, 'id'>
	) => Promise<string>;
	updateTemplate: (
		id: string,
		updates: Partial<NotentionTemplate>
	) => Promise<void>;
	deleteTemplate: (id: string) => Promise<void>;

	// UI actions
	setSidebarTab: (tab: AppState['sidebarTab']) => void;
	setEditorContent: (content: string) => void;
	setIsEditing: (editing: boolean) => void;

	// Loading and error actions
	setLoading: (key: keyof AppState['loading'], loading: boolean) => void;
	setError: (key: keyof AppState['errors'], error: string | undefined) => void;

	// Nostr specific actions
	initializeNostr: () => Promise<void>; // Renamed from initializeNostrService
	setNostrConnected: (status: boolean) => void; // Renamed from connected for clarity
	publishCurrentNoteToNostr: (options: {
		encrypt?: boolean;
		recipientPk?: string;
		relays?: string[];
	}) => Promise<void>;
	subscribeToPublicNotes: (relays?: string[]) => string | null; // Returns subscription ID or null
	subscribeToTopic: (topic: string, relays?: string[]) => string | null; // Returns subscription ID
	unsubscribeFromNostr: (subscriptionId: string | any) => void; // Accepts ID or subscription object
	addNostrMatch: (match: Match) => void;
	addDirectMessage: (message: DirectMessage) => void;
	setNostrRelays: (relays: string[]) => Promise<void>;
	addNostrRelay: (relay: string) => Promise<void>;
	removeNostrRelay: (relay: string) => Promise<void>;
	handleIncomingNostrEvent: (event: NostrEvent) => void; // Central handler for events

	// DM specific actions
	sendDirectMessage: (recipientPk: string, content: string) => Promise<void>;
	subscribeToDirectMessages: (relays?: string[]) => string | null; // Returns subscription ID

	// Topic subscription actions
	addTopicSubscription: (topic: string, subscriptionId: string) => void;
	removeTopicSubscription: (topic: string) => void;
	addNoteToTopic: (topic: string, note: NostrEvent) => void;

	// Sync actions
	syncWithNostr: (force?: boolean) => Promise<void>;
	setLastSyncTimestamp: (timestamp: Date) => void;

	// Embedding Matches
	findAndSetEmbeddingMatches: (
		noteId: string,
		similarityThreshold?: number
	) => Promise<void>;

	// Contacts (Buddy List)
	addContact: (contact: Contact) => Promise<void>;
	removeContact: (pubkey: string) => Promise<void>;
	updateContactAlias: (pubkey: string, alias: string) => Promise<void>;

	// Ontology actions
	moveOntologyNode: (
		nodeId: string,
		newParentId: string | undefined,
		newIndex: number
	) => void;
	updateUserProfile: (profileUpdates: Partial<UserProfile>) => Promise<void>;
}

type AppStore = AppState & AppActions;

// Helper to check online status
const isOnline = () => navigator.onLine;

// Define a type for the Nostr subscription store
type NostrSubscriptionStore = {
	[id: string]: any; // nostr-tools subscription object
};

export const useAppStore = create<AppStore>((set, get) => ({
	// Initial state
	notes: {
		note1: {
			id: 'note1',
			title: 'My First Note',
			content: '<p>This is the <strong>content</strong> of my first note.</p>',
			tags: ['#test', '#example'],
			values: {},
			fields: {},
			status: 'draft',
			createdAt: new Date('2023-01-01T10:00:00Z'),
			updatedAt: new Date('2023-01-01T10:00:00Z'),
		},
		note2: {
			id: 'note2',
			title: 'Another Note',
			content: "<p>Here's another note about <em>Web Components</em>.</p>",
			tags: ['#webcomponents', '#ui'],
			values: {},
			fields: {},
			status: 'published',
			createdAt: new Date('2023-01-05T11:30:00Z'),
			updatedAt: new Date('2023-01-05T11:30:00Z'),
		},
		note3: {
			id: 'note3',
			title: 'Unfiled Idea',
			content: '<p>This note is not in any folder.</p>',
			tags: [],
			values: {},
			fields: {},
			status: 'draft',
			createdAt: new Date('2023-01-10T14:00:00Z'),
			updatedAt: new Date('2023-01-10T14:00:00Z'),
		},
	},
	ontology: { nodes: {}, rootIds: [] },
	userProfile: undefined, // Will be populated during initializeApp or initializeNostr
	folders: {
		folder1: {
			id: 'folder1',
			name: 'Projects',
			noteIds: ['note1'],
			children: [],
			createdAt: new Date('2023-01-01T09:00:00Z'),
			updatedAt: new Date('2023-01-01T09:00:00Z'),
		},
		folder2: {
			id: 'folder2',
			name: 'Ideas',
			noteIds: ['note2'],
			children: [],
			createdAt: new Date('2023-01-03T10:00:00Z'),
			updatedAt: new Date('2023-01-03T10:00:00Z'),
		},
	},
	templates: {},

	currentNoteId: undefined,
	sidebarTab: 'notes' as
		| 'notes'
		| 'ontology'
		| 'network'
		| 'settings'
		| 'contacts'
		| 'chats', // Added 'chats' back
	searchQuery: '',
	searchFilters: {},

	matches: [],
	directMessages: [],
	embeddingMatches: [], // New state for embedding-based matches
	// Default relays, user can override via settings
	nostrRelays: [
		'wss://relay.damus.io',
		'wss://nos.lol',
		'wss://relay.snort.social',
	], // This will be synced with userProfile.nostrRelays
	nostrConnected: false, // Explicitly for Nostr connection status
	activeNostrSubscriptions: {} as NostrSubscriptionStore, // General subscriptions like public notes, DMs

	// New state for topic-specific subscriptions and notes
	activeTopicSubscriptions: {}, // Maps topic string to its specific subscription ID
	topicNotes: {}, // Maps topic string to an array of NostrEvent

	editorContent: '',
	isEditing: false,

	loading: {
		notes: false,
		ontology: false,
		network: false,
		sync: false, // For sync operation
	},

	errors: {
		sync: undefined, // For sync errors
	},

	lastSyncTimestamp: undefined, // Timestamp of the last successful full sync

	// Actions
	initializeApp: async () => {
		const state = get();

		try {
			// Load all data from IndexedDB
			state.setLoading('notes', true);
			state.setLoading('ontology', true);

			const notesList = await DBService.getAllNotes(); // Renamed for clarity
			const notesMap: { [id: string]: Note } = {};
			notesList.forEach(note => {
				// Iterate over notesList
				// Ensure dates are Date objects after fetching
				if (note.createdAt && typeof note.createdAt === 'string')
					note.createdAt = new Date(note.createdAt);
				if (note.updatedAt && typeof note.updatedAt === 'string')
					note.updatedAt = new Date(note.updatedAt);
				notesMap[note.id] = note;
			});

			let ontologyData = await DBService.getOntology();
			if (!ontologyData) {
				ontologyData = await DBService.getDefaultOntology(); // This now includes updatedAt
				await DBService.saveOntology(ontologyData); // This saves it with a new updatedAt
				ontologyData = (await DBService.getOntology()) || ontologyData; // Re-fetch to be sure
			} else if (
				ontologyData.updatedAt &&
				typeof ontologyData.updatedAt === 'string'
			) {
				ontologyData.updatedAt = new Date(ontologyData.updatedAt);
			}

			let userProfileData = await DBService.getUserProfile();
			const defaultRelays = [
				'wss://relay.damus.io',
				'wss://nos.lol',
				'wss://relay.snort.social',
			];
			let relaysToUseInStore = defaultRelays;

			if (!userProfileData) {
				userProfileData = {
					nostrPubkey: '',
					sharedTags: [],
					preferences: {
						theme: 'system',
						aiEnabled: false,
						defaultNoteStatus: 'draft',
						ollamaApiEndpoint: '',
						geminiApiKey: '',
						aiMatchingSensitivity: 0.7, // Default sensitivity
					},
					nostrRelays: defaultRelays,
					privacySettings: {
						sharePublicNotesGlobally: false,
						shareTagsWithPublicNotes: true,
						shareValuesWithPublicNotes: true,
					},
				};
			} else {
				if (
					!userProfileData.nostrRelays ||
					userProfileData.nostrRelays.length === 0
				) {
					userProfileData.nostrRelays = defaultRelays;
				}
				if (!userProfileData.privacySettings) {
					userProfileData.privacySettings = {
						sharePublicNotesGlobally: false,
						shareTagsWithPublicNotes: true,
						shareValuesWithPublicNotes: true,
					};
				}
				relaysToUseInStore = userProfileData.nostrRelays;
			}
			userProfileData.preferences = {
				theme: 'system',
				aiEnabled: false,
				defaultNoteStatus: 'draft',
				ollamaApiEndpoint: '',
				geminiApiKey: '',
				aiMatchingSensitivity: 0.7, // Ensure default here too
				...userProfileData.preferences,
			};

			const foldersList = await FolderService.getAllFolders(); // Renamed
			const foldersMap: { [id: string]: Folder } = {};
			foldersList.forEach(folder => (foldersMap[folder.id] = folder)); // Iterate over foldersList

			let templatesList = await DBService.getAllTemplates(); // Renamed
			if (templatesList.length === 0) {
				// Iterate over templatesList
				const defaultTemplates = await DBService.getDefaultTemplates();
				for (const template of defaultTemplates) {
					await DBService.saveTemplate(template);
				}
				templatesList = defaultTemplates; // Iterate over templatesList
			}
			const templatesMap: { [id: string]: NotentionTemplate } = {};
			templatesList.forEach(template => {
				// Iterate over templatesList
				templatesMap[template.id] = template;
			});

			set({
				notes: notesMap,
				ontology: ontologyData,
				userProfile: userProfileData,
				folders: foldersMap,
				templates: templatesMap,
				nostrRelays: relaysToUseInStore,
			});

			await get().initializeNostr(); // This might update userProfile with nostrPubkey

			// Initial Sync attempt after Nostr initialization
			if (isOnline() && get().userProfile?.nostrPubkey) {
				console.log('Attempting initial sync with Nostr...');
				await get().syncWithNostr(true); // Force full sync on init
			}
		} catch (error: any) {
			console.error('Failed to initialize app:', error);
			(get() as AppStore).setError(
				'notes',
				`Failed to load data: ${error.message}`
			);
		} finally {
			(get() as AppStore).setLoading('notes', false);
			(get() as AppStore).setLoading('ontology', false);
		}

		// Setup online/offline listeners
		window.addEventListener('online', () => {
			console.log('Application came online. Attempting to sync...');
			get().syncWithNostr();
		});
		window.addEventListener('offline', () => {
			console.log('Application went offline.');
			get().setError('sync', 'Application is offline. Sync paused.');
		});
	},

	createNote: async (partialNote?: Partial<Note>) => {
		const newNote = await NoteService.createNote(partialNote || {}); // This saves to DBService
		set(state => ({
			notes: { ...state.notes, [newNote.id]: newNote },
			currentNoteId: newNote.id,
			editorContent: newNote.content,
			isEditing: true,
		}));

		if (isOnline() && get().userProfile?.nostrPubkey) {
			try {
				const publishedEventIds = await nostrService.publishNoteForSync(
					newNote,
					get().userProfile?.nostrRelays || get().nostrRelays
				);
				if (publishedEventIds.length > 0 && publishedEventIds[0]) {
					// Update the note in the store and DB with the nostrSyncEventId
					const noteWithSyncId = {
						...newNote,
						nostrSyncEventId: publishedEventIds[0],
					};
					await DBService.saveNote(noteWithSyncId); // Save to DB with sync ID
					set(state => ({
						notes: { ...state.notes, [newNote.id]: noteWithSyncId },
					}));
					console.log(
						`Note ${newNote.id} synced with event ID ${publishedEventIds[0]}`
					);
				} else {
					// Publishing failed or returned no ID, queue it
					await DBService.addNoteToSyncQueue({
						noteId: newNote.id,
						action: 'save',
						timestamp: new Date(),
						nostrEventId: newNote.nostrSyncEventId,
					});
				}
			} catch (e) {
				console.warn(
					'Live sync on createNote failed, will queue or retry later',
					e
				);
				await DBService.addNoteToSyncQueue({
					noteId: newNote.id,
					action: 'save',
					timestamp: new Date(),
					nostrEventId: newNote.nostrSyncEventId,
				});
			}
		} else {
			await DBService.addNoteToSyncQueue({
				noteId: newNote.id,
				action: 'save',
				timestamp: new Date(),
				nostrEventId: newNote.nostrSyncEventId,
			});
		}
		return newNote.id;
	},

	updateNote: async (id: string, updates: Partial<Note>) => {
		let updatedNote = await NoteService.updateNote(id, updates); // This saves to DBService
		if (updatedNote) {
			set(state => ({
				notes: { ...state.notes, [id]: updatedNote! },
				...(state.currentNoteId === id &&
					state.editorContent !== updatedNote!.content && {
						editorContent: updatedNote!.content,
					}),
			}));

			if (isOnline() && get().userProfile?.nostrPubkey) {
				try {
					const publishedEventIds = await nostrService.publishNoteForSync(
						updatedNote,
						get().userProfile?.nostrRelays || get().nostrRelays
					);
					if (publishedEventIds.length > 0 && publishedEventIds[0]) {
						if (updatedNote.nostrSyncEventId !== publishedEventIds[0]) {
							updatedNote = {
								...updatedNote,
								nostrSyncEventId: publishedEventIds[0],
							};
							await DBService.saveNote(updatedNote); // Save to DB with new sync ID
							set(state => ({ notes: { ...state.notes, [id]: updatedNote! } }));
						}
						console.log(
							`Note ${id} updated and synced with event ID ${publishedEventIds[0]}`
						);
					} else {
						await DBService.addNoteToSyncQueue({
							noteId: id,
							action: 'save',
							timestamp: new Date(),
							nostrEventId: updatedNote.nostrSyncEventId,
						});
					}
				} catch (e) {
					console.warn(
						'Live sync on updateNote failed, will queue or retry later',
						e
					);
					await DBService.addNoteToSyncQueue({
						noteId: id,
						action: 'save',
						timestamp: new Date(),
						nostrEventId: updatedNote.nostrSyncEventId,
					});
				}
			} else {
				await DBService.addNoteToSyncQueue({
					noteId: id,
					action: 'save',
					timestamp: new Date(),
					nostrEventId: updatedNote.nostrSyncEventId,
				});
			}
		}
	},

	deleteNote: async (id: string) => {
		const state = get();
		// IMPORTANT: Fetch the note from DBService *before* deleting it locally from state or DB
		// to ensure we have its nostrSyncEventId if it exists.
		const noteToDelete = await DBService.getNote(id);
		const nostrEventIdToDelete = noteToDelete?.nostrSyncEventId;

		// Perform local deletion from DB first
		await NoteService.deleteNote(id); // This deletes from DBService via NoteService

		// Update folder associations in the store if the note was in a folder
		if (noteToDelete && noteToDelete.folderId) {
			const folder = state.folders[noteToDelete.folderId];
			if (folder) {
				const updatedFolder = {
					...folder,
					noteIds: folder.noteIds.filter(nid => nid !== id),
					updatedAt: new Date(),
				};
				// Persist folder changes (NoteService.deleteNote doesn't handle folder updates)
				// This might be better handled in FolderService or by having NoteService return folder updates
				await FolderService.updateFolder(folder.id, {
					noteIds: updatedFolder.noteIds,
				});
				set(s => ({
					folders: { ...s.folders, [folder.id]: updatedFolder },
				}));
			}
		}

		// Update store state (remove note, clear currentNoteId if it was the deleted one)
		set(s => {
			const newNotes = { ...s.notes };
			delete newNotes[id];
			return {
				notes: newNotes,
				currentNoteId: s.currentNoteId === id ? undefined : s.currentNoteId,
				editorContent: s.currentNoteId === id ? '' : s.editorContent, // Clear editor if current note deleted
				isEditing: s.currentNoteId === id ? false : s.isEditing,
			};
		});

		// Handle Nostr deletion event publishing
		if (get().userProfile?.nostrPubkey) {
			// Check if user is logged in
			if (nostrEventIdToDelete) {
				// Only publish Kind 5 if the note was previously synced
				if (isOnline()) {
					try {
						await nostrService.publishDeletionEvent(
							[nostrEventIdToDelete],
							'Note deleted by user.',
							get().userProfile?.nostrRelays || get().nostrRelays
						);
						console.log(
							`Published Kind 5 deletion for Nostr event ID: ${nostrEventIdToDelete}`
						);
						// If successfully published, ensure it's not in the queue for deletion retry
						await DBService.removeNoteFromSyncQueue(id);
					} catch (e) {
						console.warn(
							`Failed to publish Kind 5 for event ${nostrEventIdToDelete}. Adding to sync queue for retry.`,
							e
						);
						await DBService.addNoteToSyncQueue({
							noteId: id,
							action: 'delete',
							timestamp: new Date(),
							nostrEventId: nostrEventIdToDelete,
						});
					}
				} else {
					// Offline, but had a nostrEventId, so queue the deletion
					console.log(
						`Offline: Queuing Kind 5 deletion for Nostr event ID: ${nostrEventIdToDelete}`
					);
					await DBService.addNoteToSyncQueue({
						noteId: id,
						action: 'delete',
						timestamp: new Date(),
						nostrEventId: nostrEventIdToDelete,
					});
				}
			} else {
				// Note was never synced (no nostrEventIdToDelete), so no Kind 5 to publish.
				// However, if it was in the sync queue for 'save', that operation should be removed.
				console.log(
					`Note ${id} was likely never synced or had no sync ID. Removing from save queue if present.`
				);
				await DBService.removeNoteFromSyncQueue(id); // This will remove any pending 'save' or 'delete' op for this noteId.
			}
		} else {
			// User not logged into Nostr, or no nostrEventIdToDelete.
			// If there was a nostrEventId, but user is not logged in (e.g. keys cleared), still queue it.
			if (nostrEventIdToDelete) {
				console.log(
					`User not logged into Nostr or offline: Queuing Kind 5 deletion for Nostr event ID: ${nostrEventIdToDelete}`
				);
				await DBService.addNoteToSyncQueue({
					noteId: id,
					action: 'delete',
					timestamp: new Date(),
					nostrEventId: nostrEventIdToDelete,
				});
			} else {
				// No Nostr presence and note was never synced. Just ensure it's not in queue.
				await DBService.removeNoteFromSyncQueue(id);
			}
		}
	},

	moveNoteToFolder: async (noteId: string, folderId: string | undefined) => {
		const state = get();
		const note = state.notes[noteId];
		if (!note) return;

		const oldFolderId = note.folderId;

		// Update note's folderId
		const updatedNote = await NoteService.updateNote(noteId, { folderId });
		if (!updatedNote) return; // Should not happen if note exists

		let newFoldersState = { ...state.folders };

		// Remove from old folder's noteIds
		if (oldFolderId) {
			const oldFolder = state.folders[oldFolderId];
			if (oldFolder) {
				const updatedOldFolder = {
					...oldFolder,
					noteIds: oldFolder.noteIds.filter(id => id !== noteId),
					updatedAt: new Date(),
				};
				await FolderService.updateFolder(oldFolderId, {
					noteIds: updatedOldFolder.noteIds,
				});
				newFoldersState = {
					...newFoldersState,
					[oldFolderId]: updatedOldFolder,
				};
			}
		}

		// Add to new folder's noteIds
		if (folderId) {
			const newFolder = state.folders[folderId];
			if (newFolder) {
				const updatedNewFolder = {
					...newFolder,
					noteIds: [...new Set([...newFolder.noteIds, noteId])], // Avoid duplicates
					updatedAt: new Date(),
				};
				await FolderService.updateFolder(folderId, {
					noteIds: updatedNewFolder.noteIds,
				});
				newFoldersState = { ...newFoldersState, [folderId]: updatedNewFolder };
			}
		}

		set(s => ({
			notes: { ...s.notes, [noteId]: updatedNote },
			folders: newFoldersState,
		}));
	},

	setCurrentNote: (id: string | undefined) => {
		const state = get();
		const note = id ? state.notes[id] : undefined;
		set({
			currentNoteId: id,
			editorContent: note?.content || '',
			isEditing: !!id, // Automatically enter editing mode when a note is selected
			// searchQuery: '', // Optionally clear search on note selection
		});
	},

	setSearchQuery: (query: string) => {
		set({ searchQuery: query });
	},

	setSearchFilters: (filters: Partial<SearchFilters>) => {
		set(state => ({ searchFilters: { ...state.searchFilters, ...filters } }));
	},

	setOntology: async (ontologyData: OntologyTree) => {
		// DBService.saveOntology now sets updatedAt
		await DBService.saveOntology(ontologyData);
		const savedOntology = await DBService.getOntology(); // Re-fetch to get with updated timestamp
		set({ ontology: savedOntology || ontologyData });

		if (isOnline() && get().userProfile?.nostrPubkey) {
			if (savedOntology) {
				nostrService
					.publishOntologyForSync(
						savedOntology,
						get().userProfile?.nostrRelays || get().nostrRelays
					)
					.catch(e =>
						console.warn(
							'Live sync on setOntology failed, will queue or retry later',
							e
						)
					);
			}
		} else {
			await DBService.setOntologyNeedsSync(true);
		}
	},

	// updateUserProfile is fine, no direct sync implications unless specific fields were synced.

	createFolder: async (name: string, parentId?: string) => {
		try {
			const newFolder = await FolderService.createFolder(name, parentId);
			set(state => ({
				folders: { ...state.folders, [newFolder.id]: newFolder },
			}));
			// If parentId, update parent in store as well
			if (parentId && get().folders[parentId]) {
				const parentFolder = get().folders[parentId];
				const updatedParent = {
					...parentFolder,
					children: [...(parentFolder.children || []), newFolder.id],
					updatedAt: new Date(),
				};
				set(state => ({
					folders: { ...state.folders, [parentId]: updatedParent },
				}));
			}
			return newFolder.id;
		} catch (error) {
			console.error('Failed to create folder:', error);
			(get() as AppStore).setError(
				'notes',
				`Failed to create folder: ${(error as Error).message}`
			);
			return undefined;
		}
	},

	updateFolder: async (id: string, updates: Partial<Folder>) => {
		const state = get();
		const oldFolder = state.folders[id];
		if (!oldFolder) return;

		const updatedFolder = await FolderService.updateFolder(id, updates);
		if (updatedFolder) {
			const newFoldersState = { ...state.folders, [id]: updatedFolder };

			// Handle parent change logic for store state
			const oldParentId = oldFolder.parentId;
			const newParentId = updatedFolder.parentId;

			if (newParentId !== oldParentId) {
				// Remove from old parent's children in store
				if (oldParentId && newFoldersState[oldParentId]) {
					const oldParent = newFoldersState[oldParentId];
					newFoldersState[oldParentId] = {
						...oldParent,
						children: (oldParent.children || []).filter(
							childId => childId !== id
						),
						updatedAt: new Date(),
					};
				}
				// Add to new parent's children in store
				if (newParentId && newFoldersState[newParentId]) {
					const newParent = newFoldersState[newParentId];
					newFoldersState[newParentId] = {
						...newParent,
						children: [...new Set([...(newParent.children || []), id])],
						updatedAt: new Date(),
					};
				}
			}
			set({ folders: newFoldersState });
		}
	},

	deleteFolder: async (id: string) => {
		const state = get();
		const folderToDelete = state.folders[id];
		if (!folderToDelete) return;

		// Create a flat map of all folders for FolderService to use
		const allFoldersMap = { ...state.folders };

		await FolderService.deleteFolder(id, allFoldersMap); // This handles DB updates

		// Update store state based on what FolderService did (could be complex)
		// For simplicity, re-fetch or derive new state. Here we manually update.
		const newFolders = { ...state.folders };
		const notesToUpdate = { ...state.notes };

		// Collect all child folder IDs to delete from store state
		const folderIdsToDelete: string[] = [id];
		const collectChildren = (folderId: string) => {
			const children = newFolders[folderId]?.children;
			if (children) {
				children.forEach(childId => {
					folderIdsToDelete.push(childId);
					collectChildren(childId);
				});
			}
		};
		collectChildren(id);

		folderIdsToDelete.forEach(fid => delete newFolders[fid]);

		// Unassign notes from deleted folders in the store
		Object.values(state.notes).forEach(note => {
			if (note.folderId && folderIdsToDelete.includes(note.folderId)) {
				notesToUpdate[note.id] = {
					...note,
					folderId: undefined,
					updatedAt: new Date(),
				};
			}
		});

		// Remove from parent's children list in store state
		if (folderToDelete.parentId && newFolders[folderToDelete.parentId]) {
			const parentFolder = newFolders[folderToDelete.parentId];
			newFolders[folderToDelete.parentId] = {
				...parentFolder,
				children: (parentFolder.children || []).filter(
					childId => childId !== id
				),
				updatedAt: new Date(),
			};
		}

		set({ folders: newFolders, notes: notesToUpdate });
	},

	createTemplate: async (templateData: Omit<NotentionTemplate, 'id'>) => {
		// Ensure param name matches
		const id = uuidv4();
		const template: NotentionTemplate = {
			...templateData,
			id,
		};

		await DBService.saveTemplate(template);

		set(state => ({
			templates: { ...state.templates, [id]: template },
		}));

		return id;
	},

	updateTemplate: async (id: string, updates: Partial<NotentionTemplate>) => {
		const state = get();
		const existingTemplate = state.templates[id];
		if (!existingTemplate) return;

		const updatedTemplate: NotentionTemplate = {
			...existingTemplate,
			...updates,
		};

		await DBService.saveTemplate(updatedTemplate);

		set(state => ({
			templates: { ...state.templates, [id]: updatedTemplate },
		}));
	},

	deleteTemplate: async (id: string) => {
		await DBService.deleteTemplate(id);

		set(state => {
			const newTemplates = { ...state.templates };
			delete newTemplates[id];

			return { templates: newTemplates };
		});
	},

	setSidebarTab: (tab: AppState['sidebarTab']) => {
		set({ sidebarTab: tab });
	},

	setEditorContent: (content: string) => {
		set({ editorContent: content });
	},

	setIsEditing: (editing: boolean) => {
		set({ isEditing: editing });
	},

	setLoading: (key: keyof AppState['loading'], loading: boolean) => {
		set(state => ({
			loading: { ...state.loading, [key]: loading },
		}));
	},

	setError: (key: keyof AppState['errors'], error: string | undefined) => {
		set(state => ({
			errors: { ...state.errors, [key]: error },
		}));
	},

	// Nostr Actions Implementation
	initializeNostr: async () => {
		get().setLoading('network', true);
		const userProfile = get().userProfile; // Get current profile, which should be initialized by initializeApp
		const defaultRelays = get().nostrRelays; // These are the current store defaults or from initial load

		try {
			const loaded = await nostrService.loadKeyPair();
			if (loaded) {
				const pk = nostrService.getPublicKey();
				if (userProfile) {
					userProfile.nostrPubkey = pk!;
					// Ensure relays in profile are synced if they were somehow missed or if profile was minimal
					if (
						!userProfile.nostrRelays ||
						userProfile.nostrRelays.length === 0
					) {
						userProfile.nostrRelays = defaultRelays;
					}
					await DBService.saveUserProfile(userProfile); // Save updated profile with pubkey and potentially relays
					set({
						userProfile,
						nostrConnected: true,
						nostrRelays: userProfile.nostrRelays,
					});
				} else {
					// This case should ideally not happen if initializeApp correctly creates a default profile
					const newProfile: UserProfile = {
						nostrPubkey: pk!,
						sharedTags: [],
						preferences: {
							theme: 'system',
							aiEnabled: false,
							defaultNoteStatus: 'draft',
							ollamaApiEndpoint: '',
							geminiApiKey: '',
							aiMatchingSensitivity: 0.7,
						},
						nostrRelays: defaultRelays,
						privacySettings: {
							// Default privacy settings
							sharePublicNotesGlobally: false,
							shareTagsWithPublicNotes: true,
							shareValuesWithPublicNotes: true,
						},
					};
					await DBService.saveUserProfile(newProfile);
					set({
						userProfile: newProfile,
						nostrConnected: true,
						nostrRelays: newProfile.nostrRelays,
					});
				}
			} else {
				// Keys not found, ensure profile reflects this if it exists
				if (userProfile && userProfile.nostrPubkey) {
					userProfile.nostrPubkey = ''; // Clear pubkey if keys are not loaded
					if (!userProfile.privacySettings) {
						// Ensure privacy settings exist
						userProfile.privacySettings = {
							sharePublicNotesGlobally: false,
							shareTagsWithPublicNotes: true,
							shareValuesWithPublicNotes: true,
						};
					}
					await DBService.saveUserProfile(userProfile);
					set({ userProfile, nostrConnected: false });
				} else if (userProfile && !userProfile.privacySettings) {
					// Profile exists but no pubkey and no privacy settings (e.g. fresh default from initializeApp before key load attempt)
					userProfile.privacySettings = {
						sharePublicNotesGlobally: false,
						shareTagsWithPublicNotes: true,
						shareValuesWithPublicNotes: true,
					};
					await DBService.saveUserProfile(userProfile);
					set({ userProfile, nostrConnected: false });
				} else {
					set({ nostrConnected: false });
				}
			}
		} catch (error: any) {
			get().setError('network', `Failed to initialize Nostr: ${error.message}`);
			set({ nostrConnected: false });
		} finally {
			get().setLoading('network', false);
		}
	},

	setNostrConnected: (status: boolean) => {
		set({ nostrConnected: status });
	},

	generateAndStoreNostrKeys: async (
		providedSk?: string,
		providedPk?: string
	) => {
		get().setLoading('network', true);
		let userProfile = get().userProfile;
		const currentRelaysInStore = get().nostrRelays;
		const defaultPrivacySettings = {
			sharePublicNotesGlobally: false,
			shareTagsWithPublicNotes: true,
			shareValuesWithPublicNotes: true,
		};

		let skToStore: string;
		let pkToStore: string;
		let newlyGeneratedSk: string | undefined = undefined;

		try {
			if (providedSk) {
				// If a private key is provided, use it (and derive public key if not also provided)
				skToStore = providedSk;
				pkToStore = providedPk || nostrService.getPublicKey(providedSk);
				if (!pkToStore) {
					throw new Error(
						'Could not derive public key from provided private key.'
					);
				}
			} else {
				// No private key provided, generate new ones
				const { privateKey: newSk, publicKey: newPk } =
					nostrService.generateNewKeyPair();
				skToStore = newSk;
				pkToStore = newPk;
				newlyGeneratedSk = newSk; // Mark that this sk was newly generated
			}

			await nostrService.storeKeyPair(skToStore, pkToStore);

			if (userProfile) {
				userProfile.nostrPubkey = pkToStore;
				userProfile.nostrRelays =
					userProfile.nostrRelays && userProfile.nostrRelays.length > 0
						? userProfile.nostrRelays
						: currentRelaysInStore;
				userProfile.privacySettings =
					userProfile.privacySettings || defaultPrivacySettings;
			} else {
				userProfile = {
					nostrPubkey: pkToStore,
					sharedTags: [],
					preferences: {
						theme: 'system',
						aiEnabled: false,
						defaultNoteStatus: 'draft',
						ollamaApiEndpoint: '',
						geminiApiKey: '',
						aiMatchingSensitivity: 0.7,
					},
					nostrRelays: currentRelaysInStore,
					privacySettings: defaultPrivacySettings,
				};
			}

			await DBService.saveUserProfile(userProfile); // Save the updated/new profile
			set({
				userProfile,
				nostrConnected: true,
				nostrRelays: userProfile.nostrRelays, // Sync store's top-level relays
			});
			get().setError('network', undefined); // Clear previous errors
			return { publicKey: pkToStore, privateKey: newlyGeneratedSk };
		} catch (error: any) {
			get().setError(
				'network',
				`Failed to generate/store Nostr keys: ${error.message}`
			);
			return { publicKey: null, privateKey: undefined };
		} finally {
			get().setLoading('network', false);
		}
	},

	logoutFromNostr: async () => {
		get().setLoading('network', true);
		try {
			// Unsubscribe all active subscriptions
			const subs = get().activeNostrSubscriptions;
			Object.values(subs).forEach(sub => nostrService.unsubscribe(sub));

			await nostrService.clearKeyPair();
			set(state => ({
				userProfile: state.userProfile
					? { ...state.userProfile, nostrPubkey: '', nostrPrivkey: undefined }
					: undefined,
				nostrConnected: false,
				activeNostrSubscriptions: {},
				matches: [], // Clear matches on logout
				directMessages: [], // Clear DMs on logout
			}));
			get().setError('network', undefined);
		} catch (error: any) {
			get().setError(
				'network',
				`Error logging out from Nostr: ${error.message}`
			);
		} finally {
			get().setLoading('network', false);
		}
	},

	publishCurrentNoteToNostr: async (options: {
		encrypt?: boolean;
		recipientPk?: string;
		relays?: string[];
	}) => {
		const { currentNoteId, notes, nostrRelays, userProfile } = get();
		if (!currentNoteId || !notes[currentNoteId]) {
			get().setError('network', 'No current note selected to publish.');
			return;
		}
		if (
			!userProfile ||
			!userProfile.nostrPubkey ||
			!nostrService.isLoggedIn()
		) {
			get().setError(
				'network',
				'Not logged in to Nostr. Please generate or load keys.'
			);
			return;
		}

		// Ensure privacySettings are available, using defaults if somehow missing
		const privacySettings = userProfile.privacySettings || {
			sharePublicNotesGlobally: false,
			shareTagsWithPublicNotes: true, // Default to true if settings object is missing
			shareValuesWithPublicNotes: true, // Default to true if settings object is missing
		};

		// Prevent public publish if globally disabled
		if (!options.encrypt && !privacySettings.sharePublicNotesGlobally) {
			get().setError(
				'network',
				'Public sharing is disabled in your privacy settings.'
			);
			// toast.error('Cannot publish note publicly.', { description: 'Public sharing is disabled in your privacy settings.' });
			// Removed toast from here as it might not be available in all contexts store is used.
			// UI should handle user feedback for this error.
			console.error(
				'Cannot publish note publicly: Public sharing is disabled in your privacy settings.'
			);
			return;
		}

		get().setLoading('network', true);
		get().setError('network', undefined);
		try {
			const noteToPublish = notes[currentNoteId];
			const relaysToUse = options.relays || nostrRelays;

			const recipient = options.encrypt
				? options.recipientPk || userProfile.nostrPubkey
				: undefined;

			if (options.encrypt && !recipient) {
				// This should ideally be caught earlier or recipient should always be valid for encrypt=true
				throw new Error('Recipient public key is required for encryption.');
			}

			await nostrService.publishNote(
				noteToPublish,
				relaysToUse,
				options.encrypt,
				recipient,
				privacySettings // Pass the privacy settings
			);

			// Update local note state if published publicly
			if (!options.encrypt && privacySettings.sharePublicNotesGlobally) {
				get().updateNote(currentNoteId, {
					status: 'published',
					isSharedPublicly: true,
				});
			} else if (options.encrypt) {
				get().updateNote(currentNoteId, { status: 'published' });
			}
			// toast.success("Note published to Nostr!"); // UI should handle this
			console.log(
				'Note published to Nostr successfully (details depend on relays).'
			);
		} catch (error: any) {
			get().setError('network', `Failed to publish note: ${error.message}`);
			// toast.error("Failed to publish note.", { description: error.message }); // UI should handle this
			console.error(`Failed to publish note: ${error.message}`);
		} finally {
			get().setLoading('network', false);
		}
	},

	subscribeToPublicNotes: (relays?: string[]) => {
		if (!nostrService.isLoggedIn()) {
			// User should ideally be logged in to interact
			// console.warn("Nostr user not fully initialized for subscribing.");
			// Allow anonymous subscriptions for browsing public notes
		}
		const relaysToUse = relays || get().nostrRelays;
		const filters: Filter[] = [{ kinds: [1], limit: 20 }]; // Example: Get last 20 public text notes
		const subId = `public_notes_${Date.now()}`;

		try {
			const subscription = nostrService.subscribeToEvents(
				filters,
				event => get().handleIncomingNostrEvent(event as NostrEvent),
				relaysToUse,
				subId
			);
			if (subscription) {
				set(state => ({
					activeNostrSubscriptions: {
						...state.activeNostrSubscriptions,
						[subId]: subscription,
					},
				}));
				return subId;
			}
			return null;
		} catch (error: any) {
			get().setError(
				'network',
				`Error subscribing to public notes: ${error.message}`
			);
			return null;
		}
	},

	subscribeToTopic: (topic: string, relays?: string[]) => {
		if (!nostrService.isLoggedIn()) {
			get().setError('network', 'Login to Nostr to subscribe to topics.');
			return null;
		}
		const relaysToUse = relays || get().nostrRelays;
		const filters: Filter[] = [
			{
				kinds: [1],
				'#t': [topic.startsWith('#') ? topic.substring(1) : topic],
				limit: 50,
			},
		];
		const subId = `topic_${topic.replace('#', '')}_${Date.now()}`;

		try {
			const subscription = nostrService.subscribeToEvents(
				filters,
				event => get().handleIncomingNostrEvent(event as NostrEvent),
				relaysToUse,
				subId
			);
			if (subscription) {
				set(state => ({
					activeNostrSubscriptions: {
						...state.activeNostrSubscriptions,
						[subId]: subscription,
					},
				}));
				return subId;
			}
			return null;
		} catch (error: any) {
			get().setError(
				'network',
				`Error subscribing to topic ${topic}: ${error.message}`
			);
			return null;
		}
	},

	unsubscribeFromNostr: (subscriptionIdOrObject: string | any) => {
		const state = get();
		let subObject;
		let subKey = '';

		if (typeof subscriptionIdOrObject === 'string') {
			subKey = subscriptionIdOrObject;
			subObject = state.activeNostrSubscriptions[subKey];
		} else if (
			subscriptionIdOrObject &&
			typeof subscriptionIdOrObject.unsub === 'function'
		) {
			// Try to find by object instance if it's passed directly (less reliable)
			subObject = subscriptionIdOrObject;
			const entry = Object.entries(state.activeNostrSubscriptions).find(
				([, s]) => s === subObject
			);
			if (entry) subKey = entry[0];
		}

		if (subObject) {
			nostrService.unsubscribe(subObject);
			if (subKey) {
				set(s => {
					const newSubs = { ...s.activeNostrSubscriptions };
					delete newSubs[subKey];
					return { activeNostrSubscriptions: newSubs };
				});
			}
		} else {
			console.warn(
				'Subscription not found or already unsubscribed:',
				subscriptionIdOrObject
			);
		}
	},

	addNostrMatch: (match: Match) => {
		set(state => ({ matches: [...state.matches, match] })); // Basic add, consider deduplication or sorting
	},

	addDirectMessage: (message: DirectMessage) => {
		set(state => ({ directMessages: [...state.directMessages, message] })); // Basic add
		// TODO: Decrypt if necessary and if keys are available
	},

	setNostrRelays: async (newRelays: string[]) => {
		const state = get();
		const userProfile = state.userProfile;

		if (userProfile) {
			// Update the nostrRelays in the userProfile object
			const updatedProfile = { ...userProfile, nostrRelays: newRelays };
			// Persist the entire updated profile
			await state.updateUserProfile(updatedProfile); // This calls DBService.saveUserProfile internally
			// updateUserProfile will also call set({ userProfile: updatedProfile })
			// So, we just need to ensure the top-level nostrRelays is also updated here.
			set({ nostrRelays: newRelays });
		} else {
			// If no user profile, this scenario is less likely given initializeApp,
			// but update store's relays anyway. Persistence would be an issue here.
			console.warn(
				'Attempted to set Nostr relays without an active user profile. Relays not persisted to profile.'
			);
			set({ nostrRelays: newRelays });
		}
		// TODO: Consider logic to reconnect/resubscribe if relays change significantly.
		// For now, subscriptions use the relays active at the time of subscription.
	},

	addNostrRelay: async (relayUrl: string) => {
		if (!get().nostrRelays.includes(relayUrl)) {
			const newRelays = [...get().nostrRelays, relayUrl];
			await get().setNostrRelays(newRelays);
		}
	},

	removeNostrRelay: async (relayUrl: string) => {
		const newRelays = get().nostrRelays.filter(r => r !== relayUrl);
		await get().setNostrRelays(newRelays);
	},

	handleIncomingNostrEvent: async (event: NostrEvent) => {
		console.log('Received Nostr Event:', event);
		const state = get();
		const currentUserPubkey = state.userProfile?.nostrPubkey;

		// Kind 4: Encrypted Direct Message
		if (event.kind === 4 && currentUserPubkey) {
			// Check if this user is the recipient
			const recipientTag = event.tags.find(
				tag => tag[0] === 'p' && tag[1] === currentUserPubkey
			);
			if (recipientTag) {
				try {
					const decryptedContent = await nostrService.decryptMessage(
						event.content,
						event.pubkey
					);
					const dm: DirectMessage = {
						id: event.id,
						from: event.pubkey,
						to: currentUserPubkey,
						content: decryptedContent,
						timestamp: new Date(event.created_at * 1000),
						encrypted: true, // was encrypted
					};
					state.addDirectMessage(dm);
					// TODO: Persist DM to DBService
					await DBService.saveMessage(dm);
				} catch (error) {
					console.error('Failed to decrypt DM:', error, event);
				}
			}
		}
		// Kind 1: Public Note (can be for general browsing, matching, or topic feeds)
		else if (event.kind === 1) {
			// 1. Check if it belongs to any subscribed topics
			const eventTags = event.tags
				.filter(t => t[0] === 't')
				.map(t => `#${t[1]}`);
			const subscribedTopics = Object.keys(get().activeTopicSubscriptions);

			let matchedTopic: string | null = null;
			for (const topic of subscribedTopics) {
				// Simple match: if topic is #AI, event tag #AI matches.
				// More complex matching (e.g. ontology-based) could be added here if desired for topic feeds.
				if (
					eventTags.includes(topic) ||
					eventTags.includes(topic.substring(1))
				) {
					// Check with and without #
					matchedTopic = topic;
					break;
				}
			}

			if (matchedTopic) {
				get().addNoteToTopic(matchedTopic, event as NostrEvent);
				// Note: A single event might match multiple subscribed topics.
				// Current addNoteToTopic will add it to the first matched one.
				// Could be extended to add to all matched topics if needed.
			}

			// 2. Perform general matching logic (existing)
			const potentialNote: Partial<Note & { originalEvent: NostrEvent }> = {
				id: `nostr-${event.id}`,
				title:
					event.tags.find(t => t[0] === 'title')?.[1] ||
					event.content.substring(0, 30),
				content: event.content,
				tags: eventTags,
				status: 'published',
				createdAt: new Date(event.created_at * 1000),
				updatedAt: new Date(event.created_at * 1000),
				originalEvent: event as NostrEvent,
			};
			// console.log("Potential public note from network:", potentialNote); // Already logged by subscribeToPublicNotes

			if (
				currentUserPubkey &&
				event.pubkey !== currentUserPubkey &&
				potentialNote.tags &&
				potentialNote.tags.length > 0
			) {
				const localNotesArray = Object.values(state.notes);
				const ontologyTree = state.ontology; // Get the current ontology
				let bestMatchForEvent: Match | null = null;

				for (const localNote of localNotesArray) {
					if (localNote.tags && localNote.tags.length > 0) {
						// Get semantic expansions for both sets of tags
						const localSemanticTags = new Set<string>();
						localNote.tags.forEach(tag =>
							OntologyService.getSemanticMatches(ontologyTree, tag).forEach(
								st => localSemanticTags.add(st.toLowerCase())
							)
						);

						const incomingSemanticTags = new Set<string>();
						(potentialNote.tags || []).forEach(tag =>
							OntologyService.getSemanticMatches(ontologyTree, tag).forEach(
								st => incomingSemanticTags.add(st.toLowerCase())
							)
						);

						const commonSemanticTags = [...localSemanticTags].filter(t =>
							incomingSemanticTags.has(t)
						);

						if (commonSemanticTags.length > 0) {
							// Determine literal shared tags for display (subset of commonSemanticTags that were original)
							const literalSharedOriginalTags = (
								potentialNote.tags || []
							).filter(incomingTag =>
								localNote.tags
									.map(lt => lt.toLowerCase())
									.includes(incomingTag.toLowerCase())
							);

							// Calculate similarity: Jaccard index on semantic tags
							const unionSize = new Set([
								...localSemanticTags,
								...incomingSemanticTags,
							]).size;
							const similarityScore =
								unionSize > 0 ? commonSemanticTags.length / unionSize : 0;

							if (
								!bestMatchForEvent ||
								similarityScore > bestMatchForEvent.similarity
							) {
								// Check if this exact remote note has already been matched with *any* local note
								const existingMatchForThisRemoteNote = state.matches.find(
									m => m.targetNoteId === event.id
								);
								if (
									existingMatchForThisRemoteNote &&
									existingMatchForThisRemoteNote.similarity >= similarityScore
								) {
									// A better or equal match for this remote note already exists, skip
									continue;
								}

								bestMatchForEvent = {
									id: `match-${localNote.id}-${event.id}`, // More specific match ID
									localNoteId: localNote.id, // Keep track of which local note matched
									targetNoteId: event.id,
									targetAuthor: event.pubkey,
									similarity: similarityScore,
									sharedTags: literalSharedOriginalTags.slice(0, 5), // Display top 5 literal shared tags
									// sharedSemanticTags: commonSemanticTags.slice(0,5), // Could also show these for debug/advanced view
									sharedValues: [], // TODO: Implement value matching based on ontology attributes
									timestamp: new Date(event.created_at * 1000),
									matchType: 'nostr', // Explicitly set matchType for tag-based matches
								};
							}
						}
					}
				}

				// Combined loop for tag and embedding matching
				for (const localNote of localNotesArray) {
					let bestTagMatchForThisPair: Match | null = null;

					// 1. Tag-based matching logic (adapted from previous)
					if (
						potentialNote.tags &&
						potentialNote.tags.length > 0 &&
						localNote.tags &&
						localNote.tags.length > 0
					) {
						const localSemanticTags = new Set<string>();
						localNote.tags.forEach(tag =>
							OntologyService.getSemanticMatches(ontologyTree, tag).forEach(
								st => localSemanticTags.add(st.toLowerCase())
							)
						);
						const incomingSemanticTags = new Set<string>();
						(potentialNote.tags || []).forEach(tag =>
							OntologyService.getSemanticMatches(ontologyTree, tag).forEach(
								st => incomingSemanticTags.add(st.toLowerCase())
							)
						);
						const commonSemanticTags = [...localSemanticTags].filter(t =>
							incomingSemanticTags.has(t)
						);

						if (commonSemanticTags.length > 0) {
							const literalSharedOriginalTags = (
								potentialNote.tags || []
							).filter(incomingTag =>
								localNote.tags
									.map(lt => lt.toLowerCase())
									.includes(incomingTag.toLowerCase())
							);
							const unionSize = new Set([
								...localSemanticTags,
								...incomingSemanticTags,
							]).size;
							const similarityScore =
								unionSize > 0 ? commonSemanticTags.length / unionSize : 0;

							// Define a threshold for tag match similarity if needed, e.g., 0.1
							if (similarityScore > 0.05) {
								// Example threshold
								bestTagMatchForThisPair = {
									id: `match-${localNote.id}-${event.id}`,
									localNoteId: localNote.id,
									targetNoteId: event.id,
									targetAuthor: event.pubkey,
									similarity: similarityScore,
									sharedTags: literalSharedOriginalTags.slice(0, 5),
									sharedValues: [],
									timestamp: new Date(event.created_at * 1000),
									matchType: 'nostr',
								};
							}
						}
					}

					if (bestTagMatchForThisPair) {
						const oldTagMatchIndex = state.matches.findIndex(
							m =>
								m.targetNoteId === event.id &&
								m.localNoteId === localNote.id &&
								m.matchType === 'nostr'
						);
						if (oldTagMatchIndex !== -1) {
							if (
								state.matches[oldTagMatchIndex].similarity <
								bestTagMatchForThisPair.similarity
							) {
								state.matches.splice(oldTagMatchIndex, 1);
								state.addNostrMatch(bestTagMatchForThisPair);
								console.log(
									'Updated ontology-aware tag match (better similarity):',
									bestTagMatchForThisPair
								);
							}
						} else {
							state.addNostrMatch(bestTagMatchForThisPair);
							console.log(
								'New ontology-aware tag match found:',
								bestTagMatchForThisPair
							);
						}
					}

					// 2. Embedding-based matching logic
					const remoteEmbeddingTagValue = event.tags.find(
						tag => tag[0] === 'embedding'
					)?.[1];
					if (
						remoteEmbeddingTagValue &&
						localNote.embedding &&
						localNote.embedding.length > 0
					) {
						try {
							const remoteEmbedding = JSON.parse(
								remoteEmbeddingTagValue
							) as number[];
							// Check if remoteEmbedding is a valid array of numbers and has positive length.
							// NoteService.cosineSimilarity handles zero vectors or mismatched lengths by returning 0.
							if (
								Array.isArray(remoteEmbedding) &&
								remoteEmbedding.length > 0 &&
								remoteEmbedding.every(n => typeof n === 'number')
							) {
								const similarity = NoteService.cosineSimilarity(
									remoteEmbedding,
									localNote.embedding
								);
								const similarityThreshold =
									state.userProfile?.preferences.aiMatchingSensitivity ?? 0.7;

								if (similarity >= similarityThreshold) {
									const existingEmbeddingMatchIndex = state.matches.findIndex(
										m =>
											m.targetNoteId === event.id &&
											m.localNoteId === localNote.id &&
											m.matchType === 'embedding'
									);

									const embeddingMatch: Match = {
										id: `embedmatch-nostr-${localNote.id}-${event.id}`,
										localNoteId: localNote.id,
										targetNoteId: event.id,
										targetAuthor: event.pubkey,
										similarity: similarity,
										sharedTags: localNote.tags.filter(lt =>
											(potentialNote.tags || []).includes(lt)
										),
										sharedValues: [],
										timestamp: new Date(event.created_at * 1000),
										matchType: 'embedding',
									};

									if (existingEmbeddingMatchIndex !== -1) {
										if (
											state.matches[existingEmbeddingMatchIndex].similarity <
											similarity
										) {
											state.matches.splice(existingEmbeddingMatchIndex, 1);
											state.addNostrMatch(embeddingMatch);
											console.log(
												'Updated Nostr embedding match (better similarity):',
												embeddingMatch
											);
										}
									} else {
										state.addNostrMatch(embeddingMatch);
										console.log(
											'New Nostr embedding match found:',
											embeddingMatch
										);
									}
								}
							}
						} catch (e) {
							console.warn(
								'Failed to parse or process embedding from Nostr event tag for a local note:',
								e,
								event
							);
						}
					}
				} // End of for...of localNotesArray
			}
		}
		// TODO: Handle other event kinds
	},

	setLastSyncTimestamp: (timestamp: Date) => {
		set({ lastSyncTimestamp: timestamp });
		// Persist this to DBService maybe? Or is it ephemeral for the session?
		// For now, keep in store. Could be persisted in userProfile or a dedicated settings key in DB.
	},

	syncWithNostr: async (forceFullSync = false) => {
		const {
			setLoading,
			setError,
			userProfile,
			lastSyncTimestamp,
			notes,
			ontology,
			setLastSyncTimestamp: recordSyncTime,
		} = get();
		if (!isOnline()) {
			setError('sync', 'Cannot sync: Application is offline.');
			// toast.info("Offline", { description: "Cannot sync while offline." });
			return;
		}
		if (
			!userProfile ||
			!userProfile.nostrPubkey ||
			!nostrService.isLoggedIn()
		) {
			setError('sync', 'Cannot sync: User not logged into Nostr.');
			// toast.error("Nostr Sync Error", { description: "User not logged in." });
			return;
		}

		setLoading('sync', true);
		setError('sync', undefined);
		// toast.loading("Syncing with Nostr...", { id: "nostr-sync" });

		try {
			const currentSyncTime = new Date();
			const relays = userProfile.nostrRelays || get().nostrRelays;

			// 1. Fetch remote ontology (Kind 30001)
			const remoteOntology = await nostrService.fetchSyncedOntology(relays);
			if (remoteOntology && remoteOntology.updatedAt) {
				const localOntology = ontology; // from get()
				const remoteDate = new Date(remoteOntology.updatedAt);
				if (
					!localOntology.updatedAt ||
					remoteDate > new Date(localOntology.updatedAt)
				) {
					console.log('Remote ontology is newer. Updating local ontology.');
					await DBService.saveOntology(remoteOntology); // This updates local DB
					set({ ontology: remoteOntology }); // Update store
				} else if (
					localOntology.updatedAt &&
					new Date(localOntology.updatedAt) > remoteDate
				) {
					console.log('Local ontology is newer. Publishing local ontology.');
					await nostrService.publishOntologyForSync(localOntology, relays);
					await DBService.setOntologyNeedsSync(false); // Mark as synced
				}
			} else {
				// No remote ontology, or it's malformed. Publish local if it exists and needs sync.
				if (
					(await DBService.getOntologyNeedsSync()) ||
					(ontology.updatedAt && forceFullSync)
				) {
					console.log(
						'Publishing local ontology (no remote or local needs sync).'
					);
					await nostrService.publishOntologyForSync(ontology, relays);
					await DBService.setOntologyNeedsSync(false);
				}
			}

			// 2. Process local pending ontology sync (if not covered above)
			if (await DBService.getOntologyNeedsSync()) {
				const localOntology = (await DBService.getOntology()) || ontology; // Get latest from DB
				if (localOntology.updatedAt) {
					// Ensure it has data
					console.log('Processing pending local ontology sync.');
					await nostrService.publishOntologyForSync(localOntology, relays);
					await DBService.setOntologyNeedsSync(false);
				}
			}

			// 3. Fetch remote notes (Kind 4, self-addressed, with specific 'd' tag)
			// Use lastSyncTimestamp if not a forceFullSync, otherwise fetch all.
			const since = forceFullSync
				? undefined
				: lastSyncTimestamp
					? Math.floor(lastSyncTimestamp.getTime() / 1000)
					: undefined;
			const remoteNotes = await nostrService.fetchSyncedNotes(since, relays);
			let localNotesChanged = false;

			// In syncWithNostr action:
			// Note: DOMPurify import moved to top of file
			for (const remoteNote of remoteNotes) {
				const localNote = notes[remoteNote.id]; // from get()
				const remoteNoteUpdatedAt = new Date(remoteNote.updatedAt || 0);

				if (
					!localNote ||
					remoteNoteUpdatedAt > new Date(localNote.updatedAt || 0)
				) {
					console.log(
						`Remote note ${remoteNote.id} is newer or new. Updating local.`
					);
					// Sanitize content from remote note before saving
					const sanitizedContent = DOMPurify.sanitize(remoteNote.content);
					const noteToSave = { ...remoteNote, content: sanitizedContent };

					await DBService.saveNote(noteToSave);
					set(s => ({ notes: { ...s.notes, [remoteNote.id]: noteToSave } }));
					localNotesChanged = true;
				}
				// If local is newer, it will be handled by pending sync ops processing.
			}
			if (localNotesChanged) {
				// Potentially re-evaluate current note if it was updated
				const { currentNoteId, setCurrentNote } = get();
				if (currentNoteId && notes[currentNoteId]) {
					setCurrentNote(currentNoteId); // Refreshes editor if current note changed
				}
			}

			// 4. Process local pending note sync operations
			const pendingNoteOps = await DBService.getPendingNoteSyncOps();
			for (const op of pendingNoteOps) {
				if (op.action === 'save') {
					const noteToSync = await DBService.getNote(op.noteId); // Get the latest version from DB
					if (noteToSync) {
						// Check against remote version again if it exists from the fetch above
						const correspondingRemoteNote = remoteNotes.find(
							rn => rn.id === noteToSync.id
						);
						if (
							correspondingRemoteNote &&
							new Date(noteToSync.updatedAt) <
								new Date(correspondingRemoteNote.updatedAt)
						) {
							console.log(
								`Skipping publish of local note ${noteToSync.id} as remote is newer.`
							);
							await DBService.removeNoteFromSyncQueue(op.noteId);
							continue;
						}
						console.log(`Publishing pending local note ${op.noteId} for sync.`);
						const publishedEventIds = await nostrService.publishNoteForSync(
							noteToSync,
							relays
						);
						if (publishedEventIds.length > 0 && publishedEventIds[0]) {
							if (noteToSync.nostrSyncEventId !== publishedEventIds[0]) {
								const noteWithSyncId = {
									...noteToSync,
									nostrSyncEventId: publishedEventIds[0],
								};
								await DBService.saveNote(noteWithSyncId); // Save to DB with new/updated sync ID
								set(s => ({
									notes: { ...s.notes, [noteToSync.id]: noteWithSyncId },
								})); // Update store
							}
							await DBService.removeNoteFromSyncQueue(op.noteId); // Use op.noteId
						} else {
							console.warn(
								`Failed to publish pending note ${op.noteId} during sync. Will retry later.`
							);
							// Note: If publish fails, it remains in the queue. No explicit re-add needed here.
						}
					}
				} else if (op.action === 'delete') {
					const eventIdToDelete =
						op.nostrEventId ||
						(await DBService.getNote(op.noteId))?.nostrSyncEventId;
					if (eventIdToDelete) {
						console.log(
							`Processing pending Kind 5 deletion for Nostr event ID: ${eventIdToDelete} (local note ID: ${op.noteId}).`
						);
						try {
							await nostrService.publishDeletionEvent(
								[eventIdToDelete],
								'Note deleted by user during sync.',
								relays
							);
							await DBService.removeNoteFromSyncQueue(op.noteId); // Use op.noteId
						} catch (e) {
							console.warn(
								`Failed to publish Kind 5 for event ${eventIdToDelete} during sync. Will retry later.`,
								e
							);
							// Note: If publish fails, it remains in the queue.
						}
					} else {
						console.log(
							`Skipping deletion for note ${op.noteId} as no Nostr event ID was found. Removing from queue.`
						);
						await DBService.removeNoteFromSyncQueue(op.noteId); // Use op.noteId
					}
				}
			} // Closes for...of pendingNoteOps
			recordSyncTime(currentSyncTime); // Update last sync time
			// toast.success("Sync Complete", { id: "nostr-sync", description: "Data synced with Nostr relays." });
			console.log('Sync with Nostr complete.');

			// 5. Fetch and process own Kind 5 deletion events (from other devices)
			// Use the same 'since' timestamp as for fetching notes, or slightly earlier to be safe.
			const remoteDeletionEvents = await nostrService.fetchOwnDeletionEvents(
				since,
				relays
			);
			if (remoteDeletionEvents.length > 0) {
				console.log(
					`Processing ${remoteDeletionEvents.length} remote deletion events.`
				);
				const currentNotes = get().notes; // Get a snapshot of current notes
				let notesWereDeleted = false;
				for (const deletionEvent of remoteDeletionEvents) {
					const eventIdsToDelete = deletionEvent.tags
						.filter(tag => tag[0] === 'e')
						.map(tag => tag[1]);
					for (const eventIdToDelete of eventIdsToDelete) {
						// Find if any local note corresponds to this deleted event ID
						const noteIdToDeleteLocally = Object.keys(currentNotes).find(
							noteId =>
								currentNotes[noteId]?.nostrSyncEventId === eventIdToDelete
						);

						if (noteIdToDeleteLocally) {
							console.log(
								`Remote deletion event found for local note ID ${noteIdToDeleteLocally} (Nostr event ${eventIdToDelete}). Deleting locally.`
							);
							await DBService.deleteNote(noteIdToDeleteLocally); // Delete from DB
							// Update store state directly here as deleteNote action might try to publish another Kind 5
							set(s => {
								const newNotes = { ...s.notes };
								delete newNotes[noteIdToDeleteLocally];
								const newState: Partial<AppState> = { notes: newNotes };
								if (s.currentNoteId === noteIdToDeleteLocally) {
									newState.currentNoteId = undefined;
									newState.editorContent = '';
									newState.isEditing = false;
								}
								return newState;
							});
							notesWereDeleted = true;
							// Also ensure this note, if it was in the pending sync queue for deletion, is removed.
							await DBService.removeNoteFromSyncQueue(noteIdToDeleteLocally);
						}
					}
				}
				if (notesWereDeleted) {
					// Optional: Notify user or refresh specific UI parts if needed
					console.log('Local notes deleted based on remote Kind 5 events.');
				}
			}
		} catch (error: any) {
			console.error('Nostr sync failed:', error);
			setError('sync', `Sync failed: ${error.message}`);
			// toast.error("Sync Failed", { id: "nostr-sync", description: error.message });
		} finally {
			setLoading('sync', false);
		}
	},

	sendDirectMessage: async (recipientPk: string, content: string) => {
		const { userProfile, nostrRelays, addDirectMessage } = get();
		if (
			!userProfile ||
			!userProfile.nostrPubkey ||
			!nostrService.isLoggedIn()
		) {
			throw new Error('User not logged in or Nostr keys not available.');
		}
		if (!recipientPk || !content.trim()) {
			throw new Error('Recipient public key and message content are required.');
		}

		get().setLoading('network', true);
		get().setError('network', undefined);

		try {
			// Create a temporary Note-like object for publishNote
			// The actual event ID will come from nostrService.publishNote
			const tempNoteForDM: Note = {
				id: `dm-temp-${Date.now()}`, // Temporary ID, not the actual event ID
				title: '', // DMs don't typically have titles in this context
				content: content.trim(),
				tags: [], // NIP-04 'p' tag is added by nostrService
				values: {},
				fields: {},
				status: 'draft', // Does not apply directly to DMs in the same way as notes
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// publishNote with encrypt=true handles Kind 4 event creation
			const publishedEventIds = await nostrService.publishNote(
				tempNoteForDM,
				nostrRelays, // Use user's configured relays
				true, // Encrypt
				recipientPk // Recipient's public key
			);

			if (publishedEventIds.length === 0) {
				// This might happen if all relays fail, or no relays configured.
				// nostrService.publishNote might throw an error before this in some cases.
				throw new Error('Message failed to publish to any relay.');
			}
			const eventId = publishedEventIds[0]; // Assuming we use the first successful event ID

			// Add to local store and DB after successful publish
			const sentDm: DirectMessage = {
				id: eventId, // Use the actual event ID from Nostr
				from: userProfile.nostrPubkey,
				to: recipientPk,
				content: content.trim(),
				timestamp: new Date(), // Timestamp of sending
				encrypted: true,
			};
			addDirectMessage(sentDm); // Add to Zustand state
			await DBService.saveMessage(sentDm); // Persist to IndexedDB
		} catch (error: any) {
			console.error('Failed to send direct message:', error);
			get().setError('network', `Failed to send DM: ${error.message}`);
			throw error; // Re-throw for UI to handle
		} finally {
			get().setLoading('network', false);
		}
	},

	subscribeToDirectMessages: (relays?: string[]) => {
		const { userProfile, nostrRelays, handleIncomingNostrEvent } = get();
		if (
			!userProfile ||
			!userProfile.nostrPubkey ||
			!nostrService.isLoggedIn()
		) {
			get().setError('network', 'Cannot subscribe to DMs: User not logged in.');
			return null;
		}

		const relaysToUse = relays || nostrRelays;
		if (relaysToUse.length === 0) {
			get().setError(
				'network',
				'Cannot subscribe to DMs: No relays configured.'
			);
			return null;
		}

		const filters: Filter[] = [
			{ kinds: [4], '#p': [userProfile.nostrPubkey], limit: 50 },
			{ kinds: [4], authors: [userProfile.nostrPubkey], limit: 50 },
		];
		const subId = `direct_messages_${userProfile.nostrPubkey.substring(0, 8)}_${Date.now()}`;

		try {
			const subscription = nostrService.subscribeToEvents(
				filters,
				event => handleIncomingNostrEvent(event as NostrEvent),
				relaysToUse,
				subId
			);
			if (subscription) {
				// Use the general activeNostrSubscriptions for actual nostr-tool sub objects
				set(state => ({
					activeNostrSubscriptions: {
						...state.activeNostrSubscriptions,
						[subId]: subscription,
					},
				}));
				console.log(`Subscribed to Direct Messages with ID: ${subId}`);
				return subId; // Return the ID for the UI to potentially track if needed, though not strictly necessary for DMs if panel just reads from directMessages array
			}
			return null;
		} catch (error: any) {
			get().setError(
				'network',
				`Error subscribing to direct messages: ${error.message}`
			);
			console.error(`Error subscribing to direct messages: ${error.message}`);
			return null;
		}
	},

	// Topic Subscription Management
	addTopicSubscription: (topic: string, subscriptionId: string) => {
		set(state => ({
			activeTopicSubscriptions: {
				...state.activeTopicSubscriptions,
				[topic]: subscriptionId,
			},
			// Initialize an empty array for notes if this is a new topic
			topicNotes: {
				...state.topicNotes,
				[topic]: state.topicNotes[topic] || [],
			},
		}));
	},

	findAndSetEmbeddingMatches: async (
		noteId: string,
		similarityThreshold: number = 0.7
	) => {
		const { notes, setLoading, setError, userProfile } = get();
		const targetNote = notes[noteId];

		if (!targetNote) {
			setError('network', 'Target note for embedding match not found.');
			return;
		}
		if (!userProfile?.preferences.aiEnabled) {
			setError(
				'network',
				'AI features are not enabled. Cannot find embedding matches.'
			);
			// Optionally clear existing embedding matches
			// set({ embeddingMatches: [] });
			return;
		}
		if (!targetNote.embedding || targetNote.embedding.length === 0) {
			setError(
				'network',
				`Note "${targetNote.title}" does not have an embedding. Cannot find similar notes.`
			);
			// Optionally clear existing embedding matches
			// set({ embeddingMatches: [] });
			return;
		}

		setLoading('network', true); // Use network loading as it's a "discovery" feature
		setError('network', undefined);

		try {
			// Use the new service method that fetches all notes internally
			const similarNoteResults = await NoteService.getSimilarNotesGlobally(
				targetNote.id, // Pass targetNoteId
				similarityThreshold
			);

			const newEmbeddingMatches: Match[] = similarNoteResults.map(result => ({
				id: `embedmatch-${targetNote.id}-${result.note.id}`,
				localNoteId: result.note.id, // ID of the matched local note
				targetNoteId: result.note.id, // For consistency, points to the matched local note
				targetAuthor: userProfile.nostrPubkey || 'local', // Author is the current user
				similarity: result.similarity,
				sharedTags: result.note.tags.filter(tag =>
					targetNote.tags.includes(tag)
				), // Simple shared tags
				sharedValues: {}, // TODO: Could implement if values are also embedded or compared
				timestamp: result.note.updatedAt, // Use matched note's update time
				matchType: 'embedding', // Add a type to distinguish from Nostr matches
			}));

			set({
				embeddingMatches: newEmbeddingMatches,
				loading: { ...get().loading, network: false },
			});
			if (newEmbeddingMatches.length === 0) {
				// toast.info("No similar notes found via embeddings.", { description: `For note: "${targetNote.title.substring(0,30)}..."`});
			} else {
				// toast.success(`${newEmbeddingMatches.length} similar notes found via embeddings.`, { description: `For note: "${targetNote.title.substring(0,30)}..."`});
			}
		} catch (error: any) {
			console.error('Failed to find embedding matches:', error);
			setError('network', `Failed to find embedding matches: ${error.message}`);
			// toast.error("Error finding embedding matches.", { description: error.message });
		} finally {
			setLoading('network', false);
		}
	},

	removeTopicSubscription: (topic: string) => {
		set(state => {
			const newActiveTopicSubscriptions = { ...state.activeTopicSubscriptions };
			delete newActiveTopicSubscriptions[topic];
			// Optionally, clear notes for this topic or keep them
			// const newTopicNotes = { ...state.topicNotes };
			// delete newTopicNotes[topic];
			return {
				activeTopicSubscriptions: newActiveTopicSubscriptions,
				// topicNotes: newTopicNotes, // if clearing notes
			};
		});
	},

	addNoteToTopic: (topic: string, note: NostrEvent) => {
		set(state => {
			const currentNotesForTopic = state.topicNotes[topic] || [];
			// Avoid duplicates by checking event ID
			if (currentNotesForTopic.find(n => n.id === note.id)) {
				return state; // Already have this note for this topic
			}
			return {
				topicNotes: {
					...state.topicNotes,
					[topic]: [note, ...currentNotesForTopic].slice(0, 100), // Add to start, limit to 100 notes per topic
				},
			};
		});
	},

	addContact: async (contact: Contact) => {
		const { userProfile, updateUserProfile } = get();
		if (!userProfile) return;

		const existingContacts = userProfile.contacts || [];
		if (existingContacts.find(c => c.pubkey === contact.pubkey)) {
			// Optionally update if contact exists, or just ignore duplicate add
			console.warn(`Contact with pubkey ${contact.pubkey} already exists.`);
			// For now, let's update if it exists (e.g. to update alias or lastContact)
			const updatedContacts = existingContacts.map(c =>
				c.pubkey === contact.pubkey
					? { ...c, ...contact, lastContact: new Date() }
					: c
			);
			await updateUserProfile({ ...userProfile, contacts: updatedContacts });
			return;
		}

		const newContact = {
			...contact,
			lastContact: contact.lastContact || new Date(),
		};
		const updatedContacts = [...existingContacts, newContact];
		await updateUserProfile({ ...userProfile, contacts: updatedContacts });
	}, // Ensured comma

	removeContact: async (pubkey: string) => {
		// Re-affirming this structure
		const { userProfile, updateUserProfile } = get();
		if (!userProfile || !userProfile.contacts) return;

		const updatedContacts = userProfile.contacts.filter(
			c => c.pubkey !== pubkey
		);
		await updateUserProfile({ ...userProfile, contacts: updatedContacts });
	}, // Ensured comma

	updateContactAlias: async (pubkey: string, alias: string) => {
		// Ensuring this starts correctly
		const { userProfile, updateUserProfile } = get();
		if (!userProfile || !userProfile.contacts) return;

		const updatedContacts = userProfile.contacts.map(c =>
			c.pubkey === pubkey ? { ...c, alias } : c
		);
		await updateUserProfile({ ...userProfile, contacts: updatedContacts });
	},

	moveOntologyNode: (nodeId, newParentId, newIndex) => {
		const { ontology } = get();
		if (!ontology) return;

		const newOntology = { ...ontology };
		const node = newOntology.nodes[nodeId];
		if (!node) return;

		// Remove from old parent
		const oldParentId = node.parentId;
		if (oldParentId) {
			const oldParent = newOntology.nodes[oldParentId];
			if (oldParent) {
				oldParent.children = oldParent.children?.filter(id => id !== nodeId);
			}
		} else {
			newOntology.rootIds = newOntology.rootIds.filter(id => id !== nodeId);
		}

		// Add to new parent
		node.parentId = newParentId;
		if (newParentId) {
			const newParent = newOntology.nodes[newParentId];
			if (newParent) {
				if (!newParent.children) {
					newParent.children = [];
				}
				newParent.children.splice(newIndex, 0, nodeId);
			}
		} else {
			newOntology.rootIds.splice(newIndex, 0, nodeId);
		}

		set({ ontology: newOntology });
	},

	updateUserProfile: async (profileUpdates: Partial<UserProfile>) => {
		const { userProfile } = get();
		if (userProfile) {
			const updatedProfile = { ...userProfile, ...profileUpdates };
			await DBService.saveUserProfile(updatedProfile);
			set({ userProfile: updatedProfile });
		}
	},

	loadFolders: async () => {
		try {
			const foldersList = await FolderService.getAllFolders();
			const foldersMap: { [id: string]: Folder } = {};
			foldersList.forEach(folder => (foldersMap[folder.id] = folder));
			set({ folders: foldersMap });
		} catch (error) {
			console.error('Failed to load folders:', error);
			(get() as AppStore).setError(
				'notes',
				`Failed to load folders: ${(error as Error).message}`
			);
		}
	},
}));
