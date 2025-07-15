import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-network-panel')
export class NetworkPanel extends LitElement {
  @property({ type: Boolean }) isConnected: boolean = false;
  @property({ type: Array }) channels: any[] = []; // Placeholder for channels
  @property({ type: Array }) matches: any[] = []; // Placeholder for matches

  render() {
    return html`
      <style>
        :host {
          display: block;
          padding: 16px;
        }
        h3 {
          margin-top: 0;
        }
        .status {
          margin-bottom: 16px;
          font-weight: bold;
        }
        .status.connected {
          color: green;
        }
        .status.disconnected {
          color: red;
        }
        .section {
          margin-bottom: 24px;
          border: 1px solid #eee;
          padding: 12px;
          border-radius: 4px;
        }
        .section h4 {
          margin-top: 0;
          margin-bottom: 12px;
        }
        .list-item {
          padding: 8px 0;
          border-bottom: 1px dashed #eee;
        }
        .list-item:last-child {
          border-bottom: none;
        }
      </style>
      <h3>Network Panel</h3>
      <div class="status ${this.isConnected ? 'connected' : 'disconnected'}">
        Status: ${this.isConnected ? 'Connected to Nostr' : 'Disconnected'}
      </div>

      <div class="section">
        <h4>Channels</h4>
        ${this.channels.length === 0
          ? html`<p>No channels joined.</p>`
          : this.channels.map(channel => html`
              <div class="list-item">#${channel.name}</div>
            `)}
      </div>

      <div class="section">
        <h4>Matches</h4>
        ${this.matches.length === 0
          ? html`<p>No matches found.</p>`
          : this.matches.map(match => html`
              <div class="list-item">Match: ${match.title} (from ${match.author})</div>
            `)}
      </div>
    `;
  }
}
