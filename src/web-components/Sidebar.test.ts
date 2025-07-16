import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { useAppStore } from '../store';
import { Note, Folder } from '../../shared/types';
import { NotentionApp } from './NotentionApp';
import './Sidebar';
import './NotesList';

// Mock the Zustand store
vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal();
  const mockNotes: { [id: string]: Note } = {};
  const mockFolders: { [id: string]: Folder } = {};

  return {
    ...actual,
    useAppStore: {
      getState: vi.fn(() => ({
        notes: mockNotes,
        folders: mockFolders,
        searchFilters: { folderId: undefined },
        createNote: vi.fn(async (noteData: Partial<Note>) => {
          const newNote: Note = { id: `note-${Object.keys(mockNotes).length + 1}`, title: noteData.title || 'Untitled', content: noteData.content || '', tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date() };
          mockNotes[newNote.id] = newNote;
          // Manually trigger a state update for subscribers
          (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
            const selector = call[0];
            const equalityFn = call[1];
            const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } };
            if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
              selector(newState);
            }
          });
          return newNote;
        }),
        loadNotes: vi.fn(async () => {
          // Simulate loading notes into the store
          (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
            const selector = call[0];
            const equalityFn = call[1];
            const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } };
            if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
              selector(newState);
            }
          });
        }),
        loadFolders: vi.fn(async () => {
          // Simulate loading folders into the store
          (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
            const selector = call[0];
            const equalityFn = call[1];
            const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } };
            if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
              selector(newState);
            }
          });
        }),
        setSearchFilter: vi.fn((key, value) => {
          (useAppStore.getState as vi.Mock).mockReturnValue({
            ...useAppStore.getState(),
            searchFilters: { ...useAppStore.getState().searchFilters, [key]: value }
          });
          // Manually trigger a state update for subscribers
          (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
            const selector = call[0];
            const equalityFn = call[1];
            const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: value } };
            if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
              selector(newState);
            }
          });
        }),
        createFolder: vi.fn(async (name: string, parentId?: string) => {
          const newFolder: Folder = { id: `folder-${Object.keys(mockFolders).length + 1}`, name, noteIds: [], children: [], createdAt: new Date(), updatedAt: new Date(), parentId };
          mockFolders[newFolder.id] = newFolder;
          // Manually trigger a state update for subscribers
          (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
            const selector = call[0];
            const equalityFn = call[1];
            const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } };
            if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
              selector(newState);
            }
          });
          return newFolder.id;
        }),
        updateFolder: vi.fn(async (id: string, updates: Partial<Folder>) => {
          if (mockFolders[id]) {
            mockFolders[id] = { ...mockFolders[id], ...updates, updatedAt: new Date() };
            // Manually trigger a state update for subscribers
            (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
              const selector = call[0];
              const equalityFn = call[1];
              const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } };
              if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
                selector(newState);
              }
            });
          }
        }),
        deleteFolder: vi.fn(async (id: string) => {
          delete mockFolders[id];
          // Manually trigger a state update for subscribers
          (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
            const selector = call[0];
            const equalityFn = call[1];
            const newState = { notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } };
            if (!equalityFn || !equalityFn(newState, useAppStore.getState())) {
              selector(newState);
            }
          });
        }),
      })),
      subscribe: vi.fn(() => vi.fn()), // Mock subscribe to return an unsubscribe function
    }
  };
});

