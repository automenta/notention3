import { useAppStore } from '../store';
import { Note } from '../../shared/types';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SemanticTag } from '../extensions/SemanticTag';
import Mention from '@tiptap/extension-mention';
import { suggestion } from '../lib/suggestion';
import tippy from 'tippy.js';

import { Folder } from '../../shared/types';
import './Modal';
import { Modal } from './Modal';

export class NoteEditor extends HTMLElement {
	private note: Note | null = null;
	private editor: Editor | null = null;
	private folders: Folder[] = [];
	private modal: Modal | null = null;
	private unsubscribe: () => void = () => {};
	private aiEnabled = false;

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		const params = new URLSearchParams(window.location.search);
		const noteId = params.get('id');

		this.unsubscribe = useAppStore.subscribe(state => {
			const newNote = noteId ? state.notes[noteId] : null;
			if (newNote?.id !== this.note?.id) {
				this.note = newNote;
				this.folders = Object.values(state.folders);
				this.aiEnabled = state.userProfile?.preferences.aiEnabled ?? false;
				this.render();
			} else {
				this.folders = Object.values(state.folders);
				this.aiEnabled = state.userProfile?.preferences.aiEnabled ?? false;
				this.updateFolderOptions();
				this.updateToolbarVisibility();
			}
		});

