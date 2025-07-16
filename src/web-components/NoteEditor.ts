import { useAppStore } from '../store';
import { Note } from '../../shared/types';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SemanticTag } from '../extensions/SemanticTag';
import Mention from '@tiptap/extension-mention';
import { suggestion } from '../lib/suggestion';
import tippy from 'tippy.js';

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
      extensions: [
        StarterKit,
        SemanticTag,
        Mention.configure({
          HTMLAttributes: {
            class: 'mention',
          },
          suggestion: suggestion(this.shadowRoot as ShadowRoot),
        }),
      ],
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
    this.shadowRoot?.querySelector('.key-value-button')?.addEventListener('click', () => {
      const key = prompt('Enter key:');
      if (!key) return;
      const value = prompt('Enter value:');
      if (value) {
        this.editor?.chain().focus().insertContent(`${key}::${value}`).run();
      }
    });
    this.shadowRoot?.querySelector('.template-button')?.addEventListener('click', () => {
      const template = prompt('Select a template:\n1. Meeting Note\n2. Todo List');
      if (template === '1') {
        this.editor?.chain().focus().insertContent('<h2>Meeting Note</h2><p><strong>Date:</strong></p><p><strong>Attendees:</strong></p><p><strong>Agenda:</strong></p><p><strong>Notes:</strong></p>').run();
      } else if (template === '2') {
        this.editor?.chain().focus().insertContent('<h2>Todo List</h2><ul><li><p></p></li></ul>').run();
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
      .mention {
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
          <button class="key-value-button">Add Key-Value</button>
          <button class="template-button">Apply Template</button>
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
