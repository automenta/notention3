import { useAppStore } from '../store';
import { UserProfile as UserProfileType } from '../../shared/types';

export class NotentionUserProfile extends HTMLElement {
	private profile: UserProfileType | undefined;
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.profile = state.userProfile;
				this.render();
			}
		);
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	private _copyPublicKey() {
		if (this.profile?.nostrPubkey) {
			navigator.clipboard.writeText(this.profile.nostrPubkey);
			// Maybe show a toast or something
		}
	}

	render() {
		if (!this.shadowRoot) return;

		this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
        }
        .profile-card {
          border: 1px solid #ccc;
          padding: 16px;
          border-radius: 8px;
        }
        .profile-field {
          margin-bottom: 8px;
        }
        .profile-field label {
          font-weight: bold;
        }
        .pubkey {
            word-break: break-all;
        }
      </style>
      <div class="profile-card">
        <h2>User Profile</h2>
        ${
					this.profile
						? `
              <div class="profile-field">
                <label>Nostr Public Key:</label>
                <span class="pubkey">${this.profile.nostrPubkey}</span>
                <button class="copy-button">Copy</button>
              </div>
              <div class="profile-field">
                <label>Shared Tags:</label>
                <span>${this.profile.sharedTags.join(', ')}</span>
              </div>
            `
						: '<p>Loading profile...</p>'
				}
      </div>
    `;

		this.shadowRoot
			.querySelector('.copy-button')
			?.addEventListener('click', () => this._copyPublicKey());
	}
}

customElements.define('notention-user-profile', NotentionUserProfile);
