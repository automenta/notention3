import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-settings')
export class Settings extends LitElement {
  @property({ type: Boolean }) aiEnabled: boolean = false;
  @property({ type: String }) nostrPubkey: string = '';

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
        .setting-section {
          margin-bottom: 24px;
          border: 1px solid #eee;
          padding: 12px;
          border-radius: 4px;
        }
        .setting-section h4 {
          margin-top: 0;
          margin-bottom: 12px;
        }
        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px dashed #eee;
        }
        .setting-item:last-child {
          border-bottom: none;
        }
        .setting-item label {
          flex: 1;
        }
        .setting-item input[type="checkbox"],
        .setting-item input[type="text"] {
          margin-left: 16px;
        }
        .setting-item input[type="text"] {
          flex: 2;
          padding: 6px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
      </style>
      <h3>Settings</h3>

      <div class="setting-section">
        <h4>User Profile</h4>
        <div class="setting-item">
          <label for="pubkey">Nostr Public Key:</label>
          <input type="text" id="pubkey" .value="${this.nostrPubkey}" readonly>
        </div>
        <div class="setting-item">
          <label>Shared Tags:</label>
          <span>#tag1, #tag2</span>
        </div>
      </div>

      <div class="setting-section">
        <h4>AI Features</h4>
        <div class="setting-item">
          <label for="enable-ai">Enable AI:</label>
          <input type="checkbox" id="enable-ai" .checked="${this.aiEnabled}">
        </div>
        <div class="setting-item">
          <label for="ollama-endpoint">Ollama API Endpoint:</label>
          <input type="text" id="ollama-endpoint" placeholder="http://localhost:11434">
        </div>
        <div class="setting-item">
          <label for="gemini-key">Google Gemini API Key:</label>
          <input type="text" id="gemini-key" placeholder="YOUR_GEMINI_API_KEY">
        </div>
      </div>

      <div class="setting-section">
        <h4>Nostr Relays</h4>
        <p>Manage your Nostr relay connections.</p>
        <notention-button>Manage Relays</notention-button>
      </div>

      <div class="setting-section">
        <h4>Theme</h4>
        <div class="setting-item">
          <label for="theme-toggle">Dark Mode:</label>
          <input type="checkbox" id="theme-toggle">
        </div>
      </div>
    `;
  }
}
