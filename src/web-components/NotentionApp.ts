import { Router } from './Router';
import { Sidebar } from './Sidebar';
import { routes } from './routes';
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
          overflow-y: auto;
        }
        notention-sidebar {
          width: 280px;
          flex-shrink: 0;
          border-right: 1px solid var(--color-border, #eee);
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .container {
            flex-direction: column-reverse;
          }
          notention-sidebar {
            width: 100%;
            border-right: none;
            border-top: 1px solid var(--color-border, #eee);
          }
          .main-content {
            padding-bottom: 0;
          }
        }
      </style>
      <div class="container">
        <notention-sidebar></notention-sidebar>
        <main class="main-content">
          <notention-router>
            ${routes.map(route => `<notention-route path="${route.path}" component="${route.component}"></notention-route>`).join('')}
          </notention-router>
        </main>
      </div>
    `;
  }
}

customElements.define('notention-app', NotentionApp);
