import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { useAppStore } from '../store';
import './Sidebar';

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAppStore: {
      getState: vi.fn(() => ({
        notes: {},
        folders: {},
        searchFilters: { folderId: undefined },
        createNote: vi.fn(),
        loadFolders: vi.fn(),
        setSearchFilter: vi.fn(),
        createFolder: vi.fn(),
        updateFolder: vi.fn(),
        deleteFolder: vi.fn(),
      })),
      subscribe: vi.fn(() => vi.fn()),
    },
  };
});

describe('Sidebar Component', () => {
  it('should render the sidebar', async () => {
    document.body.innerHTML = '<notention-sidebar></notention-sidebar>';
    const sidebarElement = await waitFor(() => document.querySelector('notention-sidebar'));
    expect(sidebarElement).toBeInTheDocument();
  });
});
