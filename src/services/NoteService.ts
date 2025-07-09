import { Note, OntologyTree, SearchFilters } from '../../shared/types'; // Added SearchFilters
import { DBService } from './db';
import { OntologyService } from './ontology';

export class NoteService {
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

  static async createNote(partialNote: Partial<Note>): Promise<Note> {
    const now = new Date();
    const newNote: Note = {
      // Default values from types.ts or sensible defaults
      id: `note-${new Date().getTime()}-${Math.random().toString(36).substring(2, 9)}`,
      title: 'Untitled Note',
      content: '',
      tags: [],
      values: {},
      fields: {},
      status: 'draft', // Default status from types.ts
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      ...partialNote,
    };
    await DBService.saveNote(newNote);
    return newNote;
  }

  static async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    const note = await DBService.getNote(id);
    if (!note) return null;

    const updatedNote = { ...note, ...updates, updatedAt: new Date() };
    await DBService.saveNote(updatedNote);
    return updatedNote;
  }

  static async deleteNote(id: string): Promise<void> {
    await DBService.deleteNote(id);
  }
}
