import { useAppStore } from '../store';
import { UserProfile } from '../../shared/types';

export class Settings extends HTMLElement {
  private userProfile: UserProfile | null = null;
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.userProfile = state.userProfile || null;
        this.render();
      },
      (state) => [state.userProfile]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private _handleGenerateKeys() {
    useAppStore.getState().generateAndStoreNostrKeys();
  }

  private _handleImportKey() {
    const privateKey = prompt('Enter your Nostr private key:');
    if (privateKey) {
      useAppStore.getState().generateAndStoreNostrKeys(privateKey);
    }
  }

  private _handleClearKeys() {
    if (confirm('Are you sure you want to clear your keys? This cannot be undone.')) {
      useAppStore.getState().logoutFromNostr();
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
      .key-management {
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
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="settings-container">
        <h2>Settings</h2>
        <div class="key-management">
          <h3>Nostr Key Management</h3>
          <p>Public Key: ${this.userProfile?.nostrPubkey || 'Not set'}</p>
          <button class="generate-button button">Generate New Keys</button>
          <button class="import-button button">Import Private Key</button>
          <button class="clear-button button">Clear Keys</button>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector('.generate-button')?.addEventListener('click', this._handleGenerateKeys.bind(this));
    this.shadowRoot.querySelector('.import-button')?.addEventListener('click', this._handleImportKey.bind(this));
    this.shadowRoot.querySelector('.clear-button')?.addEventListener('click', this._handleClearKeys.bind(this));
  }
}

customElements.define('notention-settings', Settings);
