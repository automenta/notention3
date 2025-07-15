import { Note } from '../../shared/types';
import { NoteService } from '../services/NoteService.js';

class NoteEditor extends HTMLElement {
  private titleInput: HTMLInputElement | null = null;
  private contentTextarea: HTMLTextAreaElement | null = null;
  private currentNote: Note | null = null;

  constructor() {
    super();
    this.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="p-4 border-b border-border">
          <input type="text" placeholder="Note title" class="w-full p-2 border-0 text-lg font-semibold" id="note-title">
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <textarea placeholder="Write your note here..." class="w-full h-full p-2 border-0 resize-none" id="note-content"></textarea>
        </div>
      </div>
    `;

    this.titleInput = this.querySelector('#note-title');
    this.contentTextarea = this.querySelector('#note-content');

    this.titleInput?.addEventListener('input', () => this.saveNote());
    this.contentTextarea?.addEventListener('input', () => this.saveNote());
  }

  setNote(note: Note) {
    this.currentNote = note;
    if (this.titleInput) {
      this.titleInput.value = note.title;
    }
    if (this.contentTextarea) {
      this.contentTextarea.value = note.content;
    }
  }

  async saveNote() {
    if (this.currentNote && this.titleInput && this.contentTextarea) {
      const updatedNote: Note = {
        ...this.currentNote,
        title: this.titleInput.value,
        content: this.contentTextarea.value,
      };
      await NoteService.saveNote(updatedNote);
    }
  }
}

customElements.define("my-note-editor", NoteEditor);
