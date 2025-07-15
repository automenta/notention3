class NotesList extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="p-4 border-b border-border">
          <input type="text" placeholder="Search notes..." class="w-full p-2 border rounded-md border-border">
        </div>
        <div class="flex-1 overflow-y-auto">
          <ul>
            <li class="p-4 border-b border-border">
              <h2 class="font-semibold">First Note</h2>
              <p class="text-sm text-muted-foreground">This is the first note.</p>
            </li>
            <li class="p-4 border-b border-border">
              <h2 class="font-semibold">Second Note</h2>
              <p class="text-sm text-muted-foreground">This is the second note.</p>
            </li>
          </ul>
        </div>
      </div>
    `;
  }
}

customElements.define("my-notes-list", NotesList);