describe('Sidebar Component', () => {
  let app: NotentionApp;
  let sidebarElement: HTMLElement;
  let notesListElement: HTMLElement;

  beforeEach(async () => {
    // Reset mocks and state before each test
    vi.clearAllMocks();
    const mockNotes: { [id: string]: Note } = {};
    const mockFolders: { [id: string]: Folder } = {};

    (useAppStore.getState as vi.Mock).mockReturnValue({
        notes: mockNotes,
        folders: mockFolders,
        searchFilters: { folderId: undefined },
        sidebarTab: 'notes',
        createNote: vi.fn(async (noteData) => {
            const newNote = { id: `note-${Object.keys(mockNotes).length + 1}`, ...noteData };
            mockNotes[newNote.id] = newNote as Note;
            // Simulate store update
            const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
            subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } });
            return newNote;
        }),
        loadNotes: vi.fn(async () => {
            const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
            subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } });
        }),
        loadFolders: vi.fn(async () => {
            const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
            subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } });
        }),
        setSearchFilter: vi.fn((key, value) => {
             const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
             subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: value } });
        }),
        createFolder: vi.fn(async (name, parentId) => {
            const newFolder = { id: `folder-${Object.keys(mockFolders).length + 1}`, name, parentId, noteIds: [], children: [] };
            mockFolders[newFolder.id] = newFolder as Folder;
            const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
            subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } });
            return newFolder.id;
        }),
        updateFolder: vi.fn(async (id, updates) => {
             mockFolders[id] = { ...mockFolders[id], ...updates };
             const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
             subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } });
        }),
        deleteFolder: vi.fn(async (id) => {
            delete mockFolders[id];
            const subscriber = (useAppStore.subscribe as vi.Mock).mock.calls[0][0];
            subscriber({ notes: mockNotes, folders: mockFolders, searchFilters: { folderId: undefined } });
        }),
    });


    app = new NotentionApp();
    document.body.innerHTML = '';
    document.body.appendChild(app);

    // Wait for components to render
    await waitFor(() => {
      sidebarElement = app.shadowRoot!.querySelector('notention-sidebar')!;
      notesListElement = app.shadowRoot!.querySelector('notention-notes-list')!;
      expect(sidebarElement).not.toBeNull();
      expect(notesListElement).not.toBeNull();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new note when "New Note" is clicked', async () => {
    const createNoteSpy = vi.spyOn(useAppStore.getState(), 'createNote');

    await waitFor(() => {
        const newNoteButton = sidebarElement.shadowRoot!.querySelector('.new-note-button');
        expect(newNoteButton).not.toBeNull();
        fireEvent.click(newNoteButton!);
    });

    await waitFor(() => {
      expect(createNoteSpy).toHaveBeenCalled();
    });
  });

  it('should create a new folder when "Create New Folder" is clicked', async () => {
    const createFolderSpy = vi.spyOn(useAppStore.getState(), 'createFolder');
    const folderName = 'My New Folder';
    window.prompt = vi.fn(() => folderName);

    await waitFor(() => {
        const createFolderButton = sidebarElement.shadowRoot!.querySelector('.create-folder-button');
        expect(createFolderButton).not.toBeNull();
        fireEvent.click(createFolderButton!);
    });

    await waitFor(() => {
      expect(createFolderSpy).toHaveBeenCalledWith(folderName);
    });
  });

  it('should filter notes when a folder is clicked', async () => {
    const setSearchFilterSpy = vi.spyOn(useAppStore.getState(), 'setSearchFilter');
    const folderA: Folder = { id: 'folder-A', name: 'Folder A', noteIds: ['n1'], children: [], createdAt: new Date(), updatedAt: new Date() };
    (useAppStore.getState().folders as any)['folder-A'] = folderA;

    await useAppStore.getState().loadFolders();

    await waitFor(() => {
        const folderElement = sidebarElement.shadowRoot!.querySelector('.folder-item');
        expect(folderElement).not.toBeNull();
        fireEvent.click(folderElement!);
    });

    await waitFor(() => {
      expect(setSearchFilterSpy).toHaveBeenCalledWith('folderId', 'folder-A');
    });
  });

  it('should rename a folder when the edit button is clicked', async () => {
    const updateFolderSpy = vi.spyOn(useAppStore.getState(), 'updateFolder');
    const folderId = 'folder-to-edit';
    const originalName = 'Old Folder Name';
    const newName = 'New Folder Name';
    const folder: Folder = { id: folderId, name: originalName, noteIds: [], children: [], createdAt: new Date(), updatedAt: new Date() };
    (useAppStore.getState().folders as any)[folderId] = folder;
    window.prompt = vi.fn(() => newName);

    await useAppStore.getState().loadFolders();

    await waitFor(() => {
        const editButton = sidebarElement.shadowRoot!.querySelector('.edit-folder-button');
        expect(editButton).not.toBeNull();
        fireEvent.click(editButton!);
    });

    await waitFor(() => {
      expect(updateFolderSpy).toHaveBeenCalledWith(folderId, { name: newName });
    });
  });

  it('should delete a folder when the delete button is clicked', async () => {
    const deleteFolderSpy = vi.spyOn(useAppStore.getState(), 'deleteFolder');
    const folderId = 'folder-to-delete';
    const folderName = 'Folder to Delete';
    const folder: Folder = { id: folderId, name: folderName, noteIds: [], children: [], createdAt: new Date(), updatedAt: new Date() };
    (useAppStore.getState().folders as any)[folderId] = folder;
    window.confirm = vi.fn(() => true);

    await useAppStore.getState().loadFolders();

    await waitFor(() => {
        const deleteButton = sidebarElement.shadowRoot!.querySelector('.delete-folder-button');
        expect(deleteButton).not.toBeNull();
        fireEvent.click(deleteButton!);
    });

    await waitFor(() => {
      expect(deleteFolderSpy).toHaveBeenCalledWith(folderId);
    });
  });
});
