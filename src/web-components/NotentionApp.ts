import { Router } from './Router';
import { Sidebar } from './Sidebar';
import './NoteEditor';
import './NotesList';
import './OntologyEditor';
import './NetworkPanel';
import './Settings';
import './Route';
import './ChatPanel';
import './ContactList';

export class NotentionApp extends HTMLElement {
  private router: Router | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handleNavigate = this._handleNavigate.bind(this);
  }

  connectedCallback() {
    this.render();
    this.router = this.shadowRoot?.querySelector('notention-router');
    this.addEventListener('notention-navigate', this._handleNavigate);
  }

  disconnectedCallback() {
    this.removeEventListener('notention-navigate', this._handleNavigate);
  }

  private _handleNavigate(event: Event) {
    const customEvent = event as CustomEvent;
    if (this.router && customEvent.detail.path) {
      this.router.navigate(customEvent.detail.path);
    }
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: var(--font-sans, Arial, sans-serif);
          color: var(--color-foreground, #333);
          background-color: var(--color-background, #fff);
        }
        .container {
          display: flex;
          flex: 1;
        }
        .main-content {
          flex: 1;
          padding: 16px;
        }
        notention-sidebar {
          width: 280px;
          border-left: 1px solid var(--color-border, #eee);
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .container {
            flex-direction: column;
          }
          notention-sidebar {
            width: 100%;
            border-left: none;
            border-bottom: 1px solid var(--color-border, #eee);
          }
        }
      </style>
      <div class="container">
        <notention-sidebar></notention-sidebar>
        <div class="main-content">
          <notention-router>
            <notention-route path="/notes" component="notention-notes-list"></notention-route>
            <notention-route path="/note" component="notention-note-editor"></notention-route>
            <notention-route path="/ontology" component="notention-ontology-editor"></notention-route>
            <notention-route path="/network" component="notention-network-panel"></notention-route>
            <notention-route path="/settings" component="notention-settings"></notention-route>
            <notention-route path="/contacts" component="notention-contact-list"></notention-route>
            <notention-route path="/chat" component="notention-chat-panel"></notention-route>
            <notention-route path="/" component="notention-notes-list"></notention-route> <!-- Default route -->
          </notention-router>
        </div>
      </div>
    `;
  }
}

customElements.define('notention-app', NotentionApp);
