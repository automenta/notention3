import { Folder } from '../../shared/types';
import { useAppStore } from '../store';

export class FolderTree extends HTMLElement {
	private folders: Folder[] = [];
	private activeFolderId: string | undefined = undefined;
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.folders = Object.values(state.folders).sort((a, b) =>
					a.name.localeCompare(b.name)
				);
				this.activeFolderId = state.searchFilters.folderId;
				this.render();
			},
			state => [state.folders, state.searchFilters.folderId]
		);

		this.render();
		this.setupEventListeners();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private setupEventListeners() {
		if (!this.shadowRoot) return;

		if (!this.shadowRoot) return;
		const root = this.shadowRoot;

		root.addEventListener('click', e => {
			const target = e.target as HTMLElement;
			const folderItem = target.closest('.folder-item');

			if (folderItem) {
				const folderId = folderItem.dataset.folderId;
				if (!folderId) return;

				if (
					target.classList.contains('folder-label') ||
					target.closest('.folder-label')
				) {
					this._handleFolderClick(folderId);
				} else if (target.closest('.edit-folder-button')) {
					const folderName = folderItem.dataset.folderName || '';
					this._handleEditFolder(folderId, folderName);
				} else if (target.closest('.delete-folder-button')) {
					const folderName = folderItem.dataset.folderName || '';
					this._handleDeleteFolder(folderId, folderName);
				}
			} else if (target.closest('.unfiled-notes-item')) {
				this._handleFolderClick(undefined);
			} else if (target.closest('.create-folder-button')) {
				this._handleCreateFolder();
			}
		});

		root.addEventListener('dragstart', (e: DragEvent) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('folder-item')) {
				e.dataTransfer?.setData('text/plain', target.dataset.folderId || '');
				target.style.opacity = '0.5';
			}
		});

		root.addEventListener('dragend', (e: DragEvent) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('folder-item')) {
				target.style.opacity = '1';
			}
		});

		root.addEventListener('dragover', (e: DragEvent) => {
			e.preventDefault();
			const target = e.target as HTMLElement;
			const dropTarget = target.closest('.folder-item');
			if (dropTarget) {
				dropTarget.classList.add('drag-over');
			}
		});

		root.addEventListener('dragleave', (e: DragEvent) => {
			const target = e.target as HTMLElement;
			const dropTarget = target.closest('.folder-item');
			if (dropTarget) {
				dropTarget.classList.remove('drag-over');
			}
		});

		root.addEventListener('drop', async (e: DragEvent) => {
			e.preventDefault();
			const target = e.target as HTMLElement;
			const dropTarget = target.closest('.folder-item');
			if (dropTarget) {
				dropTarget.classList.remove('drag-over');
				const draggedFolderId = e.dataTransfer?.getData('text/plain');
				const targetFolderId = dropTarget.dataset.folderId;

				if (draggedFolderId && targetFolderId && draggedFolderId !== targetFolderId) {
					await useAppStore
						.getState()
						.updateFolder(draggedFolderId, { parentId: targetFolderId });
				}
			}
		});
	}

	private _handleFolderClick(folderId: string | undefined) {
		useAppStore.getState().setSearchFilter('folderId', folderId);
		if (useAppStore.getState().sidebarTab !== 'notes') {
			this.dispatchEvent(
				new CustomEvent('notention-sidebar-tab-click', {
					detail: { tab: 'notes' },
					bubbles: true,
					composed: true,
				})
			);
		}
	}

	private async _handleCreateFolder() {
		const folderSection = this.shadowRoot?.querySelector('.folder-section');
		if (!folderSection) return;

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
		};

		input.addEventListener('blur', saveOrCancel);
		input.addEventListener('keydown', saveOrCancel);
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
			} else {
				this.render();
			}
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
          <li class="folder-item ${this.activeFolderId === folder.id ? 'active' : ''}" data-folder-id="${folder.id}" data-folder-name="${folder.name}" draggable="true">
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
      .folder-item.drag-over {
        background-color: var(--color-primary-light);
        border: 2px dashed var(--color-primary);
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
      .create-folder-button {
        width: 100%;
        margin-top: 8px;
      }
    `;

		const unfiledNotesActive = this.activeFolderId === undefined;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="folder-section">
        <h3>Folders</h3>
        <div class="unfiled-notes-item ${unfiledNotesActive ? 'active' : ''}">
          Unfiled Notes
        </div>
        ${this._renderFolderTree(this.folders, undefined)}
        <notention-button class="create-folder-button">Create New Folder</notention-button>
      </div>
    `;
	}
}

customElements.define('notention-folder-tree', FolderTree);
