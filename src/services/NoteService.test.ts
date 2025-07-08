import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteService } from './NoteService';
import { DBService } from './db';
import { OntologyService } from './ontology';
import { Note, OntologyTree, SearchFilters } from '../../shared/types';

// Mock DBService
vi.mock('./db', () => ({
  DBService: {
    getAllNotes: vi.fn(),
    getNote: vi.fn(),
    saveNote: vi.fn(),
    deleteNote: vi.fn(),
  }
}));

// Mock OntologyService
vi.mock('./ontology', () => ({
  OntologyService: {
    getSemanticMatches: vi.fn(),
  }
}));

describe('NoteService', () => {
  const mockNotes: Note[] = [
    { id: '1', title: 'AI Note', content: 'About artificial intelligence', tags: ['#AI', '#Tech'], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date() },
    { id: '2', title: 'NLP Project', content: 'Natural Language Processing task', tags: ['#NLP', '#Project'], values: { priority: 'high' }, fields: {}, status: 'published', createdAt: new Date(), updatedAt: new Date() },
    { id: '3', title: 'Meeting Summary', content: 'Discussed #ProjectAlpha', tags: ['#Meeting'], values: { date: '2024-01-01' }, fields: { attendees: 'Bob, Alice' }, status: 'draft', createdAt: new Date(), updatedAt: new Date() },
  ];

  const mockOntology: OntologyTree = {
    nodes: {
      'ai': { id: 'ai', label: '#AI', children: ['nlp'] },
      'nlp': { id: 'nlp', label: '#NLP', parentId: 'ai' },
      'project': { id: 'project', label: '#Project' },
      'meeting': { id: 'meeting', label: '#Meeting'},
    },
    rootIds: ['ai', 'project', 'meeting']
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (DBService.getAllNotes as vi.Mock).mockResolvedValue([...mockNotes]); // Return a copy
    (DBService.getNote as vi.Mock).mockImplementation(async (id: string) => mockNotes.find(n => n.id === id) || null);
    (DBService.saveNote as vi.Mock).mockResolvedValue(undefined);
    (DBService.deleteNote as vi.Mock).mockResolvedValue(undefined);
    (OntologyService.getSemanticMatches as vi.Mock).mockImplementation((ontology, tag) => {
      if (tag === '#AI') return ['#AI', '#NLP'];
      if (tag === '#NLP') return ['#NLP', '#AI']; // Assuming symmetric for this mock
      if (tag.toLowerCase() === 'artificial intelligence') return []; // Not a tag query
      return [tag];
    });
  });

  describe('semanticSearch', () => {
    it('should return all notes if query is empty and no filters', async () => {
      const results = await NoteService.semanticSearch('', mockOntology, {});
      expect(results).toEqual(mockNotes);
      expect(DBService.getAllNotes).toHaveBeenCalledTimes(1); // Called if allNotes not provided
    });

    it('should filter by text query in title or content', async () => {
      const results = await NoteService.semanticSearch('artificial', mockOntology, {}, mockNotes);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should perform semantic tag search from query', async () => {
      // Querying for #AI should also find #NLP note due to semantic match
      const results = await NoteService.semanticSearch('#AI', mockOntology, {}, mockNotes);
      expect(results).toHaveLength(2); // AI Note, NLP Project
      expect(results.some(n => n.id === '1')).toBe(true);
      expect(results.some(n => n.id === '2')).toBe(true);
      expect(OntologyService.getSemanticMatches).toHaveBeenCalledWith(mockOntology, '#AI');
    });

    it('should filter by status from SearchFilters', async () => {
      const filters: SearchFilters = { status: 'published' };
      const results = await NoteService.semanticSearch('', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should filter by tags from SearchFilters (semantically)', async () => {
      const filters: SearchFilters = { tags: ['#AI'] };
      // OntologyService.getSemanticMatches for '#AI' returns ['#AI', '#NLP']
      const results = await NoteService.semanticSearch('', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(2); // AI Note, NLP Project
      // Corrected: Expecting the original cased tag from filters.tags
      expect(OntologyService.getSemanticMatches).toHaveBeenCalledWith(mockOntology, '#AI');
    });

    it('should filter by values from SearchFilters', async () => {
      const filters: SearchFilters = { values: { priority: 'high' } };
      const results = await NoteService.semanticSearch('', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should filter by values (partial match) from SearchFilters', async () => {
      const filters: SearchFilters = { values: { priority: 'hi' } }; // Partial value
      const results = await NoteService.semanticSearch('', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });


    it('should filter by fields from SearchFilters', async () => {
      const filters: SearchFilters = { fields: { attendees: 'Alice' } };
      const results = await NoteService.semanticSearch('', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('3');
    });

    it('should combine full-text query and filters', async () => {
      const filters: SearchFilters = { tags: ['#Project'] };
      // Search for "NLP" text within notes already filtered by #Project
      const results = await NoteService.semanticSearch('NLP', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2'); // NLP Project
    });

    it('should return empty if text query does not match after filtering', async () => {
      const filters: SearchFilters = { status: 'published' }; // NLP Project
      const results = await NoteService.semanticSearch('nonexistent term', mockOntology, filters, mockNotes);
      expect(results).toHaveLength(0);
    });
  });

  describe('CRUD operations', () => {
    it('createNote should save a new note with defaults', async () => {
      const partialNote: Partial<Note> = { title: 'New Test Note' };
      const createdNote = await NoteService.createNote(partialNote);

      expect(DBService.saveNote).toHaveBeenCalled();
      const savedArg = (DBService.saveNote as vi.Mock).mock.calls[0][0] as Note;
      expect(savedArg.title).toBe('New Test Note');
      expect(savedArg.id).toBeDefined();
      expect(savedArg.status).toBe('draft'); // Default status
      expect(createdNote.title).toBe('New Test Note');
    });

    it('updateNote should save updated fields and timestamp', async () => {
      const updates: Partial<Note> = { title: 'Updated Title', status: 'published' };
      const noteId = '1';
      // Ensure getNote returns a note for update to succeed
      (DBService.getNote as vi.Mock).mockResolvedValueOnce(mockNotes.find(n => n.id === noteId));

      const originalDate = mockNotes.find(n => n.id === noteId)!.updatedAt;
      const updatedNote = await NoteService.updateNote(noteId, updates);

      expect(DBService.saveNote).toHaveBeenCalled();
      const savedArg = (DBService.saveNote as vi.Mock).mock.calls[0][0] as Note;
      expect(savedArg.title).toBe('Updated Title');
      expect(savedArg.status).toBe('published');
      expect(savedArg.updatedAt.getTime()).toBeGreaterThan(new Date(originalDate).getTime());
      expect(updatedNote?.title).toBe('Updated Title');
    });

    it('updateNote should return null if note not found', async () => {
      (DBService.getNote as vi.Mock).mockResolvedValueOnce(null);
      const updatedNote = await NoteService.updateNote('nonexistent', { title: 'test' });
      expect(updatedNote).toBeNull();
      expect(DBService.saveNote).not.toHaveBeenCalled();
    });

    it('deleteNote should call DBService.deleteNote', async () => {
      await NoteService.deleteNote('1');
      expect(DBService.deleteNote).toHaveBeenCalledWith('1');
    });
  });
});
