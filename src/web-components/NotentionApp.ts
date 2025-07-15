import { Router } from './Router';
import { Sidebar } from './Sidebar';
import './NoteEditor';
import './NotesList';
import './OntologyEditor';
import './NetworkPanel';
import './Settings';
import './Route';

export class NotentionApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
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
          <h2>Welcome to Notention!</h2>
          <p>This is your decentralized note-taking and network matching app.</p>
          <notention-router>
            <notention-route path="/notes" component="notention-notes-list"></notention-route>
            <notention-route path="/note" component="notention-note-editor"></notention-route>
            <notention-route path="/ontology" component="notention-ontology-editor"></notention-route>
            <notention-route path="/network" component="notention-network-panel"></notention-route>
            <notention-route path="/settings" component="notention-settings"></notention-route>
            <notention-route path="/" component="notention-notes-list"></notention-route> <!-- Default route -->
          </notention-router>
        </div>
      </div>
    `;
  }
}

customElements.define('notention-app', NotentionApp);
