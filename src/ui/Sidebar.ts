import { NoteService } from '../services/NoteService.js';
import { useAppStore } from '../store';
import { Folder } from '../../shared/types';
import { routes } from './routes.js';
import './Button.ts'; // Ensure button is imported

export class Sidebar extends HTMLElement {
	private activeTab: string = 'notes';
	private folders: Folder[] = [];
	private activeFolderId: string | undefined = undefined;

	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._handleTabClick = this._handleTabClick.bind(this);
		this._handleNewNote = this._handleNewNote.bind(this);
		this._handleCreateFolder = this._handleCreateFolder.bind(this);
		this._handleFolderClick = this._handleFolderClick.bind(this);
		this._handleEditFolder = this._handleEditFolder.bind(this);
		this._handleDeleteFolder = this._handleDeleteFolder.bind(this);
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				const foldersArray = Object.values(state.folders).sort((a, b) =>
					a.name.localeCompare(b.name)
				);
				this.folders = foldersArray;
				this.activeFolderId = state.searchFilters.folderId;
				this.activeTab = state.sidebarTab;
				this.render(); // Re-render when store state changes
			},
			state => [state.folders, state.searchFilters.folderId, state.sidebarTab]
		);

		this.render();
		this.setupEventListeners();
		useAppStore.getState().loadFolders();
	}

	disconnectedCallback() {
		this.unsubscribe();
		this.removeEventListeners();
	}

	private setupEventListeners() {
		if (!this.shadowRoot) return;

		this.shadowRoot.querySelectorAll('.tab-button').forEach(button => {
			button.addEventListener('click', e =>
				this._handleTabClick(
					(e.target as HTMLButtonElement).dataset.tab as string
				)
			);
		});

		this.shadowRoot
			.querySelector('.new-note-button')
			?.addEventListener('click', this._handleNewNote);
		this.shadowRoot
			.querySelector('.create-folder-button')
			?.addEventListener('click', this._handleCreateFolder);

		// Event delegation for folder items and actions
		this.shadowRoot
			.querySelector('.folder-section')
			?.addEventListener('click', e => {
				const target = e.target as HTMLElement;
				const folderItem = target.closest('.folder-item');
				if (folderItem) {
					const folderId = folderItem.dataset.folderId;
					if (
						target.classList.contains('folder-label') ||
						target.closest('.folder-label')
					) {
						this._handleFolderClick(folderId);
					} else if (target.closest('.edit-folder-button')) {
						const folderName = folderItem.dataset.folderName || '';
						this._handleEditFolder(folderId as string, folderName);
					} else if (target.closest('.delete-folder-button')) {
						const folderName = folderItem.dataset.folderName || '';
						this._handleDeleteFolder(folderId as string, folderName);
					}
				} else if (target.classList.contains('unfiled-notes-item')) {
					this._handleFolderClick(undefined);
				}
			});
	}

	private removeEventListeners() {
		if (!this.shadowRoot) return;

		this.shadowRoot.querySelectorAll('.tab-button').forEach(button => {
			button.removeEventListener('click', e =>
				this._handleTabClick(
					(e.target as HTMLButtonElement).dataset.tab as string
				)
			);
		});

		this.shadowRoot
			.querySelector('.new-note-button')
			?.removeEventListener('click', this._handleNewNote);
		this.shadowRoot
			.querySelector('.create-folder-button')
			?.removeEventListener('click', this._handleCreateFolder);
		this.shadowRoot
			.querySelector('.folder-section')
			?.removeEventListener('click', e => {
				const target = e.target as HTMLElement;
				const folderItem = target.closest('.folder-item');
				if (folderItem) {
					const folderId = folderItem.dataset.folderId;
					if (
						target.classList.contains('folder-label') ||
						target.closest('.folder-label')
					) {
						this._handleFolderClick(folderId);
					} else if (target.closest('.edit-folder-button')) {
						const folderName = folderItem.dataset.folderName || '';
						this._handleEditFolder(folderId as string, folderName);
					} else if (target.closest('.delete-folder-button')) {
						const folderName = folderItem.dataset.folderName || '';
						this._handleDeleteFolder(folderId as string, folderName);
					}
				} else if (target.classList.contains('unfiled-notes-item')) {
					this._handleFolderClick(undefined);
				}
			});
	}

	private _handleTabClick(tab: string) {
		if (tab === 'profile') {
			this.dispatchEvent(
				new CustomEvent('notention-navigate', {
					detail: { path: '/profile' },
					bubbles: true,
					composed: true,
				})
			);
			return;
		}
		useAppStore.getState().setSidebarTab(tab as any);
		const route = routes.find(r => r.title.toLowerCase() === tab);
		if (route) {
			this.dispatchEvent(
				new CustomEvent('notention-navigate', {
					detail: { path: route.path },
					bubbles: true,
					composed: true,
				})
			);
		}
	}

	private _navigateTo(event: Event, path: string) {
		event.preventDefault();
		this.dispatchEvent(
			new CustomEvent('notention-navigate', {
				detail: { path },
				bubbles: true,
				composed: true,
			})
		);
	}

	private async _handleNewNote() {
		const newNote = await NoteService.createNote({});
		this.dispatchEvent(
			new CustomEvent('notention-navigate', {
				detail: { path: `/note?id=${newNote.id}` },
				bubbles: true,
				composed: true,
			})
		);
	}

	private async _handleCreateFolder() {
		const folderSection = this.shadowRoot?.querySelector('.folder-section');
		if (!folderSection) return;

		// Avoid creating multiple input fields
		if (this.shadowRoot?.querySelector('.new-folder-input')) return;

		const inputContainer = document.createElement('div');
		inputContainer.className = 'new-folder-container';
		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = 'New folder name...';
		input.className = 'new-folder-input';
		inputContainer.appendChild(input);

		folderSection.appendChild(inputContainer);
		input.focus();

		const saveOrCancel = async (event: FocusEvent | KeyboardEvent) => {
			if (
				event instanceof KeyboardEvent &&
				event.key !== 'Enter' &&
				event.key !== 'Escape'
			) {
				return;
			}

			const folderName = input.value.trim();
			if (folderName) {
				await useAppStore.getState().createFolder(folderName);
			}

			// The store update will trigger a re-render which will remove the input
		};

		input.addEventListener('blur', saveOrCancel);
		input.addEventListener('keydown', saveOrCancel);
	}

	private _handleFolderClick(folderId: string | undefined) {
		useAppStore.getState().setSearchFilter('folderId', folderId);
		if (this.activeTab !== 'notes') {
			this._handleTabClick('notes');
		}
	}

	private async _handleEditFolder(folderId: string, currentName: string) {
		const folderItem = this.shadowRoot?.querySelector(
			`[data-folder-id="${folderId}"]`
		);
		const folderLabel = folderItem?.querySelector('.folder-label');
		if (!folderLabel) return;

		const input = document.createElement('input');
		input.type = 'text';
		input.value = currentName;
		input.className = 'folder-name-input';

		folderLabel.innerHTML = '';
		folderLabel.appendChild(input);
		input.focus();

		const saveOrCancel = async (event: FocusEvent | KeyboardEvent) => {
			if (
				event instanceof KeyboardEvent &&
				event.key !== 'Enter' &&
				event.key !== 'Escape'
			) {
				return;
			}

			const newName = input.value.trim();
			if (newName && newName !== currentName) {
				await useAppStore.getState().updateFolder(folderId, { name: newName });
			}

			// Re-render to restore the original state display
			this.render();
		};

		input.addEventListener('blur', saveOrCancel);
		input.addEventListener('keydown', saveOrCancel);
	}

	private async _handleDeleteFolder(folderId: string, folderName: string) {
		if (
			confirm(
				`Are you sure you want to delete the folder "${folderName}"?\n\nThis will also unassign all notes within this folder and its subfolders.`
			)
		) {
			await useAppStore.getState().deleteFolder(folderId);
		}
	}

	private _renderFolderTree(
		folders: Folder[],
		parentId: string | undefined = undefined,
		level: number = 0
	): string {
		const childFolders = folders.filter(f => f.parentId === parentId);
		if (childFolders.length === 0) return '';

		return `
      <ul class="folder-list" style="padding-left: ${level * 15}px;">
        ${childFolders
					.map(
						folder => `
          <li class="folder-item ${this.activeFolderId === folder.id ? 'active' : ''}" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
            <div class="folder-label">
              <span class="folder-name">${folder.name}</span>
            </div>
            <div class="folder-actions">
              <button class="icon-button edit-folder-button" title="Edit Folder">
                ✏️
              </button>
              <button class="icon-button delete-folder-button" title="Delete Folder">
                🗑️
              </button>
            </div>
            ${this._renderFolderTree(folders, folder.id, level + 1)}
          </li>
        `
					)
					.join('')}
      </ul>
    `;
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--color-sidebar);
        color: var(--color-sidebar-foreground);
        flex-shrink: 0;
      }
      .header {
        padding: 16px;
        border-bottom: 1px solid var(--color-sidebar-border);
        text-align: center;
        background-color: var(--color-card);
      }
      .header h1 {
        margin: 0;
        font-size: 1.5em;
        color: var(--color-primary);
      }
      .tabs {
        display: flex;
        justify-content: space-around;
        border-bottom: 1px solid var(--color-sidebar-border);
        background-color: var(--color-card);
      }
      .tab-button {
        flex: 1;
        padding: 12px 8px;
        border: none;
        background: none;
        cursor: pointer;
        font-weight: bold;
        color: var(--color-muted-foreground);
        transition: color 0.2s, border-bottom 0.2s;
      }
      .tab-button:hover {
        color: var(--color-primary);
      }
      .tab-button.active {
        color: var(--color-primary);
        border-bottom: 2px solid var(--color-primary);
      }
      .content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .new-note-button, .create-folder-button {
        width: 100%;
        margin-top: 8px;
      }
      .folder-section {
        margin-top: 16px;
      }
      .folder-section h3 {
        margin-top: 0;
        margin-bottom: 10px;
        color: var(--color-sidebar-foreground);
      }
      .folder-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .folder-item {
        padding: 8px;
        cursor: pointer;
        color: var(--color-muted-foreground);
        transition: background-color 0.2s, color 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: var(--radius-sm);
      }
      .folder-item:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-foreground);
      }
      .folder-item.active {
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        font-weight: bold;
      }
      .folder-label {
        flex-grow: 1;
        padding-right: 5px;
      }
      .folder-actions {
        display: none; /* Hidden by default */
      }
      .folder-item:hover .folder-actions {
        display: flex; /* Show on hover */
        gap: 5px;
      }
      .icon-button {
        background: none;
        border: none;
        font-size: 1em;
        cursor: pointer;
        padding: 3px;
        border-radius: var(--radius-sm);
        transition: background-color 0.2s;
        color: inherit;
      }
      .icon-button:hover {
        background-color: rgba(255,255,255,0.2);
      }
      .unfiled-notes-item {
        padding: 8px;
        cursor: pointer;
        color: var(--color-muted-foreground);
        transition: background-color 0.2s, color 0.2s;
        font-weight: normal;
        border-radius: var(--radius-sm);
      }
      .unfiled-notes-item.active {
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        font-weight: bold;
      }
      .folder-name-input, .new-folder-input {
        width: calc(100% - 10px);
        padding: 4px;
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-sm);
        background-color: var(--color-input);
        color: var(--color-foreground);
      }
      .new-folder-container {
        padding: 8px 0;
      }
    `;

		const unfiledNotesActive =
			this.activeFolderId === undefined && this.activeTab === 'notes';

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="header">
        <h1>Notention</h1>
      </div>
      <div class="tabs">
        ${routes
					.filter(r => r.title !== 'Note' && r.path !== '/')
					.map(
						route => `
          <button class="tab-button ${this.activeTab === route.title.toLowerCase() ? 'active' : ''}" data-tab="${route.title.toLowerCase()}">${route.title}</button>
        `
					)
					.join('')}
      </div>
      <div class="content">
        <notention-button class="new-note-button">New Note</notention-button>
        <div class="folder-section">
          <h3>Folders</h3>
          <div class="unfiled-notes-item ${unfiledNotesActive ? 'active' : ''}">
            Unfiled Notes
          </div>
          ${this._renderFolderTree(this.folders, undefined)}
          <notention-button class="create-folder-button">Create New Folder</notention-button>
        </div>
      </div>
    `;

		this.setupEventListeners(); // Re-attach event listeners after re-rendering
	}
}

customElements.define('notention-sidebar', Sidebar);
