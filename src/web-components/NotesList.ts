import { useAppStore } from '../store';
import { Note } from '../../shared/types';

export class NotesList extends HTMLElement {
  private _activeFolderId: string | undefined = undefined;
  private notes: Note[] = [];
  private searchTerm: string = '';

  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['active-folder-id'];
  }

  attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    if (name === 'active-folder-id') {
      this._activeFolderId = newVal === 'undefined' ? undefined : newVal;
      this.filterAndRenderNotes();
    }
  }

  get activeFolderId(): string | undefined {
    return this._activeFolderId;
  }

  set activeFolderId(value: string | undefined) {
    if (this._activeFolderId !== value) {
      this._activeFolderId = value;
      this.setAttribute('active-folder-id', value || 'undefined');
      this.filterAndRenderNotes();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.filterAndRenderNotes(state);
      },
      (state) => [state.notes, state.searchFilters.folderId] // Re-run selector if notes or activeFolderId changes
    );
    // Initial load of notes
    useAppStore.getState().loadNotes();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.removeEventListeners();
  }

  private filterAndRenderNotes(state = useAppStore.getState()) {
    const allNotes = Object.values(state.notes);
    let filteredNotes = allNotes;

    // Filter by folderId
    if (this._activeFolderId !== undefined) {
      filteredNotes = filteredNotes.filter(note => note.folderId === this._activeFolderId);
    } else {
      // Show unfiled notes if activeFolderId is undefined
      filteredNotes = filteredNotes.filter(note => note.folderId === undefined);
    }

    // Filter by search term
    if (this.searchTerm) {
      const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
      filteredNotes = filteredNotes.filter(
        note => note.title.toLowerCase().includes(lowerCaseSearchTerm) ||
                note.content.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Sort notes by updatedAt, newest first
    this.notes = filteredNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    this.render();
  }

  private setupEventListeners() {
    this.shadowRoot?.querySelector('.search-input')?.addEventListener('input', this._handleSearchInput.bind(this));
    this.shadowRoot?.querySelector('.notes-container')?.addEventListener('click', this._handleNotesContainerClick.bind(this));
  }

  private removeEventListeners() {
    this.shadowRoot?.querySelector('.search-input')?.removeEventListener('input', this._handleSearchInput.bind(this));
    this.shadowRoot?.querySelector('.notes-container')?.removeEventListener('click', this._handleNotesContainerClick.bind(this));
  }

  private _handleSearchInput(e: Event) {
    this.searchTerm = (e.target as HTMLInputElement).value;
    this.filterAndRenderNotes();
  }

  private _handleNotesContainerClick(e: Event) {
    const target = e.target as HTMLElement;
    const noteItem = target.closest('.note-item');
    if (noteItem) {
      const noteId = noteItem.dataset.noteId;
      if (noteId) {
        this.dispatchEvent(new CustomEvent('notention-navigate', {
          detail: { path: `/note?id=${noteId}` },
          bubbles: true,
          composed: true,
        }));
      }
    }
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      :host {
        display: block;
        padding: 16px;
        background-color: var(--color-background);
        color: var(--color-foreground);
      }
      .search-input {
        width: calc(100% - 16px);
        padding: 8px;
        margin-bottom: 16px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background-color: var(--color-input);
        color: var(--color-foreground);
      }
      .notes-container {
        max-height: calc(100vh - 250px); /* Adjust based on header/footer height */
        overflow-y: auto;
      }
      .note-item {
        border: 1px solid var(--color-border);
        padding: 12px;
        margin-bottom: 8px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        background-color: var(--color-card);
        transition: background-color 0.2s;
      }
      .note-item:hover {
        background-color: var(--color-accent);
      }
      .note-title {
        font-weight: bold;
        color: var(--color-primary);
      }
      .note-date {
        font-size: 0.8em;
        color: var(--color-muted-foreground);
      }
      .no-notes-message {
        color: var(--color-muted-foreground);
        text-align: center;
        margin-top: 20px;
      }
    `;

    const notesHtml = this.notes.length === 0
      ? `<p class="no-notes-message">No notes found in this folder.</p>`
      : this.notes.map(note => `
          <div class="note-item" data-note-id="${note.id}">
            <div class="note-title">${note.title || 'Untitled'}</div>
            <div class="note-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
          </div>
        `).join('');

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <input type="text" class="search-input" placeholder="Search notes..." value="${this.searchTerm}">
      <div class="notes-container">
        ${notesHtml}
      </div>
    `;

    this.setupEventListeners(); // Re-attach event listeners after re-rendering
  }
}

customElements.define('notention-notes-list', NotesList);