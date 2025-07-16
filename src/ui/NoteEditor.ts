import { useAppStore } from '../store';
import { debounce } from '../lib/utils';
import { Note, NotentionTemplate } from '../../shared/types';
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
	private templates: NotentionTemplate[] = [];
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
				this.templates = Object.values(state.templates);
				this.aiEnabled = state.userProfile?.preferences.aiEnabled ?? false;
				this.render();
			} else {
				this.folders = Object.values(state.folders);
				this.templates = Object.values(state.templates);
				this.aiEnabled = state.userProfile?.preferences.aiEnabled ?? false;
				this.updateFolderOptions();
				this.updateToolbarVisibility();
			}
		});

		const initialState = useAppStore.getState();
		this.note = noteId ? initialState.notes[noteId] : null;
		this.folders = Object.values(initialState.folders);
		this.templates = Object.values(initialState.templates);
		this.aiEnabled =
			initialState.userProfile?.preferences.aiEnabled ?? false;
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
		this.editor?.destroy();
	}

	private _handleInput = debounce((event: Event) => {
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
	}, 500);

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
			onUpdate: debounce(({ editor }) => {
				if (!this.note) return;
				const updatedNote = { ...this.note, content: editor.getHTML() };
				useAppStore.getState().updateNote(this.note.id, updatedNote);
			}, 500),
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
						this.editor?.chain().focus().insertContent(`#${tag}`).run();
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

		const templateSelect = this.shadowRoot?.querySelector(
			'.template-select'
		) as HTMLSelectElement;
		templateSelect?.addEventListener('change', () => {
			const templateId = templateSelect.value;
			const template = this.templates.find(t => t.id === templateId);
			if (template) {
				this.editor?.chain().focus().insertContent(template.content).run();
				templateSelect.value = '';
			}
		});

		this.shadowRoot
			?.querySelector('.autotag-button')
			?.addEventListener('click', async () => {
				if (!this.note || !this.editor) return;
				const content = this.editor.getText();
				const { getAIService } = useAppStore.getState();
				const aiService = getAIService();
				const tags = await aiService.autoTag(content);
				if (tags) {
					this.editor.chain().focus().insertContent(tags.join(' ')).run();
				}
			});

		this.shadowRoot
			?.querySelector('.summarize-button')
			?.addEventListener('click', async () => {
				if (!this.note || !this.editor) return;
				const content = this.editor.getHTML();
				const { getAIService } = useAppStore.getState();
				const aiService = getAIService();
				const summary = await aiService.summarize(content);
				if (summary) {
					this.modal?.setContent(
						'Summary',
						`<p>${summary}</p><br><button class="insert-summary">Insert</button>`,
						() => {}
					);
					this.shadowRoot
						?.querySelector('.insert-summary')
						?.addEventListener('click', () => {
							this.editor?.chain().focus().insertContent(summary).run();
							this.modal?.close();
						});
				}
			});

		this.shadowRoot
			?.querySelector('.delete-note-button')
			?.addEventListener('click', () => {
				if (this.note && confirm('Are you sure you want to delete this note?')) {
					useAppStore.getState().deleteNote(this.note.id);
					this.dispatchEvent(
						new CustomEvent('notention-navigate', {
							detail: { path: '/' },
							bubbles: true,
							composed: true,
						})
					);
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
        align-items: center;
      }
      .toolbar button {
        padding: 4px 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: #fff;
        cursor: pointer;
      }
      .template-select {
        padding: 4px 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: #fff;
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
          <select class="template-select">
            <option value="" disabled selected>Apply Template</option>
            ${this.templates
							.map(
								template => `
              <option value="${template.id}">${template.name}</option>
            `
							)
							.join('')}
          </select>
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
