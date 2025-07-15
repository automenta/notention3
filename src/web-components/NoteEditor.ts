import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Link from '@tiptap/extension-link';
import { useAppStore } from '../store';
import { Note, Folder } from '../../shared/types';

export class NoteEditor extends HTMLElement {
  private _noteId: string | undefined;
  private note: Note | undefined;
  private folders: Folder[] = [];

  private editor: Editor | undefined;
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['note-id'];
  }

  attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    if (name === 'note-id') {
      this._noteId = newVal;
      this.updateNoteAndEditor();
    }
  }

  get noteId(): string | undefined {
    return this._noteId;
  }

  set noteId(value: string | undefined) {
    if (this._noteId !== value) {
      this._noteId = value;
      this.setAttribute('note-id', value || '');
      this.updateNoteAndEditor();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.note = this._noteId ? state.notes[this._noteId] : undefined;
        this.folders = Object.values(state.folders).sort((a, b) => a.name.localeCompare(b.name));
        this.updateEditorContent();
        this.render(); // Re-render to update folder select and title
      },
      (state) => [state.notes, state.folders]
    );

    useAppStore.getState().loadNotes();
    useAppStore.getState().loadFolders();

    this.initializeEditor();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.editor?.destroy();
    this.removeEventListeners();
  }

  private initializeEditor() {
    const editorContainer = this.shadowRoot?.querySelector('#editor-content') as HTMLElement;
    if (editorContainer) {
      this.editor = new Editor({
        element: editorContainer,
        extensions: [
          StarterKit,
          Bold,
          Italic,
          BulletList,
          OrderedList,
          ListItem,
          Link.configure({
            autolink: true,
            linkOnPaste: true,
            openOnClick: false,
          }),
        ],
        content: this.note?.content || '',
        onUpdate: ({ editor }) => {
          if (this._noteId) {
            useAppStore.getState().updateNote(this._noteId, { content: editor.getHTML() });
          }
          this.renderToolbarState(); // Update toolbar buttons
        },
      });
      this.renderToolbarState(); // Initial toolbar state
    }
  }

  private updateNoteAndEditor() {
    this.note = this._noteId ? useAppStore.getState().notes[this._noteId] : undefined;
    this.updateEditorContent();
    this.render(); // Re-render to update title and folder select
  }

  private updateEditorContent() {
    if (this.editor) {
      const newContent = this.note?.content || '';
      if (this.editor.getHTML() !== newContent) {
        this.editor.commands.setContent(newContent, false);
      }
    }
  }

  private setupEventListeners() {
    this.shadowRoot?.querySelector('.note-title-input')?.addEventListener('input', this._handleTitleInput.bind(this));
    this.shadowRoot?.querySelector('.folder-select')?.addEventListener('change', this._handleFolderChange.bind(this));
    this.shadowRoot?.querySelector('.editor-toolbar')?.addEventListener('click', this._handleToolbarClick.bind(this));
  }

  private removeEventListeners() {
    this.shadowRoot?.querySelector('.note-title-input')?.removeEventListener('input', this._handleTitleInput.bind(this));
    this.shadowRoot?.querySelector('.folder-select')?.removeEventListener('change', this._handleFolderChange.bind(this));
    this.shadowRoot?.querySelector('.editor-toolbar')?.removeEventListener('click', this._handleToolbarClick.bind(this));
  }

  private _handleTitleInput(e: Event) {
    if (this._noteId) {
      useAppStore.getState().updateNote(this._noteId, { title: (e.target as HTMLInputElement).value });
    }
  }

  private _handleFolderChange(e: Event) {
    const selectedFolderId = (e.target as HTMLSelectElement).value;
    const folderId = selectedFolderId === 'unfiled' ? undefined : selectedFolderId;
    if (this._noteId) {
      useAppStore.getState().moveNoteToFolder(this._noteId, folderId);
    }
  }

  private _handleToolbarClick(e: Event) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('toolbar-button')) {
      const action = target.dataset.action;
      switch (action) {
        case 'bold':
          this.editor?.chain().focus().toggleBold().run();
          break;
        case 'italic':
          this.editor?.chain().focus().toggleItalic().run();
          break;
        case 'bulletList':
          this.editor?.chain().focus().toggleBulletList().run();
          break;
        case 'orderedList':
          this.editor?.chain().focus().toggleOrderedList().run();
          break;
        case 'link':
          this._setLink();
          break;
        // Add cases for other buttons as they are implemented
      }
    }
  }

  private renderToolbarState() {
    if (!this.editor || !this.shadowRoot) return;
    const buttons = this.shadowRoot.querySelectorAll('.toolbar-button');
    buttons.forEach(button => {
      const action = (button as HTMLElement).dataset.action;
      if (action) {
        if (this.editor?.isActive(action)) {
          button.classList.add('is-active');
        } else {
          button.classList.remove('is-active');
        }
      }
    });
  }

  private _setLink() {
    const url = prompt('Enter URL:', this.editor?.getAttributes('link').href);
    if (url === null) {
      return;
    }
    if (url === '') {
      this.editor?.chain().focus().unsetLink().run();
      return;
    }
    this.editor?.chain().focus().setLink({ href: url }).run();
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      :host {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background-color: var(--color-background);
        color: var(--color-foreground);
        padding: 16px;
        gap: 10px;
      }
      .note-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .note-title-input {
        flex-grow: 1;
        padding: 8px;
        font-size: 1.2em;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background-color: var(--color-input);
        color: var(--color-foreground);
      }
      .folder-select {
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background-color: var(--color-input);
        color: var(--color-foreground);
      }
      .editor-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
        padding: 5px;
        border-bottom: 1px solid var(--color-border);
      }
      .toolbar-button {
        background-color: var(--color-secondary);
        color: var(--color-secondary-foreground);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 5px 10px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .toolbar-button:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-foreground);
      }
      .toolbar-button.is-active {
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
      }
      #editor-content {
        flex-grow: 1;
        min-height: 150px;
        outline: none;
        border: 1px solid var(--color-border);
        padding: 10px;
        border-radius: var(--radius-sm);
        background-color: var(--color-background);
      }
      #editor-content .ProseMirror {
        min-height: 150px;
        outline: none;
      }
    `;

    const folderOptions = this.folders.map(folder => `
      <option value="${folder.id}" ${this.note?.folderId === folder.id ? 'selected' : ''}>${folder.name}</option>
    `).join('');

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="note-header">
        <input
          type="text"
          class="note-title-input"
          placeholder="Note Title"
          value="${this.note?.title || ''}"
        >
        <select class="folder-select">
          <option value="unfiled" ${this.note?.folderId === undefined ? 'selected' : ''}>Unfiled</option>
          ${folderOptions}
        </select>
      </div>
      <div class="editor-toolbar">
        <button class="toolbar-button" data-action="bold">Bold</button>
        <button class="toolbar-button" data-action="italic">Italic</button>
        <button class="toolbar-button" data-action="bulletList">Bullet List</button>
        <button class="toolbar-button" data-action="orderedList">Ordered List</button>
        <button class="toolbar-button" data-action="link">Link</button>
        <!-- Placeholder for semantic elements and AI buttons -->
        <button class="toolbar-button">#Tag</button>
        <button class="toolbar-button">Value::</button>
        <button class="toolbar-button">Template</button>
        <button class="toolbar-button">AI Suggest</button>
        <button class="toolbar-button">Auto-tag</button>
        <button class="toolbar-button">Summarize</button>
      </div>
      <div id="editor-content"></div>
    `;

    // Re-attach event listeners after re-rendering
    this.setupEventListeners();
    this.renderToolbarState();
  }
}

customElements.define('notention-note-editor', NoteEditor);
