import './index.css'
import './web-components/Sidebar.ts';
import './web-components/Button.ts';
import './web-components/NoteEditor.ts';

class App extends HTMLElement {
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
              <my-note-editor></my-note-editor>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("my-app", App);
