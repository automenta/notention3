import { NoteService } from '../services/NoteService.js';
import { Note } from '../../shared/types.js';

class NotesList extends HTMLElement {
  private notes: Note[] = [];

  constructor() {
    super();
    this.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="p-4 border-b border-border">
          <input type="text" placeholder="Search notes..." class="w-full p-2 border rounded-md border-border">
        </div>
        <div class="flex-1 overflow-y-auto">
          <ul id="notes-list">
          </ul>
        </div>
      </div>
    `;
  }

  async connectedCallback() {
    this.notes = await NoteService.getNotes();
    this.render();

    const notesList = this.querySelector('#notes-list');
    if (notesList) {
      notesList.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const noteId = target.closest('li')?.dataset.noteId;
        if (noteId) {
          this.dispatchEvent(
            new CustomEvent('note-selected', {
              detail: { noteId },
              bubbles: true,
              composed: true,
            })
          );
        }
      });
    }
  }

  render() {
    const notesList = this.querySelector('#notes-list');
    if (notesList) {
      notesList.innerHTML = this.notes
        .map(
          (note) => `
            <li class="p-4 border-b border-border" data-note-id="${note.id}">
              <h2 class="font-semibold">${note.title}</h2>
              <p class="text-sm text-muted-foreground">${note.content.substring(0, 100)}</p>
            </li>
          `
        )
        .join('');
    }
  }
}

customElements.define("my-notes-list", NotesList);
