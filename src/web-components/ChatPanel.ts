import { useAppStore } from '../store';
import { DirectMessage } from '../../shared/types';

export class ChatPanel extends HTMLElement {
  private messages: DirectMessage[] = [];
  private contactPubkey: string | null = null;
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['contact-pubkey'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'contact-pubkey') {
      this.contactPubkey = newValue;
      this._updateMessages();
    }
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this._updateMessages();
      },
      (state) => [state.directMessages]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private _updateMessages() {
    if (!this.contactPubkey) {
      this.messages = [];
    } else {
      this.messages = useAppStore.getState().directMessages.filter(
        (dm) => (dm.from === this.contactPubkey && dm.to === useAppStore.getState().userProfile?.nostrPubkey) || (dm.to === this.contactPubkey && dm.from === useAppStore.getState().userProfile?.nostrPubkey)
      );
    }
    this.render();
  }

  private _handleSendMessage() {
    const input = this.shadowRoot?.querySelector('.message-input') as HTMLInputElement;
    if (input && input.value.trim() && this.contactPubkey) {
      useAppStore.getState().sendDirectMessage(this.contactPubkey, input.value.trim());
      input.value = '';
    }
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      .chat-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .message {
        margin-bottom: 8px;
      }
      .message.sent {
        text-align: right;
      }
      .message-content {
        display: inline-block;
        padding: 8px 12px;
        border-radius: 16px;
        background-color: #eee;
      }
      .message.sent .message-content {
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
      }
      .input-container {
        display: flex;
        padding: 16px;
        border-top: 1px solid var(--color-border);
      }
      .message-input {
        flex: 1;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--color-border);
      }
      .send-button {
        margin-left: 8px;
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="chat-panel">
        <div class="messages-container">
          ${this.messages.map(dm => `
            <div class="message ${dm.from === useAppStore.getState().userProfile?.nostrPubkey ? 'sent' : 'received'}">
              <div class="message-content">${dm.content}</div>
            </div>
          `).join('')}
        </div>
        <div class="input-container">
          <input type="text" class="message-input" placeholder="Type a message...">
          <button class="send-button">Send</button>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector('.send-button')?.addEventListener('click', this._handleSendMessage.bind(this));
    this.shadowRoot.querySelector('.message-input')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        this._handleSendMessage();
      }
    });
  }
}

customElements.define('notention-chat-panel', ChatPanel);
