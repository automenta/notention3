import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-router')
export class Router extends LitElement {
  @property({ type: String }) currentPath: string = window.location.pathname;

  constructor() {
    super();
    window.addEventListener('popstate', this._handleLocationChange.bind(this));
    window.addEventListener('notention-navigate', this._handleNavigation.bind(this) as EventListener);
  }

  connectedCallback() {
    super.connectedCallback();
    this._handleLocationChange();
  }

  private _handleLocationChange() {
    this.currentPath = window.location.pathname;
    this.requestUpdate();
  }

  private _handleNavigation(event: CustomEvent) {
    const newPath = event.detail.path;
    if (newPath !== this.currentPath) {
      window.history.pushState({}, '', newPath);
      this._handleLocationChange();
    }
  }

  render() {
    const routes = Array.from(this.querySelectorAll('notention-route'));
    const currentRoute = routes.find(route => {
      const path = route.getAttribute('path');
      return path && this.currentPath.startsWith(path);
    });

    if (currentRoute) {
      const componentTag = currentRoute.getAttribute('component');
      if (componentTag) {
        return html`<${componentTag}></${componentTag}>`;
      }
    }
    return html`<div>404 - Not Found</div>`;
  }
}
