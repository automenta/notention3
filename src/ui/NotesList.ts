import { useAppStore } from '../store';
import { Note } from '../../shared/types';

export class NotesList extends HTMLElement {
	private notes: Note[] = [];
	private activeFolderId: string | undefined = undefined;
	private searchQuery: string = '';
	private sortBy: 'title' | 'createdAt' | 'updatedAt' = 'updatedAt';
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.activeFolderId = state.searchFilters.folderId;
				this.searchQuery = state.searchQuery;
				this.notes = this._getFilteredAndSortedNotes();
				this.render();
			},
			state => [state.notes, state.searchFilters.folderId, state.searchQuery]
		);

		this.notes = this._getFilteredAndSortedNotes();
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private _getFilteredAndSortedNotes(): Note[] {
		const { notes, searchFilters, searchQuery } = useAppStore.getState();
		let filteredNotes = Object.values(notes);

		// Filter by folder
		if (searchFilters.folderId) {
			filteredNotes = filteredNotes.filter(
				note => note.folderId === searchFilters.folderId
			);
		}

		// Filter by search query
		if (searchQuery) {
			const lowercasedQuery = searchQuery.toLowerCase();
			filteredNotes = filteredNotes.filter(
				note =>
					note.title.toLowerCase().includes(lowercasedQuery) ||
					note.content.toLowerCase().includes(lowercasedQuery) ||
					note.tags.some(tag =>
						tag.toLowerCase().includes(lowercasedQuery)
					)
			);
		}

		// Sort
		return filteredNotes.sort((a, b) => {
			if (this.sortBy === 'title') {
				return a.title.localeCompare(b.title);
			} else {
				return (
					new Date(b[this.sortBy]).getTime() -
					new Date(a[this.sortBy]).getTime()
				);
			}
		});
	}

	private _handleNoteClick(noteId: string) {
		this.dispatchEvent(
			new CustomEvent('notention-navigate', {
				detail: { path: `/note?id=${noteId}` },
				bubbles: true,
				composed: true,
			})
		);
	}

	private _handleSearch(e: Event) {
		const target = e.target as HTMLInputElement;
		useAppStore.getState().setSearchQuery(target.value);
	}

	private _handleSort(e: Event) {
		const target = e.target as HTMLSelectElement;
		this.sortBy = target.value as 'title' | 'createdAt' | 'updatedAt';
		this.notes = this._getFilteredAndSortedNotes();
		this.render();
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      .notes-list-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .filters {
        display: flex;
        gap: 8px;
        padding: 0 12px;
      }
      .search-input {
        flex: 1;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--color-border);
      }
      .sort-select {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--color-border);
      }
      .notes-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .note-item {
        padding: 12px;
        border-bottom: 1px solid var(--color-border);
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .note-item:hover {
        background-color: var(--color-accent);
      }
      .note-item.active {
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
      }
      .note-title {
        font-weight: bold;
        margin: 0;
      }
      .note-excerpt {
        font-size: 0.9em;
        color: var(--color-muted-foreground);
        margin-top: 4px;
      }
    `;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="notes-list-container">
        <div class="filters">
          <input type="search" class="search-input" placeholder="Search notes..." .value=${this.searchQuery}>
          <select class="sort-select">
            <option value="updatedAt" ${this.sortBy === 'updatedAt' ? 'selected' : ''}>Sort by updated</option>
            <option value="createdAt" ${this.sortBy === 'createdAt' ? 'selected' : ''}>Sort by created</option>
            <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>Sort by title</option>
          </select>
        </div>
        <ul class="notes-list">
          ${this.notes
						.map(
							note => `
            <li class="note-item" data-note-id="${note.id}">
              <h4 class="note-title">${note.title}</h4>
              <p class="note-excerpt">${note.content.substring(0, 100)}...</p>
            </li>
          `
						)
						.join('')}
        </ul>
      </div>
    `;

		this.shadowRoot.querySelectorAll('.note-item').forEach(item => {
			item.addEventListener('click', () =>
				this._handleNoteClick(item.getAttribute('data-note-id')!)
			);
		});

		this.shadowRoot
			.querySelector('.search-input')
			?.addEventListener('input', this._handleSearch.bind(this));
		this.shadowRoot
			.querySelector('.sort-select')
			?.addEventListener('change', this._handleSort.bind(this));
	}
}

customElements.define('notention-notes-list', NotesList);
