class NoteEditor extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="p-4 border-b border-border">
          <input type="text" placeholder="Note title" class="w-full p-2 border-0 text-lg font-semibold">
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <textarea placeholder="Write your note here..." class="w-full h-full p-2 border-0 resize-none"></textarea>
        </div>
      </div>
    `;
  }
}

customElements.define("my-note-editor", NoteEditor);
