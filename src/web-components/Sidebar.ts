import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { NoteService } from '../services/NoteService.js';

@customElement('notention-sidebar')
export class Sidebar extends LitElement {
  @property({ type: String }) activeTab: string = 'notes';

  private _handleTabClick(tab: string) {
    this.activeTab = tab;
    let path = '/notes';
    if (tab === 'ontology') {
      path = '/ontology';
    } else if (tab === 'network') {
      path = '/network';
    } else if (tab === 'settings') {
      path = '/settings';
    }
    this.dispatchEvent(new CustomEvent('notention-navigate', {
      detail: { path: path },
      bubbles: true,
      composed: true,
    }));
  }

  private async _handleNewNote() {
    const newNote = await NoteService.createNote({});
    this.dispatchEvent(new CustomEvent('notention-navigate', {
      detail: { path: `/note?id=${newNote.id}` },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid #eee;
        }
        .header {
          padding: 16px;
          border-bottom: 1px solid #eee;
          text-align: center;
        }
        .tabs {
          display: flex;
          justify-content: space-around;
          border-bottom: 1px solid #eee;
        }
        .tab-button {
          flex: 1;
          padding: 12px 8px;
          border: none;
          background: none;
          cursor: pointer;
          font-weight: bold;
          color: #555;
        }
        .tab-button.active {
          color: #007bff;
          border-bottom: 2px solid #007bff;
        }
        .content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .new-note-button {
          width: calc(100% - 32px);
          margin: 16px;
        }
      </style>
      <div class="header">
        <h1>Notention</h1>
      </div>
      <div class="tabs">
        <button class="tab-button ${this.activeTab === 'notes' ? 'active' : ''}" @click="${() => this._handleTabClick('notes')}">Notes</button>
        <button class="tab-button ${this.activeTab === 'ontology' ? 'active' : ''}" @click="${() => this._handleTabClick('ontology')}">Ontology</button>
        <button class="tab-button ${this.activeTab === 'network' ? 'active' : ''}" @click="${() => this._handleTabClick('network')}">Network</button>
        <button class="tab-button ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => this._handleTabClick('settings')}">Settings</button>
      </div>
      <notention-button class="new-note-button" @click="${this._handleNewNote}">New Note</notention-button>
      <div class="content">
        ${this.activeTab === 'notes' ? html`<notention-notes-list></notention-notes-list>` : html``}
        ${this.activeTab === 'ontology' ? html`<notention-ontology-editor></notention-ontology-editor>` : html``}
        ${this.activeTab === 'network' ? html`<notention-network-panel></notention-network-panel>` : html``}
        ${this.activeTab === 'settings' ? html`<notention-settings></notention-settings>` : html``}
      </div>
    `;
  }
}
