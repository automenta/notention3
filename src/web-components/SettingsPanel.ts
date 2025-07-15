import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('settings-panel')
export class SettingsPanel extends LitElement {
  render() {
    return html`
      <h1>Settings</h1>
      <p>Here you can configure the application.</p>
    `;
  }
}