import { useAppStore } from '../store';
import { Note } from '../../shared/types';

export class NotesList extends HTMLElement {
	private notes: Note[] = [];
	private activeFolderId: string | undefined = undefined;
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.activeFolderId = state.searchFilters.folderId;
				const allNotes = Object.values(state.notes);
				this.notes = allNotes.filter(note => {
					if (this.activeFolderId === undefined) {
						return !note.folderId;
					}
					return note.folderId === this.activeFolderId;
				});
				this.render();
			},
			state => [state.notes, state.searchFilters.folderId]
		);

		// Initial load
		const state = useAppStore.getState();
		this.activeFolderId = state.searchFilters.folderId;
		const allNotes = Object.values(state.notes);
		this.notes = allNotes.filter(note => {
			if (this.activeFolderId === undefined) {
				return !note.folderId;
			}
			return note.folderId === this.activeFolderId;
		});
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
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

	render() {
		if (!this.shadowRoot) return;

		const styles = `
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
    `;

		this.shadowRoot.querySelectorAll('.note-item').forEach(item => {
			item.addEventListener('click', () =>
				this._handleNoteClick(item.getAttribute('data-note-id')!)
			);
		});
	}
}

customElements.define('notention-notes-list', NotesList);
