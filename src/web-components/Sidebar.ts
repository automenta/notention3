import './NotesList.ts';

class Sidebar extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex items-center justify-between p-4 border-b border-border">
          <h1 class="text-lg font-semibold">Notention</h1>
        </div>
        <div class="p-4">
          <my-button variant="outline" class="w-full">New Note</my-button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <my-notes-list></my-notes-list>
        </div>
      </div>
    `;
  }
}

customElements.define("my-sidebar", Sidebar);
