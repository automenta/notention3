import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { NoteService } from '../services/NoteService';
import './Sidebar';
import './NotesList';

// Mock NoteService
vi.mock('../services/NoteService', () => ({
  NoteService: {
    createNote: vi.fn(),
    getNotes: vi.fn().mockResolvedValue([]),
  },
}));

describe('Sidebar Component', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<my-sidebar></my-sidebar>';
    // Wait for component to render
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('should create a new note and update the notes list when "New Note" is clicked', async () => {
    // Arrange
    const newNote = { id: '4', title: 'New Note', content: '' };
    (NoteService.createNote as jest.Mock).mockResolvedValue(newNote);
    (NoteService.getNotes as jest.Mock).mockResolvedValue([newNote]);
    const notesList = document.querySelector('my-notes-list');
    const updateNotesSpy = vi.spyOn(notesList as any, 'updateNotes');

    // Act
    const newNoteButton = screen.getByText('New Note');
    fireEvent.click(newNoteButton);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Assert
    expect(NoteService.createNote).toHaveBeenCalled();
    expect(updateNotesSpy).toHaveBeenCalled();
  });
});
