import { useAppStore } from '../store';
import { Match, Note } from '../../shared/types';

export class NetworkPanel extends HTMLElement {
	private connected: boolean = false;
	private matches: Match[] = [];
	private notes: { [id: string]: Note } = {};
	private relays: string[] = [];
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.connected = state.nostrConnected;
				this.matches = state.matches;
				this.notes = state.notes;
				this.relays = state.nostrRelays;
				this.render();
			},
			state => [
				state.nostrConnected,
				state.matches,
				state.notes,
				state.nostrRelays,
			]
		);
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private _handleViewNote(noteId: string) {
		this.dispatchEvent(
			new CustomEvent('notention-navigate', {
				detail: { path: `/note?id=${noteId}` },
				bubbles: true,
				composed: true,
			})
		);
	}

	private _handleContactAuthor(author: string) {
		// This will be implemented in a later step
		alert(`Contacting ${author}...`);
	}

	private _handleAddRelay() {
		const input = this.shadowRoot?.querySelector(
			'.add-relay-input'
		) as HTMLInputElement;
		if (input && input.value) {
			useAppStore.getState().addNostrRelay(input.value);
			input.value = '';
		}
	}

	private _handleRemoveRelay(relay: string) {
		useAppStore.getState().removeNostrRelay(relay);
	}

	private _handleSyncNow() {
		useAppStore.getState().syncWithNostr(true);
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      .network-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .status {
        font-weight: bold;
      }
      .status.connected {
        color: green;
      }
      .status.disconnected {
        color: red;
      }
      .matches-list, .relays-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .match-item, .relay-item {
        padding: 12px;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .match-author {
        font-weight: bold;
      }
      .match-similarity {
        font-size: 0.9em;
        color: var(--color-muted-foreground);
      }
      .match-actions {
        margin-top: 8px;
      }
      .add-relay-form {
        display: flex;
        gap: 8px;
      }
      .sync-button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        width: fit-content;
      }
    `;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="network-panel">
        <h2>Network</h2>
        <p class="status ${this.connected ? 'connected' : 'disconnected'}">
          Status: ${this.connected ? 'Connected' : 'Disconnected'}
        </p>
        <button class="sync-button">Sync Now</button>
        <h3>Relays</h3>
        <ul class="relays-list">
            ${this.relays
							.map(
								relay => `
                <li class="relay-item">
                    <span>${relay}</span>
                    <button class="remove-relay-button" data-relay="${relay}">Remove</button>
                </li>
            `
							)
							.join('')}
        </ul>
        <div class="add-relay-form">
            <input type="text" class="add-relay-input" placeholder="wss://your-relay.com">
            <button class="add-relay-button">Add Relay</button>
        </div>
        <h3>Matches</h3>
        <ul class="matches-list">
          ${this.matches
						.map(match => {
							const note = this.notes[match.localNoteId];
							return `
              <li class="match-item">
                <div>
                    <p class="match-author">From: ${match.targetAuthor}</p>
                    <p><strong>Matched Note:</strong> ${note?.title || 'Unknown'}</p>
                    <p class="match-similarity">Similarity: ${match.similarity.toFixed(
											2
										)}</p>
                    <p>Shared Tags: ${match.sharedTags.join(', ')}</p>
                </div>
                <div class="match-actions">
                  <button class="view-note-button" data-note-id="${match.targetNoteId}">View Note</button>
                  <button class="contact-author-button" data-author="${match.targetAuthor}">Contact Author</button>
                </div>
              </li>
            `;
						})
						.join('')}
        </ul>
      </div>
    `;

		this.shadowRoot.querySelectorAll('.view-note-button').forEach(button => {
			button.addEventListener('click', e => {
				const noteId = (e.target as HTMLButtonElement).dataset.noteId;
				if (noteId) {
					this._handleViewNote(noteId);
				}
			});
		});

		this.shadowRoot
			.querySelectorAll('.contact-author-button')
			.forEach(button => {
				button.addEventListener('click', e => {
					const author = (e.target as HTMLButtonElement).dataset.author;
					if (author) {
						this._handleContactAuthor(author);
					}
				});
			});

		this.shadowRoot
			.querySelector('.add-relay-button')
			?.addEventListener('click', this._handleAddRelay.bind(this));
		this.shadowRoot
			.querySelectorAll('.remove-relay-button')
			.forEach(button => {
				button.addEventListener('click', e => {
					const relay = (e.target as HTMLButtonElement).dataset.relay;
					if (relay) {
						this._handleRemoveRelay(relay);
					}
				});
			});
		this.shadowRoot
			.querySelector('.sync-button')
			?.addEventListener('click', this._handleSyncNow.bind(this));
	}
}

customElements.define('notention-network-panel', NetworkPanel);
