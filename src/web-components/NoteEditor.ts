import { useAppStore } from '../store';
import { Note } from '../../shared/types';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SemanticTag } from '../extensions/SemanticTag';

export class NoteEditor extends HTMLElement {
  private note: Note | null = null;
  private editor: Editor | null = null;
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        const params = new URLSearchParams(window.location.search);
        const noteId = params.get('id');
        this.note = noteId ? state.notes[noteId] : null;
        this.render();
      },
      (state) => [state.notes, state.currentNoteId]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.editor?.destroy();
  }

  private _handleInput(event: Event) {
    if (!this.note) return;
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value } = target;
    const updatedNote = { ...this.note, [name]: value };
    useAppStore.getState().updateNote(this.note.id, updatedNote);
  }

  private _initTiptap() {
    const editorElement = this.shadowRoot?.querySelector('.content-editor');
    if (!editorElement || this.editor) return;

    this.editor = new Editor({
      element: editorElement,
      extensions: [StarterKit, SemanticTag],
      content: this.note?.content || '',
      onUpdate: ({ editor }) => {
        if (!this.note) return;
        const updatedNote = { ...this.note, content: editor.getHTML() };
        useAppStore.getState().updateNote(this.note.id, updatedNote);
      },
    });
  }

  private _setupToolbar() {
    this.shadowRoot?.querySelector('.bold-button')?.addEventListener('click', () => this.editor?.chain().focus().toggleBold().run());
    this.shadowRoot?.querySelector('.italic-button')?.addEventListener('click', () => this.editor?.chain().focus().toggleItalic().run());
    this.shadowRoot?.querySelector('.bullet-list-button')?.addEventListener('click', () => this.editor?.chain().focus().toggleBulletList().run());
    this.shadowRoot?.querySelector('.ordered-list-button')?.addEventListener('click', () => this.editor?.chain().focus().toggleOrderedList().run());
    this.shadowRoot?.querySelector('.tag-button')?.addEventListener('click', () => {
      const tag = prompt('Enter tag:');
      if (tag) {
        this.editor?.chain().focus().setSemanticTag(tag).run();
      }
    });
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      .editor-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .title-input {
        font-size: 2em;
        font-weight: bold;
        border: none;
        padding: 8px;
        border-bottom: 1px solid var(--color-border);
      }
      .toolbar {
        display: flex;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid var(--color-border);
      }
      .toolbar button {
        padding: 4px 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: #fff;
        cursor: pointer;
      }
      .content-editor {
        border: 1px solid var(--color-border);
        padding: 8px;
        min-height: 400px;
      }
      .ProseMirror {
        min-height: 400px;
      }
      .ProseMirror:focus {
        outline: none;
      }
      span[data-tag] {
        background-color: #e0f7fa;
        padding: 2px 8px;
        border-radius: 4px;
      }
    `;

    if (!this.note) {
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <div class="editor-container">
          <p>Select a note to edit or create a new one.</p>
        </div>
      `;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="editor-container">
        <input type="text" name="title" class="title-input" value="${this.note.title}" placeholder="Note Title">
        <div class="toolbar">
          <button class="bold-button">Bold</button>
          <button class="italic-button">Italic</button>
          <button class="bullet-list-button">Bullet List</button>
          <button class="ordered-list-button">Ordered List</button>
          <button class="tag-button">Add Tag</button>
        </div>
        <div class="content-editor"></div>
      </div>
    `;

    this.shadowRoot.querySelector('.title-input')?.addEventListener('input', this._handleInput.bind(this));
    this._initTiptap();
    this._setupToolbar();
  }
}

customElements.define('notention-note-editor', NoteEditor);
