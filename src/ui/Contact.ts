import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Contact } from '../../shared/types';

@customElement('contact-item')
export class ContactItem extends LitElement {
  @property({ type: Object })
  contact: Contact | null = null;

  render() {
    if (!this.contact) {
      return html``;
    }

    return html`
      <div class="contact-item">
        <div class="contact-info">
          <span class="contact-alias">${this.contact.alias || 'No alias'}</span>
          <span class="contact-pubkey">${this.contact.pubkey.substring(0, 10)}...</span>
        </div>
        <button class="remove-contact-button" @click=${this._handleRemove}>X</button>
      </div>
    `;
  }

  _handleRemove(e: Event) {
    e.stopPropagation();
    if (this.contact) {
      this.dispatchEvent(
        new CustomEvent('remove-contact', {
          detail: { pubkey: this.contact.pubkey },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  static styles = css`
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
}
