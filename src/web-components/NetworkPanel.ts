import { useAppStore } from '../store';
import { Match, NostrEvent, Contact } from '../../shared/types';

export class NetworkPanel extends HTMLElement {
  private matches: Match[] = [];
  private channels: string[] = ['#Notes', '#AI', '#Nostr']; // Placeholder channels
  private directMessages: Contact[] = []; // Placeholder for contacts/DMs
  private activeChannel: string = '#Notes';

  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handleChannelClick = this._handleChannelClick.bind(this);
    this._handleViewNoteClick = this._handleViewNoteClick.bind(this);
    this._handleContactAuthorClick = this._handleContactAuthorClick.bind(this);
    this._handleOpenChatClick = this._handleOpenChatClick.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.matches = Object.values(state.matches).sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());
        this.directMessages = Object.values(state.contacts).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.render(); // Re-render when store state changes
      },
      (state) => [state.matches, state.contacts]
    );
    useAppStore.getState().loadMatches();
    useAppStore.getState().loadContacts();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.removeEventListeners();
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.querySelectorAll('.section-tab-button').forEach(button => {
      button.addEventListener('click', (e) => this._handleChannelClick((e.target as HTMLButtonElement).dataset.channel as string));
    });

    this.shadowRoot.querySelector('.matches-list')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const matchItem = target.closest('.match-item');
      if (matchItem) {
        const noteId = matchItem.dataset.noteId;
        const contactPubkey = matchItem.dataset.contactPubkey;
        if (target.closest('.view-note-button') && noteId) {
          this._handleViewNoteClick(noteId);
        } else if (target.closest('.contact-author-button') && contactPubkey) {
          this._handleContactAuthorClick(contactPubkey);
        }
      }
    });

    this.shadowRoot.querySelector('.dm-list')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const dmItem = target.closest('.dm-item');
      if (dmItem) {
        const contactPubkey = dmItem.dataset.contactPubkey;
        if (target.closest('.open-chat-button') && contactPubkey) {
          this._handleOpenChatClick(contactPubkey);
        }
      }
    });

    this.shadowRoot.querySelectorAll('.channel-tag').forEach(tag => {
      tag.addEventListener('click', (e) => this._handleChannelClick((e.target as HTMLElement).dataset.channel as string));
    });
  }

  private removeEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.querySelectorAll('.section-tab-button').forEach(button => {
      button.removeEventListener('click', (e) => this._handleChannelClick((e.target as HTMLButtonElement).dataset.channel as string));
    });

    this.shadowRoot.querySelector('.matches-list')?.removeEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const matchItem = target.closest('.match-item');
      if (matchItem) {
        const noteId = matchItem.dataset.noteId;
        const contactPubkey = matchItem.dataset.contactPubkey;
        if (target.closest('.view-note-button') && noteId) {
          this._handleViewNoteClick(noteId);
        } else if (target.closest('.contact-author-button') && contactPubkey) {
          this._handleContactAuthorClick(contactPubkey);
        }
      }
    });

    this.shadowRoot.querySelector('.dm-list')?.removeEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const dmItem = target.closest('.dm-item');
      if (dmItem) {
        const contactPubkey = dmItem.dataset.contactPubkey;
        if (target.closest('.open-chat-button') && contactPubkey) {
          this._handleOpenChatClick(contactPubkey);
        }
      }
    });

    this.shadowRoot.querySelectorAll('.channel-tag').forEach(tag => {
      tag.removeEventListener('click', (e) => this._handleChannelClick((e.target as HTMLElement).dataset.channel as string));
    });
  }

  private _handleChannelClick(channel: string) {
    this.activeChannel = channel;
    console.log(`Switched to channel: ${channel}`);
    this.render(); // Re-render to update active tab/channel style
  }

  private _handleViewNoteClick(noteId: string) {
    this.dispatchEvent(new CustomEvent('notention-navigate', {
      detail: { path: `/note?id=${noteId}` },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleContactAuthorClick(pubkey: string) {
    console.log('Contact Author', pubkey);
    // Implement navigation to a DM chat with the author
  }

  private _handleOpenChatClick(pubkey: string) {
    console.log('Open DM with', pubkey);
    // Implement navigation to a specific DM chat
  }

  private _renderMatches(): string {
    if (this.matches.length === 0) {
      return `<p class="no-content-message">No matches found yet. Publish notes or connect to relays to find matches.</p>`;
    }
    return `
      <div class="matches-list">
        ${this.matches.map(match => `
          <div class="match-item" data-note-id="${match.noteId}" data-contact-pubkey="${match.contactPubkey || ''}">
            <div class="match-header">
              <span class="match-type">${match.type} Match</span>
              <span class="match-date">${new Date(match.matchedAt).toLocaleDateString()}</span>
            </div>
            <div class="match-details">
              <p><strong>Note:</strong> ${match.noteTitle || 'Untitled Note'}</p>
              <p><strong>Matched By:</strong> ${match.matchedBy || 'Unknown'}</p>
              <p><strong>Reason:</strong> ${match.reason}</p>
              <notention-button class="view-note-button">View Note</notention-button>
              ${match.contactPubkey ? `
                <notention-button class="contact-author-button">Contact Author</notention-button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private _renderDirectMessages(): string {
    if (this.directMessages.length === 0) {
      return `<p class="no-content-message">No direct messages yet. Add contacts to start chatting.</p>`;
    }
    return `
      <div class="dm-list">
        ${this.directMessages.map(contact => `
          <div class="dm-item" data-contact-pubkey="${contact.pubkey}">
            <div class="dm-header">
              <span class="dm-contact-name">${contact.name || contact.pubkey.substring(0, 8) + '...'}</span>
              <span class="dm-last-message-date">${contact.lastMessageAt ? new Date(contact.lastMessageAt).toLocaleDateString() : ''}</span>
            </div>
            <p class="dm-last-message">${contact.lastMessageContent || 'No messages yet.'}</p>
            <notention-button class="open-chat-button">Open Chat</notention-button>
          </div>
        `).join('')}
      </div>
    `;
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      :host {
        display: flex;
        flex-direction: column;
        padding: 16px;
        background-color: var(--color-background);
        color: var(--color-foreground);
        height: 100%;
        overflow-y: auto;
      }
      .network-header {
        margin-bottom: 16px;
        color: var(--color-primary);
      }
      .section-tabs {
        display: flex;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--color-border);
      }
      .section-tab-button {
        flex: 1;
        padding: 10px 8px;
        border: none;
        background: none;
        cursor: pointer;
        font-weight: bold;
        color: var(--color-muted-foreground);
        transition: color 0.2s, border-bottom 0.2s;
      }
      .section-tab-button.active {
        color: var(--color-primary);
        border-bottom: 2px solid var(--color-primary);
      }
      .channels-section, .matches-section, .dms-section {
        margin-bottom: 20px;
      }
      .channel-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }
      .channel-tag {
        padding: 6px 12px;
        background-color: var(--color-secondary);
        color: var(--color-secondary-foreground);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .channel-tag:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-foreground);
      }
      .matches-list, .dm-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .match-item, .dm-item {
        border: 1px solid var(--color-border);
        padding: 12px;
        border-radius: var(--radius-sm);
        background-color: var(--color-card);
      }
      .match-header, .dm-header {
        display: flex;
        justify-content: space-between;
        font-size: 0.9em;
        color: var(--color-muted-foreground);
        margin-bottom: 8px;
      }
      .match-type {
        font-weight: bold;
        color: var(--color-primary);
      }
      .match-details p, .dm-last-message {
        margin: 5px 0;
      }
      .no-content-message {
        color: var(--color-muted-foreground);
        text-align: center;
        margin-top: 20px;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <h3 class="network-header">Network Panel</h3>

      <div class="section-tabs">
        <button class="section-tab-button ${this.activeChannel === '#Notes' ? 'active' : ''}" data-channel="#Notes">Matches</button>
        <button class="section-tab-button ${this.activeChannel === '#DMs' ? 'active' : ''}" data-channel="#DMs">Direct Messages</button>
      </div>

      ${this.activeChannel === '#Notes' ? `
        <div class="matches-section">
          <h4>Recent Matches</h4>
          ${this._renderMatches()}
        </div>
      ` : `
        <div class="dms-section">
          <h4>Direct Messages</h4>
          ${this._renderDirectMessages()}
        </div>
      `}

      <div class="channels-section">
        <h4>Channels</h4>
        <div class="channel-list">
          ${this.channels.map(channel => `
            <span class="channel-tag" data-channel="${channel}">${channel}</span>
          `).join('')}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }
}

customElements.define('notention-network-panel', NetworkPanel);