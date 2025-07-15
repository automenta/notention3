class Router extends HTMLElement {
  constructor() {
    super();
    this.handleLocationChange();
    window.addEventListener("popstate", this.handleLocationChange.bind(this));
  }

  handleLocationChange() {
    const path = window.location.pathname;
    const routes = Array.from(this.querySelectorAll("my-route"));
    const route = routes.find((r) => path.startsWith(r.getAttribute("path")));

    if (route) {
      const component = route.getAttribute("component");
      if (component) {
        this.innerHTML = `<${component}></${component}>`;
      }
    }
  }
}

customElements.define("my-router", Router);
