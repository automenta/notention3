import './index.css'
import './web-components/Sidebar.ts';
import './web-components/Button.ts';
import './web-components/NoteEditor.ts';
import './web-components/Router.ts';
import './web-components/Route.ts';
import { NoteService } from './services/NoteService.js';
import { DBService } from './services/db.js';

class App extends HTMLElement {
  private noteEditor: HTMLElement | null = null;

  constructor() {
    super();
    this.innerHTML = `
      <div class="flex min-h-screen bg-background">
        <div class="flex flex-1">
          <div class="flex-1 flex flex-col md:flex-row">
            <div class="w-full md:w-80 border-r border-border">
              <my-sidebar></my-sidebar>
            </div>
            <div class="flex-1 flex flex-col">
              <my-router>
                <my-route path="/note" component="my-note-editor"></my-route>
              </my-router>
            </div>
          </div>
        </div>
      </div>
    `;

  }
}

customElements.define("my-app", App);
