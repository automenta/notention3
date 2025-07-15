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
    const shadowRoot = this.attachShadow({ mode: 'open' });

    shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: Arial, sans-serif;
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
          border-left: 1px solid #eee;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .container {
            flex-direction: column;
          }
          notention-sidebar {
            width: 100%;
            border-left: none;
            border-bottom: 1px solid #eee;
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
            <notention-route path="/" component="notention-notes-list"></notention-route> <!-- Default route -->
          </notention-router>
        </div>
      </div>
    `;
  }
}

customElements.define('notention-app', NotentionApp);
