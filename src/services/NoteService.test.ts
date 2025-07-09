import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteService } from './NoteService';
import { DBService } from './db';
import { OntologyService } from './ontology';
import { aiService } from './AIService'; // Added AIService mock
import { useAppStore } from '../store'; // Added useAppStore mock
import { Note, OntologyTree, SearchFilters, UserProfile } from '../../shared/types';

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

// Mock AIService
vi.mock('./AIService', () => ({
  aiService: {
    isAIEnabled: vi.fn(),
    getEmbeddingVector: vi.fn(),
  }
}));

// Mock Zustand store (useAppStore)
const mockUserProfile: UserProfile = {
  nostrPubkey: 'test-pubkey',
  sharedTags: [],
  preferences: {
    theme: 'light',
    aiEnabled: true, // Default to true for testing embedding features
    defaultNoteStatus: 'draft',
    ollamaApiEndpoint: 'http://localhost:11434',
    geminiApiKey: 'test-gemini-key',
  },
  nostrRelays: [],
  privacySettings: {
    sharePublicNotesGlobally: false,
    shareTagsWithPublicNotes: true,
    shareValuesWithPublicNotes: true,
  }
};
vi.mock('../store', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      userProfile: mockUserProfile,
      // Add other state properties if NoteService directly accesses them
    })),
    // Mock any actions if NoteService calls them directly (it doesn't seem to)
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
    (DBService.getAllNotes as vi.Mock).mockResolvedValue([...mockNotes]);
    (DBService.getNote as vi.Mock).mockImplementation(async (id: string) => mockNotes.find(n => n.id === id) || null);
    (DBService.saveNote as vi.Mock).mockResolvedValue(undefined);
    (DBService.deleteNote as vi.Mock).mockResolvedValue(undefined);

    (OntologyService.getSemanticMatches as vi.Mock).mockImplementation((ontology, tag) => {
      if (tag === '#AI') return ['#AI', '#NLP'];
      if (tag === '#NLP') return ['#NLP', '#AI'];
      if (tag.toLowerCase() === 'artificial intelligence') return [];
      return [tag];
    });

    // Reset AI and store mocks
    (aiService.isAIEnabled as vi.Mock).mockReturnValue(true); // Default to AI enabled
    (aiService.getEmbeddingVector as vi.Mock).mockResolvedValue([0.1, 0.2, 0.3]); // Default mock embedding
    (useAppStore.getState as vi.Mock).mockReturnValue({ userProfile: { ...mockUserProfile, preferences: { ...mockUserProfile.preferences, aiEnabled: true } } });
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
      // Default behavior is to attempt embedding generation
      expect(aiService.isAIEnabled).toHaveBeenCalled();
      expect(aiService.getEmbeddingVector).toHaveBeenCalledWith("New Test Note\n"); // Title + default empty content
      const savedArgWithEmbedding = (DBService.saveNote as vi.Mock).mock.calls[0][0] as Note;
      expect(savedArgWithEmbedding.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('createNote should not generate embedding if AI is disabled in preferences', async () => {
      (useAppStore.getState as vi.Mock).mockReturnValue({ userProfile: { ...mockUserProfile, preferences: { ...mockUserProfile.preferences, aiEnabled: false } } });

      const partialNote: Partial<Note> = { title: 'No AI Note' };
      await NoteService.createNote(partialNote);

      expect(aiService.isAIEnabled).toHaveBeenCalled(); // Still checks this
      // getEmbeddingVector should not be called if aiService.isAIEnabled() (which checks store pref) returns false effectively
      // The mock for aiService.isAIEnabled itself needs to reflect the store's preference
      (aiService.isAIEnabled as vi.Mock).mockReturnValue(false); // Simulate the service respecting the pref
      await NoteService.createNote({ title: 'Another No AI Note' }); // Call again with service respecting pref

      expect(aiService.getEmbeddingVector).not.toHaveBeenCalledWith("Another No AI Note\n"); // Check specific call did not happen
      const savedArg = (DBService.saveNote as vi.Mock).mock.calls[1][0] as Note; // Second call
      expect(savedArg.embedding).toBeUndefined();
    });

    it('createNote should not generate embedding if text to embed is empty', async () => {
      await NoteService.createNote({ title: '', content: '' });
      expect(aiService.getEmbeddingVector).not.toHaveBeenCalledWith("\n"); // Or however empty content is handled
      const savedArg = (DBService.saveNote as vi.Mock).mock.calls[0][0] as Note;
      expect(savedArg.embedding).toBeUndefined();
    });


    it('updateNote should save updated fields and timestamp, and regenerate embedding if title/content changes', async () => {
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

      // Check embedding regeneration
      expect(aiService.getEmbeddingVector).toHaveBeenCalledWith("Updated Title\nAbout artificial intelligence"); // Original content with new title
      expect(savedArg.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('updateNote should not regenerate embedding if only non-content fields change', async () => {
      const noteId = '1';
      (DBService.getNote as vi.Mock).mockResolvedValueOnce(mockNotes.find(n => n.id === noteId));
      (aiService.getEmbeddingVector as vi.Mock).mockClear(); // Clear previous calls

      await NoteService.updateNote(noteId, { tags: ['#NewTag'] });
      expect(aiService.getEmbeddingVector).not.toHaveBeenCalled();
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

  describe('findSimilarNotesByEmbedding', () => {
    const targetNote: Note = {
      id: 'target', title: 'Target Note', content: 'Content of target',
      tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date(),
      embedding: [1, 0, 0] // Simple vector for easy testing
    };
    const notesWithEmbeddings: Note[] = [
      targetNote,
      { ...mockNotes[0], id: 'noteA', embedding: [0.9, 0.1, 0] }, // High similarity
      { ...mockNotes[1], id: 'noteB', embedding: [0, 1, 0] },   // No similarity (orthogonal)
      { ...mockNotes[2], id: 'noteC', embedding: [0.5, 0.5, 0] }, // Medium similarity
      { id: 'noteD', title: 'No Embedding Note', content: '', tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date() },
    ];

    it('should return notes sorted by similarity above threshold', async () => {
      const results = await NoteService.findSimilarNotesByEmbedding(targetNote, notesWithEmbeddings, 0.6);
      expect(results).toHaveLength(2);
      expect(results[0].note.id).toBe('noteA'); // Highest similarity
      expect(results[0].similarity).toBeCloseTo(0.9 / Math.sqrt(0.9**2 + 0.1**2)); // cos(theta) = (1*0.9 + 0*0.1 + 0*0) / (1 * sqrt(0.9^2+0.1^2))
      expect(results[1].note.id).toBe('noteC');
      expect(results[1].similarity).toBeCloseTo(0.5 / Math.sqrt(0.5**2 + 0.5**2)); // cos(theta) = (1*0.5 + 0*0.5 + 0*0) / (1 * sqrt(0.5^2+0.5^2))
    });

    it('should return empty array if target note has no embedding', async () => {
      const noEmbeddingTarget: Note = { ...targetNote, embedding: undefined };
      const results = await NoteService.findSimilarNotesByEmbedding(noEmbeddingTarget, notesWithEmbeddings);
      expect(results).toEqual([]);
    });

    it('should return empty array if AI is disabled', async () => {
      (useAppStore.getState as vi.Mock).mockReturnValue({ userProfile: { ...mockUserProfile, preferences: { ...mockUserProfile.preferences, aiEnabled: false } } });
      const results = await NoteService.findSimilarNotesByEmbedding(targetNote, notesWithEmbeddings);
      expect(results).toEqual([]);
    });

    it('should skip notes without embeddings or the target note itself', async () => {
      const results = await NoteService.findSimilarNotesByEmbedding(targetNote, notesWithEmbeddings, 0.1);
      expect(results.find(r => r.note.id === 'target')).toBeUndefined();
      expect(results.find(r => r.note.id === 'noteD')).toBeUndefined();
      expect(results.length).toBeLessThanOrEqual(notesWithEmbeddings.length - 2); // Excludes target and noteD
    });
  });

  describe('getSimilarNotesGlobally', () => {
    const targetNoteWithEmbedding: Note = {
      id: 'targetGlobal', title: 'Target Global', content: 'Content',
      tags: [], values: {}, fields: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date(),
      embedding: [1, 0, 0]
    };
    const otherNotesForGlobalSearch: Note[] = [
      { ...mockNotes[0], id: 'globalA', embedding: [0.8, 0.2, 0] }, // Similar
      { ...mockNotes[1], id: 'globalB', embedding: [0, 0, 1] },   // Different
      { ...mockNotes[2], id: 'globalC', embedding: [0.7, 0.1, 0.1] }, // Similar
      { ...targetNoteWithEmbedding } // Target note itself, should be excluded from comparison
    ];

    beforeEach(() => {
      // Mock DBService.getNote to return the target note
      (DBService.getNote as vi.Mock).mockImplementation(async (id: string) => {
        if (id === targetNoteWithEmbedding.id) return targetNoteWithEmbedding;
        return null;
      });
      // Mock DBService.getAllNotes to return the list of notes for global search
      (DBService.getAllNotes as vi.Mock).mockResolvedValue(otherNotesForGlobalSearch);
      // Ensure AI is enabled for these tests
      (useAppStore.getState as vi.Mock).mockReturnValue({ userProfile: { ...mockUserProfile, preferences: { ...mockUserProfile.preferences, aiEnabled: true } } });
    });

    it('should return similar notes from global list, excluding self', async () => {
      const results = await NoteService.getSimilarNotesGlobally(targetNoteWithEmbedding.id, 0.6);
      expect(DBService.getNote).toHaveBeenCalledWith(targetNoteWithEmbedding.id);
      expect(DBService.getAllNotes).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results.some(r => r.note.id === 'targetGlobal')).toBe(false); // Ensure target is not in results
      // Based on manual calculation, globalC (sim ~0.98) is more similar to [1,0,0] than globalA (sim ~0.97).
      expect(results[0].note.id).toBe('globalC');
      expect(results[1].note.id).toBe('globalA');
    });

    it('should return empty array if target note is not found', async () => {
      (DBService.getNote as vi.Mock).mockResolvedValue(null);
      const results = await NoteService.getSimilarNotesGlobally('nonexistentId');
      expect(results).toEqual([]);
    });

    it('should return empty array if target note has no embedding', async () => {
      (DBService.getNote as vi.Mock).mockResolvedValue({ ...targetNoteWithEmbedding, embedding: undefined });
      const results = await NoteService.getSimilarNotesGlobally(targetNoteWithEmbedding.id);
      expect(results).toEqual([]);
    });

    it('should return empty array if AI features are disabled in preferences', async () => {
      (useAppStore.getState as vi.Mock).mockReturnValue({ userProfile: { ...mockUserProfile, preferences: { ...mockUserProfile.preferences, aiEnabled: false } } });
      const results = await NoteService.getSimilarNotesGlobally(targetNoteWithEmbedding.id);
      expect(results).toEqual([]);
    });
  });
});
