import { NoteService } from '../services/NoteService.js';
import { useAppStore } from '../store';
import { routes } from './routes.js';
import './Button.ts';
import './FolderTree.ts';

export class Sidebar extends HTMLElement {
	private activeTab: string = 'notes';

	private unsubscribe: () => void = () => {};

	// Bound event handlers
	private _boundHandleTabClick: (e: Event) => void;
	private _boundHandleNewNote: (e: Event) => void;
	private _boundSidebarTabClick: (e: Event) => void;

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		// Bind methods to 'this'
		this._boundHandleTabClick = this._handleTabClick.bind(this);
		this._boundHandleNewNote = this._handleNewNote.bind(this);
		this._boundSidebarTabClick = this._handleSidebarTabClick.bind(this);
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.activeTab = state.sidebarTab;
				this.render(); // Re-render when store state changes
			},
			state => state.sidebarTab
		);

		this.render();
		useAppStore.getState().loadFolders();

		this.addEventListener(
			'notention-sidebar-tab-click',
			this._boundSidebarTabClick
		);
	}

	disconnectedCallback() {
		this.unsubscribe();
		this.removeEventListeners();
		this.removeEventListener(
			'notention-sidebar-tab-click',
			this._boundSidebarTabClick
		);
	}

	private setupEventListeners() {
		if (!this.shadowRoot) return;

		this.shadowRoot.querySelectorAll('.tab-button').forEach(button => {
			button.addEventListener('click', this._boundHandleTabClick);
		});

		this.shadowRoot
			.querySelector('.new-note-button')
			?.addEventListener('click', this._boundHandleNewNote);
	}

	private removeEventListeners() {
		if (!this.shadowRoot) return;

		this.shadowRoot.querySelectorAll('.tab-button').forEach(button => {
			button.removeEventListener('click', this._boundHandleTabClick);
		});

		this.shadowRoot
			.querySelector('.new-note-button')
			?.removeEventListener('click', this._boundHandleNewNote);
	}

	private _handleSidebarTabClick(e: Event) {
		const customEvent = e as CustomEvent;
		this._handleTabClick(customEvent.detail.tab);
	}

	private _handleTabClick(e_or_tab: Event | string) {
		let tab: string;
		if (typeof e_or_tab === 'string') {
			tab = e_or_tab;
		} else {
			const button = (e_or_tab.target as HTMLElement).closest('.tab-button');
			if (!button) return;
			tab = (button as HTMLButtonElement).dataset.tab as string;
		}

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


	render() {
		if (!this.shadowRoot) return;

		this.removeEventListeners();

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
      .new-note-button {
        width: 100%;
        margin-top: 8px;
      }
    `;

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
        <notention-folder-tree></notention-folder-tree>
      </div>
    `;

		this.setupEventListeners(); // Re-attach event listeners after re-rendering
	}
}

customElements.define('notention-sidebar', Sidebar);
