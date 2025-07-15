import { useAppStore } from '../store';
import { Match } from '../../shared/types';

export class NetworkPanel extends HTMLElement {
  private connected: boolean = false;
  private matches: Match[] = [];
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
        this.render();
      },
      (state) => [state.nostrConnected, state.matches]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
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
          ${this.matches.map(match => `
            <li class="match-item">
              <p class="match-author">From: ${match.targetAuthor}</p>
              <p class="match-similarity">Similarity: ${match.similarity.toFixed(2)}</p>
              <p>Shared Tags: ${match.sharedTags.join(', ')}</p>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }
}

customElements.define('notention-network-panel', NetworkPanel);
