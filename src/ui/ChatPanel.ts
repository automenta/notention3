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
			state => {
				this._updateMessages();
			},
			state => [state.directMessages]
		);
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private _updateMessages() {
		let newMessages: DirectMessage[];
		if (!this.contactPubkey) {
			newMessages = [];
		} else {
			newMessages = useAppStore
				.getState()
				.directMessages.filter(
					dm =>
						(dm.from === this.contactPubkey &&
							dm.to === useAppStore.getState().userProfile?.nostrPubkey) ||
						(dm.to === this.contactPubkey &&
							dm.from === useAppStore.getState().userProfile?.nostrPubkey)
				);
		}

		if (
			JSON.stringify(this.messages) !== JSON.stringify(newMessages)
		) {
			this.messages = newMessages;
			this.render();
			this._scrollToBottom();
		}
	}

	private _scrollToBottom() {
		const container = this.shadowRoot?.querySelector('.messages-container');
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}

	private _handleSendMessage() {
		const input = this.shadowRoot?.querySelector(
			'.message-input'
		) as HTMLInputElement;
		if (input && input.value.trim() && this.contactPubkey) {
			useAppStore
				.getState()
				.sendDirectMessage(this.contactPubkey, input.value.trim());
			input.value = '';
		}
	}

	render() {
		if (!this.shadowRoot) return;

		const contact = useAppStore
			.getState()
			.userProfile?.contacts?.find(c => c.pubkey === this.contactPubkey);
		const contactName =
			contact?.alias || this.contactPubkey?.substring(0, 10) || 'Select a contact';

		const styles = `
      .chat-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--color-background-secondary, #f9f9f9);
      }
      .chat-header {
        padding: 16px;
        font-weight: bold;
        border-bottom: 1px solid var(--color-border, #eee);
        background-color: var(--color-background, #fff);
      }
      .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message {
        display: flex;
        flex-direction: column;
        max-width: 70%;
      }
      .message.sent {
        align-self: flex-end;
        align-items: flex-end;
      }
      .message.received {
        align-self: flex-start;
        align-items: flex-start;
      }
      .message-content {
        padding: 10px 14px;
        border-radius: 18px;
        font-size: 1rem;
        line-height: 1.4;
      }
      .message.sent .message-content {
        background-color: var(--color-primary, #007bff);
        color: var(--color-primary-foreground, #fff);
        border-bottom-right-radius: 4px;
      }
      .message.received .message-content {
        background-color: var(--color-background-tertiary, #e5e5ea);
        color: var(--color-foreground, #333);
        border-bottom-left-radius: 4px;
      }
      .message-timestamp {
        font-size: 0.75rem;
        color: var(--color-foreground-muted, #999);
        margin-top: 4px;
        padding: 0 6px;
      }
      .input-container {
        display: flex;
        padding: 16px;
        border-top: 1px solid var(--color-border, #eee);
        background-color: var(--color-background, #fff);
      }
      .message-input {
        flex: 1;
        padding: 10px 12px;
        border-radius: 20px;
        border: 1px solid var(--color-border, #ccc);
        background-color: var(--color-background-secondary, #f9f9f9);
        font-size: 1rem;
      }
      .message-input:focus {
        outline: none;
        border-color: var(--color-primary, #007bff);
      }
      .send-button {
        margin-left: 10px;
        padding: 10px 16px;
        background-color: var(--color-primary, #007bff);
        color: var(--color-primary-foreground, #fff);
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
      }
      .send-button:hover {
        background-color: var(--color-primary-hover, #0056b3);
      }
      .no-contact-selected {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        color: var(--color-foreground-muted, #999);
      }
    `;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="chat-panel">
        <div class="chat-header">${contactName}</div>
        ${
					this.contactPubkey
						? `
              <div class="messages-container">
                ${this.messages
									.map(
										dm => `
                    <div class="message ${dm.from === useAppStore.getState().userProfile?.nostrPubkey ? 'sent' : 'received'}">
                      <div class="message-content">${dm.content}</div>
                      <div class="message-timestamp">${new Date(dm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  `
									)
									.join('')}
              </div>
              <div class="input-container">
                <input type="text" class="message-input" placeholder="Type a message...">
                <button class="send-button">Send</button>
              </div>
            `
						: `<div class="no-contact-selected">Select a contact to start chatting</div>`
				}
      </div>
    `;

		if (this.contactPubkey) {
			this.shadowRoot
				.querySelector('.send-button')
				?.addEventListener('click', this._handleSendMessage.bind(this));
			this.shadowRoot
				.querySelector('.message-input')
				?.addEventListener('keydown', e => {
					if ((e as KeyboardEvent).key === 'Enter') {
						this._handleSendMessage();
					}
				});

			this._scrollToBottom();
		}
	}
}

customElements.define('notention-chat-panel', ChatPanel);
