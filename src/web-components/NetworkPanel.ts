import { useAppStore } from '../store';
import { Match, Note } from '../../shared/types';

export class NetworkPanel extends HTMLElement {
  private connected: boolean = false;
  private matches: Match[] = [];
  private notes: { [id: string]: Note } = {};
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.connected = state.nostrConnected;
        this.matches = state.matches;
        this.notes = state.notes;
        this.render();
      },
      (state) => [state.nostrConnected, state.matches, state.notes]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private _handleViewNote(noteId: string) {
    this.dispatchEvent(new CustomEvent('notention-navigate', {
      detail: { path: `/note?id=${noteId}` },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleContactAuthor(author: string) {
    // This will be implemented in a later step
    alert(`Contacting ${author}...`);
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
      .matches-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .match-item {
        padding: 12px;
        border-bottom: 1px solid var(--color-border);
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
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="network-panel">
        <h2>Network</h2>
        <p class="status ${this.connected ? 'connected' : 'disconnected'}">
          Status: ${this.connected ? 'Connected' : 'Disconnected'}
        </p>
        <h3>Matches</h3>
        <ul class="matches-list">
          ${this.matches.map(match => {
            const note = this.notes[match.localNoteId];
            return `
              <li class="match-item">
                <p class="match-author">From: ${match.targetAuthor}</p>
                <p><strong>Matched Note:</strong> ${note?.title || 'Unknown'}</p>
                <p class="match-similarity">Similarity: ${match.similarity.toFixed(2)}</p>
                <p>Shared Tags: ${match.sharedTags.join(', ')}</p>
                <div class="match-actions">
                  <button class="view-note-button" data-note-id="${match.targetNoteId}">View Note</button>
                  <button class="contact-author-button" data-author="${match.targetAuthor}">Contact Author</button>
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;

    this.shadowRoot.querySelectorAll('.view-note-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const noteId = (e.target as HTMLButtonElement).dataset.noteId;
        if (noteId) {
          this._handleViewNote(noteId);
        }
      });
    });

    this.shadowRoot.querySelectorAll('.contact-author-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const author = (e.target as HTMLButtonElement).dataset.author;
        if (author) {
          this._handleContactAuthor(author);
        }
      });
    });
  }
}

customElements.define('notention-network-panel', NetworkPanel);
