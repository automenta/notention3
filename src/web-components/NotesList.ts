import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-notes-list')
export class NotesList extends LitElement {
  @property({ type: Array }) notes: any[] = []; // Placeholder for notes data

  render() {
    return html`
      <style>
        :host {
          display: block;
          padding: 16px;
        }
        .search-input {
          width: 100%;
          padding: 8px;
          margin-bottom: 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .note-item {
          border: 1px solid #eee;
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .note-item:hover {
          background-color: #f9f9f9;
        }
        .note-title {
          font-weight: bold;
        }
        .note-date {
          font-size: 0.8em;
          color: #666;
        }
      </style>
      <input type="text" class="search-input" placeholder="Search notes...">
      <div class="notes-container">
        ${this.notes.length === 0
          ? html`<p>No notes found.</p>`
          : this.notes.map(note => html`
              <div class="note-item">
                <div class="note-title">${note.title || 'Untitled'}</div>
                <div class="note-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
              </div>
            `)}
      </div>
    `;
  }
}