import { useAppStore } from '../store';
import { UserProfile } from '../../shared/types';

export class Settings extends HTMLElement {
	private userProfile: UserProfile | null = null;
	private nostrRelays: string[] = [];
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.userProfile = state.userProfile || null;
				this.nostrRelays = state.nostrRelays;
				this.render();
			},
			state => [state.userProfile, state.nostrRelays]
		);
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private async _handleGenerateKeys() {
		const { privateKey } = await useAppStore
			.getState()
			.generateAndStoreNostrKeys();
		if (privateKey) {
			alert(`Your new private key is: ${privateKey}`);
		}
	}

	private _handleImportKey() {
		const privateKey = prompt('Enter your Nostr private key:');
		if (privateKey) {
			useAppStore.getState().generateAndStoreNostrKeys(privateKey);
		}
	}

	private _handleExportKey() {
		const privateKey = useAppStore.getState().userProfile?.nostrPrivkey;
		if (privateKey) {
			alert(`Your private key is: ${privateKey}`);
		} else {
			alert('No private key to export.');
		}
	}

	private _handleClearKeys() {
		if (
			confirm(
				'Are you sure you want to clear your keys? This cannot be undone.'
			)
		) {
			useAppStore.getState().logoutFromNostr();
		}
	}

	private _handleAddRelay() {
		const newRelayInput = this.shadowRoot?.querySelector(
			'.new-relay-input'
		) as HTMLInputElement;
		if (newRelayInput) {
			const newRelay = newRelayInput.value.trim();
			if (newRelay) {
				useAppStore.getState().addNostrRelay(newRelay);
				newRelayInput.value = '';
			}
		}
	}

	private _handleRemoveRelay(relay: string) {
		useAppStore.getState().removeNostrRelay(relay);
	}

	private _handleAiSettingsChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const { name, value, type, checked } = target;
		const update = {
			...this.userProfile?.preferences,
			[name]: type === 'checkbox' ? checked : value,
		};
		useAppStore.getState().updateUserProfile({ preferences: update });
	}

	private _handleThemeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const theme = target.value;
		const update = {
			...this.userProfile?.preferences,
			theme,
		};
		useAppStore.getState().updateUserProfile({ preferences: update });
		document.body.setAttribute('data-theme', theme);
	}

	private _toggleApiKeyVisibility() {
		const input = this.shadowRoot?.querySelector(
			'#geminiApiKey'
		) as HTMLInputElement;
		if (input) {
			input.type = input.type === 'password' ? 'text' : 'password';
		}
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      .settings-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .key-management, .relay-management, .ai-management, .theme-management {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .relay-list {
        list-style: none;
        padding: 0;
      }
      .relay-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
      }
      .api-key-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="settings-container">
        <h2>Settings</h2>
        <div class="theme-management">
          <h3>Theme</h3>
          <select class="theme-select">
            <option value="light" ${this.userProfile?.preferences?.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.userProfile?.preferences?.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="system" ${this.userProfile?.preferences?.theme === 'system' ? 'selected' : ''}>System</option>
          </select>
        </div>
        <div class="key-management">
          <h3>Nostr Key Management</h3>
          <p>Public Key: ${this.userProfile?.nostrPubkey || 'Not set'}</p>
          <button class="generate-button button">Generate New Keys</button>
          <button class="import-button button">Import Private Key</button>
          <button class="export-button button">Export Private Key</button>
          <button class="clear-button button">Clear Keys</button>
        </div>
        <div class="relay-management">
          <h3>Nostr Relay Management</h3>
          <ul class="relay-list">
            ${this.nostrRelays
							.map(
								relay => `
              <li class="relay-item">
                <span>${relay}</span>
                <button class="remove-relay-button" data-relay="${relay}">Remove</button>
              </li>
            `
							)
							.join('')}
          </ul>
          <div class="add-relay">
            <input type="text" class="new-relay-input" placeholder="wss://your.relay.com">
            <button class="add-relay-button button">Add Relay</button>
          </div>
        </div>
        <div class="ai-management">
          <h3>AI Features</h3>
          <label>
            <input type="checkbox" name="aiEnabled" .checked=${this.userProfile?.preferences?.aiEnabled}>
            Enable AI Features
          </label>
          <div>
            <label for="ollamaApiEndpoint">Ollama API Endpoint</label>
            <input type="text" id="ollamaApiEndpoint" name="ollamaApiEndpoint" value="${this.userProfile?.preferences?.ollamaApiEndpoint || ''}">
          </div>
          <div>
            <label for="geminiApiKey">Google Gemini API Key</label>
            <div class="api-key-container">
              <input type="password" id="geminiApiKey" name="geminiApiKey" value="${this.userProfile?.preferences?.geminiApiKey || ''}">
              <button class="show-api-key-button">Show</button>
            </div>
          </div>
        </div>
      </div>
    `;

		this.shadowRoot
			.querySelector('.generate-button')
			?.addEventListener('click', this._handleGenerateKeys.bind(this));
		this.shadowRoot
			.querySelector('.import-button')
			?.addEventListener('click', this._handleImportKey.bind(this));
		this.shadowRoot
			.querySelector('.export-button')
			?.addEventListener('click', this._handleExportKey.bind(this));
		this.shadowRoot
			.querySelector('.clear-button')
			?.addEventListener('click', this._handleClearKeys.bind(this));
		this.shadowRoot
			.querySelector('.add-relay-button')
			?.addEventListener('click', this._handleAddRelay.bind(this));
		this.shadowRoot.querySelectorAll('.remove-relay-button').forEach(button => {
			button.addEventListener('click', e => {
				const relay = (e.target as HTMLButtonElement).dataset.relay;
				if (relay) {
					this._handleRemoveRelay(relay);
				}
			});
		});
		this.shadowRoot.querySelectorAll('.ai-management input').forEach(input => {
			input.addEventListener('change', this._handleAiSettingsChange.bind(this));
		});
		this.shadowRoot
			.querySelector('.theme-select')
			?.addEventListener('change', this._handleThemeChange.bind(this));
		this.shadowRoot
			.querySelector('.show-api-key-button')
			?.addEventListener('click', this._toggleApiKeyVisibility.bind(this));
	}
}

customElements.define('notention-settings', Settings);
