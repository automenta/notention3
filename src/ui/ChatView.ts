import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ContactList';
import './ChatPanel';

@customElement('notention-chat-view')
export class ChatView extends LitElement {
  @property({ type: String })
  private selectedContactPubkey: string | null = null;

  static styles = css`
    :host {
      display: flex;
      height: 100%;
    }
    notention-contact-list {
      width: 300px;
      border-right: 1px solid var(--color-border);
    }
    notention-chat-panel {
      flex: 1;
    }
  `;

  private handleContactSelected(e: CustomEvent) {
    this.selectedContactPubkey = e.detail.pubkey;
  }

  render() {
    return html`
      <notention-contact-list @contact-selected=${this.handleContactSelected}></notention-contact-list>
      <notention-chat-panel contact-pubkey=${this.selectedContactPubkey}></notention-chat-panel>
    `;
  }
}
