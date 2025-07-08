import { create, StoreApi } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Note, OntologyTree, UserProfile, Folder, NotentionTemplate, SearchFilters } from '../../shared/types';
import { DBService } from '../services/db';
import { FolderService } from '../services/FolderService'; // Import FolderService
import { NoteService } from '../services/NoteService'; // Import NoteService

interface AppActions {
  // Initialization
  initializeApp: () => Promise<void>;
  
  // Notes actions
  createNote: (partialNote?: Partial<Note>) => Promise<string>; // Updated signature
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (id: string | undefined) => void;
  setSearchQuery: (query: string) => void; // Renamed from searchNotes for clarity
  setSearchFilters: (filters: Partial<SearchFilters>) => void; // Allow partial updates
  moveNoteToFolder: (noteId: string, folderId: string | undefined) => Promise<void>;
  
  // Ontology actions
  setOntology: (ontology: OntologyTree) => Promise<void>; // Renamed from updateOntology
  
  // User profile actions
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  
  // Folders actions
  createFolder: (name: string, parentId?: string) => Promise<string | undefined>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>; // Needs to handle recursive deletion and note unassignment
  
  // Templates actions
  createTemplate: (templateData: Omit<NotentionTemplate, 'id'>) => Promise<string>; // Renamed param
  updateTemplate: (id: string, updates: Partial<NotentionTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  // UI actions
  setSidebarTab: (tab: AppState['sidebarTab']) => void;
  setEditorContent: (content: string) => void;
  setIsEditing: (editing: boolean) => void;
  
  // Loading and error actions
  setLoading: (key: keyof AppState['loading'], loading: boolean) => void;
  setError: (key: keyof AppState['errors'], error: string | undefined) => void;
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  notes: {},
  ontology: { nodes: {}, rootIds: [] },
  userProfile: undefined,
  folders: {},
  templates: {},
  
  currentNoteId: undefined,
  sidebarTab: 'notes',
  searchQuery: '',
  searchFilters: {}, // Initialize with empty object
  
  matches: [],
  directMessages: [],
  nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol'],
  connected: false,
  
  editorContent: '',
  isEditing: false,
  
  loading: {
    notes: false,
    ontology: false,
    network: false,
  },
  
  errors: {},

  // Actions
  initializeApp: async () => {
    const state = get();
    
    try {
      // Load all data from IndexedDB
      state.setLoading('notes', true);
      state.setLoading('ontology', true);
      
      // Load notes
      const notes = await NoteService.getNotes(); // Use NoteService
      const notesMap: { [id: string]: Note } = {};
      notes.forEach(note => notesMap[note.id] = note);
      
      let ontologyData = await DBService.getOntology();
      if (!ontologyData) {
        ontologyData = await DBService.getDefaultOntology();
        await DBService.saveOntology(ontologyData);
      }
      
      const userProfileData = await DBService.getUserProfile();
      
      const folders = await FolderService.getAllFolders(); // Use FolderService
      const foldersMap: { [id: string]: Folder } = {};
      folders.forEach(folder => foldersMap[folder.id] = folder);
      
      let templates = await DBService.getAllTemplates(); // This can remain DBService for now
      if (templates.length === 0) {
        const defaultTemplates = await DBService.getDefaultTemplates();
        for (const template of defaultTemplates) {
          await DBService.saveTemplate(template);
        }
        templates = defaultTemplates;
      }
      const templatesMap: { [id: string]: NotentionTemplate } = {};
      templates.forEach(template => {
        templatesMap[template.id] = template;
      });
      
      set({
        notes: notesMap,
        ontology: ontologyData,
        userProfile: userProfileData || undefined,
        folders: foldersMap,
        templates: templatesMap,
      });
      
    } catch (error: any) {
      console.error('Failed to initialize app:', error);
      (get() as AppStore).setError('notes', `Failed to load data: ${error.message}`);
    } finally {
      (get() as AppStore).setLoading('notes', false);
      (get() as AppStore).setLoading('ontology', false);
    }
  },

  createNote: async (partialNote?: Partial<Note>) => {
    const newNote = await NoteService.createNote(partialNote || {});
    set(state => ({
      notes: { ...state.notes, [newNote.id]: newNote },
      currentNoteId: newNote.id,
      editorContent: newNote.content,
      isEditing: true,
    }));
    return newNote.id;
  },

  updateNote: async (id: string, updates: Partial<Note>) => {
    const updatedNote = await NoteService.updateNote(id, updates);
    if (updatedNote) {
      set(state => ({
        notes: { ...state.notes, [id]: updatedNote },
        // If current note is updated, update editor content if it's different
        ...(state.currentNoteId === id && state.editorContent !== updatedNote.content && { editorContent: updatedNote.content }),
      }));
    }
  },

  deleteNote: async (id: string) => {
    const state = get();
    const noteToDelete = state.notes[id];

    await NoteService.deleteNote(id);
    
    // If note was in a folder, remove it from folder's noteIds
    if (noteToDelete && noteToDelete.folderId) {
      const folder = state.folders[noteToDelete.folderId];
      if (folder) {
        const updatedFolder = {
          ...folder,
          noteIds: folder.noteIds.filter(noteId => noteId !== id),
          updatedAt: new Date()
        };
        await FolderService.updateFolder(folder.id, { noteIds: updatedFolder.noteIds }); // Persist only changed field
        set(s => ({
          folders: { ...s.folders, [folder.id]: updatedFolder }
        }));
      }
    }

    set(s => {
      const newNotes = { ...s.notes };
      delete newNotes[id];
      return {
        notes: newNotes,
        currentNoteId: s.currentNoteId === id ? undefined : s.currentNoteId,
      };
    });
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
        await FolderService.updateFolder(oldFolderId, { noteIds: updatedOldFolder.noteIds });
        newFoldersState = { ...newFoldersState, [oldFolderId]: updatedOldFolder };
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
        await FolderService.updateFolder(folderId, { noteIds: updatedNewFolder.noteIds });
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

  setOntology: async (ontology: OntologyTree) => {
    await DBService.saveOntology(ontology); // Persist
    set({ ontology }); // Update store
  },

  updateUserProfile: async (profile: UserProfile) => {
    await DBService.saveUserProfile(profile);
    set({ userProfile: profile });
  },

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
            updatedAt: new Date()
        };
        set(state => ({
            folders: { ...state.folders, [parentId]: updatedParent}
        }))
      }
      return newFolder.id;
    } catch (error) {
      console.error("Failed to create folder:", error);
      (get() as AppStore).setError('notes', `Failed to create folder: ${(error as Error).message}`);
      return undefined;
    }
  },

  },

  updateFolder: async (id: string, updates: Partial<Folder>) => {
    const state = get();
    const oldFolder = state.folders[id];
    if (!oldFolder) return;

    const updatedFolder = await FolderService.updateFolder(id, updates);
    if (updatedFolder) {
      let newFoldersState = { ...state.folders, [id]: updatedFolder };

      // Handle parent change logic for store state
      const oldParentId = oldFolder.parentId;
      const newParentId = updatedFolder.parentId;

      if (newParentId !== oldParentId) {
        // Remove from old parent's children in store
        if (oldParentId && newFoldersState[oldParentId]) {
          const oldParent = newFoldersState[oldParentId];
          newFoldersState[oldParentId] = {
            ...oldParent,
            children: (oldParent.children || []).filter(childId => childId !== id),
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
        notesToUpdate[note.id] = { ...note, folderId: undefined, updatedAt: new Date() };
      }
    });

    // Remove from parent's children list in store state
    if (folderToDelete.parentId && newFolders[folderToDelete.parentId]) {
        const parentFolder = newFolders[folderToDelete.parentId];
        newFolders[folderToDelete.parentId] = {
            ...parentFolder,
            children: (parentFolder.children || []).filter(childId => childId !== id),
            updatedAt: new Date()
        };
    }

    set({ folders: newFolders, notes: notesToUpdate });
  },

  createTemplate: async (templateData: Omit<NotentionTemplate, 'id'>) => { // Ensure param name matches
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
}));