import { useAppStore } from '../store';

export class AccountWizard extends HTMLElement {
	private step = 1;
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private nextStep() {
		this.step++;
		this.render();
	}

	private _handleGenerateKeys() {
		useAppStore.getState().generateAndStoreNostrKeys();
		this.nextStep();
	}

	private _handleImportKey() {
		const privateKey = prompt('Enter your Nostr private key:');
		if (privateKey) {
			useAppStore.getState().generateAndStoreNostrKeys(privateKey);
			this.nextStep();
		}
	}

	private _handleSetRelays() {
		const relayInputs = this.shadowRoot?.querySelectorAll(
			'.relay-input'
		) as NodeListOf<HTMLInputElement>;
		const relays = Array.from(relayInputs)
			.map(input => input.value.trim())
			.filter(Boolean);
		if (relays.length > 0) {
			useAppStore.getState().setNostrRelays(relays);
			this.nextStep();
		} else {
			alert('Please enter at least one relay.');
		}
	}

	private _handleFinish() {
		this.dispatchEvent(
			new CustomEvent('wizard-completed', { bubbles: true, composed: true })
		);
	}

	render() {
		if (!this.shadowRoot) return;

		const styles = `
      .wizard-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .wizard-content {
        background-color: white;
        padding: 24px;
        border-radius: 8px;
        width: 80%;
        max-width: 500px;
      }
      .step {
        display: none;
      }
      .step.active {
        display: block;
      }
      .button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 16px;
      }
      .relay-inputs {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `;

		this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="wizard-container">
        <div class="wizard-content">
          <div class="step ${this.step === 1 ? 'active' : ''}">
            <h2>Welcome to Notention!</h2>
            <p>Let's get you set up for decentralized note-taking.</p>
            <button class="next-button button">Start Setup</button>
          </div>
          <div class="step ${this.step === 2 ? 'active' : ''}">
            <h3>Nostr Key Pair</h3>
            <p>Your key pair is your identity on the Nostr network. Keep your private key safe!</p>
            <button class="generate-button button">Generate New Keys</button>
            <button class="import-button button">Import Private Key</button>
          </div>
          <div class="step ${this.step === 3 ? 'active' : ''}">
            <h3>Connect to Nostr Relays</h3>
            <p>Relays are servers that store and forward your notes. You can use public relays or your own.</p>
            <div class="relay-inputs">
              <input type="text" class="relay-input" value="wss://relay.damus.io">
              <input type="text" class="relay-input" value="wss://relay.primal.net">
              <input type="text" class="relay-input" placeholder="Add another relay...">
            </div>
            <button class="set-relays-button button">Set Relays</button>
          </div>
          <div class="step ${this.step === 4 ? 'active' : ''}">
            <h3>All Set!</h3>
            <p>You're ready to start using Notention. Enjoy your new decentralized note-taking experience!</p>
            <button class="finish-button button">Finish</button>
          </div>
        </div>
      </div>
    `;

		this.shadowRoot
			.querySelector('.next-button')
			?.addEventListener('click', this.nextStep.bind(this));
		this.shadowRoot
			.querySelector('.generate-button')
			?.addEventListener('click', this._handleGenerateKeys.bind(this));
		this.shadowRoot
			.querySelector('.import-button')
			?.addEventListener('click', this._handleImportKey.bind(this));
		this.shadowRoot
			.querySelector('.set-relays-button')
			?.addEventListener('click', this._handleSetRelays.bind(this));
		this.shadowRoot
			.querySelector('.finish-button')
			?.addEventListener('click', this._handleFinish.bind(this));
	}
}

customElements.define('notention-account-wizard', AccountWizard);
