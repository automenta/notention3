import { useAppStore } from '../store';
import { Folder } from '../../shared/types';
import { FolderService } from '../services/FolderService';

export class FolderManagement extends HTMLElement {
  private folders: Folder[] = [];
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (folders) => {
        this.folders = folders;
        this.render();
      },
      (state) => state.folders
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private _handleCreateFolder() {
    const folderName = prompt('Enter the new folder name:');
    if (folderName) {
      FolderService.createFolder(folderName);
    }
  }

  private _handleRenameFolder(folderId: string) {
    const folder = this.folders.find(f => f.id === folderId);
    if (folder) {
      const newName = prompt('Enter the new name for the folder:', folder.name);
      if (newName) {
        FolderService.renameFolder(folderId, newName);
      }
    }
  }

  private _handleDeleteFolder(folderId: string) {
    if (confirm('Are you sure you want to delete this folder?')) {
      FolderService.deleteFolder(folderId);
    }
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      .folder-management {
        padding: 16px;
      }
      .folder-list {
        list-style: none;
        padding: 0;
      }
      .folder-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }
      .folder-actions button {
        margin-left: 8px;
      }
      .button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="folder-management">
        <h3>Folders</h3>
        <button class="create-folder-button button">New Folder</button>
        <ul class="folder-list">
          ${this.folders
            .map(
              (folder) => `
                <li class="folder-item" data-id="${folder.id}">
                  <span>${folder.name}</span>
                  <div class="folder-actions">
                    <button class="rename-button">Rename</button>
                    <button class="delete-button">Delete</button>
                  </div>
                </li>
              `
            )
            .join('')}
        </ul>
      </div>
    `;

    this.shadowRoot.querySelector('.create-folder-button')?.addEventListener('click', this._handleCreateFolder.bind(this));
    this.shadowRoot.querySelectorAll('.rename-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const folderId = (e.target as HTMLElement).closest('.folder-item')?.dataset.id;
        if (folderId) {
          this._handleRenameFolder(folderId);
        }
      });
    });
    this.shadowRoot.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const folderId = (e.target as HTMLElement).closest('.folder-item')?.dataset.id;
        if (folderId) {
          this._handleDeleteFolder(folderId);
        }
      });
    });
  }
}

customElements.define('notention-folder-management', FolderManagement);
