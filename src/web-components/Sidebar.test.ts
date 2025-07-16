import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { useAppStore } from '../store';
import { Note, Folder } from '../../shared/types';
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
  let sidebarElement: HTMLElement & { activeTab: string; updateComplete: Promise<unknown> };
  let notesListElement: HTMLElement & { updateComplete: Promise<unknown> };

  beforeEach(async () => {
    // Reset mocks and state before each test
    vi.clearAllMocks();
    // Use a fresh mock for each test to avoid state leakage
    const mockNotes: { [id: string]: Note } = {};
    const mockFolders: { [id: string]: Folder } = {};
    const mockGetState = () => ({
      notes: mockNotes,
      folders: mockFolders,
      searchFilters: { folderId: undefined },
      createNote: vi.fn(),
      loadFolders: vi.fn(),
      setSearchFilter: vi.fn(),
      createFolder: vi.fn(),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn(),
      loadNotes: vi.fn(),
    });
    (useAppStore.getState as vi.Mock).mockImplementation(mockGetState);


    document.body.innerHTML = '<div><notention-app></notention-app></div>';

    // Wait for a specific element that indicates rendering is complete
    await screen.findByText('Notention', {}, { timeout: 3000 });

    sidebarElement = document.querySelector('notention-sidebar')! as any;
    notesListElement = document.querySelector('notention-notes-list')! as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new note and display it in the notes list when "New Note" is clicked', async () => {
    // Arrange
    const createNoteSpy = vi.spyOn(useAppStore.getState(), 'createNote');
    const newNoteTitle = 'My Test Note';
    createNoteSpy.mockImplementation(async (noteData: Partial<Note>) => {
      const newNote: Note = { id: 'note-test-1', title: noteData.title || newNoteTitle, content: '', tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date() };
      // Manually add the note to the mocked store's notes object
      (useAppStore.getState().notes as any)[newNote.id] = newNote;
      // Trigger a state update for subscribers (NotesList)
      (useAppStore.subscribe as vi.Mock).mock.calls.forEach((call: any) => {
        const selector = call[0];
        selector(useAppStore.getState());
      });
      return newNote;
    });

    // Act
    const newNoteButton = screen.getByText('New Note');
    fireEvent.click(newNoteButton);

    // Wait for the note creation and subsequent rendering
    await waitFor(() => {
      expect(createNoteSpy).toHaveBeenCalled();
      expect(screen.getByText(newNoteTitle)).toBeInTheDocument();
    });
  });

  it('should create a new folder and display it in the sidebar', async () => {
    // Arrange
    const createFolderSpy = vi.spyOn(useAppStore.getState(), 'createFolder');
    const folderName = 'My New Folder';
    createFolderSpy.mockResolvedValue('folder-test-1'); // Mock the ID returned

    // Act
    const createFolderButton = screen.getByText('Create New Folder');
    fireEvent.click(createFolderButton);

    // Simulate prompt input
    window.prompt = vi.fn(() => folderName);

    // Re-click the button after setting prompt mock
    fireEvent.click(createFolderButton);

    await waitFor(() => {
      expect(createFolderSpy).toHaveBeenCalledWith(folderName, undefined);
      expect(screen.getByText(folderName)).toBeInTheDocument();
    });
  });

  it('should filter notes when a folder is clicked', async () => {
    // Arrange
    const note1: Note = { id: 'n1', title: 'Note in Folder A', content: '', folderId: 'folder-A', tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date() };
    const note2: Note = { id: 'n2', title: 'Unfiled Note', content: '', folderId: undefined, tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date() };
    const folderA: Folder = { id: 'folder-A', name: 'Folder A', noteIds: ['n1'], children: [], createdAt: new Date(), updatedAt: new Date() };

    // Manually set initial state for the mock store
    (useAppStore.getState().notes as any) = { [note1.id]: note1, [note2.id]: note2 };
    (useAppStore.getState().folders as any) = { [folderA.id]: folderA };

    // Trigger initial load for components
    useAppStore.getState().loadNotes();
    useAppStore.getState().loadFolders();
    await sidebarElement.updateComplete;
    await notesListElement.updateComplete;

    // Assert initial state: both notes should be visible (unfiled by default)
    expect(screen.getByText('Note in Folder A')).toBeInTheDocument();
    expect(screen.getByText('Unfiled Note')).toBeInTheDocument();

    // Act: Click on Folder A
    const folderAElement = screen.getByText('Folder A');
    fireEvent.click(folderAElement);

    await waitFor(() => {
      // Only Note in Folder A should be visible
      expect(screen.getByText('Note in Folder A')).toBeInTheDocument();
      expect(screen.queryByText('Unfiled Note')).not.toBeInTheDocument();
    });

    // Act: Click on Unfiled Notes
    const unfiledNotesElement = screen.getByText('Unfiled Notes');
    fireEvent.click(unfiledNotesElement);

    await waitFor(() => {
      // Only Unfiled Note should be visible
      expect(screen.queryByText('Note in Folder A')).not.toBeInTheDocument();
      expect(screen.getByText('Unfiled Note')).toBeInTheDocument();
    });
  });

  it('should rename a folder when the edit button is clicked', async () => {
    // Arrange
    const updateFolderSpy = vi.spyOn(useAppStore.getState(), 'updateFolder');
    const folderId = 'folder-to-edit';
    const originalName = 'Old Folder Name';
    const newName = 'New Folder Name';
    const folder: Folder = { id: folderId, name: originalName, noteIds: [], children: [], createdAt: new Date(), updatedAt: new Date() };

    (useAppStore.getState().folders as any)[folderId] = folder;
    useAppStore.getState().loadFolders();
    await sidebarElement.updateComplete;

    // Simulate prompt input
    window.prompt = vi.fn(() => newName);

    // Act
    const editButton = screen.getByTitle('Edit Folder');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(updateFolderSpy).toHaveBeenCalledWith(folderId, { name: newName });
      expect(screen.getByText(newName)).toBeInTheDocument();
      expect(screen.queryByText(originalName)).not.toBeInTheDocument();
    });
  });

  it('should delete a folder when the delete button is clicked', async () => {
    // Arrange
    const deleteFolderSpy = vi.spyOn(useAppStore.getState(), 'deleteFolder');
    const folderId = 'folder-to-delete';
    const folderName = 'Folder to Delete';
    const folder: Folder = { id: folderId, name: folderName, noteIds: [], children: [], createdAt: new Date(), updatedAt: new Date() };

    (useAppStore.getState().folders as any)[folderId] = folder;
    useAppStore.getState().loadFolders();
    await sidebarElement.updateComplete;

    // Simulate confirm dialog
    window.confirm = vi.fn(() => true);

    // Act
    const deleteButton = screen.getByTitle('Delete Folder');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteFolderSpy).toHaveBeenCalledWith(folderId);
      expect(screen.queryByText(folderName)).not.toBeInTheDocument();
    });
  });
});
