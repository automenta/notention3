export class Router extends HTMLElement {
  private currentPath: string = window.location.pathname;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handleLocationChange = this._handleLocationChange.bind(this);
  }

  connectedCallback() {
    window.addEventListener('popstate', this._handleLocationChange);
    this._handleLocationChange();
  }

  disconnectedCallback() {
    window.removeEventListener('popstate', this._handleLocationChange);
  }

  public navigate(path: string) {
    if (path !== this.currentPath) {
      window.history.pushState({}, '', path);
      this._handleLocationChange();
    }
  }

  private _handleLocationChange() {
    this.currentPath = window.location.pathname;
    this.render();
  }

  render() {
    if (!this.shadowRoot) return;

    const routes = Array.from(this.querySelectorAll('notention-route')) as HTMLCollectionOf<HTMLElement & { path: string, component: string }>;
    const currentRoute = Array.from(routes).find(route => {
      const path = route.getAttribute('path');
      return path && this.currentPath.startsWith(path);
    });

    this.shadowRoot.innerHTML = ''; // Clear previous content

    if (currentRoute) {
      const componentTag = currentRoute.getAttribute('component');
      if (componentTag) {
        const componentElement = document.createElement(componentTag);
        // Pass attributes from the route to the component if needed
        // For example, if a route is /note?id=123, you might want to pass 'id' to the note editor
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.forEach((value, key) => {
          componentElement.setAttribute(key, value);
        });
        this.shadowRoot.appendChild(componentElement);
      }
    } else {
      const notFoundDiv = document.createElement('div');
      notFoundDiv.textContent = '404 - Not Found';
      this.shadowRoot.appendChild(notFoundDiv);
    }
  }
}

customElements.define('notention-router', Router);
