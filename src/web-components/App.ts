class App extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <div class="flex min-h-screen bg-background">
        <div class="flex flex-1">
          <div class="flex-1 flex flex-col md:flex-row">
            <div class="w-full md:w-80 border-r border-border">
              Sidebar will be here
            </div>
            <div class="flex-1 flex flex-col">
              Note editor will be here
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("my-app", App);
