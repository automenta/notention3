import './index.css'
import './web-components/Sidebar.ts';
import './web-components/Button.ts';
import './web-components/NoteEditor.ts';
import { NoteService } from './services/NoteService.js';
import { DBService } from './services/db.js';

class App extends HTMLElement {
  private noteEditor: HTMLElement | null = null;

  constructor() {
    super();
    this.innerHTML = `
      <div class="flex min-h-screen bg-background">
        <div class="flex flex-1">
          <div class="flex-1 flex flex-col md:flex-row">
            <div class="w-full md:w-80 border-r border-border">
              <my-sidebar></my-sidebar>
            </div>
            <div class="flex-1 flex flex-col">
              <my-note-editor></my-note-editor>
            </div>
          </div>
        </div>
      </div>
    `;

    this.init();
    this.noteEditor = this.querySelector('my-note-editor');
    this.addEventListener('note-selected', this.handleNoteSelected.bind(this));
  }

  async handleNoteSelected(event: Event) {
    const customEvent = event as CustomEvent;
    const noteId = customEvent.detail.noteId;
    const note = await NoteService.getNote(noteId);
    if (note && this.noteEditor) {
      (this.noteEditor as any).setNote(note);
    }
  }

  async init() {
    // Clear existing notes to avoid duplicates on reload
    await DBService.clearAllData();
    // Create some sample notes
    await NoteService.createNote({ title: 'First Note', content: 'This is the first note.' });
    await NoteService.createNote({ title: 'Second Note', content: 'This is the second note.' });
    await NoteService.createNote({ title: 'Third Note', content: 'This is the third note.' });
  }
}

customElements.define("my-app", App);
