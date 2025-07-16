import { useAppStore } from '../store';
import { Contact } from '../../shared/types';

export class ContactList extends HTMLElement {
	private contacts: Contact[] = [];
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.contacts = state.userProfile?.contacts || [];
				this.render();
			},
			state => [state.userProfile]
		);
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private _handleContactClick(pubkey: string) {
		// This will be handled by the parent component
		this.dispatchEvent(
			new CustomEvent('contact-selected', {
				detail: { pubkey },
				bubbles: true,
				composed: true,
			})
		);
	}

	private _handleAddContact() {
		const pubkey = prompt('Enter contact public key:');
		if (pubkey) {
			const alias = prompt('Enter alias (optional):');
			useAppStore.getState().addContact({ pubkey, alias: alias || '' });
		}
	}

	private _handleRemoveContact(pubkey: string) {
		if (confirm('Are you sure you want to remove this contact?')) {
			useAppStore.getState().removeContact(pubkey);
		}
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      .contact-list-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
      .contact-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .add-contact-button {
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        font-size: 24px;
        cursor: pointer;
      }
      .contact-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .contact-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        cursor: pointer;
        border-radius: 8px;
        transition: background-color 0.2s;
      }
      .contact-item:hover {
        background-color: var(--color-background-secondary);
      }
      .contact-info {
        display: flex;
        flex-direction: column;
      }
      .contact-alias {
        font-weight: bold;
      }
      .contact-pubkey {
        font-size: 0.8rem;
        color: var(--color-foreground-muted);
      }
      .remove-contact-button {
        background: none;
        border: none;
        color: var(--color-danger);
        cursor: pointer;
        font-size: 16px;
      }
    `;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="contact-list-container">
        <div class="contact-list-header">
          <h3>Contacts</h3>
          <button class="add-contact-button">+</button>
        </div>
        <ul class="contact-list">
          ${this.contacts
						.map(
							contact => `
            <li class="contact-item" data-pubkey="${contact.pubkey}">
              <div class="contact-info">
                <span class="contact-alias">${contact.alias || 'No alias'}</span>
                <span class="contact-pubkey">${contact.pubkey.substring(0, 10)}...</span>
              </div>
              <button class="remove-contact-button" data-pubkey="${contact.pubkey}">X</button>
            </li>
          `
						)
						.join('')}
        </ul>
      </div>
    `;

		this.shadowRoot.querySelectorAll('.contact-item').forEach(item => {
			item.addEventListener('click', e => {
				// prevent the remove button from triggering the contact click
				if ((e.target as HTMLElement).classList.contains('remove-contact-button')) {
					return;
				}
				const pubkey = (e.currentTarget as HTMLElement).dataset.pubkey;
				if (pubkey) {
					this._handleContactClick(pubkey);
				}
			});
		});

		this.shadowRoot.querySelectorAll('.remove-contact-button').forEach(button => {
			button.addEventListener('click', e => {
				const pubkey = (e.currentTarget as HTMLElement).dataset.pubkey;
				if (pubkey) {
					this._handleRemoveContact(pubkey);
				}
			});
		});

		this.shadowRoot
			.querySelector('.add-contact-button')
			?.addEventListener('click', this._handleAddContact.bind(this));
	}
}

customElements.define('notention-contact-list', ContactList);
