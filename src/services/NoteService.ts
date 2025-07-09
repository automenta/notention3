import { Note, OntologyTree, SearchFilters } from '../../shared/types';
import { DBService } from './db';
import { OntologyService } from './ontology';
import { aiService } from './AIService'; // Import AIService
import { useAppStore } from '../store'; // To access AI settings

export class NoteService {
  /**
   * Calculates the cosine similarity between two vectors.
   * @param vecA - The first vector.
   * @param vecB - The second vector.
   * @returns The cosine similarity, or 0 if inputs are invalid.
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs an enhanced search for notes, combining full-text search with structured filters.
   *
   * @param query - The main full-text search query (e.g., "meeting notes", "#AI").
   * @param ontology - The current ontology tree, used for semantic expansion of tags.
   * @param filters - Structured search filters (tags, values, fields, status, etc.).
   * @param allNotes - Optional: An array of all notes to search within. If not provided, fetches all notes from DB.
   * @returns A promise that resolves to an array of notes matching the criteria.
   */
  static async semanticSearch(
    query: string,
    ontology: OntologyTree,
    filters: SearchFilters = {}, // Default to empty object
    allNotes?: Note[]
  ): Promise<Note[]> {
    let notesToSearch = allNotes || await DBService.getAllNotes();
    const trimmedQuery = query.trim(); // Keep original case for potential tag matching
    const normalizedQuery = trimmedQuery.toLowerCase(); // For general text matching

    // Apply structured filters first
    if (filters.status) {
      notesToSearch = notesToSearch.filter(note => note.status === filters.status);
    }

    if (filters.folderId) {
      notesToSearch = notesToSearch.filter(note => note.folderId === filters.folderId);
    }

    if (filters.tags && filters.tags.length > 0) {
      // Use original casing from filters.tags for getSemanticMatches
      const allSemanticFilterTags = new Set<string>();
      filters.tags.forEach(originalFilterTag => {
        OntologyService.getSemanticMatches(ontology, originalFilterTag)
          .forEach(match => allSemanticFilterTags.add(match.toLowerCase()));
      });

      notesToSearch = notesToSearch.filter(note =>
        note.tags.some(noteTag => allSemanticFilterTags.has(noteTag.toLowerCase()))
      );
    }

    if (filters.values) {
      for (const [key, value] of Object.entries(filters.values)) {
        if (value === undefined || value === null || value === '') continue; // Skip empty filter values
        const filterKeyLower = key.toLowerCase();
        const filterValueLower = value.toLowerCase();
        notesToSearch = notesToSearch.filter(note =>
          note.values &&
          Object.entries(note.values).some(([noteValKey, noteVal]) =>
            noteValKey.toLowerCase() === filterKeyLower && noteVal.toLowerCase().includes(filterValueLower)
          )
        );
      }
    }

    if (filters.fields) {
        for (const [key, value] of Object.entries(filters.fields)) {
          if (value === undefined || value === null || value === '') continue;
          const filterKeyLower = key.toLowerCase();
          const filterValueLower = String(value).toLowerCase(); // Ensure value is string for comparison
          notesToSearch = notesToSearch.filter(note =>
            note.fields &&
            Object.entries(note.fields).some(([noteFieldKey, noteFieldValue]) =>
              noteFieldKey.toLowerCase() === filterKeyLower && String(noteFieldValue).toLowerCase().includes(filterValueLower)
            )
          );
        }
    }

    // If there's no full-text query, return the already filtered notes
    if (!normalizedQuery) {
      return notesToSearch;
    }

    // Apply full-text search on the (potentially) pre-filtered notes
    const textSearchSemanticTags = new Set<string>();
    if (trimmedQuery.startsWith('#') || trimmedQuery.startsWith('@')) {
      // Use original-cased trimmedQuery for semantic matching
      OntologyService.getSemanticMatches(ontology, trimmedQuery)
        .forEach(match => textSearchSemanticTags.add(match.toLowerCase()));
    }

    const matchedNotes = notesToSearch.filter(note => {
      // 1. Check title and content for the normalized (lowercase) query
      if (normalizedQuery && (note.title.toLowerCase().includes(normalizedQuery) || note.content.toLowerCase().includes(normalizedQuery))) {
        return true;
      }

      // 2. If the original query was a tag, check if the note contains any of its semantic matches
      if (textSearchSemanticTags.size > 0 && note.tags && note.tags.some(tag => textSearchSemanticTags.has(tag.toLowerCase()))) {
        return true;
      }

      // 3. If query is not a tag, or for broader matching: check if normalizedQuery matches any key or value in `note.values`
      // This part might be too broad if textSearchSemanticTags already matched.
      // Consider if this should only run if textSearchSemanticTags is empty or no match was found yet.
      // For now, it's an OR condition.
      if (normalizedQuery && note.values && Object.entries(note.values).some(([key, value]) =>
        key.toLowerCase().includes(normalizedQuery) || value.toLowerCase().includes(normalizedQuery)
      )) {
        return true;
      }

      // 4. Check if normalizedQuery matches any key or value in `note.fields`
      if (normalizedQuery && note.fields && Object.entries(note.fields).some(([key, value]) =>
        key.toLowerCase().includes(normalizedQuery) || String(value).toLowerCase().includes(normalizedQuery)
      )) {
        return true;
      }

      return false;
    });

    return matchedNotes;
  }

