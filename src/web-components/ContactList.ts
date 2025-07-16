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
      (state) => {
        this.contacts = state.userProfile?.contacts || [];
        this.render();
      },
      (state) => [state.userProfile]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private _handleContactClick(pubkey: string) {
    this.dispatchEvent(new CustomEvent('notention-navigate', {
      detail: { path: `/chat?contact-pubkey=${pubkey}` },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleAddContact() {
    const pubkey = prompt('Enter contact public key:');
    if (pubkey) {
      const alias = prompt('Enter alias (optional):');
      useAppStore.getState().addContact({ pubkey, alias: alias || '' });
    }
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      .contact-list-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .contact-list {
        list-style: none;
        padding: 0;
      }
      .contact-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        cursor: pointer;
      }
      .contact-item:hover {
        background-color: #eee;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="contact-list-container">
        <h3>Contacts</h3>
        <ul class="contact-list">
          ${this.contacts.map(contact => `
            <li class="contact-item" data-pubkey="${contact.pubkey}">
              <span>${contact.alias || contact.pubkey}</span>
            </li>
          `).join('')}
        </ul>
        <button class="add-contact-button">Add Contact</button>
      </div>
    `;

    this.shadowRoot.querySelectorAll('.contact-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const pubkey = (e.currentTarget as HTMLElement).dataset.pubkey;
        if (pubkey) {
          this._handleContactClick(pubkey);
        }
      });
    });

    this.shadowRoot.querySelector('.add-contact-button')?.addEventListener('click', this._handleAddContact.bind(this));
  }
}

customElements.define('notention-contact-list', ContactList);
