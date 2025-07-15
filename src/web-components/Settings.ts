import { useAppStore } from '../store';
import { UserProfile, AppPreferences } from '../../shared/types';

export class Settings extends HTMLElement {
  private userProfile: UserProfile | undefined;
  private preferences: AppPreferences | undefined;

  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handleNostrPubkeyChange = this._handleNostrPubkeyChange.bind(this);
    this._handleSharedTagsChange = this._handleSharedTagsChange.bind(this);
    this._handleEnableAICheckboxChange = this._handleEnableAICheckboxChange.bind(this);
    this._handleGeminiApiKeyChange = this._handleGeminiApiKeyChange.bind(this);
    this._handleOllamaApiEndpointChange = this._handleOllamaApiEndpointChange.bind(this);
    this._handleThemeChange = this._handleThemeChange.bind(this);
    this._handleGenerateKeypair = this._handleGenerateKeypair.bind(this);
    this._handleImportKeypair = this._handleImportKeypair.bind(this);
    this._handleImportData = this._handleImportData.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.userProfile = state.userProfile;
        this.preferences = state.preferences;
        this.render(); // Re-render when store state changes
      },
      (state) => [state.userProfile, state.preferences]
    );
    useAppStore.getState().loadUserProfile();
    useAppStore.getState().loadPreferences();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.removeEventListeners();
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.querySelector('#nostr-pubkey')?.addEventListener('input', this._handleNostrPubkeyChange);
    this.shadowRoot.querySelector('#shared-tags')?.addEventListener('input', this._handleSharedTagsChange);
    this.shadowRoot.querySelector('#enable-ai-checkbox')?.addEventListener('change', this._handleEnableAICheckboxChange);
    this.shadowRoot.querySelector('#gemini-api-key')?.addEventListener('input', this._handleGeminiApiKeyChange);
    this.shadowRoot.querySelector('#ollama-api-endpoint')?.addEventListener('input', this._handleOllamaApiEndpointChange);
    this.shadowRoot.querySelector('#theme-select')?.addEventListener('change', this._handleThemeChange);

    this.shadowRoot.querySelector('.generate-keypair-button')?.addEventListener('click', this._handleGenerateKeypair);
    this.shadowRoot.querySelector('.import-keypair-button')?.addEventListener('click', this._handleImportKeypair);
    this.shadowRoot.querySelector('.export-data-button')?.addEventListener('click', () => useAppStore.getState().exportData());
    this.shadowRoot.querySelector('.import-data-button')?.addEventListener('click', this._handleImportData);
    this.shadowRoot.querySelector('.clear-all-data-button')?.addEventListener('click', () => useAppStore.getState().clearAllData());
  }

  private removeEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.querySelector('#nostr-pubkey')?.removeEventListener('input', this._handleNostrPubkeyChange);
    this.shadowRoot.querySelector('#shared-tags')?.removeEventListener('input', this._handleSharedTagsChange);
    this.shadowRoot.querySelector('#enable-ai-checkbox')?.removeEventListener('change', this._handleEnableAICheckboxChange);
    this.shadowRoot.querySelector('#gemini-api-key')?.removeEventListener('input', this._handleGeminiApiKeyChange);
    this.shadowRoot.querySelector('#ollama-api-endpoint')?.removeEventListener('input', this._handleOllamaApiEndpointChange);
    this.shadowRoot.querySelector('#theme-select')?.removeEventListener('change', this._handleThemeChange);

    this.shadowRoot.querySelector('.generate-keypair-button')?.removeEventListener('click', this._handleGenerateKeypair);
    this.shadowRoot.querySelector('.import-keypair-button')?.removeEventListener('click', this._handleImportKeypair);
    this.shadowRoot.querySelector('.export-data-button')?.removeEventListener('click', () => useAppStore.getState().exportData());
    this.shadowRoot.querySelector('.import-data-button')?.removeEventListener('click', this._handleImportData);
    this.shadowRoot.querySelector('.clear-all-data-button')?.removeEventListener('click', () => useAppStore.getState().clearAllData());
  }

  private _handleNostrPubkeyChange(e: Event) {
    const pubkey = (e.target as HTMLInputElement).value;
    useAppStore.getState().updateUserProfile({ nostrPubkey: pubkey });
  }

  private _handleSharedTagsChange(e: Event) {
    const tags = (e.target as HTMLInputElement).value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    useAppStore.getState().updateUserProfile({ sharedTags: tags });
  }

  private _handleEnableAICheckboxChange(e: Event) {
    const enabled = (e.target as HTMLInputElement).checked;
    useAppStore.getState().updatePreferences({ ai: { ...this.preferences?.ai, enabled } });
  }

  private _handleGeminiApiKeyChange(e: Event) {
    const apiKey = (e.target as HTMLInputElement).value;
    useAppStore.getState().updatePreferences({ ai: { ...this.preferences?.ai, geminiApiKey: apiKey } });
  }

  private _handleOllamaApiEndpointChange(e: Event) {
    const apiEndpoint = (e.target as HTMLInputElement).value;
    useAppStore.getState().updatePreferences({ ai: { ...this.preferences?.ai, ollamaApiEndpoint: apiEndpoint } });
  }

  private _handleThemeChange(e: Event) {
    const theme = (e.target as HTMLSelectElement).value as 'light' | 'dark';
    useAppStore.getState().updatePreferences({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  }

  private _handleGenerateKeypair() {
    console.log('Generate Keypair');
    // Implement keypair generation logic
  }

  private _handleImportKeypair() {
    console.log('Import Keypair');
    // Implement keypair import logic
  }

  private _handleImportData() {
    console.log('Import Data');
    // Implement data import logic
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      :host {
        display: block;
        padding: 16px;
        background-color: var(--color-background);
        color: var(--color-foreground);
        height: 100%;
        overflow-y: auto;
      }
      .settings-section {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background-color: var(--color-card);
      }
      .settings-section h3 {
        margin-top: 0;
        color: var(--color-primary);
        border-bottom: 1px solid var(--color-border);
        padding-bottom: 10px;
        margin-bottom: 15px;
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
        color: var(--color-foreground);
      }
      .form-group input[type="text"],
      .form-group input[type="password"],
      .form-group select {
        width: calc(100% - 20px);
        padding: 10px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background-color: var(--color-input);
        color: var(--color-foreground);
        font-size: 1em;
      }
      .form-group input[type="checkbox"] {
        margin-right: 10px;
      }
      .button-group {
        margin-top: 20px;
        display: flex;
        gap: 10px;
      }
      .action-button {
        padding: 10px 15px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .action-button:hover {
        background-color: var(--color-primary-foreground);
        color: var(--color-primary);
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="settings-section">
        <h3>User Profile</h3>
        <div class="form-group">
          <label for="nostr-pubkey">Nostr Public Key:</label>
          <input
            type="text"
            id="nostr-pubkey"
            value="${this.userProfile?.nostrPubkey || ''}"
            placeholder="Your Nostr Public Key"
          >
        </div>
        <div class="form-group">
          <label for="shared-tags">Shared Tags (comma-separated):</label>
          <input
            type="text"
            id="shared-tags"
            value="${this.userProfile?.sharedTags?.join(', ') || ''}"
            placeholder="e.g., #public, #notes"
          >
        </div>
        <div class="button-group">
          <button class="action-button generate-keypair-button">Generate New Keypair</button>
          <button class="action-button import-keypair-button">Import Keypair</button>
        </div>
      </div>

      <div class="settings-section">
        <h3>AI Features (Optional)</h3>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              id="enable-ai-checkbox"
              ${this.preferences?.ai?.enabled ? 'checked' : ''}
            > Enable AI Features
          </label>
        </div>
        <div class="form-group">
          <label for="gemini-api-key">Google Gemini API Key:</label>
          <input
            type="password"
            id="gemini-api-key"
            value="${this.preferences?.ai?.geminiApiKey || ''}"
            placeholder="Enter your Gemini API Key"
          >
        </div>
        <div class="form-group">
          <label for="ollama-api-endpoint">Ollama API Endpoint:</label>
          <input
            type="text"
            id="ollama-api-endpoint"
            value="${this.preferences?.ai?.ollamaApiEndpoint || ''}"
            placeholder="e.g., http://localhost:11434"
          >
        </div>
      </div>

      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="form-group">
          <label for="theme-select">Theme:</label>
          <select id="theme-select">
            <option value="light" ${this.preferences?.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.preferences?.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3>Data Management</h3>
        <div class="button-group">
          <button class="action-button export-data-button">Export All Data</button>
          <button class="action-button import-data-button">Import Data</button>
          <button class="action-button clear-all-data-button">Clear All Data</button>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }
}

customElements.define('notention-settings', Settings);