  // Basic CRUD operations
  static async getNotes(): Promise<Note[]> {
    return DBService.getAllNotes();
  }

  static async getNote(id: string): Promise<Note | null> {
    return DBService.getNote(id);
  }

  static async saveNote(note: Note): Promise<void> {
    const now = new Date(); // Use Date object directly, as DBService might expect it or types.ts defines it
    const noteToSave: Note = {
      ...note,
      updatedAt: now,
      createdAt: note.createdAt || now, // Ensure createdAt is also Date
    };
    // Ensure all date fields are consistently Date objects or ISO strings based on types.ts
    // For now, assuming types.ts Note dates are Date objects. If they are strings, adjust here.
    await DBService.saveNote(noteToSave);
  }

  private static async generateAndSetEmbedding(note: Note): Promise<Note> {
    const { userProfile } = useAppStore.getState();
    if (userProfile?.preferences.aiEnabled && aiService.isAIEnabled()) {
      // Combine title and content for a richer embedding
      const textToEmbed = `${note.title}\n${note.content}`;
      if (textToEmbed.trim()) {
        try {
          const embedding = await aiService.getEmbeddingVector(textToEmbed);
          if (embedding && embedding.length > 0) {
            return { ...note, embedding };
          }
        } catch (error) {
          console.error(`Failed to generate embedding for note ${note.id}:`, error);
        }
      }
    }
    // Return note without embedding or with previous embedding if generation failed
    return { ...note, embedding: note.embedding || undefined };
  }

  static async createNote(partialNote: Partial<Note>): Promise<Note> {
    const now = new Date();
    let newNote: Note = {
      id: `note-${new Date().getTime()}-${Math.random().toString(36).substring(2, 9)}`,
      title: 'Untitled Note',
      content: '',
      tags: [],
      values: {},
      fields: {},
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      ...partialNote,
    };

    newNote = await this.generateAndSetEmbedding(newNote);
    await DBService.saveNote(newNote);
    return newNote;
  }

  static async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    const note = await DBService.getNote(id);
    if (!note) return null;

    let updatedNote = { ...note, ...updates, updatedAt: new Date() };

    // Check if content or title changed to regenerate embedding
    const contentChanged = 'content' in updates && updates.content !== note.content;
    const titleChanged = 'title' in updates && updates.title !== note.title;

    if (contentChanged || titleChanged) {
      updatedNote = await this.generateAndSetEmbedding(updatedNote);
    }

    await DBService.saveNote(updatedNote);
    return updatedNote;
  }

  static async deleteNote(id: string): Promise<void> {
    await DBService.deleteNote(id);
  }

  /**
   * Finds notes similar to a given note based on embedding vectors.
   * @param targetNote - The note to find similar matches for.
   * @param allNotes - An array of all notes to search within.
   * @param similarityThreshold - The minimum cosine similarity score to consider a match.
   * @returns A promise that resolves to an array of matched notes, sorted by similarity.
   */
  static async findSimilarNotesByEmbedding(
    targetNote: Note,
    allNotes: Note[],
    similarityThreshold: number = 0.7 // Default threshold
  ): Promise<Array<{ note: Note; similarity: number }>> {
    if (!targetNote.embedding || targetNote.embedding.length === 0) {
      return []; // Cannot find similar notes if the target has no embedding
    }

    const { userProfile } = useAppStore.getState();
    if (!userProfile?.preferences.aiEnabled) {
        return []; // AI features must be enabled
    }

    const similarNotes: Array<{ note: Note; similarity: number }> = [];

    for (const note of allNotes) {
      if (note.id === targetNote.id || !note.embedding || note.embedding.length === 0) {
        continue; // Skip self or notes without embeddings
      }

      const similarity = this.cosineSimilarity(targetNote.embedding, note.embedding);

      if (similarity >= similarityThreshold) {
        similarNotes.push({ note, similarity });
      }
    }

    // Sort by similarity in descending order
    similarNotes.sort((a, b) => b.similarity - a.similarity);

    return similarNotes;
  }
}