		const initialState = useAppStore.getState();
		this.note = noteId ? initialState.notes[noteId] : null;
		this.folders = Object.values(initialState.folders);
		this.aiEnabled =
			initialState.userProfile?.preferences.aiEnabled ?? false;
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
		this.editor?.destroy();
	}

	private _handleInput(event: Event) {
		if (!this.note) return;
		const target = event.target as
			| HTMLInputElement
			| HTMLTextAreaElement
			| HTMLSelectElement;
		const { name, value } = target;

		if (name === 'folderId') {
			const updatedNote = { ...this.note, folderId: value };
			useAppStore.getState().updateNote(this.note.id, updatedNote);
		} else {
			const updatedNote = { ...this.note, [name]: value };
			useAppStore.getState().updateNote(this.note.id, updatedNote);
		}
	}

	private updateFolderOptions() {
		const select = this.shadowRoot?.querySelector(
			'.folder-select'
		) as HTMLSelectElement;
		if (!select) return;

		// Preserve the current value
		const currentValue = select.value;

		// Clear existing options
		select.innerHTML = '<option value="">Unfiled</option>';

		// Add new options
		this.folders.forEach(folder => {
			const option = document.createElement('option');
			option.value = folder.id;
			option.textContent = folder.name;
			if (this.note?.folderId === folder.id) {
				option.selected = true;
			}
			select.appendChild(option);
		});

		// Restore the selected value if it still exists
		select.value = currentValue;
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
		this.shadowRoot
			?.querySelector('.bold-button')
			?.addEventListener('click', () =>
				this.editor?.chain().focus().toggleBold().run()
			);
		this.shadowRoot
			?.querySelector('.italic-button')
			?.addEventListener('click', () =>
				this.editor?.chain().focus().toggleItalic().run()
			);
		this.shadowRoot
			?.querySelector('.bullet-list-button')
			?.addEventListener('click', () =>
				this.editor?.chain().focus().toggleBulletList().run()
			);
		this.shadowRoot
			?.querySelector('.ordered-list-button')
			?.addEventListener('click', () =>
				this.editor?.chain().focus().toggleOrderedList().run()
			);
		this.shadowRoot
			?.querySelector('.tag-button')
			?.addEventListener('click', () => {
				this.modal?.setContent('Add Tag', 'Tag', tag => {
					if (tag) {
						this.editor?.chain().focus().setSemanticTag(tag).run();
					}
				});
			});
		this.shadowRoot
			?.querySelector('.key-value-button')
			?.addEventListener('click', () => {
				this.modal?.setContent('Add Key-Value', 'Key', key => {
					if (!key) return;
					this.modal?.setContent('Add Key-Value', 'Value', value => {
						if (value) {
							this.editor
								?.chain()
								.focus()
								.insertContent(`${key}::${value}`)
								.run();
						}
					});
				});
			});
		this.shadowRoot
			?.querySelector('.template-button')
			?.addEventListener('click', () => {
				// For templates, a dropdown or a more complex modal would be better.
				// For now, we'll keep the prompt to avoid overcomplicating this step.
				const template = prompt(
					'Select a template:\n1. Meeting Note\n2. Todo List'
				);
				if (template === '1') {
					this.editor
						?.chain()
						.focus()
						.insertContent(
							'<h2>Meeting Note</h2><p><strong>Date:</strong></p><p><strong>Attendees:</strong></p><p><strong>Agenda:</strong></p><p><strong>Notes:</strong></p>'
						)
						.run();
				} else if (template === '2') {
					this.editor
						?.chain()
						.focus()
						.insertContent('<h2>Todo List</h2><ul><li><p></p></li></ul>')
						.run();
				}
			});

		this.shadowRoot
			?.querySelector('.autotag-button')
			?.addEventListener('click', async () => {
				if (!this.note || !this.editor) return;
				const content = this.editor.getText();
				const { autoTag } = useAppStore.getState().getAIService();
				const tags = await autoTag(content);
				if (tags) {
					this.editor.chain().focus().setSemanticTag(tags.join(' ')).run();
				}
			});

		this.shadowRoot
			?.querySelector('.summarize-button')
			?.addEventListener('click', async () => {
				if (!this.note || !this.editor) return;
				const content = this.editor.getHTML();
				const { summarize } = useAppStore.getState().getAIService();
				const summary = await summarize(content);
				if (summary) {
					// for now, just append to the note
					this.editor.chain().focus().insertContent(summary).run();
				}
			});
	}

	private updateToolbarVisibility() {
		const autotagButton = this.shadowRoot?.querySelector(
			'.autotag-button'
		) as HTMLElement;
		const summarizeButton = this.shadowRoot?.querySelector(
			'.summarize-button'
		) as HTMLElement;

		if (autotagButton) {
			autotagButton.style.display = this.aiEnabled ? 'inline-block' : 'none';
		}
		if (summarizeButton) {
			summarizeButton.style.display = this.aiEnabled ? 'inline-block' : 'none';
		}
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      .editor-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .note-header {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .title-input {
        flex-grow: 1;
        font-size: 2em;
        font-weight: bold;
        border: none;
        padding: 8px;
        border-bottom: 1px solid var(--color-border);
      }
      .folder-select {
        padding: 8px;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        background-color: var(--color-input);
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
        <div class="note-header">
          <input type="text" name="title" class="title-input" value="${this.note.title}" placeholder="Note Title">
          <select name="folderId" class="folder-select">
            <option value="">Unfiled</option>
            ${this.folders
							.map(
								folder => `
              <option value="${folder.id}" ${this.note?.folderId === folder.id ? 'selected' : ''}>
                ${folder.name}
              </option>
            `
							)
							.join('')}
          </select>
        </div>
        <div class="toolbar">
          <button class="bold-button">Bold</button>
          <button class="italic-button">Italic</button>
          <button class="bullet-list-button">Bullet List</button>
          <button class="ordered-list-button">Ordered List</button>
          <button class="tag-button">Add Tag</button>
          <button class="key-value-button">Add Key-Value</button>
          <button class="template-button">Apply Template</button>
          <button class="autotag-button" style="display: none;">Auto-tag</button>
          <button class="summarize-button" style="display: none;">Summarize</button>
        </div>
        <div class="content-editor"></div>
        <notention-modal></notention-modal>
      </div>
    `;

		this.modal = this.shadowRoot.querySelector('notention-modal');
		this.shadowRoot
			.querySelector('.title-input')
			?.addEventListener('input', this._handleInput.bind(this));
		this.shadowRoot
			.querySelector('.folder-select')
			?.addEventListener('change', this._handleInput.bind(this));
		this._initTiptap();
		this._setupToolbar();
		this.updateToolbarVisibility();
	}
}

customElements.define('notention-note-editor', NoteEditor);
