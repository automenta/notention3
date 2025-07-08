import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Note, OntologyTree, UserProfile, Folder, NotentionTemplate, SearchFilters } from '../../shared/types';
import { DBService } from '../services/db';

interface AppActions {
  // Initialization
  initializeApp: () => Promise<void>;
  
  // Notes actions
  createNote: (title?: string, content?: string) => Promise<string>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (id: string | undefined) => void;
  searchNotes: (query: string) => Promise<void>;
  setSearchFilters: (filters: SearchFilters) => void;
  
  // Ontology actions
  updateOntology: (ontology: OntologyTree) => Promise<void>;
  
  // User profile actions
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  
  // Folders actions
  createFolder: (name: string, parentId?: string) => Promise<string>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  
  // Templates actions
  createTemplate: (template: Omit<NotentionTemplate, 'id'>) => Promise<string>;
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
  searchFilters: {},
  
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
      const notes = await DBService.getAllNotes();
      const notesMap: { [id: string]: Note } = {};
      notes.forEach(note => {
        notesMap[note.id] = note;
      });
      
      // Load ontology or create default
      let ontology = await DBService.getOntology();
      if (!ontology) {
        ontology = await DBService.getDefaultOntology();
        await DBService.saveOntology(ontology);
      }
      
      // Load user profile
      const userProfile = await DBService.getUserProfile() || undefined;
      
      // Load folders
      const folders = await DBService.getAllFolders();
      const foldersMap: { [id: string]: Folder } = {};
      folders.forEach(folder => {
        foldersMap[folder.id] = folder;
      });
      
      // Load templates or create defaults
      let templates = await DBService.getAllTemplates();
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
        ontology,
        userProfile,
        folders: foldersMap,
        templates: templatesMap,
      });
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      state.setError('notes', 'Failed to load data');
    } finally {
      state.setLoading('notes', false);
      state.setLoading('ontology', false);
    }
  },

  createNote: async (title = 'Untitled Note', content = '') => {
    const id = uuidv4();
    const now = new Date();
    
    const note: Note = {
      id,
      title,
      content,
      tags: [],
      values: {},
      fields: {},
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    
    await DBService.saveNote(note);
    
    set(state => ({
      notes: { ...state.notes, [id]: note },
      currentNoteId: id,
      editorContent: content,
      isEditing: true,
    }));
    
    return id;
  },

  updateNote: async (id: string, updates: Partial<Note>) => {
    const state = get();
    const existingNote = state.notes[id];
    if (!existingNote) return;
    
    const updatedNote: Note = {
      ...existingNote,
      ...updates,
      updatedAt: new Date(),
    };
    
    await DBService.saveNote(updatedNote);
    
    set(state => ({
      notes: { ...state.notes, [id]: updatedNote },
    }));
  },

  deleteNote: async (id: string) => {
    await DBService.deleteNote(id);
    
    set(state => {
      const newNotes = { ...state.notes };
      delete newNotes[id];
      
      return {
        notes: newNotes,
        currentNoteId: state.currentNoteId === id ? undefined : state.currentNoteId,
      };
    });
  },

  setCurrentNote: (id: string | undefined) => {
    const state = get();
    const note = id ? state.notes[id] : undefined;
    
    set({
      currentNoteId: id,
      editorContent: note?.content || '',
      isEditing: !!id,
    });
  },

  searchNotes: async (query: string) => {
    set({ searchQuery: query });
    // Note: Actual search filtering will be done in the UI components
    // based on the searchQuery and searchFilters state
  },

  setSearchFilters: (filters: SearchFilters) => {
    set({ searchFilters: filters });
  },

  updateOntology: async (ontology: OntologyTree) => {
    await DBService.saveOntology(ontology);
    set({ ontology });
  },

  updateUserProfile: async (profile: UserProfile) => {
    await DBService.saveUserProfile(profile);
    set({ userProfile: profile });
  },

  createFolder: async (name: string, parentId?: string) => {
    const id = uuidv4();
    const now = new Date();
    
    const folder: Folder = {
      id,
      name,
      parentId,
      noteIds: [],
      createdAt: now,
      updatedAt: now,
    };
    
    await DBService.saveFolder(folder);
    
    set(state => ({
      folders: { ...state.folders, [id]: folder },
    }));
    
    return id;
  },

  updateFolder: async (id: string, updates: Partial<Folder>) => {
    const state = get();
    const existingFolder = state.folders[id];
    if (!existingFolder) return;
    
    const updatedFolder: Folder = {
      ...existingFolder,
      ...updates,
      updatedAt: new Date(),
    };
    
    await DBService.saveFolder(updatedFolder);
    
    set(state => ({
      folders: { ...state.folders, [id]: updatedFolder },
    }));
  },

  deleteFolder: async (id: string) => {
    await DBService.deleteFolder(id);
    
    set(state => {
      const newFolders = { ...state.folders };
      delete newFolders[id];
      
      return { folders: newFolders };
    });
  },

  createTemplate: async (templateData: Omit<NotentionTemplate, 'id'>) => {
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