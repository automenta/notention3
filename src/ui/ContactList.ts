import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { useAppStore } from '../store';
import { Contact } from '../../shared/types';
import './Modal';
import { Modal } from './Modal';
import './Contact';

@customElement('notention-contact-list')
export class ContactList extends LitElement {
	@state()
	private contacts: Contact[] = [];
	private modal: Modal | null = null;
	private unsubscribe: () => void = () => {};

	connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.contacts = state.userProfile?.contacts || [];
			},
			state => [state.userProfile]
		);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.unsubscribe();
	}

	private _handleContactClick(pubkey: string) {
		this.dispatchEvent(
			new CustomEvent('contact-selected', {
				detail: { pubkey },
				bubbles: true,
				composed: true,
			})
		);
	}

	private _handleAddContact() {
		this.modal = this.shadowRoot?.querySelector('notention-modal');
		this.modal?.setContent('Add Contact', 'Public Key', pubkey => {
			if (pubkey) {
				this.modal?.setContent('Add Contact', 'Alias (optional)', alias => {
					useAppStore.getState().addContact({ pubkey, alias: alias || '' });
				});
			}
		});
	}

	private _handleRemoveContact(pubkey: string) {
		if (confirm('Are you sure you want to remove this contact?')) {
			useAppStore.getState().removeContact(pubkey);
		}
	}

	render() {
		return html`
      <div class="contact-list-container">
        <div class="contact-list-header">
          <h3>Contacts</h3>
          <button class="add-contact-button" @click=${this._handleAddContact}>+</button>
        </div>
        <ul class="contact-list">
          ${this.contacts.map(
						contact => html`
              <li @click=${() => this._handleContactClick(contact.pubkey)}>
                <contact-item
                  .contact=${contact}
                  @remove-contact=${(e: CustomEvent) => this._handleRemoveContact(e.detail.pubkey)}
                ></contact-item>
              </li>
            `
					)}
        </ul>
        <notention-modal></notention-modal>
      </div>
    `;
	}

	static styles = css`
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
    li {
      cursor: pointer;
    }
  `;
}
